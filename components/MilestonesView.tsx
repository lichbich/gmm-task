'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Milestone, Task, TaskStatus, Specialization } from '../types/task';
import { TaskModal } from './TaskModal';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskDiscussionModal } from './TaskDiscussionModal';
import {
  ListOrdered,
  Plus,
  Check,
  CheckCircle2,
  UserCheck,
  GripVertical,
  Edit2,
  Trash2,
  Layers,
  Inbox,
  Flag,
  FolderOpen,
  MessageSquare,
  FileText,
  Flame,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Dropdown } from './common/Dropdown';

export const MilestonesView: React.FC = () => {
  const {
    milestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    tasks,
    duplicateTask,
    updateTask,
    reorderTasksInMilestone,
    deleteTask,
    currentUser,
    confirmDialog,
    hasUnreadNote,
    markNoteAsRead,
    canEditTask,
    roles,
    users,
  } = useApp();

  // Sub-tabs: Milestones vs Ad-hoc tasks
  const [subTab, setSubTab] = useState<'MILESTONES' | 'ADHOC'>('MILESTONES');

  // Helper to normalize milestone title display
  const formatMilestoneTitle = (title: string, orderNumber: number): string => {
    if (!title) return `Milestone ${orderNumber}`;
    const match = title.match(/^Milestone\s+\d+\s*(:\s*.*)?$/i);
    if (match) {
      const rest = match[1] ? match[1] : '';
      return `Milestone ${orderNumber}${rest}`;
    }
    return title;
  };

  // Find default matching role for current user based on their specializations
  const getInitialRoleForUser = (): string => {
    if (!currentUser) return roles[0]?.code || 'BA';
    const userSpecs = currentUser.specializations || [];
    
    // 1. Check direct or fuzzy match in roles list
    for (const spec of userSpecs) {
      const directMatch = roles.find((r) => r.code.toLowerCase() === spec.toLowerCase());
      if (directMatch) return directMatch.code;

      const fuzzyMatch = roles.find(
        (r) => spec.toLowerCase().includes(r.code.toLowerCase()) || r.code.toLowerCase().includes(spec.toLowerCase())
      );
      if (fuzzyMatch) return fuzzyMatch.code;
    }

    // 2. Fallback to first role or BA
    return roles[0]?.code || 'BA';
  };

  const [adminSelectedRole, setAdminSelectedRole] = useState<string>('BA');

  // Automatically select user's current role/specialization when component loads or user/roles change
  React.useEffect(() => {
    if (currentUser && roles.length > 0) {
      const bestRole = getInitialRoleForUser();
      setAdminSelectedRole(bestRole);
      setMsRole(bestRole);
    }
  }, [currentUser?.id, currentUser?.specializations?.join(','), roles]);

  const [modalInitialRole, setModalInitialRole] = useState<Specialization | undefined>(undefined);

  const [isAddMsOpen, setIsAddMsOpen] = useState(false);
  const [msTitle, setMsTitle] = useState('');
  const [msDesc, setMsDesc] = useState('');
  const [msTargetDate, setMsTargetDate] = useState('');
  const [msRole, setMsRole] = useState<string>('BA');

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [targetMilestoneId, setTargetMilestoneId] = useState<string>('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [viewingDetailTask, setViewingDetailTask] = useState<Task | null>(null);
  const [discussingTask, setDiscussingTask] = useState<Task | null>(null);

  // Drag and drop state for milestone tasks
  const [draggedMilestoneTaskId, setDraggedMilestoneTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // Inline edit milestone state
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMsTitle, setEditMsTitle] = useState('');
  const [editMsDesc, setEditMsDesc] = useState('');

  // Collapse / Expand milestones state
  const [collapsedMilestones, setCollapsedMilestones] = useState<Set<string>>(new Set());
  const [isAdhocCollapsed, setIsAdhocCollapsed] = useState(false);

  const toggleCollapseMilestone = (milestoneId: string) => {
    setCollapsedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(milestoneId)) {
        next.delete(milestoneId);
      } else {
        next.add(milestoneId);
      }
      return next;
    });
  };

  const handleCollapseAll = () => {
    setCollapsedMilestones(new Set(filteredMilestones.map((m) => m.id)));
  };

  const handleExpandAll = () => {
    setCollapsedMilestones(new Set());
  };
  const [editMsTargetDate, setEditMsTargetDate] = useState('');
  const [editMsRole, setEditMsRole] = useState<string>('BA');

  // Assignee / Member filter state
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');

  // Collapsed state for Done task cards (by section/milestone ID)
  const [collapsedDoneSections, setCollapsedDoneSections] = useState<Set<string>>(new Set());

  const toggleCollapseDoneSection = (sectionId: string) => {
    setCollapsedDoneSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Role & Assignee filtering logic:
  const isTaskRoleMatch = (taskRole: Specialization): boolean => {
    const currentRole = adminSelectedRole || roles[0]?.code || 'BA';
    return taskRole === currentRole;
  };

  const isTaskAssigneeMatch = (t: Task): boolean => {
    if (assigneeFilter === 'ALL') return true;
    if (assigneeFilter === 'UNASSIGNED') return !t.assigneeAccount;
    return t.assigneeAccount?.toLowerCase() === assigneeFilter.toLowerCase();
  };

  // Check if a milestone matches current view filter
  const isMilestoneRoleMatch = (ms: Milestone): boolean => {
    const currentRole = adminSelectedRole || roles[0]?.code || 'BA';
    return ms.role === currentRole;
  };

  // Check if a user member belongs to the active role (by specialization or assigned task)
  const isMemberInRole = (u: any, roleCode: string): boolean => {
    if (!u || u.disabled || u.status === 'disabled') return false;
    const currentRoleCode = (roleCode || 'BA').toLowerCase();
    
    // 1. Check specializations match
    const hasSpecMatch = (u.specializations || []).some((spec: string) => {
      const s = spec.toLowerCase();
      return s === currentRoleCode || s.includes(currentRoleCode) || currentRoleCode.includes(s);
    });
    if (hasSpecMatch) return true;

    // 2. Check if user has any tasks assigned under this role
    const hasTaskInRole = tasks.some(
      (t) => t.role?.toLowerCase() === currentRoleCode && t.assigneeAccount?.toLowerCase() === u.account.toLowerCase()
    );
    if (hasTaskInRole) return true;

    return false;
  };

  // Helper to sort active (non-Done) tasks: Newly created tasks on top!
  const sortActiveTasks = (list: Task[]) => {
    return [...list].sort((a, b) => {
      // 1. Compare createdAt timestamp if available (newest first)
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB && timeA > 0 && timeB > 0) {
        return timeB - timeA;
      }
      // 2. Fallback to numeric ID (e.g. tsk-15 vs tsk-2)
      const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) {
        return numB - numA;
      }
      return (a.orderInMilestone || 0) - (b.orderInMilestone || 0);
    });
  };

  // Checkbox toggle permission:
  // Admin, Leader & Advisor can check any task
  // Member can ONLY check tasks assigned to themselves
  const canToggleTaskCheck = (t: Task): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin' || currentUser.role === 'Leader' || currentUser.role === 'Advisor') return true;
    if (!t.assigneeAccount) return false;
    return t.assigneeAccount.toLowerCase() === currentUser.account.toLowerCase();
  };

  const getPriorityRank = (priority?: string): number => {
    if (priority === 'High') return 1;
    if (priority === 'Low') return 3;
    return 2;
  };

  // Filtered milestones and adhoc tasks
  const filteredMilestones = milestones
    .filter(isMilestoneRoleMatch)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const filteredAdhocTasks = tasks.filter(
    (t) => (!t.milestoneId || !milestones.some((m) => m.id === t.milestoneId)) && isTaskRoleMatch(t.role) && isTaskAssigneeMatch(t)
  );

  const canManageMilestone = (ms: Milestone): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    if (currentUser.role === 'Leader' || currentUser.role === 'Advisor') {
      const userRoles = currentUser.specializations || [];
      if (ms.role) {
        return userRoles.includes(ms.role);
      }
      const msTasksAll = tasks.filter((t) => t.milestoneId === ms.id);
      if (msTasksAll.length === 0) return true;
      return msTasksAll.some((t) => userRoles.includes(t.role));
    }
    return false;
  };

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim()) return;
    const finalRole: Specialization =
      currentUser?.role === 'Leader' || currentUser?.role === 'Advisor'
        ? ((currentUser.specializations?.[0] as Specialization) || (adminSelectedRole as Specialization) || 'BA')
        : ((msRole || adminSelectedRole || 'BA') as Specialization);

    addMilestone({
      title: msTitle,
      description: msDesc,
      targetDate: msTargetDate || '2026-09-30',
      status: 'In Progress',
      role: finalRole,
    });
    setMsTitle('');
    setMsDesc('');
    setMsTargetDate('');
    setIsAddMsOpen(false);
  };

  const handleStartEditMilestone = (ms: Milestone) => {
    setEditingMilestoneId(ms.id);
    setEditMsTitle(ms.title);
    setEditMsDesc(ms.description || '');
    setEditMsTargetDate(ms.targetDate || '');
    setEditMsRole(ms.role || adminSelectedRole || 'BA');
  };

  const handleSaveMilestone = (msId: string) => {
    updateMilestone(msId, {
      title: editMsTitle,
      description: editMsDesc,
      targetDate: editMsTargetDate,
      role: (editMsRole || adminSelectedRole || 'BA') as Specialization,
    });
    setEditingMilestoneId(null);
  };

  // Toggle Done checkbox: Completed tasks automatically pushed to bottom
  const handleToggleTaskDone = (t: Task) => {
    if (!canToggleTaskCheck(t)) {
      confirmDialog({
        title: 'Không có quyền thao tác',
        message: 'Bạn chỉ có quyền đánh dấu hoàn thành cho các đầu việc được phân công cho mình.',
        confirmText: 'Đã hiểu',
        type: 'warning',
        cancelText: 'Đóng',
        onConfirm: () => {},
      });
      return;
    }
    const isDone = t.status === 'Done';
    const newStatus: TaskStatus = isDone ? 'To do' : 'Done';
    const newComp = isDone ? 0 : 100;
    updateTask(t.id, {
      status: newStatus,
      completionPercentage: newComp,
    });
  };

  // Drag and drop reorder within milestone
  const handleReorderMilestoneTasks = (
    milestoneId: string,
    sourceTaskId: string,
    targetTaskId: string
  ) => {
    const currentMsTasks = tasks
      .filter((t) => t.milestoneId === milestoneId && isTaskRoleMatch(t.role))
      .sort((a, b) => {
        const aDone = a.status === 'Done';
        const bDone = b.status === 'Done';
        if (aDone !== bDone) return aDone ? 1 : -1;
        return (a.orderInMilestone || 0) - (b.orderInMilestone || 0);
      });

    const sourceIndex = currentMsTasks.findIndex((t) => t.id === sourceTaskId);
    const targetIndex = currentMsTasks.findIndex((t) => t.id === targetTaskId);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

    const newOrdered = [...currentMsTasks];
    const [moved] = newOrdered.splice(sourceIndex, 1);
    newOrdered.splice(targetIndex, 0, moved);

    const orderedIds = newOrdered.map((t) => t.id);
    reorderTasksInMilestone(milestoneId, orderedIds);
  };

  const handleOpenBreakTaskForMilestone = (milestoneId: string, milestoneRole?: Specialization) => {
    setEditingTask(null);
    setTargetMilestoneId(milestoneId);
    const initRole =
      currentUser?.role === 'Leader' || currentUser?.role === 'Advisor'
        ? currentUser.specializations?.[0]
        : milestoneRole || (adminSelectedRole as Specialization) || 'BA';
    setModalInitialRole(initRole as Specialization);
    setIsTaskModalOpen(true);
  };

  const handleOpenCreateAdhocTask = () => {
    setEditingTask(null);
    setTargetMilestoneId('');
    const initRole =
      currentUser?.role === 'Leader' || currentUser?.role === 'Advisor'
        ? currentUser.specializations?.[0]
        : (adminSelectedRole as Specialization) || 'BA';
    setModalInitialRole(initRole as Specialization);
    setIsTaskModalOpen(true);
  };

  const renderTaskRow = (t: Task, idx: number, isDone: boolean, milestoneId?: string) => {
    const isDragging = draggedMilestoneTaskId === t.id;
    const isOver = dragOverTaskId === t.id && !isDragging;
    const canToggle = canToggleTaskCheck(t);
    const isUnread = hasUnreadNote(t);

    return (
      <React.Fragment key={t.id}>
        {/* DESKTOP ROW VIEW */}
        <div
          draggable={!isDone && (currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin')}
          onDragStart={(e) => {
            if (isDone) return;
            e.dataTransfer.setData('text/plain', t.id);
            e.dataTransfer.effectAllowed = 'move';
            setDraggedMilestoneTaskId(t.id);
          }}
          onDragOver={(e) => {
            if (isDone) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverTaskId !== t.id && draggedMilestoneTaskId !== t.id) {
              setDragOverTaskId(t.id);
            }
          }}
          onDragLeave={() => {
            if (dragOverTaskId === t.id) setDragOverTaskId(null);
          }}
          onDrop={(e) => {
            if (isDone || !milestoneId) return;
            e.preventDefault();
            e.stopPropagation();
            const sourceId = e.dataTransfer.getData('text/plain') || draggedMilestoneTaskId;
            setDragOverTaskId(null);
            setDraggedMilestoneTaskId(null);
            if (sourceId && sourceId !== t.id) {
              handleReorderMilestoneTasks(milestoneId, sourceId, t.id);
            }
          }}
          onDragEnd={() => {
            setDraggedMilestoneTaskId(null);
            setDragOverTaskId(null);
          }}
          onClick={() => setViewingDetailTask(t)}
          className={`p-3.5 transition-all hidden md:flex items-center justify-between gap-4 text-xs cursor-pointer group select-none ${
            isDone ? 'bg-emerald-50/30 hover:bg-emerald-50/70' : 'hover:bg-slate-50/90 bg-white'
          } ${
            isDragging ? 'opacity-35 bg-indigo-50/40 border border-dashed border-indigo-300' : ''
          } ${
            isOver ? 'border-t-2 border-indigo-500 bg-indigo-50/70' : ''
          }`}
          title={isDone ? 'Bấm để xem chi tiết task đã hoàn thành' : 'Kéo thả để sắp xếp thứ tự ưu tiên, hoặc bấm để xem chi tiết'}
        >
          {/* Left: Drag Handle, Checkbox, Index & Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {!isDone && milestoneId && (currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') && (
              <div
                className="text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing p-1 -ml-1 transition"
                title="Kéo thả để sắp xếp thứ tự ưu tiên"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-4 h-4" />
              </div>
            )}

            <button
              type="button"
              disabled={!canToggle}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTaskDone(t);
              }}
              className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 ${
                !canToggle
                  ? 'cursor-not-allowed opacity-40 ' +
                    (isDone
                      ? 'bg-emerald-300 border-2 border-emerald-500 text-white'
                      : 'border-2 border-slate-200 bg-slate-100 text-transparent')
                  : 'active:scale-90 cursor-pointer ' +
                    (isDone
                      ? 'bg-emerald-500 border-2 border-emerald-600 text-white shadow-xs'
                      : 'border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/60 text-transparent hover:text-emerald-400')
              }`}
              title={
                !canToggle
                  ? 'Chỉ người được giao việc hoặc Leader/Admin mới có quyền đánh dấu hoàn thành'
                  : isDone
                  ? 'Đánh dấu chưa hoàn thành (chuyển lại lên danh sách làm việc)'
                  : 'Đánh dấu đã hoàn thành (chuyển xuống danh sách công việc đã hoàn thành)'
              }
            >
              <Check className={`w-3.5 h-3.5 ${isDone ? 'stroke-[3]' : 'stroke-[2]'}`} />
            </button>

            <span className="w-5 text-center font-mono text-slate-400 font-bold shrink-0 text-[11px]">
              #{idx + 1}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`font-semibold transition truncate ${
                    isDone ? 'line-through text-slate-400' : 'text-slate-800 group-hover:text-indigo-600'
                  }`}
                >
                  {t.title}
                </span>
                {t.priority === 'High' && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded border bg-red-100 text-red-700 border-red-200 font-bold shrink-0 inline-flex items-center gap-0.5 shadow-2xs"
                    title="Mức độ ưu tiên: Cao"
                  >
                    <Flame className="w-2.5 h-2.5 text-red-500 fill-red-500" />
                    Ưu tiên cao
                  </span>
                )}
                <span className="text-[9px] px-1.5 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200 font-semibold shrink-0">
                  {t.role}
                </span>
                {isDone && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold shrink-0">
                    Đã xong
                  </span>
                )}
              </div>

              {t.description && (
                <p
                  className={`text-[11px] line-clamp-1 italic flex items-center gap-1 mt-0.5 ${
                    isDone ? 'text-slate-400 line-through' : 'text-slate-500'
                  }`}
                >
                  <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{t.description}</span>
                </p>
              )}

              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                <span>Effort: <strong className="text-indigo-600 font-mono">{t.estimatedEffort}h</strong></span>
                <span>•</span>
                <span>Phân công: <strong className="text-slate-600">{t.assigneeAccount || 'Chưa gán'}</strong></span>
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {!milestoneId && (currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') && (
              <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] text-slate-500 font-medium pl-1 hidden lg:inline">
                  Gán vào:
                </span>
                <Dropdown
                  value=""
                  onChange={(newMsId) => {
                    if (newMsId) {
                      updateTask(t.id, { milestoneId: newMsId });
                    }
                  }}
                  placeholder="-- Chọn Milestone để gán --"
                  options={filteredMilestones.map((m) => ({
                    value: m.id,
                    label: `🚩 ${m.title}`,
                  }))}
                  size="sm"
                  buttonClassName="py-1 px-2.5 text-[11px] font-semibold text-indigo-700 bg-white border-slate-200"
                />
              </div>
            )}

            <span
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border ${
                isDone
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : t.status === 'In Progress'
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-slate-100 text-slate-500 border-slate-300'
              }`}
            >
              {t.status}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                markNoteAsRead(t.id, t.notes);
                setDiscussingTask(t);
              }}
              className={`relative p-1.5 rounded-lg transition active:scale-95 ${
                isUnread
                  ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold ring-2 ring-amber-300 shadow-amber-400/40 animate-pulse'
                  : t.notes
                  ? 'text-slate-600 hover:text-amber-600 hover:bg-amber-50'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title={isUnread ? 'Có trao đổi / ghi chú mới chưa đọc!' : 'Ghi chú & Trao đổi luồng task'}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {isUnread && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border-2 border-white shadow-xs" />
              )}
            </button>

            {(canEditTask(t) || currentUser?.role === 'Admin') && (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateTask(t.id);
                  }}
                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                  title="Nhân bản task này (Duplicate)"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTask(t);
                    setTargetMilestoneId(t.milestoneId || milestoneId || '');
                    setModalInitialRole(t.role);
                    setIsTaskModalOpen(true);
                  }}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                  title="Sửa task"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmDialog({
                      title: 'Xác nhận xóa đầu việc',
                      message: `Bạn có chắc chắn muốn xóa đầu việc "${t.title}"? Thao tác này không thể hoàn tác.`,
                      confirmText: 'Xác nhận xóa',
                      type: 'danger',
                      onConfirm: () => deleteTask(t.id),
                    });
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  title="Xóa task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE CARD VIEW */}
        <div
          onClick={() => setViewingDetailTask(t)}
          className={`md:hidden p-3.5 transition-all space-y-2.5 cursor-pointer ${
            isDone ? 'bg-emerald-50/40 border-l-4 border-emerald-400' : 'bg-white'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={!canToggle}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleTaskDone(t);
                }}
                className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 ${
                  !canToggle
                    ? 'cursor-not-allowed opacity-40 ' +
                      (isDone
                        ? 'bg-emerald-300 border-2 border-emerald-500 text-white'
                        : 'border-2 border-slate-200 bg-slate-100 text-transparent')
                    : 'active:scale-90 cursor-pointer ' +
                      (isDone
                        ? 'bg-emerald-500 border-2 border-emerald-600 text-white shadow-xs'
                        : 'border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/60 text-transparent hover:text-emerald-400')
                }`}
              >
                <Check className={`w-3.5 h-3.5 ${isDone ? 'stroke-[3]' : 'stroke-[2]'}`} />
              </button>
              <span className="font-mono text-slate-400 font-bold text-xs">
                #{idx + 1}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200 font-bold">
                {t.role}
              </span>
              {t.priority === 'High' && (
                <span className="text-[10px] px-2 py-0.5 rounded border bg-red-100 text-red-700 border-red-200 font-bold inline-flex items-center gap-1">
                  <Flame className="w-3 h-3 text-red-500 fill-red-500" />
                  Ưu tiên cao
                </span>
              )}
            </div>

            <span
              className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${
                isDone
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : t.status === 'In Progress'
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-slate-100 text-slate-500 border-slate-300'
              }`}
            >
              {t.status}
            </span>
          </div>

          <h4 className={`text-xs font-bold leading-snug ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {t.title}
          </h4>

          {t.description && (
            <p className="text-[11px] text-slate-500 line-clamp-2 italic">
              {t.description}
            </p>
          )}

          {!milestoneId && (currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') && (
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] text-slate-500 font-bold">Gán vào:</span>
              <Dropdown
                value=""
                onChange={(newMsId) => {
                  if (newMsId) {
                    updateTask(t.id, { milestoneId: newMsId });
                  }
                }}
                placeholder="-- Chọn Milestone --"
                options={filteredMilestones.map((m) => ({
                  value: m.id,
                  label: `🚩 ${m.title}`,
                }))}
                size="sm"
                className="flex-1"
                buttonClassName="py-1 px-2 text-[10px] font-semibold text-indigo-700 bg-white border-slate-200"
              />
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 gap-2">
            <div className="text-[11px] text-slate-500">
              👤 <strong className="text-slate-700">{t.assigneeAccount || 'Chưa gán'}</strong>
              <span className="mx-1.5">•</span>
              Effort: <strong className="text-indigo-600 font-mono">{t.estimatedEffort}h</strong>
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markNoteAsRead(t.id, t.notes);
                  setDiscussingTask(t);
                }}
                className={`p-1.5 rounded-lg text-xs font-semibold transition active:scale-95 flex items-center gap-1 ${
                  isUnread
                    ? 'bg-amber-400 text-amber-950 font-bold ring-2 ring-amber-300'
                    : t.notes
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>

              {(canEditTask(t) || currentUser?.role === 'Admin') && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateTask(t.id);
                    }}
                    className="p-1.5 bg-slate-100 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg active:scale-95"
                    title="Nhân bản task này (Duplicate)"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTask(t);
                      setTargetMilestoneId(t.milestoneId || milestoneId || '');
                      setModalInitialRole(t.role);
                      setIsTaskModalOpen(true);
                    }}
                    className="p-1.5 bg-slate-100 text-slate-600 rounded-lg active:scale-95"
                    title="Sửa task"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDialog({
                        title: 'Xác nhận xóa đầu việc',
                        message: `Bạn có chắc chắn muốn xóa đầu việc "${t.title}"?`,
                        confirmText: 'Xác nhận xóa',
                        type: 'danger',
                        onConfirm: () => deleteTask(t.id),
                      });
                    }}
                    className="p-1.5 bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg active:scale-95"
                    title="Xóa task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">
                <span className="sm:hidden">Quản Lý Milestones</span>
                <span className="hidden sm:inline">Quản Lý Milestones & Break Tasks</span>
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                {currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin' ? 'Leader, Advisor & Admin' : 'Thành viên'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Quản lý các cột mốc Milestone, bẻ task từ milestone cho thành viên hoặc quản lý các đầu việc phát sinh.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {subTab === 'MILESTONES' ? (
              (currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') && (
                <button
                  onClick={() => setIsAddMsOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold rounded-xl shadow-md shadow-amber-500/20 transition active:scale-95 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Tạo Milestone Mới
                </button>
              )
            ) : (
              <button
                onClick={handleOpenCreateAdhocTask}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition active:scale-95 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Tạo Task Tự Do Mới
              </button>
            )}
          </div>
        </div>

        {/* Navigation Sub-Tabs Switcher & Role Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 w-full sm:w-fit gap-1">
            <button
              onClick={() => setSubTab('MILESTONES')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
                subTab === 'MILESTONES'
                  ? 'bg-white text-amber-700 shadow-sm shadow-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Flag className="w-3.5 h-3.5 text-amber-500" />
              <span className="sm:hidden">Milestones ({filteredMilestones.length})</span>
              <span className="hidden sm:inline">Cột Mốc Milestone ({filteredMilestones.length})</span>
            </button>
            <button
              onClick={() => setSubTab('ADHOC')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
                subTab === 'ADHOC'
                  ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Inbox className="w-3.5 h-3.5 text-indigo-500" />
              <span className="sm:hidden">Task Tự Do ({filteredAdhocTasks.length})</span>
              <span className="hidden sm:inline">Task Tự Do & Phát Sinh ({filteredAdhocTasks.length})</span>
            </button>
          </div>

          {/* Role & Member Filter Controls */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3">
            {/* Member / Assignee Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600 shrink-0 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                Lọc Thành Viên:
              </span>
              <Dropdown
                value={assigneeFilter}
                onChange={setAssigneeFilter}
                options={[
                  { value: 'ALL', label: 'Tất cả thành viên' },
                  { value: 'UNASSIGNED', label: 'Chưa phân công' },
                  ...users
                    .filter((u) => isMemberInRole(u, adminSelectedRole))
                    .map((u) => ({
                      value: u.account,
                      label: u.name ? `${u.name} (@${u.account})` : `@${u.account}`,
                    })),
                ]}
                size="sm"
                buttonClassName="py-1.5 px-3 text-xs font-bold bg-white border-slate-300 text-indigo-700 shadow-2xs hover:border-indigo-400"
              />
            </div>

            {/* Role Selector Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600 shrink-0">
                Lọc Role:
              </span>
              <Dropdown
                value={adminSelectedRole}
                onChange={(val) => {
                  setAdminSelectedRole(val);
                  setMsRole(val);
                  setAssigneeFilter('ALL');
                }}
                options={roles.map((r) => ({
                  value: r.code,
                  label: `Role ${r.code} (${r.name})`,
                }))}
                size="sm"
                buttonClassName="py-1.5 px-3 text-xs font-bold bg-white border-slate-300 text-indigo-700 shadow-2xs hover:border-indigo-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add Milestone Form */}
      {subTab === 'MILESTONES' && isAddMsOpen && (
        <form
          onSubmit={handleCreateMilestone}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 tab-content-animate"
        >
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            Tạo Cột Mốc Milestone Mới
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Tên Milestone:</label>
              <input
                type="text"
                placeholder={`VD: Milestone ${filteredMilestones.length + 1}: Tên cột mốc...`}
                value={msTitle}
                onChange={(e) => setMsTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Role Áp Dụng:</label>
              {currentUser?.role === 'Admin' ? (
                <Dropdown
                  value={msRole || adminSelectedRole || roles[0]?.code || 'BA'}
                  onChange={setMsRole}
                  options={roles.map((r) => ({
                    value: r.code,
                    label: `Role ${r.code} (${r.name})`,
                  }))}
                  className="w-full"
                  buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-300"
                />
              ) : (
                <div className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-slate-700 text-xs font-semibold flex items-center justify-between">
                  <span>{currentUser?.specializations?.[0] || adminSelectedRole || 'BA'}</span>
                  <span className="text-[10px] text-slate-400 font-normal">Theo Leader</span>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Ngày Hoàn Thành Mục Tiêu:</label>
              <input
                type="date"
                value={msTargetDate}
                onChange={(e) => setMsTargetDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Mô tả mục tiêu:</label>
            <input
              type="text"
              placeholder="Chi tiết yêu cầu của milestone..."
              value={msDesc}
              onChange={(e) => setMsDesc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddMsOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-600 text-xs rounded-xl hover:bg-slate-200 transition active:scale-95"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 text-white text-xs font-semibold rounded-xl hover:bg-amber-400 shadow-md transition active:scale-95"
            >
              Lưu Milestone
            </button>
          </div>
        </form>
      )}

      {/* TAB 1: MILESTONES LIST */}
      {subTab === 'MILESTONES' && (
        <div className="space-y-4 tab-content-animate">
          {filteredMilestones.length > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-500 pb-0.5 px-0.5">
              <span className="font-semibold text-slate-700">
                Hiển thị {filteredMilestones.length} cột mốc ({tasks.filter((t) => t.milestoneId && isTaskRoleMatch(t.role)).length} đầu việc)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-amber-800 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-lg transition active:scale-95 shadow-2xs cursor-pointer flex items-center gap-1"
                  title="Thu gọn tất cả các Milestone"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Thu gọn tất cả</span>
                </button>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-amber-800 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-lg transition active:scale-95 shadow-2xs cursor-pointer flex items-center gap-1"
                  title="Mở rộng tất cả các Milestone"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Mở rộng tất cả</span>
                </button>
              </div>
            </div>
          )}

          {filteredMilestones.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <FolderOpen className="w-8 h-8 text-slate-300" />
              <span className="font-semibold text-slate-600">
                Chưa có cột mốc Milestone nào thuộc chuyên môn / bộ lọc này.
              </span>
              <span className="text-slate-400">
                {currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin'
                  ? 'Hãy bấm "Tạo Milestone Mới" để thiết lập cột mốc và break task.'
                  : 'Cột mốc và đầu việc của chuyên môn này sẽ xuất hiện khi Leader phân bổ.'}
              </span>
            </div>
          ) : (
            filteredMilestones.map((ms, index) => {
              const msOrderNumber = index + 1;
              const displayTitle = formatMilestoneTitle(ms.title, msOrderNumber);
              const msTasksAll = tasks.filter(
                (t) => t.milestoneId === ms.id && isTaskRoleMatch(t.role) && isTaskAssigneeMatch(t)
              );
              const activeMsTasks = sortActiveTasks(msTasksAll.filter((t) => t.status !== 'Done'));
              const doneMsTasks = msTasksAll.filter((t) => t.status === 'Done');

              const totalHours = msTasksAll.reduce((acc, t) => acc + (t.estimatedEffort || 0), 0);
              const doneCount = doneMsTasks.length;
              const progress = msTasksAll.length > 0 ? Math.round((doneCount / msTasksAll.length) * 100) : 0;
              const isEditing = editingMilestoneId === ms.id;
              const isCollapsed = collapsedMilestones.has(ms.id);
              const isDoneCollapsed = collapsedDoneSections.has(ms.id);

              return (
                <div
                  key={ms.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                >
                  {/* Milestone Header Bar (Click to Collapse / Expand) */}
                  <div
                    onClick={() => {
                      if (!isEditing) {
                        toggleCollapseMilestone(ms.id);
                      }
                    }}
                    className={`bg-amber-50/70 p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors cursor-pointer select-none hover:bg-amber-100/60 ${
                      isCollapsed ? '' : 'border-b border-amber-100'
                    }`}
                    title={isCollapsed ? 'Bấm để mở rộng danh sách task trong Milestone' : 'Bấm để thu gọn Milestone'}
                  >
                    <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 font-bold text-sm shadow-2xs">
                          {msOrderNumber}
                        </div>
                        <div className="w-6 h-6 rounded-lg text-amber-700 hover:bg-amber-200/60 flex items-center justify-center transition">
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-300 ease-in-out ${
                              isCollapsed ? '-rotate-90 text-amber-600' : 'rotate-0 text-amber-800'
                            }`}
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0" onClick={(e) => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              value={editMsTitle}
                              onChange={(e) => setEditMsTitle(e.target.value)}
                              className="w-full bg-white border border-amber-300 rounded-lg px-2 py-1 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-400"
                            />
                            <input
                              value={editMsDesc}
                              onChange={(e) => setEditMsDesc(e.target.value)}
                              placeholder="Mô tả..."
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-amber-400"
                            />
                            <input
                              type="date"
                              value={editMsTargetDate}
                              onChange={(e) => setEditMsTargetDate(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-amber-400"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveMilestone(ms.id)}
                                className="px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-400 transition"
                              >
                                Lưu
                              </button>
                              <button
                                onClick={() => setEditingMilestoneId(null)}
                                className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200 transition"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                              {displayTitle}
                              {ms.role && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Role: {ms.role}
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-500 border border-slate-200 font-medium">
                                {msTasksAll.length} đầu việc
                              </span>
                              {isCollapsed && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                                  Đã thu gọn
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">{ms.description}</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Tiến độ Milestone</span>
                        <span className="font-bold text-emerald-600">{progress}% hoàn thành</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Tổng Effort</span>
                        <span className="font-bold text-indigo-600 font-mono">{totalHours}h</span>
                      </div>

                      {canManageMilestone(ms) && !isEditing && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleStartEditMilestone(ms)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition"
                            title="Sửa milestone"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              confirmDialog({
                                title: 'Xác nhận xóa Milestone',
                                message: `Bạn có chắc chắn muốn xóa cột mốc "${ms.title}"? Tất cả các đầu việc trong milestone này cũng sẽ bị xóa vĩnh viễn.`,
                                confirmText: 'Xác nhận xóa',
                                type: 'danger',
                                onConfirm: () => deleteMilestone(ms.id),
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Xóa milestone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenBreakTaskForMilestone(ms.id, ms.role)}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                            title={`Tạo và break task trực tiếp vào ${ms.title}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Break Task
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tasks List inside Milestone */}
                  <div
                    className={`accordion-wrapper ${
                      isCollapsed ? 'accordion-closed' : 'accordion-open'
                    }`}
                  >
                    <div className="accordion-content">
                      <div className="divide-y divide-slate-100">
                        {msTasksAll.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-xs">
                            Chưa có đầu việc nào được break trong cột mốc này cho bộ lọc hiện tại.
                          </div>
                        ) : activeMsTasks.length === 0 && doneMsTasks.length > 0 ? (
                          <div className="py-6 text-center text-emerald-600 font-semibold text-xs bg-emerald-50/30">
                            🎉 Tất cả các đầu việc trong cột mốc này đã hoàn thành! (xem ở phần bên dưới)
                          </div>
                        ) : (
                          activeMsTasks.map((t, idx) => renderTaskRow(t, idx, false, ms.id))
                        )}
                      </div>

                      {/* Separate Collapsable Done Tasks Card */}
                      {doneMsTasks.length > 0 && (
                        <div className="m-3 border border-emerald-200 bg-emerald-50/40 rounded-xl overflow-hidden shadow-2xs">
                          {/* Card Toggle Header */}
                          <div
                            onClick={() => toggleCollapseDoneSection(ms.id)}
                            className="bg-emerald-100/70 hover:bg-emerald-200/70 p-3 flex items-center justify-between cursor-pointer select-none transition"
                            title={isDoneCollapsed ? 'Bấm để mở rộng các công việc đã hoàn thành' : 'Bấm để thu gọn'}
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="text-xs font-bold text-emerald-900">
                                Các công việc đã hoàn thành ({doneMsTasks.length})
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 font-bold">
                                {doneMsTasks.reduce((acc, t) => acc + (t.estimatedEffort || 0), 0)}h effort
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold">
                              <span>{isDoneCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 ${
                                  isDoneCollapsed ? '-rotate-90 text-emerald-600' : 'rotate-0 text-emerald-800'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Card Tasks Content */}
                          {!isDoneCollapsed && (
                            <div className="divide-y divide-emerald-100/80 bg-white/80">
                              {doneMsTasks.map((t, idx) => renderTaskRow(t, idx, true, ms.id))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: AD-HOC & UNASSIGNED MILESTONE TASKS VIEW */}
      {subTab === 'ADHOC' && (() => {
        const adhocActiveTasks = sortActiveTasks(filteredAdhocTasks.filter((t) => t.status !== 'Done'));
        const adhocDoneTasks = filteredAdhocTasks.filter((t) => t.status === 'Done');
        const isAdhocDoneCollapsed = collapsedDoneSections.has('adhoc');

        return (
          <div className="bg-white border-2 border-indigo-200/80 rounded-2xl overflow-hidden shadow-sm tab-content-animate">
            {/* Adhoc Section Header (Click to Collapse / Expand) */}
            <div
              onClick={() => setIsAdhocCollapsed(!isAdhocCollapsed)}
              className={`bg-indigo-50/70 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors cursor-pointer select-none hover:bg-indigo-100/60 ${
                isAdhocCollapsed ? '' : 'border-b border-indigo-100'
              }`}
              title={isAdhocCollapsed ? 'Bấm để mở rộng' : 'Bấm để thu gọn'}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-700 font-bold shadow-2xs">
                    <Inbox className="w-4 h-4" />
                  </div>
                  <div className="w-6 h-6 rounded-lg text-indigo-700 hover:bg-indigo-200/60 flex items-center justify-center transition">
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-300 ease-in-out ${
                        isAdhocCollapsed ? '-rotate-90 text-indigo-500' : 'rotate-0 text-indigo-700'
                      }`}
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    Task Tự Do & Phát Sinh (Ngoài Milestone)
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200 font-bold">
                      {filteredAdhocTasks.length} đầu việc
                    </span>
                    {isAdhocCollapsed && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold">
                        Đã thu gọn
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Các task phát sinh độc lập, chưa gắn vào cột mốc cụ thể nào. Leader có thể gán nhanh vào Milestone bất kỳ hoặc quản lý/xoá tại đây.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs shrink-0" onClick={(e) => e.stopPropagation()}>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Tổng Effort</span>
                  <span className="font-bold text-indigo-600 font-mono">
                    {filteredAdhocTasks.reduce((acc, t) => acc + (t.estimatedEffort || 0), 0)}h
                  </span>
                </div>
              </div>
            </div>

            {/* Adhoc Tasks List */}
            <div
              className={`accordion-wrapper ${
                isAdhocCollapsed ? 'accordion-closed' : 'accordion-open'
              }`}
            >
              <div className="accordion-content">
                <div className="divide-y divide-slate-100">
                  {filteredAdhocTasks.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                      <FolderOpen className="w-8 h-8 text-slate-300" />
                      <span className="font-medium text-slate-600">Hiện không có task phát sinh ngoài milestone nào phù hợp.</span>
                      <span className="text-slate-400">Tất cả các đầu việc hiện tại đều đã được gán vào các Cột Mốc Milestone hoặc thuộc bộ lọc khác.</span>
                    </div>
                  ) : adhocActiveTasks.length === 0 && adhocDoneTasks.length > 0 ? (
                    <div className="py-6 text-center text-emerald-600 font-semibold text-xs bg-emerald-50/30">
                      🎉 Tất cả các task tự do & phát sinh đã hoàn thành! (xem ở phần bên dưới)
                    </div>
                  ) : (
                    adhocActiveTasks.map((t, idx) => renderTaskRow(t, idx, false))
                  )}
                </div>

                {/* Separate Collapsable Done Tasks Card */}
                {adhocDoneTasks.length > 0 && (
                  <div className="m-3 border border-emerald-200 bg-emerald-50/40 rounded-xl overflow-hidden shadow-2xs">
                    {/* Card Toggle Header */}
                    <div
                      onClick={() => toggleCollapseDoneSection('adhoc')}
                      className="bg-emerald-100/70 hover:bg-emerald-200/70 p-3 flex items-center justify-between cursor-pointer select-none transition"
                      title={isAdhocDoneCollapsed ? 'Bấm để mở rộng các công việc đã hoàn thành' : 'Bấm để thu gọn'}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-emerald-900">
                          Các công việc đã hoàn thành ({adhocDoneTasks.length})
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 font-bold">
                          {adhocDoneTasks.reduce((acc, t) => acc + (t.estimatedEffort || 0), 0)}h effort
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold">
                        <span>{isAdhocDoneCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isAdhocDoneCollapsed ? '-rotate-90 text-emerald-600' : 'rotate-0 text-emerald-800'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Card Tasks Content */}
                    {!isAdhocDoneCollapsed && (
                      <div className="divide-y divide-emerald-100/80 bg-white/80">
                        {adhocDoneTasks.map((t, idx) => renderTaskRow(t, idx, true))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Task Discussion Modal (Only Notes & Stream) */}
      <TaskDiscussionModal
        task={discussingTask}
        isOpen={!!discussingTask}
        onClose={() => setDiscussingTask(null)}
        onOpenFullDetail={(t) => setViewingDetailTask(t)}
      />

      {/* Task Detail & Collaborative Notes Discussion Modal */}
      <TaskDetailModal
        task={viewingDetailTask}
        isOpen={!!viewingDetailTask}
        onClose={() => setViewingDetailTask(null)}
      />

      {/* Task Creation & Edit Modal with Strict Synchronization */}
      <TaskModal
        key={`${targetMilestoneId}-${editingTask?.id || 'new'}-${modalInitialRole || 'def'}-${isTaskModalOpen}`}
        task={editingTask}
        isOpen={isTaskModalOpen}
        initialMilestoneId={targetMilestoneId}
        initialRole={modalInitialRole}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
          setModalInitialRole(undefined);
        }}
      />
    </div>
  );
};
