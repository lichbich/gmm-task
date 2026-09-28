import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Upload to primary Catbox host
 */
async function uploadToCatbox(file: Blob, fileName: string): Promise<string | null> {
  try {
    const catboxFormData = new FormData();
    catboxFormData.append('reqtype', 'fileupload');
    if (process.env.CATBOX_USERHASH) {
      catboxFormData.append('userhash', process.env.CATBOX_USERHASH);
    }
    catboxFormData.append('fileToUpload', file, fileName);

    const catboxResponse = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: catboxFormData,
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: '*/*',
      },
    });

    if (catboxResponse.ok) {
      const directUrl = (await catboxResponse.text()).trim();
      if (directUrl.startsWith('http://') || directUrl.startsWith('https://')) {
        return directUrl.replace(/^http:\/\//i, 'https://');
      }
    } else {
      const errText = await catboxResponse.text().catch(() => '');
      console.warn(`Catbox upload returned HTTP ${catboxResponse.status}: ${errText}`);
    }
  } catch (err) {
    console.warn('Catbox upload request error, attempting fallback:', err);
  }
  return null;
}

/**
 * Fallback uploader: tmpfiles.org
 */
async function uploadToTmpfiles(file: Blob, fileName: string): Promise<string | null> {
  try {
    const tmpFormData = new FormData();
    tmpFormData.append('file', file, fileName);

    const tmpResponse = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: tmpFormData,
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (tmpResponse.ok) {
      const data = await tmpResponse.json();
      if (data?.status === 'success' && data?.data?.url) {
        // Convert tmpfiles view URL (https://tmpfiles.org/123/file) to direct download (https://tmpfiles.org/dl/123/file)
        const directUrl = String(data.data.url).replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        return directUrl;
      }
    }
  } catch (err) {
    console.warn('Tmpfiles fallback upload error:', err);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy file ảnh hợp lệ để tải lên.' },
        { status: 400 }
      );
    }

    // Validate mime type (allow image/* or application/octet-stream for AES encrypted files)
    const mimeType = file.type || '';
    const isEncrypted =
      mimeType === 'application/octet-stream' ||
      ((file as any).name && (file as any).name.endsWith('.enc'));

    if (!mimeType.startsWith('image/') && !isEncrypted) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Định dạng file không được hỗ trợ. Vui lòng chọn file hình ảnh (PNG, JPG, JPEG, GIF, WebP).',
        },
        { status: 400 }
      );
    }

    // Size limit: 20MB
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 20MB).' },
        { status: 400 }
      );
    }

    const fileName = (file as any).name || 'image.png';

    // 1. Try Primary Host (Catbox)
    let uploadedUrl = await uploadToCatbox(file, fileName);

    // 2. If Primary Host fails, Try Fallback Host (tmpfiles.org)
    if (!uploadedUrl) {
      console.log('Using fallback image hosting provider for encrypted asset...');
      uploadedUrl = await uploadToTmpfiles(file, fileName);
    }

    if (!uploadedUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dịch vụ lưu trữ ảnh đang bận hoặc bị giới hạn mạng. Vui lòng thử lại sau giây lát.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      url: uploadedUrl,
      fileName,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (err: any) {
    console.error('Error in /api/upload-image route:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Đã xảy ra lỗi không xác định khi tải ảnh lên.' },
      { status: 500 }
    );
  }
}
