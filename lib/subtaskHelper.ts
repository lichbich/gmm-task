import { Task, TaskStatus } from '../types/task';

export interface ParentMetrics {
  totalEstimatedEffort: number;
  totalActualEffort: number;
  completionPercentage: number;
  status: TaskStatus;
  collaboratorAccounts: string[];
}

/**
 * Kiểm tra xem một task có phải là Subtask trực thuộc một task lớn hay không
 */
export function isSubtask(task?: Task | null): boolean {
  if (!task) return false;
  return Boolean(task.isSubtask || (task.subtaskParentId && task.subtaskParentId.trim() !== ''));
}

/**
 * Kiểm tra xem một task có phải là Task cha (Parent task) hay không
 */
export function isParentTask(task?: Task | null, allTasks?: Task[]): boolean {
  if (!task) return false;
  if (task.isParentTask) return true;
  if (allTasks && allTasks.length > 0) {
    return allTasks.some((t) => t.subtaskParentId === task.id);
  }
  return false;
}

/**
 * Lấy danh sách các subtask trực thuộc một Task cha
 */
export function getSubtasksOfParent(parentId: string, allTasks: Task[]): Task[] {
  if (!parentId || !allTasks) return [];
  return allTasks.filter((t) => t.subtaskParentId === parentId);
}

/**
 * Tính toán số liệu tổng hợp của Task cha dựa trên các subtask con:
 * - Tổng Effort ước tính (Estimated) = Tổng estimated của các subtask
 * - Tổng Effort thực tế (Actual) = Tổng actual của các subtask
 * - % Tiến độ: Tính bình quân gia quyền theo effort
 * - Trạng thái: Tự động Done nếu 100% subtask Done, In Progress nếu có tiến độ, To do nếu 0%
 * - Danh sách Collab: Tự động tập hợp những người làm subtask
 */
export function calculateParentMetrics(parentTask: Task, subtasks: Task[]): ParentMetrics {
  if (!subtasks || subtasks.length === 0) {
    return {
      totalEstimatedEffort: Number(parentTask.estimatedEffort) || 0,
      totalActualEffort: Number(parentTask.actualEffort) || 0,
      completionPercentage: Number(parentTask.completionPercentage) || 0,
      status: parentTask.status,
      collaboratorAccounts: parentTask.supporterAccounts || [],
    };
  }

  // Tập hợp danh sách người làm subtask làm Collab cho task cha
  const parentAssignee = (parentTask.assigneeAccount || '').trim().toLowerCase();
  const collabsSet = new Set<string>();

  // Giữ lại các supporter có sẵn nếu có
  (parentTask.supporterAccounts || []).forEach((acc) => {
    if (acc && acc.trim().toLowerCase() !== parentAssignee) {
      collabsSet.add(acc.trim());
    }
  });

  subtasks.forEach((s) => {
    if (s.assigneeAccount && s.assigneeAccount.trim().toLowerCase() !== parentAssignee) {
      collabsSet.add(s.assigneeAccount.trim());
    }
    (s.supporterAccounts || []).forEach((sup) => {
      if (sup && sup.trim().toLowerCase() !== parentAssignee) {
        collabsSet.add(sup.trim());
      }
    });
  });

  // Nếu Leader đã ghi đè thủ công trên task cha, bảo toàn giá trị ghi đè
  if (parentTask.isManualOverride) {
    return {
      totalEstimatedEffort: Number(parentTask.estimatedEffort) || 0,
      totalActualEffort: Number(parentTask.actualEffort) || 0,
      completionPercentage: Number(parentTask.completionPercentage) || 0,
      status: parentTask.status,
      collaboratorAccounts: Array.from(collabsSet),
    };
  }

  // 1. Tổng hợp Effort
  const totalEstimatedEffort = Math.round(
    subtasks.reduce((sum, s) => sum + (Number(s.estimatedEffort) || 0), 0) * 100
  ) / 100;

  const totalActualEffort = Math.round(
    subtasks.reduce((sum, s) => sum + (Number(s.actualEffort) || 0), 0) * 100
  ) / 100;

  // 2. Tính % Tiến độ bình quân theo trọng số effort
  const totalWeight = subtasks.reduce(
    (sum, s) => sum + (Number(s.estimatedEffort) || Number(s.actualEffort) || 1),
    0
  );

  let completionPercentage = 0;
  if (totalWeight > 0) {
    const weightedSum = subtasks.reduce((sum, s) => {
      const weight = Number(s.estimatedEffort) || Number(s.actualEffort) || 1;
      const pct = Number(s.completionPercentage) || 0;
      return sum + pct * weight;
    }, 0);
    completionPercentage = Math.round(weightedSum / totalWeight);
  } else {
    const sumPct = subtasks.reduce((sum, s) => sum + (Number(s.completionPercentage) || 0), 0);
    completionPercentage = Math.round(sumPct / subtasks.length);
  }

  // 3. Tính trạng thái
  let status: TaskStatus = 'To do';
  const allDone = subtasks.every((s) => s.status === 'Done' || (Number(s.completionPercentage) || 0) >= 100);
  const anyInProgress = subtasks.some(
    (s) => s.status === 'In Progress' || ((Number(s.completionPercentage) || 0) > 0 && (Number(s.completionPercentage) || 0) < 100)
  );

  if (allDone && completionPercentage >= 100) {
    status = 'Done';
  } else if (anyInProgress || completionPercentage > 0) {
    status = 'In Progress';
  } else {
    status = 'To do';
  }

  return {
    totalEstimatedEffort,
    totalActualEffort,
    completionPercentage,
    status,
    collaboratorAccounts: Array.from(collabsSet),
  };
}
