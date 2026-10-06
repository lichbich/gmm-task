import { UserRole, User } from '../types/task';

export interface SystemFeatureDefinition {
  id: string;
  key: string;
  category: 'ai' | 'tasks' | 'tickets' | 'admin';
  categoryName: string;
  name: string;
  description: string;
  badge?: string;
  defaultRoles: UserRole[];
  defaultAccounts?: string[];
}

export const SYSTEM_FEATURE_CATEGORIES = [
  { key: 'ai', name: '🤖 Trí Tuệ Nhân Tạo (AI Intelligence)', color: 'purple' },
  { key: 'tasks', name: '📋 Quản Lý Task & Tiến Độ', color: 'blue' },
  { key: 'tickets', name: '🎫 Yêu Cầu Phối Hợp (Tickets)', color: 'amber' },
  { key: 'admin', name: '⚙️ Quản Trị Hệ Thống (Admin)', color: 'rose' },
] as const;

export const SYSTEM_FEATURES: SystemFeatureDefinition[] = [
  // 1. AI Features
  {
    id: 'feat-ai-assistant',
    key: 'ai_assistant',
    category: 'ai',
    categoryName: 'Trí Tuệ Nhân Tạo (AI Features)',
    name: 'AI Trợ Lý Dự Án',
    description: 'Sử dụng chatbot AI thông minh để hỏi đáp dữ liệu, tra cứu tiến độ, phân tích rủi ro & giải đáp quy trình.',
    defaultRoles: ['Admin'],
    defaultAccounts: ['admin', 'LichDT', 'QuynhNV', 'NhiHT'],
  },
  {
    id: 'feat-ai-weekly-report',
    key: 'ai_weekly_report',
    category: 'ai',
    categoryName: 'Trí Tuệ Nhân Tạo (AI Features)',
    name: 'AI Báo Cáo Tuần',
    description: 'Tự động tạo báo cáo tổng hợp tiến độ tuần, phân tích điểm nghẽn, hiệu suất và đề xuất hành động bằng AI.',
    defaultRoles: ['Admin'],
    defaultAccounts: ['admin', 'LichDT', 'QuynhNV', 'NhiHT'],
  },

  // 2. Task Management
  {
    id: 'feat-task-create',
    key: 'task_create',
    category: 'tasks',
    categoryName: 'Quản Lý Task & Tiến Độ',
    name: 'Tạo Task Mới',
    description: 'Thêm mới các đầu việc vào Milestone của các nhóm chuyên môn.',
    defaultRoles: ['Admin', 'Leader', 'Advisor', 'Member'],
  },
  {
    id: 'feat-task-edit-all',
    key: 'task_edit_all',
    category: 'tasks',
    categoryName: 'Quản Lý Task & Tiến Độ',
    name: 'Chỉnh Sửa Mọi Task',
    description: 'Chỉnh sửa nội dung, role, hạn chót và người thực hiện của tất cả task trong hệ thống.',
    defaultRoles: ['Admin', 'Leader'],
  },
  {
    id: 'feat-task-delete',
    key: 'task_delete',
    category: 'tasks',
    categoryName: 'Quản Lý Task & Tiến Độ',
    name: 'Xóa Task',
    description: 'Xóa bỏ các đầu việc khỏi hệ thống quản lý.',
    defaultRoles: ['Admin', 'Leader'],
  },
  {
    id: 'feat-task-report-effort',
    key: 'task_report_effort',
    category: 'tasks',
    categoryName: 'Quản Lý Task & Tiến Độ',
    name: 'Báo Cáo Giờ Làm & Tiến Độ',
    description: 'Cập nhật giờ làm thực tế (Effort), phần trăm hoàn thành (%) và gửi ghi chú trao đổi.',
    defaultRoles: ['Admin', 'Leader', 'Advisor', 'Member'],
  },
  {
    id: 'feat-task-assign',
    key: 'task_assign',
    category: 'tasks',
    categoryName: 'Quản Lý Task & Tiến Độ',
    name: 'Phân Bổ & Giao Việc',
    description: 'Chỉ định nhân sự thực hiện (Assignee) và nhân sự phối hợp hỗ trợ (Supporters).',
    defaultRoles: ['Admin', 'Leader'],
  },
  {
    id: 'feat-milestone-manage',
    key: 'milestone_manage',
    category: 'tasks',
    categoryName: 'Quản Lý Task & Tiến Độ',
    name: 'Quản Lý Milestone',
    description: 'Tạo mới, sắp xếp thứ tự, đổi tên hoặc xóa các mốc giai đoạn (Milestone).',
    defaultRoles: ['Admin', 'Leader'],
  },
  {
    id: 'feat-week-rollover',
    key: 'week_rollover',
    category: 'tasks',
    categoryName: 'Quản Lý Task & Tiến Độ',
    name: 'Chốt Tuần & Rollback',
    description: 'Thực hiện chốt tuần, luân chuyển task tồn đọng sang tuần mới và hoàn tác chốt tuần.',
    defaultRoles: ['Admin', 'Leader'],
  },

  // 3. Tickets
  {
    id: 'feat-ticket-create',
    key: 'ticket_create',
    category: 'tickets',
    categoryName: 'Yêu Cầu Phối Hợp (Tickets)',
    name: 'Tạo Ticket Yêu Cầu',
    description: 'Gửi ticket yêu cầu hỗ trợ hoặc phối hợp nghiệp vụ sang bộ phận khác.',
    defaultRoles: ['Admin', 'Leader', 'Advisor', 'Member'],
  },
  {
    id: 'feat-ticket-assign',
    key: 'ticket_assign',
    category: 'tickets',
    categoryName: 'Yêu Cầu Phối Hợp (Tickets)',
    name: 'Phân Phối Ticket',
    description: 'Gán người xử lý cho các ticket được gửi tới bộ phận của mình.',
    defaultRoles: ['Admin', 'Leader'],
  },
  {
    id: 'feat-ticket-close-resolve',
    key: 'ticket_close_resolve',
    category: 'tickets',
    categoryName: 'Yêu Cầu Phối Hợp (Tickets)',
    name: 'Nghiệm Thu & Đóng Ticket',
    description: 'Xác nhận xử lý hoàn tất hoặc hủy/đóng các ticket yêu cầu.',
    defaultRoles: ['Admin', 'Leader'],
  },

  // 4. System Administration
  {
    id: 'feat-user-manage',
    key: 'user_manage',
    category: 'admin',
    categoryName: 'Quản Trị Hệ Thống',
    name: 'Quản Lý Tài Khoản Thành Viên',
    description: 'Thêm, sửa, xóa, khóa tài khoản nhân sự và cấp lại mật khẩu đăng nhập.',
    defaultRoles: ['Admin'],
  },
  {
    id: 'feat-role-manage',
    key: 'role_manage',
    category: 'admin',
    categoryName: 'Quản Trị Hệ Thống',
    name: 'Quản Lý Danh Mục Role & Chuyên Môn',
    description: 'Tạo mới, chỉnh sửa danh mục các vị trí chuyên môn và bảng màu nhận diện.',
    defaultRoles: ['Admin'],
  },
  {
    id: 'feat-resource-manage',
    key: 'resource_manage',
    category: 'admin',
    categoryName: 'Quản Trị Hệ Thống',
    name: 'Quản Lý Tài Nguyên Dự Án',
    description: 'Thêm, sửa, xóa các liên kết tài liệu thiết kế, API và source code.',
    defaultRoles: ['Admin', 'Leader'],
  },
  {
    id: 'feat-permissions-manage',
    key: 'permissions_manage',
    category: 'admin',
    categoryName: 'Quản Trị Hệ Thống',
    name: 'Cấu Hình Ma Trận Phân Quyền',
    description: 'Toàn quyền điều chỉnh ma trận phân quyền hệ thống cho tất cả vai trò và thành viên.',
    defaultRoles: ['Admin'],
  },
];

export interface SystemPermissionsMatrix {
  rolePermissions: Record<string, Record<string, boolean>>;
  userOverrides: Record<string, Record<string, boolean>>;
  updatedAt?: number;
  updatedBy?: string;
}

export function getDefaultPermissionsMatrix(): SystemPermissionsMatrix {
  const rolePermissions: Record<string, Record<string, boolean>> = {
    Admin: {},
    Leader: {},
    Advisor: {},
    Member: {},
  };

  const userOverrides: Record<string, Record<string, boolean>> = {};

  SYSTEM_FEATURES.forEach((feat) => {
    rolePermissions.Admin[feat.key] = true;
    rolePermissions.Leader[feat.key] = feat.defaultRoles.includes('Leader');
    rolePermissions.Advisor[feat.key] = feat.defaultRoles.includes('Advisor');
    rolePermissions.Member[feat.key] = feat.defaultRoles.includes('Member');

    if (feat.defaultAccounts) {
      feat.defaultAccounts.forEach((acc) => {
        if (!userOverrides[acc]) userOverrides[acc] = {};
        userOverrides[acc][feat.key] = true;
      });
    }
  });

  return {
    rolePermissions,
    userOverrides,
    updatedAt: Date.now(),
  };
}

export function checkUserSystemPermission(
  user?: User | null,
  featureKey?: string,
  matrix?: SystemPermissionsMatrix | null
): boolean {
  if (!user || !featureKey || user.disabled || user.status === 'disabled') return false;
  const lowerAcc = (user.account || '').toLowerCase().trim();
  const role = user.role || 'Member';

  // Admin always has full access
  if (lowerAcc === 'admin' || role === 'Admin') return true;

  const currentMatrix = matrix || getDefaultPermissionsMatrix();

  // 1. Check User Override
  const userOverride = Object.entries(currentMatrix.userOverrides || {}).find(
    ([acc]) => acc.toLowerCase().trim() === lowerAcc
  )?.[1];

  if (userOverride && userOverride[featureKey] !== undefined) {
    return userOverride[featureKey];
  }

  // 2. Check Role Permission
  if (currentMatrix.rolePermissions?.[role]?.[featureKey] !== undefined) {
    return currentMatrix.rolePermissions[role][featureKey];
  }

  // 3. Fallback to feature default
  const feat = SYSTEM_FEATURES.find((f) => f.key === featureKey);
  if (!feat) return false;
  if (feat.defaultAccounts?.some((a) => a.toLowerCase() === lowerAcc)) return true;
  return feat.defaultRoles.includes(role);
}
