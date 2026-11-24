import { NextRequest, NextResponse } from 'next/server';
import { DB_ROOT_NODE } from '@/lib/firebase';
import {
  buildClaimInlineKeyboard,
  callTelegramApi,
  findLeadersForTaskRole,
  findTaskRecordById,
  formatClaimMessageHtml,
  getSiteBaseUrl,
  getTelegramBotToken,
  getTelegramConfig,
  patchRtdbNode,
  readRtdbNode,
  resolveMilestoneTitle,
  resolveTaskCanonicalRole,
  resolveTopicThreadId,
} from '@/lib/telegramService';
import type { User } from '@/types/task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!getTelegramBotToken()) {
      return NextResponse.json({ ok: false, skipped: true, reason: 'TELEGRAM_BOT_TOKEN chưa được cấu hình' });
    }

    const body = await req.json();
    const { taskId, requesterAccount, targetWeek, dbRootNode = DB_ROOT_NODE } = body || {};

    if (!taskId || !requesterAccount) {
      return NextResponse.json({ ok: false, error: 'Thiếu taskId hoặc requesterAccount' }, { status: 400 });
    }

    const config = await getTelegramConfig(dbRootNode);
    if (!config.enabled || !config.chatId) {
      return NextResponse.json({ ok: false, skipped: true, reason: 'Telegram chưa bật hoặc chưa cấu hình chatId' });
    }

    const taskRec = await findTaskRecordById(taskId, dbRootNode);
    if (!taskRec) {
      return NextResponse.json({ ok: false, error: 'Không tìm thấy task trong DB' }, { status: 404 });
    }

    const usersObj = (await readRtdbNode<Record<string, User>>('users', dbRootNode)) || {};
    const usersList = Object.values(usersObj).filter(Boolean);

    const requesterUser = usersList.find(
      (u) => u.account && u.account.toLowerCase() === String(requesterAccount).trim().toLowerCase()
    );

    const { displayRole } = resolveTaskCanonicalRole(taskRec.task);
    const leaders = findLeadersForTaskRole(usersList, displayRole, requesterAccount);
    const milestoneTitle = await resolveMilestoneTitle(taskRec.task.milestoneId, dbRootNode);
    const threadId = resolveTopicThreadId(config, displayRole);

    const reqOrigin = req.headers.get('origin') || undefined;
    const siteBaseUrl = getSiteBaseUrl(reqOrigin);

    const htmlText = formatClaimMessageHtml({
      task: taskRec.task,
      requesterName: requesterUser?.name || requesterAccount,
      requesterAccount: requesterUser?.account || requesterAccount,
      requesterTelegram: requesterUser?.telegramAccount,
      leaders,
      milestoneTitle,
      targetWeek: targetWeek ? Number(targetWeek) : taskRec.task.requestedWeekNumber || taskRec.task.weekNumber,
    });

    const replyMarkup = buildClaimInlineKeyboard(taskRec.task, siteBaseUrl, true);

    const sendPayload: Record<string, unknown> = {
      chat_id: config.chatId,
      text: htmlText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    };
    if (threadId) {
      sendPayload.message_thread_id = threadId;
    }

    const tgRes = await callTelegramApi<{ message_id: number }>('sendMessage', sendPayload);
    if (!tgRes.ok || !tgRes.result?.message_id) {
      console.error('[Telegram notify-claim] sendMessage failed:', tgRes);
      return NextResponse.json(
        { ok: false, error: tgRes.description || 'Không gửi được tin nhắn Telegram' },
        { status: 502 }
      );
    }

    // Lưu metadata tin nhắn lên task để đồng bộ gỡ nút khi duyệt / từ chối từ Web hoặc Telegram
    await patchRtdbNode(
      `tasks/${encodeURIComponent(taskRec.key)}`,
      {
        telegramClaimMessage: {
          chatId: config.chatId,
          ...(threadId ? { threadId } : {}),
          messageId: tgRes.result.message_id,
          sentAt: new Date().toISOString(),
        },
      },
      dbRootNode
    );

    return NextResponse.json({
      ok: true,
      messageId: tgRes.result.message_id,
      threadId: threadId || null,
    });
  } catch (err: any) {
    console.error('[Telegram notify-claim] error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
