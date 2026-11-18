'use client';

import { useEffect, useRef } from 'react';
import type { MainSectionType } from '../components/Sidebar';
import type { Task, WeeklyHistoryArchive } from '../types/task';
import { PAGE_TITLES, getPageTitleForPath } from './sahoRoutesMeta';

export { PAGE_TITLES, getPageTitleForPath };

export type SahoModalRouteKind =
  | 'task-detail'
  | 'task-create'
  | 'task-edit'
  | 'task-update'
  | 'task-discuss'
  | 'milestone-create'
  | 'milestone-edit'
  | 'request-create'
  | 'request-detail'
  | 'resource-create'
  | 'resource-edit'
  | 'user-create'
  | 'user-detail'
  | 'user-edit'
  | 'profile'
  | 'ai-summary';

export interface ParsedSahoRoute {
  section?: MainSectionType;
  taskTab?: string;
  userSubTab?: 'USERS' | 'ROLES' | 'PERMISSIONS';
  milestoneSubTab?: 'MILESTONES' | 'ADHOC';
  isRoot?: boolean;
  isLogin?: boolean;
  modal?: {
    kind: SahoModalRouteKind;
    id?: string;
    milestoneId?: string;
    assignee?: string;
    role?: string;
    parentId?: string;
    week?: number;
  };
}

export const TASK_TAB_TO_PATH: Record<string, string> = {
  schedule: '/work-schedules',
  milestones: '/milestones',
  tickets: '/requests',
  kanban: '/kanban',
  awards: '/awards',
  history: '/history',
  nextweek: '/next-week',
};

const DEFAULT_BASE_PATH = '/work-schedules';
const BASE_PATH_STORAGE_KEY = 'saho_base_path';
let currentBasePathMemory = DEFAULT_BASE_PATH;

export function getCurrentBasePath(): string {
  if (typeof window === 'undefined') return DEFAULT_BASE_PATH;
  try {
    const stored = sessionStorage.getItem(BASE_PATH_STORAGE_KEY);
    if (stored && stored.startsWith('/')) {
      return stored;
    }
  } catch {}
  return currentBasePathMemory || DEFAULT_BASE_PATH;
}

export function setCurrentBasePath(path: string, title?: string) {
  currentBasePathMemory = path;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(BASE_PATH_STORAGE_KEY, path);
  } catch {}
  if (title && typeof document !== 'undefined') {
    document.title = title;
  }
}

export function getPagePath(
  section: MainSectionType,
  taskTab: string,
  subTab?: string
): string {
  if (section === 'resources') return '/resources';
  if (section === 'users') {
    if (subTab === 'ROLES') return '/users/roles';
    if (subTab === 'PERMISSIONS') return '/users/permissions';
    return '/users';
  }
  if (taskTab === 'milestones' && subTab === 'ADHOC') {
    return '/milestones/adhoc';
  }
  return TASK_TAB_TO_PATH[taskTab] || '/work-schedules';
}

export function pushPageUrl(path: string, title?: string) {
  if (typeof window === 'undefined') return;
  const resolvedTitle = title || getPageTitleForPath(path);
  setCurrentBasePath(path, resolvedTitle);
  const current = window.location.pathname + window.location.search;
  if (current !== path) {
    window.history.pushState({ sahoBasePath: path }, '', path);
  }
}

export function replacePageUrl(path: string, title?: string) {
  if (typeof window === 'undefined') return;
  const resolvedTitle = title || getPageTitleForPath(path);
  setCurrentBasePath(path, resolvedTitle);
  const current = window.location.pathname + window.location.search;
  if (current !== path) {
    window.history.replaceState({ sahoBasePath: path }, '', path);
  }
}

export function getTaskRouteIdentifier(task: Pick<Task, 'id' | 'code'>): string {
  const raw = (task.code && task.code.trim()) || task.id;
  return encodeURIComponent(raw);
}

export function findTaskByRouteIdentifier(
  identifier: string,
  tasks: Task[],
  weeklyArchives?: WeeklyHistoryArchive[]
): Task | undefined {
  const clean = decodeURIComponent(identifier).trim().toLowerCase();
  if (!clean) return undefined;
  const stripped = clean.replace(/^tsk-/, '');

  const matchFn = (t: Task) => {
    const tId = String(t.id || '').trim().toLowerCase();
    const tCode = String(t.code || '').trim().toLowerCase();
    return (
      tId === clean ||
      tId.replace(/^tsk-/, '') === stripped ||
      (tCode && tCode === clean)
    );
  };

  const matches = tasks.filter(matchFn);
  if (matches.length > 0) {
    if (matches.length === 1) return matches[0];
    return [...matches].sort((a, b) => {
      const parentScoreA = a.isParentTask ? 1 : 0;
      const parentScoreB = b.isParentTask ? 1 : 0;
      if (parentScoreA !== parentScoreB) return parentScoreB - parentScoreA;
      return (b.weekNumber || 0) - (a.weekNumber || 0);
    })[0];
  }

  let found: Task | undefined;
  if (weeklyArchives) {
    for (const arch of weeklyArchives) {
      if (Array.isArray(arch.tasksSnapshot)) {
        found = arch.tasksSnapshot.find(matchFn);
        if (found) break;
      }
    }
  }
  return found;
}

export function parseSahoRoute(pathname: string, search = ''): ParsedSahoRoute {
  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const segments = cleanPath.split('/').filter(Boolean).map((s) => decodeURIComponent(s));

  if (segments.length === 0) {
    return { isRoot: true };
  }

  const [first, second, third] = segments;
  const lowerFirst = first.toLowerCase();

  // /login
  if (lowerFirst === 'login') {
    return { isLogin: true };
  }

  // /profile
  if (lowerFirst === 'profile') {
    return { modal: { kind: 'profile' } };
  }

  // /work-schedules
  if (lowerFirst === 'work-schedules' || lowerFirst === 'schedule') {
    return { section: 'tasks', taskTab: 'schedule' };
  }

  // /milestones, /milestones/adhoc, /milestones/create, /milestones/:id/edit
  if (lowerFirst === 'milestones') {
    if (second === 'adhoc') {
      return { section: 'tasks', taskTab: 'milestones', milestoneSubTab: 'ADHOC' };
    }
    if (second === 'create') {
      return {
        section: 'tasks',
        taskTab: 'milestones',
        milestoneSubTab: 'MILESTONES',
        modal: { kind: 'milestone-create' },
      };
    }
    if (second && third === 'edit') {
      return {
        section: 'tasks',
        taskTab: 'milestones',
        milestoneSubTab: 'MILESTONES',
        modal: { kind: 'milestone-edit', id: second },
      };
    }
    return {
      section: 'tasks',
      taskTab: 'milestones',
      milestoneSubTab: params.get('tab') === 'adhoc' ? 'ADHOC' : 'MILESTONES',
    };
  }

  // /requests, /requests/create, /requests/:id
  if (lowerFirst === 'requests' || lowerFirst === 'tickets') {
    if (second === 'create') {
      return {
        section: 'tasks',
        taskTab: 'tickets',
        modal: { kind: 'request-create' },
      };
    }
    if (second) {
      return {
        section: 'tasks',
        taskTab: 'tickets',
        modal: { kind: 'request-detail', id: second },
      };
    }
    return { section: 'tasks', taskTab: 'tickets' };
  }

  // /kanban
  if (lowerFirst === 'kanban') {
    return { section: 'tasks', taskTab: 'kanban' };
  }

  // /awards, /awards/ai-summary
  if (lowerFirst === 'awards') {
    if (second === 'ai-summary') {
      return { section: 'tasks', taskTab: 'awards', modal: { kind: 'ai-summary' } };
    }
    return { section: 'tasks', taskTab: 'awards' };
  }

  // /history
  if (lowerFirst === 'history') {
    return { section: 'tasks', taskTab: 'history' };
  }

  // /next-week
  if (lowerFirst === 'next-week' || lowerFirst === 'nextweek') {
    return { section: 'tasks', taskTab: 'nextweek' };
  }

  // /resources, /resources/create, /resources/:id/edit
  if (lowerFirst === 'resources') {
    if (second === 'create') {
      return { section: 'resources', modal: { kind: 'resource-create' } };
    }
    if (second && third === 'edit') {
      return { section: 'resources', modal: { kind: 'resource-edit', id: second } };
    }
    return { section: 'resources' };
  }

  // /users, /users/roles, /users/permissions, /users/create, /users/:account, /users/:account/edit
  if (lowerFirst === 'users') {
    if (second === 'roles') {
      return { section: 'users', userSubTab: 'ROLES' };
    }
    if (second === 'permissions') {
      return { section: 'users', userSubTab: 'PERMISSIONS' };
    }
    if (second === 'create') {
      return { section: 'users', userSubTab: 'USERS', modal: { kind: 'user-create' } };
    }
    if (second && third === 'edit') {
      return {
        section: 'users',
        userSubTab: 'USERS',
        modal: { kind: 'user-edit', id: second },
      };
    }
    if (second) {
      return {
        section: 'users',
        userSubTab: 'USERS',
        modal: { kind: 'user-detail', id: second },
      };
    }
    return { section: 'users', userSubTab: 'USERS' };
  }

  // /task/create, /task/:id, /task/:id/edit, /task/:id/update, /task/:id/discuss
  if (lowerFirst === 'task' || lowerFirst === 'tasks') {
    if (second === 'create') {
      const weekStr = params.get('week');
      return {
        section: 'tasks',
        modal: {
          kind: 'task-create',
          milestoneId: params.get('milestone') || undefined,
          assignee: params.get('assignee') || undefined,
          role: params.get('role') || undefined,
          parentId: params.get('parent') || undefined,
          week: weekStr ? Number(weekStr) : undefined,
        },
      };
    }
    if (second) {
      const action = (third || '').toLowerCase();
      if (action === 'edit') {
        return { section: 'tasks', modal: { kind: 'task-edit', id: second } };
      }
      if (action === 'update' || action === 'report') {
        return { section: 'tasks', modal: { kind: 'task-update', id: second } };
      }
      if (action === 'discuss') {
        return { section: 'tasks', modal: { kind: 'task-discuss', id: second } };
      }
      return { section: 'tasks', modal: { kind: 'task-detail', id: second } };
    }
  }

  return {};
}

/**
 * Synchronizes a modal open/close lifecycle with an intuitive browser URL
 * and handles Browser Back (`popstate`) to cleanly close the modal without navigation leaks.
 */
export function useSyncModalUrl(
  isOpen: boolean,
  modalUrl: string | null,
  onCloseFromPopState?: () => void,
  modalTitle?: string
) {
  const pushedUrlRef = useRef<string | null>(null);
  const onCloseRef = useRef(onCloseFromPopState);

  useEffect(() => {
    onCloseRef.current = onCloseFromPopState;
  }, [onCloseFromPopState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isOpen && modalUrl) {
      const currentFull = window.location.pathname + window.location.search;
      if (currentFull !== modalUrl) {
        window.history.pushState(
          { sahoModalUrl: modalUrl, sahoBasePath: getCurrentBasePath() },
          '',
          modalUrl
        );
      }
      pushedUrlRef.current = modalUrl;

      if (modalTitle) {
        document.title = `${modalTitle} — Saho Task`;
      }

      const handlePopState = () => {
        const nowFull = window.location.pathname + window.location.search;
        if (pushedUrlRef.current && nowFull !== pushedUrlRef.current) {
          pushedUrlRef.current = null;
          const base = getCurrentBasePath();
          document.title = getPageTitleForPath(base);
          onCloseRef.current?.();
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    } else if (!isOpen && pushedUrlRef.current) {
      const prevPushed = pushedUrlRef.current;
      pushedUrlRef.current = null;
      const nowFull = window.location.pathname + window.location.search;
      // Only restore base URL if user hasn't already transitioned to another modal URL
      if (nowFull === prevPushed) {
        const base = getCurrentBasePath();
        window.history.replaceState({ sahoBasePath: base }, '', base);
        document.title = getPageTitleForPath(base);
      }
    }
  }, [isOpen, modalUrl, modalTitle]);

  // Ensure URL cleans up cleanly on unmount if modal unmounts while still open
  useEffect(() => {
    return () => {
      if (typeof window === 'undefined' || !pushedUrlRef.current) return;
      const prevPushed = pushedUrlRef.current;
      pushedUrlRef.current = null;
      const nowFull = window.location.pathname + window.location.search;
      if (nowFull === prevPushed) {
        const base = getCurrentBasePath();
        window.history.replaceState({ sahoBasePath: base }, '', base);
        document.title = getPageTitleForPath(base);
      }
    };
  }, []);
}
