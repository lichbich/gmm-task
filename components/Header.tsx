'use client';

import React from 'react';
import { useApp } from '../context/AppContext';

import {
  LayoutGrid,
  ListOrdered,
  Trophy,
  Users,
  Kanban,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, logout } = useApp();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'Leader':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-300';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/25">
              G
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">GMM Task System</h1>
              </div>
              <p className="text-xs text-slate-500">Hệ thống quản lý task & báo cáo thưởng/phạt 10h CN</p>
            </div>
          </div>

          {/* Right Controls & Auth Profile */}
          <div className="flex items-center gap-3">
            {/* Current User Info & Logout */}
            {currentUser && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center text-xs font-bold text-indigo-700">
                    {currentUser.account.slice(0, 2)}
                  </div>
                  <div className="hidden md:block">
                    <div className="text-xs font-semibold text-slate-700">{currentUser.name}</div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${getRoleBadge(
                          currentUser.role
                        )}`}
                      >
                        {currentUser.role}
                      </span>
                      <span className="text-[10px] text-slate-400">{currentUser.specializations?.join(', ') || 'BA'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
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
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap ${
              activeTab === 'schedule'
                ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Work Schedules (Bảng Excel)
          </button>

          <button
            onClick={() => setActiveTab('milestones')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap ${
              activeTab === 'milestones'
                ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            Milestones & Break Tasks {currentUser?.role === 'Leader' && '(Leader)'}
          </button>

          <button
            onClick={() => setActiveTab('kanban')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap ${
              activeTab === 'kanban'
                ? 'bg-indigo-50 text-indigo-600 border-t-2 border-indigo-500'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Kanban className="w-4 h-4" />
            Bảng Kanban
          </button>

          <button
            onClick={() => setActiveTab('awards')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap ${
              activeTab === 'awards'
                ? 'bg-amber-50 text-amber-600 border-t-2 border-amber-500'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            Thưởng & Cảnh Báo (Báo Đỏ / Báo Xanh)
          </button>

          {currentUser?.role === 'Admin' && (
            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap ${
                activeTab === 'members'
                  ? 'bg-purple-50 text-purple-600 border-t-2 border-purple-500'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" />
              Quản Lý User (Admin)
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
