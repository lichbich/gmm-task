'use client';

import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { User, getUserRoleColorClass } from '../../types/task';
import { UserAvatar } from './UserAvatar';

export interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<any>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  as?: 'input' | 'textarea';
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  users: User[];
  mentionPlacement?: 'top' | 'bottom';
  id?: string;
}

export interface MentionInputHandle {
  focus: () => void;
  blur: () => void;
  getElement: () => HTMLInputElement | HTMLTextAreaElement | null;
}

export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  (
    {
      value,
      onChange,
      onKeyDown,
      onPaste,
      onFocus,
      onBlur,
      placeholder,
      className = '',
      as = 'input',
      rows = 3,
      disabled = false,
      autoFocus = false,
      users = [],
      mentionPlacement = 'top',
      id,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      getElement: () => inputRef.current,
    }));

    // Filter active and non-disabled users
    const filteredUsers = React.useMemo(() => {
      if (!isOpen) return [];
      const cleanQ = query.trim().toLowerCase();
      const activeList = users.filter((u) => !u.disabled && u.status !== 'disabled');

      if (!cleanQ) {
        return activeList.slice(0, 7);
      }

      return activeList
        .filter((u) => {
          const matchAcc = (u.account || '').toLowerCase().includes(cleanQ);
          const matchName = (u.name || '').toLowerCase().includes(cleanQ);
          const matchSpec = (u.specializations || []).some((s) => s.toLowerCase().includes(cleanQ));
          const matchRole = (u.role || '').toLowerCase().includes(cleanQ);
          return matchAcc || matchName || matchSpec || matchRole;
        })
        .slice(0, 7);
    }, [users, isOpen, query]);

    // Check for @mention trigger at cursor position
    const checkMentionTrigger = useCallback(() => {
      const el = inputRef.current;
      if (!el) return;

      const cursor = el.selectionStart ?? value.length;
      const textBefore = value.slice(0, cursor);

      // Match '@word' right before the cursor (e.g. '@' or '@Hai' or '@long')
      // Supports Vietnamese characters in name typing
      const match = textBefore.match(/(?:^|\s)@([a-zA-Z0-9_\u00C0-\u1EF9]*)$/);

      if (match) {
        const fullMatch = match[0];
        const mentionText = match[1];
        // Calculate start index of '@'
        const atIdx = cursor - mentionText.length - 1;
        setMentionStartIndex(atIdx);
        setQuery(mentionText);
        setSelectedIndex(0);
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    }, [value]);

    const handleSelectUser = useCallback(
      (user: User) => {
        const el = inputRef.current;
        if (!el || mentionStartIndex < 0) return;

        const cursor = el.selectionStart ?? value.length;
        const beforeAt = value.slice(0, mentionStartIndex);
        const afterCursor = value.slice(cursor);

        const mentionTag = `@${user.account} `;
        const newValue = `${beforeAt}${mentionTag}${afterCursor}`;

        onChange(newValue);
        setIsOpen(false);

        // Put cursor right after mentionTag
        const nextCursorPos = mentionStartIndex + mentionTag.length;
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
          }
        }, 10);
      },
      [value, mentionStartIndex, onChange]
    );

    const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (isOpen && filteredUsers.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const target = filteredUsers[selectedIndex];
          if (target) {
            handleSelectUser(target);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsOpen(false);
          return;
        }
      }

      if (onKeyDown) {
        onKeyDown(e);
      }
    };

    // Close on click outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value);
    };

    const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Don't re-trigger for navigation keys
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
        return;
      }
      checkMentionTrigger();
    };

    return (
      <div ref={containerRef} className="relative w-full flex-1">
        {/* Autocomplete Dropdown Popup */}
        {isOpen && filteredUsers.length > 0 && (
          <div
            ref={dropdownRef}
            className={`absolute z-[150] w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
              mentionPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
              <span>Gợi ý thành viên (@tag)</span>
              <span className="text-[10px] text-slate-400">Dùng ↑↓ & Enter</span>
            </div>

            <div className="p-1 max-h-56 overflow-y-auto custom-scrollbar space-y-0.5">
              {filteredUsers.map((u, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={u.id || u.account}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelectUser(u)}
                    className={`w-full text-left p-2 rounded-xl flex items-center justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <UserAvatar user={u} account={u.account} size="xs" shape="circle" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold truncate ${getUserRoleColorClass(u.role)}`}>
                            {u.name}
                          </span>
                        </div>
                        <span className={`text-[11px] font-mono font-medium block truncate ${getUserRoleColorClass(u.role)}`}>
                          @{u.account}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-0.5">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${
                          u.role === 'Admin'
                            ? 'bg-purple-100 text-purple-700 border-purple-300'
                            : u.role === 'Leader'
                            ? 'bg-amber-100 text-amber-700 border-amber-300'
                            : u.role === 'Advisor'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-blue-100 text-blue-700 border-blue-300'
                        }`}
                      >
                        {u.role}
                      </span>
                      {u.specializations && u.specializations.length > 0 && (
                        <span className="text-[9px] text-slate-400 font-medium">
                          {u.specializations.join(', ')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input / Textarea */}
        {as === 'textarea' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            id={id}
            value={value}
            onChange={handleChange}
            onKeyUp={handleKeyUp}
            onKeyDown={handleKeyDownInternal}
            onPaste={onPaste}
            onFocus={onFocus}
            onBlur={onBlur}
            onClick={checkMentionTrigger}
            placeholder={placeholder}
            className={className}
            rows={rows}
            disabled={disabled}
            autoFocus={autoFocus}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            id={id}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyUp={handleKeyUp}
            onKeyDown={handleKeyDownInternal}
            onPaste={onPaste}
            onFocus={onFocus}
            onBlur={onBlur}
            onClick={checkMentionTrigger}
            placeholder={placeholder}
            className={className}
            disabled={disabled}
            autoFocus={autoFocus}
          />
        )}
      </div>
    );
  }
);

MentionInput.displayName = 'MentionInput';
