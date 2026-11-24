import { encryptImageFile } from './imageCryptoHelper';

async function compressImageIfNeeded(file: File): Promise<File> {
  // If not image or is gif / svg or already small (<= 200KB), keep original
  if (
    !file.type.startsWith('image/') ||
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml' ||
    file.size <= 200 * 1024
  ) {
    return file;
  }

  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const maxDim = 1920;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(file);
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.webp', {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(newFile);
          } else {
            resolve(file);
          }
        },
        'image/webp',
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

const VERCEL_BLOB_URL_EXTRACT_REGEX =
  /https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/saho-uploads\/[^\s\)"'<>]+/gi;

export function isVercelBlobUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/saho-uploads\//i.test(url.trim());
}

/**
 * Trích xuất toàn bộ URL ảnh lưu trên Vercel Blob từ nội dung text / markdown
 */
export function extractBlobUrlsFromText(text?: string | null): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(VERCEL_BLOB_URL_EXTRACT_REGEX);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

/**
 * Xóa file ảnh trên Vercel Blob Storage khi người dùng xóa ảnh/task/ticket/avatar trên web.
 * Chạy ngầm an toàn (không chặn UI nếu mất mạng).
 */
export async function deleteUploadedImages(urls: string | string[]): Promise<void> {
  const list = Array.isArray(urls) ? urls : [urls];
  const blobUrls = Array.from(new Set(list.filter((u) => isVercelBlobUrl(u))));
  if (blobUrls.length === 0) return;

  try {
    await fetch('/api/delete-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: blobUrls }),
      keepalive: true,
    });
  } catch (err) {
    console.warn('[deleteUploadedImages] skip:', err);
  }
}

/**
 * Encrypt and upload an image file through our internal Next.js API route
 */
export async function uploadImageToCatbox(file: File): Promise<{ url: string; fileName: string }> {
  // 1. Optimize oversized images before upload to stay within payload limits
  const processedFile = await compressImageIfNeeded(file);

  // 2. Encrypt image buffer with internal Secret Key (AES-256-GCM)
  const { encryptedBlob, encryptedFileName } = await encryptImageFile(processedFile);

  // 3. Send encrypted binary blob to server upload proxy
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
