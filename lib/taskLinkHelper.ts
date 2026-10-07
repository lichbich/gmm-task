import { Task } from '../types/task';

/**
 * Lấy URL đầy đủ để trỏ trực tiếp tới task trong hệ thống
 */
export function getTaskShareUrl(taskId: string): string {
  if (typeof window === 'undefined') return '';
  const cleanId = taskId.replace(/^tsk-/, '');
  const origin = window.location.origin;
  return `${origin}/?taskId=${encodeURIComponent(cleanId)}`;
}

/**
 * Tạo cú pháp chuẩn định dạng Merge Request theo quy chuẩn:
 * Refs: #[Mã Task] - [Tên Task](URL Task)
 */
export function getTaskMRTemplateText(task: Partial<Task> & { id: string; title: string }): string {
  const cleanId = task.id.replace(/^tsk-/, '');
  const url = getTaskShareUrl(task.id);
  const title = (task.title || '').trim();
  return `Refs: #${cleanId} - [${title}](${url})`;
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
