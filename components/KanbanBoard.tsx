'use client';

import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus } from '../types/task';
import { WeeklyReportModal } from './WeeklyReportModal';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskDiscussionModal } from './TaskDiscussionModal';
import {
  AlertTriangle,
  Award,
  Plus,
  Edit2,
  MessageSquare,
  UserX,
  Clock,
  Flag,
  FolderOpen,
  GripVertical,
  FileText,
  Flame,
} from 'lucide-react';

interface KanbanBoardProps {
  onOpenTaskModal?: (task?: Task) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ onOpenTaskModal }) => {
  const {
    tasks,
    milestones,
    updateTask,
    weeklyAwards,
    currentUser,
    canReportTask,
    confirmDialog,
    roles,
    selectedWeek,
    selectedYear,
  } = useApp();

  const currentWeekTasks = React.useMemo(() => {
    return tasks.filter(
      (t) => t.weekNumber === selectedWeek && (!t.year || t.year === selectedYear)
    );
  }, [tasks, selectedWeek, selectedYear]);

  const [reportingTask, setReportingTask] = useState<Task | null>(null);
  const [viewingDetailTask, setViewingDetailTask] = useState<Task | null>(null);
  const [discussingTask, setDiscussingTask] = useState<Task | null>(null);
  const [mobileActiveStatus, setMobileActiveStatus] = useState<TaskStatus>('To do');

  // Drag and drop tracking refs and states
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const draggedTaskIdRef = useRef<string | null>(null);
  const dragCounters = useRef<Record<string, number>>({});
  const isDraggingActiveRef = useRef(false);

  const columns: {
    status: TaskStatus;
    title: string;
    bgColor: string;
    borderColor: string;
    headerBg: string;
    badgeColor: string;
  }[] = [
    {
      status: 'To do',
      title: 'To Do (Cần làm)',
      bgColor: 'bg-slate-50/70',
      borderColor: 'border-slate-200',
      headerBg: 'bg-slate-100/90 border-slate-200 text-slate-700',
      badgeColor: 'bg-slate-200 text-slate-700',
    },
    {
      status: 'In Progress',
      title: 'In Progress (Đang làm)',
      bgColor: 'bg-blue-50/40',
      borderColor: 'border-blue-200/90',
      headerBg: 'bg-blue-50 border-blue-200 text-blue-800',
      badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
      status: 'Done',
      title: 'Done (Đã hoàn thành)',
      bgColor: 'bg-emerald-50/40',
      borderColor: 'border-emerald-200/90',
      headerBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      badgeColor: 'bg-emerald-100 text-emerald-700',
    },
  ];

  const getPriorityRank = (priority?: string): number => {
    if (priority === 'High') return 1;
    if (priority === 'Low') return 3;
    return 2;
  };

  const sortByPriority = (a: Task, b: Task): number => {
    const rankA = getPriorityRank(a.priority);
    const rankB = getPriorityRank(b.priority);
    return rankA - rankB;
  };

  const isTopEffortAccount = (acc: string) => {
    if (!acc) return false;
    const award = weeklyAwards.find((w) => w.account === acc);
    return award?.isTopEffort || false;
  };

  const canMoveTask = (t: Task) => {
    if (currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') return true;
    return (
      !!t.assigneeAccount &&
      t.assigneeAccount.toLowerCase() === currentUser?.account.toLowerCase()
    );
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask || currentTask.status === newStatus) return;

    const hasPermission =
      currentUser?.role === 'Leader' ||
      currentUser?.role === 'Advisor' ||
      currentUser?.role === 'Admin' ||
      (currentTask.assigneeAccount &&
        currentTask.assigneeAccount.toLowerCase() === currentUser?.account.toLowerCase());

    if (!hasPermission) {
      confirmDialog({
        title: 'Không có quyền thao tác',
        message: 'Chỉ Leader/Advisor/Admin hoặc người được giao task mới có quyền chuyển trạng thái task này.',
        confirmText: 'Đã hiểu',
        type: 'warning',
        cancelText: 'Đóng',
        onConfirm: () => {},
      });
      return;
    }

    let newComp = currentTask.completionPercentage;
    if (newStatus === 'Done') {
      newComp = 100;
    } else if (newStatus === 'To do') {
      newComp = 0;
    } else if (newStatus === 'In Progress') {
      if (newComp === 0 || newComp === 100) newComp = 50;
    }

    updateTask(taskId, {
      status: newStatus,
      completionPercentage: newComp,
    });
  };

  const getRoleStyle = (roleCode: string) => {
    const rObj = roles.find((r) => r.code === roleCode);
    const color = rObj?.color;
    switch (color) {
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'blue':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'indigo':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'cyan':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const renderKanbanCard = (t: Task, isMobile: boolean = false) => {
    const isTop = isTopEffortAccount(t.assigneeAccount);
    const isLate = t.isSubmittedLate;
    const isAssignedToMe = canReportTask(t);
    const canMove = canMoveTask(t);
    const isBeingDragged = draggedTaskId === t.id;
    const milestone = milestones.find((m) => m.id === t.milestoneId);

    return (
      <div
        key={t.id}
        draggable={!isMobile && canMove}
        onDragStart={(e) => {
          if (isMobile || !canMove) return;
          isDraggingActiveRef.current = true;
          draggedTaskIdRef.current = t.id;
          e.dataTransfer.setData('text/plain', t.id);
          e.dataTransfer.effectAllowed = 'move';
          requestAnimationFrame(() => {
            setDraggedTaskId(t.id);
          });
        }}
        onDragEnd={() => {
          dragCounters.current = {};
          draggedTaskIdRef.current = null;
          setDraggedTaskId(null);
          setDragOverColumn(null);
          setTimeout(() => {
            isDraggingActiveRef.current = false;
          }, 100);
        }}
        onClick={() => {
          if (isDraggingActiveRef.current) return;
          setViewingDetailTask(t);
        }}
        className={`bg-white dark:bg-slate-900 border rounded-xl p-3.5 shadow-2xs space-y-2.5 transition-colors cursor-pointer group relative select-none ${
          isBeingDragged
            ? 'opacity-40 border-dashed border-indigo-400 bg-slate-50'
            : isLate
            ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 hover:border-red-400'
            : isTop
            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 hover:border-emerald-400'
            : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
        } ${!isMobile && canMove ? 'hover:cursor-grab active:cursor-grabbing' : ''}`}
      >
        {/* Top Meta: Role + Milestone + Alert Badges + Drag Grip */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getRoleStyle(
                t.role
              )}`}
            >
              {t.role}
            </span>

            {milestone ? (
              <span
                className="inline-flex items-center gap-1 text-[9px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 px-1.5 py-0.5 rounded truncate max-w-[130px]"
                title={milestone.title}
              >
                <Flag className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                <span className="truncate">{milestone.title}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                <FolderOpen className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                Ngoài MS
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {t.priority === 'High' && (
              <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-[8px] font-bold rounded-full flex items-center gap-0.5" title="Ưu tiên cao">
                <Flame className="w-2.5 h-2.5 text-red-500 fill-red-500" /> Ưu tiên cao
              </span>
            )}
            {isLate && (
              <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-[8px] font-bold rounded-full flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5 text-red-500" /> PHẠT
              </span>
            )}
            {isTop && (
              <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[8px] font-bold rounded-full flex items-center gap-0.5">
                <Award className="w-2.5 h-2.5 text-emerald-600" /> THƯỞNG
              </span>
            )}

            {!isMobile && canMove && (
              <span title="Kéo thả thẻ này để chuyển trạng thái">
                <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition shrink-0" />
              </span>
            )}
          </div>
        </div>

        {/* Title & Description Preview */}
        <div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
            {t.title}
          </h4>

          {t.description && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400 shrink-0" />
              {t.description.replace(/\[[ xX]\]/g, '').replace(/[-*#]/g, '').trim()}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Tiến độ</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{t.completionPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-200/60 dark:border-slate-700">
            <div
              className={`h-full transition-all duration-300 ${
                t.completionPercentage === 100
                  ? 'bg-emerald-500'
                  : t.completionPercentage > 0
                  ? 'bg-blue-500'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
              style={{ width: `${t.completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Card Footer: Assignee, Effort & Quick Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
          {/* Assignee & Effort */}
          <div className="flex items-center gap-2 min-w-0">
            {t.assigneeAccount ? (
              <div className="flex items-center gap-1 min-w-0" title={`Giao cho @${t.assigneeAccount}`}>
                <div className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-[8px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                  {t.assigneeAccount.slice(0, 2)}
                </div>
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300 truncate max-w-[70px]">
                  {t.assigneeAccount}
                </span>
              </div>
            ) : (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5">
                <UserX className="w-3 h-3" /> Trống
              </span>
            )}

            <span className="text-slate-300 dark:text-slate-600 text-[10px]">•</span>

            <span className="font-mono text-[10px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
              {t.actualEffort ?? t.estimatedEffort}h
            </span>
          </div>

          {/* Quick Action Icons */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDiscussingTask(t);
              }}
              className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
              title="Ghi chú & Trao đổi luồng task"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>

            {isAssignedToMe && (
              <button
                onClick={() => setReportingTask(t)}
                className="whitespace-nowrap inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-200/90 dark:border-indigo-800 rounded-lg text-[10px] font-semibold transition shadow-2xs cursor-pointer"
                title="Nộp báo cáo"
              >
                <Clock className="w-3 h-3 shrink-0" />
                <span>Báo cáo</span>
              </button>
            )}

            {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') && (
              <button
                onClick={() => onOpenTaskModal?.(t)}
                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                title="Chỉnh sửa task"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Quick Status Switcher */}
        {isMobile && canMove && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] text-slate-400 mr-auto">Chuyển:</span>
            {columns
              .filter((c) => c.status !== t.status)
              .map((c) => (
                <button
                  key={c.status}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(t.id, c.status);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 active:scale-95 transition cursor-pointer"
                >
                  → {c.status}
                </button>
              ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
              <span className="sm:hidden">Bảng Kanban</span>
              <span className="hidden sm:inline">Bảng Kanban Trực Quan</span>
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
              <span className="sm:hidden">1 chạm</span>
              <span className="hidden sm:inline">Kéo thả chuyển trạng thái</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kéo thả thẻ task giữa các cột để cập nhật trạng thái tức thì, hoặc bấm vào thẻ để xem chi tiết & trao đổi luồng task.
          </p>
        </div>

        {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') && (
          <button
            onClick={() => onOpenTaskModal?.()}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tạo Task Mới
          </button>
        )}
      </div>

      {/* MOBILE VIEW: Segmented Column Switcher & Card List */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 gap-1">
          {columns.map((col) => {
            const count = currentWeekTasks.filter((t) => t.status === col.status).length;
            const isActive = mobileActiveStatus === col.status;
            return (
              <button
                key={col.status}
                onClick={() => setMobileActiveStatus(col.status)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span>{col.status}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile Active Column Cards */}
        {(() => {
          const colTasks = [...currentWeekTasks.filter((t) => t.status === mobileActiveStatus)].sort(sortByPriority);
          if (colTasks.length === 0) {
            return (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                <FolderOpen className="w-6 h-6 text-slate-300" />
                <span>Chưa có task nào ở trạng thái {mobileActiveStatus}.</span>
              </div>
            );
          }
          return (
            <div className="space-y-3">
              {colTasks.map((t) => renderKanbanCard(t, true))}
            </div>
          );
        })()}
      </div>

      {/* DESKTOP VIEW: 3-Column Kanban Grid */}
      <div className="hidden md:grid grid-cols-3 gap-5 items-stretch h-[calc(100vh-210px)] min-h-[640px] max-h-[900px]">
        {columns.map((col) => {
          const colTasks = [...currentWeekTasks.filter((t) => t.status === col.status)].sort(sortByPriority);
          const isOver = dragOverColumn === col.status;
          const activeTask = tasks.find((t) => t.id === draggedTaskIdRef.current);
          const isTargetDifferent = activeTask && activeTask.status !== col.status;

          return (
            <div
              key={col.status}
              onDragEnter={(e) => {
                e.preventDefault();
                dragCounters.current[col.status] = (dragCounters.current[col.status] || 0) + 1;
                const activeId = draggedTaskIdRef.current;
                const curr = tasks.find((t) => t.id === activeId);
                if (curr && curr.status !== col.status) {
                  setDragOverColumn(col.status);
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDragLeave={() => {
                dragCounters.current[col.status] = Math.max(0, (dragCounters.current[col.status] || 0) - 1);
                if (dragCounters.current[col.status] === 0) {
                  if (dragOverColumn === col.status) {
                    setDragOverColumn(null);
                  }
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                dragCounters.current = {};
                setDragOverColumn(null);
                const taskId = e.dataTransfer.getData('text/plain') || draggedTaskIdRef.current;
                draggedTaskIdRef.current = null;
                setDraggedTaskId(null);
                if (taskId) {
                  handleStatusChange(taskId, col.status);
                }
              }}
              className={`border rounded-2xl overflow-hidden shadow-xs flex flex-col h-full transition-colors duration-150 ${
                col.bgColor
              } ${
                isOver && isTargetDifferent
                  ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/60 shadow-md'
                  : col.borderColor
              }`}
            >
              {/* Column Header */}
              <div
                className={`flex items-center justify-between p-3.5 border-b transition-colors ${
                  isOver && isTargetDifferent
                    ? 'bg-indigo-100/90 border-indigo-300 text-indigo-900'
                    : col.headerBg
                }`}
              >
                <h3 className="text-xs font-bold flex items-center gap-2">
                  <span>{col.title}</span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold shadow-2xs ${
                      isOver && isTargetDifferent ? 'bg-indigo-200 text-indigo-900' : col.badgeColor
                    }`}
                  >
                    {colTasks.length}
                  </span>
                </h3>

                {isOver && isTargetDifferent && (
                  <span className="pointer-events-none text-[10px] font-bold text-indigo-700 bg-white/95 px-2 py-0.5 rounded-full shadow-2xs">
                    Thả để chuyển trạng thái
                  </span>
                )}
              </div>

              {/* Column Task Cards */}
              <div className="space-y-3 flex-1 overflow-y-auto p-3.5">
                {colTasks.length === 0 ? (
                  <div className="py-14 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-white/70 border border-slate-200/80 flex items-center justify-center text-slate-300">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <span className="italic">Chưa có task nào ở cột này.</span>
                  </div>
                ) : (
                  colTasks.map((t) => renderKanbanCard(t, false))
                )}

                {/* Drop Target Helper when dragging over column */}
                {isOver && isTargetDifferent && (
                  <div className="pointer-events-none border-2 border-dashed border-indigo-400 rounded-xl p-3 text-center text-xs text-indigo-700 font-semibold bg-indigo-50/80">
                    + Thả vào đây để chuyển sang {col.title}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <TaskDiscussionModal
        task={discussingTask}
        isOpen={!!discussingTask}
        onClose={() => setDiscussingTask(null)}
        onOpenFullDetail={(t) => setViewingDetailTask(t)}
      />

      <TaskDetailModal
        task={viewingDetailTask}
        isOpen={!!viewingDetailTask}
        onClose={() => setViewingDetailTask(null)}
        onOpenReport={(t) => setReportingTask(t)}
      />

      <WeeklyReportModal
        task={reportingTask}
        isOpen={!!reportingTask}
        onClose={() => setReportingTask(null)}
      />
    </div>
  );
};

