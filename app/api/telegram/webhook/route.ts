import { NextRequest, NextResponse } from 'next/server';
import { DB_ROOT_NODE } from '@/lib/firebase';
import {
  buildClaimInlineKeyboard,
  callTelegramApi,
  canUserApproveTaskRole,
  findLeadersForTaskRole,
  findTaskRecordById,
  findUserByTelegramIdentity,
  formatClaimMessageHtml,
  formatVnTimeShort,
  getSiteBaseUrl,
  getTelegramWebhookSecret,
  normalizeTelegramAccount,
  patchRtdbNode,
  readRtdbNode,
  resolveMilestoneTitle,
  resolveTaskCanonicalRole,
  writeRtdbNode,
} from '@/lib/telegramService';
import type { User } from '@/types/task';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function answerCallback(callbackQueryId: string, text: string, showAlert = false) {
  await callTelegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

async function pushInAppNotification(
  targetAccount: string,
  title: string,
  body: string,
  taskId: string,
  senderAccount: string,
  senderName: string,
  type: 'TASK_APPROVED' | 'TASK_ASSIGNED',
  dbRootNode: string
) {
  if (!targetAccount) return;
  const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const sanitizedKey = targetAccount.replace(/[.#$\[\]\/]/g, '_');
  const notifPayload = {
    id: notifId,
    title,
    body,
    url: `/?taskId=${taskId}`,
    taskId,
    senderAccount,
    senderName,
    type,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  // Ghi song song cả khóa thường và khóa chữ thường giống send-push/route.ts
  await writeRtdbNode(`notifications/${sanitizedKey}/${notifId}`, notifPayload, dbRootNode);
  if (sanitizedKey.toLowerCase() !== sanitizedKey) {
    await writeRtdbNode(`notifications/${sanitizedKey.toLowerCase()}/${notifId}`, notifPayload, dbRootNode);
  }
}

export async function POST(req: NextRequest) {
  try {
    // LỚP BẢO MẬT 1: Xác thực Secret Token từ Telegram
    const expectedSecret = getTelegramWebhookSecret();
    const receivedSecret = req.headers.get('x-telegram-bot-api-secret-token') || '';
    if (expectedSecret && receivedSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized webhook secret' }, { status: 401 });
    }

    // Cho phép chọn DB node qua query ?db=gmm-task-test (nếu không truyền thì dùng mặc định DB_ROOT_NODE)
    const queryDb = req.nextUrl.searchParams.get('db');
    const dbRootNode = queryDb === 'gmm-task-test' || queryDb === 'gmm-task' ? queryDb : DB_ROOT_NODE;
    const siteBaseUrl = getSiteBaseUrl(req.nextUrl.origin);

    const update = await req.json();

    // Tối ưu tài nguyên: bỏ qua ngay mọi update không phải callback_query (không chạm Firebase)
    if (!update?.callback_query) {
      return NextResponse.json({ ok: true });
    }

    // =========================================================================
    // XỬ LÝ NÚT BẤM INLINE (DUYỆT / TỪ CHỐI GIAO TASK)
    // =========================================================================
    if (update?.callback_query) {
      const cq = update.callback_query;
      const callbackId: string = cq.id;
      const data: string = String(cq.data || '');
      const from = cq.from || {};
      const fromId = from.id ? String(from.id) : '';
      const fromUsername = normalizeTelegramAccount(from.username);
      const message = cq.message;

      // Parse callback_data: "tc:a:<taskId>" (approve) | "tc:r:<taskId>" (reject)
      const match = data.match(/^tc:(a|r):(.+)$/);
      if (!match) {
        await answerCallback(callbackId, 'Thao tác không hợp lệ.');
        return NextResponse.json({ ok: true });
      }

      const action = match[1] === 'a' ? 'APPROVED' : 'REJECTED';
      const taskId = match[2];

      // LỚP BẢO MẬT 2: Đối chiếu danh tính thật từ Telegram (from.id / from.username) với DB Saho
      const identity = await findUserByTelegramIdentity(fromId, fromUsername, dbRootNode);
      if (!identity) {
        await answerCallback(
          callbackId,
          '⚠️ Tài khoản Telegram của bạn chưa được liên kết với Saho Task. Vui lòng cập nhật Account Telegram trong Hồ sơ cá nhân trên Saho Task.',
          true
        );
        return NextResponse.json({ ok: true });
      }

      const { key: actorUserKey, user: actorUser } = identity;

      // Tự động gắn cố định telegramUserId vào hồ sơ nếu khớp lần đầu qua @username
      if (fromId && actorUser.telegramUserId !== fromId) {
        await patchRtdbNode(
          `users/${encodeURIComponent(actorUserKey)}`,
          {
            telegramUserId: fromId,
            ...(fromUsername && !actorUser.telegramAccount ? { telegramAccount: fromUsername } : {}),
          },
          dbRootNode
        );
      }

      // Đọc bản ghi task mới nhất từ DB
      const taskRec = await findTaskRecordById(taskId, dbRootNode);
      if (!taskRec) {
        await answerCallback(callbackId, '❌ Không tìm thấy task này trên hệ thống (có thể đã bị xóa).', true);
        return NextResponse.json({ ok: true });
      }

      const task = taskRec.task;
      const { displayRole } = resolveTaskCanonicalRole(task);

      // LỚP BẢO MẬT 3: Chỉ Admin hoặc Leader / Advisor của ĐÚNG ROLE đó mới có quyền duyệt
      const hasPermission = canUserApproveTaskRole(actorUser, displayRole);
      if (!hasPermission) {
        await answerCallback(
          callbackId,
          `⛔ Chỉ Leader / Advisor của team ${displayRole} hoặc Admin mới có quyền duyệt yêu cầu này!`,
          true
        );
        return NextResponse.json({ ok: true });
      }

      // Chặn tự duyệt chính yêu cầu của mình (trừ Admin)
      if (
        actorUser.role !== 'Admin' &&
        task.assignmentRequestedBy &&
        task.assignmentRequestedBy.toLowerCase() === actorUser.account.toLowerCase()
      ) {
        await answerCallback(callbackId, '⛔ Bạn không thể tự duyệt yêu cầu nhận task của chính mình.', true);
        return NextResponse.json({ ok: true });
      }

      const usersObj = (await readRtdbNode<Record<string, User>>('users', dbRootNode)) || {};
      const usersList = Object.values(usersObj).filter(Boolean);
      const milestoneTitle = await resolveMilestoneTitle(task.milestoneId, dbRootNode);

      // LỚP BẢO MẬT 4: Kiểm tra trạng thái PENDING (chống bấm đúp / đã duyệt trên Web trước đó)
      if (task.assignmentRequestStatus !== 'PENDING' || !task.assignmentRequestedBy) {
        await answerCallback(callbackId, 'ℹ️ Yêu cầu này đã được xử lý trước đó rồi.', true);

        // Gỡ nút khỏi tin nhắn để tránh người khác bấm tiếp
        if (message?.chat?.id && message?.message_id) {
          const alreadyApproved = task.assignmentRequestStatus === 'APPROVED' || Boolean(task.assigneeAccount);
          const reqAcc = task.assigneeAccount || task.assignmentRequestedBy || '';
          const reqUser = usersList.find((u) => u.account?.toLowerCase() === reqAcc.toLowerCase());
          const leaders = findLeadersForTaskRole(usersList, displayRole, reqAcc);

          const refreshedHtml = formatClaimMessageHtml({
            task,
            requesterName: reqUser?.name || reqAcc || 'Thành viên',
            requesterAccount: reqUser?.account || reqAcc || 'unknown',
            requesterTelegram: reqUser?.telegramAccount,
            leaders,
            milestoneTitle,
            resolution: {
              status: alreadyApproved ? 'APPROVED' : 'REJECTED',
              actorName: 'Hệ thống',
              actorAccount: 'system',
              via: 'Web',
              atTime: formatVnTimeShort(),
            },
          });

          await callTelegramApi('editMessageText', {
            chat_id: message.chat.id,
            message_id: message.message_id,
            text: refreshedHtml,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: buildClaimInlineKeyboard(task, siteBaseUrl, false),
          });
        }
        return NextResponse.json({ ok: true });
      }

      const requesterAccount = task.assignmentRequestedBy;
      const requesterUser = usersList.find(
        (u) => u.account && u.account.toLowerCase() === requesterAccount.toLowerCase()
      );
      const nowIso = new Date().toISOString();

      if (action === 'APPROVED') {
        const targetWeek = task.requestedWeekNumber || task.weekNumber;
        await patchRtdbNode(
          `tasks/${encodeURIComponent(taskRec.key)}`,
          {
            assigneeAccount: requesterAccount,
            assignmentRequestStatus: 'APPROVED',
            ...(targetWeek ? { weekNumber: targetWeek } : {}),
            requestedWeekNumber: null,
            updatedAt: nowIso,
          },
          dbRootNode
        );

        await pushInAppNotification(
          requesterAccount,
          '✅ Yêu cầu nhận task đã được duyệt!',
          `${actorUser.name} đã duyệt cho bạn nhận task: ${task.title} (qua Telegram)`,
          task.id,
          actorUser.account,
          actorUser.name,
          'TASK_APPROVED',
          dbRootNode
        );
      } else {
        await patchRtdbNode(
          `tasks/${encodeURIComponent(taskRec.key)}`,
          {
            assignmentRequestStatus: 'REJECTED',
            assignmentRequestedBy: null,
            requestedWeekNumber: null,
            updatedAt: nowIso,
          },
          dbRootNode
        );

        await pushInAppNotification(
          requesterAccount,
          '❌ Yêu cầu nhận task chưa được duyệt',
          `${actorUser.name} đã từ chối yêu cầu nhận task: ${task.title}`,
          task.id,
          actorUser.account,
          actorUser.name,
          'TASK_ASSIGNED',
          dbRootNode
        );
      }

      // Cập nhật lại tin nhắn Telegram: gỡ 2 nút duyệt & ghi nhận người xử lý
      if (message?.chat?.id && message?.message_id) {
        const leaders = findLeadersForTaskRole(usersList, displayRole, requesterAccount);
        const updatedHtml = formatClaimMessageHtml({
          task,
          requesterName: requesterUser?.name || requesterAccount,
          requesterAccount: requesterUser?.account || requesterAccount,
          requesterTelegram: requesterUser?.telegramAccount,
          leaders,
          milestoneTitle,
          resolution: {
            status: action,
            actorName: actorUser.name,
            actorAccount: actorUser.account,
            actorTelegram: actorUser.telegramAccount || fromUsername,
            via: 'Telegram',
            atTime: formatVnTimeShort(),
          },
        });

        await callTelegramApi('editMessageText', {
          chat_id: message.chat.id,
          message_id: message.message_id,
          text: updatedHtml,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: buildClaimInlineKeyboard(task, siteBaseUrl, false),
        });
      }

      await answerCallback(
        callbackId,
        action === 'APPROVED'
          ? `✅ Đã duyệt giao task cho ${requesterUser?.name || requesterAccount}!`
          : `❌ Đã từ chối yêu cầu nhận task.`,
        false
      );

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram webhook] error:', err);
    return NextResponse.json({ ok: true }); // Luôn trả 200 cho Telegram để tránh retry storm
  }
}
