'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { Task, TaskActivityLog } from '../types/task';
import {
  X,
  MessageSquare,
  Clock,
  AlertTriangle,
  Award,
  Save,
  Send,
  CheckCircle,
  UserCheck,
  Flag,
  FolderOpen,
  Trash2,
  Edit3,
  RotateCcw,
  CheckSquare,
  FileText,
  User,
  Calendar,
  Sparkles,
  Flame,
  Check,
  Info,
  History,
  Activity,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { parseNoteLine, formatNewNoteLine, formatEditedNoteLine } from '../lib/notesHelper';
import {
  parseDescription,
  toggleDescriptionCheckbox,
  insertCheckboxToText,
} from '../lib/descriptionHelper';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReport?: (task: Task) => void;
  onEditTask?: (task: Task) => void;
}

const formatDateTime = (isoOrStr?: string): string => {
  if (!isoOrStr) return '';
  try {
    const d = new Date(isoOrStr);
    if (isNaN(d.getTime())) return isoOrStr;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${minutes} • ${day}/${month}/${year}`;
  } catch {
    return isoOrStr;
  }
};

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task: taskProp,
  isOpen,
  onClose,
  onOpenReport,
  onEditTask,
}) => {
  const {
    tasks,
    milestones,
    updateTaskNotes,
    updateTask,
    canEditTask,
    canReportTask,
    weeklyAwards,
    deleteTask,
    currentUser,
    users,
    confirmDialog,
    markNoteAsRead,
    weeklyArchives,
    selectedWeek,
    selectedYear,
    requestTaskAssignment,
  } = useApp();
  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } = useModalAnimation(isOpen, onClose);

  // Keep task updated in real-time with context
  const task = tasks.find((t) => t.id === taskProp?.id) || taskProp;

  const [notesText, setNotesText] = useState('');
  const [quickComment, setQuickComment] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Task description states
  const [descText, setDescText] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSavedDesc, setIsSavedDesc] = useState(false);

  // Collapsible activity history state (default: collapsed)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    if (task) {
      setNotesText(task.notes || '');
      setDescText(task.description || '');
      setQuickComment('');
      setIsSaved(false);
      setEditingNoteIndex(null);
      setEditingNoteText('');
      if (task.notes) {
        markNoteAsRead(task.id, task.notes);
      }
    }
  }, [task?.id, task?.description, task?.notes]);

  // Find assignee user
  const assigneeUser = useMemo(() => {
    if (!task?.assigneeAccount) return undefined;
    return users.find(
      (u) => u.account.toLowerCase() === (task.assigneeAccount || '').toLowerCase()
    );
  }, [task?.assigneeAccount, users]);

  // Build activity logs with fallback for legacy tasks (Hook at top level before conditional return)
  const activityLogsList: TaskActivityLog[] = useMemo(() => {
    if (!task) return [];
    if (task.activityLogs && Array.isArray(task.activityLogs) && task.activityLogs.length > 0) {
      return [...task.activityLogs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }
    const logs: TaskActivityLog[] = [];
    if (task.updatedAt && task.updatedAt !== task.createdAt) {
      logs.push({
        id: `legacy-update-${task.id}`,
        timestamp: task.updatedAt,
        authorName: assigneeUser ? assigneeUser.name : task.assigneeAccount || 'Người phụ trách',
        authorAccount: task.assigneeAccount || 'member',
        authorRole: 'Member',
        actionType: 'REPORT_SUBMIT',
        summary: `Cập nhật tiến độ: ${task.completionPercentage}%, Effort: ${task.actualEffort}h, Trạng thái: "${task.status}"`,
      });
    }
    if (task.createdAt) {
      logs.push({
        id: `legacy-create-${task.id}`,
        timestamp: task.createdAt,
        authorName: task.createdBy || 'Admin',
        authorAccount: 'Admin',
        authorRole: 'Admin',
        actionType: 'CREATE',
        summary: 'Khởi tạo công việc ban đầu',
      });
    }
    return logs;
  }, [task, assigneeUser]);

  // Parse description for interactive checklist / sub-tasks (Hook at top level before conditional return)
  const parsedDesc = useMemo(() => parseDescription(task?.description), [task?.description]);

  if (!isRendered || !task) return null;

  const milestone = milestones.find((m) => m.id === task.milestoneId);
  const isEditable = canEditTask(task);
  const isMyTaskToReport = canReportTask(task);

  const isWeekFinalized = weeklyArchives.some(
    (a) => a.weekNumber === (task.weekNumber || selectedWeek) && a.year === (task.year || selectedYear)
  );

  const award = weeklyAwards.find((w) => w.account === task.assigneeAccount);
  const isTopEffort = isWeekFinalized && (award?.isTopEffort || false);
  const isLate = isWeekFinalized && task.isSubmittedLate;

  const isLeaderOrAdmin =
    currentUser?.role === 'Leader' ||
    currentUser?.role === 'Advisor' ||
    currentUser?.role === 'Admin';
  const isMember = currentUser?.role === 'Member';
  const isUnassigned = !task.assigneeAccount || task.assigneeAccount.trim() === '';
  const isRequested = Boolean(task.assignmentRequestedBy && task.assignmentRequestStatus === 'PENDING');
  const isMyPendingRequest =
    isRequested &&
    Boolean(currentUser?.account && task.assignmentRequestedBy?.toLowerCase() === currentUser.account.toLowerCase());
  const isOtherPendingRequest = isRequested && !isMyPendingRequest;

  // Metadata fallbacks
  const creatorDisplay = task.createdBy || 'QuynhNV (Leader)';
  const createdDateDisplay = formatDateTime(task.createdAt || '2026-09-14T08:30:00Z');
  const updatedDateDisplay = task.updatedAt ? formatDateTime(task.updatedAt) : null;
  const priority = task.priority || 'Medium';
  const displayWeekNumber = task.weekNumber <= 53 ? task.weekNumber + 55 : task.weekNumber;

  // Last updater name fallback
  const lastUpdaterDisplay =
    task.updatedBy ||
    (assigneeUser
      ? `${assigneeUser.name} (@${task.assigneeAccount})`
      : task.assigneeAccount
      ? `@${task.assigneeAccount}`
      : 'Admin');

  // Handle saving inline description
  const handleSaveDescription = (e: React.FormEvent) => {
    e.preventDefault();
    updateTask(task.id, { description: descText.trim() });
    setIsEditingDesc(false);
    setIsSavedDesc(true);
    setTimeout(() => setIsSavedDesc(false), 2500);
  };

  // Handle interactive checkbox toggle in description view (without logging to activity history)
  const handleToggleCheckbox = (lineIndex: number) => {
    const newDesc = toggleDescriptionCheckbox(task.description || '', lineIndex);
    updateTask(task.id, { description: newDesc }, { skipLog: true });
    setDescText(newDesc);
  };

  const handleAddCheckboxInEdit = () => {
    setDescText((prev) => insertCheckboxToText(prev));
  };

  // Handle appending quick discussion / exchange note
  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickComment.trim()) return;

    const newEntry = formatNewNoteLine(quickComment, currentUser);
    const updated = notesText ? `${notesText}\n${newEntry}` : newEntry;

    setNotesText(updated);
    updateTaskNotes(task.id, updated);
    setQuickComment('');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleStartEditNote = (index: number, currentBody: string) => {
    setEditingNoteIndex(index);
    setEditingNoteText(currentBody);
  };

  const handleCancelEditNote = () => {
    setEditingNoteIndex(null);
    setEditingNoteText('');
  };

  const handleSaveEditNote = (index: number) => {
    if (!editingNoteText.trim()) return;

    const updatedLine = formatEditedNoteLine(noteLines[index], editingNoteText, currentUser);
    const updatedLines = [...noteLines];
    updatedLines[index] = updatedLine;
    const updated = updatedLines.join('\n');

    setNotesText(updated);
    updateTaskNotes(task.id, updated);
    setEditingNoteIndex(null);
    setEditingNoteText('');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleRecallNote = (index: number) => {
    confirmDialog({
      title: 'Thu hồi ghi chú',
      message: 'Bạn có chắc chắn muốn thu hồi ghi chú này không? Ghi chú sẽ bị xóa khỏi luồng trao đổi.',
      confirmText: 'Thu hồi',
      type: 'danger',
      onConfirm: () => {
        const updatedLines = noteLines.filter((_, idx) => idx !== index);
        const updated = updatedLines.join('\n');
        setNotesText(updated);
        updateTaskNotes(task.id, updated);
        if (editingNoteIndex === index) {
          setEditingNoteIndex(null);
          setEditingNoteText('');
        }
      },
    });
  };

  const handleDelete = () => {
    if (!task) return;
    confirmDialog({
      title: 'Xác nhận xóa đầu việc',
      message: `Bạn có chắc chắn muốn xóa đầu việc "${task.title}"? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger',
      onConfirm: () => {
        deleteTask(task.id);
        handleClose();
      },
    });
  };

  // Parse lines for rich discussion display
  const noteLines = notesText
    ? notesText.split('\n').filter((l) => l.trim().length > 0)
    : [];

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'CREATE':
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-indigo-500" />,
          label: 'Khởi tạo',
          badgeClass: 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80',
        };
      case 'REPORT_SUBMIT':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
          label: 'Báo cáo',
          badgeClass: 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80',
        };
      case 'NOTE_ADD':
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-purple-500" />,
          label: 'Ghi chú',
          badgeClass: 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/80',
        };
      case 'ASSIGNEE_CHANGE':
        return {
          icon: <UserCheck className="w-3.5 h-3.5 text-blue-500" />,
          label: 'Phân công',
          badgeClass: 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/80',
        };
      default:
        return {
          icon: <Activity className="w-3.5 h-3.5 text-amber-500" />,
          label: 'Cập nhật',
          badgeClass: 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80',
        };
    }
  };

  const modalContent = (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[120] flex items-center justify-center p-3 sm:p-4 modal-backdrop-transition overflow-y-auto ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl text-slate-800 dark:text-slate-100 max-h-[92vh] flex flex-col overflow-hidden relative modal-dialog-transition ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Fixed Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-4 sm:px-6 sm:py-4 shrink-0 bg-white dark:bg-slate-900">
          <div className="space-y-2 flex-1 pr-2 min-w-0">
            {/* Status & Category Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 text-xs font-semibold">
                {task.role}
              </span>

              {/* Priority badge */}
              {priority === 'High' ? (
                <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80 text-xs font-semibold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-rose-500" /> Ưu tiên Cao
                </span>
              ) : priority === 'Low' ? (
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                  Ưu tiên Thấp
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 text-xs font-semibold">
                  Ưu tiên Trung bình
                </span>
              )}

              {/* Status badge */}
              <span
                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                  task.status === 'Done'
                    ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80'
                    : task.status === 'In Progress'
                    ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/80'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {task.status}
              </span>

              <span className="text-xs text-slate-400 font-mono">#{task.id.replace('tsk-', '')}</span>

              {isLate && (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 text-[10px] font-bold rounded-full flex items-center gap-1 shrink-0">
                  <AlertTriangle className="w-3 h-3" /> PHẠT (Nộp muộn)
                </span>
              )}
              {isTopEffort && (
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1 shrink-0">
                  <Award className="w-3 h-3" /> THƯỞNG (Top Effort)
                </span>
              )}
            </div>

            {/* Task Title */}
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug break-words pt-1">
              {task.title}
            </h3>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition active:scale-95 shrink-0"
            title="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body with custom-scrollbar */}
        <div className="p-5 sm:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4 min-h-0 bg-white dark:bg-slate-900">
          {/* 1. Leader View: Pending Task Assignment Request Banner */}
          {isLeaderOrAdmin && isRequested && (
            <div className="p-3.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-sm shrink-0">
                  ✋
                </div>
                <div className="min-w-0">
                  <div className="font-bold flex items-center gap-1.5 flex-wrap">
                    <span>Thành viên</span>
                    <span className="font-mono bg-amber-200/80 dark:bg-amber-900 text-amber-950 dark:text-amber-100 px-1.5 py-0.5 rounded-md font-black">
                      @{task.assignmentRequestedBy}
                    </span>
                    <span>vừa gửi yêu cầu nhận task này{task.requestedWeekNumber ? ` (Tuần ${task.requestedWeekNumber})` : ''}</span>
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 truncate">
                    Chuyển sang cửa sổ chỉnh sửa để kiểm tra chi tiết và duyệt phân công cho thành viên.
                  </div>
                </div>
              </div>

              {onEditTask && isEditable && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    setTimeout(() => {
                      onEditTask(task);
                    }, 150);
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs shadow-xs shrink-0 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Phân công ngay</span>
                </button>
              )}
            </div>
          )}

          {/* 2. Member View: Own Pending Request Notice */}
          {isMember && isMyPendingRequest && (
            <div className="p-3.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 rounded-2xl flex items-center gap-3 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-150">
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-sm shrink-0">
                ⏳
              </div>
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-1.5 flex-wrap">
                  <span>Bạn đã gửi yêu cầu nhận task này cho Tuần {task.requestedWeekNumber || selectedWeek}</span>
                </div>
                <div className="text-[11px] text-amber-700 dark:text-amber-300">
                  Yêu cầu đang chờ Leader kiểm tra và duyệt phân công.
                </div>
              </div>
            </div>
          )}

          {/* 3. Member View: Unassigned Task Request Invitation Banner */}
          {isMember && isUnassigned && task.status !== 'Done' && !isRequested && (
            <div className="p-3.5 bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200/90 dark:border-indigo-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-900 dark:text-indigo-200 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-300 dark:border-indigo-700 flex items-center justify-center text-sm shrink-0">
                  ✋
                </div>
                <div className="min-w-0">
                  <div className="font-bold flex items-center gap-1.5 flex-wrap">
                    <span>Task chưa có người phụ trách</span>
                  </div>
                  <div className="text-[11px] text-indigo-700 dark:text-indigo-300">
                    Bạn có thể gửi yêu cầu nhận task này để làm trong <b>Tuần {selectedWeek}</b>.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!currentUser?.account) return;
                  confirmDialog({
                    title: 'Yêu cầu nhận task',
                    message: `Bạn có muốn gửi yêu cầu nhận task "${task.title}" cho Tuần ${selectedWeek} không?`,
                    confirmText: 'Gửi yêu cầu',
                    type: 'info',
                    onConfirm: () => {
                      requestTaskAssignment(task.id, currentUser.account, selectedWeek);
                    },
                  });
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs shrink-0 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>✋ Xin nhận task (Tuần {selectedWeek})</span>
              </button>
            </div>
          )}

          {/* Creator & Creation Date Info Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 dark:text-slate-400">Người tạo:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{creatorDisplay}</span>
                    <span className="text-slate-400 dark:text-slate-500">•</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {createdDateDisplay}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <span className="font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-xl border border-indigo-200/80 dark:border-indigo-800/80 text-xs">
                  Tuần {displayWeekNumber} / {task.year}
                </span>
              </div>
            </div>
          </div>

          {/* Task Details / Description Section */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Mô Tả Chi Tiết & Hướng Dẫn Kỹ Thuật (Leader):</span>
              </div>

              {!isEditingDesc && (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(true)}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 hover:underline transition"
                >
                  <Edit3 className="w-3 h-3" />
                  {task.description ? 'Chỉnh sửa mô tả' : '+ Thêm mô tả'}
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <form onSubmit={handleSaveDescription} className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAddCheckboxInEdit}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 rounded-lg border border-indigo-200/80 dark:border-indigo-800/80 transition shadow-2xs"
                    title="Chèn thêm checkbox / việc con"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    + Thêm Checkbox / Sub-task
                  </button>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    Gõ <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-400">- [ ] Việc con</code> để tạo checkbox
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={descText}
                  onChange={(e) => setDescText(e.target.value)}
                  placeholder="Nhập mô tả chi tiết công việc, hướng dẫn thực hiện, tiêu chí nghiệm thu hoặc checklist cho thành viên...&#10;Ví dụ:&#10;- [ ] Bước 1: Thiết kế wireframe&#10;- [ ] Bước 2: Review với Leader"
                  className="w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition resize-none leading-relaxed"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDescText(task.description || '');
                      setIsEditingDesc(false);
                    }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-xl font-medium transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Lưu Mô Tả
                  </button>
                </div>
              </form>
            ) : (
              <div>
                {task.description ? (
                  <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3">
                    {/* Description Items & Interactive Checkboxes */}
                    <div className="space-y-1 text-xs sm:text-sm leading-relaxed">
                      {parsedDesc.items.map((item) => {
                        if (item.isCheckbox) {
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleToggleCheckbox(item.id)}
                              className="flex items-start gap-2.5 py-1 px-2 -mx-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition select-none group"
                            >
                              <input
                                type="checkbox"
                                checked={item.isChecked}
                                onChange={() => handleToggleCheckbox(item.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer accent-indigo-600"
                              />
                              <span
                                className={`text-xs leading-relaxed transition flex-1 break-words ${
                                  item.isChecked
                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                    : 'text-slate-700 dark:text-slate-200 font-medium'
                                }`}
                              >
                                {item.text}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <p
                            key={item.id}
                            className="text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-normal"
                          >
                            {item.text}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingDesc(true)}
                    className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-3.5 text-center text-xs cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition space-y-1"
                  >
                    <div className="font-medium text-slate-600 dark:text-slate-300">Chưa có mô tả chi tiết cho task này</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-400">
                      Bấm vào đây để thêm nội dung hướng dẫn hoặc danh sách checklist / việc con cho thành viên.
                    </div>
                  </div>
                )}
              </div>
            )}

            {isSavedDesc && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 animate-fade-in pt-1">
                <CheckCircle className="w-3.5 h-3.5" /> Đã cập nhật mô tả task thành công!
              </div>
            )}
          </div>

          {/* Comprehensive Metadata Section */}
          <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
            {/* Top row: Assignee and Milestone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Assignee Card */}
              <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                <span className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">Người phụ trách:</span>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                    {task.assigneeAccount ? task.assigneeAccount.slice(0, 2).toUpperCase() : '??'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-snug break-words">
                      {assigneeUser?.name || task.assigneeAccount || 'Chưa gán'}
                    </div>
                    {task.assigneeAccount && (
                      <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 font-mono">
                        @{task.assigneeAccount}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Milestone Card */}
              <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                <span className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">Cột mốc Milestone:</span>
                {milestone ? (
                  <div className="flex items-start gap-1.5 text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 px-2.5 py-1.5 rounded-lg">
                    <Flag className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span className="font-semibold text-xs leading-snug break-words flex-1">{milestone.title}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg">
                    <FolderOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-xs">Ngoài Milestone</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom row: Effort and Completion Progress */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">Effort Thực tế / Ước tính:</span>
                <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1">
                  <span>{task.actualEffort}h</span>
                  <span className="text-slate-300 dark:text-slate-600 font-normal">/</span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{task.estimatedEffort}h</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">Tiến độ hoàn thành:</span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400 font-mono">
                    {task.completionPercentage}%
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    task.status === 'Done'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                      : task.status === 'In Progress'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {task.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Completion Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200/80 dark:border-slate-700">
              <div
                className={`h-full transition-all duration-300 ${
                  task.completionPercentage === 100
                    ? 'bg-emerald-500'
                    : task.completionPercentage > 0
                    ? 'bg-indigo-600 dark:bg-indigo-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
                style={{ width: `${task.completionPercentage}%` }}
              />
            </div>
          </div>

          {/* SECTION: Collaborative Notes & Discussion Feed (Luồng Trao Đổi Task) */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Luồng Trao Đổi & Ghi Chú Task ({noteLines.length}):
              </label>
            </div>

            {/* Rich Thread Display & Quick Discussion Post */}
            <div className="space-y-2.5">
              {/* Discussion History Container */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 max-h-56 overflow-y-auto custom-scrollbar space-y-2">
                {noteLines.length === 0 ? (
                  <div className="text-center py-5 text-slate-400 dark:text-slate-400 text-xs flex flex-col items-center gap-1.5">
                    <MessageSquare className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                    <span>Chưa có ghi chú hoặc trao đổi nào cho task này.</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-400">Hãy nhập phản hồi bên dưới để bắt đầu trao đổi luồng task!</span>
                  </div>
                ) : (
                  noteLines.map((line, idx) => {
                    const parsed = parseNoteLine(line, currentUser);
                    const isEditingThis = editingNoteIndex === idx;

                    if (parsed.isTagged) {
                      return (
                        <div
                          key={idx}
                          className={`rounded-xl p-2.5 shadow-2xs text-xs space-y-1.5 transition ${
                            parsed.isMyMessage
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/90 dark:border-indigo-800/80 ml-2'
                              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 mr-2'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`font-semibold text-[11px] px-2 py-0.5 rounded-md ${
                                  parsed.isMyMessage
                                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-bold'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {parsed.baseAuthor}
                              </span>

                              {parsed.editedTime && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-normal italic">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  (đã sửa {parsed.editedTime})
                                </span>
                              )}
                            </div>

                            {/* Author Actions (Only for message owner) */}
                            {parsed.isMyMessage && !isEditingThis && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditNote(idx, parsed.messageBody)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition"
                                  title="Chỉnh sửa nội dung ghi chú của bạn"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Sửa</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRecallNote(idx)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition"
                                  title="Thu hồi ghi chú này"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Thu hồi</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Message Body or Inline Editor */}
                          {isEditingThis ? (
                            <div className="pt-1 space-y-2">
                              <textarea
                                rows={2}
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                placeholder="Nhập nội dung ghi chú chỉnh sửa..."
                                className="w-full bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none leading-relaxed"
                                autoFocus
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleCancelEditNote}
                                  className="px-2.5 py-1 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium rounded-lg transition"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  disabled={!editingNoteText.trim()}
                                  onClick={() => handleSaveEditNote(idx)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-semibold rounded-lg shadow-xs transition flex items-center gap-1"
                                >
                                  <Save className="w-3 h-3" />
                                  Lưu thay đổi
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-700 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap pl-1 break-words">
                              {parsed.messageBody}
                            </p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap"
                      >
                        {line}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Collaborative Input Field for ANY team member */}
              <form onSubmit={handleSendComment} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={quickComment}
                  onChange={(e) => setQuickComment(e.target.value)}
                  placeholder={`Gửi ghi chú/trao đổi luồng (${currentUser?.name || 'thành viên'})...`}
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="submit"
                  disabled={!quickComment.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Gửi Phản Hồi</span>
                </button>
              </form>

              {isSaved && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 animate-fade-in">
                  <CheckCircle className="w-3.5 h-3.5" /> Đã lưu và đồng bộ ghi chú task thành công!
                </div>
              )}
            </div>
          </div>

          {/* SECTION: Lịch Sử & Nhật Ký Cập Nhật (Activity Log) */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Nhật Ký Cập Nhật:</span>
                <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800/80">
                  {activityLogsList.length} logs
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium flex items-center gap-1 transition cursor-pointer"
              >
                <span>{isHistoryOpen ? 'Thu gọn' : 'Xem lịch sử'}</span>
                {isHistoryOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {isHistoryOpen && (
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 max-h-56 overflow-y-auto custom-scrollbar space-y-2.5">
                {activityLogsList.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs flex flex-col items-center gap-1">
                    <Activity className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                    <span>Chưa có nhật ký hoạt động chi tiết nào.</span>
                  </div>
                ) : (
                  activityLogsList.map((log) => {
                    const badge = getActionBadge(log.actionType);
                    return (
                      <div
                        key={log.id}
                        className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-2.5 text-xs space-y-1.5 shadow-2xs hover:border-indigo-200 dark:hover:border-indigo-800/80 transition"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.badgeClass}`}>
                              {badge.icon}
                              {badge.label}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {log.authorName}
                            </span>
                            {log.authorAccount && (
                              <span className="text-[11px] text-slate-400 font-mono">
                                (@{log.authorAccount})
                              </span>
                            )}
                            {log.authorRole && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-medium">
                                {log.authorRole}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono shrink-0">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{formatDateTime(log.timestamp)}</span>
                          </div>
                        </div>

                        <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed pl-1 border-l-2 border-slate-200 dark:border-slate-700">
                          {log.summary}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-between gap-3 p-4 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/60 dark:bg-slate-900 rounded-b-3xl">
          {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                className="px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa Task
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl transition active:scale-95 shadow-2xs cursor-pointer"
            >
              Đóng
            </button>

            {isMember && isUnassigned && task.status !== 'Done' && !isRequested && (
              <button
                type="button"
                onClick={() => {
                  if (!currentUser?.account) return;
                  confirmDialog({
                    title: 'Yêu cầu nhận task',
                    message: `Bạn có muốn gửi yêu cầu nhận task "${task.title}" cho Tuần ${selectedWeek} không?`,
                    confirmText: 'Gửi yêu cầu',
                    type: 'info',
                    onConfirm: () => {
                      requestTaskAssignment(task.id, currentUser.account, selectedWeek);
                    },
                  });
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <span>✋ Xin Nhận Task (Tuần {selectedWeek})</span>
              </button>
            )}

            {onEditTask && isEditable && (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  setTimeout(() => {
                    onEditTask(task);
                  }, 150);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Chỉnh Sửa / Phân Công</span>
              </button>
            )}

            {isMyTaskToReport && onOpenReport && (
              <button
                onClick={() => {
                  handleClose();
                  setTimeout(() => {
                    onOpenReport(task);
                  }, 200);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                Nộp Báo Cáo Tiến Độ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(modalContent, document.body) : modalContent;
};
