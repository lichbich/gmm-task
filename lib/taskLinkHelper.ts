import { Task } from '../types/task';

/**
 * Lấy mã định danh công khai của task (ưu tiên task.code, fallback về task.id)
 */
export function getTaskPublicIdentifier(
  taskOrId: string | (Partial<Task> & { id: string; code?: string })
): string {
  if (typeof taskOrId === 'string') {
    return taskOrId.trim().replace(/^tsk-/, '');
  }
  const code = taskOrId.code?.trim();
  if (code) return code;
  return String(taskOrId.id || '').trim().replace(/^tsk-/, '');
}

/**
 * Lấy URL đầy đủ để trỏ trực tiếp tới task trong hệ thống
 */
export function getTaskShareUrl(
  taskOrId: string | (Partial<Task> & { id: string; code?: string })
): string {
  if (typeof window === 'undefined') return '';
  const identifier = getTaskPublicIdentifier(taskOrId);
  const origin = window.location.origin;
  return `${origin}/task/${encodeURIComponent(identifier)}`;
}

/**
 * Tạo cú pháp chuẩn định dạng Merge Request theo quy chuẩn:
 * Refs: #[Mã Task] - [Tên Task](URL Task)
 */
export function getTaskMRTemplateText(
  task: Partial<Task> & { id: string; title: string; code?: string }
): string {
  const identifier = getTaskPublicIdentifier(task);
  const url = getTaskShareUrl(task);
  const title = (task.title || '').trim();
  return `Refs: #${identifier} - [${title}](${url})`;
}

/**
 * Sao chép nội dung text vào Clipboard với cơ chế fallback tương thích mọi trình duyệt
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Thử dùng Clipboard API hiện đại
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Navigator clipboard API failed, falling back to textarea execCommand', err);
    }
  }

  // 2. Fallback dùng textarea execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy text using fallback:', err);
    return false;
  }
}
