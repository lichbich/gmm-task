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

export type TaskStatus = 'To do' | 'In Progress' | 'Done';

export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  order: number;
  status: 'Planned' | 'In Progress' | 'Completed';
  role?: Specialization | 'ALL';
}

export interface Task {
  id: string;
  title: string;
  description?: string; // Chi tiết task mô tả bởi Leader
  createdBy?: string; // Người tạo đầu việc (e.g. "QuynhNV (Leader)")
  createdAt?: string; // Thời gian tạo (ISO date string)
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
  updatedAt?: string;
  assignmentRequestedBy?: string; // Tài khoản member xin nhận task
  assignmentRequestStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'; // Trạng thái phê duyệt của Leader
  requestedWeekNumber?: number; // Mốc tuần yêu cầu phân công
  parentTaskId?: string; // ID của task gốc khi rolled over sang tuần mới
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
  isLate: boolean; // Báo Đỏ
  lastSubmittedAt?: string;
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
