import { Task, Milestone, Specialization, TaskActivityLog, normalizeRoleToken, RoleItem } from '../types/task';

/**
 * Standard prefix mapping for Roles / Domains
 */
export const ROLE_CODE_MAP: Record<string, string> = {
  design: 'DES',
  fe: 'FE',
  be: 'BE',
  ba: 'BA',
  qa: 'QA',
  qc: 'QC',
  devops: 'OPS',
  ops: 'OPS',
  ai: 'AI',
  mobile: 'MOB',
  po: 'PO',
  pm: 'PM',
  sa: 'SA',
  bop: 'BOP',
  'back office': 'BOP',
};

/**
 * Convert role / specialization string to standardized Role Prefix.
 * Dynamic: Always checks user-configured roles list (r.code) first.
 */
export function getRolePrefix(role?: Specialization | string, roles?: RoleItem[]): string {
  if (!role) return 'ALL';
  const trimmed = role.trim();

  // 1. Dynamic roles check (Single Source of Truth from Database / Admin Management)
  if (roles && roles.length > 0) {
    // 1a. Direct match by role code (case-insensitive) e.g. "QC" === "QC"
    const byCode = roles.find((r) => r.code?.trim().toUpperCase() === trimmed.toUpperCase());
    if (byCode && byCode.code) {
      return byCode.code.trim().toUpperCase();
    }
    // 1b. Direct match by full name (case-insensitive) e.g. "QC / Tester" -> "QC"
    const byName = roles.find((r) => r.name?.trim().toLowerCase() === trimmed.toLowerCase());
    if (byName && byName.code) {
      return byName.code.trim().toUpperCase();
    }
    // 1c. Token match on code or name using normalizeRoleToken
    const token = normalizeRoleToken(trimmed);
    const byToken = roles.find(
      (r) => normalizeRoleToken(r.code) === token || normalizeRoleToken(r.name) === token
    );
    if (byToken && byToken.code) {
      return byToken.code.trim().toUpperCase();
    }
    // 1d. Fuzzy substring match (contains)
    const fuzzy = roles.find((r) => {
      const c = r.code?.trim().toLowerCase();
      const n = r.name?.trim().toLowerCase();
      const t = trimmed.toLowerCase();
      return (
        (c && (c === t || t.includes(c) || c.includes(t))) ||
        (n && (n === t || t.includes(n) || n.includes(t)))
      );
    });
    if (fuzzy && fuzzy.code) {
      return fuzzy.code.trim().toUpperCase();
    }
  }

  // 2. Static canonical map fallback
  const token = normalizeRoleToken(trimmed);
  if (ROLE_CODE_MAP[token]) {
    return ROLE_CODE_MAP[token];
  }

  // 3. Fallbacks for direct match or known abbreviations
  const r = trimmed.toUpperCase();
  if (
    r === 'FE' ||
    r === 'BE' ||
    r === 'BA' ||
    r === 'QA' ||
    r === 'QC' ||
    r === 'PO' ||
    r === 'PM' ||
    r === 'SA' ||
    r === 'AI' ||
    r === 'OPS' ||
    r === 'BOP'
  ) {
    return r;
  }
  if (r.startsWith('DES') || r.includes('DESIGN')) return 'DES';
  if (r.startsWith('DEV') || r.includes('OPS')) return 'OPS';
  if (r.startsWith('MOB') || r.includes('APP')) return 'MOB';
  if (r === 'QC' || r.includes('QC') || r.startsWith('TEST')) return 'QC';
  if (r === 'QA') return 'QA';

  // 4. Extract alphanumeric letters (2-5 chars) for custom roles
  const clean = r.replace(/[^A-Z0-9]/g, '');
  if (clean.length >= 2) return clean.substring(0, 5);
  return 'ALL';
}

/**
 * Derive Scope Prefix (e.g. MS01, MS02, FND, ADH) from Milestone
 */
export function getScopePrefix(milestoneId?: string, milestones?: Milestone[]): string {
  if (!milestoneId || !milestoneId.trim()) {
    return 'ADH'; // Ad-hoc task not attached to any milestone
  }

  const ms = milestones?.find((m) => m.id === milestoneId);
  if (!ms) {
    // If milestone id itself contains milestone numbering (e.g. 'ms-1', 'm1', 'ms-design-3')
    const match = milestoneId.match(/(?:ms|m)[^\d]*(\d+)/i) || milestoneId.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      return `MS${String(num).padStart(2, '0')}`;
    }
    return 'ADH';
  }

  // Numbered milestone purely: MS01, MS02, MS03...
  let order = ms.order !== undefined && ms.order !== null ? Number(ms.order) : undefined;
  if (order === undefined || isNaN(order) || order <= 0) {
    // Extract leading number from title (e.g. "1. Foundation [Design]" -> 1, "3. Warehouse..." -> 3)
    const titleMatch = ms.title?.match(/^(\d+)\./) || ms.title?.match(/Milestone\s*(\d+)/i) || ms.title?.match(/(\d+)/);
    if (titleMatch) {
      order = parseInt(titleMatch[1], 10);
    }
  }

  // Fallback to finding index in milestones array
  if ((order === undefined || isNaN(order) || order <= 0) && milestones && milestones.length > 0) {
    const idx = milestones.findIndex((m) => m.id === milestoneId);
    if (idx >= 0) {
      order = idx + 1;
    }
  }

  const finalOrder = order && order > 0 ? order : 1;
  return `MS${String(finalOrder).padStart(2, '0')}`;
}

export interface ParsedTaskCode {
  raw: string;
  scope: string;
  role: string;
  sequenceNumber: number;
  subIndex?: number;
  isSubtask: boolean;
  baseCode: string; // The code without subtask suffix
}

/**
 * Regex for standard Task Code:
 * Format: [SCOPE]-[ROLE]-[NUMBER][.SUB]
 * e.g. MS01-FE-015, MS01-FE-015.01, ADH-BE-008
 */
export const TASK_CODE_REGEX = /^([A-Z0-9]{2,6})-([A-Z0-9]{2,5})-(\d{3,4})(?:\.(\d{2}))?$/;

/**
 * Parse a task code string into structured components
 */
export function parseTaskCode(code?: string): ParsedTaskCode | null {
  if (!code || typeof code !== 'string') return null;
  const match = code.trim().toUpperCase().match(TASK_CODE_REGEX);
  if (!match) return null;

  const scope = match[1];
  const role = match[2];
  const sequenceNumber = parseInt(match[3], 10);
  const subIndex = match[4] ? parseInt(match[4], 10) : undefined;
  const isSubtask = subIndex !== undefined;
  const baseCode = `${scope}-${role}-${match[3]}`;

  return {
    raw: code.trim().toUpperCase(),
    scope,
    role,
    sequenceNumber,
    subIndex,
    isSubtask,
    baseCode,
  };
}

/**
 * Check if a code string conforms to the hierarchical standard
 */
export function isValidTaskCode(code?: string): boolean {
  return Boolean(parseTaskCode(code));
}

export interface GenerateTaskCodeOptions {
  milestoneId?: string;
  role: Specialization;
  isSubtask?: boolean;
  subtaskParentId?: string;
  existingTasks: Task[];
  milestones?: Milestone[];
  roles?: RoleItem[];
}

/**
 * Generate next hierarchical task code adhering to:
 * - Single Source of Truth
 * - Scope & Role Taxonomy
 * - Auto-increment within Scope (Method 1)
 * - Subtask inheritance: [ParentCode].[01..99]
 */
export function generateNextTaskCode(options: GenerateTaskCodeOptions): string {
  const { milestoneId, role, isSubtask, subtaskParentId, existingTasks, milestones, roles } = options;

  // Case 1: Subtask inheriting parent code
  if (isSubtask || (subtaskParentId && subtaskParentId.trim() !== '')) {
    const parentTask = existingTasks.find((t) => t.id === subtaskParentId);
    if (parentTask) {
      // Ensure parent has a valid code
      const parentCode = parentTask.code && isValidTaskCode(parentTask.code)
        ? parentTask.code.split('.')[0] // Strip any sub-index if parent was erroneously tagged
        : generateNextTaskCode({
            milestoneId: parentTask.milestoneId,
            role: parentTask.role,
            isSubtask: false,
            existingTasks: existingTasks.filter((t) => t.id !== parentTask.id),
            milestones,
            roles,
          });

      // Find all existing subtasks of this parent
      const siblingSubtasks = existingTasks.filter(
        (t) => t.subtaskParentId === parentTask.id && t.code && t.code.startsWith(parentCode)
      );

      let maxSubIndex = 0;
      siblingSubtasks.forEach((st) => {
        const parsed = parseTaskCode(st.code);
        if (parsed?.subIndex && parsed.subIndex > maxSubIndex) {
          maxSubIndex = parsed.subIndex;
        }
      });

      const nextSubIndex = maxSubIndex + 1;
      return `${parentCode}.${String(nextSubIndex).padStart(2, '0')}`;
    }
  }

  // Case 2: Standalone or Parent Task
  const scope = getScopePrefix(milestoneId, milestones);
  const roleCode = getRolePrefix(role, roles);
  const prefix = `${scope}-${roleCode}`;

  // Find all tasks with same prefix (ignore subtasks and sub-indices for sequence counting)
  let maxSeq = 0;
  existingTasks.forEach((t) => {
    if (!t.code) return;
    const parsed = parseTaskCode(t.code);
    if (parsed && parsed.scope === scope && parsed.role === roleCode) {
      if (parsed.sequenceNumber > maxSeq) {
        maxSeq = parsed.sequenceNumber;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  return `${prefix}-${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Ensure a task has a valid code. If missing or invalid, generate one.
 */
export function ensureTaskCode(
  task: Task,
  existingTasks: Task[],
  milestones?: Milestone[],
  roles?: RoleItem[]
): string {
  const targetScope = getScopePrefix(task.milestoneId, milestones);
  const targetRole = getRolePrefix(task.role, roles);
  const parsed = parseTaskCode(task.code);
  const isMatching =
    Boolean(parsed) &&
    parsed?.scope === targetScope &&
    parsed?.role === targetRole &&
    Boolean(parsed?.isSubtask) === Boolean(task.isSubtask || task.subtaskParentId);

  if (isMatching && task.code) {
    return task.code;
  }
  return generateNextTaskCode({
    milestoneId: task.milestoneId,
    role: task.role,
    isSubtask: Boolean(task.isSubtask || task.subtaskParentId),
    subtaskParentId: task.subtaskParentId,
    existingTasks,
    milestones,
    roles,
  });
}

/**
 * Resolves the effective standardized task code for any task.
 * Guarantees that:
 * 1. If the task already has a conforming code matching its current milestone and role, return it.
 * 2. If the task code is missing or outdated/mismatched, dynamically computes the compliant code.
 * 3. Never returns empty string or legacy raw timestamp ID.
 */
export function getEffectiveTaskCode(
  task?: Task | null,
  allTasks?: Task[],
  milestones?: Milestone[],
  roles?: RoleItem[]
): string {
  if (!task) return '';
  const targetScope = getScopePrefix(task.milestoneId, milestones);
  const targetRole = getRolePrefix(task.role, roles);
  const parsed = parseTaskCode(task.code);

  const isSubtask = Boolean(task.isSubtask || task.subtaskParentId);
  const isCodeMatching =
    Boolean(parsed) &&
    parsed?.scope === targetScope &&
    parsed?.role === targetRole &&
    Boolean(parsed?.isSubtask) === isSubtask;

  if (isCodeMatching && task.code) {
    return task.code;
  }

  // Generate on-the-fly valid code
  return generateNextTaskCode({
    milestoneId: task.milestoneId,
    role: task.role,
    isSubtask,
    subtaskParentId: task.subtaskParentId,
    existingTasks: (allTasks || []).filter((t) => t.id !== task.id),
    milestones,
    roles,
  });
}

/**
 * Promote subtasks to standalone tasks when parent is deleted (Rule 3: Detach & Promote)
 * Preserves 100% actualEffort, completionPercentage, logs, and assigns new standalone codes.
 */
export function promoteSubtasksToStandalone(
  deletedParentId: string,
  allTasks: Task[],
  milestones?: Milestone[],
  authorInfo?: { name: string; account: string; role?: string },
  roles?: RoleItem[]
): Task[] {
  const authorName = authorInfo?.name || 'Hệ thống';
  const authorAccount = authorInfo?.account || 'system';
  const authorRole = authorInfo?.role || 'System';
  const nowIso = new Date().toISOString();

  // Tasks excluding the parent task and any subtasks to be promoted
  const subtasksToPromote = allTasks.filter((t) => t.subtaskParentId === deletedParentId);
  if (subtasksToPromote.length === 0) return [];

  const currentPool = allTasks.filter((t) => t.id !== deletedParentId && t.subtaskParentId !== deletedParentId);
  const promotedList: Task[] = [];

  subtasksToPromote.forEach((subtask) => {
    const oldCode = subtask.code || 'Chưa có mã';
    const newStandaloneCode = generateNextTaskCode({
      milestoneId: subtask.milestoneId,
      role: subtask.role,
      isSubtask: false,
      existingTasks: [...currentPool, ...promotedList],
      milestones,
      roles,
    });

    const promotionLog: TaskActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      authorName,
      authorAccount,
      authorRole,
      actionType: 'GENERAL_UPDATE',
      summary: `Tách thành việc độc lập do task cha bị xóa. Mã mới: [${newStandaloneCode}] (Mã cũ: [${oldCode}])`,
    };

    const promotedTask: Task = {
      ...subtask,
      code: newStandaloneCode,
      isSubtask: false,
      subtaskParentId: undefined,
      subtaskParentTitle: undefined,
      subtaskReviewerAccount: undefined,
      updatedAt: nowIso,
      updatedBy: `${authorName} (@${authorAccount})`,
      activityLogs: [promotionLog, ...(subtask.activityLogs || [])],
    };

    promotedList.push(promotedTask);
  });

  return promotedList;
}

/**
 * Ensure all tasks in a collection have valid hierarchical codes (Data migration / enrich helper)
 */
export function enrichTasksWithHierarchicalCodes(
  tasks: Task[],
  milestones?: Milestone[],
  roles?: RoleItem[]
): { enrichedTasks: Task[]; hasChanges: boolean } {
  let hasChanges = false;
  const nowIso = new Date().toISOString();
  const standaloneTasks: Task[] = [];
  const subtasksList: Task[] = [];

  // Split into standalone and subtasks to assign in hierarchical order
  tasks.forEach((t) => {
    if (t.subtaskParentId || t.isSubtask) {
      subtasksList.push(t);
    } else {
      standaloneTasks.push(t);
    }
  });

  const finalStandalone: Task[] = [];
  standaloneTasks.forEach((t) => {
    const targetScope = getScopePrefix(t.milestoneId, milestones);
    const targetRole = getRolePrefix(t.role, roles);
    const parsed = parseTaskCode(t.code);

    // Code is considered valid only if it strictly matches the current milestone scope & role
    const isCodeMatching =
      Boolean(parsed) &&
      parsed?.scope === targetScope &&
      parsed?.role === targetRole &&
      !parsed?.isSubtask;

    if (isCodeMatching && t.code) {
      finalStandalone.push(t);
    } else {
      hasChanges = true;
      const newCode = generateNextTaskCode({
        milestoneId: t.milestoneId,
        role: t.role,
        isSubtask: false,
        existingTasks: finalStandalone,
        milestones,
        roles,
      });

      if (t.code && t.code !== newCode) {
        const transitionLog: TaskActivityLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          authorName: 'Hệ thống',
          authorAccount: 'system',
          authorRole: 'System',
          actionType: 'TASK_CODE_CHANGE',
          summary: `Chuẩn hóa mã phân cấp theo Cột mốc. Mã mới: [${newCode}] (Mã cũ: [${t.code}])`,
        };
        finalStandalone.push({
          ...t,
          code: newCode,
          activityLogs: [transitionLog, ...(t.activityLogs || [])],
        });
      } else {
        finalStandalone.push({ ...t, code: newCode });
      }
    }
  });

  const finalSubtasks: Task[] = [];
  subtasksList.forEach((st) => {
    const parent = finalStandalone.find((p) => p.id === st.subtaskParentId);
    if (parent && parent.code) {
      const baseParentCode = parent.code.split('.')[0];
      const parsed = parseTaskCode(st.code);
      const isSubMatching =
        Boolean(parsed) &&
        parsed?.baseCode === baseParentCode &&
        parsed?.isSubtask;

      if (isSubMatching && st.code) {
        finalSubtasks.push(st);
      } else {
        hasChanges = true;
        const allCurrent = [...finalStandalone, ...finalSubtasks];
        const newSubCode = generateNextTaskCode({
          milestoneId: st.milestoneId || parent.milestoneId,
          role: st.role,
          isSubtask: true,
          subtaskParentId: st.subtaskParentId,
          existingTasks: allCurrent,
          milestones,
          roles,
        });

        if (st.code && st.code !== newSubCode) {
          const transitionLog: TaskActivityLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: nowIso,
            authorName: 'Hệ thống',
            authorAccount: 'system',
            authorRole: 'System',
            actionType: 'TASK_CODE_CHANGE',
            summary: `Chuẩn hóa mã việc con theo task cha [${parent.code}]. Mã mới: [${newSubCode}] (Mã cũ: [${st.code}])`,
          };
          finalSubtasks.push({
            ...st,
            code: newSubCode,
            isSubtask: true,
            activityLogs: [transitionLog, ...(st.activityLogs || [])],
          });
        } else {
          finalSubtasks.push({ ...st, code: newSubCode, isSubtask: true });
        }
      }
    } else {
      // Orphaned subtask -> promote to standalone
      hasChanges = true;
      const allCurrent = [...finalStandalone, ...finalSubtasks];
      const newCode = generateNextTaskCode({
        milestoneId: st.milestoneId,
        role: st.role,
        isSubtask: false,
        existingTasks: allCurrent,
        milestones,
        roles,
      });

      const transitionLog: TaskActivityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowIso,
        authorName: 'Hệ thống',
        authorAccount: 'system',
        authorRole: 'System',
        actionType: 'TASK_CODE_CHANGE',
        summary: `Tách việc độc lập và chuẩn hóa mã. Mã mới: [${newCode}] (Mã cũ: [${st.code || 'Chưa có'}])`,
      };

      finalSubtasks.push({
        ...st,
        code: newCode,
        isSubtask: false,
        subtaskParentId: undefined,
        subtaskParentTitle: undefined,
        subtaskReviewerAccount: undefined,
        activityLogs: [transitionLog, ...(st.activityLogs || [])],
      });
    }
  });

  // Re-order according to original list
  const lookup = new Map<string, Task>();
  [...finalStandalone, ...finalSubtasks].forEach((t) => lookup.set(t.id, t));

  const enrichedTasks = tasks.map((t) => lookup.get(t.id) || t);
  return { enrichedTasks, hasChanges };
}
