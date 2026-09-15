'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus, Specialization } from '../types/task';
import { WeeklyReportModal } from './WeeklyReportModal';
import { TaskDetailModal } from './TaskDetailModal';
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
} from 'lucide-react';
import { Dropdown, DropdownOption } from './common/Dropdown';
import { NextWeekDefineView } from './NextWeekDefineView';

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
  } = useApp();

  // Sub-tabs state: ALWAYS DEFAULT to 'MY_TASKS' when accessing
  const [subTab, setSubTab] = useState<'MY_TASKS' | 'ALL_TASKS' | 'DEFINE_NEXT_WEEK'>('MY_TASKS');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [reportingTask, setReportingTask] = useState<Task | null>(null);
  const [viewingDetailTask, setViewingDetailTask] = useState<Task | null>(null);

  // Force default 'MY_TASKS' on component mount
  useEffect(() => {
    setSubTab('MY_TASKS');
  }, []);

  const roleOptions: DropdownOption[] = [
    { value: 'ALL', label: 'Tất cả Role' },
    ...roles.map((r) => ({
      value: r.code,
      label: `${r.code} (${r.name})`,
    })),
  ];

  const accountOptions: DropdownOption[] = [
    { value: 'ALL', label: 'Tất cả Thành Viên (Account)' },
    ...users.map((u) => ({
      value: u.account,
      label: `${u.name} (${u.account})`,
      subLabel: `${u.role} • ${u.specializations?.join(', ') || ''}`,
    })),
  ];

  const milestoneOptions: DropdownOption[] = [
    { value: 'ALL', label: 'Tất cả Milestone' },
    { value: 'NO_MILESTONE', label: '📌 Task Ngoài Milestone (Chưa gán)' },
    ...milestones.map((m) => ({
      value: m.id,
      label: `🚩 ${m.title}`,
    })),
  ];

  const statusOptions: DropdownOption[] = [
    { value: 'ALL', label: 'Tất cả Trạng Thái' },
    { value: 'To do', label: 'To do (Cần làm)' },
    { value: 'In Progress', label: 'In Progress (Đang làm)' },
    { value: 'Done', label: 'Done (Đã hoàn thành)' },
  ];

  // Filter Tasks
  const filteredTasks = tasks.filter((t) => {
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
  });

  const ROLE_ORDER: Specialization[] = roles.map((r) => r.code);

  const getRoleConfig = (roleCode: string) => {
    const rObj = roles.find((r) => r.code === roleCode);
    const color = rObj?.color || 'indigo';
    const label = rObj ? `${rObj.code} (${rObj.name})` : `${roleCode} Team`;

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
      label,
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
        groups.push({ role, tasks: tasksInRole });
      }
    });

    return groups;
  }, [filteredTasks]);

  const totalEstimatedEffort = filteredTasks.reduce((acc, t) => acc + (t.estimatedEffort || 0), 0);
  const totalActualEffort = filteredTasks.reduce((acc, t) => acc + (t.actualEffort || 0), 0);

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'Done':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'BA':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Design':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'FE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'BE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'QA':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const isTopEffortAccount = (acc: string) => {
    if (!acc) return false;
    const award = weeklyAwards.find((w) => w.account === acc);
    return award?.isTopEffort || false;
  };

  // Reusable task row renderer
  const renderTaskRow = (t: Task, displayIdx: number) => {
    const isTopEffort = isTopEffortAccount(t.assigneeAccount);
    const isLate = t.isSubmittedLate;
    const isAssignedToMe = canReportTask(t);
    const hasAlert = isLate || isTopEffort;

    return (
      <tr
        key={t.id}
        onClick={() => {
          if (t.notes) markNoteAsRead(t.id, t.notes);
          setViewingDetailTask(t);
        }}
        className={`hover:bg-slate-50/80 transition cursor-pointer group ${
          isLate
            ? 'bg-red-50/50'
            : isTopEffort
            ? 'bg-emerald-50/50'
            : ''
        }`}
      >
        {/* STT */}
        <td className="py-3 px-4 text-center text-slate-400 font-mono font-medium">
          {displayIdx}
        </td>

        {/* Task Name: Clean & minimal, identical layout for all rows */}
        <td className="py-3 px-4 font-medium text-slate-800">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="line-clamp-2 font-semibold text-slate-800 group-hover:text-indigo-600 transition">
                {t.title}
              </span>
              {t.priority === 'High' && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 border border-red-200 text-red-700 font-bold text-[10px] shrink-0 shadow-2xs"
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
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/90 text-indigo-700 font-semibold text-[10px] shadow-2xs"
                    title={`Thuộc Milestone: ${milestone.title}`}
                  >
                    <Flag className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                    {milestone.title}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-slate-500 text-[10px]"
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
            <span className="font-bold text-indigo-600">
              {t.actualEffort > 0 ? t.actualEffort : t.estimatedEffort}h
            </span>
            {t.actualEffort > 0 && t.actualEffort !== t.estimatedEffort && (
              <span className="text-[9px] text-slate-400">
                est: {t.estimatedEffort}h
              </span>
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
              <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[9px] font-bold text-indigo-600">
                {t.assigneeAccount.slice(0, 2)}
              </div>
              <span className="text-slate-700">{t.assigneeAccount}</span>
            </div>
          ) : (
            <span className="text-amber-600 font-semibold flex items-center gap-1 text-[11px]">
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
            <div className="flex items-center justify-center gap-1">
              {isLate && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold rounded-full"
                  title="Báo cáo nộp sau 10h tối Chủ Nhật (Bị phạt)"
                >
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  PHẠT
                </span>
              )}
              {isTopEffort && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-full"
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
                    setViewingDetailTask(t);
                  }}
                  className={`relative p-1.5 rounded-xl transition-all shadow-xs active:scale-95 ${
                    isUnread
                      ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold ring-2 ring-amber-300 ring-offset-1 shadow-amber-400/40 animate-pulse'
                      : t.notes
                      ? 'bg-slate-100 hover:bg-amber-50 hover:text-amber-600 text-slate-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-400'
                  }`}
                  title={
                    isUnread
                      ? 'Có trao đổi / ghi chú mới chưa đọc! Bấm để xem'
                      : 'Ghi chú & Trao đổi luồng task'
                  }
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {isUnread && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white shadow-xs" />
                  )}
                </button>
              );
            })()}

            {/* ONLY RENDER BÁO CÁO BUTTON IF TASK IS ASSIGNED TO CURRENT USER! HIDE COMPLETELY FOR OTHERS */}
            {isAssignedToMe && (
              <button
                onClick={() => setReportingTask(t)}
                className="whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200/90 hover:border-indigo-600 rounded-xl text-xs font-semibold shadow-xs hover:shadow-md active:scale-95 transition-all"
                title="Nộp báo cáo số giờ làm & % hoàn thành"
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Báo cáo</span>
              </button>
            )}

            {/* Leader/Admin Edit & Delete Buttons */}
            {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
              <>
                <button
                  onClick={() => onOpenTaskModal?.(t)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 hover:text-indigo-600 text-slate-600 rounded-xl transition-all shadow-xs"
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
                  className="p-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-400 rounded-xl transition-all shadow-xs"
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

  return (
    <div className="space-y-4">
      {/* Header & Sub-tabs Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                Work Schedules (Bảng Công Việc Chi Tiết)
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {filteredTasks.length} đầu việc
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý tiến độ, giờ làm thực tế (Effort) và trao đổi ghi chú với Leader.
            </p>
          </div>

          {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
            <button
              onClick={() => onOpenTaskModal?.()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Tạo / Break Task Mới
            </button>
          )}
        </div>

        {/* Navigation Sub-Tabs Switcher (Below title & description, identical to Milestones) */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 max-w-fit gap-1">
          <button
            onClick={() => setSubTab('MY_TASKS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${
              subTab === 'MY_TASKS'
                ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
            Task Của Tôi
          </button>
          <button
            onClick={() => setSubTab('ALL_TASKS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${
              subTab === 'ALL_TASKS'
                ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-indigo-600" />
            Tất Cả Công Việc
          </button>
          <button
            onClick={() => setSubTab('DEFINE_NEXT_WEEK')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${
              subTab === 'DEFINE_NEXT_WEEK'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-white/60'
            }`}
          >
            <CalendarPlus className={`w-3.5 h-3.5 ${subTab === 'DEFINE_NEXT_WEEK' ? 'text-white' : 'text-indigo-600'}`} />
            Define Tuần Tới (Tuần {selectedWeek + 1})
          </button>
        </div>
      </div>

      {subTab === 'DEFINE_NEXT_WEEK' ? (
        <NextWeekDefineView onOpenTaskModal={(t, w, a) => onOpenTaskModal?.(t, w, a)} />
      ) : (
        <>
          {/* Filter Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {/* Role Filter */}
          <div className="w-full">
            <Dropdown
              value={selectedRole}
              onChange={setSelectedRole}
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
              onChange={setSelectedStatus}
              options={statusOptions}
              className="w-full"
              buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Table Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
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
                              <span className="text-[10px] text-slate-500 font-semibold bg-white/80 px-2 py-0.5 rounded-full border border-slate-200/70">
                                {group.tasks.length} đầu việc
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-slate-500 text-[11px]">
                                Tổng Effort: <strong className="text-indigo-600 font-mono font-bold">{groupTotalActual > 0 ? groupTotalActual : groupTotalEst}h</strong>
                                {groupTotalActual > 0 && groupTotalActual !== groupTotalEst && (
                                  <span className="text-slate-400 font-mono ml-1">(est: {groupTotalEst}h)</span>
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
                            {/* Thin blank separator row (half height of normal row) between different accounts */}
                            {accIdx > 0 && (
                              <tr className="h-4 bg-slate-50/60 dark:bg-slate-900/90 border-y border-slate-100/80 dark:border-slate-800 select-none">
                                <td colSpan={9} className="h-4 p-0 border-0 bg-slate-50/60 dark:bg-slate-900/90"></td>
                              </tr>
                            )}
                            {accTasks.map((t) => {
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
                  {totalActualEffort > 0 ? `${totalActualEffort}h` : `${totalEstimatedEffort}h`}
                </td>
                <td colSpan={5}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      </>
      )}

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
