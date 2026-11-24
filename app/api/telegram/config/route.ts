import { NextRequest, NextResponse } from 'next/server';
import { DB_ROOT_NODE } from '@/lib/firebase';
import {
  callTelegramApi,
  escapeTelegramHtml,
  getSiteBaseUrl,
  getTelegramBotToken,
  getTelegramConfig,
  getTelegramWebhookSecret,
  resolveTopicThreadId,
  saveTelegramConfig,
} from '@/lib/telegramService';
import type { TelegramConfig } from '@/types/task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isRootAdminRequest(req: NextRequest, bodyAccount?: string): boolean {
  const headerAcc = (req.headers.get('x-saho-account') || '').trim().toLowerCase();
  const payloadAcc = String(bodyAccount || '').trim().toLowerCase();
  return headerAcc === 'admin' || payloadAcc === 'admin';
}

/**
 * GET: Lấy trạng thái cấu hình Telegram hiện tại + thông tin Bot & Webhook (Chỉ dành cho Staff Code: admin)
 */
export async function GET(req: NextRequest) {
  try {
    if (!isRootAdminRequest(req)) {
      return NextResponse.json(
        { ok: false, error: 'Chỉ tài khoản quản trị gốc (Staff Code: admin) mới có quyền xem cấu hình Bot Telegram.' },
        { status: 403 }
      );
    }

    const hasBotToken = Boolean(getTelegramBotToken());
    const config = await getTelegramConfig(DB_ROOT_NODE);

    let botUsername = '';
    let webhookUrl = '';
    if (hasBotToken) {
      const [meRes, whRes] = await Promise.all([
        callTelegramApi<{ username?: string }>('getMe', {}),
        callTelegramApi<{ url?: string }>('getWebhookInfo', {}),
      ]);
      if (meRes.ok && meRes.result?.username) {
        botUsername = meRes.result.username;
      }
      if (whRes.ok && whRes.result?.url) {
        webhookUrl = whRes.result.url;
      }
    }

    return NextResponse.json({
      ok: true,
      dbRootNode: DB_ROOT_NODE,
      hasBotToken,
      botUsername,
      webhookUrl,
      config,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Lỗi tải cấu hình Telegram' }, { status: 500 });
  }
}

/**
 * POST: Lưu cấu hình Telegram / Đăng ký Webhook / Gửi tin nhắn test
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!isRootAdminRequest(req, body?.requesterAccount || body?.config?.updatedBy)) {
      return NextResponse.json(
        { ok: false, error: 'Chỉ tài khoản quản trị gốc (Staff Code: admin) mới có quyền cấu hình Bot Telegram.' },
        { status: 403 }
      );
    }

    const action = String(body?.action || 'save');

    if (action === 'save') {
      const incoming = body?.config as TelegramConfig;
      if (!incoming) {
        return NextResponse.json({ ok: false, error: 'Thiếu dữ liệu config' }, { status: 400 });
      }
      const saved = await saveTelegramConfig(incoming, DB_ROOT_NODE);
      if (!saved) {
        return NextResponse.json({ ok: false, error: 'Không thể lưu cấu hình lên Firebase' }, { status: 500 });
      }
      const latest = await getTelegramConfig(DB_ROOT_NODE);
      return NextResponse.json({ ok: true, config: latest });
    }

    if (action === 'register_webhook') {
      if (!getTelegramBotToken()) {
        return NextResponse.json({ ok: false, error: 'Chưa cấu hình TELEGRAM_BOT_TOKEN trong biến môi trường.' }, { status: 400 });
      }
      const customBaseUrl = String(body?.webhookBaseUrl || '').trim().replace(/\/+$/, '');
      const baseUrl = customBaseUrl || getSiteBaseUrl(req.headers.get('origin') || undefined);
      if (!baseUrl.startsWith('https://')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Telegram bắt buộc Webhook phải là URL HTTPS công khai (VD: https://gmm-task.vercel.app hoặc link ngrok/cloudflared HTTPS).',
          },
          { status: 400 }
        );
      }

      const webhookUrl = `${baseUrl}/api/telegram/webhook?db=${encodeURIComponent(DB_ROOT_NODE)}`;
      const secretToken = getTelegramWebhookSecret();

      const tgRes = await callTelegramApi('setWebhook', {
        url: webhookUrl,
        secret_token: secretToken,
        // Tối ưu tài nguyên tối đa: CHỈ nhận sự kiện bấm nút Duyệt/Từ chối (callback_query),
        // bỏ qua toàn bộ tin nhắn chat thường trong nhóm để không tốn Function Invocations trên Vercel.
        allowed_updates: ['callback_query'],
        drop_pending_updates: true,
      });

      if (!tgRes.ok) {
        return NextResponse.json({ ok: false, error: tgRes.description || 'Đăng ký webhook thất bại' }, { status: 502 });
      }
      return NextResponse.json({ ok: true, webhookUrl });
    }

    if (action === 'test_message') {
      if (!getTelegramBotToken()) {
        return NextResponse.json({ ok: false, error: 'Chưa cấu hình TELEGRAM_BOT_TOKEN trong biến môi trường.' }, { status: 400 });
      }
      const config = await getTelegramConfig(DB_ROOT_NODE);
      const targetChatId = String(body?.chatId || config.chatId || '').trim();
      if (!targetChatId) {
        return NextResponse.json({ ok: false, error: 'Vui lòng nhập Group Chat ID trước khi gửi test.' }, { status: 400 });
      }
      const testRole = String(body?.role || '').trim();
      const threadId = testRole ? resolveTopicThreadId(config, testRole) : config.defaultThreadId;

      const payload: Record<string, unknown> = {
        chat_id: targetChatId,
        text: [
          '🤖 <b>Saho Task — Kiểm tra kết nối Telegram thành công!</b>',
          `• <b>Database:</b> <code>${escapeTelegramHtml(DB_ROOT_NODE)}</code>`,
          `• <b>Role test:</b> <code>${escapeTelegramHtml(testRole || 'Mặc định')}</code>`,
          `• <b>Topic Thread ID:</b> <code>${threadId || 'General'}</code>`,
        ].join('\n'),
        parse_mode: 'HTML',
      };
      if (threadId) payload.message_thread_id = threadId;

      const tgRes = await callTelegramApi('sendMessage', payload);
      if (!tgRes.ok) {
        return NextResponse.json({ ok: false, error: tgRes.description || 'Gửi tin nhắn test thất bại' }, { status: 502 });
      }
      return NextResponse.json({ ok: true, messageId: tgRes.result?.message_id });
    }

    return NextResponse.json({ ok: false, error: 'Action không hợp lệ' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
