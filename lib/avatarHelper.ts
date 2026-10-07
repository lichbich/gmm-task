import type { Expression, Face, Color } from '@doan-labs/peek';
import type { Task, User } from '../types/task';

export const PEEK_FACES: Face[] = ['circle', 'triangle', 'diamond', 'semicircle'];
export const PEEK_COLORS: Color[] = ['rose', 'mint', 'butter', 'lavender', 'aqua', 'clay', 'fog'];

/**
 * Returns a 100% collision-free face & color combination for all members in the system.
 * By mapping up to 28 members to distinct (face, color) pairs, no two members in the team look the same.
 */
export function getMemberUniqueTraits(
  account?: string,
  users?: User[]
): { face: Face; color: Color } {
  const cleanAcc = (account || '').trim().toLowerCase();
  if (!cleanAcc) {
    return { face: 'circle', color: 'rose' };
  }

  // 1. If users array is available, sort accounts stably to guarantee distinct combinations
  if (users && users.length > 0) {
    const sortedAccounts = Array.from(
      new Set(users.map((u) => (u.account || '').trim().toLowerCase()).filter(Boolean))
    ).sort();
    const idx = sortedAccounts.indexOf(cleanAcc);
    if (idx !== -1) {
      const combo = idx % 28;
      return {
        face: PEEK_FACES[Math.floor(combo / 7)],
        color: PEEK_COLORS[combo % 7],
      };
    }
  }

  // 2. High-entropy hash fallback for accounts not yet in users table
  let h = 2166136261;
  for (let i = 0; i < cleanAcc.length; i++) {
    h ^= cleanAcc.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const combo = Math.abs(h) % 28;
  return {
    face: PEEK_FACES[Math.floor(combo / 7)],
    color: PEEK_COLORS[combo % 7],
  };
}

export interface MemberEmotionResult {
  expression: Expression;
  reason: string;
}

/**
 * Computes dynamic avatar expression based on member's task situation:
 * 1. Quá hạn end date (trễ deadline) -> Buồn (sad)
 * 2. Chưa có task nào -> Chán nản (bored)
 * 3. Đang có nhiều In Progress nhất -> Tập trung (attentive)
 * 4. Done nhiều task nhất -> Hào hứng (excited)
 * 5. Có nhiều task nhất -> Buồn ngủ (sleepy)
 * 6. Còn lại -> Vui vẻ (happy) hoặc bình thường (normal)
 */
export function computeMemberEmotion(
  account?: string,
  tasks: Task[] = [],
  users: User[] = [],
  todayStr: string = '',
  selectedWeek?: number,
  selectedYear?: number
): MemberEmotionResult {
  const cleanAcc = (account || '').trim().toLowerCase();
  if (!cleanAcc) {
    return { expression: 'normal', reason: '' };
  }

  // Filter tasks to active week (if week specified), else all tasks
  const weekTasks = tasks.filter((t) => {
    if (selectedWeek && t.weekNumber !== selectedWeek) return false;
    if (selectedYear && t.year && t.year !== selectedYear) return false;
    return true;
  });

  // Collect stats for all accounts
  const accountStats: Record<
    string,
    { total: number; done: number; inProgress: number; overdue: number }
  > = {};

  const registerTask = (acc: string, t: Task) => {
    const k = acc.trim().toLowerCase();
    if (!k) return;
    if (!accountStats[k]) {
      accountStats[k] = { total: 0, done: 0, inProgress: 0, overdue: 0 };
    }
    accountStats[k].total += 1;
    if (t.status === 'Done') {
      accountStats[k].done += 1;
    } else if (t.status === 'In Progress') {
      accountStats[k].inProgress += 1;
    }

    const isOverdue =
      t.status !== 'Done' &&
      Boolean(t.endDate && t.endDate.trim()) &&
      Boolean(todayStr) &&
      Boolean(t.endDate && t.endDate.trim() < todayStr);
    if (isOverdue) {
      accountStats[k].overdue += 1;
    }
  };

  weekTasks.forEach((t) => {
    if (t.assigneeAccount) {
      registerTask(t.assigneeAccount, t);
    }
    if (t.supporterAccounts && Array.isArray(t.supporterAccounts)) {
      t.supporterAccounts.forEach((sup) => registerTask(sup, t));
    }
  });

  // Ensure all registered users are tracked (even if 0 tasks)
  users.forEach((u) => {
    const k = (u.account || '').trim().toLowerCase();
    if (k && !accountStats[k]) {
      accountStats[k] = { total: 0, done: 0, inProgress: 0, overdue: 0 };
    }
  });

  const myStat = accountStats[cleanAcc] || { total: 0, done: 0, inProgress: 0, overdue: 0 };

  // Calculate maximums across all members
  let maxTotal = 0;
  let maxDone = 0;
  let maxInProgress = 0;

  Object.values(accountStats).forEach((st) => {
    if (st.total > maxTotal) maxTotal = st.total;
    if (st.done > maxDone) maxDone = st.done;
    if (st.inProgress > maxInProgress) maxInProgress = st.inProgress;
  });

  // Rule 1: Quá hạn end date -> Buồn (sad)
  if (myStat.overdue > 0) {
    return {
      expression: 'sad',
      reason: `Buồn vì có ${myStat.overdue} task quá hạn deadline...`,
    };
  }

  // Rule 2: Chưa có task nào -> Chán nản (bored)
  if (myStat.total === 0) {
    return {
      expression: 'bored',
      reason: 'Chán nản vì chưa được giao task nào.',
    };
  }

  // Rule 3: Đang có nhiều In Progress nhất -> Tập trung (attentive)
  if (myStat.inProgress > 0 && myStat.inProgress === maxInProgress) {
    return {
      expression: 'attentive',
      reason: `Tập trung cao độ vì đang chạy nhiều task nhất (${myStat.inProgress} In Progress)`,
    };
  }

  // Rule 4: Done nhiều task nhất -> Hào hứng (excited)
  if (myStat.done > 0 && myStat.done === maxDone) {
    return {
      expression: 'excited',
      reason: `Hào hứng vì đã hoàn thành nhiều task nhất (${myStat.done} Done)!`,
    };
  }

  // Rule 5: Nhiều task nhất -> Buồn ngủ (sleepy)
  if (myStat.total > 0 && myStat.total === maxTotal) {
    return {
      expression: 'sleepy',
      reason: `Buồn ngủ vì đang gánh nhiều task nhất (${myStat.total} tasks)`,
    };
  }

  // Rule 6: Còn lại -> Vui vẻ (happy) hoặc bình thường (normal)
  if (myStat.done > 0 || myStat.inProgress > 0) {
    return {
      expression: 'happy',
      reason: 'Vui vẻ làm việc, tiến độ ổn định',
    };
  }

  return {
    expression: 'normal',
    reason: 'Sẵn sàng làm việc',
  };
}
