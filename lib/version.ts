// Application Version & Build Identification
// Incremented during updates to signal client-side refresh triggers

export const APP_VERSION = '2.5.3';
export const APP_RELEASE_NOTE = 'Tối ưu Dirty Check khi kéo tiến độ về 0% để đóng modal mượt mà không cảnh báo sai';

// Build timestamp generated at module evaluation / deployment
export const BUILD_TIMESTAMP = 1791250000000;
export const BUILD_ID = `gmm-${APP_VERSION}-${BUILD_TIMESTAMP}`;

export interface SystemVersionInfo {
  version: string;
  buildId: string;
  buildTimestamp: number;
  serverTime: number;
  releaseNote?: string;
}
