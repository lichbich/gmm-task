// Application Version & Build Identification
// Incremented during updates to signal client-side refresh triggers

export const APP_VERSION = '2.5.1';
export const APP_RELEASE_NOTE = 'Cập nhật hệ thống Effort cá nhân & Tự động làm mới phiên bản';

// Build timestamp generated at module evaluation / deployment
export const BUILD_TIMESTAMP = 1791176000000;
export const BUILD_ID = `gmm-${APP_VERSION}-${BUILD_TIMESTAMP}`;

export interface SystemVersionInfo {
  version: string;
  buildId: string;
  buildTimestamp: number;
  serverTime: number;
  releaseNote?: string;
}
