'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { User, getUserRoleColorClass, getUserRoleInSpec } from '../../types/task';
import { UserAvatar } from './UserAvatar';
import {
  AlertCircle,
  ChevronDown,
  UserCheck,
  Zap,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface RoleUnassignedMembersTagProps {
  roleCode: string;
  roleLabel: string;
  unassignedUsers: User[];
  unassignedTasksCount: number;
  selectedWeek: number;
  selectedYear: number;
  canManage: boolean;
  onOpenAssignModal: (user: User) => void;
  className?: string;
}

interface PopoverCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  isUp: boolean;
}

export const RoleUnassignedMembersTag: React.FC<RoleUnassignedMembersTagProps> = ({
  roleCode,
  roleLabel,
  unassignedUsers,
  unassignedTasksCount,
  selectedWeek,
  selectedYear,
  canManage,
  onOpenAssignModal,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePosition = useCallback((): PopoverCoords | null => {
    if (!buttonRef.current) return null;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const margin = 10;

    if (rect.bottom < 0 || rect.top > viewportHeight) {
      return null;
    }

    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const popoverWidth = Math.min(340, viewportWidth - margin * 2);

    // If space below is tight (< 240px) and space above is larger, pop up
    const isUp = spaceBelow < 240 && spaceAbove > spaceBelow;

    // Align left to button or adjust for right boundary
    let left = rect.left;
    if (left + popoverWidth > viewportWidth - margin) {
      left = viewportWidth - popoverWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    if (isUp) {
      return {
        bottom: viewportHeight - rect.top + 6,
        left: Math.round(left),
        width: Math.round(popoverWidth),
        isUp: true,
      };
    } else {
      return {
        top: Math.round(rect.bottom + 6),
        left: Math.round(left),
        width: Math.round(popoverWidth),
        isUp: false,
      };
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      const newCoords = calculatePosition();
      if (newCoords) {
        setCoords(newCoords);
      } else {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, calculatePosition]);

  if (unassignedUsers.length === 0) {
    return null;
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      const initialCoords = calculatePosition();
      if (initialCoords) {
        setCoords(initialCoords);
      }
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const displayWeekNumber = selectedWeek <= 53 ? selectedWeek + 55 : selectedWeek;

  const renderPopoverContent = () => {
    if (!coords) return null;

    return (
      <div
        ref={popoverRef}
        onClick={(e) => e.stopPropagation()}
        className="fixed z-[999999] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100 backdrop-blur-md"
        style={{
          top: coords.top !== undefined ? `${coords.top}px` : undefined,
          bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
          left: `${coords.left}px`,
          width: `${coords.width}px`,
          transformOrigin: coords.isUp ? 'bottom center' : 'top center',
        }}
      >
        {/* Header */}
        <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between mb-2">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Team {roleLabel || roleCode}: {unassignedUsers.length} người chưa có task</span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              Tuần {displayWeekNumber} •{' '}
              <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                {unassignedTasksCount} task trống
              </strong>{' '}
              đang chờ
            </span>
          </div>
        </div>

        {/* Member List */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-0.5">
          {unassignedUsers.map((u) => {
            const uRoleInThisSpec = getUserRoleInSpec(u, roleCode);
            return (
              <div
                key={u.id}
                className="p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-amber-50/70 dark:hover:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/70 transition-all flex items-center justify-between gap-2 group"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <UserAvatar user={u} account={u.account} size="xs" shape="circle" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold truncate ${getUserRoleColorClass(uRoleInThisSpec)}`}>
                        {u.name}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-200/80 dark:bg-slate-700 shrink-0 ${getUserRoleColorClass(uRoleInThisSpec)}`}>
                        @{u.account}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block truncate">
                      0 đầu việc trong tuần
                    </span>
                  </div>
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenAssignModal(u);
                    }}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-lg shadow-2xs transition active:scale-95 cursor-pointer flex items-center gap-1 shrink-0"
                    title={`Phân công task cho @${u.account}`}
                  >
                    <Zap className="w-3 h-3 fill-white text-white" />
                    <span>Giao việc</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 text-center">
          Bấm "Giao việc" để chọn task trống hoặc tạo task mới
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 dark:hover:bg-amber-900/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 shadow-2xs transition-all duration-150 active:scale-95 cursor-pointer select-none ${className}`}
        title={`Có ${unassignedUsers.length} thành viên team ${roleLabel || roleCode} chưa có task tuần này`}
      >
        <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
        <span>{unassignedUsers.length} chưa có task</span>
        <ChevronDown
          className={`w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && mounted && coords && typeof document !== 'undefined'
        ? createPortal(renderPopoverContent(), document.body)
        : null}
    </>
  );
};
