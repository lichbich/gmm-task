'use client';

import React, { useMemo, useState } from 'react';
import { useApp, getCurrentISOWeekAndYear } from '../context/AppContext';
import { UserProfileModal } from './UserProfileModal';
import { NotificationBell } from './NotificationBell';
import { UserAvatar } from './common/UserAvatar';
import type { MainSectionType, TaskTabType, UserSubTabType } from './Sidebar';
import {
  Menu,
  Home,
  Sun,
  Moon,
  LogOut,
  CalendarDays,
  Flag,
  Ticket,
  Columns3,
  Trophy,
  History,
  FolderGit2,
  Users,
} from 'lucide-react';
import { AppNotification } from '../types/notification';
import { DB_ROOT_NODE, IS_TEST_DB } from '../lib/firebase';

export type { MainSectionType, TaskTabType, UserSubTabType };

interface HeaderProps {
  activeMainSection: MainSectionType;
  setActiveMainSection: (section: MainSectionType) => void;
  activeTaskTab: string;
  setActiveTaskTab: (tab: string) => void;
  activeUserSubTab?: UserSubTabType;
  setActiveUserSubTab?: (tab: UserSubTabType) => void;
  onSelectTask?: (taskId: string, notification?: AppNotification) => void;
  onOpenMobileMenu?: () => void;
  isProfileModalOpenExternal?: boolean;
  setIsProfileModalOpenExternal?: (open: boolean) => void;
}

const SECTION_LABELS: Record<MainSectionType, string> = {
  tasks: 'Quản Lý Task',
  resources: 'Quản Lý Resource',
  users: 'Hệ Thống',
};

const USER_TAB_LABELS: Record<UserSubTabType, string> = {
  USERS: 'Danh Sách Thành Viên',
  ROLES: 'Role & Chuyên Môn',
  PERMISSIONS: 'Phân Quyền',
};

const TASK_TAB_LABELS: Record<string, string> = {
  schedule: 'Work Schedules',
  milestones: 'Milestones & Break Tasks',
  tickets: 'Request',
  kanban: 'Bảng Kanban',
  awards: 'Thưởng & Cảnh Báo',
  history: 'Lịch Sử Công Việc',
  nextweek: 'Định Nghĩa Tuần Sau',
};

export const Header: React.FC<HeaderProps> = ({
  activeMainSection,
  setActiveMainSection,
  activeTaskTab,
  setActiveTaskTab,
  activeUserSubTab = 'USERS',
  setActiveUserSubTab,
  onSelectTask,
  onOpenMobileMenu,
  isProfileModalOpenExternal,
  setIsProfileModalOpenExternal,
}) => {
  const {
    currentUser,
    logout,
    theme: currentTheme,
    toggleTheme,
    tickets,
    simulatedTime,
  } = useApp();

  const [internalProfileOpen, setInternalProfileOpen] = useState(false);

  const isProfileOpen =
    isProfileModalOpenExternal !== undefined
      ? isProfileModalOpenExternal
      : internalProfileOpen;
  const setProfileOpen =
    setIsProfileModalOpenExternal !== undefined
      ? setIsProfileModalOpenExternal
      : setInternalProfileOpen;

  const { week: currentWeek } = useMemo(() => {
    const baseDate = simulatedTime ? new Date(simulatedTime) : new Date();
    return getCurrentISOWeekAndYear(Number.isNaN(baseDate.getTime()) ? new Date() : baseDate);
  }, [simulatedTime]);

  // Count open tickets for current user's team / user (for mobile bottom bar badge)
  const openTicketsCount =
    currentUser && tickets
      ? tickets.filter((t) => {
        if (t.status !== 'Open') return false;
        const userAccount = (currentUser.account || '').toLowerCase();
        if (t.fromAccount.toLowerCase() === userAccount) return false;

        const isToMyTeam = currentUser.specializations?.some((s) => {
          const a = s.trim().toLowerCase();
          const b = t.toRole.trim().toLowerCase();
          return (
            a === b ||
            (a === 'design' && b === 'designer') ||
            (a === 'designer' && b === 'design')
          );
        });
        const isAssignedToMe = Boolean(
          t.assignedTo && t.assignedTo.toLowerCase() === userAccount
        );

        return isToMyTeam || isAssignedToMe;
      }).length
      : 0;

  const isAdmin = currentUser?.role === 'Admin';
  const resolvedUserTab: UserSubTabType = isAdmin ? activeUserSubTab : 'USERS';

  const sectionLabel = SECTION_LABELS[activeMainSection];

  const subTabLabel =
    activeMainSection === 'tasks'
      ? TASK_TAB_LABELS[activeTaskTab]
      : activeMainSection === 'users'
      ? USER_TAB_LABELS[resolvedUserTab]
      : null;

  return (
    <>
      {/* Saho Page Header (Breadcrumb Left, Actions Right) */}
      <header className="sticky top-0 z-20 bg-[#F3F4F7]/90 dark:bg-[#080c14]/90 backdrop-blur-md border-b border-[#E8E9EF] dark:border-slate-800/90">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 h-[56px] flex items-center justify-between gap-3">
          {/* Left: Mobile Drawer Trigger + Saho Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            {onOpenMobileMenu && (
              <button
                type="button"
                onClick={onOpenMobileMenu}
                aria-label="Mở menu điều hướng"
                className="lg:hidden w-8 h-8 rounded-[8px] bg-white dark:bg-slate-900 border border-[#E8E9EF] dark:border-slate-800 flex items-center justify-center text-[#1D202A] dark:text-slate-200 hover:border-[#1890FF] hover:text-[#1890FF] transition cursor-pointer shrink-0"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}

            <nav aria-label="Breadcrumb" className="flex items-center text-[13px] sm:text-[14px] min-w-0">
              <button
                type="button"
                onClick={() => {
                  setActiveMainSection('tasks');
                  setActiveTaskTab('schedule');
                }}
                title="Về Work Schedules"
                className="p-1 rounded-[6px] text-[#838899] hover:text-[#1890FF] hover:bg-[rgba(64,169,255,0.08)] transition cursor-pointer shrink-0"
              >
                <Home className="w-4 h-4" />
              </button>

              <span className="px-2 text-[#A2A6B4] select-none shrink-0">/</span>

              <button
                type="button"
                onClick={() => setActiveMainSection(activeMainSection)}
                className={`truncate cursor-pointer transition ${subTabLabel
                  ? 'text-[#838899] hover:text-[#1890FF] font-normal hidden sm:inline'
                  : 'text-[#1D202A] dark:text-slate-100 font-medium'
                  }`}
              >
                {sectionLabel}
              </button>

              {subTabLabel && (
                <>
                  <span className="px-2 text-[#A2A6B4] select-none shrink-0 hidden sm:inline">
                    /
                  </span>
                  <span className="font-medium text-[#1D202A] dark:text-slate-100 truncate">
                    {subTabLabel}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Right: Sheet Week Indicator + Tour + Notification + Theme + Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {IS_TEST_DB && (
              <span
                title={`Đang kết nối dữ liệu thử nghiệm Firebase (${DB_ROOT_NODE}) — không ảnh hưởng dữ liệu thật`}
                className="inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[8px] bg-amber-50 dark:bg-amber-950/50 border border-amber-300/80 dark:border-amber-800 text-[11px] font-bold text-amber-700 dark:text-amber-300 font-mono"
              >
                <span className="w-[6px] h-[6px] rounded-full bg-amber-500 animate-pulse" />
                <span>TEST DB</span>
              </span>
            )}
            <span className="hidden md:inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[8px] bg-white dark:bg-slate-900 border border-[#E8E9EF] dark:border-slate-800 text-[12px] font-medium text-[#838899] dark:text-slate-300">
              <span className="w-[6px] h-[6px] rounded-full bg-[#1890FF]" />
              <span>Tuần {currentWeek}</span>
            </span>

            <NotificationBell onSelectTask={onSelectTask} />

            {/* Desktop/Tablet quick theme button (complementing sidebar switch) */}
            <button
              type="button"
              onClick={toggleTheme}
              title={
                currentTheme === 'dark'
                  ? 'Chuyển sang Giao diện Sáng'
                  : 'Chuyển sang Giao diện Tối'
              }
              className="w-8 h-8 rounded-[8px] bg-white dark:bg-slate-900 border border-[#E8E9EF] dark:border-slate-800 hover:border-[#1890FF] text-[#838899] hover:text-[#1890FF] dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
            >
              {currentTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#FFA940]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {currentUser && (
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                title="Hồ sơ cá nhân"
                className="lg:hidden h-8 px-1.5 rounded-[8px] bg-white dark:bg-slate-900 border border-[#E8E9EF] dark:border-slate-800 flex items-center gap-1.5 cursor-pointer"
              >
                <UserAvatar user={currentUser} size="xs" shape="circle" showStatus isOnline />
              </button>
            )}

            <button
              type="button"
              onClick={logout}
              title="Đăng xuất"
              className="lg:hidden w-8 h-8 rounded-[8px] bg-white dark:bg-slate-900 border border-[#E8E9EF] dark:border-slate-800 hover:border-[#FF4D4F] text-[#838899] hover:text-[#FF4D4F] flex items-center justify-center transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Quick Main Section Strip (Task / Resource / Users) */}
        <div className="md:hidden border-t border-[#E8E9EF] dark:border-slate-800 bg-[#F8FAFB] dark:bg-[#0d1424] px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveMainSection('tasks')}
            className={`px-3 py-1 rounded-[8px] text-xs font-medium whitespace-nowrap transition cursor-pointer ${activeMainSection === 'tasks'
              ? 'bg-[#1890FF] text-white'
              : 'bg-white dark:bg-slate-900 text-[#838899] border border-[#E8E9EF] dark:border-slate-800'
              }`}
          >
            Quản Lý Task
          </button>
          <button
            type="button"
            onClick={() => setActiveMainSection('resources')}
            className={`flex items-center gap-1 px-3 py-1 rounded-[8px] text-xs font-medium whitespace-nowrap transition cursor-pointer ${activeMainSection === 'resources'
              ? 'bg-[#1890FF] text-white'
              : 'bg-white dark:bg-slate-900 text-[#838899] border border-[#E8E9EF] dark:border-slate-800'
              }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Resource</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMainSection('users')}
            className={`flex items-center gap-1 px-3 py-1 rounded-[8px] text-xs font-medium whitespace-nowrap transition cursor-pointer ${activeMainSection === 'users'
              ? 'bg-[#1890FF] text-white'
              : 'bg-white dark:bg-slate-900 text-[#838899] border border-[#E8E9EF] dark:border-slate-800'
              }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Hệ Thống</span>
          </button>
        </div>

        {/* Mobile System Sub-Tab Strip for Admin */}
        {activeMainSection === 'users' && isAdmin && (
          <div className="md:hidden border-t border-[#E8E9EF] dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'USERS', label: 'Thành viên' },
                { id: 'ROLES', label: 'Role & Chuyên môn' },
                { id: 'PERMISSIONS', label: 'Phân quyền' },
              ] as { id: UserSubTabType; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveUserSubTab?.(tab.id)}
                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                  resolvedUserTab === tab.id
                    ? 'bg-[#E6F7FF] text-[#1890FF] border border-[#91D5FF]'
                    : 'text-[#838899] hover:text-[#1D202A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Mobile Floating Bottom Navigation Bar for Task Sub-Tabs */}
      {activeMainSection === 'tasks' && (
        <nav
          aria-label="Menu tab công việc trên điện thoại"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-[#E8E9EF] dark:border-slate-800 shadow-[0_-4px_16px_rgba(29,32,42,0.06)] flex items-center justify-around px-1 py-1.5"
        >
          {[
            { id: 'schedule', label: 'Schedule', Icon: CalendarDays },
            { id: 'milestones', label: 'Milestone', Icon: Flag, dataTour: 'tab-milestones' },
            {
              id: 'tickets',
              label: 'Request',
              Icon: Ticket,
              badge: openTicketsCount > 0 ? openTicketsCount : undefined,
            },
            { id: 'kanban', label: 'Kanban', Icon: Columns3 },
            { id: 'awards', label: 'Thưởng', Icon: Trophy },
            { id: 'history', label: 'Lịch Sử', Icon: History },
          ].map((item) => {
            const IconComp = item.Icon;
            const isActive = activeTaskTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-tour={item.dataTour}
                onClick={() => setActiveTaskTab(item.id)}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-[8px] transition-all cursor-pointer relative ${isActive
                  ? 'bg-[#1890FF] text-white'
                  : 'text-[#838899] dark:text-slate-400 hover:text-[#1D202A]'
                  }`}
              >
                <div className="relative">
                  <IconComp className="w-4 h-4" />
                  {item.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-0.5 bg-[#FF4D4F] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Shared Profile & Password Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </>
  );
};
