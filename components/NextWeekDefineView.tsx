'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task, Milestone, User as UserType } from '../types/task';
import { TaskDetailModal } from './TaskDetailModal';
import { Dropdown } from './common/Dropdown';
import { getWeekDateRangeStr } from './WorkHistoryView';
import {
  ClipboardList,
  CalendarPlus,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  UserCheck,
  Flame,
  Flag,
  FolderOpen,
  Search,
  Filter,
  Info,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Trash2,
  Edit2,
  Handshake,
  Check,
  X,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';

interface NextWeekDefineViewProps {
  onOpenTaskModal: (task?: Task, defaultWeek?: number, defaultAssignee?: string) => void;
}

export const NextWeekDefineView: React.FC<NextWeekDefineViewProps> = ({ onOpenTaskModal }) => {
  const {
    tasks,
    milestones,
    selectedWeek,
    selectedYear,
    currentUser,
    roles,
    users,
    addTask,
    updateTask,
    deleteTask,
    requestTaskAssignment,
    approveTaskAssignment,
    rejectTaskAssignment,
    confirmDialog,
  } = useApp();

  const nextWeek = selectedWeek + 1;
  const nextWeekRange = getWeekDateRangeStr(nextWeek, selectedYear);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [viewingDetailTask, setViewingDetailTask] = useState<Task | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  const toggleMemberExpanded = (account: string) => {
    setExpandedMembers((prev) => ({
      ...prev,
      [account]: !prev[account],
    }));
  };

  const toggleAllMembersExpanded = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    if (expand) {
      unfinishedTasksByMember.forEach((g) => {
        newState[g.account] = true;
      });
    }
    setExpandedMembers(newState);
  };

  // Role filtering permissions
  const isLeaderOrAdmin = currentUser?.role === 'Leader' || currentUser?.role === 'Admin';
  const myRole = currentUser?.role === 'Admin' ? 'ALL' : currentUser?.specializations?.[0] || 'ALL';

  // Helper to check if a task strictly belongs to current user's team / scope
  const isTaskInMyTeamScope = (t: Task): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;

    if (currentUser.role === 'Leader') {
      const leaderSpecs = currentUser.specializations || [];
      if (leaderSpecs.length === 0) return false;

      // 1. Direct role match on task
      if (leaderSpecs.includes(t.role)) return true;

      // 2. Or assignee user belongs to leader's team specialization
      if (t.assigneeAccount) {
        const assigneeUser = users.find(
          (u) => u.account.toLowerCase() === t.assigneeAccount.toLowerCase()
        );
        if (assigneeUser && assigneeUser.specializations?.some((s) => leaderSpecs.includes(s))) {
          return true;
        }
      }
      return false;
    }

    // Member: only own tasks
    return t.assigneeAccount?.toLowerCase() === currentUser.account.toLowerCase();
  };

  // 1. Pending Assignment Requests
  const pendingRequests = React.useMemo(() => {
    return tasks.filter((t) => {
      if (t.assignmentRequestStatus !== 'PENDING') return false;
      if (currentUser?.role === 'Member') {
        // Members see their own pending requests
        return t.assignmentRequestedBy === currentUser.account;
      }
      if (currentUser?.role === 'Leader') {
        // Leader sees requests in their role / team only
        return isTaskInMyTeamScope(t);
      }
      return true; // Admin sees all
    });
  }, [tasks, currentUser, users]);

  // 1.5. Current Week / Previous Week Unfinished Tasks (Incomplete tasks that can be rolled over to next week)
  const currentWeekUnfinishedTasks = React.useMemo(() => {
    return tasks.filter((t) => {
      if (t.weekNumber > selectedWeek || t.year !== selectedYear) return false;
      if (!t.assigneeAccount || t.assigneeAccount.trim() === '') return false;
      if (t.status === 'Done') return false; // Unfinished tasks only

      if (currentUser?.role === 'Member') {
        return t.assigneeAccount?.toLowerCase() === currentUser.account.toLowerCase();
      }
      if (currentUser?.role === 'Leader') {
        return isTaskInMyTeamScope(t);
      }
      return true; // Admin sees all
    });
  }, [tasks, selectedWeek, selectedYear, currentUser, users]);

  // Group unfinished tasks by Member (Assignee) for crystal-clear clarity for Leaders & Admin
  const unfinishedTasksByMember = React.useMemo(() => {
    const map = new Map<
      string,
      {
        user?: UserType;
        account: string;
        tasks: Task[];
        totalHours: number;
        unaddedTasks: Task[];
      }
    >();

    currentWeekUnfinishedTasks.forEach((t) => {
      const account = t.assigneeAccount || 'UNKNOWN';
      const isAlreadyAdded = tasks.some(
        (nt) =>
          nt.weekNumber === nextWeek &&
          nt.year === selectedYear &&
          (nt.parentTaskId === t.id || (nt.title === t.title && nt.assigneeAccount === t.assigneeAccount))
      );

      const existing = map.get(account);
      if (existing) {
        existing.tasks.push(t);
        existing.totalHours += t.estimatedEffort || 0;
        if (!isAlreadyAdded) {
          existing.unaddedTasks.push(t);
        }
      } else {
        const u = users.find((user) => user.account.toLowerCase() === account.toLowerCase());
        map.set(account, {
          user: u,
          account,
          tasks: [t],
          totalHours: t.estimatedEffort || 0,
          unaddedTasks: isAlreadyAdded ? [] : [t],
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Current user first, then alphabetically by account
      if (a.account.toLowerCase() === currentUser?.account.toLowerCase()) return -1;
      if (b.account.toLowerCase() === currentUser?.account.toLowerCase()) return 1;
      return a.account.localeCompare(b.account);
    });
  }, [currentWeekUnfinishedTasks, tasks, nextWeek, selectedYear, users, currentUser]);

  // 2. Next Week Planned Tasks (Already assigned for next week)
  const nextWeekAssignedTasks = React.useMemo(() => {
    return tasks.filter((t) => {
      if (t.weekNumber !== nextWeek || t.year !== selectedYear) return false;
      if (!t.assigneeAccount || t.assigneeAccount.trim() === '') return false;

      // Role check for Leader/Member if not admin
      if (currentUser?.role === 'Leader') {
        if (!isTaskInMyTeamScope(t)) return false;
      } else if (currentUser?.role === 'Member') {
        if (t.assigneeAccount?.toLowerCase() !== currentUser.account.toLowerCase()) return false;
      }

      if (roleFilter !== 'ALL' && t.role !== roleFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchAssignee = (t.assigneeAccount || '').toLowerCase().includes(q);
        if (!matchTitle && !matchAssignee) return false;
      }

      return true;
    });
  }, [tasks, nextWeek, selectedYear, currentUser, roleFilter, searchQuery, users]);

  // Group next week assigned tasks by Role
  const nextWeekTasksByRole = React.useMemo(() => {
    const map = new Map<string, Task[]>();

    roles.forEach((r) => map.set(r.code, []));

    nextWeekAssignedTasks.forEach((t) => {
      const list = map.get(t.role);
      if (list) list.push(t);
      else map.set(t.role, [t]);
    });

    return Array.from(map.entries()).filter(([_, list]) => list.length > 0);
  }, [nextWeekAssignedTasks, roles]);

  // 3. Unassigned Milestone Tasks Pool
  const unassignedMilestoneTasks = React.useMemo(() => {
    return tasks.filter((t) => {
      if (t.assigneeAccount && t.assigneeAccount.trim() !== '') return false;
      if (t.assignmentRequestStatus === 'PENDING') return false;

      // Filter by role for members/leaders
      if (currentUser?.role === 'Member') {
        const mySpecs = currentUser.specializations || [];
        if (!mySpecs.includes(t.role)) return false;
      } else if (currentUser?.role === 'Leader') {
        const leaderRoles = currentUser.specializations || [];
        if (!leaderRoles.includes(t.role)) return false;
      }

      if (roleFilter !== 'ALL' && t.role !== roleFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [tasks, currentUser, roleFilter, searchQuery]);

  const totalNextWeekEffort = nextWeekAssignedTasks.reduce(
    (acc, curr) => acc + (curr.estimatedEffort || 0),
    0
  );

  const handleTransferToNextWeek = (t: Task) => {
    // Check if continuation task already exists in next week
    const existingNextWeek = tasks.find(
      (nt) =>
        nt.weekNumber === nextWeek &&
        nt.year === selectedYear &&
        (nt.parentTaskId === t.id || (nt.title === t.title && nt.assigneeAccount === t.assigneeAccount))
    );

    if (existingNextWeek) return;

    // Create continuation task for next week, keeping original task in current week intact for historical log!
    const continuationTask: Task = {
      ...t,
      id: `tsk-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      weekNumber: nextWeek,
      parentTaskId: t.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addTask(continuationTask);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <CalendarPlus className="w-6 h-6 text-indigo-600" />
                Define & Kế Hoạch Công Việc Tuần Tới
              </h2>
              <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs">
                Kế hoạch Tuần {nextWeek} ({nextWeekRange.startDate} - {nextWeekRange.endDate})
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {currentUser?.role === 'Admin'
                ? 'Admin: Define công việc tuần tới cho tất cả các team và phân công task.'
                : currentUser?.role === 'Leader'
                ? `Leader (${currentUser.specializations?.join(', ') || 'Team'}): Quản lý & lên kế hoạch tuần tới cho các thành viên trong team của bạn.`
                : `Member (${currentUser?.name}): Tự tạo task mới cho bản thân tuần tới hoặc xin nhận task từ Milestone để Leader duyệt.`}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {isLeaderOrAdmin ? (
              <button
                onClick={() => onOpenTaskModal(undefined, nextWeek)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Define & Phân Công Task Tuần {nextWeek}
              </button>
            ) : (
              <button
                onClick={() => onOpenTaskModal(undefined, nextWeek, currentUser?.account)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Tự Tạo Task Cho Tôi (Tuần {nextWeek})
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <span className="text-[10px] text-slate-500 block font-semibold uppercase">Task Đã Lên Kế Hoạch</span>
            <span className="text-lg font-black text-indigo-700">{nextWeekAssignedTasks.length} task</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <span className="text-[10px] text-slate-500 block font-semibold uppercase">Tổng Effort Dự Kiến</span>
            <span className="text-lg font-black text-indigo-700">{totalNextWeekEffort}h</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <span className="text-[10px] text-slate-500 block font-semibold uppercase">Yêu Cầu Nhận Task Chờ Duyệt</span>
            <span className={`text-lg font-black ${pendingRequests.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {pendingRequests.length} yêu cầu
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <span className="text-[10px] text-slate-500 block font-semibold uppercase">Kho Task Milestone Chưa Giao</span>
            <span className="text-lg font-black text-slate-700">{unassignedMilestoneTasks.length} task</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: PENDING ASSIGNMENT REQUESTS (Leader Accept / Reject) */}
      {pendingRequests.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Danh Sách Yêu Cầu Xin Nhận Task Cho Tuần {nextWeek} ({pendingRequests.length})
            </div>
            <span className="text-xs text-amber-700 font-medium">
              {isLeaderOrAdmin ? 'Leader / Admin bấm Chấp nhận để phân công task cho thành viên' : 'Đang chờ Leader duyệt yêu cầu của bạn'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingRequests.map((t) => {
              const milestone = milestones.find((m) => m.id === t.milestoneId);
              const requestingUser = users.find((u) => u.account === t.assignmentRequestedBy);

              return (
                <div key={t.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        {t.role}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">#{t.id.replace('tsk-', '')}</span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 leading-snug">{t.title}</h4>

                    {milestone && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        <Flag className="w-3 h-3 text-indigo-500 shrink-0" />
                        {milestone.title}
                      </span>
                    )}

                    <div className="flex items-center gap-2 text-xs pt-1">
                      <span className="text-slate-500">Thành viên xin nhận:</span>
                      <span className="font-bold text-indigo-700 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" /> {requestingUser?.name || t.assignmentRequestedBy} ({t.assignmentRequestedBy})
                      </span>
                    </div>
                  </div>

                  {/* Actions for Leader / Member */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <span className="text-xs font-semibold text-slate-600">
                      Est Effort: <strong className="text-indigo-600">{t.estimatedEffort}h</strong>
                    </span>

                    {isLeaderOrAdmin ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveTaskAssignment(t.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-xs transition active:scale-95"
                          title="Chấp nhận phân công task này cho thành viên"
                        >
                          <Check className="w-3.5 h-3.5" /> Chấp Nhận
                        </button>
                        <button
                          onClick={() => rejectTaskAssignment(t.id)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700 text-xs font-bold rounded-lg border border-slate-200 transition active:scale-95"
                          title="Từ chối yêu cầu"
                        >
                          <X className="w-3.5 h-3.5" /> Từ Chối
                        </button>
                      </div>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600 animate-spin" /> Chờ Leader Duyệt
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 1.5: UNFINISHED TASKS FROM CURRENT / PREVIOUS WEEK GROUPED BY MEMBER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Clock className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Task Chưa Hoàn Thành Tuần {selectedWeek} ({currentWeekUnfinishedTasks.length} task)
              </h3>
              {currentWeekUnfinishedTasks.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                  {unfinishedTasksByMember.length} thành viên cần lên kế hoạch tiếp
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Phân loại theo từng thành viên. Bấm nút chuyển để đưa các task chưa xong vào kế hoạch Tuần {nextWeek}.
            </p>
          </div>

          {currentWeekUnfinishedTasks.length > 1 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const anyExpanded = Object.values(expandedMembers).some(Boolean);
                  toggleAllMembersExpanded(!anyExpanded);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-xl transition active:scale-95"
              >
                {Object.values(expandedMembers).some(Boolean) ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
              </button>

              <button
                onClick={() => {
                  confirmDialog({
                    title: `Đưa tất cả task làm dở vào kế hoạch Tuần ${nextWeek}`,
                    message: `Bạn có chắc muốn đưa toàn bộ ${currentWeekUnfinishedTasks.length} task chưa hoàn thành từ Tuần ${selectedWeek} của ${unfinishedTasksByMember.length} thành viên vào kế hoạch Tuần ${nextWeek}? (Lịch sử làm việc Tuần ${selectedWeek} sẽ được bảo lưu nguyên vẹn).`,
                    type: 'info',
                    onConfirm: () => {
                      currentWeekUnfinishedTasks.forEach((t) => {
                        handleTransferToNextWeek(t);
                      });
                    },
                  });
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 shrink-0"
              >
                <ArrowRight className="w-3.5 h-3.5" /> Chuyển tất cả sang Tuần {nextWeek}
              </button>
            </div>
          )}
        </div>

        {currentWeekUnfinishedTasks.length === 0 ? (
          <div className="py-8 text-center bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl text-xs text-slate-500 space-y-1.5 border border-dashed border-slate-200 dark:border-slate-700">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
            <p className="font-bold text-slate-700 dark:text-slate-200">Không có task làm dở nào ở Tuần {selectedWeek}!</p>
            <p className="text-[11px] text-slate-400">Tất cả công việc đã được hoàn thành (Done) hoặc đã được đưa vào kế hoạch Tuần {nextWeek}.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unfinishedTasksByMember.map((group) => {
              const isMe = currentUser && group.account.toLowerCase() === currentUser.account.toLowerCase();
              const displayName = group.user?.name || group.account;
              const hasUnadded = group.unaddedTasks.length > 0;
              const isExpanded = !!expandedMembers[group.account];

              return (
                <div
                  key={group.account}
                  className={`border rounded-2xl transition-all duration-200 overflow-hidden ${
                    isExpanded
                      ? 'bg-slate-50/75 dark:bg-slate-800/50 border-amber-300 dark:border-amber-600/70 shadow-xs'
                      : 'bg-white dark:bg-slate-850 border-slate-200/90 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-600/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* Member Header (Click anywhere to Expand / Collapse) */}
                  <div
                    onClick={() => toggleMemberExpanded(group.account)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-4.5 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      {/* Chevron Arrow Toggle Indicator */}
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-transform duration-200 shrink-0 ${
                        isExpanded
                          ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 rotate-180'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        <ChevronDown className="w-4 h-4" />
                      </div>

                      {/* Avatar / Initials */}
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                        {group.account.slice(0, 2).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {displayName}
                          </h4>
                          <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                            (@{group.account})
                          </span>
                          {isMe && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                              Chính bạn
                            </span>
                          )}
                          {group.user?.specializations && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {group.user.specializations.join(', ')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {group.tasks.length} task dở
                          </span>
                          <span>•</span>
                          <span>
                            Tổng Effort: <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{group.totalHours}h</strong>
                          </span>
                          <span>•</span>
                          <span className="text-[11px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition">
                            {isExpanded ? 'Thu gọn' : 'Bấm để xem chi tiết task'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Member Quick Transfer All Button */}
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {hasUnadded ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            group.unaddedTasks.forEach((t) => handleTransferToNextWeek(t));
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95"
                          title={`Chuyển toàn bộ ${group.unaddedTasks.length} task dở của ${displayName} sang Tuần ${nextWeek}`}
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Chuyển tất cả ({group.unaddedTasks.length})</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Đã chuyển hết</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Member's Tasks Grid (Conditionally Expanded) */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 pt-0 border-t border-slate-200/80 dark:border-slate-700/80 mt-1">
                      <div className="pt-3.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.tasks.map((t) => {
                          const milestone = milestones.find((m) => m.id === t.milestoneId);
                          const isAlreadyAdded = tasks.some(
                            (nt) =>
                              nt.weekNumber === nextWeek &&
                              nt.year === selectedYear &&
                              (nt.parentTaskId === t.id || (nt.title === t.title && nt.assigneeAccount === t.assigneeAccount))
                          );

                          return (
                            <div
                              key={t.id}
                              className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between space-y-3 hover:border-amber-300 dark:hover:border-amber-500/60 transition shadow-2xs"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    {t.role} • {t.status} ({t.completionPercentage}%)
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    Tuần {t.weekNumber} • Est: <strong className="text-indigo-600 dark:text-indigo-400">{t.estimatedEffort}h</strong>
                                  </span>
                                </div>

                                <h5
                                  onClick={() => setViewingDetailTask(t)}
                                  className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition"
                                  title="Bấm để xem chi tiết task"
                                >
                                  {t.title}
                                </h5>

                                {milestone && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800">
                                    <Flag className="w-2.5 h-2.5 text-indigo-500 shrink-0" /> {milestone.title}
                                  </span>
                                )}
                              </div>

                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  Người làm: <strong className="text-indigo-600 dark:text-indigo-400">@{t.assigneeAccount}</strong>
                                </span>

                                {isAlreadyAdded ? (
                                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 shadow-2xs shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã chuyển
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleTransferToNextWeek(t)}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition active:scale-95 shadow-2xs shrink-0"
                                    title={`Đưa task này vào kế hoạch Tuần ${nextWeek}`}
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                    <span>Chuyển sang Tuần {nextWeek}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: NEXT WEEK PLANNED TASKS TABLE */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm space-y-0">
        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600 shrink-0" />
            <h3 className="text-sm font-bold text-slate-800">
              Bảng Công Việc Đã Lên Kế Hoạch Tuần {nextWeek} ({nextWeekAssignedTasks.length} task)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm task tuần tới..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {currentUser?.role === 'Admin' ? (
              <Dropdown
                value={roleFilter}
                onChange={setRoleFilter}
                options={[
                  { value: 'ALL', label: 'Tất cả Role' },
                  ...roles.map((r) => ({ value: r.code, label: `Role: ${r.code}` })),
                ]}
                buttonClassName="py-1.5 px-3 text-xs bg-slate-50 border-slate-200"
              />
            ) : currentUser?.specializations && currentUser.specializations.length > 1 ? (
              <Dropdown
                value={roleFilter}
                onChange={setRoleFilter}
                options={[
                  { value: 'ALL', label: 'Tất cả Role của Team' },
                  ...roles
                    .filter((r) => currentUser.specializations.includes(r.code))
                    .map((r) => ({ value: r.code, label: `Role: ${r.code}` })),
                ]}
                buttonClassName="py-1.5 px-3 text-xs bg-slate-50 border-slate-200"
              />
            ) : null}
          </div>
        </div>

        {/* Table list */}
        {nextWeekAssignedTasks.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 text-xs text-slate-500 space-y-2">
            <CalendarPlus className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">Chưa có task nào được lên kế hoạch cho Tuần {nextWeek}</p>
            <p className="text-[11px] max-w-md mx-auto text-slate-400">
              {isLeaderOrAdmin
                ? 'Hãy bấm nút "+ Define & Phân Công Task Tuần Tới" hoặc phân công từ Kho Milestone bên dưới.'
                : 'Bạn có thể bấm "+ Tự Tạo Task Cho Tôi" hoặc bấm "Xin Nhận Task" từ Kho Milestone bên dưới.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">STT</th>
                  <th className="py-3 px-4 min-w-[240px]">TASK NAME</th>
                  <th className="py-3 px-3 text-center">ROLE</th>
                  <th className="py-3 px-3 text-center">EST EFFORT</th>
                  <th className="py-3 px-3">ACCOUNT PHỤ TRÁCH</th>
                  <th className="py-3 px-3 text-center">TRẠNG THÁI</th>
                  <th className="py-3 px-4 text-center w-24">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {nextWeekTasksByRole.map(([roleCode, roleTasks]) => (
                  <React.Fragment key={roleCode}>
                    {/* Role Header */}
                    <tr className="bg-indigo-50/50 border-y border-indigo-100/80">
                      <td colSpan={7} className="py-2.5 px-4">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-900 text-xs uppercase tracking-wide">
                            Role: {roleCode} ({roleTasks.length} task)
                          </span>
                          <span className="text-[11px] text-indigo-600 font-semibold">
                            Tổng Effort Dự Kiến: {roleTasks.reduce((acc, curr) => acc + (curr.estimatedEffort || 0), 0)}h
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Task Rows */}
                    {roleTasks.map((t) => {
                      const milestone = milestones.find((m) => m.id === t.milestoneId);
                      const isMyTask = t.assigneeAccount === currentUser?.account;

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                            {t.id.replace('tsk-', '')}
                          </td>

                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  onClick={() => setViewingDetailTask(t)}
                                  className="font-bold text-slate-800 hover:text-indigo-600 transition cursor-pointer leading-snug"
                                >
                                  {t.title}
                                </span>

                                {t.priority === 'High' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 border border-red-200 text-red-700 font-bold text-[10px] shrink-0">
                                    <Flame className="w-3 h-3 text-red-500 fill-red-500" /> Ưu tiên cao
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                {milestone ? (
                                  <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                    <Flag className="w-2.5 h-2.5 text-indigo-500 shrink-0" /> {milestone.title}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                    <FolderOpen className="w-2.5 h-2.5 text-slate-400 shrink-0" /> Ngoài Milestone
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold border border-slate-200">
                              {t.role}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center font-mono font-bold text-indigo-600">
                            {t.estimatedEffort}h
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 text-xs">
                              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {t.assigneeAccount.slice(0, 2)}
                              </div>
                              <span className={`font-semibold ${isMyTask ? 'text-indigo-700 font-bold' : 'text-slate-700'}`}>
                                {t.assigneeAccount} {isMyTask && '(Tôi)'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                              Kế hoạch Tuần {nextWeek}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => onOpenTaskModal(t)}
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition"
                                title="Chỉnh sửa task"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {isLeaderOrAdmin && (
                                <button
                                  onClick={() => {
                                    confirmDialog({
                                      title: 'Xóa task',
                                      message: `Bạn có chắc muốn xóa task "${t.title}" khỏi kế hoạch tuần tới?`,
                                      type: 'danger',
                                      onConfirm: () => deleteTask(t.id),
                                    });
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 border border-slate-200 transition"
                                  title="Xóa task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: UNASSIGNED MILESTONE TASKS POOL */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-amber-500" />
              Kho Task Milestone Chưa Phân Công ({unassignedMilestoneTasks.length} task)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isLeaderOrAdmin
                ? 'Leader/Admin bấm Phân công nhanh để giao task từ Milestone cho thành viên làm tuần tới.'
                : 'Member bấm Xin Nhận Task để đăng ký công việc tuần tới cho bản thân và gửi Leader duyệt.'}
            </p>
          </div>
        </div>

        {unassignedMilestoneTasks.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs italic">
            Không có task Milestone chưa giao nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedMilestoneTasks.map((t) => {
              const milestone = milestones.find((m) => m.id === t.milestoneId);

              return (
                <div key={t.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3 hover:border-indigo-300 transition">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                        {t.role}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Est: {t.estimatedEffort}h</span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">{t.title}</h4>

                    {milestone && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-indigo-100">
                        <Flag className="w-2.5 h-2.5 text-indigo-500 shrink-0" /> {milestone.title}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Chưa ai nhận
                    </span>

                    {isLeaderOrAdmin ? (
                      <button
                        onClick={() => onOpenTaskModal(t, nextWeek)}
                        className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition active:scale-95"
                      >
                        ⚡ Phân Công Nhanh
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          requestTaskAssignment(t.id, currentUser?.account || '', nextWeek);
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition active:scale-95"
                      >
                        <Handshake className="w-3.5 h-3.5" /> ✋ Xin Nhận Task
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {viewingDetailTask && (
        <TaskDetailModal
          task={viewingDetailTask}
          isOpen={!!viewingDetailTask}
          onClose={() => setViewingDetailTask(null)}
        />
      )}
    </div>
  );
};
