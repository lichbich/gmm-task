'use client';

import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { GMMLogo } from './common/GMMLogo';
import { UserAvatar } from './common/UserAvatar';
import {
  CalendarDays,
  Flag,
  Ticket,
  Columns3,
  Trophy,
  History,
  FolderGit2,
  Users,
  Shield,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react';

export type MainSectionType = 'tasks' | 'resources' | 'users';
export type UserSubTabType = 'USERS' | 'ROLES' | 'PERMISSIONS';
export type TaskTabType =
  | 'schedule'
  | 'milestones'
  | 'tickets'
  | 'kanban'
  | 'awards'
  | 'history'
  | 'nextweek';

interface SidebarProps {
  activeMainSection: MainSectionType;
  setActiveMainSection: (section: MainSectionType) => void;
  activeTaskTab: string;
  setActiveTaskTab: (tab: string) => void;
  activeUserSubTab?: UserSubTabType;
  setActiveUserSubTab?: (tab: UserSubTabType) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenProfile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeMainSection,
  setActiveMainSection,
  activeTaskTab,
  setActiveTaskTab,
  activeUserSubTab = 'USERS',
  setActiveUserSubTab,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  onOpenProfile,
}) => {
  const { currentUser, tickets, isUserAllowedAI } = useApp();
  const canUseAI = isUserAllowedAI(currentUser, 'assistant');

  // Preserve open ticket notification count for the user's specialization or assigned requests
  const openTicketsCount = useMemo(() => {
    if (!currentUser || !tickets) return 0;
    return tickets.filter((t) => {
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
    }).length;
  }, [currentUser, tickets]);

  const taskSubTabs = [
    {
      id: 'schedule',
      label: 'Work Schedules',
      Icon: CalendarDays,
    },
    {
      id: 'milestones',
      label: 'Milestones & Break Tasks',
      Icon: Flag,
      dataTour: 'tab-milestones',
    },
    {
      id: 'tickets',
      label: 'Request',
      Icon: Ticket,
      badge: openTicketsCount > 0 ? openTicketsCount : undefined,
    },
    {
      id: 'kanban',
      label: 'Bảng Kanban',
      Icon: Columns3,
    },
    {
      id: 'awards',
      label: 'Thưởng & Cảnh Báo',
      Icon: Trophy,
    },
    {
      id: 'history',
      label: 'Lịch Sử Công Việc',
      Icon: History,
    },
  ];

  const isAdmin = currentUser?.role === 'Admin';
  const systemSubTabs: {
    id: UserSubTabType;
    label: string;
    Icon: typeof Users;
  }[] = [
    {
      id: 'USERS',
      label: 'Danh sách thành viên',
      Icon: Users,
    },
    ...(isAdmin
      ? [
          {
            id: 'ROLES' as UserSubTabType,
            label: 'Role & Chuyên môn',
            Icon: Shield,
          },
          {
            id: 'PERMISSIONS' as UserSubTabType,
            label: 'Phân quyền',
            Icon: ShieldCheck,
          },
        ]
      : []),
  ];

  const handleSelectTaskTab = (tabId: string) => {
    setActiveMainSection('tasks');
    setActiveTaskTab(tabId);
    onCloseMobile();
  };

  const handleSelectSystemTab = (tabId: UserSubTabType) => {
    setActiveMainSection('users');
    setActiveUserSubTab?.(tabId);
    onCloseMobile();
  };

  const handleSelectMainSection = (section: MainSectionType) => {
    setActiveMainSection(section);
    onCloseMobile();
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'Admin':
        return 'bg-[rgba(179,127,235,0.16)] text-[#9254DE] dark:text-purple-300';
      case 'Leader':
        return 'bg-[rgba(255,169,64,0.18)] text-[#D46B08] dark:text-amber-300';
      case 'Advisor':
        return 'bg-[rgba(10,177,133,0.16)] text-[#088E6A] dark:text-emerald-300';
      default:
        return 'bg-[rgba(24,144,255,0.14)] text-[#1890FF] dark:text-sky-300';
    }
  };

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const isCompact = !isMobileDrawer && collapsed;

    return (
      <div
        className={`flex flex-col h-full justify-between bg-[#F8FAFB] dark:bg-[#0d1424] border-r border-[#E8E9EF] dark:border-slate-800/90 transition-all duration-200 ${
          isCompact ? 'w-[68px] px-2 py-4' : 'w-[256px] p-4'
        }`}
      >
        {/* Top Brand + Collapse Control + Main Navigation Groups */}
        <div className="flex flex-col gap-5 min-h-0 flex-1">
          {/* Logo Header Row (Figma Sidebar-admin system) */}
          <div
            className={`flex items-center ${
              isCompact ? 'justify-center flex-col gap-2' : 'justify-between gap-2'
            } shrink-0`}
          >
            <GMMLogo size={34} showText={!isCompact} />

            {isMobileDrawer ? (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Đóng menu"
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#838899] hover:text-[#1D202A] dark:hover:text-white hover:bg-[#E8E9EF]/60 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleCollapsed}
                title={isCompact ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
                aria-label={isCompact ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
                className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[#838899] hover:text-[#1890FF] hover:bg-[rgba(64,169,255,0.08)] dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                {isCompact ? (
                  <PanelLeftOpen className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Scrollable Nav Sections */}
          <nav
            aria-label="Menu điều hướng chính"
            className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-0.5"
          >
            {/* GROUP 1: QUẢN LÝ TASK (breaks down directly into sub-tabs per requirement) */}
            <div className="space-y-1.5">
              {!isCompact && (
                <div className="px-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#A2A6B4] dark:text-slate-500">
                    Quản Lý Task
                  </span>
                </div>
              )}

              <div className="space-y-1">
                {taskSubTabs.map((item) => {
                  const IconComp = item.Icon;
                  const isActive =
                    activeMainSection === 'tasks' && activeTaskTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-tour={item.dataTour}
                      title={isCompact ? item.label : undefined}
                      onClick={() => handleSelectTaskTab(item.id)}
                      className={`w-full h-[36px] flex items-center ${
                        isCompact ? 'justify-center px-2' : 'justify-between px-2.5'
                      } rounded-[8px] text-[13.5px] transition-all duration-150 cursor-pointer relative group ${
                        isActive
                          ? 'saho-nav-active font-bold text-[#1890FF] dark:text-[#40A9FF]'
                          : 'font-medium text-[#838899] dark:text-slate-400 hover:bg-[rgba(73,82,106,0.05)] dark:hover:bg-slate-800/70 hover:text-[#1D202A] dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <IconComp
                          className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                            isActive
                              ? 'text-[#1890FF] dark:text-[#40A9FF]'
                              : 'text-[#838899] dark:text-slate-400 group-hover:text-[#1D202A] dark:group-hover:text-slate-200'
                          }`}
                        />
                        {!isCompact && (
                          <span className="truncate leading-[20px]">{item.label}</span>
                        )}
                      </div>

                      {item.badge !== undefined && (
                        <span
                          className={`${
                            isCompact
                              ? 'absolute -top-1 -right-0.5 min-w-[16px] h-[16px] px-1 text-[10px]'
                              : 'min-w-[18px] h-[18px] px-1.5 text-[11px]'
                          } rounded-full bg-[#FF4D4F] text-white font-bold flex items-center justify-center leading-none shadow-xs`}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-[#E8E9EF] dark:bg-slate-800/80 mx-1" />

            {/* GROUP 2: QUẢN LÝ RESOURCE */}
            <div className="space-y-1.5">
              {!isCompact && (
                <div className="px-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#A2A6B4] dark:text-slate-500">
                    Quản Lý Resource
                  </span>
                </div>
              )}

              <button
                type="button"
                title={isCompact ? 'Quản Lý Resource' : undefined}
                onClick={() => handleSelectMainSection('resources')}
                className={`w-full h-[36px] flex items-center ${
                  isCompact ? 'justify-center px-2' : 'justify-between px-2.5'
                } rounded-[8px] text-[13.5px] transition-all duration-150 cursor-pointer group ${
                  activeMainSection === 'resources'
                    ? 'saho-nav-active font-bold text-[#1890FF] dark:text-[#40A9FF]'
                    : 'font-medium text-[#838899] dark:text-slate-400 hover:bg-[rgba(73,82,106,0.05)] dark:hover:bg-slate-800/70 hover:text-[#1D202A] dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FolderGit2
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      activeMainSection === 'resources'
                        ? 'text-[#1890FF] dark:text-[#40A9FF]'
                        : 'text-[#838899] dark:text-slate-400 group-hover:text-[#1D202A] dark:group-hover:text-slate-200'
                    }`}
                  />
                  {!isCompact && (
                    <span className="truncate leading-[20px]">Quản Lý Resource</span>
                  )}
                </div>
              </button>
            </div>

            <div className="h-px bg-[#E8E9EF] dark:bg-slate-800/80 mx-1" />

            {/* GROUP 3: HỆ THỐNG */}
            <div className="space-y-1.5">
              {!isCompact && (
                <div className="px-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#A2A6B4] dark:text-slate-500">
                    Hệ Thống
                  </span>
                </div>
              )}

              <div className="space-y-1">
                {systemSubTabs.map((item) => {
                  const IconComp = item.Icon;
                  const resolvedActiveTab = isAdmin ? activeUserSubTab : 'USERS';
                  const isActive =
                    activeMainSection === 'users' && resolvedActiveTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={isCompact ? item.label : undefined}
                      onClick={() => handleSelectSystemTab(item.id)}
                      className={`w-full h-[36px] flex items-center ${
                        isCompact ? 'justify-center px-2' : 'justify-between px-2.5'
                      } rounded-[8px] text-[13.5px] transition-all duration-150 cursor-pointer group ${
                        isActive
                          ? 'saho-nav-active font-bold text-[#1890FF] dark:text-[#40A9FF]'
                          : 'font-medium text-[#838899] dark:text-slate-400 hover:bg-[rgba(73,82,106,0.05)] dark:hover:bg-slate-800/70 hover:text-[#1D202A] dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <IconComp
                          className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                            isActive
                              ? 'text-[#1890FF] dark:text-[#40A9FF]'
                              : 'text-[#838899] dark:text-slate-400 group-hover:text-[#1D202A] dark:group-hover:text-slate-200'
                          }`}
                        />
                        {!isCompact && (
                          <span className="truncate leading-[20px]">{item.label}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>

        {/* Bottom AI Assistant Trigger + Profile Card (Figma ProfileDropdown) */}
        <div className="pt-3 border-t border-[#E8E9EF] dark:border-slate-800/80 space-y-2 shrink-0">
          {canUseAI && (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('saho-toggle-ai-assistant'));
                onCloseMobile();
              }}
              title={isCompact ? 'AI Trợ Lý Dự Án' : 'Mở hoặc đóng trợ lý AI dự án'}
              className={`w-full h-[38px] relative overflow-hidden rounded-[10px] bg-gradient-to-r from-[#096DD9] via-[#1890FF] to-[#40A9FF] hover:from-[#1890FF] hover:to-[#69C0FF] text-white font-semibold text-[13px] shadow-[0_4px_12px_rgba(24,144,255,0.25)] transition-all duration-150 active:scale-[0.98] flex items-center ${
                isCompact ? 'justify-center px-2' : 'justify-between px-3'
              } cursor-pointer group`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-[7px] bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                {!isCompact && (
                  <span className="truncate tracking-tight">AI Trợ Lý Dự Án</span>
                )}
              </div>
              {!isCompact && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] bg-white/20 text-[10px] font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0AB185] animate-pulse" />
                  AI
                </span>
              )}
            </button>
          )}

          {/* ProfileDropdown Card (Figma h-[48px] bg-white rounded-[12px]) */}
          {currentUser && (
            <button
              type="button"
              onClick={() => {
                onOpenProfile();
                onCloseMobile();
              }}
              title="Hồ sơ cá nhân & Đổi mật khẩu"
              className={`w-full ${
                isCompact
                  ? 'h-[40px] justify-center p-1 rounded-[8px]'
                  : 'h-[48px] px-2.5 justify-between rounded-[12px]'
              } bg-white dark:bg-slate-900 border border-[#E8E9EF] dark:border-slate-800 hover:border-[#1890FF] dark:hover:border-[#40A9FF] flex items-center gap-2.5 transition-all cursor-pointer shadow-[0_1px_2px_rgba(29,32,42,0.03)] group`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar
                  user={currentUser}
                  size="sm"
                  shape="circle"
                  showStatus
                  isOnline
                />
                {!isCompact && (
                  <div className="text-left min-w-0 leading-tight">
                    <p className="text-[13px] font-bold text-[#1D202A] dark:text-slate-100 truncate">
                      {currentUser.name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[11px] font-mono text-[#838899] truncate">
                        @{currentUser.account}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-[4px] leading-tight shrink-0 ${getRoleBadgeStyle(
                          currentUser.role
                        )}`}
                      >
                        {currentUser.role}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {!isCompact && (
                <ChevronRight className="w-4 h-4 text-[#A2A6B4] group-hover:text-[#1890FF] group-hover:translate-x-0.5 transition shrink-0" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 bottom-0 h-screen shrink-0 z-30">
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile Slide-Out Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[120] lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#1D202A]/45 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full max-w-[82vw] shadow-2xl animate-in slide-in-from-left duration-200">
            {renderSidebarBody(true)}
          </div>
        </div>
      )}
    </>
  );
};
