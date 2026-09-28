import { encryptImageFile } from './imageCryptoHelper';

/**
 * Encrypt and upload an image file through our internal Next.js API route
 */
export async function uploadImageToCatbox(file: File): Promise<{ url: string; fileName: string }> {
  // 1. Encrypt image buffer with internal Secret Key (AES-256-GCM)
  const { encryptedBlob, encryptedFileName } = await encryptImageFile(file);

  // 2. Send encrypted binary blob to server upload proxy
  const formData = new FormData();
  formData.append('file', encryptedBlob, encryptedFileName);

  const res = await fetch('/api/upload-image', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Xử lý tải ảnh thất bại. Vui lòng thử lại.');
  }

  return {
    url: data.url,
    fileName: data.fileName || file.name,
  };
}

/**
 * Format image as markdown link (clean ![Ảnh](url))
 */
export function formatImageMarkdown(url: string, alt: string = 'Ảnh'): string {
  return `![${alt}](${url})`;
}

/**
 * Insert image markdown into text with proper newlines
 */
export function insertImageToText(currentText: string, imageUrl: string, altText: string = 'Ảnh'): string {
  const text = currentText || '';
  const prefix = text.length > 0 && !text.endsWith('\n') ? '\n\n' : '';
  const md = formatImageMarkdown(imageUrl, altText);
  return `${text}${prefix}${md}\n`;
}

/**
 * Handle uploading an image with clean state handling
 */
export async function uploadAndInsertImage(
  file: File,
  setText: React.Dispatch<React.SetStateAction<string>>,
  setUploading?: (status: boolean) => void
): Promise<string | null> {
  if (setUploading) setUploading(true);

  try {
    const { url } = await uploadImageToCatbox(file);
    setText((prev) => insertImageToText(prev, url, 'Ảnh'));
    return url;
  } catch (err: any) {
    throw err;
  } finally {
    if (setUploading) setUploading(false);
  }
}

/**
 * Extract image files from clipboard paste event
 */
export function getImageFilesFromClipboard(event: React.ClipboardEvent): File[] {
  const items = event.clipboardData?.items;
  if (!items) return [];

  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        files.push(file);
      }
    }
  }
  return files;
}

/**
 * Extract image files from drag & drop event
 */
export function getImageFilesFromDrop(event: React.DragEvent): File[] {
  const files = event.dataTransfer?.files;
  if (!files) return [];

  const result: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type.startsWith('image/')) {
      result.push(file);
    }
  }
  return result;
}
