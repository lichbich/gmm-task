'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { User, Milestone, Task, TaskStatus, WeeklyAwardSummary, WeeklyHistoryArchive, RoleItem, ProjectResource, TaskActivityLog, TicketActivityLog, UserRole, Specialization, isTaskUnworked, Ticket, TicketComment, TicketPriority, TicketStatus, getUserRoleInSpec, getTodayDateOnlyString, formatDateOnlyDisplay, isUserPM, isUserAdminOrPM, getMemberTaskEffort } from '../types/task';
import { INITIAL_USERS, INITIAL_MILESTONES, INITIAL_TASKS, INITIAL_PROJECT_RESOURCES } from '../lib/mockData';
import { database, ref, onValue, set, update, remove, DB_ROOT_NODE } from '../lib/firebase';
import { hashPassword, verifyPassword, generateTemporaryPassword } from '../lib/crypto';
import { ConfirmModal, ConfirmDialogOptions } from '../components/ConfirmModal';
import { AppNotification } from '../types/notification';
import { APP_VERSION, APP_RELEASE_NOTE } from '../lib/version';
import {
  registerDeviceForPushNotifications,
  sendPushNotification,
  playNotificationChime,
  showLocalBrowserNotification,
} from '../lib/notificationService';
import { extractMentions, extractDiscussionParticipants, parseNoteLine } from '../lib/notesHelper';

export interface UpdateTaskNotesOptions {
  isRecall?: boolean;
  isEdit?: boolean;
  skipNotification?: boolean;
  newCommentContent?: string;
}

export function getCurrentISOWeekAndYear(d: Date = new Date()): { week: number; year: number } {
  const date = new Date(d.valueOf());
  const dayNum = (d.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayNum + 3);
  const firstThursday = date.valueOf();
  date.setMonth(0, 1);
  if (date.getDay() !== 4) {
    date.setMonth(0, 1 + ((4 - date.getDay() + 7) % 7));
  }
  const isoWeekNumber = 1 + Math.round((firstThursday - date.valueOf()) / 604800000);
  // Sheet cumulative week system offset (+55 weeks offset: ISO week 38 (14/09-20/09/2026) -> Sheet week 93)
  const sheetWeekNumber = isoWeekNumber + 55;
  return { week: sheetWeekNumber, year: date.getFullYear() };
}

export const formatToLocalISOString = (date: Date = new Date()): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function getWeekSundayNoon(weekNo: number, year: number = 2026): Date {

  const isoWeekNo = weekNo > 50 ? weekNo - 55 : weekNo;

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);

  const start = new Date(firstMonday);
  start.setDate(firstMonday.getDate() + (isoWeekNo - 1) * 7);

  const sundayNoon = new Date(start);
  sundayNoon.setDate(start.getDate() + 6);
  sundayNoon.setHours(12, 0, 0, 0); // 12:00 Sunday
  return sundayNoon;
}

export function getWeekDeadline(weekNo: number, year: number = 2026): Date {
  const isoWeekNo = weekNo > 50 ? weekNo - 55 : weekNo;

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);

  const start = new Date(firstMonday);
  start.setDate(firstMonday.getDate() + (isoWeekNo - 1) * 7);

  const deadline = new Date(start);
  deadline.setDate(start.getDate() + 6);
  deadline.setHours(22, 0, 0, 0); // 22:00 Sunday
  return deadline;
}

export const DEFAULT_ROLES: RoleItem[] = [
  {
    id: 'role-pm',
    code: 'PM',
    name: 'Project Manager (Quản lý dự án)',
    description: 'Quản lý tiến độ, điều phối & giám sát toàn bộ hoạt động dự án',
    color: 'purple',
    order: 0,
  },
  {
    id: 'role-ba',
    code: 'BA',
    name: 'Business Analyst (Nghiệp vụ)',
    description: 'Phân tích yêu cầu, quy trình nghiệp vụ & viết đặc tả chức năng',
    color: 'purple',
    order: 1,
  },
  {
    id: 'role-design',
    code: 'Design',
    name: 'UI/UX Design (Thiết kế)',
    description: 'Thiết kế giao diện, trải nghiệm người dùng & design system',
    color: 'amber',
    order: 2,
  },
  {
    id: 'role-fe',
    code: 'FE',
    name: 'Front-End Development (FE)',
    description: 'Lập trình giao diện web, tối ưu tương tác người dùng',
    color: 'blue',
    order: 3,
  },
  {
    id: 'role-be',
    code: 'BE',
    name: 'Back-End Development (BE)',
    description: 'Xây dựng API, cơ sở dữ liệu và hệ thống logic máy chủ',
    color: 'emerald',
    order: 4,
  },
  {
    id: 'role-sa',
    code: 'SA',
    name: 'System Architecture (Kiến trúc hệ thống)',
    description: 'Thiết kế kiến trúc tổng thể, cơ sở dữ liệu & giải pháp kĩ thuật',
    color: 'indigo',
    order: 5,
  },
  {
    id: 'role-qa',
    code: 'QA',
    name: 'Quality Assurance (Kiểm thử)',
    description: 'Kiểm thử tính năng, kiểm soát chất lượng và viết test cases',
    color: 'rose',
    order: 6,
  },
  {
    id: 'role-devops',
    code: 'DevOps',
    name: 'DevOps & Cloud (Hạ tầng)',
    description: 'Triển khai CI/CD, hạ tầng đám mây và vận hành hệ thống',
    color: 'cyan',
    order: 7,
  },
  {
    id: 'role-ai',
    code: 'AI',
    name: 'AI & Machine Learning (Trí tuệ nhân tạo)',
    description: 'Nghiên cứu & tích hợp mô hình AI, xử lý dữ liệu thông minh',
    color: 'slate',
    order: 8,
  },
  {
    id: 'role-mobile',
    code: 'Mobile',
    name: 'Mobile Development (Ứng dụng di động)',
    description: 'Phát triển ứng dụng di động iOS/Android',
    color: 'amber',
    order: 9,
  },
];


interface LoginResult {
  success: boolean;
  firstTime?: boolean;
  user?: User;
  error?: string;
}

interface AppContextType {
  currentUser: User | null;
  authSession: User | null;
  login: (account: string, password?: string) => Promise<LoginResult>;
  setupFirstTimePassword: (userId: string, newPassword: string) => Promise<boolean>;
  changePassword: (userId: string, currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  
  users: User[];
  addUser: (user: Omit<User, 'id'>) => Promise<{ user: User; tempPassword: string }>;
  updateUser: (id: string, user: Partial<User>) => void;
  batchImportUsers: (
    items: {
      member: {
        name: string;
        cccd: string;
        bankAccount: string;
        email: string;
        phone: string;
        account: string;
        role: UserRole;
        specializations: Specialization[];
        technologies: string;
        birthDate: string;
      };
      existingUserId?: string;
    }[]
  ) => Promise<{
    createdCount: number;
    updatedCount: number;
    newCredentials: { id: string; name: string; account: string; tempPassword: string; isNewlyGenerated: boolean }[];
  }>;
  deleteUser: (id: string) => void;
  resetUserPassword: (userId: string) => Promise<{ success: boolean; tempPassword?: string; error?: string }>;
  resetAllUninitializedPasswords: () => Promise<{
    count: number;
    newlyGeneratedCount: number;
    results: { id: string; name: string; account: string; tempPassword: string; isNewlyGenerated: boolean }[];
  }>;
  
  roles: RoleItem[];
  addRole: (role: Omit<RoleItem, 'id'>) => void;
  updateRole: (id: string, updates: Partial<RoleItem>) => void;
  deleteRole: (id: string) => void;
  
  resources: ProjectResource[];
  addResource: (res: Omit<ProjectResource, 'id' | 'order'>) => void;
  updateResource: (id: string, updates: Partial<ProjectResource>) => void;
  deleteResource: (id: string) => void;
  
  milestones: Milestone[];
  addMilestone: (milestone: Omit<Milestone, 'id' | 'order'>) => void;
  updateMilestone: (id: string, milestone: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'orderInMilestone'>) => void;
  duplicateTask: (id: string) => Task | undefined;
  updateTask: (id: string, updates: Partial<Task>, options?: { skipLog?: boolean }) => void;
  deleteTask: (id: string) => void;
  deleteTasks: (ids: string[]) => void;
  reorderTasksInMilestone: (milestoneId: string, taskIds: string[]) => void;
  
  submitTaskReport: (
    taskId: string,
    actualEffort: number,
    completionPercentage: number,
    status: TaskStatus,
    notes?: string,
    extraDates?: { startDate?: string; endDate?: string },
    reportingMemberAccount?: string
  ) => void;
  updateTaskNotes: (taskId: string, notes: string, options?: UpdateTaskNotesOptions) => void;
  
  canEditTask: (task: Task, user?: User | null) => boolean;
  canReportTask: (task: Task, user?: User | null) => boolean;
  
  simulatedTime: string;
  setSimulatedTime: (time: string) => void;
  resetSimulatedTime: () => void;
  
  weeklyAwards: WeeklyAwardSummary[];
  selectedWeek: number;
  setSelectedWeek: (week: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  
  weeklyArchives: WeeklyHistoryArchive[];
  finishWeekAndRollover: () => void;
  rollbackWeekArchive: (targetWeek: number, targetYear?: number) => void;
  
  resetToDefaultData: () => void;
  isFirebaseConnected: boolean;

  confirmDialog: (options: ConfirmDialogOptions) => void;
  hasUnreadNote: (task: Task) => boolean;
  markNoteAsRead: (taskId: string, notesContent?: string) => void;

  requestTaskAssignment: (taskId: string, memberAccount: string, targetWeek?: number) => void;
  approveTaskAssignment: (taskId: string) => void;
  rejectTaskAssignment: (taskId: string) => void;

  // Notification Center
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  requestNotificationPermission: () => Promise<void>;
  isPushEnabled: boolean;

  // Cross-Role Request Tickets System
  tickets: Ticket[];
  createTicket: (ticket: Omit<Ticket, 'id' | 'code' | 'createdAt' | 'comments'>) => Promise<Ticket>;
  updateTicket: (id: string, updates: Partial<Ticket>) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  assignTicket: (ticketId: string, assigneeAccount: string) => Promise<void>;
  resolveTicket: (ticketId: string, resolutionNote: string) => Promise<void>;
  closeTicket: (ticketId: string) => Promise<void>;
  reopenTicket: (ticketId: string) => Promise<void>;
  addTicketComment: (ticketId: string, content: string, attachments?: string[]) => Promise<void>;

  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  appVersion: string;
  broadcastSystemUpdate: (message?: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_AUTH = 'gmm_task_auth_session_v2';
const LOCAL_STORAGE_TASKS_CACHE = 'saho_tasks_cache_backup_v2';
const LOCAL_STORAGE_DELETED_TASKS = 'saho_deleted_task_ids_v2';

export const getLocalDeletedTaskIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_TASKS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    console.error('Failed to parse deleted task IDs', e);
  }
  return new Set();
};

export const addDeletedTaskId = (id: string) => {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalDeletedTaskIds();
    current.add(id);
    localStorage.setItem(LOCAL_STORAGE_DELETED_TASKS, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error('Failed to save deleted task ID', e);
  }
};

export const getLocalTasksCache = (): Task[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TASKS_CACHE);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch (e) {
    console.warn('Failed to parse local tasks cache', e);
  }
  return [];
};

const sanitizeTasksForLocalCache = (taskList: Task[], ultraLight: boolean = false): any[] => {
  return taskList.map((t) => {
    let cleanDesc = t.description || '';
    // Strip heavy base64 image strings from description in local cache to save localStorage MBs
    if (cleanDesc.includes('data:image/')) {
      cleanDesc = cleanDesc.replace(/data:image\/[a-zA-Z]+;base64,[^)"'\s]+/g, '[cached_image]');
    }
    if (ultraLight) {
      if (cleanDesc.length > 300) {
        cleanDesc = cleanDesc.substring(0, 300) + '...';
      }
      return {
        id: t.id,
        title: t.title,
        role: t.role,
        status: t.status,
        priority: t.priority,
        estimatedEffort: t.estimatedEffort,
        actualEffort: t.actualEffort,
        completionPercentage: t.completionPercentage,
        assigneeAccount: t.assigneeAccount,
        milestoneId: t.milestoneId,
        weekNumber: t.weekNumber,
        year: t.year,
        startDate: t.startDate,
        endDate: t.endDate,
        orderInMilestone: t.orderInMilestone,
        description: cleanDesc,
      };
    }
    if (cleanDesc.length > 3000) {
      cleanDesc = cleanDesc.substring(0, 3000) + '...';
    }
    return {
      ...t,
      description: cleanDesc,
      activityLogs: Array.isArray(t.activityLogs) ? t.activityLogs.slice(-5) : undefined,
    };
  });
};

export const saveLocalTasksCache = (taskList: Task[]) => {
  if (typeof window === 'undefined' || !Array.isArray(taskList)) return;
  try {
    const sanitized = sanitizeTasksForLocalCache(taskList, false);
    localStorage.setItem(LOCAL_STORAGE_TASKS_CACHE, JSON.stringify(sanitized));
  } catch (err: any) {
    // Quota exceeded: clean legacy keys and save ultra-lightweight version
    try {
      const legacyKeys = ['saho_tasks_cache_backup_v1', 'saho_tasks_cache', 'gmm_task_auth_session_v1'];
      legacyKeys.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch (_) {}
      });

      const ultraLight = sanitizeTasksForLocalCache(taskList, true);
      localStorage.setItem(LOCAL_STORAGE_TASKS_CACHE, JSON.stringify(ultraLight));
    } catch (innerErr) {
      // If still exceeded, clear the tasks cache key to preserve browser storage
      try {
        localStorage.removeItem(LOCAL_STORAGE_TASKS_CACHE);
      } catch (_) {}
      console.warn('LocalStorage quota exceeded for tasks cache backup, cleared to preserve storage.');
    }
  }
};

export const renumberMilestonesByRole = (rawMilestones: Milestone[]): { renumbered: Milestone[]; changed: boolean } => {
  let changed = false;
  const roleGroups: Record<string, Milestone[]> = {};

  // Group by role (default to Design if missing)
  rawMilestones.forEach((m) => {
    const roleKey = m.role && m.role !== 'ALL' ? m.role : 'Design';
    if (!roleGroups[roleKey]) roleGroups[roleKey] = [];
    roleGroups[roleKey].push(m);
  });

  const allRenumbered: Milestone[] = [];
  Object.keys(roleGroups).forEach((roleKey) => {
    const group = roleGroups[roleKey].sort((a, b) => (a.order || 0) - (b.order || 0));
    group.forEach((m, idx) => {
      const correctOrder = idx + 1;
      let newTitle = m.title;
      // If title starts with Milestone \d+: or Milestone \d+, update prefix to correctOrder
      const match = m.title.match(/^Milestone\s+(\d+)\s*(:\s*.*)?$/i);
      if (match) {
        const oldNum = parseInt(match[1], 10);
        const rest = match[2] ? match[2] : '';
        if (oldNum !== correctOrder) {
          newTitle = `Milestone ${correctOrder}${rest}`.trim();
        }
      }
      const roleAssigned = m.role && m.role !== 'ALL' ? m.role : (roleKey as Specialization);
      if (m.order !== correctOrder || m.title !== newTitle || m.role !== roleAssigned) {
        changed = true;
      }
      allRenumbered.push({
        ...m,
        order: correctOrder,
        title: newTitle,
        role: roleAssigned,
      });
    });
  });

  allRenumbered.sort((a, b) => {
    if (a.role !== b.role) return (a.role || '').localeCompare(b.role || '');
    return a.order - b.order;
  });

  return { renumbered: allRenumbered, changed };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [roles, setRoles] = useState<RoleItem[]>(DEFAULT_ROLES);
  const [resources, setResources] = useState<ProjectResource[]>(INITIAL_PROJECT_RESOURCES as ProjectResource[]);
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [tasks, setTasks] = useState<Task[]>(() => {
    const cached = getLocalTasksCache();
    return cached.length > 0 ? cached : INITIAL_TASKS;
  });
  const [weeklyArchives, setWeeklyArchives] = useState<WeeklyHistoryArchive[]>([]);
  const [authSession, setAuthSession] = useState<User | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);
  const [confirmState, setConfirmState] = useState<ConfirmDialogOptions | null>(null);

  // Cross-Role Request Tickets State
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Notification Center State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isPushEnabled, setIsPushEnabled] = useState(false);

  // Theme Management (Default: light, persisted in localStorage)
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedTheme = localStorage.getItem('saho_theme') as 'light' | 'dark' | null;
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setThemeState(savedTheme);
        if (savedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else {
        setThemeState('light');
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error('Failed to load theme preference', e);
    }
  }, []);

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('saho_theme', newTheme);
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {
        console.error('Failed to save theme preference', e);
      }
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const confirmDialog = (options: ConfirmDialogOptions) => {
    setConfirmState(options);
  };
  const closeConfirm = () => {
    setConfirmState(null);
  };

  // Read notes tracking for unread indicator
  const [readNotesMap, setReadNotesMap] = useState<Record<string, string>>({});

  const getStorageKey = (account?: string) => `gmm_read_notes_${account || 'guest'}`;

  // Load read notes map whenever user changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = getStorageKey(authSession?.account);
      const saved = localStorage.getItem(key);
      if (saved) {
        setReadNotesMap(JSON.parse(saved));
      } else {
        setReadNotesMap({});
      }
    } catch (e) {
      console.error('Failed to load readNotesMap', e);
    }
  }, [authSession?.account]);

  const markNoteAsRead = (taskId: string, notesContent?: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const contentToSave = notesContent !== undefined ? notesContent : (task?.notes || '');
    setReadNotesMap((prev) => {
      const updated = { ...prev, [taskId]: contentToSave };
      try {
        if (typeof window !== 'undefined') {
          const key = getStorageKey(authSession?.account);
          localStorage.setItem(key, JSON.stringify(updated));
        }
      } catch (e) {
        console.error('Failed to save readNotesMap', e);
      }
      return updated;
    });
  };

  const hasUnreadNote = (task: Task): boolean => {
    if (!task.notes || !task.notes.trim()) return false;
    const lastRead = readNotesMap[task.id];
    // If user already viewed this exact content
    if (lastRead === task.notes) return false;

    // Check if the current user was the last author of the note
    const lines = task.notes.trim().split('\n').filter((l) => l.trim().length > 0);
    if (lines.length > 0 && authSession) {
      const lastLine = lines[lines.length - 1];
      const myName = authSession.name.toLowerCase();
      const myAccount = authSession.account.toLowerCase();
      const lastLower = lastLine.toLowerCase();
      if (lastLower.includes(`[${myName}`) || lastLower.includes(`[${myAccount}`)) {
        return false;
      }
    }

    return true;
  };

  const [simulatedTime, setSimulatedTimeState] = useState<string>(
    formatToLocalISOString(new Date())
  );

  const initialWeekYear = getCurrentISOWeekAndYear();
  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeekYear.week);
  const [selectedYear, setSelectedYear] = useState<number>(initialWeekYear.year);

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(LOCAL_STORAGE_AUTH);
      if (savedSession) {
        setAuthSession(JSON.parse(savedSession));
      }
    } catch (e) {
      console.error('Failed to load auth session', e);
    }
  }, []);

  // Subscribe to Firebase Realtime Database
  useEffect(() => {
    try {
      const rootRef = ref(database, DB_ROOT_NODE);
      const unsubscribe = onValue(rootRef, (snapshot) => {
        setIsFirebaseConnected(true);
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.users) {
            const userList = Object.values(data.users) as User[];
            // Ensure specializations array format
            const formattedUsers = userList.map((u: any) => ({
              ...u,
              specializations: Array.isArray(u.specializations)
                ? u.specializations
                : u.specialization
                ? [u.specialization]
                : ['BA'],
            }));
            setUsers(formattedUsers);
          }
          if (data.milestones) {
            const milestoneList = Object.values(data.milestones) as Milestone[];
            const { renumbered, changed } = renumberMilestonesByRole(milestoneList);
            setMilestones(renumbered);
            if (changed) {
              syncMilestonesToFirebase(renumbered);
            }
          } else {
            setMilestones([]);
          }

          // 1. Process explicit deletion tombstones from Firebase
          const remoteDeletedTasks: Record<string, any> = data.deletedTasks || {};
          const localDeletedSet = getLocalDeletedTaskIds();
          Object.keys(remoteDeletedTasks).forEach((id) => localDeletedSet.add(id));
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(LOCAL_STORAGE_DELETED_TASKS, JSON.stringify(Array.from(localDeletedSet)));
            } catch (_) {}
          }

          // 2. Process remote tasks from Firebase
          const rawRemoteTasks: Task[] = data.tasks ? (Object.values(data.tasks) as Task[]) : [];
          let hasLegacy = false;
          const formattedRemoteTasks: Task[] = rawRemoteTasks.map((t: any) => {
            const weekNo =
              typeof t.weekNumber === 'number' && t.weekNumber <= 53 && (!t.year || t.year === 2026)
                ? t.weekNumber + 55
                : t.weekNumber;
            if (weekNo !== t.weekNumber) {
              hasLegacy = true;
            }

            const pct = typeof t.completionPercentage === 'number' ? t.completionPercentage : 0;
            let taskStatus: TaskStatus = t.status || 'To do';

            // Auto-normalize status:
            // - 100% -> Done
            // - 0% < pct < 100% -> In Progress (even if legacy database had it as 'To do')
            // - 0% -> To do (cannot be Done if 0%)
            if (pct >= 100) {
              if (taskStatus !== 'Done') {
                taskStatus = 'Done';
                hasLegacy = true;
              }
            } else if (pct > 0) {
              if (taskStatus === 'To do') {
                taskStatus = 'In Progress';
                hasLegacy = true;
              }
            } else if (pct === 0) {
              if (taskStatus === 'Done') {
                taskStatus = 'To do';
                hasLegacy = true;
              }
            }

            return {
              ...t,
              weekNumber: weekNo,
              status: taskStatus,
              completionPercentage: pct,
              activityLogs: Array.isArray(t.activityLogs)
                ? t.activityLogs
                : t.activityLogs && typeof t.activityLogs === 'object'
                ? Object.values(t.activityLogs)
                : [],
            };
          });

          // 3. TASK INTEGRITY & ANTI-DATA-LOSS SHIELD:
          // Check if any task in local cache is missing from remote DB WITHOUT an explicit deletion record
          const localCached = getLocalTasksCache();
          const remoteMap = new Map<string, Task>();
          formattedRemoteTasks.forEach((t) => remoteMap.set(t.id, t));

          const mergedTasks: Task[] = [...formattedRemoteTasks];
          let restoredCount = 0;

          localCached.forEach((cachedTask) => {
            if (!remoteMap.has(cachedTask.id) && !localDeletedSet.has(cachedTask.id)) {
              console.warn(
                `🛡️ [DATA INTEGRITY SHIELD] Task "${cachedTask.title}" (${cachedTask.id}) was missing from database without deletion record. Auto-restoring to Firebase...`
              );
              mergedTasks.push(cachedTask);
              restoredCount++;
              // Restore to Firebase RTDB immediately
              set(ref(database, `${DB_ROOT_NODE}/tasks/${cachedTask.id}`), sanitizeForFirebase(cachedTask)).catch(console.error);
            }
          });

          if (mergedTasks.length > 0) {
            setTasks(mergedTasks);
            saveLocalTasksCache(mergedTasks);
          } else if (rawRemoteTasks.length === 0 && localCached.length === 0) {
            setTasks([]);
          }

          if (hasLegacy) {
            const obj: Record<string, Task> = {};
            formattedRemoteTasks.forEach((t) => {
              obj[t.id] = sanitizeForFirebase(t);
            });
            update(ref(database, `${DB_ROOT_NODE}/tasks`), obj).catch(console.error);
          }

          if (data.weeklyArchives) {
            const archivesList = Object.values(data.weeklyArchives) as WeeklyHistoryArchive[];
            const uniqueMap = new Map<string, WeeklyHistoryArchive>();
            archivesList.forEach((a) => {
              const key = `${a.weekNumber}_${a.year || 2026}`;
              const existing = uniqueMap.get(key);
              if (!existing || (a.archivedAt && existing.archivedAt && new Date(a.archivedAt).getTime() > new Date(existing.archivedAt).getTime())) {
                uniqueMap.set(key, a);
              }
            });
            const deduplicatedList = Array.from(uniqueMap.values()).sort((a, b) => a.weekNumber - b.weekNumber);
            setWeeklyArchives(deduplicatedList);

            if (deduplicatedList.length < archivesList.length) {
              const obj: Record<string, WeeklyHistoryArchive> = {};
              deduplicatedList.forEach((a) => {
                obj[a.id] = sanitizeForFirebase(a);
              });
              set(ref(database, `${DB_ROOT_NODE}/weeklyArchives`), obj).catch(console.error);
            }
          } else {
            setWeeklyArchives([]);
          }
          if (data.roles) {
            const roleList = Object.values(data.roles) as RoleItem[];
            setRoles(roleList.sort((a, b) => (a.order || 0) - (b.order || 0)));
          } else {
            setRoles([]);
          }
          if (data.resources) {
            const resList = Object.values(data.resources) as ProjectResource[];
            setResources(resList.sort((a, b) => (a.order || 0) - (b.order || 0)));
          } else {
            const resObj: Record<string, any> = {};
            INITIAL_PROJECT_RESOURCES.forEach((r) => { resObj[r.id] = r; });
            set(ref(database, `${DB_ROOT_NODE}/resources`), resObj).catch(console.error);
            setResources(INITIAL_PROJECT_RESOURCES as ProjectResource[]);
          }
          if (data.tickets) {
            const ticketList = Object.values(data.tickets) as Ticket[];
            const formattedTickets = ticketList.map((t: any) => ({
              ...t,
              attachments: Array.isArray(t.attachments)
                ? t.attachments
                : t.attachments && typeof t.attachments === 'object'
                ? Object.values(t.attachments)
                : [],
              comments: Array.isArray(t.comments)
                ? t.comments
                : t.comments && typeof t.comments === 'object'
                ? Object.values(t.comments)
                : [],
            }));
            setTickets(
              formattedTickets.sort(
                (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
              )
            );
          } else {
            setTickets([]);
          }
        } else {
          seedFirebaseMockData();
        }
      }, (error) => {
        console.warn('Firebase listener warning:', error);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error('Error connecting to Firebase RTDB', e);
    }
  }, []);

  // Auto-sync assigned tickets to Tasks list if not yet present in tasks state
  useEffect(() => {
    if (!isFirebaseConnected || tickets.length === 0 || tasks.length === 0) return;

    let hasNewTasks = false;
    const newTasksToAdd: Task[] = [];
    const ticketUpdates: Record<string, Partial<Ticket>> = {};

    tickets.forEach((ticket) => {
      if (ticket.assignedTo && ticket.assignedTo.trim()) {
        const existingTask = tasks.find(
          (t) =>
            (ticket.createdTaskId && t.id === ticket.createdTaskId) ||
            (t.ticketId && t.ticketId === ticket.id)
        );

        if (!existingTask && !newTasksToAdd.some((t) => t.ticketId === ticket.id)) {
          const isMatchSpecHelper = (specA?: string, specB?: string) => {
            if (!specA || !specB) return false;
            const a = specA.trim().toLowerCase();
            const b = specB.trim().toLowerCase();
            return a === b || (a === 'design' && b === 'designer') || (a === 'designer' && b === 'design');
          };

          const targetMilestone =
            milestones.find((m) => m.id === ticket.relatedMilestoneId) ||
            milestones.find((m) => isMatchSpecHelper(m.role, ticket.toRole)) ||
            milestones[0];

          const milestoneId = targetMilestone ? targetMilestone.id : 'ms-default';
          const milestoneTasks = [...tasks, ...newTasksToAdd].filter((t) => t.milestoneId === milestoneId);
          const taskPriority: 'High' | 'Medium' | 'Low' =
            ticket.priority === 'Urgent' || ticket.priority === 'High'
              ? 'High'
              : ticket.priority === 'Low'
              ? 'Low'
              : 'Medium';

          const newTaskId = `tsk-req-${ticket.id}`;
          const taskTitle = `[${ticket.code}] ${ticket.title}`;
          const taskDesc = `${ticket.description}${
            ticket.attachments && ticket.attachments.length > 0
              ? '\n\n📎 Link tài liệu đính kèm:\n' + ticket.attachments.join('\n')
              : ''
          }`;

          const newTask: Task = {
            id: newTaskId,
            title: taskTitle,
            description: taskDesc,
            role: ticket.toRole,
            priority: taskPriority,
            estimatedEffort: 2,
            actualEffort: 0,
            status: ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'Done' : 'In Progress',
            assigneeAccount: ticket.assignedTo,
            milestoneId,
            orderInMilestone: milestoneTasks.length + 1,
            completionPercentage: ticket.status === 'Resolved' || ticket.status === 'Closed' ? 100 : 0,
            weekNumber: selectedWeek,
            year: selectedYear,
            ticketId: ticket.id,
            createdBy: `${ticket.fromName} (Request Ticket ${ticket.code})`,
            createdAt: ticket.createdAt,
            updatedBy: 'Hệ thống tự động đồng bộ',
            updatedAt: new Date().toISOString(),
          };

          newTasksToAdd.push(newTask);
          ticketUpdates[ticket.id] = {
            createdTaskId: newTaskId,
            createdTaskTitle: taskTitle,
          };
          hasNewTasks = true;
        }
      }
    });

    if (hasNewTasks) {
      const combined = [...tasks, ...newTasksToAdd];
      setTasks(combined);
      saveLocalTasksCache(combined);
      newTasksToAdd.forEach((t) => {
        saveTaskToFirebase(t).catch(console.error);
      });
      Object.entries(ticketUpdates).forEach(([tid, up]) => {
        updateTicket(tid, up);
      });
    }
  }, [isFirebaseConnected, tickets, tasks, milestones, selectedWeek, selectedYear]);

  // Real-time Multi-Device Session Invalidation:
  // When Admin resets a user's password, disables a user, or updates credentials in Firebase Realtime Database,
  // any active session on any device/browser for that member will immediately be logged out in real time.
  useEffect(() => {
    if (!isFirebaseConnected || !authSession) return;

    const currentUserInDb = users.find((u) => u.id === authSession.id);

    // 1. Account not found in DB (deleted)
    if (!currentUserInDb) {
      logout();
      return;
    }

    // 2. Account disabled by Admin
    if (currentUserInDb.disabled || currentUserInDb.status === 'disabled') {
      logout();
      return;
    }

    // 3. Password reset by Admin (firstLoginCompleted set back to false)
    if (currentUserInDb.firstLoginCompleted === false) {
      logout();
      return;
    }

    // 4. Password hash changed in DB (password reset or changed on another device)
    if (currentUserInDb.password && authSession.password && currentUserInDb.password !== authSession.password) {
      logout();
      return;
    }

    // 5. Account attributes changed (e.g. role, name, specializations) -> synchronize local authSession
    if (
      currentUserInDb.name !== authSession.name ||
      currentUserInDb.role !== authSession.role ||
      currentUserInDb.account !== authSession.account ||
      JSON.stringify(currentUserInDb.specializations || []) !== JSON.stringify(authSession.specializations || [])
    ) {
      setAuthSession(currentUserInDb);
      try {
        localStorage.setItem(LOCAL_STORAGE_AUTH, JSON.stringify(currentUserInDb));
      } catch (e) {
        console.error('Failed to sync auth session', e);
      }
    }
  }, [users, authSession, isFirebaseConnected]);

  // Real-time Notifications Listener & FCM Auto-Registration
  useEffect(() => {
    if (!isFirebaseConnected || !authSession) {
      setNotifications([]);
      return;
    }

    // Check if browser notification permission is already granted and ensure Service Worker is active
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/firebase-messaging-sw.js', { scope: '/' })
          .catch(console.error);
      }
      if ('Notification' in window) {
        setIsPushEnabled(Notification.permission === 'granted');
        if (Notification.permission === 'granted') {
          registerDeviceForPushNotifications(authSession.account).catch(console.error);
        }
      }
    }

    const userAcc = authSession.account;
    const lowerAcc = userAcc.toLowerCase();
    let isInitial = true;

    let rawNotifs1: Record<string, AppNotification> = {};
    let rawNotifs2: Record<string, AppNotification> = {};

    const processAndSetNotifications = () => {
      const merged = { ...rawNotifs1, ...rawNotifs2 };
      const rawList = Object.values(merged) as AppNotification[];
      const seenIds = new Set<string>();
      const seenSignatures = new Set<string>();
      const list: AppNotification[] = [];

      rawList.forEach((n) => {
        if (!n || !n.id) return;
        if (seenIds.has(n.id)) return;
        seenIds.add(n.id);

        const timeWindow = Math.floor(new Date(n.createdAt).getTime() / 3000);
        const signature = `${(n.targetAccount || '').toLowerCase()}_${n.title}_${n.body}_${n.taskId || ''}_${timeWindow}`;
        if (seenSignatures.has(signature)) return;
        seenSignatures.add(signature);

        list.push(n);
      });

      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // If a new unread notification arrives in real-time
      if (!isInitial && list.length > 0) {
        const latest = list[0];
        const isRecent =
          new Date(latest.createdAt).getTime() > Date.now() - 15000;
        const isSelf =
          latest.senderAccount &&
          authSession?.account &&
          latest.senderAccount.trim().toLowerCase() === authSession.account.trim().toLowerCase();
        if (!latest.isRead && isRecent && !isSelf) {
          playNotificationChime();
          showLocalBrowserNotification(
            latest.title,
            latest.body,
            latest.url || (latest.taskId ? `/?openTaskId=${latest.taskId}` : '/'),
            latest.taskId ? `task-${latest.taskId}` : latest.id
          );
        }
      }

      setNotifications(list);
    };

    const notifRef1 = ref(database, `${DB_ROOT_NODE}/notifications/${userAcc}`);
    const unsubscribe1 = onValue(
      notifRef1,
      (snapshot) => {
        rawNotifs1 = snapshot.val() || {};
        processAndSetNotifications();
        isInitial = false;
      },
      (err) => {
        console.warn('Notifications listener warning:', err);
      }
    );

    let unsubscribe2 = () => {};
    if (lowerAcc !== userAcc) {
      const notifRef2 = ref(database, `${DB_ROOT_NODE}/notifications/${lowerAcc}`);
      unsubscribe2 = onValue(
        notifRef2,
        (snapshot) => {
          rawNotifs2 = snapshot.val() || {};
          processAndSetNotifications();
        },
        (err) => {
          console.warn('Notifications lower listener warning:', err);
        }
      );
    }

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [isFirebaseConnected, authSession]);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const markNotificationAsRead = async (notifId: string) => {
    if (!authSession) return;
    const updated = notifications.map((n) =>
      n.id === notifId ? { ...n, isRead: true } : n
    );
    setNotifications(updated);
    if (isFirebaseConnected) {
      update(
        ref(database, `${DB_ROOT_NODE}/notifications/${authSession.account}/${notifId}`),
        { isRead: true }
      ).catch(console.error);

      if (authSession.account.toLowerCase() !== authSession.account) {
        update(
          ref(database, `${DB_ROOT_NODE}/notifications/${authSession.account.toLowerCase()}/${notifId}`),
          { isRead: true }
        ).catch(console.error);
      }
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!authSession) return;
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    setNotifications(updated);
    if (isFirebaseConnected) {
      const updatesObj: Record<string, any> = {};
      notifications.forEach((n) => {
        if (!n.isRead) {
          updatesObj[
            `${DB_ROOT_NODE}/notifications/${authSession.account}/${n.id}/isRead`
          ] = true;
          if (authSession.account.toLowerCase() !== authSession.account) {
            updatesObj[
              `${DB_ROOT_NODE}/notifications/${authSession.account.toLowerCase()}/${n.id}/isRead`
            ] = true;
          }
        }
      });
      if (Object.keys(updatesObj).length > 0) {
        update(ref(database), updatesObj).catch(console.error);
      }
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setIsPushEnabled(true);
      } else {
        setIsPushEnabled(false);
        return;
      }
    } catch (e) {
      console.warn('requestPermission error:', e);
      if (Notification.permission === 'granted') {
        setIsPushEnabled(true);
      }
    }

    if (authSession && Notification.permission === 'granted') {
      registerDeviceForPushNotifications(authSession.account).catch(console.error);
    }
  };

  const seedFirebaseMockData = async () => {
    try {
      const usersObj: Record<string, User> = {};
      INITIAL_USERS.forEach((u) => { usersObj[u.id] = u; });

      const rolesObj: Record<string, RoleItem> = {};
      DEFAULT_ROLES.forEach((r) => { rolesObj[r.id] = r; });

      await set(ref(database, `${DB_ROOT_NODE}`), {
        users: usersObj,
        roles: rolesObj,
      });
    } catch (e) {
      console.error('Failed to seed Firebase data', e);
    }
  };

  // Auth Operations
  const login = async (accountInput: string, passwordInput?: string): Promise<LoginResult> => {
    const targetUser = users.find(
      (u) => u.account.toLowerCase() === accountInput.trim().toLowerCase()
    );

    if (!targetUser) {
      return { success: false, error: 'Không tìm thấy tên tài khoản trong hệ thống.' };
    }

    if (targetUser.disabled || targetUser.status === 'disabled') {
      return { success: false, error: 'Tài khoản này đã bị vô hiệu hóa (Disabled). Vui lòng liên hệ Admin.' };
    }

    if (!passwordInput || !passwordInput.trim()) {
      return { success: false, error: 'Vui lòng nhập mật khẩu (Mật khẩu tạm thời do Admin cấp hoặc mật khẩu chính thức).' };
    }

    if (!targetUser.password) {
      return { success: false, error: 'Tài khoản chưa có mật khẩu khởi tạo. Vui lòng liên hệ Admin để nhận mật khẩu tạm thời.' };
    }

    const isMatch = await verifyPassword(passwordInput, targetUser.password);
    if (!isMatch) {
      return { success: false, error: 'Mật khẩu không chính xác.' };
    }

    // If first-time login with temporary password
    if (!targetUser.firstLoginCompleted) {
      return { success: true, firstTime: true, user: targetUser };
    }

    // Auto-migrate legacy plain text password to SHA-256 hash in Firebase
    const hashedPass = await hashPassword(passwordInput);
    if (targetUser.password !== hashedPass) {
      const migratedUser = { ...targetUser, password: hashedPass };
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? migratedUser : u)));
      await set(ref(database, `${DB_ROOT_NODE}/users/${targetUser.id}`), migratedUser);
      setAuthSession(migratedUser);
      localStorage.setItem(LOCAL_STORAGE_AUTH, JSON.stringify(migratedUser));
      return { success: true, user: migratedUser };
    }

    setAuthSession(targetUser);
    localStorage.setItem(LOCAL_STORAGE_AUTH, JSON.stringify(targetUser));
    return { success: true, user: targetUser };
  };

  const setupFirstTimePassword = async (userId: string, newPassword: string): Promise<boolean> => {
    try {
      const updatedUser = users.find((u) => u.id === userId);
      if (!updatedUser) return false;

      const hashedPassword = await hashPassword(newPassword);
      const newUser: User = {
        ...updatedUser,
        password: hashedPassword,
        tempPassword: '',
        firstLoginCompleted: true,
      };

      setUsers((prev) => prev.map((u) => (u.id === userId ? newUser : u)));
      setAuthSession(newUser);
      localStorage.setItem(LOCAL_STORAGE_AUTH, JSON.stringify(newUser));

      await set(ref(database, `${DB_ROOT_NODE}/users/${userId}`), newUser);
      return true;
    } catch (e) {
      console.error('Failed to set password', e);
      return false;
    }
  };

  const changePassword = async (
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser) {
        return { success: false, error: 'Không tìm thấy thông tin tài khoản.' };
      }

      // If user already has a password, verify current password with secure hashing
      if (targetUser.password) {
        const isCurrentMatch = await verifyPassword(currentPassword, targetUser.password);
        if (!isCurrentMatch) {
          return { success: false, error: 'Mật khẩu hiện tại không chính xác.' };
        }
      }

      if (!newPassword || newPassword.length < 4) {
        return { success: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' };
      }

      const hashedNewPassword = await hashPassword(newPassword);
      const updatedUser: User = {
        ...targetUser,
        password: hashedNewPassword,
        firstLoginCompleted: true,
      };

      setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));
      if (authSession?.id === userId) {
        setAuthSession(updatedUser);
        localStorage.setItem(LOCAL_STORAGE_AUTH, JSON.stringify(updatedUser));
      }

      await set(ref(database, `${DB_ROOT_NODE}/users/${userId}`), updatedUser);
      return { success: true };
    } catch (e: any) {
      console.error('Failed to change password', e);
      return { success: false, error: e?.message || 'Có lỗi xảy ra khi đổi mật khẩu.' };
    }
  };

  const logout = () => {
    setAuthSession(null);
    localStorage.removeItem(LOCAL_STORAGE_AUTH);
  };

  // Permission Checks:
  // Leader/Advisor of task's specific team, Admin, PM, or the task's assignee/supporter can edit task
  const canEditTask = (task: Task, user: User | null = authSession): boolean => {
    if (!user) return false;
    if (user.role === 'Admin' || isUserPM(user)) return true;
    const roleInTaskSpec = getUserRoleInSpec(user, task.role);
    if (roleInTaskSpec === 'Leader' || roleInTaskSpec === 'Advisor') return true;
    const isAssignee = Boolean(task.assigneeAccount && task.assigneeAccount.toLowerCase() === user.account.toLowerCase());
    const isSupporter = Boolean(task.supporterAccounts && task.supporterAccounts.some((s) => s.toLowerCase() === user.account.toLowerCase()));
    return isAssignee || isSupporter;
  };

  // REPORT PERMISSION: ASSIGNEE OR SUPPORTERS CAN REPORT THIS TASK!
  const canReportTask = (task: Task, user: User | null = authSession): boolean => {
    if (!user) return false;
    const isAssignee = Boolean(task.assigneeAccount && task.assigneeAccount.toLowerCase() === user.account.toLowerCase());
    const isSupporter = Boolean(task.supporterAccounts && task.supporterAccounts.some((s) => s.toLowerCase() === user.account.toLowerCase()));
    return isAssignee || isSupporter;
  };

  // Helper: remove undefined values so Firebase doesn't reject the payload
  // Note: <T,> trailing comma is required in .tsx to disambiguate from JSX
  const sanitizeForFirebase = <T,>(data: T): T =>
    JSON.parse(JSON.stringify(data, (_, v) => (v === undefined ? null : v)));

  const syncUsersToFirebase = async (newUsers: User[]) => {
    const obj: Record<string, User> = {};
    newUsers.forEach((u) => { obj[u.id] = sanitizeForFirebase(u); });
    await set(ref(database, `${DB_ROOT_NODE}/users`), obj);
  };

  const syncMilestonesToFirebase = async (newMs: Milestone[]) => {
    const obj: Record<string, Milestone> = {};
    newMs.forEach((m) => { obj[m.id] = sanitizeForFirebase(m); });
    await set(ref(database, `${DB_ROOT_NODE}/milestones`), obj);
  };

  const saveTaskToFirebase = async (task: Task) => {
    const clean = sanitizeForFirebase(task);
    await set(ref(database, `${DB_ROOT_NODE}/tasks/${task.id}`), clean);
  };

  const updateTaskInFirebase = async (taskId: string, updates: Partial<Task>) => {
    const clean = sanitizeForFirebase(updates);
    await update(ref(database, `${DB_ROOT_NODE}/tasks/${taskId}`), clean);
  };

  const deleteTaskFromFirebase = async (taskId: string, deletedBy?: string) => {
    const author = deletedBy || authSession?.account || 'user';
    const tombstone = {
      id: taskId,
      deletedAt: new Date().toISOString(),
      deletedBy: author,
    };
    addDeletedTaskId(taskId);
    await set(ref(database, `${DB_ROOT_NODE}/deletedTasks/${taskId}`), tombstone);
    await remove(ref(database, `${DB_ROOT_NODE}/tasks/${taskId}`));
  };

  const deleteMultipleTasksFromFirebase = async (taskIds: string[], deletedBy?: string) => {
    if (!taskIds || taskIds.length === 0) return;
    const author = deletedBy || authSession?.account || 'user';
    const nowIso = new Date().toISOString();
    const updatesObj: Record<string, any> = {};
    taskIds.forEach((id) => {
      updatesObj[`${DB_ROOT_NODE}/tasks/${id}`] = null;
      updatesObj[`${DB_ROOT_NODE}/deletedTasks/${id}`] = {
        id,
        deletedAt: nowIso,
        deletedBy: author,
      };
      addDeletedTaskId(id);
    });
    await update(ref(database), updatesObj);
  };

  const syncTasksToFirebase = async (newTs: Task[]) => {
    if (!newTs || newTs.length === 0) return;
    const updatesObj: Record<string, any> = {};
    newTs.forEach((t) => {
      updatesObj[`${DB_ROOT_NODE}/tasks/${t.id}`] = sanitizeForFirebase(t);
    });
    await update(ref(database), updatesObj);
  };

  const syncArchivesToFirebase = async (archives: WeeklyHistoryArchive[]) => {
    const obj: Record<string, WeeklyHistoryArchive> = {};
    archives.forEach((a) => { obj[a.id] = sanitizeForFirebase(a); });
    await set(ref(database, `${DB_ROOT_NODE}/weeklyArchives`), obj);
  };

  const syncRolesToFirebase = async (newRoles: RoleItem[]) => {
    const obj: Record<string, RoleItem> = {};
    newRoles.forEach((r) => { obj[r.id] = sanitizeForFirebase(r); });
    await set(ref(database, `${DB_ROOT_NODE}/roles`), obj);
  };

  // User Management
  const addUser = async (userData: Omit<User, 'id'>): Promise<{ user: User; tempPassword: string }> => {
    const tempPassword = generateTemporaryPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const newUser: User = {
      ...userData,
      id: `usr-${Date.now()}`,
      password: hashedPassword,
      tempPassword: tempPassword,
      firstLoginCompleted: false,
      disabled: false,
      status: 'active',
    };
    const updated = [...users, newUser];
    setUsers(updated);
    await syncUsersToFirebase(updated);
    return { user: newUser, tempPassword };
  };

  const resetUserPassword = async (userId: string): Promise<{ success: boolean; tempPassword?: string; error?: string }> => {
    try {
      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser) return { success: false, error: 'Không tìm thấy thông tin tài khoản.' };

      const tempPassword = generateTemporaryPassword();
      const hashedPassword = await hashPassword(tempPassword);
      const updatedUser: User = {
        ...targetUser,
        password: hashedPassword,
        tempPassword: tempPassword,
        firstLoginCompleted: false,
      };

      const updated = users.map((u) => (u.id === userId ? updatedUser : u));
      setUsers(updated);
      await syncUsersToFirebase(updated);
      return { success: true, tempPassword };
    } catch (e) {
      console.error('Failed to reset user password', e);
      return { success: false, error: 'Không thể tạo mật khẩu tạm thời mới.' };
    }
  };

  const resetAllUninitializedPasswords = async (): Promise<{
    count: number;
    newlyGeneratedCount: number;
    results: { id: string; name: string; account: string; tempPassword: string; isNewlyGenerated: boolean }[];
  }> => {
    try {
      const pendingUsers = users.filter((u) => {
        const isDisabled = u.disabled || u.status === 'disabled';
        if (isDisabled) return false;
        const hasOfficialPass = u.password && u.password.trim() !== '' && u.firstLoginCompleted === true;
        return !hasOfficialPass;
      });

      if (pendingUsers.length === 0) {
        return { count: 0, newlyGeneratedCount: 0, results: [] };
      }

      const results: { id: string; name: string; account: string; tempPassword: string; isNewlyGenerated: boolean }[] = [];
      const updatedMap = new Map<string, User>();
      let newlyGeneratedCount = 0;

      for (const u of pendingUsers) {
        // If user already has a temporary password, retain it! Do not regenerate.
        if (u.tempPassword && u.tempPassword.trim() !== '') {
          results.push({
            id: u.id,
            name: u.name,
            account: u.account,
            tempPassword: u.tempPassword,
            isNewlyGenerated: false,
          });
        } else {
          // Generate new temporary password for those who do not have one
          const tempPassword = generateTemporaryPassword();
          const hashedPassword = await hashPassword(tempPassword);
          const updatedUser: User = {
            ...u,
            password: hashedPassword,
            tempPassword: tempPassword,
            firstLoginCompleted: false,
          };
          updatedMap.set(u.id, updatedUser);
          newlyGeneratedCount++;
          results.push({
            id: u.id,
            name: u.name,
            account: u.account,
            tempPassword: tempPassword,
            isNewlyGenerated: true,
          });
        }
      }

      if (updatedMap.size > 0) {
        const newUsers = users.map((u) => updatedMap.get(u.id) || u);
        setUsers(newUsers);
        await syncUsersToFirebase(newUsers);
      }

      return { count: results.length, newlyGeneratedCount, results };
    } catch (e) {
      console.error('Failed to batch issue passwords', e);
      return { count: 0, newlyGeneratedCount: 0, results: [] };
    }
  };

  const updateUser = (id: string, userData: Partial<User>) => {
    const updated = users.map((u) => (u.id === id ? { ...u, ...userData } : u));
    setUsers(updated);
    if (authSession?.id === id) {
      const newAuth = { ...authSession, ...userData };
      setAuthSession(newAuth);
      localStorage.setItem(LOCAL_STORAGE_AUTH, JSON.stringify(newAuth));
    }
    syncUsersToFirebase(updated);
  };

  const batchImportUsers = async (
    items: {
      member: {
        name: string;
        cccd: string;
        bankAccount: string;
        email: string;
        phone: string;
        account: string;
        role: UserRole;
        specializations: Specialization[];
        technologies: string;
        birthDate: string;
      };
      existingUserId?: string;
    }[]
  ): Promise<{
    createdCount: number;
    updatedCount: number;
    newCredentials: { id: string; name: string; account: string; tempPassword: string; isNewlyGenerated: boolean }[];
  }> => {
    try {
      let currentUsersList = [...users];
      let createdCount = 0;
      let updatedCount = 0;
      const newCredentials: { id: string; name: string; account: string; tempPassword: string; isNewlyGenerated: boolean }[] = [];

      for (const item of items) {
        const m = item.member;
        let existingUser: User | undefined;

        if (item.existingUserId) {
          existingUser = currentUsersList.find((u) => u.id === item.existingUserId);
        } else {
          const cleanAcc = m.account.toLowerCase();
          existingUser = currentUsersList.find(
            (u) =>
              (cleanAcc && u.account.toLowerCase() === cleanAcc) ||
              (m.email && u.email && u.email.toLowerCase() === m.email.toLowerCase()) ||
              (m.phone && u.phone && u.phone === m.phone) ||
              (m.cccd && u.cccd && u.cccd === m.cccd)
          );
        }

        if (existingUser) {
          // Update existing user
          const updatedUser: User = {
            ...existingUser,
            name: m.name || existingUser.name,
            account: m.account || existingUser.account,
            role: m.role || existingUser.role,
            specializations: m.specializations.length > 0 ? m.specializations : existingUser.specializations,
            cccd: m.cccd || existingUser.cccd,
            bankAccount: m.bankAccount || existingUser.bankAccount,
            email: m.email || existingUser.email,
            phone: m.phone || existingUser.phone,
            technologies: m.technologies || existingUser.technologies,
            birthDate: m.birthDate ? Number(m.birthDate) || m.birthDate : existingUser.birthDate,
            status: 'active',
            disabled: false,
          };
          currentUsersList = currentUsersList.map((u) => (u.id === existingUser!.id ? updatedUser : u));
          updatedCount++;
        } else {
          // Create new user
          const tempPassword = generateTemporaryPassword();
          const hashedPassword = await hashPassword(tempPassword);
          const newUserId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const newUser: User = {
            id: newUserId,
            name: m.name || 'Thành viên mới',
            account: m.account || `user${Math.floor(1000 + Math.random() * 9000)}`,
            role: m.role || 'Member',
            specializations: m.specializations.length > 0 ? m.specializations : ['BA'],
            cccd: m.cccd || '',
            bankAccount: m.bankAccount || '',
            email: m.email || '',
            phone: m.phone || '',
            technologies: m.technologies || '',
            birthDate: m.birthDate ? Number(m.birthDate) || m.birthDate : undefined,
            password: hashedPassword,
            tempPassword: tempPassword,
            firstLoginCompleted: false,
            disabled: false,
            status: 'active',
          };
          currentUsersList.push(newUser);
          createdCount++;
          newCredentials.push({
            id: newUser.id,
            name: newUser.name,
            account: newUser.account,
            tempPassword: tempPassword,
            isNewlyGenerated: true,
          });
        }
      }

      setUsers(currentUsersList);
      await syncUsersToFirebase(currentUsersList);

      return { createdCount, updatedCount, newCredentials };
    } catch (e) {
      console.error('Failed to batch import users', e);
      return { createdCount: 0, updatedCount: 0, newCredentials: [] };
    }
  };

  // Delete User & Unassign User Tasks (Soft-delete: set disabled status in DB, hide from UI)
  const deleteUser = (id: string) => {
    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) return;

    const updatedUsers = users.map((u) =>
      u.id === id ? { ...u, disabled: true, status: 'disabled' as const } : u
    );
    setUsers(updatedUsers);
    syncUsersToFirebase(updatedUsers);

    // Unassign tasks assigned to deleted user (set assigneeAccount = "" -> Task trống)
    const updatedTasks = tasks.map((t) => {
      if (t.assigneeAccount.toLowerCase() === targetUser.account.toLowerCase()) {
        return {
          ...t,
          assigneeAccount: '',
          updatedAt: new Date().toISOString(),
        };
      }
      return t;
    });
    setTasks(updatedTasks);
    saveLocalTasksCache(updatedTasks);
    const affectedTasks = updatedTasks.filter((t) => t.assigneeAccount === '' && tasks.find(ot => ot.id === t.id)?.assigneeAccount !== '');
    if (affectedTasks.length > 0) {
      syncTasksToFirebase(affectedTasks).catch(console.error);
    }

    // If deleting currently logged in user, log out
    if (authSession?.id === id) {
      logout();
    }
  };

  // Role Management (CRUD)
  const addRole = (roleData: Omit<RoleItem, 'id'>) => {
    const cleanCode = roleData.code.trim().toUpperCase();
    const newRole: RoleItem = {
      ...roleData,
      code: cleanCode,
      name: roleData.name.trim(),
      id: `role-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`,
      order: roles.length + 1,
      createdAt: new Date().toISOString(),
    };
    const updated = [...roles, newRole];
    setRoles(updated);
    syncRolesToFirebase(updated);
  };

  const updateRole = (id: string, updates: Partial<RoleItem>) => {
    const oldRole = roles.find((r) => r.id === id);
    const updated = roles.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          ...updates,
          code: updates.code ? updates.code.trim().toUpperCase() : r.code,
          name: updates.name ? updates.name.trim() : r.name,
        };
      }
      return r;
    });
    setRoles(updated);
    syncRolesToFirebase(updated);

    // If role code changed, cascade update users' specializations and tasks' role
    const newCode = updates.code ? updates.code.trim().toUpperCase() : undefined;
    if (oldRole && newCode && newCode !== oldRole.code) {
      const oldCode = oldRole.code;

      // Update users' specializations
      const updatedUsers = users.map((u) => {
        if (u.specializations && u.specializations.includes(oldCode)) {
          return {
            ...u,
            specializations: u.specializations.map((s) => (s === oldCode ? newCode : s)),
          };
        }
        return u;
      });
      setUsers(updatedUsers);
      syncUsersToFirebase(updatedUsers);

      // Update tasks' role
      const updatedTasks = tasks.map((t) => (t.role === oldCode ? { ...t, role: newCode } : t));
      setTasks(updatedTasks);
      saveLocalTasksCache(updatedTasks);
      const affectedTasks = updatedTasks.filter((t) => t.role === newCode);
      if (affectedTasks.length > 0) {
        syncTasksToFirebase(affectedTasks).catch(console.error);
      }
    }
  };

  const deleteRole = (id: string) => {
    const targetRole = roles.find((r) => r.id === id);
    if (!targetRole) return;

    const roleCode = targetRole.code;
    const updatedRoles = roles.filter((r) => r.id !== id);
    setRoles(updatedRoles);
    syncRolesToFirebase(updatedRoles);

    // Remove role from users' specializations (fallback to remaining or first available role)
    const fallbackRoleCode = updatedRoles[0]?.code || 'BA';
    const updatedUsers = users.map((u) => {
      if (u.specializations && u.specializations.includes(roleCode)) {
        const remaining = u.specializations.filter((s) => s !== roleCode);
        return {
          ...u,
          specializations: remaining.length > 0 ? remaining : [fallbackRoleCode],
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    syncUsersToFirebase(updatedUsers);
  };

  // Resource Management
  const addResource = (resItem: Omit<ProjectResource, 'id' | 'order'>) => {
    const id = `res_${Date.now()}`;
    const newRes: ProjectResource = {
      ...resItem,
      id,
      order: resources.length + 1,
      createdAt: new Date().toISOString(),
    };
    const updated = [...resources, newRes];
    setResources(updated);
    set(ref(database, `${DB_ROOT_NODE}/resources/${id}`), newRes).catch(console.error);
  };

  const updateResource = (id: string, updates: Partial<ProjectResource>) => {
    const updated = resources.map((r) =>
      r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
    );
    setResources(updated);
    const target = updated.find((r) => r.id === id);
    if (target) {
      set(ref(database, `${DB_ROOT_NODE}/resources/${id}`), target).catch(console.error);
    }
  };

  const deleteResource = (id: string) => {
    const updated = resources.filter((r) => r.id !== id);
    setResources(updated);
    set(ref(database, `${DB_ROOT_NODE}/resources/${id}`), null).catch(console.error);
  };

  // Milestone Management
  const addMilestone = (milestoneData: Omit<Milestone, 'id' | 'order'>) => {
    const targetRole = milestoneData.role && milestoneData.role !== 'ALL' ? milestoneData.role : 'Design';
    const currentRoleMs = milestones.filter((m) => (m.role || 'Design') === targetRole);
    const newMilestone: Milestone = {
      ...milestoneData,
      role: targetRole,
      id: `ms-${Date.now()}`,
      order: currentRoleMs.length + 1,
    };
    const updated = [...milestones, newMilestone];
    const { renumbered } = renumberMilestonesByRole(updated);
    setMilestones(renumbered);
    syncMilestonesToFirebase(renumbered);
  };

  const updateMilestone = (id: string, milestoneData: Partial<Milestone>) => {
    const updated = milestones.map((m) => (m.id === id ? { ...m, ...milestoneData } : m));
    const { renumbered } = renumberMilestonesByRole(updated);
    setMilestones(renumbered);
    syncMilestonesToFirebase(renumbered);
  };

  const deleteMilestone = (id: string) => {
    const updatedMs = milestones.filter((m) => m.id !== id);
    const tasksToDelete = tasks.filter((t) => t.milestoneId === id);
    const taskIdsToDelete = tasksToDelete.map((t) => t.id);
    const updatedTs = tasks.filter((t) => t.milestoneId !== id);
    const { renumbered } = renumberMilestonesByRole(updatedMs);
    setMilestones(renumbered);
    setTasks(updatedTs);
    saveLocalTasksCache(updatedTs);
    syncMilestonesToFirebase(renumbered);
    deleteMultipleTasksFromFirebase(taskIdsToDelete, authSession?.account).catch(console.error);
  };

  // Task Management
  const addTask = (taskData: Omit<Task, 'id' | 'orderInMilestone'>) => {
    const milestoneTasks = tasks.filter((t) => t.milestoneId === taskData.milestoneId);
    const nowIso = new Date().toISOString();
    const authorName = authSession?.name || 'Admin';
    const authorAccount = authSession?.account || 'Admin';
    const authorRole = authSession?.role || 'Admin';
    const creatorDisplay = `${authorName} (@${authorAccount})`;

    const initialLog: TaskActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      authorName,
      authorAccount,
      authorRole,
      actionType: 'CREATE',
      summary: 'Khởi tạo công việc mới',
    };

    const pct = taskData.completionPercentage || 0;
    let initialStatus: TaskStatus = taskData.status || 'To do';
    if (pct > 0 && pct < 100 && initialStatus === 'To do') {
      initialStatus = 'In Progress';
    } else if (pct >= 100) {
      initialStatus = 'Done';
    } else if (pct === 0 && initialStatus === 'Done') {
      initialStatus = 'To do';
    }

    const newTask: Task = {
      ...taskData,
      id: `tsk-${Date.now()}`,
      orderInMilestone: milestoneTasks.length + 1,
      status: initialStatus,
      estimatedEffort: Math.min(24, Math.max(0, taskData.estimatedEffort !== undefined ? Number(taskData.estimatedEffort) || 0 : 2)),
      actualEffort: Math.min(24, Math.max(0, Number(taskData.actualEffort) || 0)),
      completionPercentage: pct,
      weekNumber: taskData.weekNumber || selectedWeek,
      year: taskData.year || selectedYear,
      createdBy: taskData.createdBy || creatorDisplay,
      createdAt: taskData.createdAt || nowIso,
      updatedBy: creatorDisplay,
      updatedAt: nowIso,
      priority: taskData.priority || 'Medium',
      activityLogs: [initialLog],
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    saveLocalTasksCache(updated);
    saveTaskToFirebase(newTask).catch(console.error);

    // Push notification to assigned member (only if assigned to someone else)
    if (newTask.assigneeAccount) {
      const isSelf =
        newTask.assigneeAccount.trim().toLowerCase() ===
        (authSession?.account || '').trim().toLowerCase();
      if (!isSelf) {
        sendPushNotification({
          targetAccount: newTask.assigneeAccount,
          title: `📋 Bạn có task mới từ @${authSession?.account || 'Leader'}`,
          body: `[${newTask.role || 'Task'}] ${newTask.title}`,
          taskId: newTask.id,
          senderAccount: authSession?.account,
          senderName: authSession?.name,
          type: 'TASK_ASSIGNED',
        });
      }
    }
  };

  const updateTask = (id: string, updates: Partial<Task>, options?: { skipLog?: boolean }) => {
    const nowIso = new Date().toISOString();
    const authorName = authSession?.name || 'Thành viên';
    const authorAccount = authSession?.account || 'member';
    const authorRole = authSession?.role || 'Member';
    const updaterDisplay = `${authorName} (@${authorAccount})`;

    let targetTaskUpdated: Task | null = null;

    const updated = tasks.map((t) => {
      if (t.id !== id) return t;

      if (updates.estimatedEffort !== undefined) {
        updates.estimatedEffort = Math.min(24, Math.max(0, Number(updates.estimatedEffort) || 0));
      }
      if (updates.actualEffort !== undefined) {
        updates.actualEffort = Math.min(24, Math.max(0, Number(updates.actualEffort) || 0));
      }

      // If completionPercentage is explicitly set to 0 or is 0, ensure actualEffort is 0 and status is To do (cannot be Done)
      const effectivePct = updates.completionPercentage !== undefined ? updates.completionPercentage : (t.completionPercentage || 0);
      let nextStatus: TaskStatus = updates.status || t.status || 'To do';
      if (effectivePct === 0) {
        updates.actualEffort = 0;
        if (nextStatus === 'Done') {
          nextStatus = 'To do';
        }
      } else if (effectivePct >= 100) {
        nextStatus = 'Done';
      } else if (effectivePct > 0 && effectivePct < 100) {
        if (nextStatus === 'To do') {
          nextStatus = 'In Progress';
        }
      }
      updates.status = nextStatus;

      // Auto start date / end date handling when not explicitly provided
      const todayStr = getTodayDateOnlyString(simulatedTime);
      if (effectivePct > 0 || nextStatus === 'In Progress') {
        if (updates.startDate === undefined && !t.startDate) {
          updates.startDate = todayStr;
        }
      }
      if (effectivePct >= 100 || nextStatus === 'Done') {
        if (updates.startDate === undefined && !t.startDate) {
          updates.startDate = todayStr;
        }
        if (updates.endDate === undefined && !t.endDate) {
          updates.endDate = todayStr;
        }
      }

      if (options?.skipLog) {
        targetTaskUpdated = {
          ...t,
          ...updates,
          updatedAt: nowIso,
          updatedBy: updaterDisplay,
        };
        return targetTaskUpdated;
      }

      const changes: string[] = [];
      if (updates.status && updates.status !== t.status) {
        changes.push(`Trạng thái: "${t.status}" ➔ "${updates.status}"`);
      }
      if (updates.completionPercentage !== undefined && updates.completionPercentage !== t.completionPercentage) {
        changes.push(`Tiến độ: ${t.completionPercentage}% ➔ ${updates.completionPercentage}%`);
      }
      if (updates.actualEffort !== undefined && updates.actualEffort !== t.actualEffort) {
        changes.push(`Effort thực tế: ${t.actualEffort}h ➔ ${updates.actualEffort}h`);
      }
      if (updates.estimatedEffort !== undefined && updates.estimatedEffort !== t.estimatedEffort) {
        changes.push(`Effort ước tính: ${t.estimatedEffort}h ➔ ${updates.estimatedEffort}h`);
      }
      if (updates.startDate !== undefined && updates.startDate !== t.startDate) {
        changes.push(`Ngày bắt đầu: "${formatDateOnlyDisplay(t.startDate) || 'Chưa đặt'}" ➔ "${formatDateOnlyDisplay(updates.startDate) || 'Chưa đặt'}"`);
      }
      if (updates.endDate !== undefined && updates.endDate !== t.endDate) {
        changes.push(`Ngày hoàn thành: "${formatDateOnlyDisplay(t.endDate) || 'Chưa đặt'}" ➔ "${formatDateOnlyDisplay(updates.endDate) || 'Chưa đặt'}"`);
      }
      if (updates.assigneeAccount !== undefined && updates.assigneeAccount !== t.assigneeAccount) {
        changes.push(`Người phụ trách: ${t.assigneeAccount || 'Chưa gán'} ➔ ${updates.assigneeAccount || 'Chưa gán'}`);
      }
      if (updates.priority && updates.priority !== t.priority) {
        changes.push(`Độ ưu tiên: ${t.priority || 'Medium'} ➔ ${updates.priority}`);
      }
      if (updates.description !== undefined && updates.description !== t.description) {
        changes.push(`Cập nhật mô tả & hướng dẫn kỹ thuật`);
      }
      if (updates.title && updates.title !== t.title) {
        changes.push(`Đổi tiêu đề: "${updates.title}"`);
      }
      if (updates.notes !== undefined && updates.notes !== t.notes) {
        changes.push(`Cập nhật ghi chú trao đổi`);
      }
      if (updates.role && updates.role !== t.role) {
        changes.push(`Chuyên môn (Role): ${t.role} ➔ ${updates.role}`);
      }
      if (updates.assignmentRequestStatus && updates.assignmentRequestStatus !== t.assignmentRequestStatus) {
        if (updates.assignmentRequestStatus === 'PENDING') {
          changes.push(`Yêu cầu nhận task bởi @${updates.assignmentRequestedBy || authorAccount}`);
        } else if (updates.assignmentRequestStatus === 'APPROVED') {
          changes.push(`Duyệt phân công task cho @${t.assignmentRequestedBy || t.assigneeAccount}`);
        } else if (updates.assignmentRequestStatus === 'REJECTED') {
          changes.push(`Từ chối yêu cầu nhận task`);
        }
      }

      const summary = changes.length > 0 ? changes.join(' • ') : 'Cập nhật thông tin task';
      const logEntry: TaskActivityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowIso,
        authorName,
        authorAccount,
        authorRole,
        actionType: 'GENERAL_UPDATE',
        summary,
      };

      const existingLogs = Array.isArray(t.activityLogs) ? t.activityLogs : [];

      targetTaskUpdated = {
        ...t,
        ...updates,
        updatedAt: nowIso,
        updatedBy: updaterDisplay,
        activityLogs: [logEntry, ...existingLogs],
      };
      return targetTaskUpdated;
    });

    setTasks(updated);
    saveLocalTasksCache(updated);
    if (targetTaskUpdated) {
      saveTaskToFirebase(targetTaskUpdated).catch(console.error);

      // Also keep weeklyArchives snapshot synchronized if task is archived
      const finalTask: Task = targetTaskUpdated;
      const hasArchiveMatch = weeklyArchives.some((a) =>
        a.tasksSnapshot?.some((st) => st.id === id)
      );
      if (hasArchiveMatch) {
        const updatedArchives = weeklyArchives.map((a) => {
          if (!a.tasksSnapshot?.some((st) => st.id === id)) return a;
          return {
            ...a,
            tasksSnapshot: a.tasksSnapshot.map((st) =>
              st.id === id ? { ...st, ...finalTask } : st
            ),
          };
        });
        setWeeklyArchives(updatedArchives);
        syncArchivesToFirebase(updatedArchives).catch(console.error);
      }
    }

    // Push notification if assignee was changed or assigned
    const currentTask = tasks.find((t) => t.id === id);
    if (
      updates.assigneeAccount &&
      currentTask &&
      updates.assigneeAccount !== currentTask.assigneeAccount
    ) {
      const isSelf =
        updates.assigneeAccount.trim().toLowerCase() ===
        (authSession?.account || '').trim().toLowerCase();
      if (!isSelf) {
        sendPushNotification({
          targetAccount: updates.assigneeAccount,
          title: `🔄 Bạn được giao task từ @${authSession?.account || 'Leader'}`,
          body: `[${currentTask.role || 'Task'}] ${currentTask.title}`,
          taskId: id,
          senderAccount: authSession?.account,
          senderName: authSession?.name,
          type: 'TASK_ASSIGNED',
        });
      }
    }
  };

  const updateTaskNotes = (taskId: string, notes: string, options?: UpdateTaskNotesOptions) => {
    const task = tasks.find((t) => t.id === taskId);
    const rootId = task?.parentTaskId || taskId;
    const relatedTasks = tasks.filter((t) => t.id === taskId || t.id === rootId || t.parentTaskId === rootId);
    relatedTasks.forEach((t) => {
      updateTask(t.id, { notes }, { skipLog: t.id !== taskId });
      markNoteAsRead(t.id, notes);
    });

    // If this is a recall, edit, or explicit skip -> DO NOT dispatch any notifications!
    if (options?.skipNotification || options?.isRecall || options?.isEdit) {
      return;
    }

    if (!task) return;

    const currentAccount = (authSession?.account || '').trim().toLowerCase();

    // Determine the exact new comment content
    let rawCommentText = '';
    if (options?.newCommentContent && options.newCommentContent.trim()) {
      rawCommentText = options.newCommentContent.trim();
    } else {
      const lastLine = notes.split('\n').filter(Boolean).pop() || '';
      const parsed = parseNoteLine(lastLine, authSession);
      // Safety check: only send notification if the last line was authored by the current user
      const isAuthoredByMe =
        parsed.isMyMessage ||
        (authSession?.name && parsed.baseAuthor.toLowerCase().includes(authSession.name.toLowerCase())) ||
        (authSession?.account && parsed.baseAuthor.toLowerCase().includes(authSession.account.toLowerCase()));

      if (!isAuthoredByMe) {
        return;
      }
      rawCommentText = parsed.messageBody.trim();
    }

    if (!rawCommentText) return;

    // Accounts newly tagged in this specific message
    const currentLineMentions = new Set(
      extractMentions(rawCommentText, users).map((a) => a.toLowerCase().trim())
    );

    // All participants in the discussion thread (assignee, creator, previous commenters, previously tagged)
    const allParticipants = extractDiscussionParticipants(notes, task, users);

    const alreadyNotified = new Set<string>();

    allParticipants.forEach((participantAcc) => {
      const lowerAcc = participantAcc.toLowerCase().trim();
      if (lowerAcc === currentAccount) return; // Don't notify the sender themselves
      if (alreadyNotified.has(lowerAcc)) return;

      alreadyNotified.add(lowerAcc);

      // If directly tagged in this latest message -> use mention notification style
      const isDirectlyTagged = currentLineMentions.has(lowerAcc);

      sendPushNotification({
        targetAccount: participantAcc,
        title: isDirectlyTagged
          ? `🏷️ @${authSession?.account || 'Thành viên'} đã nhắc tên bạn trong task`
          : `💬 @${authSession?.account || 'Thành viên'} vừa gửi phản hồi trong task`,
        body: `[${task.title}]: "${rawCommentText.slice(0, 80)}"`,
        taskId: taskId,
        senderAccount: authSession?.account,
        senderName: authSession?.name,
        type: 'TASK_NOTE',
      });
    });
  };

  const duplicateTask = (taskId: string): Task | undefined => {
    const taskToClone = tasks.find((t) => t.id === taskId);
    if (!taskToClone) return undefined;

    const nowIso = new Date().toISOString();
    const authorName = authSession?.name || 'Admin';
    const authorAccount = authSession?.account || 'Admin';
    const authorRole = authSession?.role || 'Admin';
    const creatorDisplay = `${authorName} (@${authorAccount})`;

    const initialLog: TaskActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      authorName,
      authorAccount,
      authorRole,
      actionType: 'CREATE',
      summary: `Khởi tạo bằng cách nhân bản từ task "${taskToClone.title}"`,
    };

    const milestoneTasks = taskToClone.milestoneId
      ? tasks.filter((t) => t.milestoneId === taskToClone.milestoneId)
      : [];

    const newTask: Task = {
      ...taskToClone,
      id: `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: `${taskToClone.title} (Copy)`,
      orderInMilestone: milestoneTasks.length + 1,
      status: 'To do',
      actualEffort: 0,
      completionPercentage: 0,
      lastSubmittedAt: undefined,
      notes: '',
      createdBy: creatorDisplay,
      createdAt: nowIso,
      updatedBy: creatorDisplay,
      updatedAt: nowIso,
      activityLogs: [initialLog],
    };

    const originalIndex = tasks.findIndex((t) => t.id === taskId);
    const updated = [...tasks];
    if (originalIndex >= 0) {
      updated.splice(originalIndex + 1, 0, newTask);
    } else {
      updated.push(newTask);
    }

    setTasks(updated);
    saveLocalTasksCache(updated);
    saveTaskToFirebase(newTask).catch(console.error);
    return newTask;
  };

  const deleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    saveLocalTasksCache(updated);
    deleteTaskFromFirebase(id, authSession?.account).catch(console.error);
  };

  const deleteTasks = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    const updated = tasks.filter((t) => !idSet.has(t.id));
    setTasks(updated);
    saveLocalTasksCache(updated);
    deleteMultipleTasksFromFirebase(ids, authSession?.account).catch(console.error);
  };

  const reorderTasksInMilestone = (milestoneId: string, orderedTaskIds: string[]) => {
    const affectedTasks: Task[] = [];
    const updated = tasks.map((task) => {
      if (task.milestoneId !== milestoneId) return task;
      const newIndex = orderedTaskIds.indexOf(task.id);
      if (newIndex !== -1) {
        const u = { ...task, orderInMilestone: newIndex + 1 };
        affectedTasks.push(u);
        return u;
      }
      return task;
    });
    setTasks(updated);
    saveLocalTasksCache(updated);
    syncTasksToFirebase(affectedTasks).catch(console.error);
  };

  // Submit Task Report
  const submitTaskReport = (
    taskId: string,
    actualEffort: number,
    completionPercentage: number,
    status: TaskStatus,
    notes?: string,
    extraDates?: { startDate?: string; endDate?: string },
    reportingMemberAccount?: string
  ) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    const weekNo = targetTask?.weekNumber || selectedWeek;
    const year = targetTask?.year || selectedYear;
    const sundayNoon = getWeekSundayNoon(weekNo, year);
    const deadline = getWeekDeadline(weekNo, year);
    const now = new Date(simulatedTime);
    const nowIso = new Date().toISOString();
    const todayStr = getTodayDateOnlyString(simulatedTime);

    const reportingAccount =
      reportingMemberAccount ||
      authSession?.account ||
      targetTask?.assigneeAccount ||
      'member';

    const estEffort = targetTask?.estimatedEffort || 0;

    // Handle memberEfforts map
    let nextMemberEfforts: Record<string, number> = { ...(targetTask?.memberEfforts || {}) };
    const hasExistingMemberEfforts = targetTask?.memberEfforts && Object.keys(targetTask.memberEfforts).length > 0;

    if (!hasExistingMemberEfforts) {
      if (targetTask?.assigneeAccount) {
        nextMemberEfforts[targetTask.assigneeAccount] = targetTask.actualEffort || 0;
      }
      if (targetTask?.supporterAccounts && Array.isArray(targetTask.supporterAccounts)) {
        targetTask.supporterAccounts.forEach((sup) => {
          if (sup && nextMemberEfforts[sup] === undefined) {
            nextMemberEfforts[sup] = 0;
          }
        });
      }
    }

    const prevMemberEffort = getMemberTaskEffort(targetTask, reportingAccount);

    if (completionPercentage === 0) {
      if (reportingAccount) {
        nextMemberEfforts[reportingAccount] = 0;
      }
    } else {
      const finalMemberEffort = Math.min(
        24,
        Math.max(
          0,
          actualEffort > 0
            ? actualEffort
            : estEffort
        )
      );
      if (reportingAccount) {
        nextMemberEfforts[reportingAccount] = finalMemberEffort;
      }
    }

    const hasCollaborators =
      (targetTask?.supporterAccounts && targetTask.supporterAccounts.length > 0) ||
      Object.keys(nextMemberEfforts).length > 1;

    let finalTotalActualEffort: number;
    if (completionPercentage === 0) {
      finalTotalActualEffort = 0;
    } else if (hasCollaborators) {
      finalTotalActualEffort = Math.round(
        Object.values(nextMemberEfforts).reduce((sum, val) => sum + (Number(val) || 0), 0) * 100
      ) / 100;
    } else {
      finalTotalActualEffort = Math.min(
        24,
        Math.max(0, actualEffort > 0 ? actualEffort : estEffort)
      );
    }

    const isSundayNoonOrLater = now.getTime() >= sundayNoon.getTime();
    const finalStatus: TaskStatus =
      completionPercentage === 0
        ? 'To do'
        : completionPercentage === 100
        ? 'Done'
        : isSundayNoonOrLater || status === 'Done'
        ? 'Done'
        : 'In Progress';

    const isDone = finalStatus === 'Done' || completionPercentage === 100;
    const isOfficialReport = isDone || isSundayNoonOrLater;
    const isLate = now.getTime() > deadline.getTime();

    const authorName = authSession?.name || 'Người phụ trách';
    const authorAccount = authSession?.account || 'member';
    const authorRole = authSession?.role || 'Member';
    const updaterDisplay = `${authorName} (@${authorAccount})`;

    let updatedReportTask: Task | null = null;

    const updated = tasks.map((t) => {
      if (t.id !== taskId) return t;

      // Determine final start & end dates
      let finalStartDate = t.startDate;
      if (extraDates?.startDate !== undefined) {
        finalStartDate = extraDates.startDate;
      } else if (completionPercentage > 0 && !finalStartDate) {
        finalStartDate = todayStr;
      } else if (completionPercentage === 0 && !extraDates) {
        finalStartDate = '';
      }

      let finalEndDate = t.endDate;
      if (extraDates?.endDate !== undefined) {
        finalEndDate = extraDates.endDate;
      } else if (isDone && !finalEndDate) {
        finalEndDate = todayStr;
      } else if (!isDone && extraDates?.endDate === undefined && completionPercentage < 100) {
        finalEndDate = completionPercentage === 0 ? '' : t.endDate;
      }

      const changes: string[] = [];
      if (finalStatus !== t.status) {
        changes.push(`Trạng thái: "${t.status}" ➔ "${finalStatus}"`);
      }
      if (completionPercentage !== t.completionPercentage) {
        changes.push(`Tiến độ: ${t.completionPercentage}% ➔ ${completionPercentage}%`);
      }
      if (hasCollaborators) {
        const curMemberEff = nextMemberEfforts[reportingAccount] || 0;
        if (curMemberEff !== prevMemberEffort) {
          changes.push(`Effort @${reportingAccount}: ${prevMemberEffort}h ➔ ${curMemberEff}h (Tổng task: ${finalTotalActualEffort}h)`);
        }
      } else if (finalTotalActualEffort !== t.actualEffort) {
        changes.push(`Effort: ${t.actualEffort}h ➔ ${finalTotalActualEffort}h`);
      }
      if (finalStartDate !== t.startDate) {
        changes.push(`Ngày bắt đầu: "${formatDateOnlyDisplay(t.startDate) || 'Chưa đặt'}" ➔ "${formatDateOnlyDisplay(finalStartDate) || 'Chưa đặt'}"`);
      }
      if (finalEndDate !== t.endDate) {
        changes.push(`Ngày hoàn thành: "${formatDateOnlyDisplay(t.endDate) || 'Chưa đặt'}" ➔ "${formatDateOnlyDisplay(finalEndDate) || 'Chưa đặt'}"`);
      }
      if (notes !== undefined && notes !== t.notes) {
        changes.push(`Kèm ghi chú báo cáo`);
      }

      const summary = isOfficialReport
        ? `Nộp báo cáo tiến độ tuần: ${changes.length > 0 ? changes.join(' • ') : 'Cập nhật tiến độ tuần'}`
        : `Cập nhật tiến độ trong tuần: ${changes.length > 0 ? changes.join(' • ') : 'Cập nhật thông tin task'}`;

      const logEntry: TaskActivityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowIso,
        authorName,
        authorAccount,
        authorRole,
        actionType: isOfficialReport ? 'REPORT_SUBMIT' : 'GENERAL_UPDATE',
        summary,
      };

      const existingLogs = Array.isArray(t.activityLogs) ? t.activityLogs : [];

      updatedReportTask = {
        ...t,
        actualEffort: finalTotalActualEffort,
        memberEfforts: nextMemberEfforts,
        completionPercentage,
        status: finalStatus,
        startDate: finalStartDate,
        endDate: finalEndDate,
        notes: notes !== undefined ? notes : t.notes,
        lastSubmittedAt: isOfficialReport ? now.toISOString() : t.lastSubmittedAt,
        isSubmittedLate: isOfficialReport ? (isDone ? false : isLate) : t.isSubmittedLate,
        updatedAt: nowIso,
        updatedBy: updaterDisplay,
        activityLogs: [logEntry, ...existingLogs],
      };
      return updatedReportTask;
    });

    setTasks(updated);
    saveLocalTasksCache(updated);
    if (updatedReportTask) {
      saveTaskToFirebase(updatedReportTask).catch(console.error);
    }
  };

  // Request task assignment from milestone / ad-hoc tasks (For Member)
  const requestTaskAssignment = (taskId: string, memberAccount: string, targetWeek?: number) => {
    const targetW = targetWeek !== undefined ? targetWeek : selectedWeek;
    updateTask(taskId, {
      assignmentRequestedBy: memberAccount,
      assignmentRequestStatus: 'PENDING',
      requestedWeekNumber: targetW,
      updatedAt: new Date().toISOString(),
    });

    // Helper to normalize role names to standard tokens (prevent substring false positives)
    const normalizeRoleToken = (role?: string): string => {
      if (!role) return '';
      const r = role.toLowerCase().trim();
      if (r === 'designer' || r === 'design' || r.includes('thiết kế')) return 'design';
      if (r === 'fe' || r === 'frontend' || r.includes('front-end') || r.includes('giao diện')) return 'fe';
      if (r === 'be' || r === 'backend' || r.includes('back-end') || r.includes('máy chủ')) return 'be';
      if (r === 'ba' || r.includes('business analyst') || r.includes('nghiệp vụ')) return 'ba';
      if (r === 'devops' || r.includes('hạ tầng') || r.includes('cloud')) return 'devops';
      if (r === 'ai' || r.includes('trí tuệ') || r.includes('machine learning')) return 'ai';
      if (r === 'po' || r.includes('product owner')) return 'po';
      if (r === 'qa' || r.includes('kiểm thử') || r.includes('tester')) return 'qa';
      if (r === 'sa' || r.includes('kiến trúc')) return 'sa';
      return r;
    };

    // Determine the exact target role of this task
    const task = tasks.find((t) => t.id === taskId);
    let targetRole = normalizeRoleToken(task?.role);
    if (!targetRole && task?.milestoneId) {
      const parentMilestone = milestones.find((m) => m.id === task.milestoneId);
      if (parentMilestone?.role && parentMilestone.role !== 'ALL') {
        targetRole = normalizeRoleToken(parentMilestone.role);
      }
    }
    if (!targetRole && task?.title) {
      const prefixMatch = task.title.trim().match(/^(FE|BE|BA|Design|Designer|DevOps|AI|PO|QA|SA)\b/i);
      if (prefixMatch) {
        targetRole = normalizeRoleToken(prefixMatch[1]);
      }
    }

    // Check if leader/advisor belongs strictly to this task's role
    const isLeaderOfRole = (u: any): boolean => {
      if (u.role !== 'Leader' && u.role !== 'Advisor') return false;
      if (!targetRole) return false; // If role is undetermined, do NOT broadcast to all leaders

      const specs = [
        ...(u.specializations || []),
        ...(u.specialization ? [u.specialization] : []),
      ].map((s: string) => normalizeRoleToken(s)).filter(Boolean);

      return specs.includes(targetRole);
    };

    const targetUsers = users.filter((u) => {
      if (u.disabled || u.status === 'disabled') return false;
      if (u.account.toLowerCase() === memberAccount.toLowerCase()) return false;

      // Only Leader / Advisor of the matching team/role receive assignment requests (Admin is excluded to avoid clutter)
      if (isLeaderOfRole(u)) return true;

      return false;
    });

    targetUsers.forEach((targetUser) => {
      sendPushNotification({
        targetAccount: targetUser.account,
        title: `✋ @${memberAccount} vừa gửi yêu cầu nhận task`,
        body: `Task: ${task?.title || 'Đầu việc mới'} (Tuần ${targetW})`,
        taskId: taskId,
        senderAccount: memberAccount,
        senderName: authSession?.name || memberAccount,
        type: 'TASK_ASSIGNED',
      });
    });
  };

  // Approve task assignment request (For Leader / Admin)
  const approveTaskAssignment = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    updateTask(taskId, {
      assigneeAccount: task.assignmentRequestedBy || task.assigneeAccount,
      assignmentRequestStatus: 'APPROVED',
      weekNumber: task.requestedWeekNumber || selectedWeek,
      updatedAt: new Date().toISOString(),
    });

    if (task.assignmentRequestedBy) {
      sendPushNotification({
        targetAccount: task.assignmentRequestedBy,
        title: `✅ Yêu cầu nhận task đã được duyệt!`,
        body: `Leader đã duyệt cho bạn nhận task: ${task.title}`,
        taskId: taskId,
        senderAccount: authSession?.account,
        senderName: authSession?.name,
        type: 'TASK_APPROVED',
      });
    }
  };

  // Reject task assignment request (For Leader / Admin)
  const rejectTaskAssignment = (taskId: string) => {
    updateTask(taskId, {
      assignmentRequestStatus: 'REJECTED',
      assignmentRequestedBy: undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  // Finish Week & Rollover Unfinished Tasks to Next Week (Admin, PM & PO only)
  const finishWeekAndRollover = () => {
    const isPOOrAdmin = (u?: any): boolean => {
      if (!u) return false;
      if (u.role === 'Admin' || u.role === 'PO' || isUserPM(u)) return true;
      const specs = u.specializations || [];
      return specs.some((s: string) => s.toUpperCase() === 'PO' || s.toUpperCase() === 'PM');
    };

    if (!isPOOrAdmin(authSession)) {
      confirmDialog({
        title: 'Không có quyền',
        message: 'Chỉ có Admin hoặc PO mới có quyền Chốt tuần và lưu trữ lịch sử công việc!',
        type: 'danger',
        confirmText: 'Đã hiểu',
        onConfirm: () => {},
      });
      return;
    }

    const nextWeek = selectedWeek + 1;
    // Only assigned tasks are part of active weekly schedules & history (tasks with primary assignee or supporters)
    const currentWeekAssignedTasks = tasks.filter(
      (t) =>
        t.weekNumber === selectedWeek &&
        t.year === selectedYear &&
        ((t.assigneeAccount && t.assigneeAccount.trim() !== '') ||
          (t.supporterAccounts && t.supporterAccounts.length > 0))
    );

    // Separate tasks into worked (has progress/effort or Done) vs unworked (0% progress & 0h effort)
    const workedTasks = currentWeekAssignedTasks.filter((t) => !isTaskUnworked(t));
    const unworkedTasks = currentWeekAssignedTasks.filter((t) => isTaskUnworked(t));

    const completedTasksCount = workedTasks.filter((t) => (t.completionPercentage || 0) >= 100).length;
    const rolledOverTasksCount = currentWeekAssignedTasks.length - completedTasksCount;

    // Create Archive Record for current week:
    const archiveRecord: WeeklyHistoryArchive = {
      id: `archive-${selectedWeek}-${Date.now()}`,
      weekNumber: selectedWeek,
      year: selectedYear,
      archivedAt: new Date().toISOString(),
      completedTasksCount: completedTasksCount,
      rolledOverTasksCount: rolledOverTasksCount,
      awards: calculateWeeklyAwardsForWeek(selectedWeek, selectedYear, true),
      tasksSnapshot: JSON.parse(
        JSON.stringify(
          currentWeekAssignedTasks.map((t) => ({
            ...t,
            actualEffort: t.actualEffort || 0,
          }))
        )
      ),
    };

    const updatedArchives = [
      ...weeklyArchives.filter((a) => !(a.weekNumber === selectedWeek && a.year === selectedYear)),
      archiveRecord,
    ].sort((a, b) => a.weekNumber - b.weekNumber);
    setWeeklyArchives(updatedArchives);
    syncArchivesToFirebase(updatedArchives);

    // Create continuation tasks for nextWeek for ALL unfinished tasks (both working progress < 100% and 0% unworked)
    // while PRESERVING current week tasks 100%!
    const continuationTasks: Task[] = [];
    const unfinishedTasks = currentWeekAssignedTasks.filter((t) => {
      const isFinished =
        (t.completionPercentage !== undefined && t.completionPercentage >= 100) ||
        (t.completionPercentage === undefined && t.status === 'Done');
      return !isFinished;
    });

    unfinishedTasks.forEach((t) => {
      const rootId = t.parentTaskId || t.id;
      const titleLower = (t.title || '').trim().toLowerCase();
      const assigneeLower = (t.assigneeAccount || '').trim().toLowerCase();
      const roleLower = (t.role || '').trim().toLowerCase();

      const alreadyExistsInNextWeek = tasks.some((nt) => {
        if (nt.weekNumber !== nextWeek || (nt.year || selectedYear) !== selectedYear) return false;
        if (nt.parentTaskId === rootId || nt.id === rootId) return true;
        const ntTitle = (nt.title || '').trim().toLowerCase();
        const ntAssignee = (nt.assigneeAccount || '').trim().toLowerCase();
        const ntRole = (nt.role || '').trim().toLowerCase();
        return ntTitle === titleLower && ntAssignee === assigneeLower && ntRole === roleLower;
      });

      const alreadyInContinuation = continuationTasks.some((ct) => {
        if (ct.parentTaskId === rootId || ct.id === rootId) return true;
        const ctTitle = (ct.title || '').trim().toLowerCase();
        const ctAssignee = (ct.assigneeAccount || '').trim().toLowerCase();
        const ctRole = (ct.role || '').trim().toLowerCase();
        return ctTitle === titleLower && ctAssignee === assigneeLower && ctRole === roleLower;
      });

      if (!alreadyExistsInNextWeek && !alreadyInContinuation) {
        const isProgress = (t.completionPercentage !== undefined && t.completionPercentage > 0);
        continuationTasks.push({
          ...t,
          id: `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          parentTaskId: rootId,
          weekNumber: nextWeek,
          year: selectedYear,
          actualEffort: 0,
          status: isProgress ? 'In Progress' : 'To do',
          completionPercentage: t.completionPercentage || 0,
          lastSubmittedAt: undefined,
          isSubmittedLate: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activityLogs: [
            ...(t.activityLogs || []),
            {
              id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              timestamp: new Date().toISOString(),
              authorName: authSession?.name || 'Admin',
              authorAccount: authSession?.account || 'admin',
              authorRole: authSession?.role || 'Admin',
              actionType: 'GENERAL_UPDATE',
              summary: isProgress
                ? `Chốt Tuần ${selectedWeek} & chuyển tiếp sang Tuần ${nextWeek} (Tiến độ kế thừa: ${t.completionPercentage || 0}%)`
                : `Chốt Tuần ${selectedWeek} & chuyển tiếp công việc sang Tuần ${nextWeek} (Chưa thực hiện - To do)`,
            },
          ],
        });
      }
    });

    // Unworked tasks (0% progress & 0h effort) are MOVED to nextWeek (removed from selectedWeek to prevent clutter)
    const unworkedIds = new Set(unworkedTasks.map((t) => t.id));
    const remainingTasks = tasks.filter((t) => !unworkedIds.has(t.id));
    const newTasksList = [...remainingTasks, ...continuationTasks];

    if (unworkedIds.size > 0) {
      deleteMultipleTasksFromFirebase(Array.from(unworkedIds), authSession?.account).catch(console.error);
    }

    setTasks(newTasksList);
    saveLocalTasksCache(newTasksList);
    syncTasksToFirebase(newTasksList).catch(console.error);

    setSelectedWeek(nextWeek);
  };

  // Rollback / Hoàn tác chốt tuần: Khôi phục lại toàn bộ dữ liệu task từ snapshot và xóa các task chuyển tiếp tự động
  const rollbackWeekArchive = (targetWeek: number, targetYear: number = selectedYear) => {
    const isPOOrAdmin = (u?: any): boolean => {
      if (!u) return false;
      if (u.role === 'Admin' || u.role === 'PO' || isUserPM(u)) return true;
      const specs = u.specializations || [];
      return specs.some((s: string) => s.toUpperCase() === 'PO' || s.toUpperCase() === 'PM');
    };

    if (!isPOOrAdmin(authSession)) {
      confirmDialog({
        title: 'Không có quyền',
        message: 'Chỉ có Admin hoặc PO mới có quyền Rollback / Hoàn tác chốt tuần!',
        type: 'danger',
        confirmText: 'Đã hiểu',
        onConfirm: () => {},
      });
      return;
    }

    const targetArchive = weeklyArchives.find(
      (a) => a.weekNumber === targetWeek && (a.year || 2026) === targetYear
    );

    if (!targetArchive) {
      confirmDialog({
        title: 'Không tìm thấy lịch sử',
        message: `Không tìm thấy bản ghi lịch sử đã lưu trữ của Tuần ${targetWeek} (${targetYear}).`,
        type: 'warning',
        confirmText: 'Đóng',
        onConfirm: () => {},
      });
      return;
    }

    confirmDialog({
      title: `Rollback / Hoàn tác Chốt Tuần ${targetWeek}`,
      message: `Bạn có chắc chắn muốn Rollback (Hoàn tác chốt tuần) cho Tuần ${targetWeek}? Toàn bộ dữ liệu task và báo cáo của Tuần ${targetWeek} sẽ được khôi phục nguyên vẹn 100% từ bản lưu trữ snapshot (${targetArchive.tasksSnapshot?.length || 0} task), đồng thời các task tự động chuyển tiếp sang Tuần ${targetWeek + 1} sẽ được thu hồi.`,
      type: 'warning',
      confirmText: `Xác nhận Rollback Tuần ${targetWeek}`,
      onConfirm: () => {
        const nextWeek = targetWeek + 1;
        const snapshotTasks: Task[] = targetArchive.tasksSnapshot || [];

        // 1. Get snapshot task root IDs and task IDs
        const snapshotRootIds = new Set(
          snapshotTasks.map((t) => t.parentTaskId || t.id)
        );
        const snapshotTaskIds = new Set(snapshotTasks.map((t) => t.id));

        // 2. Remove continuation tasks in nextWeek that were rolled over from this targetWeek
        // and remove existing tasks of targetWeek that will be replaced by snapshot tasks
        const filteredTasks = tasks.filter((t) => {
          if (t.weekNumber === nextWeek && (t.year || 2026) === targetYear) {
            if (t.parentTaskId && snapshotRootIds.has(t.parentTaskId)) {
              return false; // Remove auto continuation task in nextWeek
            }
          }
          if (t.weekNumber === targetWeek && (t.year || 2026) === targetYear) {
            return false;
          }
          if (snapshotTaskIds.has(t.id)) {
            return false;
          }
          return true;
        });

        // 3. Add back snapshot tasks into targetWeek
        const restoredTasksList = [...filteredTasks, ...snapshotTasks];

        // 4. Remove targetWeek from weeklyArchives
        const updatedArchives = weeklyArchives.filter(
          (a) => !(a.weekNumber === targetWeek && (a.year || 2026) === targetYear)
        );

        setTasks(restoredTasksList);
        saveLocalTasksCache(restoredTasksList);
        syncTasksToFirebase(restoredTasksList).catch(console.error);

        setWeeklyArchives(updatedArchives);
        syncArchivesToFirebase(updatedArchives).catch(console.error);

        setSelectedWeek(targetWeek);
      },
    });
  };

  // Helper to calculate weekly awards (with optional reward/penalty enablement)
  const calculateWeeklyAwardsForWeek = (
    targetWeek: number,
    targetYear: number,
    isFinalized: boolean = true
  ): WeeklyAwardSummary[] => {
    const currentWeekTasks = tasks.filter(
      (t) => t.weekNumber === targetWeek && t.year === targetYear
    );

    const sundayNoon = getWeekSundayNoon(targetWeek, targetYear);
    const deadline = getWeekDeadline(targetWeek, targetYear);
    const now = new Date(simulatedTime);
    const isPastDeadline = now.getTime() > deadline.getTime();

    const userEffortMap = new Map<
      string,
      {
        totalEffort: number;
        count: number;
        total: number;
        isLate: boolean;
        hasUnsubmitted: boolean;
        lastSubmittedAt?: string;
      }
    >();

    // Filter active users only (exclude disabled/locked accounts)
    const activeUsers = users.filter((u) => !u.disabled && u.status !== 'disabled');

    activeUsers.forEach((u) => {
      userEffortMap.set(u.account, {
        totalEffort: 0,
        count: 0,
        total: 0,
        isLate: false,
        hasUnsubmitted: false,
      });
    });

    currentWeekTasks.forEach((task) => {
      // Gather all distinct participants (assignee and supporters)
      const participantAccounts = new Set<string>();
      if (task.assigneeAccount && task.assigneeAccount.trim() !== '') {
        participantAccounts.add(task.assigneeAccount.trim().toLowerCase());
      }
      if (task.supporterAccounts && Array.isArray(task.supporterAccounts)) {
        task.supporterAccounts.forEach((sup) => {
          if (sup && sup.trim()) {
            participantAccounts.add(sup.trim().toLowerCase());
          }
        });
      }

      if (participantAccounts.size === 0) return;

      const effectiveEffort = (task.completionPercentage === 0) ? 0 : (task.actualEffort || 0);
      const isTaskDone = task.status === 'Done' || task.completionPercentage === 100;
      const isTaskReported =
        isTaskDone ||
        (!!task.lastSubmittedAt &&
          new Date(task.lastSubmittedAt).getTime() >= sundayNoon.getTime());

      // Credit individual member effort and status to every participant
      activeUsers.forEach((u) => {
        if (!participantAccounts.has(u.account.toLowerCase())) return;

        const entry = userEffortMap.get(u.account) || {
          totalEffort: 0,
          count: 0,
          total: 0,
          isLate: false,
          hasUnsubmitted: false,
        };

        const memberEffort = task.completionPercentage === 0 ? 0 : getMemberTaskEffort(task, u.account);

        entry.total += 1;
        entry.totalEffort = Math.round((entry.totalEffort + memberEffort) * 100) / 100;

        if (isTaskReported) {
          entry.count += 1;
          if (task.lastSubmittedAt) {
            entry.lastSubmittedAt = task.lastSubmittedAt;
          }
          if (task.isSubmittedLate && !isTaskDone) {
            entry.isLate = true;
          }
        } else {
          entry.hasUnsubmitted = true;
          if (isPastDeadline) {
            entry.isLate = true;
          }
        }
        userEffortMap.set(u.account, entry);
      });
    });

    let maxEffort = 0;
    userEffortMap.forEach((val) => {
      if (val.totalEffort > maxEffort) {
        maxEffort = val.totalEffort;
      }
    });

    const awards: WeeklyAwardSummary[] = [];

    activeUsers.forEach((u) => {
      const stats = userEffortMap.get(u.account) || {
        totalEffort: 0,
        count: 0,
        total: 0,
        isLate: false,
        hasUnsubmitted: false,
      };

      const isMissingReport = isPastDeadline && stats.total > 0 && stats.count < stats.total;
      const isLateSubmission = stats.isLate && !isMissingReport;

      let penaltyType: 'LATE' | 'MISSING' | 'NONE' = 'NONE';
      let penaltyReason = '';

      if (isFinalized) {
        if (isMissingReport) {
          penaltyType = 'MISSING';
          penaltyReason = `Chưa nộp báo cáo (${stats.count}/${stats.total} task) quá hạn 22:00 CN`;
        } else if (isLateSubmission) {
          penaltyType = 'LATE';
          penaltyReason = `Nộp báo cáo muộn sau 22:00 CN`;
        }
      }

      awards.push({
        account: u.account,
        userName: u.name,
        role: u.role,
        specializations: u.specializations || ['BA'],
        totalEffort: stats.totalEffort,
        submittedCount: stats.count,
        totalTasks: stats.total,
        isTopEffort: isFinalized && maxEffort > 0 && stats.totalEffort === maxEffort,
        isLate: isFinalized && (stats.isLate || isMissingReport),
        lastSubmittedAt: stats.lastSubmittedAt,
        isMissingReport: isFinalized && isMissingReport,
        penaltyType,
        penaltyReason,
      });
    });

    return awards.sort((a, b) => b.totalEffort - a.totalEffort);
  };

  // Compute Weekly Award Summaries
  const computeWeeklyAwards = (): WeeklyAwardSummary[] => {
    const isFinalized = weeklyArchives.some(
      (a) => a.weekNumber === selectedWeek && a.year === selectedYear
    );

    const archive = weeklyArchives.find(
      (a) => a.weekNumber === selectedWeek && a.year === selectedYear
    );

    if (archive && archive.awards) {
      // Exclude disabled accounts from historical archive view
      return archive.awards.filter(
        (w) =>
          !users.some(
            (u) =>
              u.account.toLowerCase() === w.account.toLowerCase() &&
              (u.disabled || u.status === 'disabled')
          )
      );
    }

    return calculateWeeklyAwardsForWeek(selectedWeek, selectedYear, isFinalized);
  };

  // Ticket Management Operations
  const createTicket = async (
    ticketData: Omit<Ticket, 'id' | 'code' | 'createdAt' | 'comments' | 'activityLogs'>
  ): Promise<Ticket> => {
    const newId = `ticket-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nextNum = tickets.length + 1;
    const code = `REQ-${String(nextNum).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const initialLog: TicketActivityLog = {
      id: `log-ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      authorName: ticketData.fromName,
      authorAccount: ticketData.fromAccount,
      authorRole: ticketData.fromUserRole || 'Member',
      actionType: 'CREATE',
      summary: `Khởi tạo yêu cầu hỗ trợ liên team (From Team ${ticketData.fromRole} ➔ Team ${ticketData.toRole})`,
    };

    const newTicket: Ticket = {
      ...ticketData,
      id: newId,
      code,
      comments: [],
      activityLogs: [initialLog],
      createdAt: now,
      updatedAt: now,
      attachments: ticketData.attachments || [],
    };

    const cleanTicket = JSON.parse(
      JSON.stringify(newTicket, (_, v) => (v === undefined ? null : v))
    );
    await set(ref(database, `${DB_ROOT_NODE}/tickets/${newId}`), cleanTicket);

    const isMatchRole = (spec: string, targetRole: string) => {
      if (!spec || !targetRole) return false;
      const s = spec.trim().toLowerCase();
      const t = targetRole.trim().toLowerCase();
      if (s === t) return true;
      if ((s === 'design' && t === 'designer') || (s === 'designer' && t === 'design')) return true;
      if (s.includes(t) || t.includes(s)) return true;
      return false;
    };

    // Targeted notification: Send ONLY to Leader & Advisor of toRole (excluding ticket creator)
    const targetUsers = users.filter((u) => {
      if (u.disabled || u.status === 'disabled') return false;
      if (u.account.toLowerCase() === newTicket.fromAccount.toLowerCase()) return false;

      // If toRole is explicitly Admin or Back Office, notify Admin users
      if (isMatchRole('Admin', newTicket.toRole) || isMatchRole('Back Office', newTicket.toRole)) {
        if (u.role === 'Admin' || isUserAdminOrPM(u)) return true;
      }

      const userSpecs = [
        ...(u.specializations || []),
        ...((u as any).specialization ? [(u as any).specialization] : []),
      ];
      const matchesSpec = userSpecs.some((s) => isMatchRole(s, newTicket.toRole));
      if (!matchesSpec) return false;

      // Determine user's role specifically within this target specialization
      const userSpecRole = u.specializationRoles
        ? (Object.entries(u.specializationRoles).find(([k]) => isMatchRole(k, newTicket.toRole))?.[1] || u.role)
        : u.role;

      const isLeaderOrAdvisor = userSpecRole === 'Leader' || userSpecRole === 'Advisor';
      return isLeaderOrAdvisor;
    });

    // Fallback: If no specific Leader/Advisor for that role was matched, notify active members matching toRole
    const finalTargets =
      targetUsers.length > 0
        ? targetUsers
        : users.filter((u) => {
            if (u.disabled || u.status === 'disabled') return false;
            if (u.account.toLowerCase() === newTicket.fromAccount.toLowerCase()) return false;
            const userSpecs = [
              ...(u.specializations || []),
              ...((u as any).specialization ? [(u as any).specialization] : []),
            ];
            return userSpecs.some((s) => isMatchRole(s, newTicket.toRole));
          });

    finalTargets.forEach((user) => {
      sendPushNotification({
        targetAccount: user.account,
        title: `🎫 [${newTicket.code}] Yêu cầu mới từ team ${newTicket.fromRole} ➜ ${newTicket.toRole}`,
        body: `${newTicket.fromName}: "${newTicket.title}"`,
        ticketId: newTicket.id,
        senderAccount: newTicket.fromAccount,
        senderName: newTicket.fromName,
        type: 'TICKET_CREATED',
      }).catch(console.error);
    });

    return newTicket;
  };

  const updateTicket = async (
    id: string,
    updates: Partial<Ticket>,
    options?: { logActionType?: TicketActivityLog['actionType']; logSummary?: string; skipLog?: boolean }
  ): Promise<void> => {
    const currentTicket = tickets.find((t) => t.id === id);
    if (!currentTicket) return;

    const now = new Date().toISOString();
    const authorName = authSession?.name || 'Người dùng';
    const authorAccount = authSession?.account || 'member';
    const authorRole = authSession?.role || 'Member';

    let activityLogs = currentTicket.activityLogs || [];

    if (!options?.skipLog) {
      const changes: string[] = [];
      let actionType: TicketActivityLog['actionType'] = options?.logActionType || 'GENERAL_UPDATE';

      if (options?.logSummary) {
        changes.push(options.logSummary);
      } else {
        if (updates.status && updates.status !== currentTicket.status) {
          actionType = 'STATUS_CHANGE';
          changes.push(`Trạng thái: "${currentTicket.status}" ➔ "${updates.status}"`);
        }
        if (updates.assignedTo !== undefined && updates.assignedTo !== currentTicket.assignedTo) {
          actionType = 'ASSIGNEE_CHANGE';
          changes.push(
            `Phân công: ${currentTicket.assignedTo ? `@${currentTicket.assignedTo}` : 'Chưa phân công'} ➔ ${
              updates.assignedTo ? `@${updates.assignedTo}` : 'Chưa phân công'
            }`
          );
        }
        if (updates.priority && updates.priority !== currentTicket.priority) {
          actionType = 'PRIORITY_CHANGE';
          changes.push(`Mức độ ưu tiên: "${currentTicket.priority}" ➔ "${updates.priority}"`);
        }
        if (updates.title && updates.title !== currentTicket.title) {
          actionType = 'DESC_UPDATE';
          changes.push(`Đổi tiêu đề: "${updates.title}"`);
        }
        if (updates.description !== undefined && updates.description !== currentTicket.description) {
          actionType = 'DESC_UPDATE';
          changes.push(`Cập nhật nội dung yêu cầu chi tiết`);
        }
        if (updates.resolutionNote !== undefined && updates.resolutionNote !== currentTicket.resolutionNote) {
          actionType = 'RESOLVE';
          changes.push(`Cập nhật giải pháp / kết quả xử lý`);
        }
      }

      if (changes.length > 0) {
        const logEntry: TicketActivityLog = {
          id: `log-ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          authorName,
          authorAccount,
          authorRole,
          actionType,
          summary: changes.join(' • '),
        };
        activityLogs = [logEntry, ...activityLogs];
      }
    }

    const updatedTicket: Ticket = {
      ...currentTicket,
      ...updates,
      activityLogs,
      updatedAt: now,
    };

    const cleanTicket = JSON.parse(
      JSON.stringify(updatedTicket, (_, v) => (v === undefined ? null : v))
    );
    await set(ref(database, `${DB_ROOT_NODE}/tickets/${id}`), cleanTicket);

    // Synchronize updates with linked task if any
    const linkedTaskIndex = tasks.findIndex(
      (t) => (currentTicket.createdTaskId && t.id === currentTicket.createdTaskId) || (t.ticketId && t.ticketId === id)
    );
    if (linkedTaskIndex !== -1) {
      const existingTask = tasks[linkedTaskIndex];
      const taskUpdates: Partial<Task> = {};
      if (updates.title) {
        taskUpdates.title = `[${currentTicket.code}] ${updates.title}`;
      }
      if (updates.description !== undefined) {
        taskUpdates.description = updates.description;
      }
      if (updates.priority) {
        taskUpdates.priority = updates.priority === 'Urgent' ? 'High' : updates.priority === 'High' ? 'High' : updates.priority === 'Medium' ? 'Medium' : 'Low';
      }
      if (Object.keys(taskUpdates).length > 0) {
        const updatedTask = { ...existingTask, ...taskUpdates, updatedAt: now };
        const newTasks = [...tasks];
        newTasks[linkedTaskIndex] = updatedTask;
        setTasks(newTasks);
        await set(ref(database, `${DB_ROOT_NODE}/tasks/${existingTask.id}`), updatedTask);
      }
    }
  };

  const deleteTicket = async (id: string): Promise<void> => {
    await remove(ref(database, `${DB_ROOT_NODE}/tickets/${id}`));
  };

  const assignTicket = async (ticketId: string, assigneeAccount: string): Promise<void> => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const assignee = assigneeAccount
      ? users.find((u) => u.account.toLowerCase() === assigneeAccount.toLowerCase())
      : undefined;
    const now = new Date().toISOString();

    let createdTaskId = ticket.createdTaskId;
    let createdTaskTitle = ticket.createdTaskTitle;

    // Automatically create or update Task in the assignee's task list
    if (assigneeAccount) {
      const existingTaskIndex = tasks.findIndex(
        (t) => (ticket.createdTaskId && t.id === ticket.createdTaskId) || (t.ticketId && t.ticketId === ticket.id)
      );

      if (existingTaskIndex !== -1) {
        const existingTask = tasks[existingTaskIndex];
        const updatedTask: Task = {
          ...existingTask,
          assigneeAccount,
          role: ticket.toRole,
          status: existingTask.status === 'Done' ? 'Done' : 'In Progress',
          updatedBy: `${authSession?.name || 'Leader'} (@${authSession?.account || 'Leader'})`,
          updatedAt: now,
        };
        const newTasks = [...tasks];
        newTasks[existingTaskIndex] = updatedTask;
        setTasks(newTasks);
        saveLocalTasksCache(newTasks);
        saveTaskToFirebase(updatedTask).catch(console.error);
        createdTaskId = updatedTask.id;
        createdTaskTitle = updatedTask.title;
      } else {
        const taskTitle = `[${ticket.code}] ${ticket.title}`;
        const taskDesc = `${ticket.description}${
          ticket.attachments && ticket.attachments.length > 0
            ? '\n\n📎 Link tài liệu đính kèm:\n' + ticket.attachments.join('\n')
            : ''
        }`;

        const isMatchSpecHelper = (specA?: string, specB?: string) => {
          if (!specA || !specB) return false;
          const a = specA.trim().toLowerCase();
          const b = specB.trim().toLowerCase();
          return a === b || (a === 'design' && b === 'designer') || (a === 'designer' && b === 'design');
        };

        const targetMilestone =
          milestones.find((m) => m.id === ticket.relatedMilestoneId) ||
          milestones.find((m) => isMatchSpecHelper(m.role, ticket.toRole)) ||
          milestones[0];

        const milestoneId = targetMilestone ? targetMilestone.id : 'ms-default';
        const milestoneTasks = tasks.filter((t) => t.milestoneId === milestoneId);
        const taskPriority: 'High' | 'Medium' | 'Low' =
          ticket.priority === 'Urgent' || ticket.priority === 'High'
            ? 'High'
            : ticket.priority === 'Low'
            ? 'Low'
            : 'Medium';

        const newTaskId = `tsk-req-${Date.now()}`;
        const authorDisplay = `${authSession?.name || 'Leader'} (@${authSession?.account || 'Leader'})`;

        const initialLog: TaskActivityLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: now,
          authorName: authSession?.name || 'Leader',
          authorAccount: authSession?.account || 'Leader',
          authorRole: authSession?.role || 'Leader',
          actionType: 'CREATE',
          summary: `Tự động tạo task từ Request Ticket [${ticket.code}] do ${ticket.fromName} (Team ${ticket.fromRole}) gửi sang`,
        };

        const newTask: Task = {
          id: newTaskId,
          title: taskTitle,
          description: taskDesc,
          role: ticket.toRole,
          priority: taskPriority,
          estimatedEffort: 2,
          actualEffort: 0,
          status: 'In Progress',
          assigneeAccount,
          milestoneId,
          orderInMilestone: milestoneTasks.length + 1,
          completionPercentage: 0,
          weekNumber: selectedWeek,
          year: selectedYear,
          ticketId: ticket.id,
          createdBy: `${authSession?.name || 'Leader'} (Request Ticket ${ticket.code})`,
          createdAt: now,
          updatedBy: authorDisplay,
          updatedAt: now,
          activityLogs: [initialLog],
        };

        const updatedTasks = [...tasks, newTask];
        setTasks(updatedTasks);
        saveLocalTasksCache(updatedTasks);
        saveTaskToFirebase(newTask).catch(console.error);
        createdTaskId = newTaskId;
        createdTaskTitle = taskTitle;
      }
    } else {
      const existingTaskIndex = tasks.findIndex(
        (t) => (ticket.createdTaskId && t.id === ticket.createdTaskId) || (t.ticketId && t.ticketId === ticket.id)
      );
      if (existingTaskIndex !== -1) {
        const updatedTask: Task = {
          ...tasks[existingTaskIndex],
          assigneeAccount: '',
          status: 'To do',
          updatedAt: now,
        };
        const newTasks = [...tasks];
        newTasks[existingTaskIndex] = updatedTask;
        setTasks(newTasks);
        saveLocalTasksCache(newTasks);
        saveTaskToFirebase(updatedTask).catch(console.error);
      }
    }

    const updates: Partial<Ticket> = {
      assignedTo: assigneeAccount || '',
      assignedToName: assignee?.name || '',
      createdTaskId: createdTaskId || '',
      createdTaskTitle: createdTaskTitle || '',
      status: assigneeAccount && ticket.status === 'Open' ? 'In Progress' : ticket.status,
      updatedAt: now,
    };

    await updateTicket(ticketId, updates, {
      logActionType: 'ASSIGNEE_CHANGE',
      logSummary: assigneeAccount
        ? `Phân công xử lý cho @${assigneeAccount} (${assignee?.name || ''})`
        : 'Hủy phân công người xử lý',
    });

    if (assignee && assignee.account.toLowerCase() !== authSession?.account.toLowerCase()) {
      sendPushNotification({
        targetAccount: assignee.account,
        title: `📋 Phân công xử lý request [${ticket.code}]`,
        body: `${authSession?.name || 'Leader'} đã giao task cho bạn: "${ticket.title}" (Tuần ${selectedWeek})`,
        ticketId: ticket.id,
        taskId: createdTaskId,
        senderAccount: authSession?.account || 'Leader',
        senderName: authSession?.name || 'Leader',
        type: 'TICKET_ASSIGNED',
      }).catch(console.error);
    }
  };

  const resolveTicket = async (ticketId: string, resolutionNote: string): Promise<void> => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const now = new Date().toISOString();
    const updates: Partial<Ticket> = {
      status: 'Resolved',
      resolutionNote,
      resolvedBy: authSession?.account,
      resolvedByName: authSession?.name,
      resolvedAt: now,
      updatedAt: now,
    };

    await updateTicket(ticketId, updates, {
      logActionType: 'RESOLVE',
      logSummary: `Đánh dấu đã giải quyết yêu cầu. Giải pháp: "${resolutionNote}"`,
    });

    // Also mark linked task as Done if exists
    const linkedTaskIndex = tasks.findIndex(
      (t) => (ticket.createdTaskId && t.id === ticket.createdTaskId) || (t.ticketId && t.ticketId === ticket.id)
    );
    if (linkedTaskIndex !== -1) {
      const linkedTask = tasks[linkedTaskIndex];
      const updatedTask: Task = {
        ...linkedTask,
        status: 'Done',
        completionPercentage: 100,
        notes: resolutionNote || linkedTask.notes,
        lastSubmittedAt: now,
        updatedAt: now,
      };
      const newTasks = [...tasks];
      newTasks[linkedTaskIndex] = updatedTask;
      setTasks(newTasks);
      saveLocalTasksCache(newTasks);
      saveTaskToFirebase(updatedTask).catch(console.error);
    }

    if (ticket.fromAccount.toLowerCase() !== authSession?.account.toLowerCase()) {
      sendPushNotification({
        targetAccount: ticket.fromAccount,
        title: `✅ [${ticket.code}] Request của bạn đã được giải quyết!`,
        body: `${authSession?.name || 'Team ' + ticket.toRole}: "${resolutionNote.slice(0, 100)}"`,
        ticketId: ticket.id,
        senderAccount: authSession?.account,
        senderName: authSession?.name,
        type: 'TICKET_RESOLVED',
      }).catch(console.error);
    }
  };

  const closeTicket = async (ticketId: string): Promise<void> => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const now = new Date().toISOString();
    const updates: Partial<Ticket> = {
      status: 'Closed',
      closedAt: now,
      updatedAt: now,
    };

    await updateTicket(ticketId, updates, {
      logActionType: 'CLOSE',
      logSummary: 'Xác nhận hoàn thành & đóng yêu cầu hỗ trợ',
    });

    if (ticket.fromAccount.toLowerCase() !== authSession?.account.toLowerCase()) {
      sendPushNotification({
        targetAccount: ticket.fromAccount,
        title: `🔒 [${ticket.code}] Request đã hoàn tất và đóng`,
        body: `Ticket "${ticket.title}" đã được đóng bởi ${authSession?.name}.`,
        ticketId: ticket.id,
        senderAccount: authSession?.account,
        senderName: authSession?.name,
        type: 'TICKET_CLOSED',
      }).catch(console.error);
    }
  };

  const reopenTicket = async (ticketId: string): Promise<void> => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const now = new Date().toISOString();
    const updates: Partial<Ticket> = {
      status: 'In Progress',
      closedAt: undefined,
      resolvedAt: undefined,
      updatedAt: now,
    };

    await updateTicket(ticketId, updates, {
      logActionType: 'REOPEN',
      logSummary: 'Mở lại yêu cầu để tiếp tục xử lý / sửa đổi',
    });
  };

  const addTicketComment = async (
    ticketId: string,
    content: string,
    attachments?: string[]
  ): Promise<void> => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || !authSession) return;

    const now = new Date().toISOString();
    const newComment: TicketComment = {
      id: `comm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ticketId,
      authorAccount: authSession.account,
      authorName: authSession.name,
      authorRole: authSession.role,
      authorSpecialization: authSession.specializations?.[0] || 'Member',
      content,
      createdAt: now,
      attachments: attachments || [],
    };

    const logEntry: TicketActivityLog = {
      id: `log-ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      authorName: authSession.name,
      authorAccount: authSession.account,
      authorRole: authSession.role,
      actionType: 'COMMENT_ADD',
      summary: `Gửi phản hồi trao đổi: "${content.replace(/\n/g, ' ').slice(0, 80)}${
        content.length > 80 ? '...' : ''
      }"`,
    };

    const updatedComments = [...(ticket.comments || []), newComment];
    const updatedActivityLogs = [logEntry, ...(ticket.activityLogs || [])];

    const cleanTicket = JSON.parse(
      JSON.stringify(
        {
          ...ticket,
          comments: updatedComments,
          activityLogs: updatedActivityLogs,
          updatedAt: now,
        },
        (_, v) => (v === undefined ? null : v)
      )
    );

    await set(ref(database, `${DB_ROOT_NODE}/tickets/${ticketId}`), cleanTicket);

    // Notify only participants of this specific request exchange (creator, assignee, and previous commenters)
    const recipientAccounts = new Set<string>();
    if (ticket.fromAccount) recipientAccounts.add(ticket.fromAccount);
    if (ticket.assignedTo) recipientAccounts.add(ticket.assignedTo);
    if (Array.isArray(ticket.comments)) {
      ticket.comments.forEach((c) => {
        if (c.authorAccount) recipientAccounts.add(c.authorAccount);
      });
    }

    // Also notify any members tagged via @mention in the comment
    const mentionedAccounts = extractMentions(content, users);
    mentionedAccounts.forEach((targetAcc) => {
      recipientAccounts.add(targetAcc);
    });

    // Exclude the current commenter
    recipientAccounts.forEach((acc) => {
      if (acc.toLowerCase().trim() === authSession.account.toLowerCase().trim()) {
        recipientAccounts.delete(acc);
      }
    });

    const directlyTaggedAccounts = new Set(
      mentionedAccounts.map((a) => a.toLowerCase().trim())
    );

    recipientAccounts.forEach((acc) => {
      const isDirectlyTagged = directlyTaggedAccounts.has(acc.toLowerCase().trim());
      sendPushNotification({
        targetAccount: acc,
        title: isDirectlyTagged
          ? `🏷️ [${ticket.code}] @${authSession.name} đã nhắc tên bạn trong ticket`
          : `💬 [${ticket.code}] Phản hồi mới từ ${authSession.name}`,
        body: `"${content.slice(0, 100)}"`,
        ticketId: ticket.id,
        senderAccount: authSession.account,
        senderName: authSession.name,
        type: 'TICKET_COMMENT',
      }).catch(console.error);
    });
  };

  const setSimulatedTime = (time: string) => setSimulatedTimeState(time);
  const resetSimulatedTime = () => setSimulatedTimeState(formatToLocalISOString(new Date()));

  const resetToDefaultData = () => {
    seedFirebaseMockData();
  };

  const broadcastSystemUpdate = useCallback(async (message?: string) => {
    try {
      const configRef = ref(database, `${DB_ROOT_NODE}/systemConfig`);
      await update(configRef, {
        version: APP_VERSION,
        lastDeployTime: Date.now(),
        message: message || APP_RELEASE_NOTE,
      });
    } catch (err) {
      console.error('Failed to broadcast system update:', err);
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentUser: authSession,
        authSession,
        login,
        setupFirstTimePassword,
        changePassword,
        logout,
        users,
        addUser,
        updateUser,
        batchImportUsers,
        deleteUser,
        resetUserPassword,
        resetAllUninitializedPasswords,
        roles,
        addRole,
        updateRole,
        deleteRole,
        resources,
        addResource,
        updateResource,
        deleteResource,
        milestones,
        addMilestone,
        updateMilestone,
        deleteMilestone,
        tasks,
        addTask,
        duplicateTask,
        updateTask,
        deleteTask,
        deleteTasks,
        reorderTasksInMilestone,
        submitTaskReport,
        updateTaskNotes,
        canEditTask,
        canReportTask,
        simulatedTime,
        setSimulatedTime,
        resetSimulatedTime,
        weeklyAwards: computeWeeklyAwards(),
        selectedWeek,
        setSelectedWeek,
        selectedYear,
        setSelectedYear,
        weeklyArchives,
        finishWeekAndRollover,
        rollbackWeekArchive,
        resetToDefaultData,
        isFirebaseConnected,
        confirmDialog,
        hasUnreadNote,
        markNoteAsRead,

        requestTaskAssignment,
        approveTaskAssignment,
        rejectTaskAssignment,

        // Cross-Role Request Tickets
        tickets,
        createTicket,
        updateTicket,
        deleteTicket,
        assignTicket,
        resolveTicket,
        closeTicket,
        reopenTicket,
        addTicketComment,

        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        requestNotificationPermission,
        isPushEnabled,

        theme,
        toggleTheme,
        setTheme,

        appVersion: APP_VERSION,
        broadcastSystemUpdate,
      }}
    >
      {children}
      <ConfirmModal
        isOpen={!!confirmState}
        options={confirmState}
        onClose={closeConfirm}
      />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
