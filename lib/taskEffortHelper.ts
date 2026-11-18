import { Task, WeeklyHistoryArchive, TaskActivityLog, TaskWeeklyHistoryEntry } from '../types/task';

export interface WeeklyEffortItem {
  weekKey: string;
  weekNumber: number;
  year: number;
  effort: number;
  percentage: number;
  status: string;
  isCurrentWeek: boolean;
  isLockedHistory: boolean;
  notes?: string;
  assigneeAccount?: string;
  archivedAt?: string;
  updatedByAdminAt?: string;
  updatedByAdminAccount?: string;
}

export interface TaskAccumulatedEffortResult {
  totalEffort: number;
  currentWeekEffort: number;
  weeklyBreakdown: WeeklyEffortItem[];
  chainTaskCount: number;
  hasMultiWeekHistory: boolean;
}

export const normalizeWeekNumberForYear = (weekNumber?: number, year: number = 2026): number => {
  if (!weekNumber || Number.isNaN(weekNumber)) return 0;
  if (weekNumber > 0 && weekNumber <= 53 && year === 2026) {
    return weekNumber + 55;
  }
  return weekNumber;
};

export const getWeeklyHistoryKey = (weekNumber: number, year: number = 2026): string => {
  const normWeek = normalizeWeekNumberForYear(weekNumber, year);
  return `${year}-W${normWeek}`;
};

export const findWeeklyHistoryEntry = (
  task?: Task | null,
  targetWeek?: number,
  targetYear: number = 2026
): TaskWeeklyHistoryEntry | undefined => {
  if (!task?.weeklyHistory || !targetWeek) return undefined;
  const normTargetWeek = normalizeWeekNumberForYear(targetWeek, targetYear);
  const directKey = getWeeklyHistoryKey(normTargetWeek, targetYear);
  if (task.weeklyHistory[directKey]) {
    return task.weeklyHistory[directKey];
  }
  const legacyKey = String(normTargetWeek);
  if (task.weeklyHistory[legacyKey]) {
    return task.weeklyHistory[legacyKey];
  }
  return Object.values(task.weeklyHistory).find(
    (entry) =>
      entry &&
      normalizeWeekNumberForYear(entry.weekNumber, entry.year || targetYear) === normTargetWeek &&
      (entry.year || targetYear) === targetYear
  );
};

export const buildWeeklyHistoryEntryFromTask = (
  task: Task,
  archivedAt: string = new Date().toISOString(),
  archivedBy?: string
): TaskWeeklyHistoryEntry | null => {
  if (!task.weekNumber) return null;
  const year = task.year || 2026;
  const weekNumber = normalizeWeekNumberForYear(task.weekNumber, year);
  const weekKey = getWeeklyHistoryKey(weekNumber, year);

  const entry: TaskWeeklyHistoryEntry = {
    weekKey,
    weekNumber,
    year,
    actualEffort: Number(task.actualEffort) || 0,
    estimatedEffort: Number(task.estimatedEffort) || 0,
    completionPercentage: Number(task.completionPercentage) || 0,
    status: task.status || 'To do',
    assigneeAccount: task.assigneeAccount || '',
    archivedAt,
  };

  if (task.supporterAccounts && task.supporterAccounts.length > 0) {
    entry.supporterAccounts = [...task.supporterAccounts];
  }
  if (task.memberEfforts && Object.keys(task.memberEfforts).length > 0) {
    entry.memberEfforts = { ...task.memberEfforts };
  }
  if (task.lastSubmittedAt) {
    entry.lastSubmittedAt = task.lastSubmittedAt;
  }
  if (task.isSubmittedLate !== undefined) {
    entry.isSubmittedLate = task.isSubmittedLate;
  }
  if (task.notes) {
    entry.notes = task.notes;
  }
  if (archivedBy) {
    entry.archivedBy = archivedBy;
  }

  return entry;
};

/**
 * Projects a single unique Task into the exact state it had during a target week.
 * - Active/current week -> returns the live task untouched.
 * - Past week -> returns a read-only projection hydrated from `task.weeklyHistory`.
 * - Not present in targetWeek -> returns null.
 */
export const getTaskForWeekView = (
  task: Task,
  targetWeek: number,
  targetYear: number = 2026
): Task | null => {
  if (!task) return null;
  const taskYear = task.year || targetYear;
  const normTargetWeek = normalizeWeekNumberForYear(targetWeek, targetYear);
  const normTaskWeek = task.weekNumber
    ? normalizeWeekNumberForYear(task.weekNumber, taskYear)
    : undefined;

  if (normTaskWeek === normTargetWeek && taskYear === targetYear) {
    return task;
  }

  const entry = findWeeklyHistoryEntry(task, normTargetWeek, targetYear);
  if (!entry) return null;

  return {
    ...task,
    weekNumber: entry.weekNumber,
    year: entry.year || targetYear,
    actualEffort: Number(entry.actualEffort) || 0,
    estimatedEffort:
      entry.estimatedEffort !== undefined
        ? Number(entry.estimatedEffort)
        : Number(task.estimatedEffort) || 0,
    completionPercentage: Number(entry.completionPercentage) || 0,
    status: entry.status || task.status,
    assigneeAccount: entry.assigneeAccount || task.assigneeAccount,
    supporterAccounts:
      entry.supporterAccounts !== undefined
        ? entry.supporterAccounts
        : task.supporterAccounts,
    memberEfforts: entry.memberEfforts,
    lastSubmittedAt: entry.lastSubmittedAt,
    isSubmittedLate: entry.isSubmittedLate,
  };
};

export interface ConsolidateClonesResult {
  consolidatedTasks: Task[];
  removedCloneIds: string[];
  updatedParentTasks: Task[];
  remappedSubtasks: Task[];
}

/**
 * One-time / self-healing consolidation of legacy multi-week cloned Tasks
 * into a single canonical Task per logical lifecycle with an immutable `weeklyHistory` map.
 */
export const consolidateMultiWeekTaskClones = (
  tasks: Task[],
  archives: WeeklyHistoryArchive[] = []
): ConsolidateClonesResult => {
  if (!tasks || tasks.length === 0) {
    return {
      consolidatedTasks: tasks || [],
      removedCloneIds: [],
      updatedParentTasks: [],
      remappedSubtasks: [],
    };
  }

  // Union-Find over live tasks to group clone chains reliably
  const parentPtr = new Map<string, string>();
  const taskById = new Map<string, Task>();
  tasks.forEach((t) => {
    parentPtr.set(t.id, t.id);
    taskById.set(t.id, t);
  });

  const findSet = (id: string): string => {
    let curr = id;
    while (parentPtr.get(curr) && parentPtr.get(curr) !== curr) {
      curr = parentPtr.get(curr)!;
    }
    // Path compression
    let node = id;
    while (node !== curr) {
      const next = parentPtr.get(node)!;
      parentPtr.set(node, curr);
      node = next;
    }
    return curr;
  };

  const unionSet = (a: string, b: string) => {
    const ra = findSet(a);
    const rb = findSet(b);
    if (ra !== rb) {
      parentPtr.set(rb, ra);
    }
  };

  // 1a. Union via parentTaskId chain
  tasks.forEach((t) => {
    if (t.parentTaskId && taskById.has(t.parentTaskId)) {
      unionSet(t.id, t.parentTaskId);
    }
  });

  // Also union siblings sharing the exact same parentTaskId even if root was archived/deleted
  const byParentTaskId = new Map<string, Task[]>();
  tasks.forEach((t) => {
    if (t.parentTaskId) {
      const list = byParentTaskId.get(t.parentTaskId) || [];
      list.push(t);
      byParentTaskId.set(t.parentTaskId, list);
    }
  });
  byParentTaskId.forEach((group) => {
    for (let i = 1; i < group.length; i++) {
      unionSet(group[0].id, group[i].id);
    }
  });

  // 1b. Union standalone tasks (or clones with missing parentTaskId) sharing identical valid code + title/milestone
  const byCode = new Map<string, Task[]>();
  tasks.forEach((t) => {
    const cleanCode = (t.code || '').trim().toUpperCase();
    if (!cleanCode) return;
    const list = byCode.get(cleanCode) || [];
    list.push(t);
    byCode.set(cleanCode, list);
  });
  byCode.forEach((list) => {
    if (list.length <= 1) return;
    const nonSubtasks = list.filter((t) => !t.subtaskParentId && !t.isSubtask);
    if (nonSubtasks.length <= 1) return;
    for (let i = 0; i < nonSubtasks.length; i++) {
      for (let j = i + 1; j < nonSubtasks.length; j++) {
        const a = nonSubtasks[i];
        const b = nonSubtasks[j];
        const sameTitle =
          (a.title || '').trim().toLowerCase() === (b.title || '').trim().toLowerCase();
        const linkedByChain =
          Boolean(a.parentTaskId && (a.parentTaskId === b.id || a.parentTaskId === b.parentTaskId)) ||
          Boolean(b.parentTaskId && b.parentTaskId === a.id);
        if (sameTitle || linkedByChain) {
          unionSet(a.id, b.id);
        }
      }
    }
  });

  // 2. Materialize groups
  const groupsMap = new Map<string, Task[]>();
  tasks.forEach((t) => {
    const root = findSet(t.id);
    const list = groupsMap.get(root) || [];
    list.push(t);
    groupsMap.set(root, list);
  });

  // Count subtask references per task ID so we keep the ID referenced by children
  const subtaskRefCount = new Map<string, number>();
  tasks.forEach((t) => {
    if (t.subtaskParentId) {
      subtaskRefCount.set(t.subtaskParentId, (subtaskRefCount.get(t.subtaskParentId) || 0) + 1);
    }
  });

  // Index archive snapshots for recovering finalized weeks of a group
  const archiveSnapshotsByRootOrCode = new Map<string, Array<{ task: Task; archivedAt: string }>>();
  (archives || []).forEach((arch) => {
    const archivedAt = arch.archivedAt || new Date().toISOString();
    (arch.tasksSnapshot || []).forEach((st) => {
      const keys = new Set<string>();
      keys.add(`id:${st.id}`);
      if (st.parentTaskId) keys.add(`root:${st.parentTaskId}`);
      if (st.code) keys.add(`code:${st.code.trim().toUpperCase()}`);
      keys.forEach((k) => {
        const arr = archiveSnapshotsByRootOrCode.get(k) || [];
        arr.push({ task: st, archivedAt });
        archiveSnapshotsByRootOrCode.set(k, arr);
      });
    });
  });

  const finalizedWeeksSet = new Set<string>();
  (archives || []).forEach((arch) => {
    const y = arch.year || 2026;
    finalizedWeeksSet.add(getWeeklyHistoryKey(arch.weekNumber, y));
  });

  const removedCloneIds: string[] = [];
  const updatedParentTasks: Task[] = [];
  const subtaskRemap = new Map<string, string>(); // oldParentId -> canonicalId
  const replacementsById = new Map<string, Task>(); // original id -> canonical Task (only on kept id)
  const removedIdSet = new Set<string>();

  groupsMap.forEach((group) => {
    const hasCloneParentRef = group.some((t) => Boolean(t.parentTaskId));
    const groupIds = new Set(group.map((t) => t.id));

    // Find matching archive entries for this group
    const matchedArchives: Array<{ task: Task; archivedAt: string }> = [];
    const seenSnapKeys = new Set<string>();
    group.forEach((m) => {
      const lookupKeys = [`id:${m.id}`, `root:${m.id}`];
      if (m.parentTaskId) lookupKeys.push(`root:${m.parentTaskId}`, `id:${m.parentTaskId}`);
      if (m.code && !m.subtaskParentId && !m.isSubtask) {
        lookupKeys.push(`code:${m.code.trim().toUpperCase()}`);
      }
      lookupKeys.forEach((lk) => {
        (archiveSnapshotsByRootOrCode.get(lk) || []).forEach((item) => {
          const uniq = `${item.task.id}_${item.task.weekNumber || 0}`;
          if (!seenSnapKeys.has(uniq)) {
            seenSnapKeys.add(uniq);
            matchedArchives.push(item);
          }
        });
      });
    });

    const hasMissingWeeklyHistory =
      group.length === 1 &&
      matchedArchives.some((a) => {
        const y = a.task.year || 2026;
        const wk = a.task.weekNumber;
        if (!wk) return false;
        const k = getWeeklyHistoryKey(wk, y);
        const alreadyInMap = Boolean(group[0].weeklyHistory?.[k]);
        const hadWork =
          (Number(a.task.actualEffort) || 0) > 0 ||
          (Number(a.task.completionPercentage) || 0) > 0 ||
          a.task.status === 'Done';
        return !alreadyInMap && hadWork && a.task.weekNumber !== group[0].weekNumber;
      });

    if (group.length <= 1 && !hasCloneParentRef && !hasMissingWeeklyHistory) {
      return;
    }

    // Sort instances ascending by time/week
    const sortedAsc = [...group].sort((a, b) => {
      const ya = a.year || 2026;
      const yb = b.year || 2026;
      if (ya !== yb) return ya - yb;
      const wa = normalizeWeekNumberForYear(a.weekNumber, ya);
      const wb = normalizeWeekNumberForYear(b.weekNumber, yb);
      if (wa !== wb) return wa - wb;
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return ta - tb;
    });

    const highestWeekTask = sortedAsc[sortedAsc.length - 1];
    const earliestTask = sortedAsc[0];

    // Pick canonical ID: prefer whichever ID has subtasks pointing to it, then root task (!parentTaskId), then earliestTask
    const canonicalOwner = [...sortedAsc].sort((a, b) => {
      const refA = subtaskRefCount.get(a.id) || 0;
      const refB = subtaskRefCount.get(b.id) || 0;
      if (refA !== refB) return refB - refA;
      const rootA = a.parentTaskId ? 1 : 0;
      const rootB = b.parentTaskId ? 1 : 0;
      if (rootA !== rootB) return rootA - rootB;
      return 0;
    })[0];

    const canonicalId = canonicalOwner.id;
    const anyHadSubtasks = group.some((m) => (subtaskRefCount.get(m.id) || 0) > 0);

    // Map any non-canonical clone IDs in this group -> canonicalId for subtaskParentId remapping
    groupIds.forEach((gid) => {
      if (gid !== canonicalId && (subtaskRefCount.get(gid) || 0) > 0) {
        subtaskRemap.set(gid, canonicalId);
      }
    });

    // Build merged weeklyHistory: existing weeklyHistory entries win & are never overwritten
    const mergedWeeklyHistory: Record<string, TaskWeeklyHistoryEntry> = {};
    sortedAsc.forEach((m) => {
      if (m.weeklyHistory) {
        Object.entries(m.weeklyHistory).forEach(([k, entry]) => {
          if (entry && !mergedWeeklyHistory[k]) {
            mergedWeeklyHistory[k] = { ...entry };
          }
        });
      }
    });

    const highestYear = highestWeekTask.year || 2026;
    const highestWeek = highestWeekTask.weekNumber
      ? normalizeWeekNumberForYear(highestWeekTask.weekNumber, highestYear)
      : 0;

    // Seed frozen entries from finalized archives matched to this group
    matchedArchives.forEach(({ task: snap, archivedAt }) => {
      if (!snap.weekNumber) return;
      const y = snap.year || 2026;
      const w = normalizeWeekNumberForYear(snap.weekNumber, y);
      const k = getWeeklyHistoryKey(w, y);
      if (mergedWeeklyHistory[k]) return;
      const hadWork =
        (Number(snap.actualEffort) || 0) > 0 ||
        (Number(snap.completionPercentage) || 0) > 0 ||
        snap.status === 'Done';
      if (!hadWork) return;
      if (w < highestWeek || y < highestYear || finalizedWeeksSet.has(k) || anyHadSubtasks) {
        const entry = buildWeeklyHistoryEntryFromTask(snap, archivedAt, 'system-consolidation');
        if (entry) {
          mergedWeeklyHistory[k] = entry;
        }
      }
    });

    // Seed frozen entries from older clones in the group (or highestWeekTask if it has subtasks + reported effort)
    sortedAsc.forEach((m) => {
      if (!m.weekNumber) return;
      const y = m.year || 2026;
      const w = normalizeWeekNumberForYear(m.weekNumber, y);
      const k = getWeeklyHistoryKey(w, y);
      if (mergedWeeklyHistory[k]) return;
      const hadWork =
        (Number(m.actualEffort) || 0) > 0 ||
        (Number(m.completionPercentage) || 0) > 0 ||
        m.status === 'Done';
      if (!hadWork) return;
      const isOlderWeek = w < highestWeek || y < highestYear;
      const isParentWeekWithDirectEffort =
        m.id === highestWeekTask.id && anyHadSubtasks && (Number(m.actualEffort) || 0) > 0;
      if (isOlderWeek || isParentWeekWithDirectEffort) {
        const entry = buildWeeklyHistoryEntryFromTask(
          m,
          m.updatedAt || new Date().toISOString(),
          'system-consolidation'
        );
        if (entry) {
          mergedWeeklyHistory[k] = entry;
        }
      }
    });

    // Merge deduplicated activity logs across the entire group & archives
    const mergedLogs = getTaskChainActivityLogs(highestWeekTask, group, archives);
    const earliestCreatedAt =
      sortedAsc
        .map((m) => m.createdAt)
        .filter((d): d is string => Boolean(d))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ||
      highestWeekTask.createdAt;
    const earliestCreatedBy =
      earliestTask.createdBy ||
      sortedAsc.find((m) => Boolean(m.createdBy))?.createdBy ||
      highestWeekTask.createdBy;
    const canonicalCode =
      earliestTask.code ||
      sortedAsc.find((m) => Boolean(m.code))?.code ||
      highestWeekTask.code;

    const consolidated: Task = {
      ...highestWeekTask,
      id: canonicalId,
      code: canonicalCode,
      createdBy: earliestCreatedBy,
      createdAt: earliestCreatedAt,
      parentTaskId: undefined,
      isParentTask: anyHadSubtasks || highestWeekTask.isParentTask || earliestTask.isParentTask,
      weeklyHistory: Object.keys(mergedWeeklyHistory).length > 0 ? mergedWeeklyHistory : undefined,
      activityLogs: mergedLogs.length > 0 ? mergedLogs : highestWeekTask.activityLogs,
    };

    replacementsById.set(canonicalId, consolidated);
    updatedParentTasks.push(consolidated);

    group.forEach((m) => {
      if (m.id !== canonicalId) {
        removedCloneIds.push(m.id);
        removedIdSet.add(m.id);
      }
    });
  });

  const remappedSubtasks: Task[] = [];
  const consolidatedTasks = tasks
    .filter((t) => !removedIdSet.has(t.id))
    .map((t) => {
      let result = replacementsById.get(t.id) || t;
      if (result.subtaskParentId && subtaskRemap.has(result.subtaskParentId)) {
        const nextParentId = subtaskRemap.get(result.subtaskParentId)!;
        const nextParent = replacementsById.get(nextParentId);
        result = {
          ...result,
          subtaskParentId: nextParentId,
          subtaskParentTitle: nextParent?.title || result.subtaskParentTitle,
        };
        remappedSubtasks.push(result);
      }
      return result;
    });

  return {
    consolidatedTasks,
    removedCloneIds,
    updatedParentTasks,
    remappedSubtasks,
  };
};

/**
 * Calculates total accumulated effort across all weeks for a single unique Task
 * by reading its locked `weeklyHistory` map plus its current active week (if not locked).
 */
export const calculateTaskAccumulatedEffort = (
  targetTask?: Task | null,
  _allTasks: Task[] = [],
  _archives: WeeklyHistoryArchive[] = []
): TaskAccumulatedEffortResult => {
  if (!targetTask) {
    return {
      totalEffort: 0,
      currentWeekEffort: 0,
      weeklyBreakdown: [],
      chainTaskCount: 0,
      hasMultiWeekHistory: false,
    };
  }

  const byWeekKey = new Map<string, WeeklyEffortItem>();
  const targetYear = targetTask.year || 2026;
  const targetNormWeek = targetTask.weekNumber
    ? normalizeWeekNumberForYear(targetTask.weekNumber, targetYear)
    : undefined;
  const currentWeekKey = targetNormWeek ? getWeeklyHistoryKey(targetNormWeek, targetYear) : '';

  // 1. Seed all locked entries from targetTask.weeklyHistory
  if (targetTask.weeklyHistory) {
    Object.entries(targetTask.weeklyHistory).forEach(([rawKey, entry]) => {
      if (!entry) return;
      const yr = entry.year || 2026;
      const wk = normalizeWeekNumberForYear(entry.weekNumber, yr);
      const canonicalKey = getWeeklyHistoryKey(wk, yr);
      byWeekKey.set(canonicalKey, {
        weekKey: entry.weekKey || rawKey || canonicalKey,
        weekNumber: wk,
        year: yr,
        effort: Number(entry.actualEffort) || 0,
        percentage: Number(entry.completionPercentage) || 0,
        status: entry.status || 'To do',
        isCurrentWeek: canonicalKey === currentWeekKey,
        isLockedHistory: true,
        notes: entry.notes,
        assigneeAccount: entry.assigneeAccount,
        archivedAt: entry.archivedAt,
        updatedByAdminAt: entry.updatedByAdminAt,
        updatedByAdminAccount: entry.updatedByAdminAccount,
      });
    });
  }

  // 2. Include current active week if not yet stored as a frozen entry in weeklyHistory
  if (targetNormWeek && currentWeekKey && !byWeekKey.has(currentWeekKey)) {
    byWeekKey.set(currentWeekKey, {
      weekKey: currentWeekKey,
      weekNumber: targetNormWeek,
      year: targetYear,
      effort: Number(targetTask.actualEffort) || 0,
      percentage: Number(targetTask.completionPercentage) || 0,
      status: targetTask.status || 'To do',
      isCurrentWeek: true,
      isLockedHistory: false,
      notes: targetTask.notes,
      assigneeAccount: targetTask.assigneeAccount,
    });
  }

  const weeklyBreakdown = Array.from(byWeekKey.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.weekNumber - b.weekNumber;
  });

  const totalEffort =
    Math.round(weeklyBreakdown.reduce((sum, item) => sum + (Number(item.effort) || 0), 0) * 100) /
    100;
  const currentWeekEffort = Number(targetTask.actualEffort) || 0;

  return {
    totalEffort,
    currentWeekEffort,
    weeklyBreakdown,
    chainTaskCount: weeklyBreakdown.length,
    hasMultiWeekHistory: weeklyBreakdown.length > 1,
  };
};

/**
 * Consolidates and deduplicates activity logs across the entire multi-week chain of a task
 * (including historical archive snapshots and active tasks).
 */
export const getTaskChainActivityLogs = (
  targetTask?: Task | null,
  allTasks: Task[] = [],
  archives: WeeklyHistoryArchive[] = []
): TaskActivityLog[] => {
  if (!targetTask) return [];

  // 1. Gather all tasks from weekly archives snapshots
  const allCandidatesMap = new Map<string, Task>();
  (archives || []).forEach((archive) => {
    (archive.tasksSnapshot || []).forEach((st) => {
      allCandidatesMap.set(st.id, st);
    });
  });

  // Overwrite with live tasks (live tasks have the latest real-time data)
  (allTasks || []).forEach((t) => {
    allCandidatesMap.set(t.id, t);
  });

  // Ensure targetTask itself is present
  allCandidatesMap.set(targetTask.id, targetTask);

  const rootId = targetTask.parentTaskId || targetTask.id;
  const normTitle = (targetTask.title || '').trim().toLowerCase();
  const normAssignee = (targetTask.assigneeAccount || '').trim().toLowerCase();
  const normRole = (targetTask.role || '').trim().toLowerCase();

  // 2. Filter tasks that belong to this task chain
  const chainTasks = Array.from(allCandidatesMap.values()).filter((t) => {
    if (t.id === targetTask.id) return true;
    if (rootId && (t.id === rootId || t.parentTaskId === rootId)) return true;
    if (targetTask.parentTaskId && t.id === targetTask.parentTaskId) return true;
    if (t.parentTaskId && targetTask.parentTaskId && t.parentTaskId === targetTask.parentTaskId) return true;

    // Fallback match by Title + Assignee + Role
    const tTitle = (t.title || '').trim().toLowerCase();
    const tAssignee = (t.assigneeAccount || '').trim().toLowerCase();
    const tRole = (t.role || '').trim().toLowerCase();

    if (tTitle === normTitle && tAssignee === normAssignee && tRole === normRole) {
      return true;
    }
    return false;
  });

  // 3. Consolidate activity logs with deduplication
  const seenLogIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const combinedLogs: TaskActivityLog[] = [];

  const addLog = (log: TaskActivityLog) => {
    if (!log) return;
    if (log.id && seenLogIds.has(log.id)) return;

    // Signature to deduplicate identical logs that might have different generated IDs
    const signature = `${log.timestamp}_${log.actionType}_${log.summary}_${log.authorAccount || ''}`;
    if (seenSignatures.has(signature)) return;

    if (log.id) seenLogIds.add(log.id);
    seenSignatures.add(signature);
    combinedLogs.push(log);
  };

  chainTasks.forEach((t) => {
    if (Array.isArray(t.activityLogs) && t.activityLogs.length > 0) {
      t.activityLogs.forEach((log) => addLog(log));
    } else {
      // Legacy fallback
      if (t.updatedAt && t.updatedAt !== t.createdAt) {
        addLog({
          id: `legacy-update-${t.id}`,
          timestamp: t.updatedAt,
          authorName: t.assigneeAccount || 'Người phụ trách',
          authorAccount: t.assigneeAccount || 'member',
          authorRole: 'Member',
          actionType: 'REPORT_SUBMIT',
          summary: `[Tuần ${t.weekNumber || '?'}] Cập nhật tiến độ: ${t.completionPercentage}%, Effort: ${t.actualEffort}h, Trạng thái: "${t.status}"`,
        });
      }
      if (t.createdAt) {
        addLog({
          id: `legacy-create-${t.id}`,
          timestamp: t.createdAt,
          authorName: t.createdBy || 'Admin',
          authorAccount: 'Admin',
          authorRole: 'Admin',
          actionType: 'CREATE',
          summary: `Khởi tạo công việc ban đầu [Tuần ${t.weekNumber || '?'}]`,
        });
      }
    }
  });

  return combinedLogs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};
