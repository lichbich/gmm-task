'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Milestone, Task, TaskStatus, WeeklyAwardSummary, WeeklyHistoryArchive } from '../types/task';
import { INITIAL_USERS, INITIAL_MILESTONES, INITIAL_TASKS } from '../lib/mockData';
import { database, ref, onValue, set, DB_ROOT_NODE } from '../lib/firebase';

interface LoginResult {
  success: boolean;
  firstTime?: boolean;
  user?: User;
  error?: string;
}

interface AppContextType {
  currentUser: User | null;
  authSession: User | null;
  login: (account: string, password?: string) => LoginResult;
  setupFirstTimePassword: (userId: string, newPassword: string) => Promise<boolean>;
  logout: () => void;
  
  users: User[];
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;
  
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_AUTH = 'gmm_task_auth_session_v2';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [weeklyArchives, setWeeklyArchives] = useState<WeeklyHistoryArchive[]>([]);
  const [authSession, setAuthSession] = useState<User | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  const [simulatedTime, setSimulatedTimeState] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );

  const [selectedWeek, setSelectedWeek] = useState<number>(37);
  const [selectedYear, setSelectedYear] = useState<number>(2026);

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
          }
          if (data.tasks) {
            const taskList = Object.values(data.tasks) as Task[];
            setTasks(taskList);
          }
          if (data.weeklyArchives) {
            const archivesList = Object.values(data.weeklyArchives) as WeeklyHistoryArchive[];
            setWeeklyArchives(archivesList);
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

      const milestonesObj: Record<string, Milestone> = {};
      INITIAL_MILESTONES.forEach((m) => { milestonesObj[m.id] = m; });

      const tasksObj: Record<string, Task> = {};
      INITIAL_TASKS.forEach((t) => { tasksObj[t.id] = t; });

      await set(ref(database, `${DB_ROOT_NODE}`), {
        users: usersObj,
        milestones: milestonesObj,
        tasks: tasksObj,
        weeklyArchives: {},
      });
    } catch (e) {
      console.error('Failed to seed Firebase data', e);
    }
  };

  // Auth Operations
  const login = (accountInput: string, passwordInput?: string): LoginResult => {
    const targetUser = users.find(
      (u) => u.account.toLowerCase() === accountInput.trim().toLowerCase()
    );

    if (!targetUser) {
      return { success: false, error: 'Không tìm thấy tên tài khoản trong hệ thống.' };
    }

    if (!targetUser.password || !targetUser.firstLoginCompleted) {
      return { success: true, firstTime: true, user: targetUser };
    }

    if (targetUser.password !== passwordInput) {
      return { success: false, error: 'Mật khẩu không chính xác.' };
    }

    setAuthSession(targetUser);
    localStorage.setItem(LOCAL_STORAGE_AUTH, JSON.stringify(targetUser));
    return { success: true, user: targetUser };
  };

  const setupFirstTimePassword = async (userId: string, newPassword: string): Promise<boolean> => {
    try {
      const updatedUser = users.find((u) => u.id === userId);
      if (!updatedUser) return false;

      const newUser: User = {
        ...updatedUser,
        password: newPassword,
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

  const logout = () => {
    setAuthSession(null);
    localStorage.removeItem(LOCAL_STORAGE_AUTH);
  };

  // Permission Checks:
  // Leader/Admin can edit task structure, but ONLY the specific assignee can submit progress/report for that task!
  const canEditTask = (task: Task, user: User | null = authSession): boolean => {
    if (!user) return false;
    if (user.role === 'Admin' || user.role === 'Leader') return true;
    return task.assigneeAccount.toLowerCase() === user.account.toLowerCase();
  };

  // STRICT REPORT PERMISSION: ONLY ASSIGNEE CAN REPORT THIS TASK!
  const canReportTask = (task: Task, user: User | null = authSession): boolean => {
    if (!user || !task.assigneeAccount) return false;
    return task.assigneeAccount.toLowerCase() === user.account.toLowerCase();
  };

  const syncUsersToFirebase = async (newUsers: User[]) => {
    const obj: Record<string, User> = {};
    newUsers.forEach((u) => { obj[u.id] = u; });
    await set(ref(database, `${DB_ROOT_NODE}/users`), obj);
  };

  const syncMilestonesToFirebase = async (newMs: Milestone[]) => {
    const obj: Record<string, Milestone> = {};
    newMs.forEach((m) => { obj[m.id] = m; });
    await set(ref(database, `${DB_ROOT_NODE}/milestones`), obj);
  };

  const syncTasksToFirebase = async (newTs: Task[]) => {
    const obj: Record<string, Task> = {};
    newTs.forEach((t) => { obj[t.id] = t; });
    await set(ref(database, `${DB_ROOT_NODE}/tasks`), obj);
  };

  // Helper: remove undefined values so Firebase doesn't reject the payload
  // Note: <T,> trailing comma is required in .tsx to disambiguate from JSX
  const sanitizeForFirebase = <T,>(data: T): T =>
    JSON.parse(JSON.stringify(data, (_, v) => (v === undefined ? null : v)));

  const syncArchivesToFirebase = async (archives: WeeklyHistoryArchive[]) => {
    const obj: Record<string, WeeklyHistoryArchive> = {};
    archives.forEach((a) => { obj[a.id] = sanitizeForFirebase(a); });
    await set(ref(database, `${DB_ROOT_NODE}/weeklyArchives`), obj);
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
        return { ...t, assigneeAccount: '' }; // Preserve completionPercentage & actualEffort
      }
      return t;
    });

    setTasks(updatedTasks);
    syncTasksToFirebase(updatedTasks);
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
    const newTask: Task = {
      ...taskData,
      id: `tsk-${Date.now()}`,
      orderInMilestone: milestoneTasks.length + 1,
      actualEffort: taskData.actualEffort || 0,
      completionPercentage: taskData.completionPercentage || 0,
      weekNumber: taskData.weekNumber || selectedWeek,
      year: taskData.year || selectedYear,
      updatedAt: new Date().toISOString(),
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

  // Finish Week & Rollover Unfinished Tasks to Next Week
  const finishWeekAndRollover = () => {
    const nextWeek = selectedWeek + 1;
    const currentWeekTasks = tasks.filter(
      (t) => t.weekNumber === selectedWeek && t.year === selectedYear
    );

    const completedTasks = currentWeekTasks.filter((t) => t.status === 'Done');
    const unfinishedTasks = currentWeekTasks.filter((t) => t.status !== 'Done');

    // Create Archive Record for current week
    const archiveRecord: WeeklyHistoryArchive = {
      id: `archive-${selectedWeek}-${Date.now()}`,
      weekNumber: selectedWeek,
      year: selectedYear,
      archivedAt: new Date().toISOString(),
      completedTasksCount: completedTasks.length,
      rolledOverTasksCount: unfinishedTasks.length,
      awards: computeWeeklyAwards(),
    };

    const updatedArchives = [...weeklyArchives, archiveRecord];
    setWeeklyArchives(updatedArchives);
    syncArchivesToFirebase(updatedArchives);

    // Duplicate unfinished tasks to nextWeek (rollover)
    const rolledOverNewTasks: Task[] = unfinishedTasks.map((t) => ({
      ...t,
      id: `tsk-w${nextWeek}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      weekNumber: nextWeek,
      year: selectedYear,
      updatedAt: new Date().toISOString(),
    }));

    const finalTasks = [...tasks, ...rolledOverNewTasks];
    setTasks(finalTasks);
    syncTasksToFirebase(finalTasks);

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
        logout,
        users,
        addUser,
        updateUser,
        deleteUser,
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
      }}
    >
      {children}
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
