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
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Logo & Title */}
          <GMMLogo size={40} showText={true} />

          {/* MAIN 3 TOP MANAGEMENT TABS */}
          <div className="hidden md:flex items-center bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/90 gap-1.5 shadow-2xs">
            {/* TAB 1: QUẢN LÝ TASK */}
            <button
              onClick={() => setActiveMainSection('tasks')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
                activeMainSection === 'tasks'
                  ? 'bg-white text-indigo-600 shadow-sm shadow-slate-200 border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <CheckSquare className={`w-4 h-4 ${activeMainSection === 'tasks' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>Quản Lý Task</span>
            </button>

            {/* TAB 2: QUẢN LÝ RESOURCE */}
            <button
              onClick={() => setActiveMainSection('resources')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
                activeMainSection === 'resources'
                  ? 'bg-white text-indigo-600 shadow-sm shadow-slate-200 border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <FolderGit2 className={`w-4 h-4 ${activeMainSection === 'resources' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>Quản Lý Resource</span>
            </button>

            {/* TAB 3: QUẢN LÝ USER (ADMIN ONLY) */}
            {currentUser?.role === 'Admin' && (
              <button
                onClick={() => setActiveMainSection('users')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
                  activeMainSection === 'users'
                    ? 'bg-white text-purple-700 shadow-sm shadow-slate-200 border border-purple-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 ${activeMainSection === 'users' ? 'text-purple-600' : 'text-purple-400'}`} />
                <span>Quản Lý User (Admin)</span>
              </button>
            )}
          </div>

          {/* Right Controls & Auth Profile */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button (Light/Dark mode) */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold transition-all duration-200 shadow-2xs active:scale-95 cursor-pointer"
              title={currentTheme === 'dark' ? 'Đang ở giao diện Tối - Bấm để chuyển sang Light Theme' : 'Đang ở giao diện Sáng - Bấm để chuyển sang Dark Theme'}
            >
              {currentTheme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>

            {currentUser && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="group flex items-center gap-3 p-1.5 pr-3.5 bg-slate-50/80 hover:bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl transition-all shadow-xs hover:shadow-md active:scale-[0.98] text-left"
                  title="Bấm để xem thông tin chi tiết & Đổi mật khẩu"
                >
                  {/* User Avatar */}
                  <div className="relative shrink-0">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${theme.avatarGrad} flex items-center justify-center text-xs font-black shadow-xs`}>
                      {currentUser.account.slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-xs"
                      title="Online"
                    />
                  </div>

                  {/* Name, Role & Specialization */}
                  <div className="hidden sm:block leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition truncate max-w-[130px]">
                        {userRecord?.name || currentUser.name}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${theme.badge}`}>
                        {userRecord?.role || currentUser.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-400 font-mono">@{currentUser.account}</span>
                      <span className="text-[10px] text-slate-300">•</span>
                      <span className="text-[10px] text-indigo-600 font-medium">
                        {userRecord?.specializations?.join(', ') || 'BA'}
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center text-slate-400 group-hover:text-indigo-600 transition pl-1">
                    <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                </button>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-xl transition"
                  title="Đăng xuất khỏi hệ thống"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE VIEW MAIN TABS SWITCHER */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={() => setActiveMainSection('tasks')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${
              activeMainSection === 'tasks' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Task
          </button>
          <button
            onClick={() => setActiveMainSection('resources')}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${
              activeMainSection === 'resources' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            Resource
          </button>
          {currentUser?.role === 'Admin' && (
            <button
              onClick={() => setActiveMainSection('users')}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${
                activeMainSection === 'users' ? 'bg-purple-600 text-white' : 'text-slate-600'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              User
            </button>
          )}
        </div>

        {/* SUB NAVIGATION TABS FOR TASK MANAGEMENT */}
        {activeMainSection === 'tasks' && (
          <div className="flex items-center space-x-1 border-t border-slate-100 pt-1 overflow-x-auto">
            <button
              onClick={() => setActiveTaskTab('schedule')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
                activeTaskTab === 'schedule'
                  ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Work Schedules (Bảng Excel)
            </button>

            <button
              onClick={() => setActiveTaskTab('milestones')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
                activeTaskTab === 'milestones'
                  ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              Milestones & Break Tasks {currentUser?.role === 'Leader' && '(Leader)'}
            </button>

            <button
              onClick={() => setActiveTaskTab('kanban')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
                activeTaskTab === 'kanban'
                  ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
              }`}
            >
              <Kanban className="w-4 h-4" />
              Bảng Kanban
            </button>

            <button
              onClick={() => setActiveTaskTab('awards')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
                activeTaskTab === 'awards'
                  ? 'bg-amber-50 text-amber-600 border-t-2 border-amber-500 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              Thưởng & Cảnh Báo (Thưởng / Phạt)
            </button>

            <button
              onClick={() => setActiveTaskTab('history')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
                activeTaskTab === 'history'
                  ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
              }`}
            >
              <History className="w-4 h-4 text-indigo-600" />
              Lịch Sử Công Việc
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
