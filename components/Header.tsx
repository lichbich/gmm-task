'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserProfileModal } from './UserProfileModal';
import { GMMLogo } from './common/GMMLogo';

import {
  LayoutGrid,
  ListOrdered,
  Trophy,
  Users,
  Kanban,
  LogOut,
  ChevronDown,
  ShieldCheck,
  History,
  FolderGit2,
  CheckSquare,
  Sun,
  Moon,
} from 'lucide-react';

export type MainSectionType = 'tasks' | 'resources' | 'users';

interface HeaderProps {
  activeMainSection: MainSectionType;
  setActiveMainSection: (section: MainSectionType) => void;
  activeTaskTab: string;
  setActiveTaskTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeMainSection,
  setActiveMainSection,
  activeTaskTab,
  setActiveTaskTab,
}) => {
  const { currentUser, users, logout, theme: currentTheme, toggleTheme } = useApp();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const userRecord = currentUser
    ? users.find((u) => u.account.toLowerCase() === currentUser.account.toLowerCase()) || currentUser
    : null;

  const getRoleTheme = (role?: string) => {
    switch (role) {
      case 'Admin':
        return {
          badge: 'bg-purple-50 text-purple-700 border-purple-200/80',
          avatarGrad: 'from-purple-600 to-indigo-600 text-white',
        };
      case 'Leader':
        return {
          badge: 'bg-amber-50 text-amber-700 border-amber-200/80',
          avatarGrad: 'from-amber-500 to-orange-600 text-white',
        };
      default:
        return {
          badge: 'bg-blue-50 text-blue-700 border-blue-200/80',
          avatarGrad: 'from-indigo-600 to-blue-500 text-white',
        };
    }
  };

  const theme = getRoleTheme(currentUser?.role);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* TOP HEADER ROW: LOGO, MAIN 3 MANAGEMENT TABS, USER PROFILE */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          {/* Brand Logo & Title */}
          <GMMLogo size={36} showText={true} />

          {/* MAIN 3 TOP MANAGEMENT TABS (DESKTOP) */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 gap-1 shadow-2xs">
            {/* TAB 1: QUẢN LÝ TASK */}
            <button
              onClick={() => setActiveMainSection('tasks')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                activeMainSection === 'tasks'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-500 font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              <CheckSquare className={`w-3.5 h-3.5 ${activeMainSection === 'tasks' ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
              <span>Quản Lý Task</span>
            </button>

            {/* TAB 2: QUẢN LÝ RESOURCE */}
            <button
              onClick={() => setActiveMainSection('resources')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                activeMainSection === 'resources'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-500 font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              <FolderGit2 className={`w-3.5 h-3.5 ${activeMainSection === 'resources' ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
              <span>Quản Lý Resource</span>
            </button>

            {/* TAB 3: QUẢN LÝ USER (ADMIN ONLY) */}
            {currentUser?.role === 'Admin' && (
              <button
                onClick={() => setActiveMainSection('users')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                  activeMainSection === 'users'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 border border-purple-500 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className={`w-3.5 h-3.5 ${activeMainSection === 'users' ? 'text-white' : 'text-purple-400'}`} />
                <span>Quản Lý User (Admin)</span>
              </button>
            )}
          </div>

          {/* Right Controls & Auth Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Theme Toggle Button (Sleek Circular Icon Button) */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition active:scale-90 shrink-0 cursor-pointer shadow-2xs"
              title={currentTheme === 'dark' ? 'Chuyển sang giao diện Sáng (Light Theme)' : 'Chuyển sang giao diện Tối (Dark Theme)'}
            >
              {currentTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {currentUser && (
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="group flex items-center gap-2 sm:gap-3 p-1 sm:p-1.5 sm:pr-3.5 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700 hover:border-indigo-300 rounded-2xl transition-all shadow-xs hover:shadow-md active:scale-[0.98] text-left cursor-pointer"
                  title="Bấm để xem thông tin chi tiết & Đổi mật khẩu"
                >
                  {/* User Avatar */}
                  <div className="relative shrink-0">
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr ${theme.avatarGrad} flex items-center justify-center text-xs font-black shadow-xs`}>
                      {currentUser.account.slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-xs ${
                        (userRecord?.password && userRecord.password.trim() !== '') || (currentUser.password && currentUser.password.trim() !== '')
                          ? 'bg-emerald-500 dark:bg-emerald-400'
                          : 'bg-slate-400 dark:bg-slate-400'
                      }`}
                    />
                  </div>

                  {/* Name, Role & Specialization (Hidden on very small screens) */}
                  <div className="hidden sm:block leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate max-w-[130px]">
                        {userRecord?.name || currentUser.name}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${theme.badge}`}>
                        {userRecord?.role || currentUser.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-400 font-mono">@{currentUser.account}</span>
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                        {userRecord?.specializations?.join(', ') || 'BA'}
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition pl-1">
                    <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                </button>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-800 rounded-xl transition cursor-pointer"
                  title="Đăng xuất khỏi hệ thống"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE VIEW MAIN TABS SWITCHER (SLIPPY SEGMENTED BAR) */}
        <div className="md:hidden py-1.5 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              onClick={() => setActiveMainSection('tasks')}
              className={`flex items-center justify-center gap-1.5 text-xs font-bold py-1.5 rounded-lg transition-all ${
                activeMainSection === 'tasks'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Quản Lý Task</span>
            </button>
            <button
              onClick={() => setActiveMainSection('resources')}
              className={`flex items-center justify-center gap-1.5 text-xs font-bold py-1.5 rounded-lg transition-all ${
                activeMainSection === 'resources'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Resource</span>
            </button>
            {currentUser?.role === 'Admin' && (
              <button
                onClick={() => setActiveMainSection('users')}
                className={`col-span-2 flex items-center justify-center gap-1.5 text-xs font-bold py-1.5 rounded-lg transition-all ${
                  activeMainSection === 'users'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Quản Lý User (Admin)</span>
              </button>
            )}
          </div>
        </div>

        {/* SUB NAVIGATION TABS FOR TASK MANAGEMENT */}
        {activeMainSection === 'tasks' && (
          <div className="flex items-center space-x-1 border-t border-slate-100 dark:border-slate-800 pt-1 overflow-x-auto no-scrollbar scroll-smooth">
            <button
              onClick={() => setActiveTaskTab('schedule')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap cursor-pointer shrink-0 ${
                activeTaskTab === 'schedule'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-t-2 border-indigo-500 shadow-2xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="md:hidden">Bảng Task</span>
              <span className="hidden md:inline">Work Schedules (Bảng Excel)</span>
            </button>

            <button
              onClick={() => setActiveTaskTab('milestones')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap cursor-pointer shrink-0 ${
                activeTaskTab === 'milestones'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-t-2 border-indigo-500 shadow-2xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              <span className="md:hidden">Milestones</span>
              <span className="hidden md:inline">Milestones & Break Tasks {currentUser?.role === 'Leader' && '(Leader)'}</span>
            </button>

            <button
              onClick={() => setActiveTaskTab('kanban')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap cursor-pointer shrink-0 ${
                activeTaskTab === 'kanban'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-t-2 border-indigo-500 shadow-2xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>Bảng Kanban</span>
            </button>

            <button
              onClick={() => setActiveTaskTab('awards')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap cursor-pointer shrink-0 ${
                activeTaskTab === 'awards'
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-t-2 border-amber-500 shadow-2xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="md:hidden">Thưởng / Phạt</span>
              <span className="hidden md:inline">Thưởng & Cảnh Báo (Thưởng / Phạt)</span>
            </button>

            <button
              onClick={() => setActiveTaskTab('history')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap cursor-pointer shrink-0 ${
                activeTaskTab === 'history'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-t-2 border-indigo-500 shadow-2xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="md:hidden">Lịch Sử</span>
              <span className="hidden md:inline">Lịch Sử Công Việc</span>
            </button>
          </div>
        )}
      </div>

      {/* Profile & Password Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </header>
  );
};
