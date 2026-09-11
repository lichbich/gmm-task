export type UserRole = 'Admin' | 'Leader' | 'Member';

export type Specialization = 'BA' | 'Design' | 'Dev' | 'FE' | 'BE' | 'QA';

export interface User {
  id: string;
  name: string;
  account: string; // e.g. "VuongNT", "NhiHT"
  role: UserRole;
  specializations: Specialization[]; // Multi-specialization e.g. ['BA', 'Design']
  avatarUrl?: string;
  password?: string;
  firstLoginCompleted?: boolean;
}

export type TaskStatus = 'To do' | 'In Progress' | 'Done';

export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  order: number;
  status: 'Planned' | 'In Progress' | 'Completed';
}

export interface Task {
  id: string;
  title: string;
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
  archivedAt: string;
  completedTasksCount: number;
  rolledOverTasksCount: number;
  awards: WeeklyAwardSummary[];
}
