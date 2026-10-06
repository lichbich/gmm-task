// Application Version & Build Identification
// Incremented during updates to signal client-side refresh triggers

export const APP_VERSION = '2.5.2';
export const APP_RELEASE_NOTE = 'Cập nhật nghiệp vụ Effort: In Progress yêu cầu nhập giờ thực tế, chỉ auto-fill Est khi Done 100%';

// Build timestamp generated at module evaluation / deployment
export const BUILD_TIMESTAMP = 1791249000000;
export const BUILD_ID = `gmm-${APP_VERSION}-${BUILD_TIMESTAMP}`;

export interface SystemVersionInfo {
  version: string;
  buildId: string;
  buildTimestamp: number;
  serverTime: number;
  releaseNote?: string;
}
