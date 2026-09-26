'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { AppNotification } from '../types/notification';
import {
  Bell,
  CheckCheck,
  ClipboardList,
  MessageSquare,
  CheckCircle2,
  Sparkles,
  Smartphone,
  Check,
  ChevronRight,
  X,
  Ticket,
} from 'lucide-react';

interface NotificationBellProps {
  onSelectTask?: (taskId: string, notification?: AppNotification) => void;
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

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; arrowLeft: number } | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const isNotificationGranted =
    isPushEnabled ||
    (typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted');

  const {
    isRendered,
    isVisible,
    handleClose,
    handleBackdropMouseDown,
    handleBackdropClick,
  } = useModalAnimation(isOpen, () => setIsOpen(false));

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePosition = () => {
    if (!buttonRef.current) return null;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(400, window.innerWidth - 24);
    const margin = 12;

    // Center the popover with the bell button
    const buttonCenter = rect.left + rect.width / 2;
    let left = buttonCenter - popoverWidth / 2;

    // Ensure popover stays within viewport bounds
    if (left + popoverWidth > window.innerWidth - margin) {
      left = window.innerWidth - popoverWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    // Exact arrow X offset inside the popover pointing at buttonCenter
    const arrowLeft = Math.max(20, Math.min(popoverWidth - 20, buttonCenter - left));

    return {
      top: Math.round(rect.bottom + 10),
      left: Math.round(left),
      arrowLeft: Math.round(arrowLeft),
    };
  };

  // Calculate popover position anchored directly below the bell button on desktop
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const pos = calculatePosition();
      if (pos) setPopoverPos(pos);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Lock body scroll on mobile when bottom sheet is open
  useEffect(() => {
    if (isRendered && typeof window !== 'undefined' && window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
    } else if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, [isRendered]);

  if (!currentUser) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'TICKET_CREATED':
      case 'TICKET_ASSIGNED':
      case 'TICKET_RESOLVED':
      case 'TICKET_CLOSED':
        return (
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 shadow-2xs">
            <Ticket className="w-4 h-4" />
          </div>
        );
      case 'TICKET_COMMENT':
        return (
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
            <MessageSquare className="w-4 h-4" />
          </div>
        );
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
      if (diffMins < 60) return `${diffMins}p trước`;
      if (diffHours < 24) return `${diffHours}h trước`;
      if (diffDays === 1) return 'Hôm qua';
      if (diffDays < 7) return `${diffDays} ngày trước`;
      return `${date.getDate()}/${date.getMonth() + 1}`;
    } catch {
      return '';
    }
  };

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.isRead) {
      markNotificationAsRead(n.id);
    }
    if (onSelectTask) {
      onSelectTask(n.taskId || n.ticketId || '', n);
    }
    handleClose();
  };

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => {
          if (isOpen) {
            handleClose();
          } else {
            const pos = calculatePosition();
            if (pos) setPopoverPos(pos);
            setIsOpen(true);
          }
        }}
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

      {/* Popover / Bottom Sheet rendered directly into body via Portal */}
      {isRendered && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:block pointer-events-none">
          {/* Backdrop with smooth fade in/out */}
          <div
            className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs pointer-events-auto modal-backdrop-transition sm:bg-transparent sm:backdrop-blur-none ${
              isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
            }`}
            onMouseDown={handleBackdropMouseDown}
            onClick={handleBackdropClick}
          />

          {/* Popover Body with smooth slide up/down on mobile and drop/scale on desktop */}
          <div
            style={
              popoverPos
                ? ({
                    '--popover-top': `${popoverPos.top}px`,
                    '--popover-left': `${popoverPos.left}px`,
                    '--arrow-left': `${popoverPos.arrowLeft}px`,
                  } as React.CSSProperties)
                : undefined
            }
            className={`
              notification-popover-desktop
              pointer-events-auto relative z-10 w-full flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl max-h-[85vh] bottomsheet-transition
              sm:w-[400px] sm:max-h-[540px] sm:rounded-2xl sm:border sm:border-slate-200 sm:dark:border-slate-800 sm:shadow-2xl sm:origin-top
              ${isVisible ? 'bottomsheet-open' : 'bottomsheet-closed'}
            `}
          >
            {/* Desktop Pointer Arrow pointing directly to bell icon */}
            <div
              className="hidden sm:block absolute -top-[6px] w-3 h-3 bg-slate-50 dark:bg-slate-800 border-t border-l border-slate-200 dark:border-slate-700/80 z-20 pointer-events-none notification-arrow"
            />

            {/* Inner Content Wrapper with overflow-hidden to preserve rounded corners */}
            <div className="w-full flex-1 flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden min-h-0">
              {/* Mobile Drag Indicator Handle */}
              <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

              {/* Header */}
              <div className="px-4 py-3 sm:py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800 shrink-0">
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

                <div className="flex items-center gap-2">
                  {unreadNotificationsCount > 0 && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 transition active:scale-95 cursor-pointer px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Đọc tất cả</span>
                    </button>
                  )}

                  {/* Close Button */}
                  <button
                    onClick={handleClose}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                    title="Đóng"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Device Push Notification Banner - Only shown if not yet enabled */}
              {!isNotificationGranted && (
                <div className="px-4 py-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between gap-2 text-xs shrink-0 animate-in fade-in duration-200">
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
                      onClick={requestNotificationPermission}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shrink-0 cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs active:scale-95"
                    >
                      <span>Bật thông báo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Filter Sub-Tabs */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 px-4 pt-2 gap-4 text-xs shrink-0 bg-white dark:bg-slate-900">
                <button
                  onClick={() => setFilter('ALL')}
                  className={`pb-2 font-bold transition border-b-2 cursor-pointer ${
                    filter === 'ALL'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Tất cả ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('UNREAD')}
                  className={`pb-2 font-bold transition border-b-2 cursor-pointer ${
                    filter === 'UNREAD'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Chưa đọc ({unreadNotificationsCount})
                </button>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 custom-scrollbar overscroll-contain">
                {filteredNotifications.length > 0 ? (
                  filteredNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3.5 sm:p-3 flex items-start gap-3 transition cursor-pointer active:bg-slate-100 dark:active:bg-slate-800 hover:bg-slate-50/90 dark:hover:bg-slate-800/60 ${
                        !n.isRead ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      {getNotificationIcon(n.type)}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <h4
                            className={`text-xs sm:text-[12px] truncate ${
                              !n.isRead
                                ? 'font-bold text-slate-900 dark:text-slate-100'
                                : 'font-semibold text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {n.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </div>

                        <p className="text-[11px] sm:text-[11.5px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                          {n.body}
                        </p>

                        <div className="flex items-center gap-2 mt-1">
                          {n.senderAccount && n.senderAccount !== 'System' && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-100 dark:border-indigo-900/40">
                              @{n.senderAccount}
                            </span>
                          )}
                          {n.taskId && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <span>Xem task</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>

                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-1.5 shrink-0 animate-pulse" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                      <Bell className="w-5 h-5" />
                    </div>
                    <span className="font-medium">Không có thông báo nào.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
