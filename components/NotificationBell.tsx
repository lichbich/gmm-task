'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { AppNotification } from '../types/notification';
import {
  Bell,
  CheckCheck,
  ClipboardList,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Smartphone,
  Check,
  ChevronRight,
} from 'lucide-react';

interface NotificationBellProps {
  onSelectTask?: (taskId: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onSelectTask }) => {
  const {
    currentUser,
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    requestNotificationPermission,
    isPushEnabled,
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!currentUser) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return (
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <ClipboardList className="w-4 h-4" />
          </div>
        );
      case 'TASK_NOTE':
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
        );
      case 'TASK_APPROVED':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
        );
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays === 1) return 'Hôm qua';
      if (diffDays < 7) return `${diffDays} ngày trước`;
      return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    } catch {
      return '';
    }
  };

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.isRead) {
      markNotificationAsRead(n.id);
    }
    if (n.taskId && onSelectTask) {
      onSelectTask(n.taskId);
      setIsOpen(false);
    }
  };

  const handleTestNotification = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    const { sendTestNotification } = await import('../lib/notificationService');
    await sendTestNotification(currentUser.account);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition active:scale-90 shrink-0 cursor-pointer shadow-2xs ${
          isOpen
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
        }`}
        title="Thông báo hệ thống"
      >
        <Bell className="w-4 h-4" />

        {/* Unread Badge Count */}
        {unreadNotificationsCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse shadow-xs">
            {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[380px] max-w-[calc(100vw-24px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3 sm:p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Thông Báo</span>
              </h3>
              {unreadNotificationsCount > 0 && (
                <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-md border border-indigo-200 dark:border-indigo-800">
                  {unreadNotificationsCount} mới
                </span>
              )}
            </div>

            {unreadNotificationsCount > 0 && (
              <button
                onClick={markAllNotificationsAsRead}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 transition active:scale-95 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Đọc tất cả</span>
              </button>
            )}
          </div>

          {/* Device Push Notification Banner */}
          <div className="px-3 py-2 bg-indigo-50/60 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold text-slate-700 dark:text-slate-200 block truncate text-[11px]">
                  Thông báo thiết bị
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleTestNotification}
                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700 transition active:scale-95 cursor-pointer"
                title="Bấm để kiểm tra thử âm thanh chuông và thông báo nổi"
              >
                🔔 Thử ngay
              </button>

              <button
                onClick={requestNotificationPermission}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shrink-0 cursor-pointer ${
                  isPushEnabled
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                }`}
              >
                {isPushEnabled ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Đã bật</span>
                  </>
                ) : (
                  <span>Bật thông báo</span>
                )}
              </button>
            </div>
          </div>

          {/* Filter Sub-Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 px-3 pt-2 gap-2 text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`pb-1.5 font-bold transition border-b-2 cursor-pointer ${
                filter === 'ALL'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('UNREAD')}
              className={`pb-1.5 font-bold transition border-b-2 cursor-pointer ${
                filter === 'UNREAD'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              Chưa đọc ({unreadNotificationsCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 custom-scrollbar">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 flex items-start gap-2.5 transition cursor-pointer hover:bg-slate-50/90 dark:hover:bg-slate-800/60 ${
                    !n.isRead ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                  }`}
                >
                  {getNotificationIcon(n.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs truncate ${
                          !n.isRead
                            ? 'font-bold text-slate-900 dark:text-slate-100'
                            : 'font-semibold text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                      {n.body}
                    </p>

                    {n.senderAccount && n.senderAccount !== 'System' && (
                      <span className="inline-block mt-1 text-[9.5px] text-indigo-600 dark:text-indigo-400 font-mono font-semibold">
                        Từ @{n.senderAccount}
                      </span>
                    )}
                  </div>

                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-1.5 shrink-0" />
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-1.5">
                <Bell className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                <span>Không có thông báo nào.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
