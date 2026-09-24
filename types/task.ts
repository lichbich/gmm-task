export type UserRole = 'Admin' | 'Leader' | 'Member' | 'Advisor';

export type Specialization = string;

export interface RoleItem {
  id: string;
  code: string; // e.g. "BA", "Design", "FE", "BE", "QA", "Mobile"
  name: string; // Tên hiển thị đầy đủ
  description?: string;
  color?: string; // e.g. "purple", "amber", "blue", "emerald", "rose", "indigo", "cyan", "slate"
  order?: number;
  createdAt?: string;
}

export interface User {
  id: string;
  name: string; // Họ và tên đầy đủ
  account: string; // Staff Code (Username dùng để đăng nhập, e.g. "QuynhNV", "ThanhNDT")
  role: UserRole; // Level / Vai trò trong hệ thống (Admin, Leader, Member, Advisor)
  specializations: Specialization[]; // Multi-specialization (e.g. ['PO'], ['BA'], ['FE'], ['BE'])
  cccd?: string; // Số Căn cước công dân
  bankAccount?: string; // Tài khoản ngân hàng
  email?: string; // Địa chỉ Gmail / Email
  phone?: string; // Số điện thoại liên hệ
  technologies?: string; // Công nghệ / Kỹ năng
  birthDate?: string | number; // Năm sinh
  totalEffort?: number; // Tổng giờ Effort tích lũy
  avatarUrl?: string;
  password?: string;
  tempPassword?: string; // Stored temporary password for Admin reference until first login completion
  firstLoginCompleted?: boolean;
  disabled?: boolean; // Set to true when user account is disabled/hidden
  status?: 'active' | 'disabled';
}

export interface RoleLevelRule {
  role: UserRole;
  title: string;
  subtitle: string;
  responsibility: string;
  min?: number;
  max?: number;
  unlimited?: boolean;
  quotaText: string;
  badgeClass: string;
  iconColor: string;
  canBreakTasks: boolean;
  canAssignTasks: boolean;
}

export const ROLE_LEVEL_RULES: Record<UserRole, RoleLevelRule> = {
  Leader: {
    role: 'Leader',
    title: 'Leader (Trưởng nhóm)',
    subtitle: 'Chủ động phân rã & giao việc',
    responsibility: 'Leader có trách nhiệm chủ động bẻ task từ milestones cho tất cả thành viên (Advisor, Member)',
    min: 0,
    max: 1,
    quotaText: 'Tối đa: 1 người',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700',
    iconColor: 'text-amber-600',
    canBreakTasks: true,
    canAssignTasks: true,
  },
  Advisor: {
    role: 'Advisor',
    title: 'Advisor (Cố vấn dự án)',
    subtitle: 'Hỗ trợ bẻ task & phối hợp',
    responsibility: 'Advisor (cố vấn, trình độ tương đồng Leader), có thể hỗ trợ bẻ task từ milestones cho chính mình / cho Members khi Leader chưa xử lý kịp',
    min: 1,
    max: 3,
    quotaText: 'Tối thiểu 1 người, tối đa 3 người',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700',
    iconColor: 'text-emerald-600',
    canBreakTasks: true,
    canAssignTasks: true,
  },
  Member: {
    role: 'Member',
    title: 'Member (Thành viên)',
    subtitle: 'Thực hiện & nộp báo cáo',
    responsibility: 'Member thực hiện nhận task từ Leader / Advisor, hoàn thành công việc và nộp báo cáo tiến độ',
    unlimited: true,
    quotaText: 'Không hạn chế',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700',
    iconColor: 'text-blue-600',
    canBreakTasks: false,
    canAssignTasks: false,
  },
  Admin: {
    role: 'Admin',
    title: 'Admin (Quản trị hệ thống)',
    subtitle: 'Toàn quyền cấu hình & giám sát',
    responsibility: 'Quản trị tài khoản, phân quyền, cấu hình hệ thống và giám sát toàn bộ hoạt động dự án',
    unlimited: true,
    quotaText: 'Không hạn chế',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700',
    iconColor: 'text-purple-600',
    canBreakTasks: true,
    canAssignTasks: true,
  },
};

export const validateRoleQuota = (
  targetRole: UserRole,
  specializations: Specialization[],
  users: User[],
  editingUserId?: string
): { valid: boolean; error?: string; warning?: string } => {
  if (targetRole === 'Member' || targetRole === 'Admin') {
    return { valid: true };
  }

  const activeUsers = users.filter((u) => !u.disabled && u.status !== 'disabled');
  const otherUsers = editingUserId ? activeUsers.filter((u) => u.id !== editingUserId) : activeUsers;
  const targetSpecs = specializations && specializations.length > 0 ? specializations : ['BA'];

  for (const spec of targetSpecs) {
    if (targetRole === 'Leader') {
      const existingLeadersInSpec = otherUsers.filter(
        (u) => u.role === 'Leader' && u.specializations?.includes(spec)
      );
      if (existingLeadersInSpec.length >= 1) {
        const leaderNames = existingLeadersInSpec.map((u) => `${u.name} (@${u.account})`).join(', ');
        return {
          valid: false,
          error: `Nghiệp vụ "${spec}" đã có Leader: ${leaderNames}. Định mức cho mỗi nghiệp vụ chỉ tối đa 1 Leader. Vui lòng điều chỉnh vai trò Leader hiện tại trước khi phân công Leader mới cho ${spec}.`,
        };
      }
    }

    if (targetRole === 'Advisor') {
      const existingAdvisorsInSpec = otherUsers.filter(
        (u) => u.role === 'Advisor' && u.specializations?.includes(spec)
      );
      if (existingAdvisorsInSpec.length >= 3) {
        const advisorNames = existingAdvisorsInSpec.map((u) => `${u.name} (@${u.account})`).join(', ');
        return {
          valid: false,
          error: `Nghiệp vụ "${spec}" đã đủ định mức 3 Advisor: ${advisorNames}. Mỗi nghiệp vụ chỉ tối đa 3 Advisor.`,
        };
      }
    }
  }

  return { valid: true };
};

export type TaskStatus = 'To do' | 'In Progress' | 'Done';

export interface Milestone {
  id: string;
  title: string;
  goal?: string;
  description?: string;
  timeline?: string;
  deadline?: string;
  targetDate?: string;
  moduleCode?: string;
  deliverable?: string;
  order: number;
  status: 'Planned' | 'In Progress' | 'Completed';
  role?: Specialization | 'ALL';
}

export interface TaskActivityLog {
  id: string;
  timestamp: string; // ISO date string
  authorName: string; // Tên người thực hiện
  authorAccount: string; // Staff Code
  authorRole?: string; // Vai trò: Admin, Leader, Member...
  actionType:
    | 'CREATE'
    | 'STATUS_CHANGE'
    | 'REPORT_SUBMIT'
    | 'EFFORT_CHANGE'
    | 'PROGRESS_CHANGE'
    | 'ASSIGNEE_CHANGE'
    | 'DESC_UPDATE'
    | 'NOTE_ADD'
    | 'GENERAL_UPDATE';
  summary: string; // Tóm tắt nội dung thay đổi
}

export interface Task {
  id: string;
  title: string;
  description?: string; // Chi tiết task mô tả bởi Leader
  createdBy?: string; // Người tạo đầu việc (e.g. "QuynhNV (Leader)")
  createdAt?: string; // Thời gian tạo (ISO date string)
  updatedBy?: string; // Người cập nhật gần nhất (e.g. "Đoàn Việt Dũng (@DungDV)")
  updatedAt?: string; // Thời gian cập nhật gần nhất (ISO date string)
  priority?: 'High' | 'Medium' | 'Low'; // Mức độ ưu tiên
  role: Specialization;
  estimatedEffort: number;
  actualEffort: number;
  status: TaskStatus;
  assigneeAccount: string; // e.g. "NhiHT" or "" if unassigned
  milestoneId: string;
  orderInMilestone: number;
  completionPercentage: number; // 0 - 100
  lastSubmittedAt?: string;
  isSubmittedLate?: boolean;
  weekNumber: number;
  year: number;
  notes?: string; // Ghi chú gửi Leader
  assignmentRequestedBy?: string; // Tài khoản member xin nhận task
  assignmentRequestStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'; // Trạng thái phê duyệt của Leader
  requestedWeekNumber?: number; // Mốc tuần yêu cầu phân công
  parentTaskId?: string; // ID của task gốc khi rolled over sang tuần mới
  activityLogs?: TaskActivityLog[]; // Nhật ký lịch sử các lần cập nhật task
}

export interface WeeklyAwardSummary {
  account: string;
  userName: string;
  role: UserRole;
  specializations: Specialization[];
  totalEffort: number;
  submittedCount: number;
  totalTasks: number;
  isTopEffort: boolean; // Báo Xanh
  isLate: boolean; // Báo Đỏ (Nộp muộn hoặc Chưa nộp quá hạn)
  lastSubmittedAt?: string;
  isMissingReport?: boolean; // Chưa nộp báo cáo khi đã quá hạn 22:00 CN
  penaltyType?: 'LATE' | 'MISSING' | 'NONE';
  penaltyReason?: string;
}

export interface WeeklyHistoryArchive {
  id: string;
  weekNumber: number;
  year: number;
  startDate?: string;
  endDate?: string;
  archivedAt: string;
  completedTasksCount: number;
  rolledOverTasksCount: number;
  awards: WeeklyAwardSummary[];
  tasksSnapshot?: Task[];
}

export const isTaskUnworked = (t: Task): boolean => {
  if (t.status === 'Done') return false;
  const pct = t.completionPercentage || 0;
  const effort = t.actualEffort || 0;
  return pct === 0 && effort === 0;
};

export type ResourceLevel =
  | 'Business Plan'
  | 'Level 1 - Business'
  | 'Level 2 - Design'
  | 'Level 3 - Implementation';

export interface ProjectResource {
  id: string;
  level: ResourceLevel;
  name: string; // Tên hạng mục tài liệu
  content?: string; // Nội dung / Mô tả
  tool?: string; // Công cụ (Google doc, Draw.io, Figma, Sheet, etc.)
  primaryLink: string; // Link (break down) - ưu tiên
  primaryLinkLabel?: string;
  originLink?: string; // Link (origin) - trường hợp đặc biệt
  originLinkLabel?: string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}
