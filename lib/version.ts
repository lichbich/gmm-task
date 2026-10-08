// Application Version & Build Identification

export const APP_VERSION = '2.9.3';
export const APP_RELEASE_NOTE =
  'update code block';

export const BUILD_ID = `saho-v${APP_VERSION}`;

export interface SystemVersionInfo {
  version: string;
  buildId: string;
  serverTime: number;
  releaseNote?: string;
}

/**
 * Compare two semver strings (e.g., '2.8.4' vs '2.8.3').
 * Returns true if remoteVersion is strictly newer than currentVersion.
 */
export function isNewerVersion(remoteVersion?: string | null, currentVersion: string = APP_VERSION): boolean {
  if (!remoteVersion) return false;
  const cleanRemote = remoteVersion.trim().replace(/^v/i, '');
  const cleanCurrent = currentVersion.trim().replace(/^v/i, '');
  if (cleanRemote === cleanCurrent) return false;

  const remoteParts = cleanRemote.split('.').map((p) => parseInt(p, 10) || 0);
  const currentParts = cleanCurrent.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(remoteParts.length, currentParts.length);
  for (let i = 0; i < maxLen; i++) {
    const r = remoteParts[i] || 0;
    const c = currentParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}
