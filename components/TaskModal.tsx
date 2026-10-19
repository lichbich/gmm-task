import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Task, Specialization, TaskStatus, TaskActivityLog, getUserRoleInSpec, getTodayDateOnlyString, formatDateOnlyDisplay, isUserPM, isUserAdminOrPM, isSpecializationMatchingRole } from '../types/task';
import { X, Save, Plus, Edit2, ShieldAlert, MessageSquare, FileText, CheckSquare, Image as ImageIcon, Loader2, AlertTriangle, Sparkles, Calendar, Users, UserPlus, Trash2, CornerDownRight, GitFork, Layers, ChevronDown, ChevronRight, ChevronUp, Check, Copy, Link2, User, Flag, FolderOpen, History, Activity, Clock, UserCheck, CheckCircle2 } from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { Dropdown, DropdownOption } from './common/Dropdown';
import { DatePicker } from './common/DatePicker';
import { UserAvatar } from './common/UserAvatar';
import { insertCheckboxToText, removeImageFromDescription } from '../lib/descriptionHelper';
import { uploadAndInsertImage, getImageFilesFromClipboard, getImageFilesFromDrop } from '../lib/imageUploadHelper';
import { ImageAttachmentStrip } from './common/ImageAttachmentStrip';
import { ImageLightbox } from './common/ImageLightbox';
import { DescriptionEditor } from './common/DescriptionEditor';
import { TaskTitleInput } from './common/TaskTitleInput';
import { AITaskChatBox } from './AITaskChatBox';
import { SubTaskSuggestion, requestAIEffortSuggestion, isAIFeatureEnabled } from '../lib/geminiService';
import { ensureTaskTitlePrefix, getRoleTaskPrefix } from '../lib/taskPrefixHelper';
import { isSubtask, isParentTask, getSubtasksOfParent, calculateParentMetrics } from '../lib/subtaskHelper';
import { generateNextTaskCode, getRolePrefix, parseTaskCode } from '../lib/taskCodeHelper';
import { LinkExistingTasksModal } from './common/LinkExistingTasksModal';

const formatDateTime = (isoOrStr: string) => {
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

interface TaskModalProps {
  task?: Task | null;
  isOpen: boolean;
  onClose: () => void;
  initialMilestoneId?: string;
  initialRole?: Specialization;
  defaultWeek?: number;
  defaultAssignee?: string;
  initialSubtaskParent?: Task | null;
  onOpenCreateSubtask?: (parentTask: Task) => void;
  onSelectTaskToEdit?: (task: Task) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  isOpen,
  onClose,
  initialMilestoneId,
  initialRole,
  defaultWeek,
  defaultAssignee,
  initialSubtaskParent,
  onOpenCreateSubtask,
  onSelectTaskToEdit,
}) => {
  const { addTask, updateTask, deleteTask, milestones, users, currentUser, confirmDialog, roles, selectedWeek, selectedYear, simulatedTime, isUserAllowedAI, tasks } = useApp();

  // AI features enabled based on permission config (Default: Admin, LichDT, QuynhNV, NhiHT)
  const canUseAI = isUserAllowedAI(currentUser, 'assistant');

  const allRoleCodes = roles.map((r) => r.code);

  // Helper to match a role string against roles list
  const matchRoleCode = (spec: string): string => {
    const direct = roles.find((r) => r.code.toLowerCase() === spec.toLowerCase());
    if (direct) return direct.code;
    const fuzzy = roles.find(
      (r) => r.code.toLowerCase().includes(spec.toLowerCase()) || spec.toLowerCase().includes(r.code.toLowerCase())
    );
    if (fuzzy) return fuzzy.code;
    return spec;
  };

  // Compute allowed roles for the current user: Admin/PM can define any role, Leader only within specializations
  const allowedRoles: Specialization[] =
    isUserAdminOrPM(currentUser)
      ? allRoleCodes
      : currentUser?.specializations && currentUser.specializations.length > 0
      ? Array.from(new Set(currentUser.specializations.map(matchRoleCode)))
      : [allRoleCodes[0] || 'BA'];

  // Match target role against allowedRoles (direct, case-insensitive, fuzzy)
  const matchRoleInAllowed = (target?: string): Specialization | undefined => {
    if (!target) return undefined;
    const direct = allowedRoles.find((r) => r === target);
    if (direct) return direct;
    const ci = allowedRoles.find((r) => r.toLowerCase() === target.toLowerCase());
    if (ci) return ci;
    const fuzzy = allowedRoles.find(
      (r) => r.toLowerCase().includes(target.toLowerCase()) || target.toLowerCase().includes(r.toLowerCase())
    );
    if (fuzzy) return fuzzy;
    return undefined;
  };

  // Default role resolution: match initialRole -> match user specialization -> first allowed role
  const getUserDefaultRole = (): Specialization => {
    const userSpecs = currentUser?.specializations || [];
    for (const spec of userSpecs) {
      const match = matchRoleInAllowed(spec);
      if (match) return match;
    }
    return allowedRoles[0] || 'BA';
  };

  const defaultRole: Specialization =
    matchRoleInAllowed(initialRole) || getUserDefaultRole();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState<Specialization>(defaultRole);
  const [estimatedEffort, setEstimatedEffort] = useState<number | string>(2);
  const [actualEffort, setActualEffort] = useState<number | string>(0);
  const [completionPercentage, setCompletionPercentage] = useState<number>(0);
  const [assigneeAccount, setAssigneeAccount] = useState<string>('');
  const [supporterAccounts, setSupporterAccounts] = useState<string[]>([]);
  const [milestoneId, setMilestoneId] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>('To do');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [weekNumber, setWeekNumber] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subtask system state
  const [isSubtaskMode, setIsSubtaskMode] = useState<boolean>(false);
  const [subtaskParentId, setSubtaskParentId] = useState<string>('');
  const [subtaskParentTitle, setSubtaskParentTitle] = useState<string>('');
  const [subtaskReviewerAccount, setSubtaskReviewerAccount] = useState<string>('');
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [isLinkExistingModalOpen, setIsLinkExistingModalOpen] = useState<boolean>(false);

  // Subtasks list for current task (if parent)
  const existingSubtasks = task ? tasks.filter((t) => t.subtaskParentId === task.id) : [];
  const hasSubtasks = existingSubtasks.length > 0;
  const parentMetrics = hasSubtasks && task ? calculateParentMetrics(task, existingSubtasks) : null;

  // Helper to extract creation timestamp of a task
  const getTaskCreatedTime = (t: Task): number => {
    if (t.createdAt) {
      const time = new Date(t.createdAt).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    if (t.id && t.id.startsWith('tsk-')) {
      const match = t.id.match(/^tsk-(\d+)/);
      if (match) {
        const time = parseInt(match[1], 10);
        if (!isNaN(time) && time > 0) return time;
      }
    }
    if (t.updatedAt) {
      const time = new Date(t.updatedAt).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    const idx = tasks.indexOf(t);
    return idx >= 0 ? idx : 0;
  };

  // Potential parent tasks candidate list (only suggest tasks matching current task's role)
  const potentialParentTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Exclude itself
        if (task && t.id === task.id) return false;
        // Exclude current subtasks of this task (prevent circular hierarchy)
        if (task && t.subtaskParentId === task.id) return false;
        // Exclude any task that is already a subtask
        if (t.isSubtask || (t.subtaskParentId && t.subtaskParentId.trim() !== '')) return false;

        // Keep already selected parent task even if roles differ
        if (subtaskParentId && t.id === subtaskParentId) return true;

        // Only suggest candidate parent tasks matching current task's role
        if (role && !isSpecializationMatchingRole(t.role, role)) return false;

        return true;
      })
      .sort((a, b) => {
        // 1. Đẩy các task mới tạo nhất lên đầu danh sách (đặc biệt khi vừa tạo task bố xong tạo tiếp task con)
        const aCreated = getTaskCreatedTime(a);
        const bCreated = getTaskCreatedTime(b);
        if (aCreated !== bCreated) {
          return bCreated - aCreated;
        }

        // 2. Ưu tiên tuần hiện tại
        const aWeek = a.weekNumber || 0;
        const bWeek = b.weekNumber || 0;
        const targetWeek = weekNumber || selectedWeek || 0;
        const aSameWeek = aWeek === targetWeek ? 1 : 0;
        const bSameWeek = bWeek === targetWeek ? 1 : 0;
        if (aSameWeek !== bSameWeek) return bSameWeek - aSameWeek;
        if (bWeek !== aWeek) return bWeek - aWeek;

        // 3. Alphabetical
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [tasks, task, role, subtaskParentId, weekNumber, selectedWeek]);

  // Options formatted for common Dropdown component
  const parentDropdownOptions = useMemo<DropdownOption[]>(() => {
    const list: DropdownOption[] = [
      {
        value: '',
        label: '-- Task độc lập (Không thuộc task nào) --',
        subLabel: 'Task này đứng riêng, không phụ thuộc task cha',
      },
    ];

    potentialParentTasks.forEach((p) => {
      const weekStr = p.weekNumber ? `Tuần ${p.weekNumber}` : 'Backlog';
      const assigneeStr = p.assigneeAccount ? `@${p.assigneeAccount}` : 'Chưa gán';
      const statusStr = p.status ? ` • ${p.status}` : '';
      const createdTime = getTaskCreatedTime(p);
      const isVeryRecent = Date.now() - createdTime < 24 * 60 * 60 * 1000 && createdTime > 1000000;

      list.push({
        value: p.id,
        label: `[${p.role}] ${p.title}`,
        subLabel: `${weekStr} • Phụ trách: ${assigneeStr}${statusStr}`,
        badge: isVeryRecent ? (
          <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-semibold px-1.5 py-0.5 rounded-md border border-emerald-300/80 dark:border-emerald-700">
            Mới tạo
          </span>
        ) : undefined,
      });
    });

    return list;
  }, [potentialParentTasks]);

  const creatorDisplay = useMemo(() => {
    if (!task) return currentUser?.name || currentUser?.account || 'Bạn';
    if (task.createdBy) return task.createdBy;
    return 'Hệ thống';
  }, [task, currentUser]);

  const createdDateDisplay = useMemo(() => {
    if (!task) return 'Hôm nay (Tạo mới)';
    if (!task.createdAt) return 'Không rõ thời gian';
    try {
      const d = new Date(task.createdAt);
      if (isNaN(d.getTime())) return task.createdAt;
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return task.createdAt;
    }
  }, [task]);

  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const previewCode = useMemo(() => {
    const expectedRolePrefix = getRolePrefix(role, roles);
    const parsed = parseTaskCode(task?.code);
    const isCodeRoleMatching = parsed && parsed.role === expectedRolePrefix;

    const isUnchanged =
      Boolean(task?.code) &&
      isCodeRoleMatching &&
      task?.milestoneId === milestoneId &&
      task?.role === role &&
      Boolean(task?.isSubtask || task?.subtaskParentId) === Boolean(isSubtaskMode || subtaskParentId) &&
      (task?.subtaskParentId || '') === (subtaskParentId || '');

    if (isUnchanged) return task!.code;

    return generateNextTaskCode({
      milestoneId: milestoneId,
      role: role,
      isSubtask: Boolean(isSubtaskMode || subtaskParentId),
      subtaskParentId: subtaskParentId,
      existingTasks: tasks.filter((t) => t.id !== task?.id),
      milestones,
      roles,
    });
  }, [task, milestoneId, role, isSubtaskMode, subtaskParentId, tasks, milestones, roles]);

  const assigneeUser = useMemo(() => {
    if (!task?.assigneeAccount) return null;
    return users.find((u) => u.account.toLowerCase() === task.assigneeAccount.toLowerCase()) || null;
  }, [task?.assigneeAccount, users]);

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
        id: `init-${task.id}`,
        timestamp: task.createdAt,
        authorName: task.createdBy || 'Hệ thống',
        authorAccount: assigneeUser?.account || 'system',
        authorRole: 'Admin',
        actionType: 'CREATE',
        summary: 'Khởi tạo công việc ban đầu',
      });
    }
    return logs;
  }, [task, assigneeUser]);

  // Mobile tab state ('form' | 'ai')
  const [activeMobileTab, setActiveMobileTab] = useState<'form' | 'ai'>('form');
  const [showAIChat, setShowAIChat] = useState<boolean>(false);

  // AI Effort Estimation & Breakdown state
  const [isAILoadingEffort, setIsAILoadingEffort] = useState<boolean>(false);
  const [aiEffortReasoning, setAiEffortReasoning] = useState<string | null>(null);
  const [aiEffortError, setAiEffortError] = useState<string | null>(null);

  // Helper to map AI suggested role to an existing allowed role in the project
  const mapAiRoleToAppRole = (aiRole: string): Specialization => {
    const norm = (aiRole || '').toLowerCase().trim();
    if (norm.includes('design') || norm.includes('ui') || norm.includes('ux') || norm.includes('thiết kế')) {
      return matchRoleInAllowed('Design') || matchRoleInAllowed('Designer') || defaultRole;
    }
    if (norm.includes('front') || norm === 'fe' || norm.includes('giao diện') || norm.includes('react')) {
      return matchRoleInAllowed('FE') || matchRoleInAllowed('Frontend') || defaultRole;
    }
    if (norm.includes('back') || norm === 'be' || norm.includes('máy chủ') || norm.includes('server') || norm.includes('api')) {
      return matchRoleInAllowed('BE') || matchRoleInAllowed('Backend') || defaultRole;
    }
    if (norm.includes('test') || norm.includes('qa') || norm.includes('qc') || norm.includes('kiểm thử')) {
      return matchRoleInAllowed('QA') || matchRoleInAllowed('Tester') || defaultRole;
    }
    if (norm === 'dev') {
      return matchRoleInAllowed('FE') || matchRoleInAllowed('BE') || defaultRole;
    }
    return matchRoleInAllowed(aiRole) || defaultRole;
  };

  const handleSuggestEffort = async () => {
    const taskTitle = title.trim();
    if (!taskTitle && !description.trim()) {
      setAiEffortError('Vui lòng nhập tên hoặc mô tả task để AI ước tính giờ.');
      return;
    }

    setIsAILoadingEffort(true);
    setAiEffortError(null);
    setAiEffortReasoning(null);

    try {
      const result = await requestAIEffortSuggestion(taskTitle || 'Đầu việc', description, role);
      if (result.error) {
        setAiEffortError(result.error);
      } else {
        setEstimatedEffort(result.estimatedEffort);
        setAiEffortReasoning(result.reasoning);
      }
    } catch (err: any) {
      setAiEffortError(err.message || 'Lỗi ước tính giờ.');
    } finally {
      setIsAILoadingEffort(false);
    }
  };

  const handleApplySingleTaskFromAI = (subTask: SubTaskSuggestion) => {
    setTitle(subTask.taskName);
    const targetRole = mapAiRoleToAppRole(subTask.role);
    setRole(targetRole);
    setEstimatedEffort(subTask.estimatedEffort);
    setDescription(subTask.description);
    setAiEffortReasoning(null);
    setAiEffortError(null);
    setActiveMobileTab('form');
  };

  const handleApplyFullBreakdownFromAI = (tasksList: SubTaskSuggestion[]) => {
    if (!tasksList || tasksList.length === 0) return;
    if (tasksList.length === 1) {
      handleApplySingleTaskFromAI(tasksList[0]);
      return;
    }
    const first = tasksList[0];
    setTitle(first.taskName);
    setRole(mapAiRoleToAppRole(first.role));
    setEstimatedEffort(first.estimatedEffort);

    const checklist = tasksList
      .map(
        (t) =>
          `- [ ] [${t.role}] ${t.taskName} (${t.estimatedEffort}h)\n  ${t.description.replace(/\n/g, '\n  ')}`
      )
      .join('\n\n');
    setDescription(checklist);
    setAiEffortReasoning(null);
    setAiEffortError(null);
    setActiveMobileTab('form');
  };

  const handleAppendChecklistFromAI = (tasksToAppend: SubTaskSuggestion[]) => {
    const checklist = tasksToAppend
      .map((t) => `- [ ] [${t.role}] ${t.taskName} (${t.estimatedEffort}h)\n  ${t.description.replace(/\n/g, '\n  ')}`)
      .join('\n\n');

    setDescription((prev) =>
      prev.trim() ? `${prev.trim()}\n\n### 📋 Danh sách Task con (Gemini):\n${checklist}` : `### 📋 Danh sách Task con (Gemini):\n${checklist}`
    );
    setActiveMobileTab('form');
  };

  const handleBatchCreateTasksFromAI = (tasksToCreate: SubTaskSuggestion[]) => {
    if (tasksToCreate.length === 0) return;

    confirmDialog({
      title: 'Tạo hàng loạt task con bằng AI',
      message: `Hệ thống sẽ tự động tạo ${tasksToCreate.length} đầu việc con tương ứng vào ${
        milestoneId
          ? `cột mốc "${milestones.find((m) => m.id === milestoneId)?.title || 'Milestone'}"`
          : 'dự án'
      } (Tuần ${defaultWeek || selectedWeek}). Bạn có muốn tiếp tục?`,
      confirmText: `Tạo ngay ${tasksToCreate.length} task`,
      cancelText: 'Hủy',
      type: 'info',
      onConfirm: () => {
        for (const st of tasksToCreate) {
          const targetRole = mapAiRoleToAppRole(st.role);
          addTask({
            title: st.taskName,
            description: st.description,
            role: targetRole,
            estimatedEffort: st.estimatedEffort,
            actualEffort: 0,
            status: 'To do',
            priority: 'Medium',
            assigneeAccount: '',
            milestoneId: milestoneId || (initialMilestoneId !== undefined ? initialMilestoneId : ''),
            completionPercentage: 0,
            weekNumber: defaultWeek || selectedWeek,
            year: selectedYear,
          });
        }
        forceClose();
      },
    });
  };

  const handleProgressChange = (newPct: number) => {
    const boundedPct = Math.max(0, Math.min(100, Math.round(newPct)));
    setCompletionPercentage(boundedPct);
    const currActual =
      typeof actualEffort === 'number'
        ? actualEffort
        : parseFloat(String(actualEffort).replace(',', '.')) || 0;
    const parsedEst =
      typeof estimatedEffort === 'number'
        ? estimatedEffort
        : parseFloat(String(estimatedEffort).replace(',', '.')) || 0;
    const todayStr = getTodayDateOnlyString(simulatedTime);

    if (boundedPct >= 100) {
      setStatus('Done');
      if (currActual === 0 && parsedEst > 0) {
        setActualEffort(parsedEst);
      }
      if (!startDate) setStartDate(todayStr);
      if (!endDate) setEndDate(todayStr);
    } else if (boundedPct > 0) {
      setStatus('In Progress');
      if (!startDate) setStartDate(todayStr);
    } else {
      setStatus('To do');
      setActualEffort(0);
      if (task) {
        setStartDate(task.startDate || '');
        setEndDate(task.endDate || '');
      }
    }
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    setStatus(newStatus);
    const todayStr = getTodayDateOnlyString(simulatedTime);
    if (newStatus === 'In Progress') {
      if (!startDate) setStartDate(todayStr);
    } else if (newStatus === 'Done') {
      if (!startDate) setStartDate(todayStr);
      if (!endDate) setEndDate(todayStr);
    }

    if (isUserAdminOrPM(currentUser)) {
      const currActual =
        typeof actualEffort === 'number'
          ? actualEffort
          : parseFloat(String(actualEffort).replace(',', '.')) || 0;
      const parsedEst =
        typeof estimatedEffort === 'number'
          ? estimatedEffort
          : parseFloat(String(estimatedEffort).replace(',', '.')) || 0;

      if (newStatus === 'Done') {
        setCompletionPercentage(100);
        if (currActual === 0 && parsedEst > 0) {
          setActualEffort(parsedEst);
        }
      } else if (newStatus === 'To do') {
        setCompletionPercentage(0);
        setActualEffort(0);
      } else if (newStatus === 'In Progress') {
        const nextPct = (completionPercentage === 0 || completionPercentage === 100) ? 50 : completionPercentage;
        setCompletionPercentage(nextPct);
      }
    }
  };

  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate);
    if (newStartDate && endDate && endDate < newStartDate) {
      setEndDate(newStartDate);
    }
  };

  const handleEndDateChange = (newEndDate: string) => {
    setEndDate(newEndDate);
    if (newEndDate && startDate && newEndDate < startDate) {
      setStartDate(newEndDate);
    }
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      try {
        await uploadAndInsertImage(files[i], setDescription, setIsUploadingImage);
      } catch (err: any) {
        alert(err.message || 'Lỗi xử lý tải ảnh');
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePasteDescription = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = getImageFilesFromClipboard(e);
    if (imageFiles.length > 0) {
      e.preventDefault();
      for (const file of imageFiles) {
        try {
          await uploadAndInsertImage(file, setDescription, setIsUploadingImage);
        } catch (err: any) {
          alert(err.message || 'Lỗi xử lý tải ảnh');
        }
      }
    }
  };

  const handleDropDescription = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    const imageFiles = getImageFilesFromDrop(e);
    if (imageFiles.length > 0) {
      e.preventDefault();
      for (const file of imageFiles) {
        try {
          await uploadAndInsertImage(file, setDescription, setIsUploadingImage);
        } catch (err: any) {
          alert(err.message || 'Lỗi xử lý tải ảnh');
        }
      }
    }
  };

  const checkDirtyAndConfirmClose = useCallback((): boolean => {
    let isDirty = false;
    const parsedActual =
      typeof actualEffort === 'number'
        ? actualEffort
        : parseFloat(String(actualEffort).replace(',', '.')) || 0;
    const isAdminOrPM = isUserAdminOrPM(currentUser);

    if (!task) {
      // Creating new task
      const defaultAssigneeVal =
        defaultAssignee !== undefined
          ? defaultAssignee
          : currentUser?.role === 'Member' && currentUser?.account
          ? currentUser.account
          : '';
      const defaultMilestoneVal = initialMilestoneId !== undefined ? initialMilestoneId : '';

      isDirty =
        title.trim() !== '' ||
        description.trim() !== '' ||
        notes.trim() !== '' ||
        (estimatedEffort !== 2 && estimatedEffort !== '2') ||
        (isAdminOrPM && (parsedActual !== 0 || completionPercentage !== 0)) ||
        assigneeAccount !== defaultAssigneeVal ||
        supporterAccounts.length > 0 ||
        milestoneId !== defaultMilestoneVal;
    } else {
      // Editing existing task
      const origTitle = task.title || '';
      const origDesc = task.description || '';
      const origNotes = task.notes || '';
      const origEffort = task.estimatedEffort !== undefined ? task.estimatedEffort : 2;
      const origActualEffort = task.actualEffort !== undefined ? task.actualEffort : 0;
      const origCompletion =
        task.completionPercentage !== undefined
          ? task.completionPercentage
          : task.status === 'Done'
          ? 100
          : 0;
      const origAssignee =
        task.assigneeAccount ||
        task.assignmentRequestedBy ||
        (defaultAssignee !== undefined ? defaultAssignee : '');
      const origSupporters = (task.supporterAccounts || []).slice().sort().join(',');
      const currSupporters = supporterAccounts.slice().sort().join(',');
      const origMilestone = task.milestoneId || initialMilestoneId || '';
      const origRole = task.role || defaultRole;
      const origStatus = task.status || 'To do';
      const origPriority = task.priority || 'Medium';

      isDirty =
        title !== origTitle ||
        description !== origDesc ||
        notes !== origNotes ||
        String(estimatedEffort) !== String(origEffort) ||
        assigneeAccount !== origAssignee ||
        currSupporters !== origSupporters ||
        milestoneId !== origMilestone ||
        role !== origRole ||
        status !== origStatus ||
        priority !== origPriority ||
        startDate !== (task.startDate || '') ||
        endDate !== (task.endDate || '') ||
        (isAdminOrPM &&
          (parsedActual !== origActualEffort || completionPercentage !== origCompletion));
    }

    if (isDirty) {
      confirmDialog({
        title: 'Task đang điền dở dang',
        message: 'Bạn đang nhập thông tin công việc chưa lưu. Bạn có chắc chắn muốn hủy và thoát không? Mọi thông tin vừa nhập sẽ bị mất.',
        confirmText: 'Rời khỏi & Hủy',
        cancelText: 'Tiếp tục điền',
        type: 'warning',
        onConfirm: () => {
          forceClose();
        },
      });
      return false;
    }
    return true;
  }, [
    task,
    title,
    description,
    notes,
    estimatedEffort,
    actualEffort,
    completionPercentage,
    startDate,
    endDate,
    assigneeAccount,
    supporterAccounts,
    milestoneId,
    role,
    status,
    priority,
    defaultAssignee,
    initialMilestoneId,
    defaultRole,
    currentUser,
    confirmDialog,
  ]);

  const { isRendered, isVisible, handleClose, forceClose, handleBackdropMouseDown, handleBackdropClick } =
    useModalAnimation(isOpen, onClose, checkDirtyAndConfirmClose);

  useEffect(() => {
    if (!isOpen) return;

    if (task) {
      const isSub = Boolean(task.isSubtask || (task.subtaskParentId && task.subtaskParentId.trim() !== ''));
      setIsSubtaskMode(isSub);
      setSubtaskParentId(task.subtaskParentId || '');
      setSubtaskParentTitle(task.subtaskParentTitle || '');
      setSubtaskReviewerAccount(task.subtaskReviewerAccount || '');
      setIsManualOverride(Boolean(task.isManualOverride));

      const subtasksList = tasks.filter((t) => t.subtaskParentId === task.id);
      const metrics = subtasksList.length > 0 ? calculateParentMetrics(task, subtasksList) : null;

      const initialStatus = (metrics && !task.isManualOverride) ? metrics.status : (task.status || 'To do');
      const initialPct = (metrics && !task.isManualOverride)
        ? metrics.completionPercentage
        : task.completionPercentage !== undefined
        ? task.completionPercentage
        : task.status === 'Done'
        ? 100
        : 0;
      const initialEst = (metrics && !task.isManualOverride)
        ? metrics.totalEstimatedEffort
        : task.estimatedEffort !== undefined
        ? task.estimatedEffort
        : 2;
      const initialEffort = (metrics && !task.isManualOverride)
        ? metrics.totalActualEffort
        : task.actualEffort !== undefined
        ? task.actualEffort
        : 0;
      const initialStartDate = task.startDate || '';
      const initialEndDate = task.endDate || '';

      setTitle(task.title || '');
      setDescription(task.description || '');
      setRole(task.role || defaultRole);
      setEstimatedEffort(initialEst);
      setActualEffort(initialEffort);
      setCompletionPercentage(initialPct);
      // Auto-select assignee: use existing assignee, or fallback to member requesting task, or defaultAssignee
      const initialAssignee =
        task.assigneeAccount ||
        task.assignmentRequestedBy ||
        (defaultAssignee !== undefined ? defaultAssignee : '');
      setAssigneeAccount(initialAssignee);
      setSupporterAccounts(task.supporterAccounts ? [...task.supporterAccounts] : []);
      setMilestoneId(task.milestoneId || initialMilestoneId || '');
      setStatus(initialStatus);
      setPriority(task.priority || 'Medium');
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
      if (task.assignmentRequestStatus === 'PENDING' && task.requestedWeekNumber) {
        setWeekNumber(task.requestedWeekNumber);
      } else {
        setWeekNumber(task.weekNumber);
      }
      setNotes(task.notes || '');
    } else {
      if (initialSubtaskParent) {
        setIsSubtaskMode(true);
        setSubtaskParentId(initialSubtaskParent.id);
        setSubtaskParentTitle(initialSubtaskParent.title);
        setSubtaskReviewerAccount(initialSubtaskParent.assigneeAccount || initialSubtaskParent.subtaskReviewerAccount || '');
        setMilestoneId(initialSubtaskParent.milestoneId || (initialMilestoneId !== undefined ? initialMilestoneId : ''));
        setWeekNumber(initialSubtaskParent.weekNumber || defaultWeek || selectedWeek);
        if (initialSubtaskParent.role) {
          setRole(matchRoleInAllowed(initialSubtaskParent.role) || defaultRole);
        }
      } else {
        setIsSubtaskMode(false);
        setSubtaskParentId('');
        setSubtaskParentTitle('');
        setSubtaskReviewerAccount('');
        if (defaultRole) {
          setRole(defaultRole);
        }
      }
      setIsManualOverride(false);
      setTitle('');
      setDescription('');
      setEstimatedEffort(2);
      setActualEffort(0);
      setCompletionPercentage(0);
      setStartDate('');
      setEndDate('');
      const initialAssigneeVal =
        defaultAssignee !== undefined
          ? defaultAssignee
          : currentUser?.role === 'Member' && currentUser?.account
          ? currentUser.account
          : '';
      setAssigneeAccount(initialAssigneeVal);
      setWeekNumber(initialAssigneeVal ? (defaultWeek || selectedWeek) : undefined);
      setSupporterAccounts([]);
      if (!initialSubtaskParent) {
        setMilestoneId(initialMilestoneId !== undefined ? initialMilestoneId : '');
      }
      setStatus('To do');
      setPriority('Medium');
      setNotes('');
    }
    setAiEffortReasoning(null);
    setAiEffortError(null);
    setIsAILoadingEffort(false);
    setActiveMobileTab('form');
    setShowAIChat(false);
    setIsHistoryOpen(false);
  }, [isOpen, task?.id, initialSubtaskParent?.id]);

  const todayStr = getTodayDateOnlyString(simulatedTime);
  const userRoleInTaskSpec = getUserRoleInSpec(currentUser, role);
  const isMember = isUserAdminOrPM(currentUser) ? false : userRoleInTaskSpec === 'Member';

  // Filter active team members who hold the specialization matching the task's role (excluding locked accounts)
  const eligibleAssignees = users.filter((u) => {
    const isLocked = u.disabled || u.status === 'disabled';
    const isCurrentAssignee =
      task && task.assigneeAccount && u.account.toLowerCase() === task.assigneeAccount.toLowerCase();
    const isRequester =
      task &&
      task.assignmentRequestedBy &&
      u.account.toLowerCase() === task.assignmentRequestedBy.toLowerCase();
    const isDefault =
      defaultAssignee && u.account.toLowerCase() === defaultAssignee.toLowerCase();

    if (isLocked && !isCurrentAssignee && !isRequester && !isDefault) return false;

    // Always include requester or current assignee or defaultAssignee
    if (isCurrentAssignee || isRequester || isDefault) return true;

    return u.specializations && u.specializations.includes(role);
  });

  // Candidate supporters: all active users excluding current assignee
  const eligibleSupporters = users.filter((u) => {
    const isLocked = u.disabled || u.status === 'disabled';
    if (isLocked) return false;
    if (assigneeAccount && u.account.toLowerCase() === assigneeAccount.toLowerCase()) return false;
    return true;
  });

  const generateWeekOptions = (currentWeek: number) => {
    const opts = [];
    const minW = Math.max(93, currentWeek - 2);
    const maxW = currentWeek + 3;
    for (let w = minW; w <= maxW; w++) {
      const displayW = w <= 53 ? w + 55 : w;
      opts.push({
        value: String(w),
        label: `🗓️ Tuần ${displayW}${w === currentWeek ? ' (Tuần hiện tại)' : ''}`,
      });
    }
    return opts;
  };

  const handleToggleSupporter = (account: string) => {
    setSupporterAccounts((prev) => {
      const exists = prev.some((a) => a.toLowerCase() === account.toLowerCase());
      if (exists) {
        return prev.filter((a) => a.toLowerCase() !== account.toLowerCase());
      }
      return [...prev, account];
    });
  };

  const handleAssigneeChange = (newAssignee: string) => {
    setAssigneeAccount(newAssignee);
    if (newAssignee) {
      // Automatically remove from supporters if selected as main assignee
      setSupporterAccounts((prev) => prev.filter((a) => a.toLowerCase() !== newAssignee.toLowerCase()));
      // Auto-assign active week if currently in backlog
      if (weekNumber === undefined) {
        setWeekNumber(defaultWeek || selectedWeek);
      }
    }
  };

  const executeSave = (
    finalActualEffort: number,
    finalCompletionPercentage: number,
    finalStatus: TaskStatus
  ) => {
    const rawParsedEffort =
      typeof estimatedEffort === 'number'
        ? estimatedEffort
        : parseFloat(String(estimatedEffort).replace(',', '.')) || 0;
    const parsedEffort = Math.min(24, Math.max(0, rawParsedEffort));
    const safeActualEffort = Math.min(24, Math.max(0, finalActualEffort));
    const isAdminOrPM = isUserAdminOrPM(currentUser);
    const cleanSupporters = supporterAccounts.filter(
      (a) => !assigneeAccount || a.toLowerCase() !== assigneeAccount.toLowerCase()
    );
    const finalTitle = ensureTaskTitlePrefix(title, role, roles);

    if (task) {
      const isAssigned = Boolean(assigneeAccount && assigneeAccount.trim() !== '');
      const reqBy = task.assignmentRequestedBy;
      const isApprovingRequested =
        Boolean(reqBy && isAssigned && reqBy.toLowerCase() === assigneeAccount.toLowerCase());

      updateTask(task.id, {
        title: finalTitle,
        description,
        role,
        estimatedEffort: parsedEffort,
        assigneeAccount,
        supporterAccounts: cleanSupporters.length > 0 ? cleanSupporters : undefined,
        milestoneId,
        status: finalStatus,
        priority,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
        notes,
        isParentTask: hasSubtasks || task.isParentTask,
        isSubtask: isSubtaskMode,
        subtaskParentId: isSubtaskMode ? subtaskParentId : undefined,
        subtaskParentTitle: isSubtaskMode ? subtaskParentTitle : undefined,
        subtaskReviewerAccount: isSubtaskMode ? subtaskReviewerAccount : undefined,
        isManualOverride: hasSubtasks ? isManualOverride : undefined,
        ...(isAdminOrPM
          ? {
              actualEffort: safeActualEffort,
              completionPercentage: finalCompletionPercentage,
              ...(finalCompletionPercentage === 100 || finalStatus === 'Done'
                ? { lastSubmittedAt: task.lastSubmittedAt || new Date().toISOString() }
                : {}),
            }
          : {}),
        ...(isApprovingRequested || (isAssigned && task.assignmentRequestedBy)
          ? { assignmentRequestStatus: 'APPROVED' }
          : {}),
        weekNumber: weekNumber,
        requestedWeekNumber: undefined,
      });
    } else {
      addTask({
        title: finalTitle,
        description,
        role,
        estimatedEffort: parsedEffort,
        actualEffort: safeActualEffort,
        status: finalStatus,
        priority,
        assigneeAccount,
        supporterAccounts: cleanSupporters.length > 0 ? cleanSupporters : undefined,
        milestoneId,
        completionPercentage: finalCompletionPercentage,
        weekNumber: weekNumber,
        year: selectedYear,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
        notes,
        isSubtask: isSubtaskMode,
        subtaskParentId: isSubtaskMode ? subtaskParentId : undefined,
        subtaskParentTitle: isSubtaskMode ? subtaskParentTitle : undefined,
        subtaskReviewerAccount: isSubtaskMode ? subtaskReviewerAccount : undefined,
        ...(isAdminOrPM && (finalCompletionPercentage === 100 || finalStatus === 'Done')
          ? { lastSubmittedAt: new Date().toISOString() }
          : {}),
      });

      if (initialSubtaskParent) {
        updateTask(initialSubtaskParent.id, { isParentTask: true }, { skipLog: true });
      } else if (isSubtaskMode && subtaskParentId) {
        updateTask(subtaskParentId, { isParentTask: true }, { skipLog: true });
      }
    }
    forceClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedEffort =
      typeof estimatedEffort === 'number'
        ? estimatedEffort
        : parseFloat(String(estimatedEffort).replace(',', '.')) || 0;

    const rawActualEffort =
      typeof actualEffort === 'number'
        ? actualEffort
        : parseFloat(String(actualEffort).replace(',', '.')) || 0;

    if (parsedEffort > 24) {
      alert('Số giờ ước tính (Est) không được vượt quá 24h!');
      return;
    }

    const isAdminOrPM = isUserAdminOrPM(currentUser);

    if (isAdminOrPM && rawActualEffort > 24) {
      alert('Số giờ thực tế (Effort) không được vượt quá 24h!');
      return;
    }

    if (isAdminOrPM && rawActualEffort > 0 && completionPercentage === 0) {
      confirmDialog({
        title: 'Nhắc nhở cập nhật % tiến độ',
        message: `Bạn đang nhập ${rawActualEffort}h làm việc nhưng phần trăm tiến độ vẫn để 0%.\n\n• Theo quy định, nếu tiến độ 0% (coi như chưa làm) thì số giờ làm việc thực tế sẽ tự động chuyển về 0h và trạng thái là "To do" (không thể đánh Done).\n• Bạn có muốn quay lại điều chỉnh % tiến độ không? Hoặc bấm "Vẫn lưu 0%" để lưu task chưa làm (số giờ sẽ tự động về 0h).`,
        confirmText: 'Vẫn lưu 0% (Giờ = 0h)',
        cancelText: 'Cập nhật lại tiến độ',
        type: 'warning',
        onConfirm: () => {
          executeSave(0, 0, 'To do');
        },
      });
      return;
    }

    let parsedActualEffort = rawActualEffort;
    if (isAdminOrPM && completionPercentage === 100 && parsedActualEffort === 0) {
      parsedActualEffort = parsedEffort;
    }

    const finalActualEffort = isAdminOrPM
      ? completionPercentage === 0
        ? 0
        : parsedActualEffort
      : task
      ? task.actualEffort || 0
      : 0;

    const finalCompletionPercentage = isAdminOrPM
      ? completionPercentage
      : task
      ? task.completionPercentage !== undefined
        ? task.completionPercentage
        : task.status === 'Done'
        ? 100
        : 0
      : 0;

    const finalStatus = isAdminOrPM
      ? finalCompletionPercentage === 0
        ? 'To do'
        : finalCompletionPercentage === 100
        ? 'Done'
        : status
      : status;

    executeSave(finalActualEffort, finalCompletionPercentage, finalStatus);
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
        forceClose();
      },
    });
  };

  if (!isRendered) return null;

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[120] flex items-center justify-center p-3 sm:p-4 modal-backdrop-transition overflow-y-auto ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full shadow-2xl text-slate-800 dark:text-slate-100 relative h-[90vh] sm:h-[92vh] max-h-[92vh] flex flex-col overflow-hidden modal-dialog-transition ${
          showAIChat ? 'max-w-7xl' : 'w-full max-w-5xl xl:max-w-6xl'
        } ${isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'}`}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shadow-xs shrink-0">
              {task ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                  {task
                    ? 'Chỉnh Sửa & Phân Công Task'
                    : milestoneId
                    ? 'Break Task Mới từ Milestone'
                    : 'Tạo Task Tự Do Mới'}
                </h3>
                {task?.code && previewCode === task.code ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(task.code!);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-xs font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition cursor-pointer active:scale-95"
                    title="Bấm để sao chép mã task"
                  >
                    <span>{task.code}</span>
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 opacity-60" />}
                  </button>
                ) : (
                  previewCode && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                      title={task ? 'Mã task mới dự kiến khi lưu thay đổi' : 'Mã định danh dự kiến khi khởi tạo'}
                    >
                      {task ? `Mã mới: ${previewCode}` : `Mã: ${previewCode}`}
                    </span>
                  )
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Thiết lập đầu việc, số giờ ước tính, phân công và ghi chú luồng task</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canUseAI && (
              <button
                type="button"
                onClick={() => {
                  setShowAIChat((prev) => !prev);
                  if (activeMobileTab === 'form') setActiveMobileTab('ai');
                  else setActiveMobileTab('form');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${
                  showAIChat || activeMobileTab === 'ai'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                    : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200/80 dark:border-indigo-800'
                }`}
                title={showAIChat ? 'Thu gọn AI Co-pilot Chat' : 'Mở AI Co-pilot trợ lý phân tích task'}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI Co-pilot</span>
                {(showAIChat || activeMobileTab === 'ai') && <span className="text-[10px] bg-white/20 px-1 rounded">Bật</span>}
              </button>
            )}

            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition active:scale-95 cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Switcher (Visible only when AI features are available on small screens) */}
        {canUseAI && (
          <div className="md:hidden flex items-center border-b border-slate-200 dark:border-slate-800 px-4 py-2 bg-slate-50 dark:bg-slate-900 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveMobileTab('form')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition ${
                activeMobileTab === 'form'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              📝 Thông Tin Task
            </button>
            <button
              type="button"
              onClick={() => setActiveMobileTab('ai')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                activeMobileTab === 'ai'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>✨ AI Co-pilot Chat</span>
            </button>
          </div>
        )}

        {/* Body Container */}
        <div className="flex-1 overflow-hidden min-h-0 flex flex-col md:flex-row">
          {/* Optional Left Panel: Multi-turn AI Co-pilot Chatbox (Expandable/Collapsible) */}
          {canUseAI && (
            <div
              className={`w-full md:w-80 lg:w-96 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 ${
                activeMobileTab === 'ai' ? 'flex' : showAIChat ? 'hidden md:flex' : 'hidden'
              }`}
            >
              <AITaskChatBox
                currentTitle={title}
                currentDescription={description}
                currentRole={role}
                milestoneTitle={milestones.find((m) => m.id === milestoneId)?.title}
                onApplySingleTask={handleApplySingleTaskFromAI}
                onApplyFullBreakdown={handleApplyFullBreakdownFromAI}
                onAppendChecklist={handleAppendChecklistFromAI}
                onBatchCreateTasks={handleBatchCreateTasksFromAI}
                canBatchCreate={
                  currentUser?.role === 'Admin' ||
                  currentUser?.role === 'Leader' ||
                  currentUser?.role === 'Advisor'
                }
              />
            </div>
          )}

          {/* Main Form Container */}
          <div
            className={`flex flex-col flex-1 h-full min-h-0 min-w-0 overflow-hidden ${
              canUseAI && activeMobileTab === 'ai' ? 'hidden md:flex' : 'flex'
            }`}
          >
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-4 min-h-0 min-w-0">
                {/* Member Task Assignment Request Banner (Full width on top) */}
                {task?.assignmentRequestedBy && task.assignmentRequestStatus === 'PENDING' && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs animate-in fade-in duration-150">
                    <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-sm shrink-0 mt-0.5">
                      ✋
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-amber-900 dark:text-amber-100 flex items-center gap-1.5 flex-wrap">
                        <span>Yêu cầu nhận task từ thành viên:</span>
                        <span className="bg-amber-200/90 dark:bg-amber-900 text-amber-950 dark:text-amber-100 px-1.5 py-0.5 rounded-md font-mono font-black">
                          @{task.assignmentRequestedBy}
                        </span>
                        {task.requestedWeekNumber && (
                          <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                            (Tuần {task.requestedWeekNumber})
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                        Hệ thống đã tự động chọn <b>@{task.assignmentRequestedBy}</b> ở mục <b>Người phụ trách chính</b> bên phải. Bạn có thể kiểm tra mô tả, thời lượng rồi bấm <b>"Duyệt & Phân Công Task"</b> để hoàn tất.
                      </p>
                    </div>
                  </div>
                )}

                {/* Jira-style 2-Column Responsive Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
                  {/* LEFT COLUMN: Main Content Flow (Task Title, Description & Checklist, Subtasks, Notes) */}
                  <div className="lg:col-span-7 xl:col-span-7 space-y-4 min-w-0">
                    {/* Task Title */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-1.5 min-w-0">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Tên Đầu Việc (Task Name): <span className="text-red-500">*</span>
                      </label>
                      <TaskTitleInput
                        role={role}
                        value={title}
                        onChange={setTitle}
                        required
                      />
                    </div>

                    {/* Chi Tiết Task (Mô tả & Checklist việc con) */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-2 min-w-0">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Chi Tiết Task (Mô tả & Checklist việc con):</span>
                      </label>
                      <DescriptionEditor
                        value={description}
                        onChange={setDescription}
                        placeholder="Mô tả chi tiết nội dung đầu việc, hướng dẫn thực hiện, hoặc checklist việc con cho thành viên... (Gõ - [ ] Tên việc con, hoặc Paste / Kéo thả ảnh trực tiếp)"
                        minRows={4}
                        onPreviewImage={(url) => setLightboxUrl(url)}
                      />
                    </div>

                    {/* Subtask Parent Linking Selector (Option 1: When task does not have subtasks) */}
                    {!hasSubtasks && (
                      <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-2 text-xs min-w-0">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                            <span className="text-indigo-600 dark:text-indigo-400 font-mono text-sm font-bold">↳</span>
                            <span>Thuộc Task lớn nào (Task cha trực thuộc)?</span>
                            {role && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 px-1.5 py-0.5 rounded-md font-semibold border border-indigo-200/60 dark:border-indigo-800">
                                Chỉ gợi ý team {role}
                              </span>
                            )}
                          </label>
                          <div className="flex items-center gap-2">
                            {isSubtaskMode && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSubtaskMode(false);
                                  setSubtaskParentId('');
                                  setSubtaskParentTitle('');
                                  setSubtaskReviewerAccount('');
                                }}
                                className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium underline cursor-pointer"
                              >
                                Tách ra độc lập
                              </button>
                            )}
                            {task && !isSubtaskMode && (
                              <button
                                type="button"
                                onClick={() => setIsLinkExistingModalOpen(true)}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-semibold flex items-center gap-1 cursor-pointer bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                title="Gộp các task lẻ khác vào làm Subtask của task này"
                              >
                                <Link2 className="w-3 h-3" />
                                Gộp task khác vào đây
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="relative">
                          <Dropdown
                            value={isSubtaskMode ? subtaskParentId : ''}
                            onChange={(val) => {
                              if (!val) {
                                setIsSubtaskMode(false);
                                setSubtaskParentId('');
                                setSubtaskParentTitle('');
                                setSubtaskReviewerAccount('');
                              } else {
                                const p = potentialParentTasks.find((item: Task) => item.id === val);
                                if (p) {
                                  setIsSubtaskMode(true);
                                  setSubtaskParentId(p.id);
                                  setSubtaskParentTitle(p.title);
                                  setSubtaskReviewerAccount(p.assigneeAccount || p.subtaskReviewerAccount || '');
                                }
                              }
                            }}
                            options={parentDropdownOptions}
                            searchable={true}
                            placeholder="Chọn hoặc gõ tìm kiếm task cha..."
                            className="w-full"
                            buttonClassName="w-full py-2 px-3 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium rounded-xl text-slate-800 dark:text-slate-200 shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                          />
                        </div>

                        {isSubtaskMode && (
                          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 pt-0.5 bg-indigo-50/60 dark:bg-indigo-950/40 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                            <span>✓ Sẽ hiển thị lùi đầu dòng dưới:</span>
                            <strong className="truncate max-w-xs">{subtaskParentTitle}</strong>
                            {subtaskReviewerAccount && <span>(Reviewer: @{subtaskReviewerAccount})</span>}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Parent Task Subtasks Management Panel (Option 2: When task is parent / has subtasks) */}
                    {hasSubtasks && (
                      <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-3 shadow-2xs min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shadow-2xs">
                              🌳
                            </span>
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-100 text-xs block">
                                Subtasks trực thuộc ({existingSubtasks.length} đầu việc con)
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                Task cha tổng hợp tiến độ và thời lượng từ các subtask
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setIsManualOverride(!isManualOverride)}
                              className={`text-[11px] px-2.5 py-1 rounded-xl border font-semibold transition cursor-pointer flex items-center gap-1 ${
                                isManualOverride
                                  ? 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 shadow-2xs'
                                  : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 shadow-2xs'
                              }`}
                              title={
                                isManualOverride
                                  ? 'Đang bật ghi đè thủ công. Bấm để bật tính toán tự động'
                                  : 'Đang tự động tính từ Subtask. Bấm để cho phép ghi đè thủ công'
                              }
                            >
                              {isManualOverride ? '✏️ Ghi đè thủ công' : '⚡ Tự động tính từ Subtask'}
                            </button>
                            {task && (
                              <button
                                type="button"
                                onClick={() => setIsLinkExistingModalOpen(true)}
                                className="text-[11px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                                title="Chọn thêm các task có sẵn để gộp vào task này"
                              >
                                <Link2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                Gộp task có sẵn
                              </button>
                            )}
                            {onOpenCreateSubtask && task && (
                              <button
                                type="button"
                                onClick={() => {
                                  forceClose();
                                  onOpenCreateSubtask(task);
                                }}
                                className="text-[11px] px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                              >
                                <Plus className="w-3 h-3" />
                                Thêm Subtask
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Summary metrics badge */}
                        {parentMetrics && !isManualOverride && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                            <div>
                              <span className="text-slate-400 dark:text-slate-400 block text-[10px]">Tổng Est:</span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono text-xs">{parentMetrics.totalEstimatedEffort}h</span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-slate-400 block text-[10px]">Tổng Actual:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">{parentMetrics.totalActualEffort}h</span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-slate-400 block text-[10px]">Tiến độ tổng:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{parentMetrics.completionPercentage}%</span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-slate-400 block text-[10px]">Trạng thái:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{parentMetrics.status}</span>
                            </div>
                          </div>
                        )}

                        {/* Subtask list */}
                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                          {existingSubtasks.map((st) => (
                            <div
                              key={st.id}
                              onClick={() => {
                                if (onSelectTaskToEdit) {
                                  forceClose();
                                  onSelectTaskToEdit(st);
                                }
                              }}
                              className="p-2.5 bg-white dark:bg-slate-850 border border-slate-200/90 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2 text-xs hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-slate-800 transition cursor-pointer group shadow-2xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-indigo-400 font-mono text-xs font-bold">↳</span>
                                {st.code && (
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                                    {st.code}
                                  </span>
                                )}
                                <span className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                                  {st.title}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-semibold shrink-0">
                                  {st.role}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-[11px]">
                                <span className="font-mono text-slate-500 dark:text-slate-400">{st.estimatedEffort}h</span>
                                <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                                  st.status === 'Done' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                  {st.completionPercentage}%
                                </span>
                                <span className="font-medium text-slate-600 dark:text-slate-300">@{st.assigneeAccount || 'Trống'}</span>
                                <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-indigo-600" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dedicated Note & Discussion Field */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-2 min-w-0">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Ghi Chú & Trao Đổi Luồng Task:</span>
                        </label>
                        <span className="text-[10px] text-slate-400">Các thành viên cùng theo dõi & phản hồi</span>
                      </div>
                      <textarea
                        rows={3}
                        placeholder="Nhập ghi chú yêu cầu, trao đổi luồng công việc hoặc cập nhật giữa các thành viên..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition resize-none leading-relaxed"
                      />
                    </div>

                    {/* SECTION: Lịch Sử & Nhật Ký Cập Nhật (Activity Log) - Hiển thị khi đang chỉnh sửa task */}
                    {task && (
                      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                            <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span>Nhật Ký Cập Nhật (Activity Log):</span>
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
                          <div className="bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 max-h-60 overflow-y-auto custom-scrollbar space-y-2.5">
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
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-lg p-2.5 text-xs space-y-1.5 shadow-2xs hover:border-indigo-200 dark:hover:border-indigo-800/80 transition"
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
                    )}
                  </div>

                  {/* RIGHT COLUMN: Sidebar (Creator banner, Metadata Card: Milestone, Assignee, Collab, Role, Est, Week, Priority, Status, Dates, Admin Progress) */}
                  <div className="lg:col-span-5 xl:col-span-5 space-y-3 min-w-0 lg:sticky lg:top-0">
                    {/* Creator & Creation Date Info Banner */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-400 dark:text-slate-400">{task ? 'Người tạo:' : 'Khởi tạo bởi:'}</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{creatorDisplay}</span>
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px] flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {createdDateDisplay}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {weekNumber ? (
                            <span className="font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-xl border border-indigo-200/80 dark:border-indigo-800/80 text-xs">
                              Tuần {weekNumber <= 53 ? weekNumber + 55 : weekNumber} / {task?.year || selectedYear || 2026}
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
                    <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
                      {/* Milestone Card (Full-width row on top) */}
                      <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                        <label className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">
                          Cột mốc Milestone:
                        </label>
                        {isMember && !task && !initialMilestoneId ? (
                          <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs">
                            <span className="truncate">📌 Không gán Milestone (Task tự do)</span>
                            <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800 px-1.5 py-0.5 rounded-md font-medium shrink-0">
                              Tự Do
                            </span>
                          </div>
                        ) : (
                          <Dropdown
                            value={milestoneId}
                            onChange={setMilestoneId}
                            options={[
                              { value: '', label: '📌 Không gán Milestone (Task tự do / Phát sinh ngoài)' },
                              ...milestones.map((m) => ({
                                value: m.id,
                                label: `🚩 ${m.title}${m.role && m.role !== 'ALL' ? ` [${m.role}]` : ''}`,
                              })),
                            ]}
                            className="w-full"
                            buttonClassName="py-1.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 font-medium rounded-xl"
                          />
                        )}
                      </div>

                      {/* Assignee Card (Full-width row) */}
                      <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-400 dark:text-slate-400 text-[11px] font-medium">
                            Người phụ trách chính:
                          </label>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                            {eligibleAssignees.length} phù hợp
                          </span>
                        </div>
                        <Dropdown
                          value={assigneeAccount}
                          onChange={handleAssigneeChange}
                          options={[
                            { value: '', label: '-- Để trống (Chưa phân công) --' },
                            ...eligibleAssignees.map((u) => {
                              const isRequester =
                                task?.assignmentRequestedBy &&
                                task?.assignmentRequestStatus === 'PENDING' &&
                                u.account.toLowerCase() === task.assignmentRequestedBy.toLowerCase();
                              const uRoleInTask = getUserRoleInSpec(u, role);
                              return {
                                value: u.account,
                                label: `${u.account} - ${u.name}${isRequester ? ' ✋ (Đang xin nhận task)' : ''}`,
                                subLabel: `${uRoleInTask} • [${u.specializations.join(', ')}]`,
                              };
                            }),
                          ]}
                          className="w-full"
                          buttonClassName="py-1.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 font-medium rounded-xl"
                        />
                        {eligibleAssignees.length === 0 && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1.5 p-2 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Chưa có thành viên chuyên môn {role}.
                          </p>
                        )}
                      </div>

                      {/* Collab Card (Full-width row, placed right next to Assignee) */}
                      <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-slate-400 dark:text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Thành viên Collab ({supporterAccounts.length}):</span>
                          </label>
                          <span className="text-[10px] font-medium text-slate-400">
                            Hợp tác cùng làm
                          </span>
                        </div>

                        <Dropdown
                          value=""
                          onChange={(selectedAcc) => {
                            if (selectedAcc) handleToggleSupporter(selectedAcc);
                          }}
                          options={[
                            { value: '', label: '+ Thêm thành viên Collab...' },
                            ...eligibleSupporters
                              .filter((u) => !supporterAccounts.some((s) => s.toLowerCase() === u.account.toLowerCase()))
                              .map((u) => ({
                                value: u.account,
                                label: `${u.account} - ${u.name}`,
                                subLabel: `[${(u.specializations || []).join(', ')}]`,
                              })),
                          ]}
                          className="w-full"
                          buttonClassName="py-1.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 rounded-xl"
                        />

                        {supporterAccounts.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {supporterAccounts.map((supAcc) => {
                              const supUser = users.find((u) => u.account.toLowerCase() === supAcc.toLowerCase());
                              return (
                                <div
                                  key={supAcc}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 dark:bg-slate-800/80 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl text-xs"
                                >
                                  <UserAvatar
                                    user={supUser}
                                    account={supAcc}
                                    name={supUser?.name}
                                    size="xs"
                                    shape="circle"
                                  />
                                  <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                                    {supUser?.name || supAcc}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    Collab
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSupporter(supAcc)}
                                    className="p-0.5 text-slate-400 hover:text-rose-600 rounded-full transition cursor-pointer"
                                    title={`Bỏ Collab @${supAcc}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Role & Estimated Effort (2-col grid) */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                          <label className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">
                            Role Phụ Trách:
                          </label>
                          {allowedRoles.length === 1 ? (
                            <div
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-between gap-1 shadow-2xs h-[36px]"
                              title={`${role}${roles.find((ro) => ro.code === role)?.name && roles.find((ro) => ro.code === role)?.name.trim().toLowerCase() !== role.trim().toLowerCase() ? ` - ${roles.find((ro) => ro.code === role)?.name}` : ''} (Cố định theo chuyên môn)`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                                <span className="font-bold text-indigo-700 dark:text-indigo-300 truncate">{role}</span>
                              </div>
                              <span className="text-[9.5px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-1 py-0.2 rounded font-medium shrink-0">
                                Cố định
                              </span>
                            </div>
                          ) : (
                            <Dropdown
                              value={role}
                              onChange={(newRole) => {
                                const nextRole = newRole as Specialization;
                                setTitle((prevTitle) => ensureTaskTitlePrefix(prevTitle, nextRole, roles));
                                setRole(nextRole);
                                setAssigneeAccount('');
                              }}
                              options={allowedRoles.map((r) => {
                                const matched = roles.find((ro) => ro.code === r);
                                const displayLabel =
                                  matched?.name && matched.name.trim().toLowerCase() !== r.trim().toLowerCase()
                                    ? `${r} - ${matched.name}`
                                    : r;
                                return {
                                  value: r,
                                  label: displayLabel,
                                };
                              })}
                              className="w-full"
                              buttonClassName="py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 rounded-xl font-medium h-[36px]"
                            />
                          )}
                        </div>

                        <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-slate-400 dark:text-slate-400 block text-[11px] font-medium">
                              Ước Tính Giờ:
                            </label>
                            {canUseAI && (
                              <button
                                type="button"
                                onClick={handleSuggestEffort}
                                disabled={isAILoadingEffort}
                                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-50 active:scale-95 transition"
                                title="AI Gemini gợi ý giờ"
                              >
                                {isAILoadingEffort ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                ) : (
                                  <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                                )}
                                <span>Gợi ý</span>
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              min="0.1"
                              max="24"
                              value={estimatedEffort}
                              onChange={(e) => {
                                setEstimatedEffort(e.target.value);
                                setAiEffortReasoning(null);
                              }}
                              placeholder="2.0"
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-100 text-xs focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-indigo-500 font-mono font-bold h-[36px]"
                              required
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 font-semibold pointer-events-none">h</span>
                          </div>
                        </div>
                      </div>
                      {canUseAI && aiEffortReasoning && (
                        <div className="p-2 bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/90 dark:border-indigo-800/80 rounded-xl text-[10.5px] text-indigo-900 dark:text-indigo-200 flex items-start gap-1.5 animate-in fade-in shadow-2xs">
                          <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                          <div className="leading-snug">
                            <span className="font-bold">Lý do ({estimatedEffort}h):</span> {aiEffortReasoning}
                          </div>
                        </div>
                      )}
                      {canUseAI && aiEffortError && (
                        <div className="text-[10.5px] text-red-600 dark:text-red-400">
                          {aiEffortError}
                        </div>
                      )}

                      {/* Week & Priority (2-col grid) */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                          <label className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">
                            Kế hoạch (Tuần):
                          </label>
                          <Dropdown
                            value={weekNumber !== undefined ? String(weekNumber) : 'backlog'}
                            onChange={(val) => {
                              if (val === 'backlog') {
                                setWeekNumber(undefined);
                              } else {
                                setWeekNumber(Number(val));
                              }
                            }}
                            options={[
                              { value: 'backlog', label: '📦 Kho Backlog' },
                              ...generateWeekOptions(selectedWeek),
                            ]}
                            className="w-full"
                            buttonClassName="py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 font-medium rounded-xl h-[36px]"
                          />
                        </div>

                        <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                          <label className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">
                            Mức Độ Ưu Tiên:
                          </label>
                          <Dropdown
                            value={priority}
                            onChange={(newPriority) => setPriority(newPriority as 'High' | 'Medium' | 'Low')}
                            options={[
                              { value: 'High', label: '🔴 Cao' },
                              { value: 'Medium', label: '🟡 Trung bình' },
                              { value: 'Low', label: '🟢 Thấp' },
                            ]}
                            className="w-full"
                            buttonClassName="py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 font-medium rounded-xl h-[36px]"
                          />
                        </div>
                      </div>

                      {/* Status */}
                      <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                        <label className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">
                          Trạng Thái:
                        </label>
                        <Dropdown
                          value={status}
                          onChange={(newStatus) => handleStatusChange(newStatus as TaskStatus)}
                          options={[
                            { value: 'To do', label: 'To do (Cần làm)' },
                            { value: 'In Progress', label: 'In Progress (Đang làm)' },
                            { value: 'Done', label: 'Done (Đã hoàn thành)' },
                          ]}
                          className="w-full"
                          buttonClassName="py-1.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 font-medium rounded-xl"
                        />
                      </div>

                      {/* Start Date & End Date (2-col grid) */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                          <label className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>Bắt đầu:</span>
                          </label>
                          <DatePicker
                            value={startDate}
                            onChange={handleStartDateChange}
                            placeholder="Chọn ngày..."
                            maxDate={endDate || undefined}
                          />
                        </div>

                        <div className="bg-white dark:bg-slate-850 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 min-w-0">
                          <label className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>Hạn hoàn thành:</span>
                          </label>
                          <DatePicker
                            value={endDate}
                            onChange={handleEndDateChange}
                            placeholder="Hạn xong..."
                            minDate={startDate || undefined}
                          />
                        </div>
                      </div>

                      {/* Admin/PM-only Progress & Actual Effort Control Box */}
                      {isUserAdminOrPM(currentUser) && (
                        <div className="p-3 sm:p-3.5 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/90 dark:border-purple-800/80 rounded-xl space-y-2.5 shadow-2xs animate-in fade-in duration-150">
                          <div className="flex items-center justify-between flex-wrap gap-1.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-900/60 dark:text-purple-200 dark:border-purple-700">
                              👑 Admin / PM Override
                            </span>
                            <span className="text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                              Quản lý tiến độ
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                            {/* Actual Effort Input */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                  Giờ thực tế:
                                </label>
                                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 font-mono">
                                  {typeof actualEffort === 'number'
                                    ? actualEffort
                                    : parseFloat(String(actualEffort).replace(',', '.')) || 0}{' '}
                                  giờ
                                </span>
                              </div>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max="24"
                                value={actualEffort}
                                onChange={(e) => setActualEffort(e.target.value)}
                                placeholder="0.0"
                                className="w-full bg-white dark:bg-slate-900 border border-purple-300/80 dark:border-purple-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition"
                              />
                            </div>

                            {/* Completion Percentage Slider & Quick Buttons */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                  Tiến độ (%):
                                </label>
                                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 font-mono">
                                  {completionPercentage}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={completionPercentage}
                                onChange={(e) => handleProgressChange(Number(e.target.value))}
                                className="w-full accent-purple-600 cursor-pointer h-2 bg-purple-200 dark:bg-purple-900 rounded-lg"
                              />
                              <div className="flex justify-between text-[10px] text-purple-700 dark:text-purple-400 font-mono font-semibold mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleProgressChange(0)}
                                  className="hover:underline cursor-pointer"
                                >
                                  0%
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleProgressChange(25)}
                                  className="hover:underline cursor-pointer"
                                >
                                  25%
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleProgressChange(50)}
                                  className="hover:underline cursor-pointer"
                                >
                                  50%
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleProgressChange(75)}
                                  className="hover:underline cursor-pointer"
                                >
                                  75%
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleProgressChange(100)}
                                  className="hover:underline cursor-pointer"
                                >
                                  100%
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Warning if effort > 0 but completion percentage is 0 */}
                          {(typeof actualEffort === 'number'
                            ? actualEffort
                            : parseFloat(String(actualEffort).replace(',', '.')) || 0) > 0 &&
                            completionPercentage === 0 && (
                              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 rounded-xl flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-200">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="leading-tight text-[11px]">
                                  <span className="font-bold block text-amber-950 dark:text-amber-100">
                                    Tiến độ đang 0%:
                                  </span>
                                  Nếu giữ 0% khi lưu, hệ thống sẽ tự động đặt số giờ về 0h.
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="p-4 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between gap-3 rounded-b-2xl sm:rounded-b-3xl">
                {task && (userRoleInTaskSpec === 'Leader' || userRoleInTaskSpec === 'Advisor' || currentUser?.role === 'Admin') ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa Task</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition active:scale-95 shadow-2xs cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {task
                      ? task.assignmentRequestedBy && (!task.assigneeAccount || task.assignmentRequestStatus === 'PENDING')
                        ? 'Duyệt & Phân Công Task'
                        : 'Cập Nhật Task'
                      : 'Lưu & Phân Công'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Image Lightbox preview */}
      <ImageLightbox
        isOpen={!!lightboxUrl}
        imageUrl={lightboxUrl}
        onClose={() => setLightboxUrl(null)}
      />

      {/* Link Existing Tasks Modal */}
      {task && (
        <LinkExistingTasksModal
          parentTask={task}
          isOpen={isLinkExistingModalOpen}
          onClose={() => setIsLinkExistingModalOpen(false)}
        />
      )}
    </div>
  );
};
