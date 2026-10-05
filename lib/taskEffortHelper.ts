import { Task, WeeklyHistoryArchive } from '../types/task';

export interface WeeklyEffortItem {
  weekNumber: number;
  year?: number;
  effort: number;
  percentage: number;
  status: string;
  isCurrentWeek: boolean;
}

export interface TaskAccumulatedEffortResult {
  totalEffort: number;
  currentWeekEffort: number;
  weeklyBreakdown: WeeklyEffortItem[];
  chainTaskCount: number;
  hasMultiWeekHistory: boolean;
}

/**
 * Calculates total accumulated effort across all weeks for a given task chain
 * and provides a weekly breakdown.
 */
export const calculateTaskAccumulatedEffort = (
  targetTask?: Task | null,
  allTasks: Task[] = [],
  archives: WeeklyHistoryArchive[] = []
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

  const rootId = targetTask.parentTaskId || targetTask.id;
  const normTitle = (targetTask.title || '').trim().toLowerCase();
  const normAssignee = (targetTask.assigneeAccount || '').trim().toLowerCase();
  const normRole = (targetTask.role || '').trim().toLowerCase();

  // 1. Gather all unique candidates from archives and active tasks
  const allCandidatesMap = new Map<string, Task>();

  // Seed with archive snapshots
  (archives || []).forEach((a) => {
    (a.tasksSnapshot || []).forEach((st) => {
      allCandidatesMap.set(st.id, st);
    });
  });

  // Overwrite with live tasks (live tasks have the latest real-time data)
  (allTasks || []).forEach((t) => {
    allCandidatesMap.set(t.id, t);
  });

  const allCandidates = Array.from(allCandidatesMap.values());

  // 2. Filter tasks that belong to the same chain as targetTask
  const chainTasks = allCandidates.filter((t) => {
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

  // 3. Group by weekNumber (keep latest/live task per week)
  const byWeek = new Map<number, Task>();
  chainTasks.forEach((t) => {
    const w = t.weekNumber || 0;
    const existing = byWeek.get(w);
    if (
      !existing ||
      t.id === targetTask.id ||
      (allTasks.some((at) => at.id === t.id) && !allTasks.some((at) => at.id === existing.id))
    ) {
      byWeek.set(w, t);
    }
  });

  const sortedWeeks = Array.from(byWeek.keys()).sort((a, b) => a - b);
  const weeklyBreakdown: WeeklyEffortItem[] = sortedWeeks.map((w) => {
    const t = byWeek.get(w)!;
    const effort = Number(t.actualEffort) || 0;
    return {
      weekNumber: w,
      year: t.year || 2026,
      effort,
      percentage: Number(t.completionPercentage) || 0,
      status: t.status || 'To do',
      isCurrentWeek: w === targetTask.weekNumber,
    };
  });

  const totalEffort = weeklyBreakdown.reduce((sum, item) => sum + item.effort, 0);
  const currentWeekEffort = Number(targetTask.actualEffort) || 0;

  return {
    totalEffort,
    currentWeekEffort,
    weeklyBreakdown,
    chainTaskCount: weeklyBreakdown.length,
    hasMultiWeekHistory: weeklyBreakdown.length > 1,
  };
};
