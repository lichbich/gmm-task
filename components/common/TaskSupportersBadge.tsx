'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../../types/task';
import { UserAvatar } from './UserAvatar';
import { Users, Crown } from 'lucide-react';

interface TaskSupportersBadgeProps {
  supporterAccounts?: string[];
  users?: User[];
  size?: 'sm' | 'xs';
  primaryAssignee?: string;
  currentViewingAccount?: string;
  className?: string;
}

interface PopoverCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  isUp: boolean;
  caretLeft: number;
}

export const TaskSupportersBadge: React.FC<TaskSupportersBadgeProps> = ({
  supporterAccounts,
  users = [],
  size = 'sm',
  primaryAssignee,
  currentViewingAccount,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  const badgeRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePosition = useCallback((): PopoverCoords | null => {
    if (!badgeRef.current) return null;

    const rect = badgeRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const margin = 10;

    if (rect.bottom < 0 || rect.top > viewportHeight) {
      return null;
    }

    const popoverWidth = Math.min(250, viewportWidth - margin * 2);
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    // Default to popping UPWARDS as requested, unless space above is very cramped (< 180px) and below is larger
    const isUp = spaceAbove >= 180 || spaceAbove >= spaceBelow;

    // Calculate horizontal position
    let left = rect.left;
    if (left + popoverWidth > viewportWidth - margin) {
      left = viewportWidth - popoverWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    // Caret arrow horizontal position relative to popover
    const badgeCenter = rect.left + rect.width / 2;
    const caretLeft = Math.max(12, Math.min(popoverWidth - 16, badgeCenter - left));

    if (isUp) {
      return {
        bottom: viewportHeight - rect.top + 8,
        left: Math.round(left),
        width: Math.round(popoverWidth),
        isUp: true,
        caretLeft: Math.round(caretLeft),
      };
    } else {
      return {
        top: Math.round(rect.bottom + 8),
        left: Math.round(left),
        width: Math.round(popoverWidth),
        isUp: false,
        caretLeft: Math.round(caretLeft),
      };
    }
  }, []);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    const pos = calculatePosition();
    if (pos) {
      setCoords(pos);
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      const pos = calculatePosition();
      if (pos) {
        setCoords(pos);
        setIsOpen(true);
      }
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      const pos = calculatePosition();
      if (pos) {
        setCoords(pos);
      } else {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        badgeRef.current &&
        !badgeRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, calculatePosition]);

  if (!supporterAccounts || supporterAccounts.length === 0) {
    return null;
  }

  const isXs = size === 'xs';
  const isCollabView = Boolean(
    primaryAssignee &&
      currentViewingAccount &&
      primaryAssignee.toLowerCase() !== currentViewingAccount.toLowerCase()
  );

  const primaryUser = primaryAssignee
    ? users.find((u) => u.account?.toLowerCase() === primaryAssignee.toLowerCase())
    : undefined;

  const renderPopoverContent = () => {
    if (!coords) return null;

    return (
      <div
        ref={popoverRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => e.stopPropagation()}
        className="fixed z-[999999] bg-slate-900/95 dark:bg-slate-900/98 text-white p-2.5 rounded-xl shadow-2xl border border-slate-700/80 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        style={{
          top: coords.top !== undefined ? `${coords.top}px` : undefined,
          bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
          left: `${coords.left}px`,
          width: `${coords.width}px`,
          transformOrigin: coords.isUp ? 'bottom left' : 'top left',
        }}
      >
        {/* Caret arrow */}
        {coords.isUp ? (
          <div
            className="absolute top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900/95"
            style={{ left: `${coords.caretLeft}px`, transform: 'translateX(-50%)' }}
          />
        ) : (
          <div
            className="absolute bottom-full w-0 h-0 border-x-4 border-x-transparent border-b-4 border-b-slate-900/95"
            style={{ left: `${coords.caretLeft}px`, transform: 'translateX(-50%)' }}
          />
        )}

        {/* Header */}
        <div className="font-bold text-[11px] text-indigo-300 mb-1.5 pb-1 border-b border-slate-700/80 flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            Thành viên Collab ({supporterAccounts.length})
          </span>
          <span className="text-[10px] font-mono bg-indigo-950 px-1.5 py-0.2 rounded border border-indigo-700/60 text-indigo-300">
            Hợp tác
          </span>
        </div>

        {/* Primary Assignee section if in Collab View */}
        {primaryAssignee && (
          <div className="mb-2 pb-1.5 border-b border-slate-700/60">
            <span className="text-[9.5px] text-slate-400 block mb-1 flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-400" /> Phụ trách chính:
            </span>
            <div className="flex items-center gap-2 text-[11px] text-amber-200 bg-slate-800/80 p-1.5 rounded-lg border border-amber-500/30">
              <UserAvatar user={primaryUser} account={primaryAssignee} size="xs" shape="circle" />
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="font-bold text-white truncate max-w-[145px]">
                  {primaryUser?.name || primaryAssignee}
                </span>
                <span className="text-[9px] text-amber-300 font-mono">@{primaryAssignee}</span>
              </div>
            </div>
          </div>
        )}

        {/* Supporters list */}
        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
          {primaryAssignee && (
            <span className="text-[9.5px] text-slate-400 block mb-0.5">Cùng hợp tác:</span>
          )}
          {supporterAccounts.map((supAcc) => {
            const supUser = users.find(
              (u) => u.account?.toLowerCase() === supAcc.toLowerCase()
            );
            const isCurrent =
              currentViewingAccount &&
              supAcc.toLowerCase() === currentViewingAccount.toLowerCase();

            return (
              <div
                key={supAcc}
                className={`flex items-center gap-2 text-[11px] p-1 rounded-lg transition ${
                  isCurrent ? 'bg-indigo-950/80 border border-indigo-500/50 text-indigo-200' : 'text-slate-200'
                }`}
              >
                <UserAvatar user={supUser} account={supAcc} size="xs" shape="circle" />
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="font-semibold text-white truncate max-w-[140px]">
                    {supUser?.name || supAcc} {isCurrent && '(Bạn)'}
                  </span>
                  <span className="text-[9.5px] text-indigo-300 font-mono">@{supAcc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`inline-block ${className}`}>
      <div
        ref={badgeRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`inline-flex items-center gap-1 rounded-full border font-bold shadow-2xs transition cursor-pointer select-none ${
          isCollabView
            ? 'bg-purple-50 dark:bg-purple-950/70 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/80'
            : 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200/90 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80'
        } ${isXs ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}
      >
        <Users
          className={`${isXs ? 'w-2.5 h-2.5' : 'w-3 h-3'} ${
            isCollabView ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-500 dark:text-indigo-400'
          } shrink-0`}
        />
        {isCollabView ? (
          <span>Collab</span>
        ) : (
          <span>{supporterAccounts.length} Collab</span>
        )}
      </div>

      {isOpen && mounted && coords && typeof document !== 'undefined'
        ? createPortal(renderPopoverContent(), document.body)
        : null}
    </div>
  );
};
