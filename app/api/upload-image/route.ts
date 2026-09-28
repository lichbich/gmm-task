import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    // Validate mime type (allow image/* or application/octet-stream for encrypted files)
    const mimeType = file.type || '';
    const isEncrypted = mimeType === 'application/octet-stream' || ((file as any).name && (file as any).name.endsWith('.enc'));
    if (!mimeType.startsWith('image/') && !isEncrypted) {
      return NextResponse.json(
        { success: false, error: 'Định dạng file không được hỗ trợ. Vui lòng chọn file hình ảnh (PNG, JPG, JPEG, GIF, WebP).' },
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

    // Prepare Catbox payload
    const catboxFormData = new FormData();
    catboxFormData.append('reqtype', 'fileupload');
    catboxFormData.append('fileToUpload', file, (file as any).name || 'image.png');

    const catboxResponse = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: catboxFormData,
      headers: {
        'User-Agent': 'SahoTaskSystem/1.0',
      },
    });

    if (!catboxResponse.ok) {
      const errText = await catboxResponse.text().catch(() => '');
      return NextResponse.json(
        { success: false, error: `Tải ảnh lên thất bại (Mã lỗi ${catboxResponse.status}): ${errText || 'Lỗi server'}` },
        { status: 502 }
      );
    }

    const directUrl = (await catboxResponse.text()).trim();

    if (!directUrl.startsWith('http://') && !directUrl.startsWith('https://')) {
      return NextResponse.json(
        { success: false, error: `Phản hồi xử lý ảnh không hợp lệ: ${directUrl}` },
        { status: 502 }
      );
    }

    // Ensure HTTPS
    const secureUrl = directUrl.replace(/^http:\/\//i, 'https://');

    return NextResponse.json({
      success: true,
      url: secureUrl,
      fileName: (file as any).name || 'image.png',
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (err: any) {
    console.error('Error uploading image to Catbox:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Đã xảy ra lỗi không xác định khi tải ảnh lên.' },
      { status: 500 }
    );
  }
}
