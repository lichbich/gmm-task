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

/**
 * Global AI feature permission checker:
 * Ensures all present and future AI features are exclusively visible & usable for account 'LichDT'.
 */
export function isAIFeatureEnabled(user?: { account?: string; id?: string; name?: string } | null): boolean {
  if (!user) return false;
  const account = (user.account || '').trim().toLowerCase();
  const id = (user.id || '').trim().toLowerCase();
  return account === 'lichdt' || id === 'usr-lichdt';
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
