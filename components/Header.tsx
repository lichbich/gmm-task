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
  KeyRound,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  History,
  CalendarPlus,
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, users, logout } = useApp();
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
          dot: 'bg-purple-500',
        };
      case 'Leader':
        return {
          badge: 'bg-amber-50 text-amber-700 border-amber-200/80',
          avatarGrad: 'from-amber-500 to-orange-600 text-white',
          dot: 'bg-amber-500',
        };
      default:
        return {
          badge: 'bg-blue-50 text-blue-700 border-blue-200/80',
          avatarGrad: 'from-indigo-600 to-blue-500 text-white',
          dot: 'bg-emerald-500',
        };
    }
  };

  const theme = getRoleTheme(currentUser?.role);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <GMMLogo size={42} showText={true} />

          {/* Right Controls & Auth Profile */}
          <div className="flex items-center gap-2.5">
            {/* Current User Info Card (Clickable to open profile popup & change password) */}
            {currentUser && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="group flex items-center gap-3 p-1.5 pr-3.5 bg-slate-50/80 hover:bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl transition-all shadow-xs hover:shadow-md active:scale-[0.98] text-left"
                  title="Bấm để xem thông tin chi tiết & Đổi mật khẩu"
                >
                  {/* User Avatar with Gradient & Status Dot */}
                  <div className="relative shrink-0">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${theme.avatarGrad} flex items-center justify-center text-xs font-black shadow-xs`}>
                      {currentUser.account.slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-xs"
                      title="Online"
                    />
                  </div>

                  {/* Name, Role & Specialization preview */}
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

                  {/* Dropdown Indicator Icon */}
                  <div className="hidden sm:flex items-center text-slate-400 group-hover:text-indigo-600 transition pl-1">
                    <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                </button>

                {/* Quick Logout Button */}
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

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 border-t border-slate-100 pt-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
              activeTab === 'schedule'
                ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Work Schedules (Bảng Excel)
          </button>

          <button
            onClick={() => setActiveTab('milestones')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
              activeTab === 'milestones'
                ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            Milestones & Break Tasks {currentUser?.role === 'Leader' && '(Leader)'}
          </button>

          <button
            onClick={() => setActiveTab('kanban')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
              activeTab === 'kanban'
                ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
            }`}
          >
            <Kanban className="w-4 h-4" />
            Bảng Kanban
          </button>

          <button
            onClick={() => setActiveTab('awards')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
              activeTab === 'awards'
                ? 'bg-amber-50 text-amber-600 border-t-2 border-amber-500 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            Thưởng & Cảnh Báo (Thưởng / Phạt)
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
            }`}
          >
            <History className="w-4 h-4 text-indigo-600" />
            Lịch Sử Công Việc
          </button>

          {currentUser?.role === 'Admin' && (
            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 active:scale-95 whitespace-nowrap ${
                activeTab === 'members'
                  ? 'bg-purple-50 text-purple-600 border-t-2 border-purple-500 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/80'
              }`}
            >
              <Users className="w-4 h-4" />
              Quản Lý User (Admin)
            </button>
          )}
        </div>
      </div>

      {/* User Profile & Change Password Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </header>
  );
};
