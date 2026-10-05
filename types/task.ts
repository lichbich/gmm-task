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
  role: UserRole; // Level / Vai trò cao nhất trong hệ thống (Admin, Leader, Member, Advisor)
  specializations: Specialization[]; // Multi-specialization (e.g. ['PO'], ['BA'], ['FE'], ['BE'], ['PM'])
  specializationRoles?: Record<Specialization, UserRole>; // Vai trò chi tiết theo từng chuyên môn (e.g. { 'PM': 'Leader', 'BA': 'Advisor' })
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

/**
 * Standardize role name or specialization string to a canonical token (prevent substring false positives like "Back Office" matching "BA")
 */
export const normalizeRoleToken = (role?: string): string => {
  if (!role) return '';
  const r = role.toLowerCase().trim();
  if (r === 'designer' || r === 'design' || r.includes('thiết kế')) return 'design';
  if (r === 'fe' || r === 'frontend' || r.includes('front-end') || r.includes('giao diện')) return 'fe';
  if (r === 'be' || r === 'backend' || r.includes('back-end') || r.includes('máy chủ')) return 'be';
  if (r === 'ba' || r.includes('business analyst') || r.includes('nghiệp vụ')) return 'ba';
  if (r === 'devops' || r.includes('hạ tầng') || r.includes('cloud')) return 'devops';
  if (r === 'ai' || r.includes('trí tuệ') || r.includes('machine learning')) return 'ai';
  if (r === 'po' || r.includes('product owner')) return 'po';
  if (r === 'qa' || r.includes('qc') || r.includes('kiểm thử') || r.includes('tester')) return 'qa';
  if (r === 'sa' || r.includes('kiến trúc')) return 'sa';
  if (r === 'pm' || r === 'project manager' || r.includes('quản lý dự án')) return 'pm';
  if (r === 'back office' || r === 'backoffice' || r.includes('hành chính') || r.includes('văn phòng')) return 'back office';
  return r;
};

/**
 * Check if a specialization string matches a target role code accurately
 */
export const isSpecializationMatchingRole = (spec?: string, roleCode?: string): boolean => {
  if (!spec || !roleCode) return false;
  const sNorm = normalizeRoleToken(spec);
  const rNorm = normalizeRoleToken(roleCode);
  return sNorm === rNorm;
};

/**
 * Lấy vai trò của người dùng trong một nghiệp vụ chuyên môn cụ thể.
 * Ưu tiên specializationRoles[spec]. Nếu user thuộc chuyên môn đó thì lấy role của user.
 * Nếu user KHÔNG thuộc chuyên môn đó thì trả về 'Member' (không có quyền Leader/Advisor trong team khác).
 */
export const getUserRoleInSpec = (user?: User | null, spec?: string): UserRole => {
  if (!user) return 'Member';
  if (user.role === 'Admin') return 'Admin';
  if (!spec || spec === 'ALL') return user.role;

  if (user.specializationRoles) {
    // 1. Exact key match
    if (user.specializationRoles[spec]) {
      return user.specializationRoles[spec];
    }
    // 2. Case-insensitive or alias key match (e.g. Design vs Designer)
    for (const [key, roleVal] of Object.entries(user.specializationRoles)) {
      if (isSpecializationMatchingRole(key, spec) && roleVal) {
        return roleVal;
      }
    }
  }

  // 3. Check if user actually belongs to this specialization
  const hasSpec = (user.specializations || []).some((s) => isSpecializationMatchingRole(s, spec));
  if (hasSpec) {
    return user.role || 'Member';
  }

  // 4. User does NOT belong to this specialization -> they are a regular Member for this foreign team
  return 'Member';
};

/**
 * Kiểm tra người dùng có phải là Project Manager (PM) hay không.
 * PM có vai trò điều phối, toàn quyền trên task & milestones tương đương Admin.
 */
export const isUserPM = (user?: User | null): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  const normalizedSpecs = (user.specializations || []).map((s) => s.trim().toUpperCase());
  if (normalizedSpecs.includes('PM') || normalizedSpecs.includes('PROJECT MANAGER')) return true;
  if (user.specializationRoles) {
    for (const [spec, roleVal] of Object.entries(user.specializationRoles)) {
      const norm = spec.trim().toUpperCase();
      if ((norm === 'PM' || norm === 'PROJECT MANAGER') && roleVal) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Kiểm tra người dùng có quyền quản trị cấp cao (Admin hoặc PM) hay không.
 */
export const isUserAdminOrPM = (user?: User | null): boolean => {
  if (!user) return false;
  return user.role === 'Admin' || isUserPM(user);
};

/**
 * Tính toán vai trò tổng thể cao nhất của user dựa trên các vai trò từng nghiệp vụ.
 * Leader > Advisor > Member (Admin giữ nguyên)
 */
export const calculateHighestRole = (
  specRoles?: Record<Specialization, UserRole>,
  defaultRole: UserRole = 'Member'
): UserRole => {
  if (defaultRole === 'Admin') return 'Admin';
  if (!specRoles || Object.keys(specRoles).length === 0) return defaultRole;
  const rolesList = Object.values(specRoles);
  if (rolesList.includes('Leader')) return 'Leader';
  if (rolesList.includes('Advisor')) return 'Advisor';
  return 'Member';
};

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
  editingUserId?: string,
  specializationRoles?: Record<Specialization, UserRole>
): { valid: boolean; error?: string; warning?: string } => {
  if (targetRole === 'Admin') {
    return { valid: true };
  }

  const activeUsers = users.filter((u) => !u.disabled && u.status !== 'disabled');
  const otherUsers = editingUserId ? activeUsers.filter((u) => u.id !== editingUserId) : activeUsers;
  const targetSpecs = specializations && specializations.length > 0 ? specializations : ['BA'];

  for (const spec of targetSpecs) {
    // Determine the exact role assigned for this specific specialization
    const roleInThisSpec = specializationRoles?.[spec] || targetRole;

    if (roleInThisSpec === 'Leader') {
      const existingLeadersInSpec = otherUsers.filter((u) => {
        const uRoleInSpec = getUserRoleInSpec(u, spec);
        return uRoleInSpec === 'Leader' && u.specializations?.includes(spec);
      });
      if (existingLeadersInSpec.length >= 1) {
        const leaderNames = existingLeadersInSpec.map((u) => `${u.name} (@${u.account})`).join(', ');
        return {
          valid: false,
          error: `Nghiệp vụ "${spec}" đã có Leader: ${leaderNames}. Định mức cho mỗi nghiệp vụ chỉ tối đa 1 Leader. Vui lòng điều chỉnh vai trò Leader hiện tại trước khi phân công Leader mới cho ${spec}.`,
        };
      }
    }

    if (roleInThisSpec === 'Advisor') {
      const existingAdvisorsInSpec = otherUsers.filter((u) => {
        const uRoleInSpec = getUserRoleInSpec(u, spec);
        return uRoleInSpec === 'Advisor' && u.specializations?.includes(spec);
      });
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
  memberEfforts?: Record<string, number>; // Bóc tách giờ làm theo từng thành viên (VD: { "ChauNNB": 9, "AnhNHM": 3 })
  status: TaskStatus;
  assigneeAccount: string; // e.g. "NhiHT" or "" if unassigned
  supporterAccounts?: string[]; // Danh sách tài khoản người hỗ trợ task (Supporters)
  milestoneId: string;
  orderInMilestone: number;
  completionPercentage: number; // 0 - 100
  lastSubmittedAt?: string;
  isSubmittedLate?: boolean;
  weekNumber: number;
  year: number;
  startDate?: string; // Ngày bắt đầu (YYYY-MM-DD)
  endDate?: string; // Ngày hoàn thành (YYYY-MM-DD)
  notes?: string; // Ghi chú gửi Leader
  assignmentRequestedBy?: string; // Tài khoản member xin nhận task
  assignmentRequestStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'; // Trạng thái phê duyệt của Leader
  requestedWeekNumber?: number; // Mốc tuần yêu cầu phân công
  parentTaskId?: string; // ID của task gốc khi rolled over sang tuần mới
  activityLogs?: TaskActivityLog[]; // Nhật ký lịch sử các lần cập nhật task
  ticketId?: string; // ID của request ticket liên kết nếu task được sinh ra từ ticket
}

/**
 * Lấy số giờ Effort thực tế của một thành viên cụ thể trong task (cho cả task đơn và task collab).
 */
export const getMemberTaskEffort = (task?: Task | null, account?: string): number => {
  if (!task) return 0;
  if (!account || !account.trim()) return Number(task.actualEffort) || 0;

  const cleanAcc = account.trim().toLowerCase();

  if (task.memberEfforts && typeof task.memberEfforts === 'object') {
    // 1. Direct match
    if (task.memberEfforts[account] !== undefined) {
      return Number(task.memberEfforts[account]) || 0;
    }
    // 2. Case-insensitive key match
    for (const [key, val] of Object.entries(task.memberEfforts)) {
      if (key.trim().toLowerCase() === cleanAcc) {
        return Number(val) || 0;
      }
    }
  }

  // Fallback: If no memberEfforts map exists yet
  const primaryAcc = (task.assigneeAccount || '').trim().toLowerCase();
  const isSupporter = task.supporterAccounts?.some((s) => s.trim().toLowerCase() === cleanAcc);

  if (primaryAcc === cleanAcc) {
    return Number(task.actualEffort) || 0;
  }

  if (isSupporter) {
    return 0;
  }

  return Number(task.actualEffort) || 0;
};

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
  const pct = t.completionPercentage || 0;
  const effort = t.actualEffort || 0;
  const isDone = t.status === 'Done';
  return pct === 0 && effort === 0 && !isDone;
};

export const getEffectiveTaskStatus = (t: Task): TaskStatus => {
  const pct = t.completionPercentage || 0;
  if (pct >= 100 || t.status === 'Done') return 'Done';
  if (pct > 0) return 'In Progress';
  return 'To do';
};

/**
 * Lấy chuỗi ngày YYYY-MM-DD cho input type="date"
 */
export const getTodayDateOnlyString = (baseTime?: string): string => {
  const d = baseTime ? new Date(baseTime) : new Date();
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format chuỗi ngày YYYY-MM-DD hoặc ISO sang DD/MM/YYYY
 */
export const formatDateOnlyDisplay = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    const dt = new Date(dateStr);
    if (!isNaN(dt.getTime())) {
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const year = dt.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
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

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'Rejected';

export interface TicketComment {
  id: string;
  ticketId: string;
  authorAccount: string;
  authorName: string;
  authorRole?: UserRole;
  authorSpecialization?: string;
  content: string;
  createdAt: string;
  attachments?: string[];
}

export interface TicketActivityLog {
  id: string;
  timestamp: string; // ISO date string
  authorName: string;
  authorAccount: string;
  authorRole?: string;
  actionType:
    | 'CREATE'
    | 'STATUS_CHANGE'
    | 'ASSIGNEE_CHANGE'
    | 'PRIORITY_CHANGE'
    | 'DESC_UPDATE'
    | 'RESOLVE'
    | 'REOPEN'
    | 'CLOSE'
    | 'COMMENT_ADD'
    | 'GENERAL_UPDATE';
  summary: string;
}

export interface Ticket {
  id: string;
  code: string; // e.g. "REQ-001"
  title: string;
  description: string;
  fromRole: Specialization; // Role / Team gửi request (e.g. "Design", "FE", "BE")
  fromAccount: string; // Staff Code người tạo
  fromName: string; // Tên người tạo
  fromUserRole?: UserRole; // 'Admin', 'Leader', 'Advisor', 'Member'
  toRole: Specialization; // Role / Team tiếp nhận xử lý (e.g. "BA", "BE", "Design")
  assignedTo?: string; // Staff Code người trong team toRole được phân công
  assignedToName?: string; // Tên người được phân công
  createdTaskId?: string; // ID của task tương ứng đã tạo trong danh sách task của người được phân công
  createdTaskTitle?: string;
  priority: TicketPriority;
  status: TicketStatus;
  relatedTaskId?: string; // Liên kết task liên quan nếu có
  relatedTaskTitle?: string;
  relatedMilestoneId?: string; // Liên kết milestone liên quan nếu có
  relatedMilestoneTitle?: string;
  attachments?: string[]; // Danh sách link tài liệu, thiết kế, figma đính kèm
  resolutionNote?: string; // Ghi chú giải pháp hoặc kết quả xử lý
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  closedAt?: string;
  comments?: TicketComment[];
  activityLogs?: TicketActivityLog[]; // Nhật ký lịch sử các lần cập nhật request
  createdAt: string;
  updatedAt?: string;
}

/**
 * Return tailwind text color class matching the user's role level (Leader: yellow/amber, Advisor: emerald/green, Admin: purple, Member: blue)
 */
export const getUserRoleColorClass = (role?: UserRole | string): string => {
  switch (role) {
    case 'Leader':
      return 'text-amber-600 dark:text-amber-400 font-bold';
    case 'Advisor':
      return 'text-emerald-600 dark:text-emerald-400 font-bold';
    case 'Admin':
      return 'text-purple-600 dark:text-purple-400 font-bold';
    case 'Member':
      return 'text-blue-600 dark:text-blue-400 font-semibold';
    default:
      return 'text-slate-700 dark:text-slate-200 font-semibold';
  }
};

/**
 * Return numeric rank for sorting users by role level:
 * Admin (1) -> Leader (2) -> Advisor (3) -> Member (4)
 */
export const getUserLevelRank = (role?: UserRole | string): number => {
  if (!role) return 99;
  const r = role.trim().toLowerCase();
  if (r === 'admin') return 1;
  if (r === 'leader') return 2;
  if (r === 'advisor') return 3;
  if (r === 'member') return 4;
  return 10;
};

