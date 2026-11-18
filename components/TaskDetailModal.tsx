'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Modal } from './common/Modal';
import { Task, TaskStatus, TaskActivityLog, getUserRoleColorClass, getUserRoleInSpec, formatDateOnlyDisplay, isUserPM, isUserAdminOrPM, getMemberTaskEffort } from '../types/task';
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
  Users,
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
  Image as ImageIcon,
  Loader2,
  Maximize2,
  ExternalLink,
  Copy,
  Download,
  Reply,
  Layers,
  CornerDownRight,
  Link2,
  Lock,
} from 'lucide-react';
import { LinkExistingTasksModal } from './common/LinkExistingTasksModal';
import {
  isSubtask,
  isParentTask,
  getSubtasksOfParent,
  calculateParentMetrics,
} from '../lib/subtaskHelper';
import {
  parseNoteLine,
  formatNewNoteLine,
  formatEditedNoteLine,
  renderFormattedMessage,
  NoteReplyQuoteBlock,
} from '../lib/notesHelper';
import { MentionInput } from './common/MentionInput';
import {
  parseDescription,
  toggleDescriptionCheckbox,
  insertCheckboxToText,
  removeImageFromDescription,
} from '../lib/descriptionHelper';
import {
  uploadAndInsertImage,
  getImageFilesFromClipboard,
  getImageFilesFromDrop,
} from '../lib/imageUploadHelper';
import { ImageAttachmentStrip } from './common/ImageAttachmentStrip';
import { ImageLightbox } from './common/ImageLightbox';
import { DecryptedImage } from './common/DecryptedImage';
import { DescriptionEditor } from './common/DescriptionEditor';
import { RichDescriptionViewer } from './common/RichDescriptionViewer';
import { UserAvatar } from './common/UserAvatar';
import { TaskShareButton } from './common/TaskShareButton';
import { FormattedTaskTitle } from './common/FormattedTaskTitle';
import { calculateTaskAccumulatedEffort, getTaskChainActivityLogs, findWeeklyHistoryEntry, normalizeWeekNumberForYear, getWeeklyHistoryKey, getTaskForWeekView } from '../lib/taskEffortHelper';
import { getEffectiveTaskCode } from '../lib/taskCodeHelper';
import { ensureTaskTitlePrefix } from '../lib/taskPrefixHelper';
import { useSyncModalUrl, getTaskRouteIdentifier } from '../lib/sahoUrl';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReport?: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onSelectTask?: (task: Task) => void;
  onOpenCreateSubtask?: (parentTask: Task) => void;
  initialViewedWeek?: number | null;
  initialViewedYear?: number | null;
}

const isActivityLogInWeek = (log: TaskActivityLog, targetWeek: number, targetYear: number = 2026): boolean => {
  if (!log) return false;
  const summary = log.summary || '';
  const explicitWeekRegex = new RegExp(`(?:\\[|\\b)Tuần\\s+${targetWeek}(?:\\]|\\b)`, 'i');
  if (explicitWeekRegex.test(summary)) return true;

  const anyWeekMatch = summary.match(/\[Tuần\s+(\d+)/i);
  if (anyWeekMatch && Number(anyWeekMatch[1]) !== targetWeek) return false;

  if (!log.timestamp) return false;
  const logDate = new Date(log.timestamp);
  if (isNaN(logDate.getTime())) return false;

  const isoWeekNo = targetWeek > 50 ? targetWeek - 55 : targetWeek;
  const jan4 = new Date(targetYear, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);
  firstMonday.setHours(0, 0, 0, 0);

  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (isoWeekNo - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return logDate.getTime() >= weekStart.getTime() && logDate.getTime() <= weekEnd.getTime();
};

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
  onSelectTask,
  onOpenCreateSubtask,
  initialViewedWeek,
  initialViewedYear,
}) => {
  const {
    tasks,
    milestones,
    updateTaskNotes,
    updateTask,
    canEditTask,
    canReportTask,
    canDeleteTask,
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
    roles,
    adminUpdateTaskWeeklyHistory,
    adminDeleteTaskWeeklyHistory,
  } = useApp();

  // Canonical live task from context (matching ID or canonical code)
  const liveTask = useMemo(() => {
    if (!taskProp) return null;
    const byId = tasks.find((t) => t.id === taskProp.id);
    if (byId) return byId;
    if (taskProp.code) {
      const normCode = taskProp.code.trim().toLowerCase();
      const byCode = tasks.find(
        (t) =>
          t.code &&
          t.code.trim().toLowerCase() === normCode &&
          Boolean(t.subtaskParentId || t.isSubtask) === Boolean(taskProp.subtaskParentId || taskProp.isSubtask)
      );
      if (byCode) return byCode;
    }
    return taskProp;
  }, [tasks, taskProp]);

  const [viewWeekOverride, setViewWeekOverride] = useState<{
    key: string;
    week: number | null;
  } | null>(null);

  const viewContextKey = `${isOpen}_${taskProp?.id || ''}_${taskProp?.weekNumber || ''}_${initialViewedWeek ?? ''}`;

  let defaultViewWeek: number | null = null;
  if (isOpen && taskProp) {
    if (initialViewedWeek !== undefined && initialViewedWeek !== null) {
      defaultViewWeek = initialViewedWeek;
    } else if (
      taskProp.weekNumber &&
      liveTask?.weekNumber &&
      normalizeWeekNumberForYear(taskProp.weekNumber, taskProp.year || 2026) !==
      normalizeWeekNumberForYear(liveTask.weekNumber, liveTask.year || 2026)
    ) {
      defaultViewWeek = taskProp.weekNumber;
    }
  }

  const selectedViewWeek =
    viewWeekOverride?.key === viewContextKey ? viewWeekOverride.week : defaultViewWeek;
  const setSelectedViewWeek = (week: number | null) =>
    setViewWeekOverride({ key: viewContextKey, week });

  const targetViewYear = initialViewedYear || liveTask?.year || 2026;
  const liveNormWeek = liveTask?.weekNumber
    ? normalizeWeekNumberForYear(liveTask.weekNumber, liveTask.year || 2026)
    : null;
  const selectedNormWeek =
    selectedViewWeek !== null
      ? normalizeWeekNumberForYear(selectedViewWeek, targetViewYear)
      : null;

  const activeHistoryEntry = useMemo(() => {
    if (!liveTask || selectedNormWeek === null) return null;
    const isDifferentFromLiveWeek = liveNormWeek !== selectedNormWeek;
    const fromMap = findWeeklyHistoryEntry(liveTask, selectedNormWeek, targetViewYear);
    if (fromMap && (isDifferentFromLiveWeek || (initialViewedWeek !== undefined && initialViewedWeek !== null))) {
      return fromMap;
    }
    const matchedArchive = weeklyArchives.find(
      (a) =>
        normalizeWeekNumberForYear(a.weekNumber, a.year || 2026) === selectedNormWeek &&
        (a.year || 2026) === targetViewYear
    );
    const snapFromArchive = matchedArchive?.tasksSnapshot?.find(
      (st) =>
        st.id === liveTask.id ||
        st.parentTaskId === liveTask.id ||
        (liveTask.code && st.code && st.code.trim().toLowerCase() === liveTask.code.trim().toLowerCase())
    );
    if (snapFromArchive) {
      return {
        weekKey: getWeeklyHistoryKey(selectedNormWeek, targetViewYear),
        weekNumber: selectedNormWeek,
        year: targetViewYear,
        actualEffort: Number(snapFromArchive.actualEffort) || 0,
        estimatedEffort: Number(snapFromArchive.estimatedEffort) || Number(liveTask.estimatedEffort) || 0,
        completionPercentage: Number(snapFromArchive.completionPercentage) || 0,
        status: snapFromArchive.status || 'To do',
        assigneeAccount: snapFromArchive.assigneeAccount || liveTask.assigneeAccount,
        supporterAccounts: snapFromArchive.supporterAccounts,
        memberEfforts: snapFromArchive.memberEfforts,
        lastSubmittedAt: snapFromArchive.lastSubmittedAt,
        isSubmittedLate: snapFromArchive.isSubmittedLate,
        notes: snapFromArchive.notes,
        archivedAt: matchedArchive?.archivedAt || new Date().toISOString(),
      };
    }
    if (
      taskProp &&
      taskProp.weekNumber &&
      normalizeWeekNumberForYear(taskProp.weekNumber, taskProp.year || 2026) === selectedNormWeek &&
      isDifferentFromLiveWeek
    ) {
      return {
        weekKey: getWeeklyHistoryKey(selectedNormWeek, targetViewYear),
        weekNumber: selectedNormWeek,
        year: targetViewYear,
        actualEffort: Number(taskProp.actualEffort) || 0,
        estimatedEffort: Number(taskProp.estimatedEffort) || Number(liveTask.estimatedEffort) || 0,
        completionPercentage: Number(taskProp.completionPercentage) || 0,
        status: taskProp.status || 'To do',
        assigneeAccount: taskProp.assigneeAccount || liveTask.assigneeAccount,
        supporterAccounts: taskProp.supporterAccounts,
        memberEfforts: taskProp.memberEfforts,
        lastSubmittedAt: taskProp.lastSubmittedAt,
        isSubmittedLate: taskProp.isSubmittedLate,
        notes: taskProp.notes,
        archivedAt: taskProp.updatedAt || new Date().toISOString(),
      };
    }
    return null;
  }, [liveTask, selectedNormWeek, liveNormWeek, targetViewYear, initialViewedWeek, weeklyArchives, taskProp]);

  const isViewingHistoricalWeek = Boolean(
    liveTask &&
    activeHistoryEntry &&
    (liveNormWeek !== activeHistoryEntry.weekNumber ||
      (initialViewedWeek !== undefined && initialViewedWeek !== null))
  );

  // Projected task for display (historical week snapshot when inspecting history, otherwise live task)
  const task: Task | null = useMemo(() => {
    if (!liveTask) return null;
    if (!activeHistoryEntry || !isViewingHistoricalWeek) return liveTask;
    return {
      ...liveTask,
      weekNumber: activeHistoryEntry.weekNumber,
      year: activeHistoryEntry.year || liveTask.year,
      status: activeHistoryEntry.status,
      actualEffort: Number(activeHistoryEntry.actualEffort) || 0,
      estimatedEffort:
        activeHistoryEntry.estimatedEffort !== undefined
          ? Number(activeHistoryEntry.estimatedEffort)
          : liveTask.estimatedEffort,
      completionPercentage: Number(activeHistoryEntry.completionPercentage) || 0,
      assigneeAccount: activeHistoryEntry.assigneeAccount || liveTask.assigneeAccount,
      supporterAccounts:
        activeHistoryEntry.supporterAccounts !== undefined
          ? activeHistoryEntry.supporterAccounts
          : liveTask.supporterAccounts,
      memberEfforts:
        activeHistoryEntry.memberEfforts !== undefined
          ? activeHistoryEntry.memberEfforts
          : liveTask.memberEfforts,
      lastSubmittedAt: activeHistoryEntry.lastSubmittedAt ?? liveTask.lastSubmittedAt,
      isSubmittedLate: activeHistoryEntry.isSubmittedLate ?? liveTask.isSubmittedLate,
      notes: activeHistoryEntry.notes !== undefined ? activeHistoryEntry.notes : liveTask.notes,
    };
  }, [liveTask, activeHistoryEntry, isViewingHistoricalWeek]);

  const effectiveTaskCode = useMemo(() => {
    return getEffectiveTaskCode(liveTask, tasks, milestones, roles);
  }, [liveTask, tasks, milestones, roles]);

  // Silently heal / persist code if task was lacking one or outdated
  useEffect(() => {
    if (isOpen && liveTask && effectiveTaskCode && (!liveTask.code || liveTask.code !== effectiveTaskCode)) {
      updateTask(liveTask.id, { code: effectiveTaskCode }, { skipLog: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, liveTask?.id, liveTask?.code, effectiveTaskCode]);

  // Silently heal / persist title prefix if it was mismatched (e.g. QA | ... on QC task)
  useEffect(() => {
    if (isOpen && liveTask) {
      const safeTitle = ensureTaskTitlePrefix(liveTask.title, liveTask.role, roles);
      if (safeTitle && safeTitle !== liveTask.title) {
        updateTask(liveTask.id, { title: safeTitle }, { skipLog: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, liveTask?.id, liveTask?.title, liveTask?.role, roles]);

  // Calculate total accumulated effort across all weeks from canonical liveTask
  const accumulatedEffort = useMemo(() => {
    return calculateTaskAccumulatedEffort(liveTask, tasks, weeklyArchives);
  }, [liveTask, tasks, weeklyArchives]);

  const [notesText, setNotesText] = useState('');
  const [quickComment, setQuickComment] = useState('');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    author: string;
    text: string;
    lineIndex: number;
  } | null>(null);
  const [highlightedNoteIndex, setHighlightedNoteIndex] = useState<number | null>(null);

  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Task description states
  const [descText, setDescText] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSavedDesc, setIsSavedDesc] = useState(false);
  const [isUploadingDescImage, setIsUploadingDescImage] = useState(false);
  const descFileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt?: string } | null>(null);
  const [copiedImageUrl, setCopiedImageUrl] = useState<string | null>(null);
  const [copiedTaskCode, setCopiedTaskCode] = useState(false);
  const [editingWeekState, setEditingWeekState] = useState<{ taskId: string; weekKey: string } | null>(null);
  const [editWeekEffort, setEditWeekEffort] = useState<string>('0');
  const [editWeekPct, setEditWeekPct] = useState<number>(0);
  const [editWeekStatus, setEditWeekStatus] = useState<TaskStatus>('To do');
  const [editWeekNotes, setEditWeekNotes] = useState<string>('');

  const isStrictAdmin = currentUser?.role === 'Admin';
  const editingWeekKey =
    isOpen && task && editingWeekState?.taskId === task.id ? editingWeekState.weekKey : null;

  const checkDirtyAndConfirmClose = React.useCallback((): boolean => {
    const isDescDirty =
      isEditingDesc && (descText || '').trim() !== (task?.description || '').trim();
    const isCommentDirty = quickComment.trim() !== '';
    const isEditingNoteDirty =
      editingNoteIndex !== null && editingNoteText.trim() !== '';
    const isReplyingDirty = replyingTo !== null;

    const isDirty = isDescDirty || isCommentDirty || isEditingNoteDirty || isReplyingDirty;

    if (isDirty) {
      confirmDialog({
        title: 'Nội dung chưa được lưu',
        message:
          'Bạn đang có nội dung chỉnh sửa mô tả hoặc ghi chú chưa được lưu. Nếu thoát ra ngoài, các thay đổi này sẽ bị mất. Bạn có chắc chắn muốn thoát không?',
        confirmText: 'Rời đi & Hủy thay đổi',
        cancelText: 'Tiếp tục chỉnh sửa',
        type: 'warning',
        onConfirm: () => {
          setIsEditingDesc(false);
          if (task) {
            setDescText(task.description || '');
          }
          setQuickComment('');
          setEditingNoteIndex(null);
          setEditingNoteText('');
          setReplyingTo(null);
          onClose();
        },
      });
      return false;
    }
    return true;
  }, [
    isEditingDesc,
    descText,
    task?.description,
    quickComment,
    editingNoteIndex,
    editingNoteText,
    replyingTo,
    confirmDialog,
    onClose,
  ]);

  const handleRequestClose = React.useCallback(() => {
    if (checkDirtyAndConfirmClose()) {
      onClose();
    }
  }, [checkDirtyAndConfirmClose, onClose]);

  useSyncModalUrl(
    isOpen && Boolean(liveTask),
    liveTask ? `/task/${getTaskRouteIdentifier(liveTask)}` : null,
    onClose,
    liveTask ? `${liveTask.code || liveTask.title}` : undefined
  );

  const handleNavigateTo = (callback: () => void) => {
    const isDescDirty =
      isEditingDesc && (descText || '').trim() !== (task?.description || '').trim();
    const isCommentDirty = quickComment.trim() !== '';
    const isEditingNoteDirty =
      editingNoteIndex !== null && editingNoteText.trim() !== '';
    const isReplyingDirty = replyingTo !== null;

    if (isDescDirty || isCommentDirty || isEditingNoteDirty || isReplyingDirty) {
      confirmDialog({
        title: 'Nội dung chưa được lưu',
        message:
          'Bạn đang có nội dung chỉnh sửa mô tả hoặc ghi chú chưa được lưu. Nếu tiếp tục chuyển màn hình, các thay đổi này sẽ bị mất. Bạn có chắc chắn muốn tiếp tục không?',
        confirmText: 'Rời đi & Chuyển màn hình',
        cancelText: 'Tiếp tục chỉnh sửa',
        type: 'warning',
        onConfirm: () => {
          setIsEditingDesc(false);
          if (task) {
            setDescText(task.description || '');
          }
          setQuickComment('');
          setEditingNoteIndex(null);
          setEditingNoteText('');
          setReplyingTo(null);
          onClose();
          setTimeout(callback, 180);
        },
      });
      return;
    }
    onClose();
    setTimeout(callback, 180);
  };

  const handleDescImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      try {
        await uploadAndInsertImage(files[i], setDescText, setIsUploadingDescImage);
      } catch (err: any) {
        alert(err.message || 'Lỗi xử lý tải ảnh');
      }
    }
    if (descFileInputRef.current) descFileInputRef.current.value = '';
  };

  const handlePasteDescText = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = getImageFilesFromClipboard(e);
    if (imageFiles.length > 0) {
      e.preventDefault();
      for (const file of imageFiles) {
        try {
          await uploadAndInsertImage(file, setDescText, setIsUploadingDescImage);
        } catch (err: any) {
          alert(err.message || 'Lỗi xử lý tải ảnh');
        }
      }
    }
  };

  const handleDropDescText = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    const imageFiles = getImageFilesFromDrop(e);
    if (imageFiles.length > 0) {
      e.preventDefault();
      for (const file of imageFiles) {
        try {
          await uploadAndInsertImage(file, setDescText, setIsUploadingDescImage);
        } catch (err: any) {
          alert(err.message || 'Lỗi xử lý tải ảnh');
        }
      }
    }
  };

  const handleRemoveImageFromTask = (imageUrl: string) => {
    if (!task) return;
    confirmDialog({
      title: 'Xác nhận xóa ảnh đính kèm',
      message: 'Bạn có chắc chắn muốn xóa ảnh này khỏi mô tả task? Thao tác này sẽ lưu ngay lập tức.',
      confirmText: 'Xác nhận xóa',
      type: 'danger',
      onConfirm: () => {
        const newDesc = removeImageFromDescription(task.description, imageUrl);
        updateTask(task.id, { description: newDesc });
        setDescText(newDesc);
        if (lightboxImage?.url === imageUrl) {
          setLightboxImage(null);
        }
      },
    });
  };

  // Collapsible activity history state (default: collapsed)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [logFilterOverride, setLogFilterOverride] = useState<{
    key: string;
    mode: 'viewed' | 'all';
  } | null>(null);
  const logFilterKey = `${liveTask?.id || ''}_${isViewingHistoricalWeek}_${selectedNormWeek ?? ''}`;
  const logFilterMode: 'viewed' | 'all' =
    logFilterOverride?.key === logFilterKey
      ? logFilterOverride.mode
      : isViewingHistoricalWeek
        ? 'viewed'
        : 'all';
  const setLogFilterMode = (mode: 'viewed' | 'all') =>
    setLogFilterOverride({ key: logFilterKey, mode });

  // Effect 1: Reset interactive form states only when switching to a different task
  useEffect(() => {
    if (liveTask) {
      setDescText(liveTask.description || '');
      setIsEditingDesc(false);
      setQuickComment('');
      setIsSaved(false);
      setEditingNoteIndex(null);
      setEditingNoteText('');
      setReplyingTo(null);
      setHighlightedNoteIndex(null);
      setIsHistoryOpen(false);
    }
  }, [liveTask?.id]);

  // Effect 2: Sync description when updated externally while not editing
  useEffect(() => {
    if (liveTask && !isEditingDesc) {
      setDescText(liveTask.description || '');
    }
  }, [liveTask?.id, liveTask?.description, isEditingDesc]);

  // Effect 3: Sync notes thread when displayed week or live notes change
  useEffect(() => {
    if (task) {
      setNotesText(task.notes || '');
    }
  }, [task?.id, task?.notes, selectedViewWeek]);

  // Effect 4: Mark live notes as read without creating a re-render loop
  useEffect(() => {
    if (isOpen && liveTask?.id && liveTask.notes) {
      markNoteAsRead(liveTask.id, liveTask.notes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, liveTask?.id, liveTask?.notes]);

  // Find assignee user
  const assigneeUser = useMemo(() => {
    if (!task?.assigneeAccount) return undefined;
    return users.find(
      (u) => u.account.toLowerCase() === (task.assigneeAccount || '').toLowerCase()
    );
  }, [task, users]);

  // Build activity logs with fallback for legacy tasks and multi-week history
  const activityLogsList: TaskActivityLog[] = useMemo(() => {
    return getTaskChainActivityLogs(liveTask || task, tasks, weeklyArchives);
  }, [liveTask, task, tasks, weeklyArchives]);

  const viewedWeekActivityLogs: TaskActivityLog[] = useMemo(() => {
    if (!task?.weekNumber) return activityLogsList;
    const normWk = normalizeWeekNumberForYear(task.weekNumber, task.year || 2026);
    const yr = task.year || 2026;
    return activityLogsList.filter((log) => isActivityLogInWeek(log, normWk, yr));
  }, [activityLogsList, task]);

  // Parse description for interactive checklist / sub-tasks (Hook at top level before conditional return)
  const parsedDesc = useMemo(() => parseDescription(task?.description), [task]);

  // Subtasks list logic in TaskDetailModal (Hooks at top level before conditional return)
  const subtasksList = useMemo(() => {
    const rawSubs = liveTask ? getSubtasksOfParent(liveTask.id, tasks) : [];
    if (!isViewingHistoricalWeek || !activeHistoryEntry) return rawSubs;
    return rawSubs.map(
      (st) => getTaskForWeekView(st, activeHistoryEntry.weekNumber, activeHistoryEntry.year || 2026) || st
    );
  }, [liveTask, tasks, isViewingHistoricalWeek, activeHistoryEntry]);
  const hasSubtasks = subtasksList.length > 0;
  const parentMetrics = useMemo(() => {
    if (!task || !hasSubtasks) return null;
    return calculateParentMetrics(task, subtasksList);
  }, [task, hasSubtasks, subtasksList]);

  if (!task || !liveTask) return null;

  const milestone = milestones.find((m) => m.id === task.milestoneId);
  const isEditable = canEditTask(liveTask);
  const isMyTaskToReport = canReportTask(liveTask);

  const isWeekFinalized = weeklyArchives.some(
    (a) =>
      normalizeWeekNumberForYear(a.weekNumber, a.year || 2026) ===
      normalizeWeekNumberForYear(task.weekNumber || selectedWeek, task.year || selectedYear) &&
      (a.year || 2026) === (task.year || selectedYear)
  );

  const award = weeklyAwards.find((w) => w.account === task.assigneeAccount);
  const isTopEffort = isWeekFinalized && (award?.isTopEffort || false);
  const isLate = isWeekFinalized && task.isSubmittedLate;

  const userRoleInTask = getUserRoleInSpec(currentUser, task.role);
  const isLeaderOrAdmin =
    userRoleInTask === 'Leader' ||
    userRoleInTask === 'Advisor' ||
    isUserAdminOrPM(currentUser);
  const isMember = !isLeaderOrAdmin;
  const isUnassigned = !liveTask.assigneeAccount || liveTask.assigneeAccount.trim() === '';
  const isRequested = Boolean(liveTask.assignmentRequestedBy && liveTask.assignmentRequestStatus === 'PENDING');
  const isMyPendingRequest =
    isRequested &&
    Boolean(currentUser?.account && liveTask.assignmentRequestedBy?.toLowerCase() === currentUser.account.toLowerCase());
  const isOtherPendingRequest = isRequested && !isMyPendingRequest;

  const isMyAssignedTask = Boolean(
    currentUser?.account &&
    ((liveTask.assigneeAccount && liveTask.assigneeAccount.toLowerCase() === currentUser.account.toLowerCase()) ||
      (liveTask.supporterAccounts && liveTask.supporterAccounts.some((s) => s.toLowerCase() === currentUser.account.toLowerCase())))
  );
  const isOlderWeekOrBacklog =
    (liveTask.weekNumber !== undefined && liveTask.weekNumber < selectedWeek) || !liveTask.weekNumber;
  const isNotDone = liveTask.status !== 'Done' && (liveTask.completionPercentage || 0) < 100;
  const canTransferToCurrentWeek =
    !isViewingHistoricalWeek &&
    (isMyAssignedTask || isLeaderOrAdmin) &&
    isOlderWeekOrBacklog &&
    isNotDone &&
    !isWeekFinalized &&
    !isRequested;

  // Metadata fallbacks
  const creatorDisplay = task.createdBy || 'QuynhNV (Leader)';
  const createdDateDisplay = formatDateTime(task.createdAt || '2026-09-14T08:30:00Z');
  const updatedDateDisplay = task.updatedAt ? formatDateTime(task.updatedAt) : null;
  const priority = task.priority || 'Medium';
  const displayWeekNumber = !task.weekNumber
    ? null
    : task.weekNumber <= 53
      ? task.weekNumber + 55
      : task.weekNumber;
  const liveDisplayWeekNumber = !liveTask.weekNumber
    ? null
    : liveTask.weekNumber <= 53
      ? liveTask.weekNumber + 55
      : liveTask.weekNumber;

  const displayCompletionPct =
    !isViewingHistoricalWeek && hasSubtasks && !task.isManualOverride && parentMetrics
      ? parentMetrics.completionPercentage
      : (task.completionPercentage || 0);

  const displayActualEffort =
    !isViewingHistoricalWeek && hasSubtasks && !task.isManualOverride && parentMetrics
      ? parentMetrics.totalActualEffort
      : (task.actualEffort || 0);

  const displayEstimatedEffort =
    !isViewingHistoricalWeek && hasSubtasks && !task.isManualOverride && parentMetrics
      ? parentMetrics.totalEstimatedEffort
      : (task.estimatedEffort || 0);

  const isTaskFullyDone =
    displayCompletionPct >= 100 ||
    (!isViewingHistoricalWeek && hasSubtasks && !task.isManualOverride && parentMetrics
      ? parentMetrics.status === 'Done'
      : task.status === 'Done');

  const effectiveDisplayStatus =
    !isViewingHistoricalWeek && hasSubtasks && !task.isManualOverride && parentMetrics
      ? parentMetrics.status
      : isTaskFullyDone
        ? 'Done'
        : displayCompletionPct > 0 || task.status === 'In Progress'
          ? 'In Progress'
          : task.status;

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

  const handleStartReply = (author: string, text: string, lineIndex: number) => {
    setReplyingTo({
      author: author.trim(),
      text: text.trim(),
      lineIndex,
    });
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const findTargetNoteIndex = (replyTo: { replyAuthor: string; replyText: string }, currentIdx: number): number => {
    const quoteSnippet = (replyTo.replyText || '').trim().toLowerCase();
    const targetAuthor = (replyTo.replyAuthor || '').trim().toLowerCase();

    // 1. Search backwards from currentIdx
    for (let i = currentIdx - 1; i >= 0; i--) {
      const line = noteLines[i];
      const parsed = parseNoteLine(line, null);
      const bodyLower = (parsed.messageBody || '').trim().toLowerCase();
      const authorLower = (parsed.isTagged ? parsed.baseAuthor : (creatorDisplay || 'Ghi chú ban đầu')).toLowerCase();

      const authorMatch = !targetAuthor || authorLower.includes(targetAuthor) || targetAuthor.includes(authorLower);
      const snippetMatch = !quoteSnippet || bodyLower.includes(quoteSnippet) || quoteSnippet.includes(bodyLower.slice(0, 40));

      if (snippetMatch && (authorMatch || quoteSnippet.length > 5)) {
        return i;
      }
    }

    // 2. Search anywhere in noteLines
    for (let i = 0; i < noteLines.length; i++) {
      if (i === currentIdx) continue;
      const line = noteLines[i];
      const parsed = parseNoteLine(line, null);
      const bodyLower = (parsed.messageBody || '').trim().toLowerCase();
      if (quoteSnippet && (bodyLower.includes(quoteSnippet) || quoteSnippet.includes(bodyLower.slice(0, 40)))) {
        return i;
      }
    }

    return -1;
  };

  const handleJumpToRepliedNote = (replyTo: { replyAuthor: string; replyText: string }, currentIdx: number) => {
    const targetIdx = findTargetNoteIndex(replyTo, currentIdx);
    if (targetIdx < 0) return;

    const el = document.getElementById(`task-detail-note-${targetIdx}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedNoteIndex(targetIdx);
      setTimeout(() => {
        setHighlightedNoteIndex(null);
      }, 1600);
    }
  };

  // Handle appending quick discussion / exchange note
  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickComment.trim()) return;

    const newEntry = formatNewNoteLine(quickComment, currentUser, replyingTo);
    const updated = notesText ? `${notesText}\n${newEntry}` : newEntry;

    setNotesText(updated);
    updateTaskNotes(task.id, updated, { newCommentContent: quickComment.trim() });
    setQuickComment('');
    setReplyingTo(null);
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
    updateTaskNotes(task.id, updated, { isEdit: true, skipNotification: true });
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
        updateTaskNotes(task.id, updated, { isRecall: true, skipNotification: true });
        if (editingNoteIndex === index) {
          setEditingNoteIndex(null);
          setEditingNoteText('');
        }
        if (replyingTo?.lineIndex === index) {
          setReplyingTo(null);
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
        onClose();
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onRequestClose={checkDirtyAndConfirmClose}
      size="6xl"
      bodyClassName="space-y-5"
      eyebrow={
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
              effectiveDisplayStatus === 'Done'
                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80'
                : effectiveDisplayStatus === 'In Progress'
                ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/80'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            {effectiveDisplayStatus}
          </span>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(effectiveTaskCode);
              setCopiedTaskCode(true);
              setTimeout(() => setCopiedTaskCode(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[rgba(24,144,255,0.12)] dark:bg-sky-950/80 hover:bg-[rgba(24,144,255,0.20)] text-[#1890FF] dark:text-sky-300 text-xs font-mono font-bold rounded-[6px] transition cursor-pointer active:scale-95 shrink-0"
            title="Bấm để sao chép mã task"
          >
            <span>{effectiveTaskCode}</span>
            {copiedTaskCode ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3 opacity-60" />
            )}
          </button>

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
      }
      title={
        <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug break-words pt-1">
          <FormattedTaskTitle title={task.title} />
        </div>
      }
      headerExtra={<TaskShareButton task={task} variant="button" align="right" />}
      footer={
        <div className="flex items-center justify-between gap-3">
          {(userRoleInTask === 'Leader' || userRoleInTask === 'Advisor' || isUserAdminOrPM(currentUser) || (task && canDeleteTask(task))) ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                className="px-3.5 h-[36px] text-[#FF4D4F] dark:text-rose-400 bg-[rgba(255,77,79,0.08)] hover:bg-[rgba(255,77,79,0.16)] border border-[rgba(255,77,79,0.28)] dark:border-rose-800/80 rounded-[8px] text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
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
              type="button"
              onClick={handleRequestClose}
              className="saho-modal-btn-secondary"
            >
              Đóng
            </button>

            {isMember && isUnassigned && liveTask.status !== 'Done' && !isRequested && (
              <button
                type="button"
                onClick={() => {
                  if (!currentUser?.account) return;
                  confirmDialog({
                    title: 'Yêu cầu nhận task',
                    message: `Bạn có muốn gửi yêu cầu nhận task "${liveTask.title}" cho Tuần ${selectedWeek} không?`,
                    confirmText: 'Gửi yêu cầu',
                    type: 'info',
                    onConfirm: () => {
                      requestTaskAssignment(liveTask.id, currentUser.account, selectedWeek);
                    },
                  });
                }}
                className="saho-modal-btn-primary px-4 font-semibold flex items-center gap-1.5"
              >
                <span>✋ Xin Nhận Task (Tuần {selectedWeek})</span>
              </button>
            )}

            {onEditTask && isEditable && (
              <button
                type="button"
                onClick={() => handleNavigateTo(() => onEditTask(liveTask))}
                className="saho-modal-btn-primary px-4 font-semibold flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Chỉnh Sửa / Phân Công</span>
              </button>
            )}

            {isMyTaskToReport && onOpenReport && (
              <button
                type="button"
                onClick={() => handleNavigateTo(() => onOpenReport(liveTask))}
                className="h-[36px] px-5 bg-[#0AB185] hover:bg-[#088E6A] text-white text-xs font-semibold rounded-[8px] shadow-sm shadow-[#0AB185]/20 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                Nộp Báo Cáo Tiến Độ
              </button>
            )}
          </div>
        </div>
      }
      afterModal={
        <>
          {liveTask && (
            <LinkExistingTasksModal
              parentTask={liveTask}
              isOpen={isLinkModalOpen}
              onClose={() => setIsLinkModalOpen(false)}
            />
          )}

          <ImageLightbox
            isOpen={!!lightboxImage}
            imageUrl={lightboxImage?.url || null}
            altText={lightboxImage?.alt}
            onClose={() => setLightboxImage(null)}
            onDelete={
              isEditable && lightboxImage?.url
                ? () => handleRemoveImageFromTask(lightboxImage.url)
                : undefined
            }
          />
        </>
      }
    >
          {/* Historical Week Snapshot Banner (When opened from Lịch Sử Công Việc or clicking a week in Map) */}
          {isViewingHistoricalWeek && activeHistoryEntry && (
            <div className="p-3.5 bg-[rgba(24,144,255,0.06)] dark:bg-sky-950/40 border border-[rgba(24,144,255,0.28)] dark:border-sky-800/80 rounded-[12px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#1D202A] dark:text-slate-100 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-[8px] bg-[rgba(24,144,255,0.14)] dark:bg-sky-900/70 border border-[rgba(24,144,255,0.28)] dark:border-sky-700 flex items-center justify-center text-[#1890FF] dark:text-[#40A9FF] shrink-0">
                  <History className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold flex items-center gap-1.5 flex-wrap">
                    <span>
                      Đang xem dữ liệu đã lưu tại Tuần {displayWeekNumber} / {task.year || 2026}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-white/90 dark:bg-slate-800/90 border border-[#E8E9EF] dark:border-slate-700 text-[10.5px] font-mono font-bold text-[#1890FF] dark:text-[#40A9FF]">
                      {displayActualEffort}h / {displayEstimatedEffort}h • {displayCompletionPct}% • {effectiveDisplayStatus}
                    </span>
                    {activeHistoryEntry.archivedAt && (
                      <span className="text-[10px] text-[#838899] dark:text-slate-400 font-mono">
                        (Chốt lúc {formatDateTime(activeHistoryEntry.archivedAt)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {liveDisplayWeekNumber && liveDisplayWeekNumber !== displayWeekNumber && (
                <button
                  type="button"
                  onClick={() => setSelectedViewWeek(null)}
                  className="px-3.5 py-2 bg-[#1890FF] hover:bg-[#40A9FF] active:bg-[#096DD9] text-white font-semibold rounded-[8px] text-xs shadow-sm shadow-[#1890FF]/20 shrink-0 transition active:scale-95 cursor-pointer flex items-center justify-center"
                >
                  <span>Xem tuần hiện tại (Tuần {liveDisplayWeekNumber})</span>
                </button>
              )}
            </div>
          )}

          {/* Top Pending / Claim Request / Transfer Banners (Full width, live view only) */}
          {!isViewingHistoricalWeek &&
            ((isLeaderOrAdmin && isRequested) ||
              (isMember && isMyPendingRequest) ||
              (isMember && isUnassigned && liveTask.status !== 'Done' && !isRequested) ||
              canTransferToCurrentWeek) && (
              <div className="space-y-3">
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
                            @{liveTask.assignmentRequestedBy}
                          </span>
                          <span>vừa gửi yêu cầu nhận task này{liveTask.requestedWeekNumber ? ` (Tuần ${liveTask.requestedWeekNumber})` : ''}</span>
                        </div>
                        <div className="text-[11px] text-amber-700 dark:text-amber-300 truncate">
                          Chuyển sang cửa sổ chỉnh sửa để kiểm tra chi tiết và duyệt phân công cho thành viên.
                        </div>
                      </div>
                    </div>

                    {onEditTask && isEditable && (
                      <button
                        type="button"
                        onClick={() => handleNavigateTo(() => onEditTask(liveTask))}
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
                        <span>Bạn đã gửi yêu cầu nhận task này cho Tuần {liveTask.requestedWeekNumber || selectedWeek}</span>
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-300">
                        Yêu cầu đang chờ Leader kiểm tra và duyệt phân công.
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Member View: Unassigned Task Request Invitation Banner */}
                {isMember && isUnassigned && liveTask.status !== 'Done' && !isRequested && (
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
                          message: `Bạn có muốn gửi yêu cầu nhận task "${liveTask.title}" cho Tuần ${selectedWeek} không?`,
                          confirmText: 'Gửi yêu cầu',
                          type: 'info',
                          onConfirm: () => {
                            requestTaskAssignment(liveTask.id, currentUser.account, selectedWeek);
                          },
                        });
                      }}
                      className="px-4 py-2 bg-[#1890FF] hover:bg-[#40A9FF] active:bg-[#096DD9] text-white font-semibold rounded-[8px] text-xs shadow-sm shadow-[#1890FF]/20 shrink-0 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>✋ Xin nhận task (Tuần {selectedWeek})</span>
                    </button>
                  </div>
                )}

                {/* 4. Active Assignee / Leader / Admin: Transfer Held or Past Task to Current Week */}
                {canTransferToCurrentWeek && (
                  <div className="p-3.5 bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-blue-50/90 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-blue-950/40 border border-indigo-200/90 dark:border-indigo-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-950 dark:text-indigo-200 animate-in fade-in duration-150 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-300 dark:border-indigo-700 flex items-center justify-center text-sm shrink-0">
                        ⏩
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold flex items-center gap-1.5 flex-wrap">
                          <span>Đầu việc đang giữ từ {liveTask.weekNumber ? `Tuần ${liveTask.weekNumber}` : 'Kho Backlog'}</span>
                          <span className="bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-indigo-200/80 dark:border-indigo-700">
                            Chưa xong
                          </span>
                        </div>
                        <div className="text-[11px] text-indigo-800/80 dark:text-indigo-300/90">
                          {isMyAssignedTask
                            ? `Bạn đang là người phụ trách đầu việc này. Bấm để chuyển sang Tuần ${selectedWeek} (Tuần hiện tại) để tiếp tục làm và báo cáo.`
                            : `Chuyển công việc này sang Tuần ${selectedWeek} (Tuần hiện tại) để thành viên tiếp tục thực hiện.`}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        confirmDialog({
                          title: `Chuyển task sang Tuần ${selectedWeek}`,
                          message: `Bạn có muốn chuyển công việc "${liveTask.title}" từ ${liveTask.weekNumber ? `Tuần ${liveTask.weekNumber}` : 'Kho Backlog'} sang Tuần ${selectedWeek} (Hiện tại) để tiếp tục làm việc không?`,
                          confirmText: `Chuyển sang Tuần ${selectedWeek}`,
                          type: 'info',
                          onConfirm: () => {
                            updateTask(liveTask.id, {
                              weekNumber: selectedWeek,
                              year: selectedYear,
                              requestedWeekNumber: undefined,
                            });
                          },
                        });
                      }}
                      className="px-4 py-2 bg-[#1890FF] hover:bg-[#40A9FF] active:bg-[#096DD9] text-white font-semibold rounded-[8px] text-xs shadow-sm shadow-[#1890FF]/20 shrink-0 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Chuyển sang Tuần {selectedWeek} (Hiện tại)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

        {/* Jira-style 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          {/* LEFT COLUMN: Main Content Flow (Description, Subtasks, Discussion, Activity History) */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-4 min-w-0 order-2 lg:order-1">
            {/* Task Details / Description Section */}
            <div className="saho-modal-card border rounded-[12px] p-4 space-y-2.5 relative min-w-0 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Mô Tả Chi Tiết & Hướng Dẫn Kỹ Thuật (Leader):</span>
                </div>

                {!isEditingDesc && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDesc(true)}
                    className="text-[11px] font-semibold text-[#1890FF] dark:text-[#40A9FF] hover:text-[#096DD9] flex items-center gap-1 hover:underline transition cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    {task.description ? 'Chỉnh sửa mô tả' : '+ Thêm mô tả'}
                  </button>
                )}
              </div>

              {isEditingDesc ? (
                <form onSubmit={handleSaveDescription} className="space-y-3 pt-1">
                  <DescriptionEditor
                    value={descText}
                    onChange={setDescText}
                    placeholder="Nhập mô tả chi tiết công việc, hướng dẫn thực hiện, tiêu chí nghiệm thu hoặc checklist cho thành viên... Hỗ trợ Paste (Ctrl+V) hoặc kéo thả ảnh trực tiếp!"
                    minRows={5}
                    autoFocus={true}
                    onPreviewImage={(url) => setLightboxImage({ url, alt: 'Ảnh đính kèm' })}
                  />

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (descText.trim() !== (task.description || '').trim()) {
                          confirmDialog({
                            title: 'Hủy chỉnh sửa mô tả',
                            message: 'Nội dung mô tả đã thay đổi nhưng chưa lưu. Bạn có chắc chắn muốn hủy các thay đổi này không?',
                            confirmText: 'Xác nhận hủy',
                            cancelText: 'Tiếp tục sửa',
                            type: 'warning',
                            onConfirm: () => {
                              setDescText(task.description || '');
                              setIsEditingDesc(false);
                            },
                          });
                        } else {
                          setDescText(task.description || '');
                          setIsEditingDesc(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-[#F8FAFB] dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 hover:bg-[#F3F4F7] dark:hover:bg-slate-700 hover:border-[#A2A6B4] text-[#1D202A] dark:text-slate-200 text-xs rounded-[8px] font-medium transition cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#1890FF] hover:bg-[#40A9FF] active:bg-[#096DD9] text-white text-xs font-semibold rounded-[8px] shadow-sm shadow-[#1890FF]/20 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Lưu Mô Tả
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  {task.description ? (
                    <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3.5 min-w-0 overflow-hidden">
                      <RichDescriptionViewer
                        content={task.description}
                        onPreviewImage={(url) => setLightboxImage({ url, alt: 'Ảnh đính kèm' })}
                        allowToggleCheckboxes={true}
                        onToggleCheckbox={(lineIndex) => handleToggleCheckbox(lineIndex)}
                      />
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

            {/* Subtask Parent Relationship Banner */}
            {task && isSubtask(task) && (
              <div className="bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                    <CornerDownRight className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                      Subtask trực thuộc task lớn
                    </div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {(() => {
                        const parentObj = task.subtaskParentId ? tasks.find((t) => t.id === task.subtaskParentId) : null;
                        return parentObj?.title || task.subtaskParentTitle || 'Task lớn';
                      })()}
                    </div>
                    {(task.subtaskReviewerAccount) && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Reviewer / Leader: @{task.subtaskReviewerAccount}
                      </div>
                    )}
                  </div>
                </div>
                {task.subtaskParentId && onSelectTask && (() => {
                  const parentObj = tasks.find((t) => t.id === task.subtaskParentId);
                  return parentObj ? (
                    <button
                      type="button"
                      onClick={() => onSelectTask(parentObj)}
                      className="px-3 py-1.5 bg-[#F8FAFB] dark:bg-slate-800 hover:bg-[#F3F4F7] dark:hover:bg-slate-700 text-[#1D202A] dark:text-slate-200 font-semibold text-xs rounded-[8px] border border-[#E8E9EF] dark:border-slate-700 hover:border-[#A2A6B4] shadow-2xs shrink-0 transition cursor-pointer active:scale-95"
                    >
                      Xem task cha
                    </button>
                  ) : null;
                })()}
              </div>
            )}

            {/* Subtasks List Section (If task is a parent task or has subtasks) */}
            {task && subtasksList.length > 0 && (
                <div className="bg-white dark:bg-slate-850 p-3.5 sm:p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                        Danh sách Subtask ({subtasksList.length})
                      </span>
                      {!task.isManualOverride ? (
                        <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                          Tự động tổng hợp
                        </span>
                      ) : (
                        <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold">
                          Ghi đè thủ công
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsLinkModalOpen(true)}
                        className="px-2.5 py-1 bg-[#F8FAFB] hover:bg-[#F3F4F7] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1D202A] dark:text-slate-200 text-xs font-semibold rounded-[8px] border border-[#E8E9EF] dark:border-slate-700 hover:border-[#A2A6B4] transition flex items-center gap-1 active:scale-95 cursor-pointer shadow-2xs"
                        title="Chọn thêm các task có sẵn để gộp vào task này"
                      >
                        <Link2 className="w-3.5 h-3.5 text-[#1890FF]" />
                        <span>+ Gộp task có sẵn</span>
                      </button>
                      {onOpenCreateSubtask && (
                        <button
                          type="button"
                          onClick={() => onOpenCreateSubtask(liveTask)}
                          className="px-2.5 py-1 bg-[rgba(24,144,255,0.10)] hover:bg-[rgba(24,144,255,0.18)] text-[#1890FF] dark:text-[#40A9FF] text-xs font-semibold rounded-[8px] border border-[rgba(24,144,255,0.25)] transition flex items-center gap-1 active:scale-95 cursor-pointer shadow-2xs"
                        >
                          <CornerDownRight className="w-3.5 h-3.5" />
                          <span>+ Thêm Subtask</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    {subtasksList.map((st) => {
                      const stUser = users.find((u) => u.account.toLowerCase() === (st.assigneeAccount || '').toLowerCase());
                      return (
                        <div
                          key={st.id}
                          onClick={() => onSelectTask?.(st)}
                          className={`p-2.5 flex items-center justify-between gap-3 text-xs bg-slate-50/50 dark:bg-slate-900/40 hover:bg-indigo-50/60 dark:hover:bg-slate-800/80 transition ${onSelectTask ? 'cursor-pointer' : ''
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-indigo-400 font-mono text-xs select-none">↳</span>
                            {st.code && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                                {st.code}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {st.title}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span>Effort: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{st.actualEffort || st.estimatedEffort}h</strong></span>
                                <span>•</span>
                                <span>Tiến độ: <strong className="font-mono text-slate-600 dark:text-slate-300">{st.completionPercentage || 0}%</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {st.assigneeAccount ? (
                              <div className="flex items-center gap-1">
                                <UserAvatar user={stUser} account={st.assigneeAccount} size="xs" shape="circle" />
                                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                  {st.assigneeAccount}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-amber-500 font-medium">Chưa gán</span>
                            )}

                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.status === 'Done' || (st.completionPercentage || 0) >= 100
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                              : st.status === 'In Progress' || (st.completionPercentage || 0) > 0
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                              }`}>
                              {st.status || 'To do'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

          {/* Quick Subtask conversion / Link existing tasks for standalone tasks */}
          {task && !isSubtask(task) && subtasksList.length === 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 min-w-0">
                <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="truncate">Chưa có Subtask. Bạn có thể gộp các task lẻ có sẵn vào task này.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(true)}
                  className="px-2.5 py-1 bg-[#F8FAFB] dark:bg-slate-800 hover:bg-[#F3F4F7] dark:hover:bg-slate-700 text-[#1D202A] dark:text-slate-200 font-semibold rounded-[8px] border border-[#E8E9EF] dark:border-slate-700 hover:border-[#A2A6B4] shadow-2xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5 text-[#1890FF]" />
                  <span>Gộp task có sẵn</span>
                </button>
                {onOpenCreateSubtask && (
                  <button
                    type="button"
                    onClick={() => onOpenCreateSubtask(liveTask)}
                    className="px-2.5 py-1 bg-[#1890FF] hover:bg-[#40A9FF] active:bg-[#096DD9] text-white font-semibold rounded-[8px] shadow-2xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                    <span>+ Subtask mới</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SECTION: Collaborative Notes & Discussion Feed (Luồng Trao Đổi Task) */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Luồng Trao Đổi & Ghi Chú Task ({noteLines.length}):
              </label>
            </div>

            {/* Rich Thread Display & Quick Discussion Post */}
            <div className="space-y-2.5">
              {/* Discussion History Container */}
              <div className="saho-modal-card border rounded-[12px] p-3.5 max-h-72 sm:max-h-80 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-2 min-w-0">
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
                    const isHighlighted = highlightedNoteIndex === idx;

                    if (parsed.isTagged) {
                      return (
                        <div
                          key={idx}
                          id={`task-detail-note-${idx}`}
                          className={`rounded-xl p-2.5 shadow-2xs text-xs space-y-1.5 transition-all duration-300 min-w-0 break-words [overflow-wrap:anywhere] ${isHighlighted
                            ? 'animate-note-jump ring-2 ring-indigo-500 shadow-xl bg-indigo-100/95 dark:bg-indigo-900/90'
                            : parsed.isMyMessage
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/90 dark:border-indigo-800/80 ml-2'
                              : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 mr-2'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`font-semibold text-[11px] px-2 py-0.5 rounded-md ${parsed.isMyMessage
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

                            {/* Actions: Reply, Edit, Recall */}
                            <div className="flex items-center gap-1">
                              {!isEditingThis && (
                                <button
                                  type="button"
                                  onClick={() => handleStartReply(parsed.baseAuthor || 'Thành viên', parsed.messageBody, idx)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition cursor-pointer"
                                  title="Trả lời tin nhắn này"
                                >
                                  <Reply className="w-3 h-3" />
                                  <span>Trả lời</span>
                                </button>
                              )}

                              {parsed.isMyMessage && !isEditingThis && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditNote(idx, parsed.messageBody)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition cursor-pointer"
                                    title="Chỉnh sửa nội dung ghi chú của bạn"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Sửa</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRecallNote(idx)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer"
                                    title="Thu hồi ghi chú này"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Thu hồi</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Quoted Reply Block if message is a reply */}
                          {parsed.replyTo && (
                            <NoteReplyQuoteBlock
                              replyTo={parsed.replyTo}
                              onClick={() => handleJumpToRepliedNote(parsed.replyTo!, idx)}
                            />
                          )}

                          {/* Message Body or Inline Editor */}
                          {isEditingThis ? (
                            <div className="pt-1 space-y-2">
                              <MentionInput
                                as="textarea"
                                rows={2}
                                value={editingNoteText}
                                onChange={setEditingNoteText}
                                users={users}
                                mentionPlacement="top"
                                placeholder="Nhập nội dung ghi chú chỉnh sửa (Gõ @ để tag)..."
                                className="w-full bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none leading-relaxed"
                                autoFocus
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleCancelEditNote}
                                  className="px-2.5 py-1 bg-[#F8FAFB] dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 hover:bg-[#F3F4F7] dark:hover:bg-slate-700 hover:border-[#A2A6B4] text-[#1D202A] dark:text-slate-200 text-[11px] font-medium rounded-[8px] transition cursor-pointer"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  disabled={!editingNoteText.trim()}
                                  onClick={() => handleSaveEditNote(idx)}
                                  className="px-3 py-1 bg-[#1890FF] hover:bg-[#40A9FF] active:bg-[#096DD9] disabled:opacity-50 text-white text-[11px] font-semibold rounded-[8px] shadow-xs transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Save className="w-3 h-3" />
                                  Lưu thay đổi
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-700 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap pl-1 break-words [overflow-wrap:anywhere] min-w-0">
                              {renderFormattedMessage(parsed.messageBody, users)}
                            </p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        id={`task-detail-note-${idx}`}
                        className={`rounded-xl p-2.5 text-xs leading-relaxed whitespace-pre-wrap space-y-1.5 transition-all duration-300 min-w-0 break-words [overflow-wrap:anywhere] ${isHighlighted
                          ? 'animate-note-jump ring-2 ring-indigo-500 shadow-xl bg-indigo-100/95 dark:bg-indigo-900/90'
                          : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200'
                          }`}
                      >
                        <div className="break-words [overflow-wrap:anywhere] min-w-0">{renderFormattedMessage(line, users)}</div>
                        <div className="flex items-center justify-end pt-1 border-t border-slate-100 dark:border-slate-700/60">
                          <button
                            type="button"
                            onClick={() => handleStartReply(creatorDisplay || 'Ghi chú ban đầu', line, idx)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition cursor-pointer"
                            title="Trả lời ghi chú này"
                          >
                            <Reply className="w-3 h-3" />
                            <span>Trả lời</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Replying Banner Preview (Telegram/Messenger style) */}
              {replyingTo && (
                <div className="flex items-center justify-between gap-2 p-2 px-3 bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 border-l-4 border-l-indigo-500 rounded-xl text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-2 min-w-0">
                    <Reply className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-indigo-700 dark:text-indigo-300 text-[11px] truncate flex items-center gap-1">
                        <span>Đang trả lời:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[200px]">
                          {replyingTo.author}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate max-w-[320px] sm:max-w-[420px]">
                        "{replyingTo.text}"
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelReply}
                    className="w-5 h-5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center shrink-0 transition cursor-pointer"
                    title="Hủy trả lời"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Collaborative Input Field for ANY team member */}
              <form onSubmit={handleSendComment} className="flex flex-col sm:flex-row gap-2 min-w-0">
                <MentionInput
                  as="input"
                  value={quickComment}
                  onChange={setQuickComment}
                  users={users}
                  mentionPlacement="top"
                  placeholder={
                    replyingTo
                      ? `Trả lời @${replyingTo.author} (Gõ @ để tag)...`
                      : `Gửi ghi chú/trao đổi luồng (${currentUser?.name || 'thành viên'} - Gõ @ để tag)...`
                  }
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="submit"
                  disabled={!quickComment.trim()}
                  className="px-4 py-2 bg-[#1890FF] hover:bg-[#40A9FF] active:bg-[#096DD9] disabled:opacity-50 text-white text-xs font-semibold rounded-[8px] shadow-sm shadow-[#1890FF]/20 transition flex items-center justify-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
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
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 flex-wrap">
                <History className="w-4 h-4 text-[#1890FF] dark:text-[#40A9FF] shrink-0" />
                <span>Nhật Ký Cập Nhật:</span>
                {isViewingHistoricalWeek && displayWeekNumber && viewedWeekActivityLogs.length > 0 ? (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setLogFilterMode('viewed')}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition cursor-pointer ${logFilterMode === 'viewed'
                        ? 'bg-[#1890FF] text-white border-[#1890FF]'
                        : 'bg-[#F8FAFB] dark:bg-slate-800 text-[#1D202A] dark:text-slate-300 border-[#E8E9EF] dark:border-slate-700 hover:border-[#1890FF]'
                        }`}
                    >
                      Tuần {displayWeekNumber} ({viewedWeekActivityLogs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogFilterMode('all')}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition cursor-pointer ${logFilterMode === 'all'
                        ? 'bg-[#1890FF] text-white border-[#1890FF]'
                        : 'bg-[#F8FAFB] dark:bg-slate-800 text-[#1D202A] dark:text-slate-300 border-[#E8E9EF] dark:border-slate-700 hover:border-[#1890FF]'
                        }`}
                    >
                      Tất cả ({activityLogsList.length})
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800/80">
                    {activityLogsList.length} logs
                  </span>
                )}
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

            {isHistoryOpen && (() => {
              const visibleLogs =
                isViewingHistoricalWeek && logFilterMode === 'viewed' && viewedWeekActivityLogs.length > 0
                  ? viewedWeekActivityLogs
                  : activityLogsList;
              const viewedWeekLogIds = new Set(viewedWeekActivityLogs.map((l) => l.id));
              return (
                <div className="saho-modal-card border rounded-[12px] p-3.5 max-h-72 sm:max-h-80 overflow-y-auto custom-scrollbar space-y-2.5">
                  {visibleLogs.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-xs flex flex-col items-center gap-1">
                      <Activity className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                      <span>Chưa có nhật ký hoạt động chi tiết nào.</span>
                    </div>
                  ) : (
                    visibleLogs.map((log) => {
                      const badge = getActionBadge(log.actionType);
                      const isLogInViewedWeek = isViewingHistoricalWeek && viewedWeekLogIds.has(log.id);
                      return (
                        <div
                          key={log.id}
                          className={`rounded-xl p-2.5 text-xs space-y-1.5 shadow-2xs transition border ${isLogInViewedWeek
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-700'
                            : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-200 dark:hover:border-indigo-800/80'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.badgeClass}`}>
                                {badge.icon}
                                {badge.label}
                              </span>
                              {isLogInViewedWeek && displayWeekNumber && (
                                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-indigo-600 text-white font-bold">
                                  Tuần {displayWeekNumber}
                                </span>
                              )}
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
              );
            })()}
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar (Creator info, Milestone, People & Progress) */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-3 min-w-0 order-1 lg:order-2">
          {/* Creator & Creation Date Info Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 dark:text-slate-400">Người tạo:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{creatorDisplay}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px] flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {createdDateDisplay}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {displayWeekNumber ? (
                  <span className="font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-xl border border-indigo-200/80 dark:border-indigo-800/80 text-xs">
                    Tuần {displayWeekNumber} / {task.year || 2026}
                  </span>
                ) : (
                  <span className="font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    Kho Backlog
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Comprehensive Metadata Section */}
          <div className="space-y-2.5 saho-modal-card p-3.5 sm:p-4 rounded-[12px] border text-xs">
            {/* Milestone Card (Full-width row on top) */}
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

            {/* Assignee Card (Full-width row, placed right next to Collab) */}
            <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 dark:text-slate-400 text-[11px] font-medium">Người phụ trách chính:</span>
                {task.supporterAccounts && task.supporterAccounts.length > 0 && task.assigneeAccount && (
                  <span className="text-[10.5px] font-bold font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800">
                    {getMemberTaskEffort(task, task.assigneeAccount)}h
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <UserAvatar
                  user={assigneeUser}
                  account={task.assigneeAccount}
                  name={assigneeUser?.name}
                  size="sm"
                  shape="circle"
                />
                {(() => {
                  const assigneeRoleInTask = assigneeUser ? getUserRoleInSpec(assigneeUser, task.role) : 'Member';
                  return (
                    <div className="min-w-0 flex-1">
                      <div className={`font-bold text-xs leading-snug break-words ${getUserRoleColorClass(assigneeRoleInTask)}`}>
                        {assigneeUser?.name || task.assigneeAccount || 'Chưa gán'}
                      </div>
                      {task.assigneeAccount && (
                        <div className={`text-[11px] font-medium font-mono ${getUserRoleColorClass(assigneeRoleInTask)}`}>
                          @{task.assigneeAccount}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Collab Card (If collaborators are assigned to this task) */}
            {task.supporterAccounts && task.supporterAccounts.length > 0 && (
              <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-400 dark:text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Thành viên Collab ({task.supporterAccounts.length}):</span>
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    Tổng task: {task.actualEffort || 0}h
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {task.supporterAccounts.map((supAcc) => {
                    const supUser = users.find((u) => u.account.toLowerCase() === supAcc.toLowerCase());
                    const supRoleInTask = supUser ? getUserRoleInSpec(supUser, task.role) : 'Member';
                    const supEffort = getMemberTaskEffort(task, supAcc);
                    return (
                      <div
                        key={supAcc}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/80 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl"
                      >
                        <UserAvatar
                          user={supUser}
                          account={supAcc}
                          name={supUser?.name}
                          size="xs"
                          shape="circle"
                        />
                        <div className="min-w-0">
                          <span className={`font-bold text-xs ${getUserRoleColorClass(supRoleInTask)}`}>
                            {supUser?.name || supAcc}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 ml-1">
                            @{supAcc}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800">
                          {supEffort}h
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Collab
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom row: Effort and Completion Progress */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 dark:text-slate-400 text-[11px] font-medium">
                    {displayWeekNumber ? `Effort Tuần ${displayWeekNumber}:` : 'Effort (Est):'}
                  </span>
                  {accumulatedEffort.hasMultiWeekHistory && (
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800">
                      Tổng: {accumulatedEffort.totalEffort}h
                    </span>
                  )}
                </div>
                <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1">
                  <span>{displayActualEffort}h</span>
                  <span className="text-slate-300 dark:text-slate-600 font-normal">/</span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{displayEstimatedEffort}h (Est)</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">Tiến độ hoàn thành:</span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400 font-mono">
                    {displayCompletionPct}%
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${effectiveDisplayStatus === 'Done'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                    : effectiveDisplayStatus === 'In Progress'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                    {effectiveDisplayStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Completion Progress Bar */}
            <div className="space-y-1.5 pt-0.5">
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200/80 dark:border-slate-700">
                <div
                  className={`h-full transition-all duration-300 ${displayCompletionPct === 100
                    ? 'bg-emerald-500'
                    : displayCompletionPct > 0
                      ? 'bg-indigo-600 dark:bg-indigo-500'
                      : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  style={{ width: `${displayCompletionPct}%` }}
                />
              </div>
            </div>

            {/* Multi-week Accumulated Effort Breakdown & Immutable Weekly History Map */}
            {(accumulatedEffort.hasMultiWeekHistory || Object.keys(liveTask.weeklyHistory || {}).length > 0) && (
              <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>Bảng Map Lịch Sử Tuần & Effort Lũy Kế ({accumulatedEffort.chainTaskCount} tuần):</span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[9.5px] font-semibold"
                      title="Dữ liệu tuần đã chốt được khóa trong bảng map của task, code hệ thống không tự ý thay đổi"
                    >
                      <Lock className="w-2.5 h-2.5 text-amber-500" />
                      Cố định khi chốt tuần
                    </span>
                    {isStrictAdmin && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[9.5px] font-bold">
                        Admin có quyền sửa
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-extrabold text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 shrink-0">
                    Tổng: {accumulatedEffort.totalEffort}h
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-0.5">
                  {accumulatedEffort.weeklyBreakdown.map((item) => {
                    const isSelectedCardWeek = displayWeekNumber === item.weekNumber;
                    return (
                      <div
                        key={item.weekKey}
                        onClick={() =>
                          setSelectedViewWeek(
                            item.weekNumber === liveNormWeek ? null : item.weekNumber
                          )
                        }
                        title={`Bấm để xem chi tiết dữ liệu của Tuần ${item.weekNumber}`}
                        className={`p-2 rounded-lg border text-xs flex flex-col justify-between transition-colors cursor-pointer ${editingWeekKey === item.weekKey
                          ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 ring-1 ring-amber-400/50'
                          : isSelectedCardWeek
                            ? 'bg-[rgba(24,144,255,0.08)] dark:bg-sky-950/70 border-[#1890FF] dark:border-[#40A9FF] ring-2 ring-[#1890FF]/35 shadow-sm'
                            : item.isCurrentWeek
                              ? 'bg-[rgba(24,144,255,0.04)] dark:bg-sky-950/35 border-[rgba(24,144,255,0.28)] dark:border-sky-800 hover:border-[#40A9FF]'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700 hover:border-[#40A9FF] dark:hover:border-sky-600'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <span>Tuần {item.weekNumber}</span>
                            {item.isLockedHistory && (
                              <span title="Dữ liệu tuần đã khóa trong bảng map">
                                <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1">
                            {item.isCurrentWeek && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-[4px] bg-[#1890FF] text-white font-bold">
                                Tuần này
                              </span>
                            )}
                            {item.isLockedHistory && isStrictAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingWeekState({ taskId: liveTask.id, weekKey: item.weekKey });
                                  setEditWeekEffort(String(item.effort));
                                  setEditWeekPct(item.percentage);
                                  setEditWeekStatus(
                                    item.status === 'Done' || item.status === 'In Progress'
                                      ? item.status
                                      : 'To do'
                                  );
                                  setEditWeekNotes(item.notes || '');
                                }}
                                className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700 text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition active:scale-95"
                                title={`Admin chỉnh sửa dữ liệu map ${item.weekKey}`}
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                                <span>Sửa</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                            <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-100">
                              {item.effort}h
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              {item.percentage}% • {item.status}
                            </span>
                          </div>
                          {item.updatedByAdminAccount && (
                            <div className="text-[9px] text-amber-700 dark:text-amber-400 mt-0.5 truncate">
                              Admin sửa: @{item.updatedByAdminAccount}
                            </div>
                          )}
                        </div>
                        );
                      })}
                      </div>

                    {/* Admin-Only Inline Weekly Map Editor */ }
                    {
                      isStrictAdmin && editingWeekKey && liveTask.weeklyHistory?.[editingWeekKey] && (
                        <div className="bg-amber-50/80 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-800 rounded-xl p-3 space-y-2.5 text-xs animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                              <span>Chỉnh sửa Bảng Map Lịch Sử [{editingWeekKey}] (Chỉ Admin)</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingWeekState(null)}
                              className="p-1 text-amber-700 hover:text-amber-900 dark:text-amber-300 rounded cursor-pointer"
                              title="Đóng trình sửa map"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                Effort tuần (h):
                              </label>
                              <input
                                type="number"
                                step="0.25"
                                min={0}
                                max={24}
                                value={editWeekEffort}
                                onChange={(e) => setEditWeekEffort(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                              />
                            </div>

                            <div>
                              <label className="block text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                Tiến độ (%):
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={editWeekPct}
                                onChange={(e) =>
                                  setEditWeekPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                                }
                                className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                              />
                            </div>

                            <div>
                              <label className="block text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                Trạng thái:
                              </label>
                              <select
                                value={editWeekStatus}
                                onChange={(e) => setEditWeekStatus(e.target.value as TaskStatus)}
                                className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                              >
                                <option value="To do">To do</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Done">Done</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              Ghi chú lịch sử tuần:
                            </label>
                            <input
                              type="text"
                              value={editWeekNotes}
                              onChange={(e) => setEditWeekNotes(e.target.value)}
                              placeholder="Ghi chú nội bộ của Admin cho tuần lịch sử này..."
                              className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const targetKey = editingWeekKey;
                                confirmDialog({
                                  title: `Xóa mục lịch sử [${targetKey}]`,
                                  message: `Bạn có chắc muốn xóa bản ghi lịch sử [${targetKey}] khỏi bảng map của task "${liveTask.code || liveTask.title}" không?`,
                                  confirmText: 'Xóa bản ghi',
                                  type: 'danger',
                                  onConfirm: () => {
                                    adminDeleteTaskWeeklyHistory(liveTask.id, targetKey);
                                    setEditingWeekState(null);
                                  },
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-800 cursor-pointer transition"
                            >
                              Xóa tuần
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingWeekState(null)}
                                className="px-3 py-1.5 bg-[#F8FAFB] dark:bg-slate-800 border border-[#E8E9EF] dark:border-slate-700 text-[#1D202A] dark:text-slate-200 rounded-[8px] text-xs font-semibold hover:bg-[#F3F4F7] dark:hover:bg-slate-700 hover:border-[#A2A6B4] cursor-pointer transition"
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  adminUpdateTaskWeeklyHistory(liveTask.id, editingWeekKey, {
                                    actualEffort: Math.min(24, Math.max(0, parseFloat(editWeekEffort.replace(',', '.')) || 0)),
                                    completionPercentage: Math.min(100, Math.max(0, Number(editWeekPct) || 0)),
                                    status: editWeekStatus,
                                    notes: editWeekNotes,
                                  });
                                  setEditingWeekState(null);
                                }}
                                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-[8px] text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Lưu Map (Admin)</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    }
                  </div>
                )}

                {/* Start Date & End Date Row if present */}
                {(task.startDate || task.endDate) && (
                  <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                    <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                      <span className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-indigo-500" />
                        Ngày bắt đầu:
                      </span>
                      <div className="font-mono font-bold text-xs text-indigo-700 dark:text-indigo-300">
                        {formatDateOnlyDisplay(task.startDate) || 'Chưa cập nhật'}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                      <span className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-emerald-500" />
                        {isTaskFullyDone ? 'Ngày hoàn thành:' : 'Hạn hoàn thành (Deadline):'}
                      </span>
                      <div className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-300">
                        {formatDateOnlyDisplay(task.endDate) || (isTaskFullyDone ? 'Hoàn thành' : 'Chưa đặt')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>
    </Modal>
  );
};
