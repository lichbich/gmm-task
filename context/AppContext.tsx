'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Milestone, Task, TaskStatus, WeeklyAwardSummary, WeeklyHistoryArchive, RoleItem } from '../types/task';
import { INITIAL_USERS, INITIAL_MILESTONES, INITIAL_TASKS } from '../lib/mockData';
import { database, ref, onValue, set, DB_ROOT_NODE } from '../lib/firebase';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { ConfirmModal, ConfirmDialogOptions } from '../components/ConfirmModal';

export function getCurrentISOWeekAndYear(d: Date = new Date()): { week: number; year: number } {
  const date = new Date(d.valueOf());
  const dayNum = (d.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayNum + 3);
  const firstThursday = date.valueOf();
  date.setMonth(0, 1);
  if (date.getDay() !== 4) {
    date.setMonth(0, 1 + ((4 - date.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.round((firstThursday - date.valueOf()) / 604800000);
  return { week: weekNumber, year: date.getFullYear() };
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
    id: 'role-qa',
    code: 'QA',
    name: 'Quality Assurance (Kiểm thử)',
    description: 'Kiểm thử tính năng, kiểm soát chất lượng và viết test cases',
    color: 'rose',
    order: 5,
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
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;
  
  roles: RoleItem[];
  addRole: (role: Omit<RoleItem, 'id'>) => void;
  updateRole: (id: string, updates: Partial<RoleItem>) => void;
  deleteRole: (id: string) => void;
  
  milestones: Milestone[];
  addMilestone: (milestone: Omit<Milestone, 'id' | 'order'>) => void;
  updateMilestone: (id: string, milestone: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;
  
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'orderInMilestone'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_AUTH = 'gmm_task_auth_session_v2';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [roles, setRoles] = useState<RoleItem[]>(DEFAULT_ROLES);
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [weeklyArchives, setWeeklyArchives] = useState<WeeklyHistoryArchive[]>([]);
  const [authSession, setAuthSession] = useState<User | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);
  const [confirmState, setConfirmState] = useState<ConfirmDialogOptions | null>(null);

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
            setMilestones(milestoneList.sort((a, b) => a.order - b.order));
          } else {
            setMilestones([]);
          }
          if (data.tasks) {
            const taskList = Object.values(data.tasks) as Task[];
            setTasks(taskList);
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
            // Seed default roles to Firebase if node is empty
            const rolesObj: Record<string, RoleItem> = {};
            DEFAULT_ROLES.forEach((r) => { rolesObj[r.id] = r; });
            set(ref(database, `${DB_ROOT_NODE}/roles`), rolesObj).catch(console.error);
            setRoles(DEFAULT_ROLES);
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

    if (!targetUser.password || !targetUser.firstLoginCompleted) {
      return { success: true, firstTime: true, user: targetUser };
    }

    const isMatch = await verifyPassword(passwordInput || '', targetUser.password);
    if (!isMatch) {
      return { success: false, error: 'Mật khẩu không chính xác.' };
    }

    // Auto-migrate legacy plain text password to SHA-256 hash in Firebase
    const hashedPass = await hashPassword(passwordInput || '');
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
    if (user.role === 'Admin') return true;
    if (user.role === 'Leader') {
      // Leader can only edit tasks matching their specialization
      return user.specializations?.includes(task.role) || false;
    }
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
  const addUser = (userData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...userData,
      id: `usr-${Date.now()}`,
      firstLoginCompleted: false,
    };
    const updated = [...users, newUser];
    setUsers(updated);
    syncUsersToFirebase(updated);
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

  // Delete User & Unassign User Tasks
  const deleteUser = (id: string) => {
    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) return;

    const updatedUsers = users.filter((u) => u.id !== id);
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

  // Milestone Management
  const addMilestone = (milestoneData: Omit<Milestone, 'id' | 'order'>) => {
    const newMilestone: Milestone = {
      ...milestoneData,
      id: `ms-${Date.now()}`,
      order: milestones.length + 1,
    };
    const updated = [...milestones, newMilestone];
    setMilestones(updated);
    syncMilestonesToFirebase(updated);
  };

  const updateMilestone = (id: string, milestoneData: Partial<Milestone>) => {
    const updated = milestones.map((m) => (m.id === id ? { ...m, ...milestoneData } : m));
    setMilestones(updated);
    syncMilestonesToFirebase(updated);
  };

  const deleteMilestone = (id: string) => {
    const updatedMs = milestones.filter((m) => m.id !== id);
    const updatedTs = tasks.filter((t) => t.milestoneId !== id);
    setMilestones(updatedMs);
    setTasks(updatedTs);
    syncMilestonesToFirebase(updatedMs);
    syncTasksToFirebase(updatedTs);
  };

  // Task Management
  const addTask = (taskData: Omit<Task, 'id' | 'orderInMilestone'>) => {
    const milestoneTasks = tasks.filter((t) => t.milestoneId === taskData.milestoneId);
    const nowIso = new Date().toISOString();
    const creatorName = authSession
      ? `${authSession.name} (${authSession.role})`
      : 'QuynhNV (Leader)';
    const newTask: Task = {
      ...taskData,
      id: `tsk-${Date.now()}`,
      orderInMilestone: milestoneTasks.length + 1,
      actualEffort: taskData.actualEffort || 0,
      completionPercentage: taskData.completionPercentage || 0,
      weekNumber: taskData.weekNumber || selectedWeek,
      year: taskData.year || selectedYear,
      createdBy: taskData.createdBy || creatorName,
      createdAt: taskData.createdAt || nowIso,
      priority: taskData.priority || 'Medium',
      updatedAt: nowIso,
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    syncTasksToFirebase(updated);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    setTasks(updated);
    syncTasksToFirebase(updated);
  };

  const updateTaskNotes = (taskId: string, notes: string) => {
    updateTask(taskId, { notes });
    markNoteAsRead(taskId, notes);
  };

  const deleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
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
    const now = new Date(simulatedTime);
    const day = now.getDay();
    const hours = now.getHours();
    
    let isLate = false;
    if (day === 0 && hours >= 22) {
      isLate = true;
    }

    const updated = tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        actualEffort,
        completionPercentage,
        status,
        notes: notes !== undefined ? notes : t.notes,
        lastSubmittedAt: now.toISOString(),
        isSubmittedLate: isLate,
        updatedAt: new Date().toISOString(),
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

    const completedTasks = currentWeekAssignedTasks.filter((t) => t.status === 'Done');
    const unfinishedTasks = currentWeekAssignedTasks.filter((t) => t.status !== 'Done');

    // Create Archive Record for current week with full snapshot of all tasks in selectedWeek
    const archiveRecord: WeeklyHistoryArchive = {
      id: `archive-${selectedWeek}-${Date.now()}`,
      weekNumber: selectedWeek,
      year: selectedYear,
      archivedAt: new Date().toISOString(),
      completedTasksCount: completedTasks.length,
      rolledOverTasksCount: unfinishedTasks.length,
      awards: computeWeeklyAwards(),
      tasksSnapshot: JSON.parse(JSON.stringify(currentWeekAssignedTasks)),
    };

    const updatedArchives = [...weeklyArchives, archiveRecord];
    setWeeklyArchives(updatedArchives);
    syncArchivesToFirebase(updatedArchives);

    // Create continuation tasks for nextWeek for all unfinished assigned tasks while preserving current week history
    const newTasksList = [...tasks];
    unfinishedTasks.forEach((t) => {
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    setTasks(newTasksList);
    syncTasksToFirebase(newTasksList);

    setSelectedWeek(nextWeek);
  };

  // Compute Weekly Award Summaries
  const computeWeeklyAwards = (): WeeklyAwardSummary[] => {
    const currentWeekTasks = tasks.filter(
      (t) => t.weekNumber === selectedWeek && t.year === selectedYear
    );

    const userEffortMap = new Map<string, { totalEffort: number; count: number; total: number; isLate: boolean; lastSubmittedAt?: string }>();

    users.forEach((u) => {
      userEffortMap.set(u.account, {
        totalEffort: 0,
        count: 0,
        total: 0,
        isLate: false,
      });
    });

    currentWeekTasks.forEach((task) => {
      if (!task.assigneeAccount) return;
      const entry = userEffortMap.get(task.assigneeAccount) || {
        totalEffort: 0,
        count: 0,
        total: 0,
        isLate: false,
      };
      entry.total += 1;
      entry.totalEffort += task.actualEffort || 0;
      if (task.lastSubmittedAt) {
        entry.count += 1;
        entry.lastSubmittedAt = task.lastSubmittedAt;
      }
      if (task.isSubmittedLate) {
        entry.isLate = true;
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
      };

      awards.push({
        account: u.account,
        userName: u.name,
        role: u.role,
        specializations: u.specializations || ['BA'],
        totalEffort: stats.totalEffort,
        submittedCount: stats.count,
        totalTasks: stats.total,
        isTopEffort: maxEffort > 0 && stats.totalEffort === maxEffort,
        isLate: stats.isLate,
        lastSubmittedAt: stats.lastSubmittedAt,
      });
    });

    return awards.sort((a, b) => b.totalEffort - a.totalEffort);
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
        deleteUser,
        roles,
        addRole,
        updateRole,
        deleteRole,
        milestones,
        addMilestone,
        updateMilestone,
        deleteMilestone,
        tasks,
        addTask,
        updateTask,
        deleteTask,
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
