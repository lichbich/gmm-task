/**
 * Shared route metadata helpers safe for both Next.js Server Components (`generateMetadata`)
 * and Client Components. Do NOT add `'use client'` or React hooks to this file.
 */

export const PAGE_TITLES: Record<string, string> = {
  '/login': 'Đăng Nhập — Saho Task',
  '/work-schedules': 'Work Schedules — Saho Task',
  '/milestones': 'Milestones & Break Tasks — Saho Task',
  '/milestones/adhoc': 'Task Tự Do (Adhoc) — Saho Task',
  '/milestones/create': 'Tạo Milestone Mới — Saho Task',
  '/requests': 'Request — Saho Task',
  '/requests/create': 'Tạo Request Mới — Saho Task',
  '/kanban': 'Bảng Kanban — Saho Task',
  '/awards': 'Thưởng & Cảnh Báo — Saho Task',
  '/awards/ai-summary': 'Báo Cáo AI Tuần — Saho Task',
  '/history': 'Lịch Sử Công Việc — Saho Task',
  '/next-week': 'Lập Kế Hoạch Tuần Tới — Saho Task',
  '/resources': 'Quản Lý Resource — Saho Task',
  '/resources/create': 'Tạo Resource Mới — Saho Task',
  '/users': 'Danh Sách Thành Viên — Saho Task',
  '/users/roles': 'Danh Mục Role & Chuyên Môn — Saho Task',
  '/users/permissions': 'Phân Quyền Hệ Thống — Saho Task',
  '/users/create': 'Tạo Tài Khoản Mới — Saho Task',
  '/task/create': 'Tạo Task Mới — Saho Task',
  '/profile': 'Hồ Sơ Cá Nhân — Saho Task',
  '/time-simulator': 'Giả Lập Thời Gian System — Saho Task',
};

export function getPageTitleForPath(path: string): string {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/work-schedules';
  return PAGE_TITLES[clean] || 'Saho Task System';
}
