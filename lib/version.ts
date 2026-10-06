// Application Version & Build Identification
// Incremented during updates to signal client-side refresh triggers

export const APP_VERSION = '2.8.3';
export const APP_RELEASE_NOTE = '- Update tính năng phân quyền dành cho Admin\n - Thêm AI hỗ trợ quản lý báo cáo trong hệ thống dành cho Admin, PM\n - Sửa lỗi hệ thống\n - Cải thiện hiệu năng\n - Add prefix';

// Build timestamp generated at module evaluation / deployment
export const BUILD_TIMESTAMP = Date.now();
export const BUILD_ID = `gmm-${APP_VERSION}-${BUILD_TIMESTAMP}`;

export interface SystemVersionInfo {
  version: string;
  buildId: string;
  buildTimestamp: number;
  serverTime: number;
  releaseNote?: string;
}
