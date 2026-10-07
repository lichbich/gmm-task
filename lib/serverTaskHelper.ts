import type { Metadata } from 'next';

const FIREBASE_REST_URL = 'https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app/gmm-task';

export interface TaskSummaryForMeta {
  id: string;
  title: string;
  role?: string;
  assigneeName?: string;
  assigneeAccount?: string;
  status?: string;
  completionPercentage?: number;
  actualEffort?: number | string;
  estimatedEffort?: number | string;
  weekNumber?: number | string;
  dueDate?: string;
  deadline?: string;
  description?: string;
}

/**
 * Fetch task data directly on server via Firebase REST API with caching
 */
export async function fetchTaskForMetadata(rawTaskId: string): Promise<TaskSummaryForMeta | null> {
  if (!rawTaskId) return null;

  const cleanId = String(rawTaskId).trim().replace(/^tsk-/, '');
  if (!cleanId) return null;

  try {
    // 1. Try direct fetch by cleanId
    const directRes = await fetch(`${FIREBASE_REST_URL}/tasks/${encodeURIComponent(cleanId)}.json`, {
      next: { revalidate: 30 },
    });

    if (directRes.ok) {
      const data = await directRes.json();
      if (data && typeof data === 'object' && data.title) {
        return {
          id: cleanId,
          ...data,
        };
      }
    }

    // 2. Try with 'tsk-' prefix
    const prefixedRes = await fetch(`${FIREBASE_REST_URL}/tasks/tsk-${encodeURIComponent(cleanId)}.json`, {
      next: { revalidate: 30 },
    });

    if (prefixedRes.ok) {
      const data = await prefixedRes.json();
      if (data && typeof data === 'object' && data.title) {
        return {
          id: `tsk-${cleanId}`,
          ...data,
        };
      }
    }

    // 3. Fallback: fetch all tasks if not found by primary key
    const allRes = await fetch(`${FIREBASE_REST_URL}/tasks.json`, {
      next: { revalidate: 60 },
    });

    if (allRes.ok) {
      const allTasks = await allRes.json();
      if (allTasks && typeof allTasks === 'object') {
        const found = Object.values(allTasks).find((t: any) => {
          if (!t) return false;
          const tId = String(t.id || '').trim().replace(/^tsk-/, '');
          return tId === cleanId;
        }) as TaskSummaryForMeta | undefined;

        if (found && found.title) {
          return found;
        }
      }
    }
  } catch (err) {
    console.warn('[fetchTaskForMetadata] Error fetching task from Firebase:', err);
  }

  return null;
}

/**
 * Build dynamic Next.js Metadata for a task
 */
export function buildTaskMetadata(task: TaskSummaryForMeta | null, rawTaskId: string, baseUrl?: string): Metadata {
  const siteUrl = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://gmm-task.vercel.app';

  if (!task) {
    return {
      title: 'Saho Task System - Hệ thống quản lý task & báo cáo',
      description: 'Hệ thống quản lý task, milestones và báo cáo tiến độ thời gian thực',
    };
  }

  const role = task.role ? String(task.role).trim() : '';
  const title = (task.title || 'Chi tiết Task').trim();
  const assignee = task.assigneeName || task.assigneeAccount || 'Chưa phân công';
  
  const pct = Number(task.completionPercentage) || 0;
  let statusText = task.status || 'To do';
  if (pct >= 100) statusText = 'Done';
  else if (pct > 0 && statusText === 'To do') statusText = 'In Progress';

  const effort = Number(task.actualEffort) || Number(task.estimatedEffort) || 0;
  const week = task.weekNumber ? `Tuần ${task.weekNumber}` : '';
  const deadline = task.dueDate || task.deadline || '';

  const metaTitle = `${role ? `[${role}] ` : ''}${title} | Saho Task`;
  const metaDesc = `👤 Phụ trách: ${assignee} • 📊 Trạng thái: ${statusText} (${pct}%) • ⏱️ Effort: ${effort}h${week ? ` • 📅 ${week}` : ''}${deadline ? ` • ⏰ Hạn: ${deadline}` : ''}`;
  
  const cleanId = String(task.id || rawTaskId).replace(/^tsk-/, '');
  const taskUrl = `${siteUrl}/?taskId=${encodeURIComponent(cleanId)}`;

  // Construct dynamic Open Graph Image URL
  const ogImageParams = new URLSearchParams({
    title,
    role,
    assignee,
    status: statusText,
    progress: String(pct),
    effort: String(effort),
    week: String(task.weekNumber || ''),
  });
  const ogImageUrl = `${siteUrl}/api/og?${ogImageParams.toString()}`;

  return {
    title: metaTitle,
    description: metaDesc,
    openGraph: {
      title: `${role ? `[${role}] ` : ''}${title}`,
      description: `👤 Phụ trách: ${assignee} | 📊 ${statusText} (${pct}%) | ⏱️ ${effort}h${week ? ` | 📅 ${week}` : ''}`,
      url: taskUrl,
      siteName: 'Saho Task System',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${role ? `[${role}] ` : ''}${title}`,
      description: `👤 Phụ trách: ${assignee} | 📊 ${statusText} (${pct}%) | ⏱️ ${effort}h`,
      images: [ogImageUrl],
    },
  };
}
