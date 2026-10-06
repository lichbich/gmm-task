import { NextResponse } from 'next/server';
import { APP_VERSION, BUILD_ID, APP_RELEASE_NOTE, SystemVersionInfo } from '../../../lib/version';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const versionData: SystemVersionInfo = {
    version: APP_VERSION,
    buildId: BUILD_ID,
    serverTime: Date.now(),
    releaseNote: APP_RELEASE_NOTE,
  };

  return NextResponse.json(versionData, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    },
  });
}
