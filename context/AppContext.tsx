'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { User, Milestone, Task, TaskStatus, WeeklyAwardSummary, WeeklyHistoryArchive, RoleItem, ProjectResource, TaskActivityLog, UserRole, Specialization, isTaskUnworked } from '../types/task';
import { INITIAL_USERS, INITIAL_MILESTONES, INITIAL_TASKS, INITIAL_PROJECT_RESOURCES } from '../lib/mockData';
import { database, ref, onValue, set, update, remove, DB_ROOT_NODE } from '../lib/firebase';
import { hashPassword, verifyPassword, generateTemporaryPassword } from '../lib/crypto';
import { ConfirmModal, ConfirmDialogOptions } from '../components/ConfirmModal';
import { AppNotification } from '../types/notification';
import {
  registerDeviceForPushNotifications,
  sendPushNotification,
  playNotificationChime,
  showLocalBrowserNotification,
} from '../lib/notificationService';

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
  
  submitTaskReport: (taskId: string, actualEffort: number, completionPercentage: number, status: TaskStatus, notes?: string) => void;
  updateTaskNotes: (taskId: string, notes: string) => void;
  
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

  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_AUTH = 'gmm_task_auth_session_v2';

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
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [weeklyArchives, setWeeklyArchives] = useState<WeeklyHistoryArchive[]>([]);
  const [authSession, setAuthSession] = useState<User | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);
  const [confirmState, setConfirmState] = useState<ConfirmDialogOptions | null>(null);

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
    new Date().toISOString().slice(0, 16)
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
          if (data.tasks) {
            const taskList = Object.values(data.tasks) as Task[];
            let hasLegacy = false;
            const formattedTasks = taskList.map((t: any) => {
              const weekNo =
                typeof t.weekNumber === 'number' && t.weekNumber <= 53 && (!t.year || t.year === 2026)
                  ? t.weekNumber + 55
                  : t.weekNumber;
              if (weekNo !== t.weekNumber) {
                hasLegacy = true;
              }
              return {
                ...t,
                weekNumber: weekNo,
                activityLogs: Array.isArray(t.activityLogs)
                  ? t.activityLogs
                  : t.activityLogs && typeof t.activityLogs === 'object'
                  ? Object.values(t.activityLogs)
                  : [],
              };
            });
            setTasks(formattedTasks);
            if (hasLegacy) {
              const obj: Record<string, Task> = {};
              formattedTasks.forEach((t) => {
                obj[t.id] = JSON.parse(JSON.stringify(t, (_, v) => (v === undefined ? null : v)));
              });
              set(ref(database, `${DB_ROOT_NODE}/tasks`), obj).catch(console.error);
            }
          } else {
            setTasks([]);
          }
          if (data.weeklyArchives) {
            const archivesList = Object.values(data.weeklyArchives) as WeeklyHistoryArchive[];
            setWeeklyArchives(archivesList);
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

    const notifRef = ref(database, `${DB_ROOT_NODE}/notifications/${authSession.account}`);
    let isInitial = true;

    const unsubscribe = onValue(
      notifRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const rawList = Object.values(data) as AppNotification[];
          // Deduplicate notifications (by id, and ignore exact duplicate titles within 3 seconds)
          const seenIds = new Set<string>();
          const seenSignatures = new Set<string>();
          const list: AppNotification[] = [];

          rawList.forEach((n) => {
            if (!n || !n.id) return;
            if (seenIds.has(n.id)) return;
            seenIds.add(n.id);

            // Deduplicate same event created within 3s window (e.g. from previous tests)
            const timeWindow = Math.floor(new Date(n.createdAt).getTime() / 3000);
            const signature = `${n.targetAccount}_${n.title}_${n.body}_${n.taskId || ''}_${timeWindow}`;
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
            if (!latest.isRead && isRecent) {
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
        } else {
          setNotifications([]);
        }
        isInitial = false;
      },
      (err) => {
        console.warn('Notifications listener warning:', err);
      }
    );

    return () => unsubscribe();
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
        }
      });
      if (Object.keys(updatesObj).length > 0) {
        update(ref(database), updatesObj).catch(console.error);
      }
    }
  };

  const requestNotificationPermission = async () => {
    if (!authSession) return;
    const token = await registerDeviceForPushNotifications(authSession.account);
    if (token) {
      setIsPushEnabled(true);
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
  // Leader/Admin can edit task structure, but ONLY the specific assignee can submit progress/report for that task!
  const canEditTask = (task: Task, user: User | null = authSession): boolean => {
    if (!user) return false;
    if (user.role === 'Admin' || user.role === 'Leader' || user.role === 'Advisor') return true;
    return task.assigneeAccount.toLowerCase() === user.account.toLowerCase();
  };

  // STRICT REPORT PERMISSION: ONLY ASSIGNEE CAN REPORT THIS TASK!
  const canReportTask = (task: Task, user: User | null = authSession): boolean => {
    if (!user || !task.assigneeAccount) return false;
    return task.assigneeAccount.toLowerCase() === user.account.toLowerCase();
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

  const syncTasksToFirebase = async (newTs: Task[]) => {
    const obj: Record<string, Task> = {};
    newTs.forEach((t) => { obj[t.id] = sanitizeForFirebase(t); });
    await set(ref(database, `${DB_ROOT_NODE}/tasks`), obj);
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
    syncTasksToFirebase(updatedTasks);

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
      syncTasksToFirebase(updatedTasks);
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
    const updatedTs = tasks.filter((t) => t.milestoneId !== id);
    const { renumbered } = renumberMilestonesByRole(updatedMs);
    setMilestones(renumbered);
    setTasks(updatedTs);
    syncMilestonesToFirebase(renumbered);
    syncTasksToFirebase(updatedTs);
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

    const newTask: Task = {
      ...taskData,
      id: `tsk-${Date.now()}`,
      orderInMilestone: milestoneTasks.length + 1,
      actualEffort: taskData.actualEffort || 0,
      completionPercentage: taskData.completionPercentage || 0,
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
    syncTasksToFirebase(updated);

    // Push notification to assigned member
    if (newTask.assigneeAccount) {
      const isSelf =
        newTask.assigneeAccount.toLowerCase() ===
        (authSession?.account || '').toLowerCase();
      sendPushNotification({
        targetAccount: newTask.assigneeAccount,
        title: isSelf
          ? `📋 Bạn vừa tạo task mới: ${newTask.title}`
          : `📋 Bạn có task mới từ @${authSession?.account || 'Leader'}`,
        body: `[${newTask.role || 'Task'}] ${newTask.title}`,
        taskId: newTask.id,
        senderAccount: authSession?.account,
        senderName: authSession?.name,
        type: 'TASK_ASSIGNED',
      });
    }
  };

  const updateTask = (id: string, updates: Partial<Task>, options?: { skipLog?: boolean }) => {
    const nowIso = new Date().toISOString();
    const authorName = authSession?.name || 'Thành viên';
    const authorAccount = authSession?.account || 'member';
    const authorRole = authSession?.role || 'Member';
    const updaterDisplay = `${authorName} (@${authorAccount})`;

    const updated = tasks.map((t) => {
      if (t.id !== id) return t;

      if (options?.skipLog) {
        return {
          ...t,
          ...updates,
          updatedAt: nowIso,
          updatedBy: updaterDisplay,
        };
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

      return {
        ...t,
        ...updates,
        updatedAt: nowIso,
        updatedBy: updaterDisplay,
        activityLogs: [logEntry, ...existingLogs],
      };
    });
    setTasks(updated);
    syncTasksToFirebase(updated);

    // Push notification if assignee was changed or assigned
    const currentTask = tasks.find((t) => t.id === id);
    if (
      updates.assigneeAccount &&
      currentTask &&
      updates.assigneeAccount !== currentTask.assigneeAccount
    ) {
      const isSelf =
        updates.assigneeAccount.toLowerCase() ===
        (authSession?.account || '').toLowerCase();
      sendPushNotification({
        targetAccount: updates.assigneeAccount,
        title: isSelf
          ? `🔄 Bạn vừa cập nhật phân công task: ${currentTask.title}`
          : `🔄 Bạn được giao task từ @${authSession?.account || 'Leader'}`,
        body: `[${currentTask.role || 'Task'}] ${currentTask.title}`,
        taskId: id,
        senderAccount: authSession?.account,
        senderName: authSession?.name,
        type: 'TASK_ASSIGNED',
      });
    }
  };

  const updateTaskNotes = (taskId: string, notes: string) => {
    updateTask(taskId, { notes });
    markNoteAsRead(taskId, notes);

    const task = tasks.find((t) => t.id === taskId);
    if (task?.assigneeAccount) {
      const isSelf =
        task.assigneeAccount.toLowerCase() ===
        (authSession?.account || '').toLowerCase();
      const lastLine = notes.split('\n').filter(Boolean).pop() || '';
      const cleanLine = lastLine.replace(/^\[.*?\]\s*/, '').trim();
      sendPushNotification({
        targetAccount: task.assigneeAccount,
        title: isSelf
          ? `💬 Ghi chú mới trong task của bạn`
          : `💬 @${authSession?.account || 'Thành viên'} vừa thảo luận trong task`,
        body: `[${task.title}]: "${cleanLine.slice(0, 80)}"`,
        taskId: taskId,
        senderAccount: authSession?.account,
        senderName: authSession?.name,
        type: 'TASK_NOTE',
      });
    }
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
    syncTasksToFirebase(updated);
    return newTask;
  };

  const deleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    setTasks(updated);
    syncTasksToFirebase(updated);
  };

  const deleteTasks = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    const updated = tasks.filter((t) => !idSet.has(t.id));
    setTasks(updated);
    syncTasksToFirebase(updated);
  };

  const reorderTasksInMilestone = (milestoneId: string, orderedTaskIds: string[]) => {
    const updated = tasks.map((task) => {
      if (task.milestoneId !== milestoneId) return task;
      const newIndex = orderedTaskIds.indexOf(task.id);
      if (newIndex !== -1) {
        return { ...task, orderInMilestone: newIndex + 1 };
      }
      return task;
    });
    setTasks(updated);
    syncTasksToFirebase(updated);
  };

  // Submit Task Report
  const submitTaskReport = (
    taskId: string,
    actualEffort: number,
    completionPercentage: number,
    status: TaskStatus,
    notes?: string
  ) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    const weekNo = targetTask?.weekNumber || selectedWeek;
    const year = targetTask?.year || selectedYear;
    const sundayNoon = getWeekSundayNoon(weekNo, year);
    const deadline = getWeekDeadline(weekNo, year);
    const now = new Date(simulatedTime);
    const nowIso = new Date().toISOString();

    const isSundayNoonOrLater = now.getTime() >= sundayNoon.getTime();
    const isDone = status === 'Done' || completionPercentage === 100;
    const isOfficialReport = isDone || isSundayNoonOrLater;
    const isLate = now.getTime() > deadline.getTime();

    const authorName = authSession?.name || 'Người phụ trách';
    const authorAccount = authSession?.account || 'member';
    const authorRole = authSession?.role || 'Member';
    const updaterDisplay = `${authorName} (@${authorAccount})`;

    const updated = tasks.map((t) => {
      if (t.id !== taskId) return t;

      const changes: string[] = [];
      if (status !== t.status) {
        changes.push(`Trạng thái: "${t.status}" ➔ "${status}"`);
      }
      if (completionPercentage !== t.completionPercentage) {
        changes.push(`Tiến độ: ${t.completionPercentage}% ➔ ${completionPercentage}%`);
      }
      if (actualEffort !== t.actualEffort) {
        changes.push(`Effort: ${t.actualEffort}h ➔ ${actualEffort}h`);
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

      return {
        ...t,
        actualEffort,
        completionPercentage,
        status,
        notes: notes !== undefined ? notes : t.notes,
        lastSubmittedAt: isOfficialReport ? now.toISOString() : t.lastSubmittedAt,
        isSubmittedLate: isOfficialReport ? (isDone ? false : isLate) : t.isSubmittedLate,
        updatedAt: nowIso,
        updatedBy: updaterDisplay,
        activityLogs: [logEntry, ...existingLogs],
      };
    });
    setTasks(updated);
    syncTasksToFirebase(updated);
  };

  // Request task assignment from milestone (For Member)
  const requestTaskAssignment = (taskId: string, memberAccount: string, targetWeek?: number) => {
    const targetW = targetWeek || selectedWeek + 1;
    updateTask(taskId, {
      assignmentRequestedBy: memberAccount,
      assignmentRequestStatus: 'PENDING',
      requestedWeekNumber: targetW,
      updatedAt: new Date().toISOString(),
    });

    // Notify Leaders and Admins about the assignment request
    const task = tasks.find((t) => t.id === taskId);
    const leadersAndAdmins = users.filter(
      (u) =>
        (u.role === 'Leader' || u.role === 'Admin') &&
        u.account.toLowerCase() !== memberAccount.toLowerCase()
    );
    leadersAndAdmins.forEach((leader) => {
      sendPushNotification({
        targetAccount: leader.account,
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
      weekNumber: task.requestedWeekNumber || selectedWeek + 1,
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

  // Finish Week & Rollover Unfinished Tasks to Next Week
  const finishWeekAndRollover = () => {
    const nextWeek = selectedWeek + 1;
    // Only assigned tasks are part of active weekly schedules & history
    const currentWeekAssignedTasks = tasks.filter(
      (t) => t.weekNumber === selectedWeek && t.year === selectedYear && t.assigneeAccount && t.assigneeAccount.trim() !== ''
    );

    // Separate tasks into worked (has progress/effort or Done) vs unworked (0% progress & 0h effort)
    const workedTasks = currentWeekAssignedTasks.filter((t) => !isTaskUnworked(t));
    const unworkedTasks = currentWeekAssignedTasks.filter((t) => isTaskUnworked(t));

    const completedTasksCount = workedTasks.filter((t) => t.status === 'Done').length;
    const rolledOverTasksCount = workedTasks.filter((t) => t.status !== 'Done').length;

    // Create Archive Record for current week:
    // IMPORTANT: Exclude 0%/0h unworked tasks from tasksSnapshot so they do NOT pollute historical logs!
    const archiveRecord: WeeklyHistoryArchive = {
      id: `archive-${selectedWeek}-${Date.now()}`,
      weekNumber: selectedWeek,
      year: selectedYear,
      archivedAt: new Date().toISOString(),
      completedTasksCount: completedTasksCount,
      rolledOverTasksCount: rolledOverTasksCount,
      awards: calculateWeeklyAwardsForWeek(selectedWeek, selectedYear, true),
      tasksSnapshot: JSON.parse(JSON.stringify(workedTasks)),
    };

    const updatedArchives = [...weeklyArchives, archiveRecord];
    setWeeklyArchives(updatedArchives);
    syncArchivesToFirebase(updatedArchives);

    // Update tasks array:
    // 1. Move unworked tasks (0% & 0h) directly to nextWeek (clears them from currentWeek)
    const newTasksList = tasks
      .map((t) => {
        if (t.weekNumber === selectedWeek && t.year === selectedYear && t.assigneeAccount && isTaskUnworked(t)) {
          const alreadyHasNextWeekTask = tasks.some(
            (nt) =>
              nt.id !== t.id &&
              nt.weekNumber === nextWeek &&
              nt.year === selectedYear &&
              (nt.parentTaskId === t.id || (nt.title === t.title && nt.assigneeAccount === t.assigneeAccount))
          );
          if (alreadyHasNextWeekTask) {
            return null; // Remove duplicate unworked task from current week
          }
          return {
            ...t,
            weekNumber: nextWeek,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
      .filter(Boolean) as Task[];

    // 2. For partially worked unfinished tasks, create continuation tasks for nextWeek while keeping original record in current week
    const partiallyWorkedUnfinished = currentWeekAssignedTasks.filter(
      (t) => t.status !== 'Done' && !isTaskUnworked(t)
    );

    partiallyWorkedUnfinished.forEach((t) => {
      const alreadyHasNextWeekTask = newTasksList.some(
        (nt) =>
          nt.weekNumber === nextWeek &&
          nt.year === selectedYear &&
          (nt.parentTaskId === t.id || (nt.title === t.title && nt.assigneeAccount === t.assigneeAccount))
      );
      if (!alreadyHasNextWeekTask) {
        newTasksList.push({
          ...t,
          id: `tsk-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          weekNumber: nextWeek,
          parentTaskId: t.id,
          status: 'To do',
          lastSubmittedAt: undefined,
          isSubmittedLate: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    setTasks(newTasksList);
    syncTasksToFirebase(newTasksList);

    setSelectedWeek(nextWeek);
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

    users.forEach((u) => {
      userEffortMap.set(u.account, {
        totalEffort: 0,
        count: 0,
        total: 0,
        isLate: false,
        hasUnsubmitted: false,
      });
    });

    currentWeekTasks.forEach((task) => {
      if (!task.assigneeAccount) return;
      const entry = userEffortMap.get(task.assigneeAccount) || {
        totalEffort: 0,
        count: 0,
        total: 0,
        isLate: false,
        hasUnsubmitted: false,
      };
      entry.total += 1;
      entry.totalEffort += task.actualEffort || 0;

      const isTaskDone = task.status === 'Done' || task.completionPercentage === 100;
      const isTaskReported =
        isTaskDone ||
        (!!task.lastSubmittedAt &&
          new Date(task.lastSubmittedAt).getTime() >= sundayNoon.getTime());

      if (isTaskReported) {
        entry.count += 1;
        entry.lastSubmittedAt = task.lastSubmittedAt;
        if (task.isSubmittedLate && !isTaskDone) {
          entry.isLate = true;
        }
      } else {
        entry.hasUnsubmitted = true;
        if (isPastDeadline) {
          entry.isLate = true;
        }
      }
      userEffortMap.set(task.assigneeAccount, entry);
    });

    let maxEffort = 0;
    userEffortMap.forEach((val) => {
      if (val.totalEffort > maxEffort) {
        maxEffort = val.totalEffort;
      }
    });

    const awards: WeeklyAwardSummary[] = [];

    users.forEach((u) => {
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
      return archive.awards;
    }

    return calculateWeeklyAwardsForWeek(selectedWeek, selectedYear, isFinalized);
  };

  const setSimulatedTime = (time: string) => setSimulatedTimeState(time);
  const resetSimulatedTime = () => setSimulatedTimeState(new Date().toISOString().slice(0, 16));

  const resetToDefaultData = () => {
    seedFirebaseMockData();
  };

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
        resetToDefaultData,
        isFirebaseConnected,
        confirmDialog,
        hasUnreadNote,
        markNoteAsRead,

        requestTaskAssignment,
        approveTaskAssignment,
        rejectTaskAssignment,

        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        requestNotificationPermission,
        isPushEnabled,

        theme,
        toggleTheme,
        setTheme,
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
