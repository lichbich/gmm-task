import { NextRequest, NextResponse } from 'next/server';
import { DB_ROOT_NODE } from '@/lib/firebase';
import {
  buildClaimInlineKeyboard,
  callTelegramApi,
  findLeadersForTaskRole,
  findTaskRecordById,
  formatClaimMessageHtml,
  formatVnTimeShort,
  getSiteBaseUrl,
  getTelegramBotToken,
  readRtdbNode,
  resolveMilestoneTitle,
  resolveTaskCanonicalRole,
} from '@/lib/telegramService';
import type { User } from '@/types/task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Đồng bộ ngược từ Web -> Telegram:
 * Khi Leader/Admin bấm Duyệt hoặc Từ chối trên Web, tự động chỉnh sửa tin nhắn Telegram cũ
 * để gỡ 2 nút Duyệt/Từ chối và cập nhật kết quả.
 */
export async function POST(req: NextRequest) {
  try {
    if (!getTelegramBotToken()) {
      return NextResponse.json({ ok: false, skipped: true });
    }

    const body = await req.json();
    const {
      taskId,
      status, // 'APPROVED' | 'REJECTED'
      requesterAccount,
      actorAccount,
      actorName,
      dbRootNode = DB_ROOT_NODE,
    } = body || {};

    if (!taskId || (status !== 'APPROVED' && status !== 'REJECTED')) {
      return NextResponse.json({ ok: false, error: 'Thiếu tham số hợp lệ' }, { status: 400 });
    }

    const taskRec = await findTaskRecordById(taskId, dbRootNode);
    if (!taskRec || !taskRec.task.telegramClaimMessage?.messageId || !taskRec.task.telegramClaimMessage?.chatId) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Task không có tin nhắn Telegram cần đồng bộ' });
    }

    const usersObj = (await readRtdbNode<Record<string, User>>('users', dbRootNode)) || {};
    const usersList = Object.values(usersObj).filter(Boolean);

    const reqAcc = requesterAccount || taskRec.task.assignmentRequestedBy || taskRec.task.assigneeAccount || '';
    const requesterUser = usersList.find((u) => u.account && u.account.toLowerCase() === String(reqAcc).toLowerCase());
    const actorUser = usersList.find(
      (u) => u.account && u.account.toLowerCase() === String(actorAccount || '').toLowerCase()
    );

    const { displayRole } = resolveTaskCanonicalRole(taskRec.task);
    const leaders = findLeadersForTaskRole(usersList, displayRole, reqAcc);
    const milestoneTitle = await resolveMilestoneTitle(taskRec.task.milestoneId, dbRootNode);
    const siteBaseUrl = getSiteBaseUrl(req.headers.get('origin') || undefined);

    const updatedHtml = formatClaimMessageHtml({
      task: taskRec.task,
      requesterName: requesterUser?.name || reqAcc || 'Thành viên',
      requesterAccount: requesterUser?.account || reqAcc || 'unknown',
      requesterTelegram: requesterUser?.telegramAccount,
      leaders,
      milestoneTitle,
      resolution: {
        status,
        actorName: actorUser?.name || actorName || actorAccount || 'Leader',
        actorAccount: actorUser?.account || actorAccount || 'leader',
        actorTelegram: actorUser?.telegramAccount,
        via: 'Web',
        atTime: formatVnTimeShort(),
      },
    });

    const tgRes = await callTelegramApi('editMessageText', {
      chat_id: taskRec.task.telegramClaimMessage.chatId,
      message_id: taskRec.task.telegramClaimMessage.messageId,
      text: updatedHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: buildClaimInlineKeyboard(taskRec.task, siteBaseUrl, false),
    });

    return NextResponse.json({ ok: tgRes.ok, description: tgRes.description });
  } catch (err: any) {
    console.error('[Telegram sync-status] error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
