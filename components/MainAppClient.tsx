'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import { Header, MainSectionType, UserSubTabType } from './Header';
import { Sidebar } from './Sidebar';
import { SahoToaster } from './common/SahoToast';
import { WorkScheduleTable } from './WorkScheduleTable';
import { MilestonesView } from './MilestonesView';
import { TicketsView } from './TicketsView';
import { KanbanBoard } from './KanbanBoard';
import { AwardLeaderboard } from './AwardLeaderboard';
import { WorkHistoryView } from './WorkHistoryView';
import { NextWeekDefineView } from './NextWeekDefineView';
import { UserManagementView } from './UserManagementView';
import { ResourceManagerView } from './ResourceManagerView';
import { TaskModal } from './TaskModal';
import { TaskDetailModal } from './TaskDetailModal';
import { WeeklyReportModal } from './WeeklyReportModal';
import { LoginModal } from './LoginModal';
import { QuickResourceFloatingButton } from './QuickResourceFloatingButton';
import { ScrollToTopButton } from './ScrollToTopButton';
import { AutoUpdateBanner } from './AutoUpdateBanner';
import { AIAssistantDrawer } from './AIAssistantDrawer';
import { NewFeatureTourBanner } from './common/NewFeatureTourBanner';
import { Task } from '../types/task';
import {
  parseSahoRoute,
  getPagePath,
  getPageTitleForPath,
  pushPageUrl,
  replacePageUrl,
  setCurrentBasePath,
  findTaskByRouteIdentifier,
} from '../lib/sahoUrl';

const VALID_TASK_TABS = ['schedule', 'milestones', 'tickets', 'kanban', 'awards', 'history', 'nextweek'];
const VALID_MAIN_SECTIONS: MainSectionType[] = ['tasks', 'resources', 'users'];

function getInitialMainSection(): MainSectionType {
  if (typeof window === 'undefined') return 'tasks';
  try {
    const parsed = parseSahoRoute(window.location.pathname, window.location.search);
    if (parsed.section && VALID_MAIN_SECTIONS.includes(parsed.section)) {
      return parsed.section;
    }
    localStorage.removeItem('saho_active_main_section');
    const saved = sessionStorage.getItem('saho_active_main_section') as MainSectionType;
    if (saved && VALID_MAIN_SECTIONS.includes(saved)) {
      return saved;
    }
  } catch {}
  return 'tasks';
}

function getInitialTaskTab(): string {
  if (typeof window === 'undefined') return 'schedule';
  try {
    const parsed = parseSahoRoute(window.location.pathname, window.location.search);
    if (parsed.taskTab && VALID_TASK_TABS.includes(parsed.taskTab)) {
      return parsed.taskTab;
    }
    localStorage.removeItem('saho_active_task_tab');
    const saved = sessionStorage.getItem('saho_active_task_tab');
    if (saved && VALID_TASK_TABS.includes(saved)) {
      return saved;
    }
  } catch {}
  return 'schedule';
}

function getInitialUserSubTab(): UserSubTabType {
  if (typeof window === 'undefined') return 'USERS';
  try {
    const parsed = parseSahoRoute(window.location.pathname, window.location.search);
    if (parsed.userSubTab) {
      return parsed.userSubTab;
    }
    const saved = sessionStorage.getItem('saho_active_user_tab') as UserSubTabType;
    if (saved === 'USERS' || saved === 'ROLES' || saved === 'PERMISSIONS') {
      return saved;
    }
  } catch {}
  return 'USERS';
}

function MainApp() {
  const { authSession, tasks, weeklyArchives } = useApp();
  const [activeMainSection, setActiveMainSection] = useState<MainSectionType>(getInitialMainSection);
  const [activeTaskTab, setActiveTaskTab] = useState<string>(getInitialTaskTab);
  const [activeUserSubTab, setActiveUserSubTab] = useState<UserSubTabType>(getInitialUserSubTab);
  const effectiveUserSubTab: UserSubTabType =
    authSession?.role === 'Admin' ? activeUserSubTab : 'USERS';
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([getInitialTaskTab()]));
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('saho_sidebar_collapsed') === 'true';
      } catch {}
    }
    return false;
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [loginOverlayActive, setLoginOverlayActive] = useState(false);
  const [workspaceRevealed, setWorkspaceRevealed] = useState(true);

  const handleToggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('saho_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTaskTab)) return prev;
      const next = new Set(prev);
      next.add(activeTaskTab);
      return next;
    });
  }, [activeTaskTab]);

  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  const [selectedTicketIdForView, setSelectedTicketIdForView] = useState<string | null>(null);
  const [reportingTask, setReportingTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [taskModalDefaultWeek, setTaskModalDefaultWeek] = useState<number | undefined>(undefined);
  const [taskModalDefaultAssignee, setTaskModalDefaultAssignee] = useState<string | undefined>(undefined);
  const [taskModalDefaultRole, setTaskModalDefaultRole] = useState<string | undefined>(undefined);
  const [taskModalDefaultMilestoneId, setTaskModalDefaultMilestoneId] = useState<string | undefined>(undefined);
  const [taskModalInitialSubtaskParent, setTaskModalInitialSubtaskParent] = useState<Task | null>(null);
  const deepLinkConsumedRef = React.useRef<boolean>(false);
  const wasAuthenticatedRef = React.useRef<boolean>(Boolean(authSession));
  const postLoginRedirectRef = React.useRef<string | null>(null);

  const handleOpenTaskModal = (
    task?: Task,
    defaultWeek?: number,
    defaultAssignee?: string,
    defaultRole?: string,
    initialSubtaskParent?: Task,
    defaultMilestoneId?: string
  ) => {
    setSelectedTaskForEdit(task || null);
    setTaskModalDefaultWeek(defaultWeek);
    setTaskModalDefaultAssignee(defaultAssignee);
    setTaskModalDefaultRole(defaultRole);
    setTaskModalDefaultMilestoneId(defaultMilestoneId);
    setTaskModalInitialSubtaskParent(initialSubtaskParent || null);
    setIsTaskModalOpen(true);
  };

  // Đóng modal khi tour hướng dẫn được khởi động
  useEffect(() => {
    const handleCloseAll = () => {
      setSelectedTaskForDetail(null);
      setIsTaskModalOpen(false);
      setSelectedTicketIdForView(null);
      setReportingTask(null);
    };
    window.addEventListener('saho-close-all-modals', handleCloseAll);
    return () => window.removeEventListener('saho-close-all-modals', handleCloseAll);
  }, []);

  const handleSelectTaskFromNotification = useCallback(
    (targetId: string, notif?: any) => {
      const cleanId = targetId ? String(targetId).trim() : '';

      // Check if this is a Ticket notification
      const isTicket =
        Boolean(notif?.ticketId) ||
        cleanId.startsWith('ticket-') ||
        cleanId.startsWith('REQ-') ||
        notif?.type?.startsWith('TICKET_');

      if (isTicket) {
        setActiveMainSection('tasks');
        setActiveTaskTab('tickets');
        setSelectedTicketIdForView(notif?.ticketId || cleanId);
        return;
      }

      const rawId = cleanId.toLowerCase();
      const strippedId = rawId.replace(/^tsk-/, '');

      // 1. Search in current tasks
      let target = cleanId
        ? tasks.find((t) => {
            const tId = String(t.id).trim().toLowerCase();
            const tCode = String(t.code || '').trim().toLowerCase();
            return tId === rawId || tId.replace(/^tsk-/, '') === strippedId || (tCode && tCode === rawId);
          })
        : undefined;

      // 2. Search in weeklyArchives if not found in current tasks
      if (!target && cleanId && weeklyArchives) {
        for (const archive of weeklyArchives) {
          if (Array.isArray(archive.tasksSnapshot)) {
            const found = archive.tasksSnapshot.find((t: Task) => {
              const tId = String(t.id).trim().toLowerCase();
              const tCode = String(t.code || '').trim().toLowerCase();
              return tId === rawId || tId.replace(/^tsk-/, '') === strippedId || (tCode && tCode === rawId);
            });
            if (found) {
              target = found;
              break;
            }
          }
        }
      }

      // 3. Fallback search by title
      if (!target && notif) {
        const searchTitle = (notif.title || notif.body || '').toLowerCase();
        target = tasks.find((t) => t.title && searchTitle.includes(t.title.toLowerCase()));
      }

      if (target) {
        const isLeaderOrAdmin =
          authSession?.role === 'Leader' ||
          authSession?.role === 'Admin' ||
          authSession?.role === 'Advisor';

        const notifText = `${notif?.title || ''} ${notif?.body || ''}`.toLowerCase();
        const isRequestNotif =
          notifText.includes('yêu cầu nhận task') ||
          notifText.includes('gửi yêu cầu') ||
          notifText.includes('xin nhận task');

        const hasPendingRequest =
          Boolean(target.assignmentRequestedBy) && target.assignmentRequestStatus !== 'REJECTED';

        // When a Leader / Admin clicks a member's task request notification, open TaskModal directly
        // with the requester auto-selected so they can review and assign in 1 click!
        if (isLeaderOrAdmin && (isRequestNotif || hasPendingRequest)) {
          setSelectedTaskForDetail(null);
          handleOpenTaskModal(
            target,
            target.requestedWeekNumber || target.weekNumber,
            target.assignmentRequestedBy || target.assigneeAccount
          );
        } else {
          setSelectedTaskForDetail(target);
        }
      }
    },
    [tasks, weeklyArchives, authSession]
  );

  // Auto-handle notification click target from URL or ServiceWorker message
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Check URL parameters & Pathname (e.g. from system notification tap, /task/:id path, or ?taskId= link)
    const params = new URLSearchParams(window.location.search);
    let openTaskId = params.get('openTaskId') || params.get('taskId') || params.get('task');
    const openTicketId = params.get('openTicketId') || params.get('ticketId') || params.get('ticket');
    const tab = params.get('tab');
    const sectionParam = params.get('section');

    // Also support bare /task/:id or /tasks/:id (excluding /task/create or /task/:id/edit|update|discuss)
    if (!openTaskId) {
      const pathMatch = window.location.pathname.match(/^\/tasks?\/([^/?#]+)\/?$/i);
      if (pathMatch && pathMatch[1] && pathMatch[1].toLowerCase() !== 'create') {
        openTaskId = decodeURIComponent(pathMatch[1]);
      }
    }

    if (openTicketId) {
      setActiveMainSection('tasks');
      setActiveTaskTab('tickets');
      setSelectedTicketIdForView(openTicketId);
      try {
        sessionStorage.setItem('saho_active_main_section', 'tasks');
        sessionStorage.setItem('saho_active_task_tab', 'tickets');
      } catch {}
      const url = new URL(window.location.href);
      url.searchParams.delete('openTicketId');
      url.searchParams.delete('ticketId');
      url.searchParams.delete('ticket');
      url.searchParams.delete('tab');
      url.searchParams.delete('section');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    } else if (openTaskId && (tasks.length > 0 || (weeklyArchives && weeklyArchives.length > 0))) {
      setActiveMainSection('tasks');
      handleSelectTaskFromNotification(openTaskId);
      const url = new URL(window.location.href);
      url.searchParams.delete('openTaskId');
      url.searchParams.delete('taskId');
      url.searchParams.delete('task');
      url.searchParams.delete('tab');
      url.searchParams.delete('section');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    } else if (tab || sectionParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      url.searchParams.delete('section');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    }

    // 2. Listen to message from Service Worker (when a notification is clicked while tab is already open)
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OPEN_TASK_NOTIFICATION') {
        if (event.data.ticketId) {
          setActiveMainSection('tasks');
          setActiveTaskTab('tickets');
          setSelectedTicketIdForView(event.data.ticketId);
        } else if (event.data.taskId) {
          handleSelectTaskFromNotification(event.data.taskId);
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, [tasks, weeklyArchives, handleSelectTaskFromNotification]);

  const handleSetActiveTaskTab = (tab: string) => {
    if (tab !== 'tickets') {
      setSelectedTicketIdForView(null);
    }
    setActiveTaskTab(tab);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('saho_active_task_tab', tab);
      } catch {}
      pushPageUrl(getPagePath('tasks', tab));
    }
  };

  const handleSetActiveUserSubTab = (subTab: UserSubTabType) => {
    const resolved: UserSubTabType = authSession?.role === 'Admin' ? subTab : 'USERS';
    setSelectedTicketIdForView(null);
    setActiveMainSection('users');
    setActiveUserSubTab(resolved);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('saho_active_main_section', 'users');
        sessionStorage.setItem('saho_active_user_tab', resolved);
      } catch {}
      pushPageUrl(getPagePath('users', activeTaskTab, resolved));
    }
  };

  const handleSetActiveMainSection = (section: MainSectionType) => {
    if (section !== 'tasks') {
      setSelectedTicketIdForView(null);
    }
    setActiveMainSection(section);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('saho_active_main_section', section);
      } catch {}
      pushPageUrl(
        getPagePath(
          section,
          activeTaskTab,
          section === 'users' ? effectiveUserSubTab : undefined
        )
      );
    }
  };

  // Keep /login synced when unauthenticated, and base path + Browser Back/Forward URL sync active when authenticated
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!authSession) {
      const currentFull = window.location.pathname + window.location.search;
      if (
        !wasAuthenticatedRef.current &&
        window.location.pathname !== '/' &&
        window.location.pathname !== '/login' &&
        !postLoginRedirectRef.current
      ) {
        postLoginRedirectRef.current = currentFull;
      }

      if (wasAuthenticatedRef.current) {
        wasAuthenticatedRef.current = false;
        postLoginRedirectRef.current = null;
      }

      if (window.location.pathname !== '/login') {
        window.history.replaceState({ sahoLogin: true }, '', '/login');
      }
      document.title = getPageTitleForPath('/login');
      return;
    }

    wasAuthenticatedRef.current = true;
    if (postLoginRedirectRef.current) {
      window.history.replaceState({}, '', postLoginRedirectRef.current);
      postLoginRedirectRef.current = null;
    }

    const initialParsed = parseSahoRoute(window.location.pathname, window.location.search);
    const defaultPath = getPagePath(
      activeMainSection,
      activeTaskTab,
      activeMainSection === 'users' ? effectiveUserSubTab : undefined
    );

    if (initialParsed.isRoot || initialParsed.isLogin) {
      replacePageUrl(defaultPath, getPageTitleForPath(defaultPath));
    } else if (!initialParsed.modal) {
      const targetPath =
        initialParsed.section === 'users' && authSession.role !== 'Admin'
          ? '/users'
          : window.location.pathname + window.location.search;
      if (targetPath !== window.location.pathname + window.location.search) {
        replacePageUrl(targetPath, getPageTitleForPath(targetPath));
      } else {
        setCurrentBasePath(targetPath, getPageTitleForPath(window.location.pathname));
      }
    } else {
      setCurrentBasePath(defaultPath, getPageTitleForPath(defaultPath));
    }

    const handlePopState = () => {
      const parsed = parseSahoRoute(window.location.pathname, window.location.search);
      if (parsed.modal) return;
      if (parsed.isRoot || parsed.isLogin) {
        const fallback = getPagePath('tasks', 'schedule');
        setActiveMainSection('tasks');
        setActiveTaskTab('schedule');
        replacePageUrl(fallback, getPageTitleForPath(fallback));
        return;
      }
      if (parsed.section && VALID_MAIN_SECTIONS.includes(parsed.section)) {
        setActiveMainSection(parsed.section);
      }
      if (parsed.taskTab && VALID_TASK_TABS.includes(parsed.taskTab)) {
        setActiveTaskTab(parsed.taskTab);
      }
      if (parsed.userSubTab) {
        setActiveUserSubTab(authSession.role === 'Admin' ? parsed.userSubTab : 'USERS');
      }
      const nextPath = window.location.pathname;
      setCurrentBasePath(nextPath, getPageTitleForPath(nextPath));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [authSession]);

  // Deep-link initial consumption for /task/* and /profile routes
  useEffect(() => {
    if (typeof window === 'undefined' || !authSession || deepLinkConsumedRef.current) return;
    const parsed = parseSahoRoute(window.location.pathname, window.location.search);
    if (!parsed.modal) {
      deepLinkConsumedRef.current = true;
      return;
    }

    const m = parsed.modal;
    if (m.kind === 'profile') {
      deepLinkConsumedRef.current = true;
      setIsProfileModalOpen(true);
      return;
    }

    if (m.kind === 'task-create') {
      if (m.parentId && tasks.length === 0) return;
      deepLinkConsumedRef.current = true;
      const parent = m.parentId
        ? findTaskByRouteIdentifier(m.parentId, tasks, weeklyArchives)
        : undefined;
      handleOpenTaskModal(
        undefined,
        m.week && !Number.isNaN(m.week) ? m.week : undefined,
        m.assignee,
        m.role,
        parent,
        m.milestoneId
      );
      return;
    }

    if (
      (m.kind === 'task-detail' ||
        m.kind === 'task-edit' ||
        m.kind === 'task-update' ||
        m.kind === 'task-discuss') &&
      m.id
    ) {
      if (tasks.length === 0 && (!weeklyArchives || weeklyArchives.length === 0)) return;
      const target = findTaskByRouteIdentifier(m.id, tasks, weeklyArchives);
      deepLinkConsumedRef.current = true;
      if (!target) return;
      if (m.kind === 'task-edit') {
        handleOpenTaskModal(target);
      } else if (m.kind === 'task-update') {
        setReportingTask(target);
      } else {
        setSelectedTaskForDetail(target);
      }
    }
  }, [authSession, tasks, weeklyArchives]);

  return (
    <div
      suppressHydrationWarning
      style={{ '--saho-sidebar-width': sidebarCollapsed ? '68px' : '256px' } as React.CSSProperties}
      className="min-h-screen bg-[#F3F4F7] dark:bg-[#080c14] text-[#1D202A] dark:text-slate-100 font-sans antialiased selection:bg-[#E6F7FF] selection:text-[#096DD9] relative"
    >
      {/* Full-Screen Saho Login & Smooth Enter Transition */}
      {(!authSession || loginOverlayActive) && (
        <LoginModal
          isAuthenticated={Boolean(authSession)}
          onLoginStart={() => {
            setLoginOverlayActive(true);
            setWorkspaceRevealed(false);
          }}
          onLoginAbort={() => {
            setLoginOverlayActive(false);
            setWorkspaceRevealed(true);
          }}
          onLoginRevealStart={() => {
            setWorkspaceRevealed(true);
          }}
          onLoginTransitionEnd={() => {
            setLoginOverlayActive(false);
            setWorkspaceRevealed(true);
          }}
        />
      )}

      {authSession && (
        <div
          className={`w-full min-h-screen flex flex-col transition-opacity duration-500 ease-out ${
            workspaceRevealed ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Sidebar
            activeMainSection={activeMainSection}
            setActiveMainSection={handleSetActiveMainSection}
            activeTaskTab={activeTaskTab}
            setActiveTaskTab={handleSetActiveTaskTab}
            activeUserSubTab={effectiveUserSubTab}
            setActiveUserSubTab={handleSetActiveUserSubTab}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={handleToggleSidebarCollapsed}
            mobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
            onOpenProfile={() => setIsProfileModalOpen(true)}
          />

          <div
            className={`flex-1 min-w-0 flex flex-col min-h-screen transition-[padding] duration-200 ${
              sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[256px]'
            }`}
          >
            <Header
              activeMainSection={activeMainSection}
              setActiveMainSection={handleSetActiveMainSection}
              activeTaskTab={activeTaskTab}
              setActiveTaskTab={handleSetActiveTaskTab}
              activeUserSubTab={effectiveUserSubTab}
              setActiveUserSubTab={handleSetActiveUserSubTab}
              onSelectTask={handleSelectTaskFromNotification}
              onOpenMobileMenu={() => setMobileSidebarOpen(true)}
              isProfileModalOpenExternal={isProfileModalOpen}
              setIsProfileModalOpenExternal={setIsProfileModalOpen}
            />

            <main
              className={`flex-1 max-w-[1440px] w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 pb-24 md:pb-8 transition-opacity duration-500 ease-out ${
                workspaceRevealed ? 'opacity-100' : 'opacity-0'
              }`}
            >
            {/* MAIN SECTION 1: TASK MANAGEMENT */}
            {activeMainSection === 'tasks' && (
              <div>
                {visitedTabs.has('schedule') && (
                  <div className={activeTaskTab === 'schedule' ? 'block' : 'hidden'}>
                    <WorkScheduleTable onOpenTaskModal={handleOpenTaskModal} />
                  </div>
                )}
                {visitedTabs.has('milestones') && (
                  <div className={activeTaskTab === 'milestones' ? 'block' : 'hidden'}>
                    <MilestonesView />
                  </div>
                )}
                {visitedTabs.has('tickets') && (
                  <div className={activeTaskTab === 'tickets' ? 'block' : 'hidden'}>
                    <TicketsView
                      initialSelectedTicketId={selectedTicketIdForView}
                      onClearInitialTicketId={() => setSelectedTicketIdForView(null)}
                    />
                  </div>
                )}
                {visitedTabs.has('nextweek') && (
                  <div className={activeTaskTab === 'nextweek' ? 'block' : 'hidden'}>
                    <NextWeekDefineView onOpenTaskModal={handleOpenTaskModal} />
                  </div>
                )}
                {visitedTabs.has('kanban') && (
                  <div className={activeTaskTab === 'kanban' ? 'block' : 'hidden'}>
                    <KanbanBoard onOpenTaskModal={handleOpenTaskModal} />
                  </div>
                )}
                {visitedTabs.has('awards') && (
                  <div className={activeTaskTab === 'awards' ? 'block' : 'hidden'}>
                    <AwardLeaderboard />
                  </div>
                )}
                {visitedTabs.has('history') && (
                  <div className={activeTaskTab === 'history' ? 'block' : 'hidden'}>
                    <WorkHistoryView onOpenTaskModal={handleOpenTaskModal} />
                  </div>
                )}
              </div>
            )}

            {/* MAIN SECTION 2: RESOURCE MANAGEMENT */}
            {activeMainSection === 'resources' && (
              <div>
                <ResourceManagerView />
              </div>
            )}

            {/* MAIN SECTION 3: SYSTEM / USER MANAGEMENT */}
            {activeMainSection === 'users' && (
              <div>
                <UserManagementView
                  activeSubTab={effectiveUserSubTab}
                  onChangeSubTab={handleSetActiveUserSubTab}
                />
              </div>
            )}
          </main>
          </div>

          {/* Quick Resource Floating Action Button */}
          <QuickResourceFloatingButton
            onNavigateToResourceManager={() => handleSetActiveMainSection('resources')}
          />

          {/* Scroll To Top Floating Button */}
          <ScrollToTopButton />

          {/* Task Creation / Edit Modal */}
          <TaskModal
            task={selectedTaskForEdit}
            isOpen={isTaskModalOpen}
            defaultWeek={taskModalDefaultWeek}
            defaultAssignee={taskModalDefaultAssignee}
            initialRole={taskModalDefaultRole}
            initialMilestoneId={taskModalDefaultMilestoneId}
            initialSubtaskParent={taskModalInitialSubtaskParent}
            onOpenReport={(t) => {
              setIsTaskModalOpen(false);
              setSelectedTaskForEdit(null);
              setReportingTask(t);
            }}
            onOpenCreateSubtask={(parent) => {
              handleOpenTaskModal(undefined, parent.weekNumber, undefined, parent.role, parent);
            }}
            onSelectTaskToEdit={(st) => {
              handleOpenTaskModal(st);
            }}
            onClose={() => {
              setIsTaskModalOpen(false);
              setSelectedTaskForEdit(null);
              setTaskModalDefaultWeek(undefined);
              setTaskModalDefaultAssignee(undefined);
              setTaskModalDefaultRole(undefined);
              setTaskModalDefaultMilestoneId(undefined);
              setTaskModalInitialSubtaskParent(null);
            }}
          />

          {/* Task Detail Modal (from notifications / details) */}
          <TaskDetailModal
            task={selectedTaskForDetail}
            isOpen={!!selectedTaskForDetail}
            onClose={() => setSelectedTaskForDetail(null)}
            onOpenReport={(t) => {
              setSelectedTaskForDetail(null);
              setReportingTask(t);
            }}
            onEditTask={(taskToEdit) => {
              setSelectedTaskForDetail(null);
              handleOpenTaskModal(
                taskToEdit,
                taskToEdit.requestedWeekNumber || taskToEdit.weekNumber,
                taskToEdit.assignmentRequestedBy || taskToEdit.assigneeAccount
              );
            }}
          />

          {/* Weekly Report Modal */}
          <WeeklyReportModal
            task={reportingTask}
            isOpen={!!reportingTask}
            onClose={() => setReportingTask(null)}
          />
        </div>
      )}

      {/* Floating Auto Update Banner */}
      <AutoUpdateBanner />

      {/* Floating New Feature Tour Announcement Banner (Tạm thời ẩn theo yêu cầu) */}
      {/* <NewFeatureTourBanner setActiveTaskTab={handleSetActiveTaskTab} /> */}

      {/* Floating AI Project Intelligence Assistant (Admin/Leader) */}
      <AIAssistantDrawer />

      {/* Global Saho Toast Portal */}
      <SahoToaster />
    </div>
  );
}

export function MainAppClient() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
