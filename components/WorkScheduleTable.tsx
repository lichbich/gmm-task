import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Task,
  TaskStatus,
  Specialization,
  Milestone,
  Ticket,
  User,
  getEffectiveTaskStatus,
  normalizeRoleToken,
  isSpecializationMatchingRole,
  getUserRoleColorClass,
  getUserRoleInSpec,
  getUserLevelRank,
  isUserPM,
  isUserAdminOrPM,
  getTodayDateOnlyString,
  formatDateOnlyDisplay,
  getMemberTaskEffort,
} from '../types/task';
import { WeeklyReportModal } from './WeeklyReportModal';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskDiscussionModal } from './TaskDiscussionModal';
import { TicketDetailModal } from './TicketDetailModal';
import { calculateTaskAccumulatedEffort } from '../lib/taskEffortHelper';
import { getEffectiveTaskCode } from '../lib/taskCodeHelper';
import {
  Search,
  Plus,
  Edit2,
  AlertTriangle,
  AlertCircle,
  Award,
  Clock,
  UserCheck,
  Globe,
  Lock,
  MessageSquare,
  UserX,
  Users,
  Flag,
  FolderOpen,
  Trash2,
  FileText,
  Flame,
  CalendarPlus,
  SlidersHorizontal,
  RotateCcw,
  X,
  Ticket as TicketIcon,
  Sparkles,
  ShieldCheck,
  ArrowUp,
  CornerDownRight,
  ChevronRight,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { Dropdown, DropdownOption } from './common/Dropdown';
import { NextWeekDefineView } from './NextWeekDefineView';
import { UserAvatar } from './common/UserAvatar';
import { TaskShareButton } from './common/TaskShareButton';
import { RoleUnassignedMembersTag } from './common/RoleUnassignedMembersTag';
import { TaskSupportersBadge } from './common/TaskSupportersBadge';
import { AssignTaskToMemberModal } from './common/AssignTaskToMemberModal';
import { FormattedTaskTitle } from './common/FormattedTaskTitle';
import { stripMarkdownForSearch } from '../lib/textFormattingHelper';
import { getWeekDeadline, getWeekSundayNoon } from './WorkHistoryView';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { AIWeeklySummaryModal } from './AIWeeklySummaryModal';
import { isAIFeatureEnabled } from '../lib/geminiService';
import { isSubtask, isParentTask, getSubtasksOfParent, calculateParentMetrics } from '../lib/subtaskHelper';

interface WorkScheduleTableProps {
  onOpenTaskModal?: (
    task?: Task,
    defaultWeek?: number,
    defaultAssignee?: string,
    defaultRole?: string,
    initialSubtaskParent?: Task
  ) => void;
}

export const WorkScheduleTable: React.FC<WorkScheduleTableProps> = ({ onOpenTaskModal }) => {
  const {
    tasks,
    users,
    milestones,
    currentUser,
    weeklyAwards,
    canReportTask,
    updateTask,
    deleteTask,
    confirmDialog,
    hasUnreadNote,
    markNoteAsRead,
    roles,
    selectedWeek,
    selectedYear,
    simulatedTime,
    weeklyArchives,
    rollbackWeekArchive,
    tickets,
    isUserAllowedAI,
  } = useApp();

  // Sub-tabs state: default to 'MY_TASKS' or remembered from localStorage
  const [subTab, setSubTabState] = useState<'MY_TASKS' | 'ALL_TASKS' | 'DEFINE_NEXT_WEEK'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('saho_schedule_subtab');
        if (saved === 'MY_TASKS' || saved === 'ALL_TASKS' || saved === 'DEFINE_NEXT_WEEK') return saved;
      } catch {}
    }
    return 'MY_TASKS';
  });

  const setSubTab = (newSubTab: 'MY_TASKS' | 'ALL_TASKS' | 'DEFINE_NEXT_WEEK') => {
    setSubTabState(newSubTab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('saho_schedule_subtab', newSubTab);
      } catch {}
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Smooth Bottom Sheet animation hook
  const {
    isRendered: isFilterRendered,
    isVisible: isFilterVisible,
    handleClose: handleCloseFilter,
    handleBackdropMouseDown: handleFilterBackdropMouseDown,
    handleBackdropClick: handleFilterBackdropClick,
  } = useModalAnimation(isMobileFilterOpen, () => setIsMobileFilterOpen(false));

  const [reportingTask, setReportingTask] = useState<Task | null>(null);
  const [viewingDetailTask, setViewingDetailTask] = useState<Task | null>(null);
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);
  const [discussingTask, setDiscussingTask] = useState<Task | null>(null);
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(new Set());

  const toggleParentCollapse = (parentId: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const [assigningMember, setAssigningMember] = useState<{
    user: User;
    roleCode: string;
    roleLabel: string;
    unassignedTasks: Task[];
  } | null>(null);

  // Check if a user belongs to a specific role/specialization (Admins are excluded from unassigned member alerts)
  const isUserInRoleGroup = useCallback((u: User, roleCode: string): boolean => {
    if (!u || u.disabled || u.status === 'disabled') return false;
    // Admins are system administrators, excluded from unassigned member alerts
    if (u.role === 'Admin') return false;
    if (!roleCode || roleCode === 'ALL') return true;

    // Check specializations with exact normalized matching
    const hasSpec = (u.specializations || []).some((spec) => {
      return isSpecializationMatchingRole(spec, roleCode);
    });
    return hasSpec;
  }, []);

  // Check if currentUser has permission to manage/assign tasks for a role
  const canManageRoleGroup = useCallback(
    (roleCode: string): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'Admin' || isUserPM(currentUser)) return true;
      if (currentUser.role === 'Leader' || currentUser.role === 'Advisor') {
        if (!currentUser.specializations || currentUser.specializations.length === 0) return true;
        return currentUser.specializations.some((spec) => {
          return isSpecializationMatchingRole(spec, roleCode);
        });
      }
      return false;
    },
    [currentUser]
  );

  // Pre-indexed lookup maps for O(1) instantaneous access across all rows and cards
  const subtasksByParentIdMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (t.subtaskParentId) {
        const list = map.get(t.subtaskParentId) || [];
        list.push(t);
        map.set(t.subtaskParentId, list);
      }
    });
    return map;
  }, [tasks]);

  const parentMetricsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateParentMetrics>>();
    tasks.forEach((t) => {
      const subtasks = subtasksByParentIdMap.get(t.id);
      if (subtasks && subtasks.length > 0) {
        map.set(t.id, calculateParentMetrics(t, subtasks));
      }
    });
    return map;
  }, [tasks, subtasksByParentIdMap]);

  const userByAccountMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => {
      if (u.account) {
        map.set(u.account.trim().toLowerCase(), u);
      }
    });
    return map;
  }, [users]);

  const milestoneByIdMap = useMemo(() => {
    const map = new Map<string, Milestone>();
    milestones.forEach((m) => {
      map.set(m.id, m);
    });
    return map;
  }, [milestones]);

  const ticketLookup = useMemo(() => {
    const byId = new Map<string, Ticket>();
    const byTaskId = new Map<string, Ticket>();
    tickets.forEach((tk) => {
      byId.set(tk.id, tk);
      if (tk.createdTaskId) byTaskId.set(tk.createdTaskId, tk);
    });
    return { byId, byTaskId };
  }, [tickets]);

  const accumulatedEffortMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateTaskAccumulatedEffort>>();
    tasks.forEach((t) => {
      map.set(t.id, calculateTaskAccumulatedEffort(t, tasks, weeklyArchives));
    });
    return map;
  }, [tasks, weeklyArchives]);

  // Precompute unassigned members and unassigned tasks for all roles in selectedWeek & selectedYear
  const roleUnassignedDataMap = useMemo(() => {
    const map = new Map<string, { unassignedMembers: User[]; unassignedTasks: Task[] }>();
    const weekTasks = tasks.filter(
      (t) => (t.weekNumber || selectedWeek) === selectedWeek && (t.year || selectedYear) === selectedYear
    );
    const busyAccountsSet = new Set<string>();
    weekTasks.forEach((t) => {
      if (t.assigneeAccount) {
        busyAccountsSet.add(t.assigneeAccount.trim().toLowerCase());
      }
      if (t.supporterAccounts) {
        t.supporterAccounts.forEach((s) => busyAccountsSet.add(s.trim().toLowerCase()));
      }
    });

    roles.forEach((r) => {
      const roleCode = r.code;
      const roleMembers = users.filter((u) => u.role !== 'Admin' && isUserInRoleGroup(u, roleCode));
      const unassignedMembers = roleMembers.filter((u) => !busyAccountsSet.has(u.account.trim().toLowerCase()));

      const unassignedTasks = tasks.filter((t) => {
        const isRoleMatch = isSpecializationMatchingRole(t.role, roleCode);
        const isUnassigned = !t.assigneeAccount || t.assigneeAccount.trim() === '';
        if (!isRoleMatch || !isUnassigned) return false;
        return !t.weekNumber || t.weekNumber <= selectedWeek;
      });

      map.set(roleCode, { unassignedMembers, unassignedTasks });
    });

    return map;
  }, [roles, users, tasks, selectedWeek, selectedYear, isUserInRoleGroup]);

  const getRoleUnassignedData = useCallback(
    (roleCode: string) => {
      return roleUnassignedDataMap.get(roleCode) || { unassignedMembers: [], unassignedTasks: [] };
    },
    [roleUnassignedDataMap]
  );

  const getLinkedTicket = useCallback(
    (t: Task): Ticket | undefined => {
      if (t.ticketId) {
        const found = ticketLookup.byId.get(t.ticketId);
        if (found) return found;
      }
      const foundByTaskId = ticketLookup.byTaskId.get(t.id);
      if (foundByTaskId) return foundByTaskId;

      if (t.title && t.title.includes('[')) {
        return tickets.find(
          (tk) =>
            (tk.code && (t.title.includes(`[${tk.code}]`) || t.title.includes(tk.code))) ||
            (t.ticketId && tk.id === t.ticketId)
        );
      }
      return undefined;
    },
    [tickets, ticketLookup]
  );

  const handleTaskClick = (t: Task) => {
    if (t.notes) markNoteAsRead(t.id, t.notes);

    // Check if task originates from a Ticket
    const linkedTicket = getLinkedTicket(t);

    if (linkedTicket) {
      setViewingTicket(linkedTicket);
    } else {
      setViewingDetailTask(t);
    }
  };

  const isSunday = new Date(simulatedTime || Date.now()).getDay() === 0;

  // Force default 'MY_TASKS' on component mount or if not Sunday
  useEffect(() => {
    if (!isSunday && subTab === 'DEFINE_NEXT_WEEK') {
      setSubTab('MY_TASKS');
    }
  }, [isSunday, subTab]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedRole !== 'ALL') count++;
    if (selectedMilestone !== 'ALL') count++;
    if (selectedStatus !== 'ALL') count++;
    if (subTab === 'ALL_TASKS' && selectedAccount !== 'ALL') count++;
    return count;
  }, [selectedRole, selectedMilestone, selectedStatus, selectedAccount, subTab]);

  const handleResetFilters = () => {
    setSelectedRole('ALL');
    setSelectedMilestone('ALL');
    setSelectedStatus('ALL');
    setSelectedAccount('ALL');
  };

  const handleRoleChange = (roleCode: string) => {
    setSelectedRole(roleCode);
    setSelectedAccount('ALL');
    setSelectedMilestone('ALL');
  };

  const isMemberInRole = useCallback(
    (u: any, roleCode: string): boolean => {
      if (!u || u.disabled || u.status === 'disabled') return false;
      if (!roleCode || roleCode === 'ALL') return true;

      // 1. Check specializations match with normalized role
      const hasSpecMatch = (u.specializations || []).some((spec: string) => {
        return isSpecializationMatchingRole(spec, roleCode);
      });
      if (hasSpecMatch) return true;

      // 2. Check if user has any tasks assigned under this role (as assignee or supporter)
      const hasTaskInRole = tasks.some(
        (t) =>
          isSpecializationMatchingRole(t.role, roleCode) &&
          (t.assigneeAccount?.toLowerCase() === u.account.toLowerCase() ||
            (t.supporterAccounts && t.supporterAccounts.some((s) => s.toLowerCase() === u.account.toLowerCase())))
      );
      if (hasTaskInRole) return true;

      return false;
    },
    [tasks]
  );

  const isMilestoneInRole = useCallback(
    (m: Milestone, roleCode: string): boolean => {
      if (!roleCode || roleCode === 'ALL') return true;

      // 1. Check if milestone role matches
      if (m.role) {
        if (m.role.toLowerCase() === 'all' || isSpecializationMatchingRole(m.role, roleCode)) {
          return true;
        }
      }

      // 2. Check if any task in this milestone has the target role
      const hasTaskInRole = tasks.some(
        (t) => t.milestoneId === m.id && isSpecializationMatchingRole(t.role, roleCode)
      );
      if (hasTaskInRole) return true;

      return false;
    },
    [tasks]
  );

// Preferred role display order: BA -> Designer/Design -> FE -> BE -> DevOps -> AI -> PO
const PREFERRED_ROLE_ORDER = ['BA', 'Designer', 'Design', 'FE', 'BE', 'DevOps', 'AI', 'PO'];

const getRoleOrderRank = (roleCode?: string): number => {
  if (!roleCode) return 999;
  const normalized = roleCode.trim().toLowerCase();
  if (normalized === 'ba') return 1;
  if (normalized === 'designer' || normalized === 'design') return 2;
  if (normalized === 'fe') return 3;
  if (normalized === 'be') return 4;
  if (normalized === 'devops') return 5;
  if (normalized === 'ai') return 6;
  if (normalized === 'po') return 7;
  return 100;
};

  const roleOptions: DropdownOption[] = useMemo(() => {
    const sortedRoles = [...roles].sort((a, b) => {
      const rankA = getRoleOrderRank(a.code);
      const rankB = getRoleOrderRank(b.code);
      if (rankA !== rankB) return rankA - rankB;
      return (a.order || 0) - (b.order || 0);
    });

    return [
      { value: 'ALL', label: 'Tất cả Role' },
      ...sortedRoles.map((r) => ({
        value: r.code,
        label: r.name && r.name.toLowerCase() !== r.code.toLowerCase() ? `${r.code} (${r.name})` : r.code,
      })),
    ];
  }, [roles]);

  const accountOptions: DropdownOption[] = useMemo(
    () => [
      { value: 'ALL', label: 'Tất cả Thành Viên (Account)' },
      ...users
        .filter((u) => isMemberInRole(u, selectedRole))
        .map((u) => ({
          value: u.account,
          label: `${u.name} (${u.account})`,
          subLabel: `${u.role} • ${u.specializations?.join(', ') || ''}`,
        })),
    ],
    [users, selectedRole, isMemberInRole]
  );

  const milestoneOptions: DropdownOption[] = useMemo(
    () => [
      { value: 'ALL', label: 'Tất cả Milestone' },
      { value: 'NO_MILESTONE', label: '📌 Task Ngoài Milestone (Chưa gán)' },
      ...milestones
        .filter((m) => isMilestoneInRole(m, selectedRole))
        .map((m) => ({
          value: m.id,
          label: `🚩 ${m.title}`,
        })),
    ],
    [milestones, selectedRole, isMilestoneInRole]
  );

  const statusOptions: DropdownOption[] = [
    { value: 'ALL', label: 'Tất cả Trạng Thái' },
    { value: 'To do', label: 'To do (Cần làm)' },
    { value: 'In Progress', label: 'In Progress (Đang làm)' },
    { value: 'Done', label: 'Done (Đã hoàn thành)' },
  ];

  const getPriorityRank = (priority?: string): number => {
    if (priority === 'High') return 1;
    if (priority === 'Low') return 3;
    return 2; // Medium or undefined
  };

  const sortByPriority = (a: Task, b: Task): number => {
    const rankA = getPriorityRank(a.priority);
    const rankB = getPriorityRank(b.priority);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    const titleA = stripMarkdownForSearch(a.title);
    const titleB = stripMarkdownForSearch(b.title);
    const cmpTitle = titleA.localeCompare(titleB, undefined, { sensitivity: 'base', numeric: true });
    if (cmpTitle !== 0) return cmpTitle;
    return (a.id || '').localeCompare(b.id || '');
  };

  // Filter & Sort Tasks by Priority (High -> Medium -> Low)
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Only show tasks belonging to current selected week & year
        if (t.weekNumber !== selectedWeek || (t.year && t.year !== selectedYear)) {
          return false;
        }

        // Ẩn task 0% và 0h nếu đã được chuyển tiếp sang tuần tới (để tuần cũ mất hoàn toàn)
        const isZeroWork =
          (!t.completionPercentage || t.completionPercentage === 0) &&
          (!t.actualEffort || t.actualEffort === 0);
        if (isZeroWork) {
          const nextWeek = selectedWeek + 1;
          const rootId = t.parentTaskId || t.id;
          const alreadyTransferredToNext = tasks.some(
            (nt) =>
              nt.weekNumber === nextWeek &&
              nt.year === (t.year || selectedYear) &&
              (nt.parentTaskId === rootId || nt.id === rootId)
          );
          if (alreadyTransferredToNext) {
            return false;
          }
        }

        // Sub-tab filter: My Tasks default (includes primary assignee and supporters)
        if (subTab === 'MY_TASKS') {
          if (!currentUser) return false;
          const userAcc = currentUser.account.toLowerCase();
          const isAssignee = Boolean(t.assigneeAccount && t.assigneeAccount.toLowerCase() === userAcc);
          const isSupporter = Boolean(t.supporterAccounts && t.supporterAccounts.some((s) => s.toLowerCase() === userAcc));
          if (!isAssignee && !isSupporter) {
            return false;
          }
        }

        // Sub-tab filter: All Tasks only shows assigned tasks (tasks with an assignee or supporters)
        if (subTab === 'ALL_TASKS') {
          const acc = (t.assigneeAccount || '').trim();
          const hasSupporters = Boolean(t.supporterAccounts && t.supporterAccounts.length > 0);
          if ((!acc || acc.toLowerCase() === 'unassigned') && !hasSupporters) {
            return false;
          }
        }

        if (searchQuery && !stripMarkdownForSearch(t.title).toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (selectedRole !== 'ALL') {
          const isTaskRole = isSpecializationMatchingRole(t.role, selectedRole);
          const isSupporterInRole = Boolean(
            t.supporterAccounts &&
              t.supporterAccounts.some((supAcc) => {
                const supUser = users.find((u) => u.account.trim().toLowerCase() === supAcc.trim().toLowerCase());
                const supRoles =
                  supUser?.specializations && supUser.specializations.length > 0
                    ? supUser.specializations
                    : supUser?.role
                    ? [supUser.role]
                    : [];
                return supRoles.some((r) => isSpecializationMatchingRole(r, selectedRole));
              })
          );
          if (!isTaskRole && !isSupporterInRole) return false;
        }
        if (selectedAccount !== 'ALL') {
          const accLower = selectedAccount.toLowerCase();
          const isAssignee = Boolean(t.assigneeAccount && t.assigneeAccount.toLowerCase() === accLower);
          const isSupporter = Boolean(t.supporterAccounts && t.supporterAccounts.some((s) => s.toLowerCase() === accLower));
          if (!isAssignee && !isSupporter) return false;
        }
        if (selectedMilestone === 'NO_MILESTONE') {
          if (t.milestoneId && milestones.some((m) => m.id === t.milestoneId)) return false;
        } else if (selectedMilestone !== 'ALL') {
          if (t.milestoneId !== selectedMilestone) return false;
        }
        if (selectedStatus !== 'ALL') {
          const effStatus = getEffectiveTaskStatus(t);
          if (effStatus !== selectedStatus) return false;
        }
        return true;
      })
      .sort(sortByPriority);
  }, [tasks, selectedWeek, selectedYear, subTab, currentUser, searchQuery, selectedRole, selectedAccount, selectedMilestone, selectedStatus, milestones, users]);

  const ROLE_ORDER: Specialization[] = useMemo(() => {
    const sortedRoles = [...roles].sort((a, b) => {
      const rankA = getRoleOrderRank(a.code);
      const rankB = getRoleOrderRank(b.code);
      if (rankA !== rankB) return rankA - rankB;
      return (a.order || 0) - (b.order || 0);
    });
    const codes = sortedRoles.map((r) => r.code);
    PREFERRED_ROLE_ORDER.forEach((pRole) => {
      if (!codes.some((c) => c.toLowerCase() === pRole.toLowerCase())) {
        codes.push(pRole);
      }
    });
    return codes;
  }, [roles]);

  const getRoleConfig = (roleCode: string) => {
    const rObj = roles.find((r) => r.code.toLowerCase() === roleCode.toLowerCase());
    const color = rObj?.color || (roleCode.toLowerCase() === 'designer' || roleCode.toLowerCase() === 'design' ? 'amber' : roleCode.toLowerCase() === 'devops' ? 'cyan' : roleCode.toLowerCase() === 'ai' ? 'slate' : roleCode.toLowerCase() === 'po' ? 'purple' : 'indigo');

    // Chuẩn hóa và làm sạch tên chuyên môn, loại bỏ việc lặp lại mã role (ví dụ "BA (BA)" -> "Business Analyst (Nghiệp vụ)")
    const getCleanRoleDisplayName = (code: string, rawName?: string): string => {
      const uCode = code.toUpperCase();
      if (!rawName || rawName.trim().toLowerCase() === code.trim().toLowerCase() || rawName.trim().toLowerCase() === `${code.toLowerCase()} (${code.toLowerCase()})`) {
        if (uCode === 'BA') return 'Business Analyst (Nghiệp vụ)';
        if (uCode === 'FE' || uCode === 'FRONTEND') return 'Front-End Development';
        if (uCode === 'BE' || uCode === 'BACKEND') return 'Back-End Development';
        if (uCode === 'QA' || uCode === 'QC') return 'Quality Assurance (Kiểm thử)';
        if (uCode === 'SA') return 'System Architecture (Kiến trúc)';
        if (uCode === 'DEVOPS') return 'DevOps & Infrastructure';
        if (uCode === 'AI') return 'AI & Machine Learning';
        if (uCode === 'PO') return 'Product Owner';
        if (code.toLowerCase() === 'design' || code.toLowerCase() === 'designer') return 'UI/UX Design (Thiết kế)';
        return `Team ${code}`;
      }
      // Loại bỏ phần mã thừa trong ngoặc như "(FE)", "(BE)", "(BA)", "(QA)" nếu có
      let clean = rawName.replace(new RegExp(`\\s*\\(${code}\\)`, 'gi'), '').trim();
      return clean || rawName;
    };

    const cleanName = getCleanRoleDisplayName(roleCode, rObj?.name);
    const desktopLabel = cleanName;
    const mobileLabel = cleanName.replace(/\s*\([^)]*\)/gi, '').trim() || roleCode;

    const colorClasses: Record<string, { bg: string; text: string; badgeBg: string; border: string }> = {
      purple: {
        bg: 'bg-purple-50/95 dark:bg-purple-950/90',
        text: 'text-purple-900 dark:text-purple-200',
        badgeBg: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/60 dark:text-purple-300 dark:border-purple-700',
        border: 'border-purple-200/80 dark:border-purple-900/40',
      },
      amber: {
        bg: 'bg-amber-50/95 dark:bg-amber-950/90',
        text: 'text-amber-900 dark:text-amber-200',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700',
        border: 'border-amber-200/80 dark:border-amber-900/40',
      },
      blue: {
        bg: 'bg-blue-50/95 dark:bg-blue-950/90',
        text: 'text-blue-900 dark:text-blue-200',
        badgeBg: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/60 dark:text-blue-300 dark:border-blue-700',
        border: 'border-blue-200/80 dark:border-blue-900/40',
      },
      emerald: {
        bg: 'bg-emerald-50/95 dark:bg-emerald-950/90',
        text: 'text-emerald-900 dark:text-emerald-200',
        badgeBg: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-700',
        border: 'border-emerald-200/80 dark:border-emerald-900/40',
      },
      rose: {
        bg: 'bg-rose-50/95 dark:bg-rose-950/90',
        text: 'text-rose-900 dark:text-rose-200',
        badgeBg: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/60 dark:text-rose-300 dark:border-rose-700',
        border: 'border-rose-200/80 dark:border-rose-900/40',
      },
      indigo: {
        bg: 'bg-indigo-50/95 dark:bg-indigo-950/90',
        text: 'text-indigo-900 dark:text-indigo-200',
        badgeBg: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/60 dark:text-indigo-300 dark:border-indigo-700',
        border: 'border-indigo-200/80 dark:border-indigo-900/40',
      },
      cyan: {
        bg: 'bg-cyan-50/95 dark:bg-cyan-950/90',
        text: 'text-cyan-900 dark:text-cyan-200',
        badgeBg: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/60 dark:text-cyan-300 dark:border-cyan-700',
        border: 'border-cyan-200/80 dark:border-cyan-900/40',
      },
      slate: {
        bg: 'bg-slate-100/95 dark:bg-slate-900/90',
        text: 'text-slate-900 dark:text-slate-100',
        badgeBg: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        border: 'border-slate-300/80 dark:border-slate-800',
      },
    };

    return {
      label: desktopLabel,
      mobileLabel,
      ...(colorClasses[color] || colorClasses.indigo),
    };
  };

  // Group tasks by role in standard engineering lifecycle order for "ALL_TASKS"
  const groupedTasksByRole = useMemo(() => {
    const groups: { role: string; tasks: Task[] }[] = [];
    const roleMap = new Map<string, Task[]>();

    ROLE_ORDER.forEach((r) => roleMap.set(r, []));

    const findMatchingRoleKey = (roleCode: string): string => {
      if (roleMap.has(roleCode)) return roleCode;
      for (const k of roleMap.keys()) {
        if (isSpecializationMatchingRole(k, roleCode)) {
          return k;
        }
      }
      return roleCode;
    };

    filteredTasks.forEach((t) => {
      // 1. Add to primary task role group
      const primaryKey = findMatchingRoleKey(t.role);
      const list = roleMap.get(primaryKey);
      if (list) {
        if (!list.some((item) => item.id === t.id)) {
          list.push(t);
        }
      } else {
        const existing = roleMap.get(t.role) || [];
        if (!existing.some((item) => item.id === t.id)) {
          existing.push(t);
        }
        roleMap.set(t.role, existing);
      }

      // 2. Also add to Collab members' role groups so Collab tasks appear under their team/account!
      if (t.supporterAccounts && t.supporterAccounts.length > 0) {
        t.supporterAccounts.forEach((supAcc) => {
          const cleanSupAcc = supAcc.trim();
          if (t.assigneeAccount && cleanSupAcc.toLowerCase() === t.assigneeAccount.trim().toLowerCase()) return;
          const supUser = users.find((u) => u.account.trim().toLowerCase() === cleanSupAcc.toLowerCase());
          if (!supUser) return;

          const supRoles =
            supUser.specializations && supUser.specializations.length > 0
              ? supUser.specializations
              : supUser.role
              ? [supUser.role]
              : [t.role];

          supRoles.forEach((sRole) => {
            const sKey = findMatchingRoleKey(sRole);
            const sList = roleMap.get(sKey);
            if (sList) {
              if (!sList.some((item) => item.id === t.id)) {
                sList.push(t);
              }
            } else {
              const existing = roleMap.get(sRole) || [];
              if (!existing.some((item) => item.id === t.id)) {
                existing.push(t);
              }
              roleMap.set(sRole, existing);
            }
          });
        });
      }
    });

    roleMap.forEach((tasksInRole, role) => {
      if (tasksInRole.length > 0) {
        groups.push({ role, tasks: [...tasksInRole].sort(sortByPriority) });
      }
    });

    groups.sort((a, b) => {
      const rankA = getRoleOrderRank(a.role);
      const rankB = getRoleOrderRank(b.role);
      return rankA - rankB;
    });

    return groups;
  }, [filteredTasks, ROLE_ORDER, users]);

  const [activeRoleInView, setActiveRoleInView] = useState<string>('');
  const [showFloatingRoleBar, setShowFloatingRoleBar] = useState<boolean>(false);
  const [isAIWeeklySummaryOpen, setIsAIWeeklySummaryOpen] = useState<boolean>(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Progressive rendering state: initial 2 role groups or 25 my-tasks for instant initial mount
  const [visibleRoleCount, setVisibleRoleCount] = useState<number>(2);
  const [visibleMyTasksCount, setVisibleMyTasksCount] = useState<number>(25);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Responsive device rendering detection to prevent double DOM mount (Desktop table + Mobile cards)
  const [deviceType, setDeviceType] = useState<'desktop' | 'mobile' | 'all'>('all');

  useEffect(() => {
    const updateDevice = () => {
      setDeviceType(window.innerWidth >= 768 ? 'desktop' : 'mobile');
    };
    updateDevice();
    window.addEventListener('resize', updateDevice);
    return () => window.removeEventListener('resize', updateDevice);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (subTab !== 'ALL_TASKS' || groupedTasksByRole.length === 0) {
      setShowFloatingRoleBar(false);
      return;
    }

    const handleScroll = () => {
      const container = tableContainerRef.current;
      if (!container) return;

      const isDesktop = window.innerWidth >= 768;
      const topOffset = isDesktop ? 70 : 60;
      const containerRect = container.getBoundingClientRect();

      // Show floating bar when scrolling through the table area
      const isInTableArea = containerRect.top <= topOffset && containerRect.bottom >= topOffset + 100;
      setShowFloatingRoleBar(isInTableArea);

      // When smooth scrolling programmatically to a selected role, skip updating intermediate active roles to prevent flickering
      if (isProgrammaticScrollRef.current) return;

      if (isInTableArea) {
        let currentActive = groupedTasksByRole[0]?.role || '';
        for (const group of groupedTasksByRole) {
          const id = isDesktop ? `role-section-${group.role}` : `mobile-role-section-${group.role}`;
          const el = document.getElementById(id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= topOffset + 35) {
              currentActive = group.role;
            }
          }
        }
        setActiveRoleInView((prev) => (prev !== currentActive ? currentActive : prev));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [subTab, groupedTasksByRole]);

  const scrollToRole = useCallback((roleCode: string) => {
    setVisibleRoleCount(9999);
    setTimeout(() => {
      const isDesktop = window.innerWidth >= 768;
      const id = isDesktop ? `role-section-${roleCode}` : `mobile-role-section-${roleCode}`;
      const el = document.getElementById(id);
      if (el) {
        const topOffset = isDesktop ? 65 : 55;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = Math.max(0, elementPosition - topOffset);

        // Lock scroll spy updates during smooth scroll
        isProgrammaticScrollRef.current = true;
        setActiveRoleInView(roleCode);

        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });

        // Release lock once smooth scrolling completes
        scrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 650);
      }
    }, 40);
  }, []);

  const totalEstimatedEffort =
    Math.round(
      filteredTasks.reduce((acc, t) => {
        const hasSubtasksInFiltered = filteredTasks.some((st) => st.subtaskParentId === t.id);
        if (hasSubtasksInFiltered) return acc;
        if (subTab === 'MY_TASKS' && currentUser?.account) {
          const isPrimary = t.assigneeAccount?.toLowerCase() === currentUser.account.toLowerCase();
          if (!isPrimary) {
            return acc + getMemberTaskEffort(t, currentUser.account);
          }
        }
        return acc + (t.estimatedEffort || 0);
      }, 0) * 100
    ) / 100;

  const totalActualEffort =
    Math.round(
      filteredTasks.reduce((acc, t) => {
        const hasSubtasksInFiltered = filteredTasks.some((st) => st.subtaskParentId === t.id);
        if (hasSubtasksInFiltered) return acc;
        if (subTab === 'MY_TASKS' && currentUser?.account) {
          return acc + getMemberTaskEffort(t, currentUser.account);
        }
        return acc + (t.actualEffort || 0);
      }, 0) * 100
    ) / 100;

  // Single-source precomputed data for Desktop Table, Mobile Cards, and STT numbering
  const preparedScheduleData = useMemo(() => {
    const map = new Map<string, number>();
    let count = 0;

    if (subTab === 'ALL_TASKS') {
      const preparedGroups = groupedTasksByRole.map((group) => {
        const cfg = getRoleConfig(group.role);
        const groupTotalEst =
          Math.round(group.tasks.reduce((sum, item) => sum + (item.estimatedEffort || 0), 0) * 100) / 100;
        const groupTotalActual =
          Math.round(group.tasks.reduce((sum, item) => sum + (item.actualEffort || 0), 0) * 100) / 100;
        const { unassignedMembers, unassignedTasks } = getRoleUnassignedData(group.role);

        const tasksByAccountMap = new Map<string, Task[]>();
        group.tasks.forEach((t) => {
          const primaryAcc = (t.assigneeAccount || '').trim();

          // 1. Primary assignee
          if (primaryAcc && primaryAcc.toLowerCase() !== 'unassigned') {
            const primaryUser = userByAccountMap.get(primaryAcc.toLowerCase());
            const primaryRoles =
              primaryUser?.specializations && primaryUser.specializations.length > 0
                ? primaryUser.specializations
                : primaryUser?.role
                ? [primaryUser.role]
                : [t.role];
            const isPrimaryInThisRole =
              primaryRoles.some((r) => isSpecializationMatchingRole(r, group.role)) ||
              isSpecializationMatchingRole(t.role, group.role);

            if (isPrimaryInThisRole) {
              const list = tasksByAccountMap.get(primaryAcc) || [];
              if (!list.some((item) => item.id === t.id)) {
                list.push(t);
                tasksByAccountMap.set(primaryAcc, list);
              }
            }
          }

          // 2. Collab members who belong to this role
          if (t.supporterAccounts && t.supporterAccounts.length > 0) {
            t.supporterAccounts.forEach((supAcc) => {
              const cleanSupAcc = supAcc.trim();
              if (primaryAcc && cleanSupAcc.toLowerCase() === primaryAcc.toLowerCase()) return;
              const supUser = userByAccountMap.get(cleanSupAcc.toLowerCase());
              const supRoles =
                supUser?.specializations && supUser.specializations.length > 0
                  ? supUser.specializations
                  : supUser?.role
                  ? [supUser.role]
                  : [t.role];

              const isMemberInThisRole = supRoles.some((r) => isSpecializationMatchingRole(r, group.role));
              if (
                isMemberInThisRole ||
                (!supUser?.specializations?.length && isSpecializationMatchingRole(t.role, group.role))
              ) {
                const targetAcc = supUser?.account || cleanSupAcc;
                const list = tasksByAccountMap.get(targetAcc) || [];
                if (!list.some((item) => item.id === t.id)) {
                  list.push(t);
                  tasksByAccountMap.set(targetAcc, list);
                }
              }
            });
          }

          // 3. Fallback: If task has no primary assignee and no supporters matched this group, but t.role matches group.role
          if (!primaryAcc || primaryAcc.toLowerCase() === 'unassigned') {
            const hasAnyMatchedSupporter =
              t.supporterAccounts &&
              t.supporterAccounts.some((supAcc) => {
                const supUser = userByAccountMap.get(supAcc.trim().toLowerCase());
                const supRoles =
                  supUser?.specializations && supUser.specializations.length > 0
                    ? supUser.specializations
                    : [t.role];
                return supRoles.some((r) => isSpecializationMatchingRole(r, group.role));
              });
            if (!hasAnyMatchedSupporter && isSpecializationMatchingRole(t.role, group.role)) {
              const unassignedKey = '';
              const list = tasksByAccountMap.get(unassignedKey) || [];
              if (!list.some((item) => item.id === t.id)) {
                list.push(t);
                tasksByAccountMap.set(unassignedKey, list);
              }
            }
          }
        });

        const rawAccountGroups = Array.from(tasksByAccountMap.entries()).sort(([accA], [accB]) => {
          if (!accA) return 1;
          if (!accB) return -1;
          const userA = userByAccountMap.get(accA.toLowerCase());
          const userB = userByAccountMap.get(accB.toLowerCase());

          const rankA = getUserLevelRank(userA?.role);
          const rankB = getUserLevelRank(userB?.role);

          if (rankA !== rankB) {
            return rankA - rankB;
          }

          return accA.localeCompare(accB, undefined, { sensitivity: 'base' });
        });

        const accountGroups = rawAccountGroups.map(([acc, accTasks]) => {
          const sortedAccTasks = [...accTasks].sort(sortByPriority);
          const rootAccTasks = sortedAccTasks.filter(
            (t) => !t.subtaskParentId || !sortedAccTasks.some((p) => p.id === t.subtaskParentId)
          );
          const visibleSubtasksMap = new Map<string, Task[]>();
          rootAccTasks.forEach((t) => {
            const taskSubtasks = subtasksByParentIdMap.get(t.id) || [];
            const visibleSubtasks = acc
              ? taskSubtasks.filter((st) => accTasks.some((at) => at.id === st.id))
              : taskSubtasks;
            visibleSubtasksMap.set(t.id, visibleSubtasks);

            if (!map.has(t.id)) {
              count++;
              map.set(t.id, count);
            }
          });

          const accUser = acc ? userByAccountMap.get(acc.toLowerCase()) : undefined;
          const accRole = accUser ? getUserRoleInSpec(accUser, group.role) : 'Member';

          return {
            acc,
            accUser,
            accRole,
            accTasks: sortedAccTasks,
            rootAccTasks,
            visibleSubtasksMap,
          };
        });

        return {
          role: group.role,
          cfg,
          groupTotalEst,
          groupTotalActual,
          unassignedMembers,
          unassignedTasks,
          accountGroups,
        };
      });

      return {
        taskSttMap: map,
        roleGroups: preparedGroups,
        myTasks: null,
      };
    } else {
      // MY_TASKS
      const rootFilteredTasks = filteredTasks.filter(
        (t) => !t.subtaskParentId || !filteredTasks.some((p) => p.id === t.subtaskParentId)
      );
      const visibleSubtasksMap = new Map<string, Task[]>();
      rootFilteredTasks.forEach((t) => {
        count++;
        map.set(t.id, count);
        const taskSubtasks = subtasksByParentIdMap.get(t.id) || [];
        const visibleSubtasks = taskSubtasks.filter((st) => filteredTasks.some((ft) => ft.id === st.id));
        visibleSubtasksMap.set(t.id, visibleSubtasks);
      });

      return {
        taskSttMap: map,
        roleGroups: [],
        myTasks: {
          rootFilteredTasks,
          visibleSubtasksMap,
        },
      };
    }
  }, [
    subTab,
    groupedTasksByRole,
    filteredTasks,
    userByAccountMap,
    getRoleUnassignedData,
    subtasksByParentIdMap,
  ]);

  const taskSttMap = preparedScheduleData.taskSttMap;

  // Check if any filter or search is active
  const isFilterActive = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      selectedRole !== 'ALL' ||
      selectedAccount !== 'ALL' ||
      selectedMilestone !== 'ALL' ||
      selectedStatus !== 'ALL'
    );
  }, [searchQuery, selectedRole, selectedAccount, selectedMilestone, selectedStatus]);

  // Reset progressive counts when subTab, week, or year changes
  useEffect(() => {
    setVisibleRoleCount(2);
    setVisibleMyTasksCount(25);
  }, [subTab, selectedWeek, selectedYear]);

  // Displayed groups for progressive rendering (initial 2 groups, loads next 2 on scroll)
  const displayedRoleGroups = useMemo(() => {
    if (isFilterActive || visibleRoleCount >= preparedScheduleData.roleGroups.length) {
      return preparedScheduleData.roleGroups;
    }
    return preparedScheduleData.roleGroups.slice(0, visibleRoleCount);
  }, [preparedScheduleData.roleGroups, visibleRoleCount, isFilterActive]);

  // Displayed root tasks for MY_TASKS progressive rendering (initial 25 tasks, loads next 25 on scroll)
  const displayedMyTasks = useMemo(() => {
    const rootTasks = preparedScheduleData.myTasks?.rootFilteredTasks || [];
    if (isFilterActive || visibleMyTasksCount >= rootTasks.length) {
      return rootTasks;
    }
    return rootTasks.slice(0, visibleMyTasksCount);
  }, [preparedScheduleData.myTasks?.rootFilteredTasks, visibleMyTasksCount, isFilterActive]);

  const hasMoreItems = useMemo(() => {
    if (isFilterActive) return false;
    if (subTab === 'ALL_TASKS') {
      return visibleRoleCount < preparedScheduleData.roleGroups.length;
    }
    return visibleMyTasksCount < (preparedScheduleData.myTasks?.rootFilteredTasks.length || 0);
  }, [
    isFilterActive,
    subTab,
    visibleRoleCount,
    preparedScheduleData.roleGroups.length,
    visibleMyTasksCount,
    preparedScheduleData.myTasks?.rootFilteredTasks.length,
  ]);

  // IntersectionObserver to load next batch seamlessly 400px before user reaches the bottom
  useEffect(() => {
    if (!hasMoreItems) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          if (subTab === 'ALL_TASKS') {
            setVisibleRoleCount((prev) => Math.min(prev + 2, preparedScheduleData.roleGroups.length));
          } else if (subTab === 'MY_TASKS') {
            setVisibleMyTasksCount((prev) =>
              Math.min(prev + 25, preparedScheduleData.myTasks?.rootFilteredTasks.length || 0)
            );
          }
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [
    hasMoreItems,
    subTab,
    preparedScheduleData.roleGroups.length,
    preparedScheduleData.myTasks?.rootFilteredTasks.length,
  ]);

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'Done':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/80 font-semibold';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800/80 font-semibold';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'BA':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800/80';
      case 'Designer':
      case 'Design':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/80';
      case 'FE':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800/80';
      case 'BE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/80';
      case 'DevOps':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-800/80';
      case 'AI':
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      case 'PO':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800/80';
      case 'QA':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800/80';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const isTopEffortAccount = (acc: string) => {
    if (!acc) return false;
    const award = weeklyAwards.find((w) => w.account === acc);
    return award?.isTopEffort || false;
  };

  // Reusable task row renderer with subtask tree hierarchy support
  const renderTaskRow = (
    t: Task,
    displayIdx: number,
    forAccount?: string,
    isNestedSubtask?: boolean,
    hasVisibleSubtasks?: boolean
  ) => {
    const todayStr = getTodayDateOnlyString(simulatedTime);
    const sundayNoon = getWeekSundayNoon(t.weekNumber || selectedWeek, t.year || selectedYear);
    const nowTime = new Date(simulatedTime).getTime();
    const isReportWindowOpen = nowTime >= sundayNoon.getTime();

    const taskSubtasks = subtasksByParentIdMap.get(t.id) || [];
    const hasSub = taskSubtasks.length > 0;
    const isParent = hasSub || Boolean(t.isParentTask);
    const isSub = Boolean(t.isSubtask || t.subtaskParentId);
    const parentMetrics = parentMetricsMap.get(t.id) || null;
    const isCollapsed = collapsedParentIds.has(t.id);

    const effStatus = (parentMetrics && !t.isManualOverride)
      ? parentMetrics.status
      : getEffectiveTaskStatus(t);
    const accEffort = accumulatedEffortMap.get(t.id) || calculateTaskAccumulatedEffort(t, tasks, weeklyArchives);
    const displayEst = (parentMetrics && !t.isManualOverride)
      ? parentMetrics.totalEstimatedEffort
      : (t.estimatedEffort ?? 0);
    const displayActual = (parentMetrics && !t.isManualOverride)
      ? parentMetrics.totalActualEffort
      : (t.actualEffort ?? displayEst);
    const displayPct = (parentMetrics && !t.isManualOverride)
      ? parentMetrics.completionPercentage
      : (t.completionPercentage ?? 0);

    const isTaskDone = effStatus === 'Done' || t.status === 'Done' || displayPct >= 100;
    // A task is officially reported if it is Done 100% OR submitted at/after Sunday 12:00 PM of that week
    const isReported =
      isTaskDone ||
      (!!t.lastSubmittedAt &&
        new Date(t.lastSubmittedAt).getTime() >= sundayNoon.getTime());

    const isAssignedToMe = canReportTask(t);
    const hasEndDate = Boolean(t.endDate && t.endDate.trim());
    const isOverdue = hasEndDate && !isTaskDone && t.endDate! < todayStr;
    const isDueToday = hasEndDate && !isTaskDone && t.endDate! === todayStr;
    const linkedTicket = getLinkedTicket(t);
    const isTicketTask = Boolean(linkedTicket || t.ticketId || (t.title && t.title.startsWith('[REQ-')));

    return (
      <tr
        key={t.id}
        onClick={() => {
          handleTaskClick(t);
        }}
        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/70 transition cursor-pointer group ${
          isOverdue
            ? 'bg-red-50/30 dark:bg-red-950/20'
            : isNestedSubtask
            ? 'bg-slate-50/40 dark:bg-slate-900/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30'
            : ''
        }`}
      >
        {/* STT */}
        <td className="py-3 px-4 text-center font-mono font-medium">
          {isNestedSubtask ? (
            <span className="text-indigo-400 dark:text-indigo-400 font-bold text-xs select-none">↳</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-400">{displayIdx}</span>
          )}
        </td>

        {/* Task Name */}
        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-100">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isNestedSubtask && (
                <div className="flex items-center gap-1 mr-0.5">
                  <span className="text-indigo-400 font-mono text-xs select-none">└── ↳</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-bold shrink-0">
                    Subtask
                  </span>
                </div>
              )}
              {hasSub && hasVisibleSubtasks !== false && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleParentCollapse(t.id);
                  }}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition text-slate-500 dark:text-slate-400 shrink-0"
                  title={isCollapsed ? 'Mở rộng xem các subtask' : 'Thu gọn các subtask'}
                >
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
              <span className="line-clamp-2 font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                <FormattedTaskTitle title={t.title} />
              </span>
              {hasSub && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasVisibleSubtasks !== false) {
                      toggleParentCollapse(t.id);
                    } else {
                      handleTaskClick(t);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] shrink-0 cursor-pointer hover:bg-indigo-100"
                  title={
                    hasVisibleSubtasks !== false
                      ? `${taskSubtasks.length} subtask trực thuộc. Bấm để ${isCollapsed ? 'mở rộng' : 'thu gọn'}`
                      : `${taskSubtasks.length} subtask trực thuộc (giao cho thành viên khác). Bấm để xem chi tiết task cha`
                  }
                >
                  <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  {taskSubtasks.length} Subtask{hasVisibleSubtasks !== false && isCollapsed ? ' (đang ẩn)' : ''}
                </span>
              )}
              {isSub && !isNestedSubtask && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold shrink-0">
                  ↳ Thuộc: {t.subtaskParentTitle || 'Task lớn'}
                </span>
              )}
              {isTicketTask && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold text-[10px] shrink-0 shadow-2xs"
                  title="Nhiệm vụ được tạo từ Ticket yêu cầu liên team"
                >
                  <TicketIcon className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                  Ticket yêu cầu
                </span>
              )}
              {t.priority === 'High' && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-bold text-[10px] shrink-0 shadow-2xs"
                  title="Mức độ ưu tiên: Cao"
                >
                  <Flame className="w-3 h-3 text-red-500 fill-red-500" />
                  Ưu tiên cao
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(() => {
                const milestone = t.milestoneId ? milestoneByIdMap.get(t.milestoneId) : undefined;
                return milestone ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/90 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 font-semibold text-[10px] shadow-2xs"
                    title={`Thuộc Milestone: ${milestone.title}`}
                  >
                    <Flag className="w-2.5 h-2.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                    {milestone.title}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px]"
                    title="Task độc lập, không gắn vào Milestone cụ thể"
                  >
                    <FolderOpen className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                    Ngoài Milestone
                  </span>
                );
              })()}
            </div>
          </div>
        </td>

        {/* Role Badge */}
        <td className="py-3 px-3">
          <span
            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${getRoleStyle(
              t.role
            )}`}
          >
            {t.role}
          </span>
        </td>

        {/* Effort */}
        <td className="py-3 px-3 text-center font-mono">
          <div className="flex flex-col items-center">
            {(() => {
              const currentEffort = forAccount
                ? getMemberTaskEffort(t, forAccount)
                : (isReported ? displayActual : (displayActual > 0 ? displayActual : displayEst));

              if (isReported) {
                return (
                  <>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {currentEffort}h
                    </span>
                    {displayEst !== undefined && currentEffort !== displayEst && (
                      <span className="text-[9px] text-slate-400 dark:text-slate-400">
                        est: {displayEst}h
                      </span>
                    )}
                  </>
                );
              }

              if (currentEffort > 0) {
                return (
                  <>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {currentEffort}h
                    </span>
                    {displayEst !== undefined && currentEffort !== displayEst && (
                      <span className="text-[9px] text-slate-400 dark:text-slate-400">
                        est: {displayEst}h
                      </span>
                    )}
                  </>
                );
              }

              return (
                <>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {displayEst}h
                  </span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">
                    (est)
                  </span>
                </>
              );
            })()}

            {accEffort.hasMultiWeekHistory && (
              <span
                className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/90 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800 cursor-default"
                title={`Tổng Effort qua ${accEffort.chainTaskCount} tuần: ${accEffort.totalEffort}h (${accEffort.weeklyBreakdown.map(wb => `T${wb.weekNumber}: ${wb.effort}h`).join(' + ')})`}
              >
                Tổng: {accEffort.totalEffort}h
              </span>
            )}
          </div>
        </td>

        {/* Status */}
        <td className="py-3 px-3 text-center">
          <span
            className={`inline-block whitespace-nowrap px-3 py-1 text-[11px] font-semibold rounded-full border ${getStatusBadge(
              effStatus
            )}`}
          >
            {effStatus}
          </span>
        </td>

        {/* Account & Supporters */}
        <td className="py-3 px-3 font-medium">
          <div className="space-y-1">
            {(() => {
              const currentAcc = t.assigneeAccount || (hasSub ? t.subtaskReviewerAccount : '');
              const collabs = (parentMetrics && parentMetrics.collaboratorAccounts.length > 0)
                ? parentMetrics.collaboratorAccounts
                : (t.supporterAccounts || []);

              if (currentAcc) {
                const userObj = userByAccountMap.get(currentAcc.toLowerCase());
                const userRole = userObj ? getUserRoleInSpec(userObj, t.role) : 'Member';
                return (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <UserAvatar
                        user={userObj}
                        account={currentAcc}
                        size="xs"
                        shape="circle"
                      />
                      <span className={getUserRoleColorClass(userRole)}>{currentAcc}</span>
                    </div>

                    {collabs.length > 0 && (
                      <div className="pt-0.5">
                        <TaskSupportersBadge
                          supporterAccounts={collabs}
                          users={users}
                          primaryAssignee={currentAcc}
                          currentViewingAccount={forAccount}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-1">
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                    <UserX className="w-3.5 h-3.5" /> Task trống
                  </span>
                  {collabs.length > 0 && (
                    <div className="pt-0.5">
                      <TaskSupportersBadge
                        supporterAccounts={collabs}
                        users={users}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </td>

        {/* Completion Progress Bar */}
        <td className="py-3 px-3">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500 font-medium">{displayPct}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-300 ${
                  displayPct === 100
                    ? 'bg-emerald-500'
                    : displayPct > 0
                    ? 'bg-indigo-600'
                    : 'bg-slate-300'
                }`}
                style={{ width: `${displayPct}%` }}
              />
            </div>
          </div>
        </td>

        {/* End Date (Hạn hoàn thành) */}
        <td className="py-3 px-3 text-center">
          {hasEndDate ? (
            isOverdue ? (
              <span
                className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 shadow-2xs"
                title={`Quá hạn hoàn thành (${formatDateOnlyDisplay(t.endDate)})`}
              >
                <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
                <span>{formatDateOnlyDisplay(t.endDate)}</span>
              </span>
            ) : isDueToday ? (
              <span
                className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs"
                title={`Hạn chót hôm nay (${formatDateOnlyDisplay(t.endDate)})`}
              >
                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{formatDateOnlyDisplay(t.endDate)}</span>
              </span>
            ) : isTaskDone ? (
              <span
                className="inline-flex items-center justify-center gap-1 px-2 py-0.5 text-[11px] font-medium font-mono text-slate-500 dark:text-slate-400"
                title={`Đã hoàn thành: ${formatDateOnlyDisplay(t.endDate)}`}
              >
                <span>{formatDateOnlyDisplay(t.endDate)}</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center justify-center gap-1 px-2 py-0.5 text-[11px] font-semibold font-mono text-slate-700 dark:text-slate-300"
                title={`Hạn hoàn thành: ${formatDateOnlyDisplay(t.endDate)}`}
              >
                <span>{formatDateOnlyDisplay(t.endDate)}</span>
              </span>
            )
          ) : (
            <span className="text-slate-300 dark:text-slate-600 font-mono text-xs font-normal" title="Chưa đặt hạn hoàn thành">
              -
            </span>
          )}
        </td>

        {/* Action Buttons */}
        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1.5">
            {/* Quick Share / Copy Link Button */}
            <TaskShareButton task={t} variant="icon" align="right" />

            {/* Note & Discussion Button for all members - Glows yellow when there's an unread note */}
            {(() => {
              const isUnread = hasUnreadNote(t);
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markNoteAsRead(t.id, t.notes);
                    setDiscussingTask(t);
                  }}
                  className={`relative p-1.5 rounded-xl transition-all shadow-xs active:scale-95 ${
                    isUnread
                      ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold ring-2 ring-amber-300 dark:ring-amber-400 ring-offset-1 dark:ring-offset-slate-900 shadow-amber-400/40 animate-pulse'
                      : t.notes
                      ? 'bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-600 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-400'
                  }`}
                  title={
                    isUnread
                      ? 'Có trao đổi / ghi chú mới chưa đọc! Bấm để xem'
                      : 'Ghi chú & Trao đổi luồng task'
                  }
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {isUnread && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white dark:border-slate-900 shadow-xs" />
                  )}
                </button>
              );
            })()}

            {/* ONLY RENDER BÁO CÁO BUTTON IF TASK IS ASSIGNED TO CURRENT USER OR CURRENT USER IS SUPPORTER! HIDE COMPLETELY FOR OTHERS */}
            {isAssignedToMe && (
              <button
                onClick={() => setReportingTask(t)}
                className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs hover:shadow-md active:scale-95 transition-all ${
                  isReported
                    ? 'bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white dark:hover:text-white border border-emerald-200/90 dark:border-emerald-800'
                    : isReportWindowOpen
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    : 'bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white dark:hover:text-white border border-indigo-200/90 dark:border-indigo-800'
                }`}
                title={
                  isReported
                    ? `Đã nộp báo cáo tuần (${t.actualEffort || 0}h). Bấm để cập nhật lại nếu cần`
                    : isReportWindowOpen
                    ? 'Cổng báo cáo tuần đang mở (12h - 22h CN). Bấm để nộp báo cáo tuần'
                    : 'Cập nhật tiến độ task (Cổng nộp báo cáo tuần mở từ 12:00 trưa Chủ Nhật)'
                }
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isReported ? 'Đã báo cáo' : isReportWindowOpen ? 'Báo cáo' : 'Cập nhật'}
                </span>
              </button>
            )}

            {/* Leader/Advisor/Admin/PM Quick Add Subtask Button */}
            {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || isUserAdminOrPM(currentUser)) && !isNestedSubtask && (
              <button
                data-tour="quick-add-subtask-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTaskModal?.(undefined, t.weekNumber || selectedWeek, undefined, t.role, t);
                }}
                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-500 dark:text-slate-400 rounded-xl transition-all shadow-xs"
                title="Thêm Subtask trực thuộc cho task này"
              >
                <CornerDownRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Leader/Advisor/Admin/PM Edit & Delete Buttons */}
            {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || isUserAdminOrPM(currentUser)) && (
              <>
                <button
                  onClick={() => onOpenTaskModal?.(t)}
                  className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 rounded-xl transition-all shadow-xs"
                  title="Chỉnh sửa task / Giao việc"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    confirmDialog({
                      title: 'Xác nhận xóa đầu việc',
                      message: `Bạn có chắc chắn muốn xóa đầu việc "${t.title}"? Thao tác này không thể hoàn tác.`,
                      confirmText: 'Xác nhận xóa',
                      type: 'danger',
                      onConfirm: () => deleteTask(t.id),
                    });
                  }}
                  className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-400 text-slate-400 dark:text-slate-400 rounded-xl transition-all shadow-xs"
                  title="Xóa đầu việc này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const renderMobileTaskCard = (
    t: Task,
    displayIdx: number,
    forAccount?: string,
    isNestedSubtask?: boolean,
    hasVisibleSubtasks?: boolean
  ) => {
    const todayStr = getTodayDateOnlyString(simulatedTime);
    const isAssignedToMe = canReportTask(t);
    const sundayNoon = getWeekSundayNoon(t.weekNumber || selectedWeek, t.year || selectedYear);
    const nowTime = new Date(simulatedTime).getTime();
    const isReportWindowOpen = nowTime >= sundayNoon.getTime();

    const taskSubtasks = subtasksByParentIdMap.get(t.id) || [];
    const hasSub = taskSubtasks.length > 0;
    const isParent = hasSub || Boolean(t.isParentTask);
    const isSub = Boolean(t.isSubtask || t.subtaskParentId);
    const parentMetrics = parentMetricsMap.get(t.id) || null;
    const isCollapsed = collapsedParentIds.has(t.id);

    const effStatus = (parentMetrics && !t.isManualOverride)
      ? parentMetrics.status
      : getEffectiveTaskStatus(t);
    const accEffort = accumulatedEffortMap.get(t.id) || calculateTaskAccumulatedEffort(t, tasks, weeklyArchives);
    const displayEst = (parentMetrics && !t.isManualOverride)
      ? parentMetrics.totalEstimatedEffort
      : (t.estimatedEffort ?? 0);
    const displayActual = (parentMetrics && !t.isManualOverride)
      ? parentMetrics.totalActualEffort
      : (t.actualEffort ?? displayEst);
    const displayPct = (parentMetrics && !t.isManualOverride)
      ? parentMetrics.completionPercentage
      : (t.completionPercentage ?? 0);

    const isTaskDone = effStatus === 'Done' || t.status === 'Done' || displayPct >= 100;
    const isReported =
      isTaskDone ||
      (!!t.lastSubmittedAt &&
        new Date(t.lastSubmittedAt).getTime() >= sundayNoon.getTime());

    const hasEndDate = Boolean(t.endDate && t.endDate.trim());
    const isOverdue = hasEndDate && !isTaskDone && t.endDate! < todayStr;
    const isDueToday = hasEndDate && !isTaskDone && t.endDate! === todayStr;

    const unread = hasUnreadNote(t);
    const milestone = t.milestoneId ? milestoneByIdMap.get(t.milestoneId) : undefined;
    const linkedTicket = getLinkedTicket(t);
    const isTicketTask = Boolean(linkedTicket || t.ticketId || (t.title && t.title.startsWith('[REQ-')));

    return (
      <div
        key={t.id}
        className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-xs space-y-3 transition-all ${
          isOverdue
            ? 'border-red-300 dark:border-red-900/60 bg-red-50/15 dark:bg-red-950/15'
            : isTaskDone
            ? 'border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/15 dark:bg-emerald-950/10'
            : t.priority === 'High'
            ? 'border-red-200/80 dark:border-red-900/40 bg-red-50/10 dark:bg-red-950/10'
            : 'border-slate-200/90 dark:border-slate-800'
        }`}
      >
        {/* Top Header: STT, Role, Priority, Status */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isNestedSubtask ? (
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md">
                ↳ Subtask
              </span>
            ) : (
              <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                #{displayIdx}
              </span>
            )}
            {hasSub && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasVisibleSubtasks !== false) {
                    toggleParentCollapse(t.id);
                  } else {
                    handleTaskClick(t);
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]"
                title={
                  hasVisibleSubtasks !== false
                    ? `${taskSubtasks.length} subtask trực thuộc. Bấm để ${isCollapsed ? 'mở rộng' : 'thu gọn'}`
                    : `${taskSubtasks.length} subtask trực thuộc (giao cho thành viên khác). Bấm để xem chi tiết task cha`
                }
              >
                <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                {taskSubtasks.length} Subtask{hasVisibleSubtasks !== false ? (isCollapsed ? ' ▶' : ' ▼') : ''}
              </button>
            )}
            {isSub && !isNestedSubtask && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold">
                ↳ Thuộc: {t.subtaskParentTitle || 'Task lớn'}
              </span>
            )}
            {isTicketTask && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
                <TicketIcon className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                Ticket yêu cầu
              </span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRoleStyle(t.role)}`}>
              {t.role}
            </span>
            {t.priority === 'High' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/70 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 font-bold text-[10px]">
                <Flame className="w-3 h-3 text-red-500 fill-red-500" />
                Ưu tiên cao
              </span>
            ) : t.priority === 'Low' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-medium text-[10px]">
                Ưu tiên thấp
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-medium text-[10px]">
                Ưu tiên bình thường
              </span>
            )}
          </div>

          <span className={`whitespace-nowrap px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${getStatusBadge(effStatus)}`}>
            {effStatus}
          </span>
        </div>

        {/* Task Title (Clickable) */}
        <div>
          <button
            onClick={() => handleTaskClick(t)}
            className="text-left font-bold text-slate-800 dark:text-slate-100 text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block w-full leading-snug cursor-pointer"
          >
            <FormattedTaskTitle title={t.title} />
          </button>

          {/* Milestone Info */}
          <div className="mt-1.5 flex items-center gap-2">
            {milestone ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium">
                <Flag className="w-3 h-3 text-indigo-500 shrink-0" />
                {milestone.title}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px]">
                <FolderOpen className="w-3 h-3 text-slate-400 shrink-0" />
                Ngoài Milestone
              </span>
            )}
          </div>
        </div>

        {/* Stats Box: Assignee, Supporters, Effort, Progress */}
        <div className="bg-slate-50/80 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            {/* Assignee & Supporters */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                {(() => {
                  const currentAcc = t.assigneeAccount || (hasSub ? t.subtaskReviewerAccount : '');
                  if (currentAcc) {
                    const userObj = userByAccountMap.get(currentAcc.toLowerCase());
                    const userRole = userObj ? getUserRoleInSpec(userObj, t.role) : 'Member';
                    return (
                      <>
                        <UserAvatar
                          user={userObj}
                          account={currentAcc}
                          size="xs"
                          shape="circle"
                        />
                        <span className={`text-xs ${getUserRoleColorClass(userRole)}`}>
                          {currentAcc}
                        </span>
                      </>
                    );
                  }
                  return (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                      <UserX className="w-3 h-3" /> Chưa giao
                    </span>
                  );
                })()}
              </div>

              {(() => {
                const collabs = (parentMetrics && parentMetrics.collaboratorAccounts.length > 0)
                  ? parentMetrics.collaboratorAccounts
                  : (t.supporterAccounts || []);
                return collabs.length > 0 ? (
                  <TaskSupportersBadge
                    supporterAccounts={collabs}
                    users={users}
                    primaryAssignee={t.assigneeAccount || t.subtaskReviewerAccount}
                    currentViewingAccount={forAccount}
                    size="xs"
                  />
                ) : null;
              })()}
            </div>

            {/* Effort */}
            <div className="text-right">
              <span className="text-[11px] text-slate-400 dark:text-slate-400 mr-1">Effort:</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                {(() => {
                  const currentEffort = forAccount
                    ? getMemberTaskEffort(t, forAccount)
                    : (isReported ? displayActual : (displayActual > 0 ? displayActual : displayEst));
                  return `${currentEffort}h`;
                })()}
              </span>
              {displayEst !== undefined && (
                <span className="text-[10px] text-slate-400 ml-1 font-mono">
                  (est: {displayEst}h)
                </span>
              )}
              {accEffort.hasMultiWeekHistory && (
                <div className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  (Tổng: {accEffort.totalEffort}h)
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Tiến độ</span>
              <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{displayPct}%</span>
            </div>
            <div className="w-full bg-slate-200/80 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  displayPct === 100
                    ? 'bg-emerald-500'
                    : displayPct > 0
                    ? 'bg-blue-500'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
                style={{ width: `${displayPct}%` }}
              />
            </div>
          </div>

          {/* End Date row */}
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 dark:text-slate-400">Hạn chót (End Date):</span>
            {hasEndDate ? (
              isOverdue ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold font-mono bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                  <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
                  {formatDateOnlyDisplay(t.endDate)} (Quá hạn)
                </span>
              ) : isDueToday ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold font-mono bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                  {formatDateOnlyDisplay(t.endDate)} (Hôm nay)
                </span>
              ) : isTaskDone ? (
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {formatDateOnlyDisplay(t.endDate)}
                </span>
              ) : (
                <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {formatDateOnlyDisplay(t.endDate)}
                </span>
              )
            ) : (
              <span className="text-xs font-mono text-slate-400 dark:text-slate-500">-</span>
            )}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 gap-2">
          {/* Discussion Button */}
          <button
            onClick={() => {
              markNoteAsRead(t.id, t.notes);
              setDiscussingTask(t);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer ${
              unread
                ? 'bg-amber-400 text-amber-950 font-bold ring-2 ring-amber-300 animate-pulse'
                : t.notes
                ? 'bg-amber-50 dark:bg-slate-800 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-slate-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Thảo luận</span>
            {unread && <span className="w-2 h-2 rounded-full bg-red-500" />}
          </button>

          <div className="flex items-center gap-1.5">
            <TaskShareButton task={t} variant="icon" align="left" />

            {/* Quick Add Subtask Button */}
            {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || isUserAdminOrPM(currentUser)) && !isNestedSubtask && (
              <button
                onClick={() => onOpenTaskModal?.(undefined, t.weekNumber || selectedWeek, undefined, t.role, t)}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 rounded-xl transition shadow-2xs active:scale-95 cursor-pointer"
                title="Thêm Subtask trực thuộc cho task này"
              >
                <CornerDownRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Edit Button */}
            {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || isUserAdminOrPM(currentUser)) && (
              <button
                onClick={() => onOpenTaskModal?.(t)}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition shadow-2xs active:scale-95 cursor-pointer"
                title="Chỉnh sửa task"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete Button */}
            {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || isUserAdminOrPM(currentUser)) && (
              <button
                onClick={() => {
                  confirmDialog({
                    title: 'Xác nhận xóa đầu việc',
                    message: `Bạn có chắc chắn muốn xóa đầu việc "${t.title}"?`,
                    confirmText: 'Xác nhận xóa',
                    type: 'danger',
                    onConfirm: () => deleteTask(t.id),
                  });
                }}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950 text-slate-400 hover:text-red-600 rounded-xl transition shadow-2xs active:scale-95 cursor-pointer"
                title="Xóa task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Báo cáo Button (For Assignee) */}
            {isAssignedToMe && (
              <button
                onClick={() => setReportingTask(t)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer ${
                  isReported
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20'
                    : isReportWindowOpen
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20'
                    : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{isReported ? 'Đã báo cáo' : isReportWindowOpen ? 'Báo cáo' : 'Cập nhật'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Dynamic Floating Sticky Role Bar (Option 2 - Linear / Notion style) */}
      {subTab === 'ALL_TASKS' && groupedTasksByRole.length > 0 && (
        <div
          className={`fixed top-3 sm:top-4 left-0 right-0 z-40 flex justify-center px-3 transition-all duration-300 ease-out transform ${
            showFloatingRoleBar && activeRoleInView
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto visible'
              : 'opacity-0 scale-90 -translate-y-3 pointer-events-none invisible'
          }`}
          aria-hidden={!showFloatingRoleBar}
        >
          <div
            className={`${
              showFloatingRoleBar && activeRoleInView ? 'pointer-events-auto' : 'pointer-events-none'
            } bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/90 shadow-xl shadow-slate-900/10 dark:shadow-black/50 rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2 sm:gap-3 w-fit max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-3rem)] overflow-x-auto no-scrollbar transition-transform duration-300 ease-out`}
          >
            {/* Active Role Indicator */}
            {(() => {
              const activeGroup =
                groupedTasksByRole.find((g) => g.role === activeRoleInView) || groupedTasksByRole[0];
              if (!activeGroup) return null;
              const cfg = getRoleConfig(activeGroup.role);
              const groupTotalEst =
                Math.round(
                  activeGroup.tasks.reduce((sum, item) => sum + (item.estimatedEffort || 0), 0) * 100
                ) / 100;
              const groupTotalActual =
                Math.round(
                  activeGroup.tasks.reduce((sum, item) => sum + (item.actualEffort || 0), 0) * 100
                ) / 100;
              const displayEffort = activeGroup.tasks.some((item) => !!item.lastSubmittedAt)
                ? groupTotalActual
                : groupTotalEst;

              return (
                <div
                  key={`active-role-indicator-${activeGroup.role}`}
                  className="flex items-center gap-2 shrink-0 pr-1 animate-role-blur"
                >
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-black border transition-colors ${cfg.badgeBg}`}
                  >
                    {activeGroup.role}
                  </span>
                  <div className="hidden sm:flex flex-col">
                    <span className={`text-xs font-bold ${cfg.text} leading-tight truncate max-w-[200px]`}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {activeGroup.tasks.length} đầu việc •{' '}
                      <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                        {displayEffort}h
                      </strong>
                    </span>
                  </div>
                  <span className="sm:hidden text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    {activeGroup.tasks.length} task •{' '}
                    <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                      {displayEffort}h
                    </strong>
                  </span>
                </div>
              );
            })()}

            {/* Subtle Vertical Divider */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" />

            {/* Quick Role Switcher Pills */}
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
              {groupedTasksByRole.map((group) => {
                const isActive = group.role === activeRoleInView;
                return (
                  <button
                    key={`quick-role-${group.role}`}
                    onClick={() => scrollToRole(group.role)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all duration-200 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 ring-2 ring-indigo-400/30'
                        : 'bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                    title={`Nhảy tới nhóm ${group.role}`}
                  >
                    <span>{group.role}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                        isActive
                          ? 'bg-indigo-700/80 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {group.tasks.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Subtle Vertical Divider */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" />

            {/* Quick Scroll to Top button on floating bar */}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 bg-slate-100/90 hover:bg-indigo-50/80 dark:bg-slate-800/90 dark:hover:bg-indigo-950/40 border border-slate-200/60 dark:border-slate-700/60 transition-all duration-200 active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
              title="Cuộn lên đầu trang"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lên đầu</span>
            </button>
          </div>
        </div>
      )}

      {/* Header & Sub-tabs Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                <span className="sm:hidden">Work Schedules</span>
                <span className="hidden sm:inline">Work Schedules (Bảng Công Việc Chi Tiết)</span>
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {filteredTasks.length} đầu việc
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quản lý tiến độ, giờ làm thực tế (Effort) và trao đổi ghi chú với Leader.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* AI Weekly Summary Button for Allowed Accounts */}
            {isUserAllowedAI(currentUser, 'weeklyReport') && (
              <button
                type="button"
                onClick={() => setIsAIWeeklySummaryOpen(true)}
                className="group relative inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all duration-200 active:scale-95 cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 border border-purple-400/30 dark:border-purple-300/30 tracking-tight"
                title={`Sử dụng AI Gemini để phân tích toàn bộ tiến độ, hiệu suất và rủi ro Tuần ${selectedWeek}`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-200 group-hover:text-white transition-colors animate-pulse" />
                <span>AI Báo Cáo Tuần {selectedWeek}</span>
              </button>
            )}

            {/* Quick Rollback Button for Admin/PO if current week is finalized */}
            {(isUserAdminOrPM(currentUser) || currentUser?.specializations?.includes('PO')) &&
              weeklyArchives.some((a) => a.weekNumber === selectedWeek && (a.year || 2026) === selectedYear) && (
                <button
                  type="button"
                  onClick={() => rollbackWeekArchive(selectedWeek, selectedYear)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer"
                  title={`Rollback / Hoàn tác chốt Tuần ${selectedWeek}, khôi phục lại toàn bộ dữ liệu task để kiểm tra lại`}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Rollback Chốt Tuần {selectedWeek}</span>
                </button>
              )}
          </div>
        </div>

        {/* Navigation Sub-Tabs Switcher */}
        <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 w-full sm:w-fit overflow-x-auto no-scrollbar gap-1">
          <button
            onClick={() => setSubTab('MY_TASKS')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 whitespace-nowrap cursor-pointer ${
              subTab === 'MY_TASKS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/50 dark:hover:bg-slate-700/60'
            }`}
          >
            <UserCheck className={`w-3.5 h-3.5 ${subTab === 'MY_TASKS' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span>Task Của Tôi</span>
          </button>
          <button
            onClick={() => setSubTab('ALL_TASKS')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 whitespace-nowrap cursor-pointer ${
              subTab === 'ALL_TASKS'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/50 dark:hover:bg-slate-700/60'
            }`}
          >
            <Globe className={`w-3.5 h-3.5 ${subTab === 'ALL_TASKS' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span>Tất Cả Công Việc</span>
          </button>
          {isSunday && (
            <button
              onClick={() => setSubTab('DEFINE_NEXT_WEEK')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 whitespace-nowrap cursor-pointer ${
                subTab === 'DEFINE_NEXT_WEEK'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <CalendarPlus className={`w-3.5 h-3.5 ${subTab === 'DEFINE_NEXT_WEEK' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
              <span className="sm:hidden">Define Tuần {selectedWeek + 1}</span>
              <span className="hidden sm:inline">Define Tuần {selectedWeek + 1}</span>
            </button>
          )}
        </div>
      </div>

      {subTab === 'DEFINE_NEXT_WEEK' && isSunday ? (
        <NextWeekDefineView onOpenTaskModal={(t, w, a) => onOpenTaskModal?.(t, w, a)} />
      ) : (
        <>
          {/* Filter Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-5 shadow-sm space-y-3">
            {/* MOBILE COMPACT SEARCH & FILTER BUTTON ROW (< sm) */}
            <div className="flex sm:hidden items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm kiếm task..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Round Filter Button */}
              <button
                onClick={() => setIsMobileFilterOpen(true)}
                className={`relative w-9 h-9 rounded-xl flex items-center justify-center border transition-all shrink-0 cursor-pointer active:scale-95 ${
                  activeFilterCount > 0
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                }`}
                title="Mở bộ lọc tìm kiếm"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* DESKTOP INLINE FILTER GRID (>= sm) */}
            <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {/* Search */}
              <div className="relative col-span-1 md:col-span-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm kiếm task..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              {/* Role Filter */}
              <div className="w-full">
                <Dropdown
                  value={selectedRole}
                  onChange={handleRoleChange}
                  options={roleOptions}
                  className="w-full"
                  buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-200"
                />
              </div>

              {/* Account Filter */}
              {subTab === 'ALL_TASKS' && (
                <div className="w-full">
                  <Dropdown
                    value={selectedAccount}
                    onChange={setSelectedAccount}
                    options={accountOptions}
                    className="w-full"
                    buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-200"
                  />
                </div>
              )}

              {/* Milestone Filter */}
              <div className="w-full">
                <Dropdown
                  value={selectedMilestone}
                  onChange={setSelectedMilestone}
                  options={milestoneOptions}
                  className="w-full"
                  buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-200"
                />
              </div>

              {/* Status Filter */}
              <div className="w-full">
                <Dropdown
                  value={selectedStatus}
                  onChange={(val) => setSelectedStatus(val as TaskStatus | 'ALL')}
                  options={statusOptions}
                  className="w-full"
                  buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Task List Container (Observed by tableContainerRef for Floating Bar detection) */}
          <div ref={tableContainerRef} className="space-y-4">
            {/* DESKTOP VIEW: Table Grid */}
            {(deviceType === 'desktop' || deviceType === 'all') && (
              <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4 w-12 text-center">STT</th>
                        <th className="py-3.5 px-4 min-w-[280px]">Task Name (Bấm xem chi tiết)</th>
                        <th className="py-3.5 px-3 w-24">Role</th>
                        <th className="py-3.5 px-3 w-24 text-center">Effort (h)</th>
                        <th className="py-3.5 px-3 w-28 text-center">Status</th>
                        <th className="py-3.5 px-3 w-36">Account</th>
                        <th className="py-3.5 px-3 w-36">Tiến độ (%)</th>
                        <th className="py-3.5 px-3 w-36 text-center">End Date</th>
                        <th className="py-3.5 px-4 min-w-[130px] w-36 text-right">Thao tác</th>
                      </tr>
                    </thead>

                    {filteredTasks.length === 0 ? (
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400">
                            {subTab === 'MY_TASKS'
                              ? 'Bạn chưa được phân công đầu việc nào phù hợp với bộ lọc.'
                              : 'Không tìm thấy đầu việc nào phù hợp.'}
                          </td>
                        </tr>
                      </tbody>
                    ) : subTab === 'ALL_TASKS' ? (
                      displayedRoleGroups.map((group) => {
                        const cfg = group.cfg;
                        const groupTotalEst = group.groupTotalEst;
                        const groupTotalActual = group.groupTotalActual;
                        const totalRoleTaskCount = group.accountGroups.reduce((acc, ag) => acc + ag.accTasks.length, 0);

                        return (
                          <tbody key={`role-group-${group.role}`} className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {/* Role Section Header */}
                            <tr id={`role-section-${group.role}`} className="scroll-mt-20 select-none">
                              <td colSpan={9} className={`py-2.5 px-4 ${cfg.bg} border-y ${cfg.border} shadow-2xs`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${cfg.badgeBg}`}>
                                    {group.role}
                                  </span>
                                  <span className={`text-xs font-bold ${cfg.text} tracking-tight`}>
                                    {cfg.label}
                                  </span>
                                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold bg-white/90 dark:bg-slate-800/90 px-2 py-0.5 rounded-full border border-slate-200/70 dark:border-slate-700">
                                    {totalRoleTaskCount} đầu việc
                                  </span>
                                  {group.unassignedMembers.length > 0 && (
                                    <RoleUnassignedMembersTag
                                      roleCode={group.role}
                                      roleLabel={cfg.label}
                                      unassignedUsers={group.unassignedMembers}
                                      unassignedTasksCount={group.unassignedTasks.length}
                                      selectedWeek={selectedWeek}
                                      selectedYear={selectedYear}
                                      canManage={canManageRoleGroup(group.role)}
                                      onOpenAssignModal={(targetUser) => {
                                        setAssigningMember({
                                          user: targetUser,
                                          roleCode: group.role,
                                          roleLabel: cfg.label,
                                          unassignedTasks: group.unassignedTasks,
                                        });
                                      }}
                                    />
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                                    Tổng Effort:{' '}
                                    <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                      {groupTotalActual > 0 ? groupTotalActual : groupTotalEst}h
                                    </strong>
                                    {groupTotalActual > 0 && groupTotalActual !== groupTotalEst && (
                                      <span className="text-slate-400 dark:text-slate-400 font-mono ml-1">
                                        (est: {groupTotalEst}h)
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Group Tasks by Account */}
                          {group.accountGroups.map((accGroup, accIdx) => (
                            <React.Fragment key={`acc-group-${group.role}-${accGroup.acc || 'unassigned'}`}>
                              {accIdx > 0 && (
                                <tr className="h-4 bg-slate-50/60 dark:bg-slate-900/90 border-y border-slate-100/80 dark:border-slate-800 select-none">
                                  <td colSpan={9} className="h-4 p-0 border-0 bg-slate-50/60 dark:bg-slate-900/90"></td>
                                </tr>
                              )}
                              {accGroup.rootAccTasks.map((t) => {
                                const displayIdx = taskSttMap.get(t.id) || 1;
                                const visibleSubtasks = accGroup.visibleSubtasksMap.get(t.id) || [];
                                const isCollapsed = collapsedParentIds.has(t.id);
                                return (
                                  <React.Fragment key={t.id}>
                                    {renderTaskRow(t, displayIdx, accGroup.acc || undefined, false, visibleSubtasks.length > 0)}
                                    {!isCollapsed &&
                                      visibleSubtasks.map((st) =>
                                        renderTaskRow(st, displayIdx, accGroup.acc || undefined, true)
                                      )}
                                  </React.Fragment>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </tbody>
                      );
                    })
                  ) : (
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {displayedMyTasks.map((t, idx) => {
                        const displayIdx = taskSttMap.get(t.id) || (idx + 1);
                        const visibleSubtasks = preparedScheduleData.myTasks?.visibleSubtasksMap.get(t.id) || [];
                        const isCollapsed = collapsedParentIds.has(t.id);
                        return (
                          <React.Fragment key={t.id}>
                            {renderTaskRow(t, displayIdx, currentUser?.account, false, visibleSubtasks.length > 0)}
                            {!isCollapsed &&
                              visibleSubtasks.map((st) =>
                                renderTaskRow(st, displayIdx, currentUser?.account, true)
                              )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  )}

                  {/* Table Footer Totals */}
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200 text-slate-700 font-semibold">
                      <td colSpan={3} className="py-3 px-4 text-right uppercase text-[10px] tracking-wider text-slate-500">
                        Tổng Cộng ({filteredTasks.length} task):
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-indigo-600 font-bold">
                        {filteredTasks.some((t) => !!t.lastSubmittedAt)
                          ? `${totalActualEffort}h`
                          : `${totalEstimatedEffort}h`}
                        {filteredTasks.some((t) => !!t.lastSubmittedAt) &&
                          totalActualEffort !== totalEstimatedEffort && (
                            <span className="text-[10px] text-slate-400 font-normal ml-1 font-mono">
                              (est: {totalEstimatedEffort}h)
                            </span>
                          )}
                      </td>
                      <td colSpan={5}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            )}

          {/* MOBILE VIEW: Card List */}
          {(deviceType === 'mobile' || deviceType === 'all') && (
            <div className="md:hidden space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs">
                  {subTab === 'MY_TASKS'
                    ? 'Bạn chưa được phân công đầu việc nào phù hợp với bộ lọc.'
                    : 'Không tìm thấy đầu việc nào phù hợp.'}
                </div>
              ) : subTab === 'ALL_TASKS' ? (
                displayedRoleGroups.map((group) => {
                  const cfg = group.cfg;
                  const groupTotalEst = group.groupTotalEst;
                  const groupTotalActual = group.groupTotalActual;
                  const totalRoleTaskCount = group.accountGroups.reduce((acc, ag) => acc + ag.accTasks.length, 0);

                  return (
                    <div key={`mobile-role-${group.role}`} className="space-y-2.5">
                      {/* Mobile Role Group Header */}
                      <div
                        id={`mobile-role-section-${group.role}`}
                        className={`scroll-mt-16 ${cfg.bg} border ${cfg.border} p-2.5 sm:p-3 rounded-2xl flex items-center justify-between shadow-2xs gap-2 flex-wrap`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${cfg.badgeBg}`}>
                            {group.role}
                          </span>
                          <span className={`text-xs font-bold ${cfg.text} truncate`}>
                            {cfg.mobileLabel}
                          </span>
                          {group.unassignedMembers.length > 0 && (
                            <RoleUnassignedMembersTag
                              roleCode={group.role}
                              roleLabel={cfg.mobileLabel}
                              unassignedUsers={group.unassignedMembers}
                              unassignedTasksCount={group.unassignedTasks.length}
                              selectedWeek={selectedWeek}
                              selectedYear={selectedYear}
                              canManage={canManageRoleGroup(group.role)}
                              onOpenAssignModal={(targetUser) => {
                                setAssigningMember({
                                  user: targetUser,
                                  roleCode: group.role,
                                  roleLabel: cfg.label,
                                  unassignedTasks: group.unassignedTasks,
                                });
                              }}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                          <span className="bg-white/90 dark:bg-slate-800 px-2.5 py-0.5 rounded-full font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 whitespace-nowrap">
                            {totalRoleTaskCount} task
                          </span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            {groupTotalActual > 0 ? groupTotalActual : groupTotalEst}h
                          </span>
                        </div>
                      </div>

                      {/* Account Subgroups / Task Cards */}
                      <div className="space-y-2.5">
                        {group.accountGroups.map((accGroup) => (
                          <div key={`mobile-acc-${group.role}-${accGroup.acc || 'unassigned'}`} className="space-y-2">
                            {group.accountGroups.length > 1 && (
                              <div className="flex items-center gap-2 pt-1">
                                {!accGroup.acc ? (
                                  <span className="text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                                    👤 Chưa giao ({accGroup.accTasks.length})
                                  </span>
                                ) : (
                                  <span className={`text-[11px] font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 ${getUserRoleColorClass(accGroup.accRole)}`}>
                                    👤 {accGroup.acc} ({accGroup.accTasks.length})
                                  </span>
                                )}
                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                              </div>
                            )}
                            {accGroup.rootAccTasks.map((t) => {
                              const displayIdx = taskSttMap.get(t.id) || 1;
                              const visibleSubtasks = accGroup.visibleSubtasksMap.get(t.id) || [];
                              const isCollapsed = collapsedParentIds.has(t.id);
                              return (
                                <React.Fragment key={t.id}>
                                  {renderMobileTaskCard(t, displayIdx, accGroup.acc || undefined, false, visibleSubtasks.length > 0)}
                                  {!isCollapsed && visibleSubtasks.length > 0 && (
                                    <div className="pl-3 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-2 mt-1">
                                      {visibleSubtasks.map((st) =>
                                        renderMobileTaskCard(st, displayIdx, accGroup.acc || undefined, true)
                                      )}
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                displayedMyTasks.map((t, idx) => {
                  const displayIdx = taskSttMap.get(t.id) || (idx + 1);
                  const visibleSubtasks = preparedScheduleData.myTasks?.visibleSubtasksMap.get(t.id) || [];
                  const isCollapsed = collapsedParentIds.has(t.id);
                  return (
                    <React.Fragment key={t.id}>
                      {renderMobileTaskCard(t, displayIdx, currentUser?.account, false, visibleSubtasks.length > 0)}
                      {!isCollapsed && visibleSubtasks.length > 0 && (
                        <div className="pl-3 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-2 mt-1">
                          {visibleSubtasks.map((st) =>
                            renderMobileTaskCard(st, displayIdx, currentUser?.account, true)
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              )}

              {/* Mobile Summary Card */}
              {filteredTasks.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Tổng cộng ({filteredTasks.length} task):
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      {filteredTasks.some((t) => !!t.lastSubmittedAt) ? `${totalActualEffort}h` : `${totalEstimatedEffort}h`}
                    </span>
                    {filteredTasks.some((t) => !!t.lastSubmittedAt) && totalActualEffort !== totalEstimatedEffort && (
                      <span className="text-[10px] text-slate-400 font-normal ml-1 font-mono">
                        (est: {totalEstimatedEffort}h)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progressive Loading Sentinel Indicator */}
          {hasMoreItems && (
            <div
              ref={sentinelRef}
              className="w-full py-4 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 select-none animate-pulse"
            >
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Đang hiển thị thêm công việc...</span>
              <button
                type="button"
                onClick={() => {
                  setVisibleRoleCount(preparedScheduleData.roleGroups.length);
                  setVisibleMyTasksCount(preparedScheduleData.myTasks?.rootFilteredTasks.length || 9999);
                }}
                className="ml-2 text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 font-semibold cursor-pointer"
              >
                (Tải tất cả ngay)
              </button>
            </div>
          )}
          </div>
        </>
      )}

      {/* MOBILE FILTER MODAL / BOTTOM SHEET */}
      {isFilterRendered && (
        <div
          onMouseDown={handleFilterBackdropMouseDown}
          onClick={handleFilterBackdropClick}
          className={`fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bottomsheet-backdrop-transition ${
            isFilterVisible ? 'bottomsheet-backdrop-open' : 'bottomsheet-backdrop-closed'
          }`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 bottomsheet-dialog-transition ${
              isFilterVisible ? 'bottomsheet-dialog-open' : 'bottomsheet-dialog-closed'
            }`}
          >
            {/* Drag Handle on Mobile */}
            <div className="sm:hidden w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-0.5 shrink-0" />

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Bộ Lọc Công Việc
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {activeFilterCount > 0 ? `Đang chọn ${activeFilterCount} bộ lọc` : 'Tất cả điều kiện mặc định'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseFilter}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Role Filter */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-200 block">
                  Vị Trí Chuyên Môn (Role):
                </label>
                <Dropdown
                  value={selectedRole}
                  onChange={handleRoleChange}
                  options={roleOptions}
                  className="w-full"
                  buttonClassName="py-2.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>

              {/* Account Filter (if ALL_TASKS) */}
              {subTab === 'ALL_TASKS' && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-200 block">
                    Thành Viên Phụ Trách:
                  </label>
                  <Dropdown
                    value={selectedAccount}
                    onChange={setSelectedAccount}
                    options={accountOptions}
                    className="w-full"
                    buttonClassName="py-2.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium"
                  />
                </div>
              )}

              {/* Milestone Filter */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-200 block">
                  Cột Mốc (Milestone):
                </label>
                <Dropdown
                  value={selectedMilestone}
                  onChange={setSelectedMilestone}
                  options={milestoneOptions}
                  className="w-full"
                  buttonClassName="py-2.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-200 block">
                  Trạng Thái Task:
                </label>
                <Dropdown
                  value={selectedStatus}
                  onChange={(val) => setSelectedStatus(val as TaskStatus | 'ALL')}
                  options={statusOptions}
                  className="w-full"
                  buttonClassName="py-2.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt lại
              </button>

              <button
                type="button"
                onClick={handleCloseFilter}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer active:scale-95 text-center"
              >
                Áp Dụng ({filteredTasks.length} task)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Discussion Modal (Only Notes & Stream) */}
      <TaskDiscussionModal
        task={discussingTask}
        isOpen={!!discussingTask}
        onClose={() => setDiscussingTask(null)}
        onOpenFullDetail={(t) => handleTaskClick(t)}
      />

      {/* Task Detail Modal with Notes */}
      <TaskDetailModal
        task={viewingDetailTask}
        isOpen={!!viewingDetailTask}
        onClose={() => setViewingDetailTask(null)}
        onOpenReport={(t) => setReportingTask(t)}
        onEditTask={(t) => {
          setViewingDetailTask(null);
          onOpenTaskModal?.(
            t,
            t.requestedWeekNumber || t.weekNumber,
            t.assignmentRequestedBy || t.assigneeAccount
          );
        }}
        onSelectTask={(t) => setViewingDetailTask(t)}
        onOpenCreateSubtask={(parent) => {
          setViewingDetailTask(null);
          onOpenTaskModal?.(
            undefined,
            parent.weekNumber || selectedWeek,
            undefined,
            parent.role,
            parent
          );
        }}
      />

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        ticket={viewingTicket}
        isOpen={!!viewingTicket}
        onClose={() => setViewingTicket(null)}
      />

      {/* Weekly Report Modal */}
      <WeeklyReportModal
        task={reportingTask}
        isOpen={!!reportingTask}
        onClose={() => setReportingTask(null)}
      />

      {/* Assign Task to Unassigned Member Modal */}
      {assigningMember && (
        <AssignTaskToMemberModal
          isOpen={!!assigningMember}
          targetUser={assigningMember.user}
          roleCode={assigningMember.roleCode}
          roleLabel={assigningMember.roleLabel}
          unassignedTasks={assigningMember.unassignedTasks}
          selectedWeek={selectedWeek}
          selectedYear={selectedYear}
          onClose={() => setAssigningMember(null)}
          onAssignTask={(task, user) => {
            updateTask(task.id, {
              assigneeAccount: user.account,
              weekNumber: selectedWeek,
              year: selectedYear,
            });
            setAssigningMember(null);
          }}
          onCreateNewTask={(user, roleCode) => {
            setAssigningMember(null);
            onOpenTaskModal?.(undefined, selectedWeek, user.account, roleCode);
          }}
        />
      )}

      {/* AI Executive Weekly Summary Modal */}
      <AIWeeklySummaryModal
        isOpen={isAIWeeklySummaryOpen}
        onClose={() => setIsAIWeeklySummaryOpen(false)}
        weekNumber={selectedWeek}
        year={selectedYear}
        tasks={tasks}
      />
    </div>
  );
};
