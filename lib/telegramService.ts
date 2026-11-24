import crypto from 'crypto';
import { DB_ROOT_NODE, FIREBASE_DATABASE_URL } from './firebase';
import {
  getUserRoleInSpec,
  normalizeRoleToken,
  type Milestone,
  type Task,
  type TelegramConfig,
  type User,
} from '@/types/task';
import { getTaskPublicIdentifier } from './taskLinkHelper';

export const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Chuẩn hóa username Telegram: bỏ khoảng trắng, bỏ dấu @ đầu, giữ nguyên ký tự hợp lệ.
 */
export function normalizeTelegramAccount(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .trim()
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
    .replace(/^@+/, '')
    .replace(/\s+/g, '');
}

export function formatTelegramTag(raw?: string | null): string {
  const clean = normalizeTelegramAccount(raw);
  return clean ? `@${clean}` : '';
}

export function getTelegramBotToken(): string {
  return (process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

/**
 * Secret token dùng cho header `X-Telegram-Bot-Api-Secret-Token` của Telegram Webhook.
 * Nếu chưa cấu hình TELEGRAM_WEBHOOK_SECRET, tự sinh hash ổn định từ TELEGRAM_BOT_TOKEN.
 */
export function getTelegramWebhookSecret(): string {
  const explicit = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (explicit) return explicit;
  const token = getTelegramBotToken();
  if (!token) return '';
  return crypto.createHash('sha256').update(`saho-tg-webhook:${token}`).digest('hex').slice(0, 40);
}

export function getSiteBaseUrl(reqOrigin?: string): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  if (configured && !configured.includes('localhost')) {
    return configured;
  }
  if (reqOrigin && reqOrigin.startsWith('http')) {
    return reqOrigin.replace(/\/+$/, '');
  }
  return configured || 'https://gmm-task.vercel.app';
}

export function escapeTelegramHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Chuyển mô tả (có thể chứa markdown đơn giản hoặc HTML từ editor) về text thuần sạch để hiển thị trên Telegram.
 */
function cleanDescriptionForTelegram(raw?: string, maxLen = 520): string {
  if (!raw) return '';
  const stripped = String(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!stripped) return '';
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen).trimEnd() + '…';
}

function getPriorityLabelVi(priority?: string): string {
  switch (priority) {
    case 'urgent':
      return '🔴 Khẩn cấp';
    case 'high':
      return '🟠 Cao';
    case 'medium':
      return '🟡 Trung bình';
    case 'low':
      return '🟢 Thấp';
    default:
      return '⚪ Bình thường';
  }
}

export function formatVnTimeShort(date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

// =========================================================================
// FIREBASE RTDB REST HELPERS (Tự động dùng DB_ROOT_NODE: gmm-task-test ở local, gmm-task ở production)
// =========================================================================

export async function readRtdbNode<T = any>(relativePath: string, dbRootNode = DB_ROOT_NODE): Promise<T | null> {
  const cleanPath = relativePath.replace(/^\/+/, '');
  const url = `${FIREBASE_DATABASE_URL}/${dbRootNode}/${cleanPath}.json`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as T | null;
}

export async function writeRtdbNode(relativePath: string, data: unknown, dbRootNode = DB_ROOT_NODE): Promise<boolean> {
  const cleanPath = relativePath.replace(/^\/+/, '');
  const url = `${FIREBASE_DATABASE_URL}/${dbRootNode}/${cleanPath}.json`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export async function patchRtdbNode(relativePath: string, data: Record<string, unknown>, dbRootNode = DB_ROOT_NODE): Promise<boolean> {
  const cleanPath = relativePath.replace(/^\/+/, '');
  const url = `${FIREBASE_DATABASE_URL}/${dbRootNode}/${cleanPath}.json`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export async function getTelegramConfig(dbRootNode = DB_ROOT_NODE): Promise<TelegramConfig> {
  const stored = await readRtdbNode<Partial<TelegramConfig>>('telegramConfig', dbRootNode);
  const envChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  return {
    enabled: stored?.enabled ?? true,
    chatId: String(stored?.chatId || envChatId || '').trim(),
    defaultThreadId:
      stored?.defaultThreadId !== undefined && stored?.defaultThreadId !== null && String(stored.defaultThreadId) !== ''
        ? Number(stored.defaultThreadId)
        : undefined,
    roleTopicMap: stored?.roleTopicMap && typeof stored.roleTopicMap === 'object' ? stored.roleTopicMap : {},
    updatedAt: stored?.updatedAt,
    updatedBy: stored?.updatedBy,
  };
}

export async function saveTelegramConfig(config: TelegramConfig, dbRootNode = DB_ROOT_NODE): Promise<boolean> {
  const cleanMap: Record<string, number> = {};
  Object.entries(config.roleTopicMap || {}).forEach(([k, v]) => {
    const normKey = normalizeRoleToken(k) || k.trim().toLowerCase();
    const numVal = Number(v);
    if (normKey && Number.isFinite(numVal) && numVal > 0) {
      cleanMap[normKey] = numVal;
    }
  });

  const payload: TelegramConfig = {
    enabled: Boolean(config.enabled),
    chatId: String(config.chatId || '').trim(),
    ...(config.defaultThreadId && Number.isFinite(Number(config.defaultThreadId))
      ? { defaultThreadId: Number(config.defaultThreadId) }
      : {}),
    roleTopicMap: cleanMap,
    updatedAt: new Date().toISOString(),
    ...(config.updatedBy ? { updatedBy: config.updatedBy } : {}),
  };

  return writeRtdbNode('telegramConfig', payload, dbRootNode);
}

/**
 * Xác định Topic (`message_thread_id`) tương ứng với Role của task.
 */
export function resolveTopicThreadId(config: TelegramConfig, taskRole?: string): number | undefined {
  const map = config.roleTopicMap || {};
  const normRole = normalizeRoleToken(taskRole);
  if (normRole) {
    // 1. Exact canonical match (vd: 'design', 'fe', 'be', 'ba', 'sa', 'qc', 'devops')
    if (map[normRole] !== undefined && Number(map[normRole]) > 0) {
      return Number(map[normRole]);
    }
    // 2. Normalize every stored key in case Admin saved raw codes like 'DES', 'Designer', 'OPS'
    for (const [k, v] of Object.entries(map)) {
      if (normalizeRoleToken(k) === normRole && Number(v) > 0) {
        return Number(v);
      }
    }
  }
  return config.defaultThreadId && config.defaultThreadId > 0 ? Number(config.defaultThreadId) : undefined;
}

/**
 * Suy ra Role chuẩn của task (từ task.role hoặc fallback theo tiền tố tiêu đề).
 */
export function resolveTaskCanonicalRole(task: Task): { displayRole: string; canonicalRole: string } {
  let rawRole = (task.role || '').trim();
  let canonical = normalizeRoleToken(rawRole);
  if (!canonical && task.title) {
    const m = task.title.trim().match(/^(FE|BE|BA|DES|Design|Designer|DevOps|OPS|AI|PO|PM|QA|QC|SA)\b/i);
    if (m) {
      rawRole = m[1];
      canonical = normalizeRoleToken(m[1]);
    }
  }
  return {
    displayRole: rawRole || canonical.toUpperCase() || 'Khác',
    canonicalRole: canonical,
  };
}

/**
 * Tìm danh sách Leader/Advisor của đúng Role để CC tag trên Telegram.
 */
export function findLeadersForTaskRole(users: User[], taskRole: string, excludeAccount?: string): User[] {
  const canonicalRole = normalizeRoleToken(taskRole);
  if (!canonicalRole) return [];

  const excludeLower = (excludeAccount || '').trim().toLowerCase();
  return users.filter((u) => {
    if (!u || u.disabled || u.status === 'disabled') return false;
    if (excludeLower && u.account.toLowerCase() === excludeLower) return false;
    if (u.role === 'Admin') return false; // Tránh spam Admin trong dòng CC trừ khi họ là Leader của team đó
    const roleInSpec = getUserRoleInSpec(u, taskRole);
    return roleInSpec === 'Leader' || roleInSpec === 'Advisor';
  });
}

/**
 * Kiểm tra xem 1 User có quyền duyệt / từ chối yêu cầu nhận task của role đó không.
 * Quy tắc: Admin luôn có quyền; Leader/Advisor chỉ duyệt được task thuộc đúng Role mình quản lý.
 */
export function canUserApproveTaskRole(user: User | null | undefined, taskRole: string): boolean {
  if (!user || user.disabled || user.status === 'disabled') return false;
  if (user.role === 'Admin') return true;
  if (!taskRole) return false;
  const roleInSpec = getUserRoleInSpec(user, taskRole);
  return roleInSpec === 'Leader' || roleInSpec === 'Advisor';
}

/**
 * Tra cứu User trong Firebase theo Telegram User ID (ưu tiên) hoặc Telegram @username.
 */
export async function findUserByTelegramIdentity(
  telegramUserId?: string | number,
  telegramUsername?: string,
  dbRootNode = DB_ROOT_NODE
): Promise<{ key: string; user: User; matchedBy: 'id' | 'username' } | null> {
  const usersObj = await readRtdbNode<Record<string, User>>('users', dbRootNode);
  if (!usersObj || typeof usersObj !== 'object') return null;

  const idStr = telegramUserId !== undefined && telegramUserId !== null ? String(telegramUserId).trim() : '';
  const cleanUsername = normalizeTelegramAccount(telegramUsername).toLowerCase();

  // 1. Ưu tiên khớp chính xác theo telegramUserId cố định
  if (idStr) {
    for (const [key, u] of Object.entries(usersObj)) {
      if (!u || u.disabled || u.status === 'disabled') continue;
      if (u.telegramUserId && String(u.telegramUserId).trim() === idStr) {
        return { key, user: u, matchedBy: 'id' };
      }
    }
  }

  // 2. Fallback khớp theo telegramAccount (@username)
  if (cleanUsername) {
    for (const [key, u] of Object.entries(usersObj)) {
      if (!u || u.disabled || u.status === 'disabled') continue;
      if (normalizeTelegramAccount(u.telegramAccount).toLowerCase() === cleanUsername) {
        return { key, user: u, matchedBy: 'username' };
      }
    }
  }

  return null;
}

/**
 * Tìm bản ghi task + Firebase key tương ứng trong /{dbRootNode}/tasks
 */
export async function findTaskRecordById(
  taskId: string,
  dbRootNode = DB_ROOT_NODE
): Promise<{ key: string; task: Task } | null> {
  if (!taskId) return null;

  // 1. Direct lookup
  const direct = await readRtdbNode<Task>(`tasks/${encodeURIComponent(taskId)}`, dbRootNode);
  if (direct && typeof direct === 'object' && direct.title) {
    return { key: taskId, task: { ...direct, id: direct.id || taskId } };
  }

  // 2. Fallback scan
  const allTasks = await readRtdbNode<Record<string, Task>>('tasks', dbRootNode);
  if (!allTasks || typeof allTasks !== 'object') return null;
  for (const [key, t] of Object.entries(allTasks)) {
    if (!t) continue;
    if (key === taskId || t.id === taskId) {
      return { key, task: { ...t, id: t.id || key } };
    }
  }
  return null;
}

// =========================================================================
// TELEGRAM API CLIENT & MESSAGE BUILDERS
// =========================================================================

export async function callTelegramApi<T = any>(
  method: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number }> {
  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, description: 'Thiếu biến môi trường TELEGRAM_BOT_TOKEN' };
  }

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { ok: false, description: err?.message || 'Lỗi kết nối Telegram API' };
  }
}

export interface ClaimMessageRenderInput {
  task: Task;
  requesterName: string;
  requesterAccount: string;
  requesterTelegram?: string;
  leaders: User[];
  milestoneTitle?: string;
  targetWeek?: number;
  resolution?: {
    status: 'APPROVED' | 'REJECTED';
    actorName: string;
    actorAccount: string;
    actorTelegram?: string;
    via: 'Telegram' | 'Web';
    atTime?: string;
  };
}

export function formatClaimMessageHtml(input: ClaimMessageRenderInput): string {
  const { task, requesterName, requesterAccount, requesterTelegram, leaders, milestoneTitle, targetWeek, resolution } =
    input;
  const { displayRole } = resolveTaskCanonicalRole(task);

  const headerLine =
    resolution?.status === 'APPROVED'
      ? '✅ <b>ĐÃ DUYỆT GIAO TASK</b>'
      : resolution?.status === 'REJECTED'
      ? '❌ <b>ĐÃ TỪ CHỐI YÊU CẦU NHẬN TASK</b>'
      : '✋ <b>YÊU CẦU NHẬN TASK MỚI</b>';

  const taskCode = task.code ? `<code>${escapeTelegramHtml(task.code)}</code> • ` : '';
  const requesterTele = formatTelegramTag(requesterTelegram);
  const requesterDisplay = requesterTele
    ? `${escapeTelegramHtml(requesterName)} (<code>${escapeTelegramHtml(requesterAccount)}</code> • ${escapeTelegramHtml(requesterTele)})`
    : `${escapeTelegramHtml(requesterName)} (<code>${escapeTelegramHtml(requesterAccount)}</code>)`;

  const effortNum = Number(task.estimatedEffort) || 0;
  const weekNum = targetWeek || task.requestedWeekNumber || task.weekNumber;

  const lines: string[] = [
    headerLine,
    '',
    `📌 ${taskCode}<b>${escapeTelegramHtml(task.title)}</b>`,
    '',
    `👤 <b>Người xin nhận:</b> ${requesterDisplay}`,
    `🏷 <b>Role:</b> <code>${escapeTelegramHtml(displayRole)}</code>  |  <b>Ưu tiên:</b> ${getPriorityLabelVi(task.priority)}`,
    `📅 <b>Tuần:</b> ${weekNum ? `Tuần ${escapeTelegramHtml(weekNum)}` : 'Chưa gán'}  |  <b>Effort dự kiến:</b> <code>${effortNum}h</code>`,
  ];

  if (milestoneTitle) {
    lines.push(`🎯 <b>Milestone:</b> ${escapeTelegramHtml(milestoneTitle)}`);
  }

  const cleanDesc = cleanDescriptionForTelegram(task.description, 520);
  if (cleanDesc) {
    lines.push(`📝 <b>Mô tả chi tiết:</b>`);
    lines.push(`<blockquote expandable>${escapeTelegramHtml(cleanDesc)}</blockquote>`);
  }

  if (leaders.length > 0) {
    const ccTags = leaders.map((l) => {
      const tag = formatTelegramTag(l.telegramAccount);
      return tag ? escapeTelegramHtml(tag) : `${escapeTelegramHtml(l.name)} (<code>${escapeTelegramHtml(l.account)}</code>)`;
    });
    lines.push(`📣 <b>CC Leader/Advisor:</b> ${ccTags.join('  ')}`);
  }

  if (resolution) {
    const actorTag = formatTelegramTag(resolution.actorTelegram);
    const actorDisplay = actorTag
      ? `${escapeTelegramHtml(resolution.actorName)} (${escapeTelegramHtml(actorTag)})`
      : `${escapeTelegramHtml(resolution.actorName)} (<code>${escapeTelegramHtml(resolution.actorAccount)}</code>)`;
    const timeStr = resolution.atTime || formatVnTimeShort();
    lines.push('');
    if (resolution.status === 'APPROVED') {
      lines.push(`🟢 <b>Kết quả:</b> Đã giao cho ${requesterDisplay}`);
      lines.push(`👮 <b>Người duyệt:</b> ${actorDisplay} • <i>${escapeTelegramHtml(timeStr)} (${resolution.via})</i>`);
    } else {
      lines.push(`🔴 <b>Kết quả:</b> Yêu cầu đã bị từ chối`);
      lines.push(`👮 <b>Người xử lý:</b> ${actorDisplay} • <i>${escapeTelegramHtml(timeStr)} (${resolution.via})</i>`);
    }
  } else {
    lines.push('');
    lines.push(`<i>⚡ Chỉ Leader / Advisor của team ${escapeTelegramHtml(displayRole)} hoặc Admin mới có quyền bấm Duyệt / Từ chối.</i>`);
  }

  return lines.join('\n');
}

export function buildClaimInlineKeyboard(
  task: Pick<Task, 'id' | 'code'>,
  siteBaseUrl: string,
  includeActionButtons: boolean
) {
  const identifier = getTaskPublicIdentifier(task);
  const taskUrl = `${siteBaseUrl.replace(/\/+$/, '')}/task/${encodeURIComponent(identifier)}`;
  const rows: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

  if (includeActionButtons) {
    // callback_data <= 64 bytes
    rows.push([
      { text: '✅ Duyệt giao task', callback_data: `tc:a:${task.id}` },
      { text: '❌ Từ chối', callback_data: `tc:r:${task.id}` },
    ]);
  }

  rows.push([{ text: '🔗 Xem chi tiết trên Saho Task', url: taskUrl }]);

  return { inline_keyboard: rows };
}

/**
 * Lấy tiêu đề Milestone nếu task thuộc một Milestone.
 */
export async function resolveMilestoneTitle(
  milestoneId?: string,
  dbRootNode = DB_ROOT_NODE
): Promise<string | undefined> {
  if (!milestoneId || milestoneId === 'adhoc' || milestoneId === 'general') return undefined;
  const direct = await readRtdbNode<Milestone>(`milestones/${encodeURIComponent(milestoneId)}`, dbRootNode);
  if (direct?.title) return direct.title;
  const all = await readRtdbNode<Record<string, Milestone>>('milestones', dbRootNode);
  if (!all || typeof all !== 'object') return undefined;
  const found = Object.values(all).find((m) => m && m.id === milestoneId);
  return found?.title;
}
