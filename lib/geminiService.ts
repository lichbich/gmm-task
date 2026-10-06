export interface SubTaskSuggestion {
  taskName: string;
  role: 'Designer' | 'Frontend' | 'Backend' | 'Tester' | 'Dev';
  estimatedEffort: number;
  description: string;
}

export interface ChatHistoryMessage {
  role: 'user' | 'model';
  content: string;
}

export interface AIChatResponse {
  message: string;
  tasks: SubTaskSuggestion[];
  error?: string;
}

export interface BreakdownResult {
  tasks: SubTaskSuggestion[];
  message?: string;
  error?: string;
}

export interface EffortSuggestionResult {
  estimatedEffort: number;
  reasoning: string;
  error?: string;
}

export interface AIChatContext {
  milestoneTitle?: string;
  currentRole?: string;
  currentTaskTitle?: string;
  scope?: 'current_role' | 'all_roles';
}

export interface AIPermissionsConfig {
  allowedAccounts: string[];
  allowAll?: boolean;
  featurePermissions?: Record<string, { assistant?: boolean; weeklyReport?: boolean }>;
  updatedAt?: number;
  updatedBy?: string;
}

export const DEFAULT_AI_ALLOWED_ACCOUNTS = ['admin', 'LichDT', 'QuynhNV', 'NhiHT'];

/**
 * Global AI feature permission checker:
 * By default, allows: admin, LichDT, QuynhNV, NhiHT.
 * Admin can customize allowed accounts via AIPermissionsConfig in Realtime DB.
 */
export function isAIFeatureEnabled(
  user?: { account?: string; id?: string; name?: string; role?: string } | null,
  feature?: 'assistant' | 'weeklyReport',
  aiPermissions?: AIPermissionsConfig | null
): boolean {
  if (!user) return false;
  const account = (user.account || '').trim();
  const lowerAccount = account.toLowerCase();
  const role = (user.role || '').trim();

  // Admin always has full access to all AI features
  if (lowerAccount === 'admin' || role === 'Admin') {
    return true;
  }

  // If DB permissions exist
  if (aiPermissions) {
    if (aiPermissions.allowAll) return true;

    // Check specific feature toggle if customized
    if (feature && aiPermissions.featurePermissions) {
      const userFeature = Object.entries(aiPermissions.featurePermissions).find(
        ([acc]) => acc.toLowerCase() === lowerAccount
      )?.[1];
      if (userFeature !== undefined) {
        if (feature === 'assistant' && userFeature.assistant !== undefined) {
          return !!userFeature.assistant;
        }
        if (feature === 'weeklyReport' && userFeature.weeklyReport !== undefined) {
          return !!userFeature.weeklyReport;
        }
      }
    }

    if (Array.isArray(aiPermissions.allowedAccounts) && aiPermissions.allowedAccounts.length > 0) {
      return aiPermissions.allowedAccounts.some((acc) => acc.trim().toLowerCase() === lowerAccount);
    }
  }

  // Fallback defaults: LichDT, QuynhNV, NhiHT, admin
  return DEFAULT_AI_ALLOWED_ACCOUNTS.some((acc) => acc.toLowerCase() === lowerAccount);
}

export async function requestAIChat(
  message: string,
  history: ChatHistoryMessage[] = [],
  context?: AIChatContext
): Promise<AIChatResponse> {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'chat',
        message,
        history,
        context,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Không thể trao đổi với AI.');
    }

    return {
      message: data.message || 'Đã phân tích và cập nhật danh sách task.',
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
    };
  } catch (err: any) {
    return {
      message: '',
      tasks: [],
      error: err.message || 'Lỗi kết nối AI.',
    };
  }
}

export async function requestAIBreakdown(
  prompt: string,
  context?: { milestoneTitle?: string; currentRole?: string }
): Promise<BreakdownResult> {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'breakdown',
        prompt,
        context,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Không thể bóc tách task qua AI.');
    }

    return {
      tasks: data.tasks || [],
      message: data.message || '',
    };
  } catch (err: any) {
    return { tasks: [], error: err.message || 'Lỗi kết nối AI.' };
  }
}

export async function requestAIEffortSuggestion(
  title: string,
  description?: string,
  role?: string
): Promise<EffortSuggestionResult> {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'suggest-effort',
        title,
        description,
        role,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Không thể ước tính giờ qua AI.');
    }

    return {
      estimatedEffort: data.estimatedEffort ?? 2,
      reasoning: data.reasoning || '',
    };
  } catch (err: any) {
    return {
      estimatedEffort: 2,
      reasoning: '',
      error: err.message || 'Lỗi kết nối AI.',
    };
  }
}

export interface WeeklySummaryRequestData {
  weekNumber: number;
  year: number;
  tasksSummary: Array<{
    id: string;
    title: string;
    role: string;
    assigneeAccount?: string;
    completionPercentage: number;
    actualEffort: number;
    estimatedEffort: number;
    status: string;
    notes?: string;
    startDate?: string;
    endDate?: string;
    deadline?: string;
    deadlineStatus?: string;
    rolloverWeeksCount?: number;
    rolloverHistory?: string;
    isRollover?: boolean;
  }>;
  ticketsSummary?: Array<{
    id: string;
    code: string;
    title: string;
    toRole: string;
    priority: string;
    status: string;
    fromAccount: string;
    assignedTo?: string;
  }>;
  roleStats?: Array<{
    role: string;
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    actualEffort: number;
    estimatedEffort: number;
  }>;
}

export async function requestAIWeeklySummary(data: WeeklySummaryRequestData): Promise<{ summary: string; error?: string }> {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'summarize-week',
        ...data,
      }),
    });

    const resData = await res.json();
    if (!res.ok || !resData.success) {
      throw new Error(resData.error || 'Không thể tạo bản tổng hợp báo cáo tuần.');
    }

    return { summary: resData.summary || '' };
  } catch (err: any) {
    return { summary: '', error: err.message || 'Lỗi kết nối AI.' };
  }
}

export async function requestAISystemQuery(
  message: string,
  systemContext: any,
  history: ChatHistoryMessage[] = []
): Promise<{ reply: string; error?: string }> {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ask-system',
        message,
        systemContext,
        history,
      }),
    });

    const resData = await res.json();
    if (!res.ok || !resData.success) {
      throw new Error(resData.error || 'Không thể xử lý câu hỏi qua AI.');
    }

    return { reply: resData.reply || '' };
  } catch (err: any) {
    return { reply: '', error: err.message || 'Lỗi kết nối AI.' };
  }
}

export interface StoredWeeklySummary {
  weekNumber: number;
  year: number;
  summary: string;
  createdAt: number;
  updatedAt: number;
  generatedBy?: string;
  tasksCount?: number;
}

import { database, ref, set, get, DB_ROOT_NODE } from './firebase';

/**
 * Fetch cached weekly summary from Firebase Realtime Database
 */
export async function fetchSavedWeeklySummary(
  weekNumber: number,
  year: number
): Promise<StoredWeeklySummary | null> {
  try {
    const summaryRef = ref(database, `${DB_ROOT_NODE}/ai_weekly_summaries/w${weekNumber}_${year}`);
    const snapshot = await get(summaryRef);
    if (snapshot.exists()) {
      return snapshot.val() as StoredWeeklySummary;
    }
    return null;
  } catch (err) {
    console.warn('[AI Summary DB] Failed to fetch cached summary:', err);
    return null;
  }
}

/**
 * Save / Update generated weekly summary in Firebase Realtime Database
 */
export async function saveWeeklySummaryToDb(
  weekNumber: number,
  year: number,
  summary: string,
  authorAccount?: string,
  tasksCount?: number
): Promise<void> {
  try {
    const summaryRef = ref(database, `${DB_ROOT_NODE}/ai_weekly_summaries/w${weekNumber}_${year}`);
    const now = Date.now();
    const data: StoredWeeklySummary = {
      weekNumber,
      year,
      summary,
      createdAt: now,
      updatedAt: now,
      generatedBy: authorAccount || 'system',
      tasksCount: tasksCount || 0,
    };
    await set(summaryRef, data);
    console.log(`[AI Summary DB] Successfully cached report for Week ${weekNumber}/${year}`);
  } catch (err) {
    console.warn('[AI Summary DB] Failed to save summary to DB:', err);
  }
}

