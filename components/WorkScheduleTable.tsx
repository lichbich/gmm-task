'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus, Specialization, Milestone } from '../types/task';
import { WeeklyReportModal } from './WeeklyReportModal';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskDiscussionModal } from './TaskDiscussionModal';
import {
  Search,
  Plus,
  Edit2,
  AlertTriangle,
  Award,
  Clock,
  UserCheck,
  Globe,
  Lock,
  MessageSquare,
  UserX,
  Flag,
  FolderOpen,
  Trash2,
  FileText,
  Flame,
  CalendarPlus,
  SlidersHorizontal,
  RotateCcw,
  X,
} from 'lucide-react';
import { Dropdown, DropdownOption } from './common/Dropdown';
import { NextWeekDefineView } from './NextWeekDefineView';
import { getWeekDeadline, getWeekSundayNoon } from './WorkHistoryView';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface WorkScheduleTableProps {
  onOpenTaskModal?: (task?: Task, defaultWeek?: number, defaultAssignee?: string) => void;
}

export const WorkScheduleTable: React.FC<WorkScheduleTableProps> = ({ onOpenTaskModal }) => {
  const {
    tasks,
    users,
    milestones,
    currentUser,
    weeklyAwards,
    canReportTask,
    deleteTask,
    confirmDialog,
    hasUnreadNote,
    markNoteAsRead,
    roles,
    selectedWeek,
    selectedYear,
    simulatedTime,
    weeklyArchives,
  } = useApp();

  // Sub-tabs state: ALWAYS DEFAULT to 'MY_TASKS' when accessing
  const [subTab, setSubTab] = useState<'MY_TASKS' | 'ALL_TASKS' | 'DEFINE_NEXT_WEEK'>('MY_TASKS');

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
  const [discussingTask, setDiscussingTask] = useState<Task | null>(null);

  // Force default 'MY_TASKS' on component mount
  useEffect(() => {
    setSubTab('MY_TASKS');
  }, []);

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
      const currentRoleCode = roleCode.toLowerCase();

      // 1. Check specializations match
      const hasSpecMatch = (u.specializations || []).some((spec: string) => {
        const s = spec.toLowerCase();
        return s === currentRoleCode || s.includes(currentRoleCode) || currentRoleCode.includes(s);
      });
      if (hasSpecMatch) return true;

      // 2. Check if user has any tasks assigned under this role
      const hasTaskInRole = tasks.some(
        (t) =>
          t.role?.toLowerCase() === currentRoleCode &&
          t.assigneeAccount?.toLowerCase() === u.account.toLowerCase()
      );
      if (hasTaskInRole) return true;

      return false;
    },
    [tasks]
  );

  const isMilestoneInRole = useCallback(
    (m: Milestone, roleCode: string): boolean => {
      if (!roleCode || roleCode === 'ALL') return true;
      const currentRoleCode = roleCode.toLowerCase();

      // 1. Check if milestone role matches
      if (m.role) {
        const mRole = m.role.toLowerCase();
        if (
          mRole === 'all' ||
          mRole === currentRoleCode ||
          mRole.includes(currentRoleCode) ||
          currentRoleCode.includes(mRole)
        ) {
          return true;
        }
      }

      // 2. Check if any task in this milestone has the target role
      const hasTaskInRole = tasks.some(
        (t) => t.milestoneId === m.id && t.role?.toLowerCase() === currentRoleCode
      );
      if (hasTaskInRole) return true;

      return false;
    },
    [tasks]
  );

  const roleOptions: DropdownOption[] = [
    { value: 'ALL', label: 'Tất cả Role' },
    ...roles.map((r) => ({
      value: r.code,
      label: `${r.code} (${r.name})`,
    })),
  ];

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
    const idxA = tasks.findIndex((item) => item.id === a.id);
    const idxB = tasks.findIndex((item) => item.id === b.id);
    return idxA - idxB;
  };

  // Filter & Sort Tasks by Priority (High -> Medium -> Low)
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Only show tasks belonging to current selected week & year
        if (t.weekNumber !== selectedWeek || (t.year && t.year !== selectedYear)) {
          return false;
        }

        // Sub-tab filter: My Tasks default
        if (subTab === 'MY_TASKS') {
          if (!currentUser || !t.assigneeAccount || t.assigneeAccount.toLowerCase() !== currentUser.account.toLowerCase()) {
            return false;
          }
        }

        // Sub-tab filter: All Tasks only shows assigned tasks (tasks with an assignee)
        if (subTab === 'ALL_TASKS') {
          if (!t.assigneeAccount || !t.assigneeAccount.trim()) {
            return false;
          }
        }

        if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (selectedRole !== 'ALL' && t.role !== selectedRole) return false;
        if (selectedAccount !== 'ALL' && t.assigneeAccount !== selectedAccount) return false;
        if (selectedMilestone === 'NO_MILESTONE') {
          if (t.milestoneId && milestones.some((m) => m.id === t.milestoneId)) return false;
        } else if (selectedMilestone !== 'ALL') {
          if (t.milestoneId !== selectedMilestone) return false;
        }
        if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
        return true;
      })
      .sort(sortByPriority);
  }, [tasks, selectedWeek, selectedYear, subTab, currentUser, searchQuery, selectedRole, selectedAccount, selectedMilestone, selectedStatus, milestones]);

  const ROLE_ORDER: Specialization[] = roles.map((r) => r.code);

  const getRoleConfig = (roleCode: string) => {
    const rObj = roles.find((r) => r.code === roleCode);
    const color = rObj?.color || 'indigo';

    // Rút gọn tên chuyên môn cho mobile (bỏ phần chú thích tiếng Việt dài dòng)
    let cleanMobileName = rObj ? rObj.name : roleCode;
    cleanMobileName = cleanMobileName
      .replace(/\s*\([^)]*(Nghiệp vụ|Thiết kế|Kiểm thử|Lập trình|Vận hành|Hạ tầng|Phân tích|FE|BE)[^)]*\)/gi, '')
      .trim();

    const desktopLabel = rObj ? `${rObj.code} (${rObj.name})` : `${roleCode} Team`;
    const mobileLabel = cleanMobileName || roleCode;

    const colorClasses: Record<string, { bg: string; text: string; badgeBg: string; border: string }> = {
      purple: {
        bg: 'bg-purple-50/75 dark:bg-purple-950/50',
        text: 'text-purple-900 dark:text-purple-200',
        badgeBg: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/60 dark:text-purple-300 dark:border-purple-700',
        border: 'border-purple-200/80 dark:border-purple-900/40',
      },
      amber: {
        bg: 'bg-amber-50/75 dark:bg-amber-950/50',
        text: 'text-amber-900 dark:text-amber-200',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700',
        border: 'border-amber-200/80 dark:border-amber-900/40',
      },
      blue: {
        bg: 'bg-blue-50/75 dark:bg-blue-950/50',
        text: 'text-blue-900 dark:text-blue-200',
        badgeBg: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/60 dark:text-blue-300 dark:border-blue-700',
        border: 'border-blue-200/80 dark:border-blue-900/40',
      },
      emerald: {
        bg: 'bg-emerald-50/75 dark:bg-emerald-950/50',
        text: 'text-emerald-900 dark:text-emerald-200',
        badgeBg: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-700',
        border: 'border-emerald-200/80 dark:border-emerald-900/40',
      },
      rose: {
        bg: 'bg-rose-50/75 dark:bg-rose-950/50',
        text: 'text-rose-900 dark:text-rose-200',
        badgeBg: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/60 dark:text-rose-300 dark:border-rose-700',
        border: 'border-rose-200/80 dark:border-rose-900/40',
      },
      indigo: {
        bg: 'bg-indigo-50/75 dark:bg-indigo-950/50',
        text: 'text-indigo-900 dark:text-indigo-200',
        badgeBg: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/60 dark:text-indigo-300 dark:border-indigo-700',
        border: 'border-indigo-200/80 dark:border-indigo-900/40',
      },
      cyan: {
        bg: 'bg-cyan-50/75 dark:bg-cyan-950/50',
        text: 'text-cyan-900 dark:text-cyan-200',
        badgeBg: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/60 dark:text-cyan-300 dark:border-cyan-700',
        border: 'border-cyan-200/80 dark:border-cyan-900/40',
      },
      slate: {
        bg: 'bg-slate-100/75 dark:bg-slate-900/90',
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

    filteredTasks.forEach((t) => {
      const list = roleMap.get(t.role);
      if (list) {
        list.push(t);
      } else {
        const existing = roleMap.get(t.role) || [];
        existing.push(t);
        roleMap.set(t.role, existing);
      }
    });

    roleMap.forEach((tasksInRole, role) => {
      if (tasksInRole.length > 0) {
        groups.push({ role, tasks: [...tasksInRole].sort(sortByPriority) });
      }
    });

    return groups;
  }, [filteredTasks]);

  const totalEstimatedEffort =
    Math.round(filteredTasks.reduce((acc, t) => acc + (t.estimatedEffort || 0), 0) * 100) / 100;
  const totalActualEffort =
    Math.round(filteredTasks.reduce((acc, t) => acc + (t.actualEffort || 0), 0) * 100) / 100;

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
      case 'Design':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/80';
      case 'FE':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800/80';
      case 'BE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/80';
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

  // Reusable task row renderer
  const renderTaskRow = (t: Task, displayIdx: number) => {
    const isWeekFinalized = weeklyArchives.some(
      (a) => a.weekNumber === (t.weekNumber || selectedWeek) && a.year === (t.year || selectedYear)
    );
    const isTopEffort = isWeekFinalized && isTopEffortAccount(t.assigneeAccount);
    const sundayNoon = getWeekSundayNoon(t.weekNumber || selectedWeek, t.year || selectedYear);
    const deadline = getWeekDeadline(t.weekNumber || selectedWeek, t.year || selectedYear);
    const nowTime = new Date(simulatedTime).getTime();
    const isPastDeadline = nowTime > deadline.getTime();
    const isReportWindowOpen = nowTime >= sundayNoon.getTime();

    const isTaskDone = t.status === 'Done' || t.completionPercentage === 100;
    // A task is officially reported if it is Done 100% OR submitted at/after Sunday 12:00 PM of that week
    const isReported =
      isTaskDone ||
      (!!t.lastSubmittedAt &&
        new Date(t.lastSubmittedAt).getTime() >= sundayNoon.getTime());

    const isUnsubmittedLate = isWeekFinalized && !isReported && isPastDeadline && !!t.assigneeAccount;
    const isSubmittedLate = isWeekFinalized && isReported && !isTaskDone && !!t.isSubmittedLate;
    const isLate = isSubmittedLate || isUnsubmittedLate;
    const isAssignedToMe = canReportTask(t);
    const hasAlert = isLate || isTopEffort;

    return (
      <tr
        key={t.id}
        onClick={() => {
          if (t.notes) markNoteAsRead(t.id, t.notes);
          setViewingDetailTask(t);
        }}
        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/70 transition cursor-pointer group ${
          isLate
            ? 'bg-red-50/50 dark:bg-red-950/30'
            : isTopEffort
            ? 'bg-emerald-50/50 dark:bg-emerald-950/30'
            : ''
        }`}
      >
        {/* STT */}
        <td className="py-3 px-4 text-center text-slate-400 dark:text-slate-400 font-mono font-medium">
          {displayIdx}
        </td>

        {/* Task Name: Clean & minimal, identical layout for all rows */}
        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-100">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="line-clamp-2 font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                {t.title}
              </span>
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
                const milestone = milestones.find((m) => m.id === t.milestoneId);
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
            {isReported ? (
              <>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {t.actualEffort ?? t.estimatedEffort}h
                </span>
                {t.actualEffort !== undefined && t.actualEffort !== t.estimatedEffort && (
                  <span className="text-[9px] text-slate-400 dark:text-slate-400">
                    est: {t.estimatedEffort}h
                  </span>
                )}
              </>
            ) : t.actualEffort !== undefined && t.actualEffort > 0 ? (
              <>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t.actualEffort}h
                </span>
                {t.actualEffort !== t.estimatedEffort && (
                  <span className="text-[9px] text-slate-400 dark:text-slate-400">
                    est: {t.estimatedEffort}h
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t.estimatedEffort}h
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500">
                  (est)
                </span>
              </>
            )}
          </div>
        </td>

        {/* Status */}
        <td className="py-3 px-3 text-center">
          <span
            className={`inline-block whitespace-nowrap px-3 py-1 text-[11px] font-semibold rounded-full border ${getStatusBadge(
              t.status
            )}`}
          >
            {t.status}
          </span>
        </td>

        {/* Account */}
        <td className="py-3 px-3 font-medium">
          {t.assigneeAccount ? (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-[9px] font-bold text-indigo-600 dark:text-indigo-300">
                {t.assigneeAccount.slice(0, 2)}
              </div>
              <span className="text-slate-700 dark:text-slate-200">{t.assigneeAccount}</span>
            </div>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
              <UserX className="w-3.5 h-3.5" /> Task trống
            </span>
          )}
        </td>

        {/* Completion Progress Bar */}
        <td className="py-3 px-3">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500 font-medium">{t.completionPercentage}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-300 ${
                  t.completionPercentage === 100
                    ? 'bg-emerald-500'
                    : t.completionPercentage > 0
                    ? 'bg-indigo-600'
                    : 'bg-slate-300'
                }`}
                style={{ width: `${t.completionPercentage}%` }}
              />
            </div>
          </div>
        </td>

        {/* Alert Status (Clean: Blank if no alert exists) */}
        <td className="py-3 px-3 text-center">
          {hasAlert ? (
            <div className="flex items-center justify-center gap-1 flex-wrap">
              {isUnsubmittedLate && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-[10px] font-bold rounded-full animate-pulse"
                  title="Chưa nộp báo cáo quá hạn 22:00 Chủ Nhật (Bị phạt)"
                >
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  PHẠT (Chưa BC)
                </span>
              )}
              {!isUnsubmittedLate && isSubmittedLate && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-full"
                  title="Báo cáo nộp sau 22:00 Chủ Nhật (Bị phạt)"
                >
                  <Clock className="w-3 h-3 text-amber-600" />
                  PHẠT (Nộp muộn)
                </span>
              )}
              {isTopEffort && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full"
                  title="Người có tổng giờ làm nhiều nhất tuần (Được thưởng)"
                >
                  <Award className="w-3 h-3 text-emerald-600" />
                  THƯỞNG
                </span>
              )}
            </div>
          ) : null}
        </td>

        {/* Action Buttons */}
        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1.5">
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

            {/* ONLY RENDER BÁO CÁO BUTTON IF TASK IS ASSIGNED TO CURRENT USER! HIDE COMPLETELY FOR OTHERS */}
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

            {/* Leader/Advisor/Admin Edit & Delete Buttons */}
            {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') && (
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

  const renderMobileTaskCard = (t: Task, displayIdx: number) => {
    const isAssignedToMe =
      currentUser &&
      t.assigneeAccount &&
      t.assigneeAccount.toLowerCase() === currentUser.account.toLowerCase();

    const isWeekFinalized = weeklyArchives.some(
      (a) => a.weekNumber === (t.weekNumber || selectedWeek) && a.year === (t.year || selectedYear)
    );
    const isTopEffort = isWeekFinalized && isTopEffortAccount(t.assigneeAccount);
    const sundayNoon = getWeekSundayNoon(t.weekNumber || selectedWeek, t.year || selectedYear);
    const deadline = getWeekDeadline(t.weekNumber || selectedWeek, t.year || selectedYear);
    const nowTime = new Date(simulatedTime).getTime();
    const isPastDeadline = nowTime > deadline.getTime();
    const isReportWindowOpen = nowTime >= sundayNoon.getTime();

    const isTaskDone = t.status === 'Done' || t.completionPercentage === 100;
    const isReported =
      isTaskDone ||
      (!!t.lastSubmittedAt &&
        new Date(t.lastSubmittedAt).getTime() >= sundayNoon.getTime());

    const isUnsubmittedLate = isWeekFinalized && !isReported && isPastDeadline && !!t.assigneeAccount;
    const isSubmittedLate = isWeekFinalized && isReported && !isTaskDone && !!t.isSubmittedLate;
    const isLate = isSubmittedLate || isUnsubmittedLate;

    const unread = hasUnreadNote(t);
    const milestone = milestones.find((m) => m.id === t.milestoneId);

    return (
      <div
        key={t.id}
        className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-xs space-y-3 transition-all ${
          isTaskDone
            ? 'border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/15 dark:bg-emerald-950/10'
            : t.priority === 'High'
            ? 'border-red-200/80 dark:border-red-900/40 bg-red-50/10 dark:bg-red-950/10'
            : 'border-slate-200/90 dark:border-slate-800'
        }`}
      >
        {/* Top Header: STT, Role, Priority, Status */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              #{displayIdx}
            </span>
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

          <span className={`whitespace-nowrap px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${getStatusBadge(t.status)}`}>
            {t.status}
          </span>
        </div>

        {/* Task Title (Clickable) */}
        <div>
          <button
            onClick={() => setViewingDetailTask(t)}
            className="text-left font-bold text-slate-800 dark:text-slate-100 text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block w-full leading-snug cursor-pointer"
          >
            {t.title}
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

        {/* Stats Box: Assignee, Effort, Progress */}
        <div className="bg-slate-50/80 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            {/* Assignee */}
            <div className="flex items-center gap-1.5">
              {t.assigneeAccount ? (
                <>
                  <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
                    {t.assigneeAccount.slice(0, 2)}
                  </div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                    {t.assigneeAccount}
                  </span>
                </>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                  <UserX className="w-3 h-3" /> Chưa giao
                </span>
              )}
            </div>

            {/* Effort */}
            <div className="text-right">
              <span className="text-[11px] text-slate-400 dark:text-slate-400 mr-1">Effort:</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                {isReported ? `${t.actualEffort ?? t.estimatedEffort}h` : t.actualEffort !== undefined && t.actualEffort > 0 ? `${t.actualEffort}h` : `${t.estimatedEffort}h`}
              </span>
              {((isReported && t.actualEffort !== undefined && t.actualEffort !== t.estimatedEffort) || (!isReported && t.actualEffort !== undefined && t.actualEffort > 0 && t.actualEffort !== t.estimatedEffort)) && (
                <span className="text-[10px] text-slate-400 ml-1 font-mono">
                  (est: {t.estimatedEffort}h)
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Tiến độ</span>
              <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{t.completionPercentage}%</span>
            </div>
            <div className="w-full bg-slate-200/80 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  t.completionPercentage === 100
                    ? 'bg-emerald-500'
                    : t.completionPercentage > 0
                    ? 'bg-blue-500'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
                style={{ width: `${t.completionPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Penalty / Award Alert if any */}
        {(isLate || isTopEffort) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {isUnsubmittedLate && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-[10px] font-bold rounded-full">
                <AlertTriangle className="w-3 h-3 text-red-500" />
                PHẠT (Chưa nộp báo cáo - quá 22h CN)
              </span>
            )}
            {!isUnsubmittedLate && isSubmittedLate && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-full">
                <Clock className="w-3 h-3 text-amber-600" />
                PHẠT (Nộp muộn sau 22h CN)
              </span>
            )}
            {isTopEffort && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                <Award className="w-3 h-3 text-emerald-600" />
                THƯỞNG (Top Effort)
              </span>
            )}
          </div>
        )}

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
            {/* Edit Button */}
            {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') && (
              <button
                onClick={() => onOpenTaskModal?.(t)}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition shadow-2xs active:scale-95 cursor-pointer"
                title="Chỉnh sửa task"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete Button */}
            {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') && (
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
      {/* Header & Sub-tabs Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-4">
          <div>
            <div className="flex items-center gap-2">
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
        </div>
      </div>

      {subTab === 'DEFINE_NEXT_WEEK' ? (
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

          {/* DESKTOP VIEW: Table Grid */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-12 text-center">STT</th>
                    <th className="py-3.5 px-4 min-w-[280px]">Task Name (Bấm xem chi tiết)</th>
                    <th className="py-3.5 px-3 w-24">Role</th>
                    <th className="py-3.5 px-3 w-24 text-center">Effort (h)</th>
                    <th className="py-3.5 px-3 w-28 text-center">Status</th>
                    <th className="py-3.5 px-3 w-36">Account</th>
                    <th className="py-3.5 px-3 w-36">Tiến độ (%)</th>
                    <th className="py-3.5 px-3 w-32 text-center">Alert</th>
                    <th className="py-3.5 px-4 min-w-[130px] w-36 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        {subTab === 'MY_TASKS'
                          ? 'Bạn chưa được phân công đầu việc nào phù hợp với bộ lọc.'
                          : 'Không tìm thấy đầu việc nào phù hợp.'}
                      </td>
                    </tr>
                  ) : subTab === 'ALL_TASKS' ? (
                    groupedTasksByRole.map((group) => {
                      const cfg = getRoleConfig(group.role);
                      const groupTotalEst = group.tasks.reduce((sum, item) => sum + (item.estimatedEffort || 0), 0);
                      const groupTotalActual = group.tasks.reduce((sum, item) => sum + (item.actualEffort || 0), 0);

                      return (
                        <React.Fragment key={`role-group-${group.role}`}>
                          {/* Role Section Header */}
                          <tr className={`${cfg.bg} border-y ${cfg.border} select-none`}>
                            <td colSpan={9} className="py-2.5 px-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${cfg.badgeBg}`}>
                                    {group.role}
                                  </span>
                                  <span className={`text-xs font-bold ${cfg.text} tracking-tight`}>
                                    {cfg.label}
                                  </span>
                                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold bg-white/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-200/70 dark:border-slate-700">
                                    {group.tasks.length} đầu việc
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                                    Tổng Effort:{' '}
                                    <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                      {group.tasks.some((item) => !!item.lastSubmittedAt)
                                        ? groupTotalActual
                                        : groupTotalEst}
                                      h
                                    </strong>
                                    {group.tasks.some((item) => !!item.lastSubmittedAt) &&
                                      groupTotalActual !== groupTotalEst && (
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
                          {(() => {
                            const tasksByAccountMap = new Map<string, Task[]>();
                            group.tasks.forEach((t) => {
                              const acc = t.assigneeAccount || 'Unassigned';
                              const list = tasksByAccountMap.get(acc) || [];
                              list.push(t);
                              tasksByAccountMap.set(acc, list);
                            });

                            const accountGroups = Array.from(tasksByAccountMap.entries());

                            return accountGroups.map(([acc, accTasks], accIdx) => (
                              <React.Fragment key={`acc-group-${group.role}-${acc}`}>
                                {accIdx > 0 && (
                                  <tr className="h-4 bg-slate-50/60 dark:bg-slate-900/90 border-y border-slate-100/80 dark:border-slate-800 select-none">
                                    <td colSpan={9} className="h-4 p-0 border-0 bg-slate-50/60 dark:bg-slate-900/90"></td>
                                  </tr>
                                )}
                                {[...accTasks].sort(sortByPriority).map((t) => {
                                  const taskIdx = tasks.findIndex((item) => item.id === t.id);
                                  const displayIdx = taskIdx >= 0 ? taskIdx + 1250 : 1250;
                                  return renderTaskRow(t, displayIdx);
                                })}
                              </React.Fragment>
                            ));
                          })()}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    filteredTasks.map((t, idx) => {
                      const taskIdx = tasks.findIndex((item) => item.id === t.id);
                      const displayIdx = taskIdx >= 0 ? taskIdx + 1250 : idx + 1250;
                      return renderTaskRow(t, displayIdx);
                    })
                  )}
                </tbody>
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

          {/* MOBILE VIEW: Card List */}
          <div className="md:hidden space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs">
                {subTab === 'MY_TASKS'
                  ? 'Bạn chưa được phân công đầu việc nào phù hợp với bộ lọc.'
                  : 'Không tìm thấy đầu việc nào phù hợp.'}
              </div>
            ) : subTab === 'ALL_TASKS' ? (
              groupedTasksByRole.map((group) => {
                const cfg = getRoleConfig(group.role);
                const groupTotalEst =
                  Math.round(group.tasks.reduce((sum, item) => sum + (item.estimatedEffort || 0), 0) * 100) / 100;
                const groupTotalActual =
                  Math.round(group.tasks.reduce((sum, item) => sum + (item.actualEffort || 0), 0) * 100) / 100;

                const tasksByAccountMap = new Map<string, Task[]>();
                group.tasks.forEach((t) => {
                  const acc = t.assigneeAccount || 'Unassigned';
                  const list = tasksByAccountMap.get(acc) || [];
                  list.push(t);
                  tasksByAccountMap.set(acc, list);
                });
                const accountGroups = Array.from(tasksByAccountMap.entries());

                return (
                  <div key={`mobile-role-${group.role}`} className="space-y-2.5">
                    {/* Mobile Role Group Header */}
                    <div className={`${cfg.bg} border ${cfg.border} p-2.5 sm:p-3 rounded-2xl flex items-center justify-between shadow-2xs gap-2`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${cfg.badgeBg}`}>
                          {group.role}
                        </span>
                        <span className={`text-xs font-bold ${cfg.text} truncate`}>
                          {cfg.mobileLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                        <span className="bg-white/90 dark:bg-slate-800 px-2.5 py-0.5 rounded-full font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 whitespace-nowrap">
                          {group.tasks.length} task
                        </span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {group.tasks.some((item) => !!item.lastSubmittedAt) ? groupTotalActual : groupTotalEst}h
                        </span>
                      </div>
                    </div>

                    {/* Account Subgroups / Task Cards */}
                    <div className="space-y-2.5">
                      {accountGroups.map(([acc, accTasks]) => (
                        <div key={`mobile-acc-${group.role}-${acc}`} className="space-y-2">
                          {accountGroups.length > 1 && (
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                                👤 {acc} ({accTasks.length})
                              </span>
                              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                            </div>
                          )}
                          {[...accTasks].sort(sortByPriority).map((t) => {
                            const taskIdx = tasks.findIndex((item) => item.id === t.id);
                            const displayIdx = taskIdx >= 0 ? taskIdx + 1250 : 1250;
                            return renderMobileTaskCard(t, displayIdx);
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              filteredTasks.map((t, idx) => {
                const taskIdx = tasks.findIndex((item) => item.id === t.id);
                const displayIdx = taskIdx >= 0 ? taskIdx + 1250 : idx + 1250;
                return renderMobileTaskCard(t, displayIdx);
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
        onOpenFullDetail={(t) => setViewingDetailTask(t)}
      />

      {/* Task Detail Modal with Notes */}
      <TaskDetailModal
        task={viewingDetailTask}
        isOpen={!!viewingDetailTask}
        onClose={() => setViewingDetailTask(null)}
        onOpenReport={(t) => setReportingTask(t)}
      />

      {/* Weekly Report Modal */}
      <WeeklyReportModal
        task={reportingTask}
        isOpen={!!reportingTask}
        onClose={() => setReportingTask(null)}
      />
    </div>
  );
};
