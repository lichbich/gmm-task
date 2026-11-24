import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERCEL_BLOB_HOST_REGEX = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i;

function isAllowedVercelBlobUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      VERCEL_BLOB_HOST_REGEX.test(parsed.hostname) &&
      parsed.pathname.includes('/saho-uploads/')
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();
    if (!token) {
      return NextResponse.json({ success: true, deletedCount: 0, skipped: true });
    }

    const body = await req.json().catch(() => ({}));
    const rawList: string[] = [];
    if (typeof body?.url === 'string' && body.url.trim()) {
      rawList.push(body.url.trim());
    }
    if (Array.isArray(body?.urls)) {
      for (const u of body.urls) {
        if (typeof u === 'string' && u.trim()) {
          rawList.push(u.trim());
        }
      }
    }

    const validUrls = Array.from(new Set(rawList)).filter(isAllowedVercelBlobUrl);
    if (validUrls.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    // Deleting blobs on Vercel Blob is 100% free (does not count toward operation limits)
    await del(validUrls, { token });

    return NextResponse.json({
      success: true,
      deletedCount: validUrls.length,
    });
  } catch (err: any) {
    console.warn('[delete-image] Failed to delete Vercel Blob:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Không thể xóa ảnh trên Blob Storage.' },
      { status: 500 }
    );
  }
}
