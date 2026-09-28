/**
 * Image Encryption & Decryption Helper for Catbox Storage (AES-256-GCM)
 *
 * Header Format:
 * [4 bytes MAGIC "ENC1"] + [12 bytes IV] + [1 byte MimeLen] + [MimeLen bytes MimeString] + [Ciphertext + AuthTag]
 */

const MAGIC_BYTES = new Uint8Array([0x45, 0x4E, 0x43, 0x31]); // 'ENC1'
const DEFAULT_SECRET_KEY =
  process.env.NEXT_PUBLIC_IMAGE_SECRET_KEY || 'SAHO_GMM_INTERNAL_SEC_KEY_2026_SECURE';

// In-memory cache for decrypted Blob URLs to prevent redundant network & crypto work
const decryptedCache = new Map<string, string>();
const pendingDecryptions = new Map<string, Promise<string>>();

function getCrypto(): Crypto {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not available in this environment');
}

/**
 * Derive an AES-GCM 256-bit CryptoKey from a secret passphrase
 */
async function getCryptoKey(passphrase: string = DEFAULT_SECRET_KEY): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const c = getCrypto();
  const keyMaterial = await c.subtle.digest('SHA-256', enc.encode(passphrase));
  return c.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt an image File into an encrypted Blob
 */
export async function encryptImageFile(
  file: File,
  secretKey: string = DEFAULT_SECRET_KEY
): Promise<{ encryptedBlob: Blob; encryptedFileName: string }> {
  const key = await getCryptoKey(secretKey);
  const fileBuffer = await file.arrayBuffer();
  const c = getCrypto();

  // Generate a random 12-byte IV for AES-GCM
  const iv = c.getRandomValues(new Uint8Array(12));

  // Encrypt image buffer
  const ciphertext = await c.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    fileBuffer
  );

  // Encode mime type (e.g. "image/png")
  const enc = new TextEncoder();
  const mimeBytes = enc.encode(file.type || 'image/png');
  const mimeLen = mimeBytes.length;

  // Build binary package: [4 bytes MAGIC] + [12 bytes IV] + [1 byte MimeLen] + [Mime bytes] + [Ciphertext]
  const totalLength = MAGIC_BYTES.length + iv.length + 1 + mimeLen + ciphertext.byteLength;
  const packageBuffer = new Uint8Array(totalLength);

  let offset = 0;
  packageBuffer.set(MAGIC_BYTES, offset);
  offset += MAGIC_BYTES.length;

  packageBuffer.set(iv, offset);
  offset += iv.length;

  packageBuffer[offset] = mimeLen;
  offset += 1;

  packageBuffer.set(mimeBytes, offset);
  offset += mimeLen;

  packageBuffer.set(new Uint8Array(ciphertext), offset);

  const encryptedBlob = new Blob([packageBuffer], { type: 'application/octet-stream' });
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const encryptedFileName = `${baseName}_${Date.now().toString(36)}.enc`;

  return {
    encryptedBlob,
    encryptedFileName,
  };
}

/**
 * Decrypt binary ArrayBuffer into an object URL
 */
export async function decryptImageBuffer(
  buffer: ArrayBuffer,
  secretKey: string = DEFAULT_SECRET_KEY
): Promise<{ blobUrl: string; mimeType: string } | null> {
  const data = new Uint8Array(buffer);

  // 1. Check Magic Bytes
  if (data.length < MAGIC_BYTES.length + 12 + 1) {
    return null; // Too short to be encrypted
  }

  for (let i = 0; i < MAGIC_BYTES.length; i++) {
    if (data[i] !== MAGIC_BYTES[i]) {
      return null; // Not an encrypted package
    }
  }

  try {
    let offset = MAGIC_BYTES.length;

    // 2. Extract IV (12 bytes)
    const iv = data.slice(offset, offset + 12);
    offset += 12;

    // 3. Extract Mime Type
    const mimeLen = data[offset];
    offset += 1;

    const dec = new TextDecoder();
    const mimeType = dec.decode(data.slice(offset, offset + mimeLen)) || 'image/png';
    offset += mimeLen;

    // 4. Extract Ciphertext
    const ciphertext = data.slice(offset);

    // 5. Decrypt using AES-GCM
    const key = await getCryptoKey(secretKey);
    const c = getCrypto();
    const decryptedBuffer = await c.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    );

    const blob = new Blob([decryptedBuffer], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    return { blobUrl, mimeType };
  } catch (err) {
    console.error('Failed to decrypt image:', err);
    return null;
  }
}

/**
 * Fetch and decrypt image URL with caching and proxy fallback
 */
export async function loadDecryptedImageUrl(
  url: string,
  secretKey: string = DEFAULT_SECRET_KEY
): Promise<string> {
  if (!url || typeof url !== 'string') return url;

  // If already a local blob URL or data URL, return as-is
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }

  // Check cache
  if (decryptedCache.has(url)) {
    return decryptedCache.get(url)!;
  }

  // Check if already in-flight to prevent duplicate requests
  if (pendingDecryptions.has(url)) {
    return pendingDecryptions.get(url)!;
  }

  const promise = (async () => {
    try {
      // Use internal proxy route to bypass browser CORS on external image hosts
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) {
        return url; // fallback to original
      }

      const buffer = await res.arrayBuffer();

      // Attempt decryption
      const decrypted = await decryptImageBuffer(buffer, secretKey);
      if (decrypted && decrypted.blobUrl) {
        decryptedCache.set(url, decrypted.blobUrl);
        return decrypted.blobUrl;
      }

      // If not encrypted (legacy unencrypted image), create standard Blob URL for caching
      const contentType = res.headers.get('content-type') || 'image/png';
      const plainBlob = new Blob([buffer], { type: contentType });
      const plainBlobUrl = URL.createObjectURL(plainBlob);
      decryptedCache.set(url, plainBlobUrl);
      return plainBlobUrl;
    } catch (err) {
      console.warn('Could not decrypt image, using fallback URL:', err);
      return url;
    } finally {
      pendingDecryptions.delete(url);
    }
  })();

  pendingDecryptions.set(url, promise);
  return promise;
}
