'use client';

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface DropdownOption<T = string> {
  value: T;
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface DropdownProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  searchable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right' | 'auto';
  direction?: 'up' | 'down' | 'auto';
}

interface DropdownCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  isUp: boolean;
}

export function Dropdown<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Chọn một mục...',
  label,
  icon,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  disabled = false,
  searchable,
  size = 'md',
  align = 'auto',
  direction = 'auto',
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<DropdownCoords | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const shouldEnableSearch = searchable ?? options.length > 7;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronously compute position coordinates
  const calculatePosition = useCallback((): DropdownCoords | null => {
    if (!buttonRef.current) return null;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const margin = 8;

    // Check if trigger is off-screen
    if (rect.bottom < 0 || rect.top > viewportHeight) {
      return null;
    }

    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    // Determine direction (up or down)
    let isUp = false;
    if (direction === 'up') {
      isUp = true;
    } else if (direction === 'down') {
      isUp = false;
    } else {
      // Auto: prefer down unless space below is tight (< 220px) and space above is larger
      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        isUp = true;
      }
    }

    // Determine width and horizontal alignment
    const menuWidth = Math.min(Math.max(rect.width, 220), Math.min(360, viewportWidth - margin * 2));
    let left = rect.left;

    if (align === 'right' || (align === 'auto' && rect.left + menuWidth > viewportWidth - margin)) {
      left = rect.right - menuWidth;
    }

    // Keep within horizontal screen bounds
    if (left + menuWidth > viewportWidth - margin) {
      left = viewportWidth - menuWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    const availableHeight = isUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(320, availableHeight));

    if (isUp) {
      return {
        bottom: viewportHeight - rect.top + 4,
        left: Math.round(left),
        width: Math.round(menuWidth),
        maxHeight: Math.round(maxHeight),
        isUp: true,
      };
    } else {
      return {
        top: Math.round(rect.bottom + 4),
        left: Math.round(left),
        width: Math.round(menuWidth),
        maxHeight: Math.round(maxHeight),
        isUp: false,
      };
    }
  }, [align, direction]);

  const updatePosition = useCallback(() => {
    const newCoords = calculatePosition();
    if (newCoords) {
      setCoords(newCoords);
    } else {
      setIsOpen(false);
    }
  }, [calculatePosition]);

  // Handle opening dropdown with synchronous position calculation
  const handleToggle = () => {
    if (disabled) return;
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

  // Update position on scroll / resize while open
  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && shouldEnableSearch) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [isOpen, shouldEnableSearch]);

  const filteredOptions = shouldEnableSearch && searchQuery.trim()
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (opt.subLabel && opt.subLabel.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : options;

  const sizeClasses = {
    sm: 'text-[11px] py-1.5 px-2.5 rounded-lg',
    md: 'text-xs py-2 px-3 rounded-xl',
    lg: 'text-sm py-2.5 px-3.5 rounded-xl',
  }[size];

  const renderMenuContent = () => {
    if (!coords) return null;

    return (
      <div
        ref={menuRef}
        className={`fixed z-[999999] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl p-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md ${menuClassName}`}
        style={{
          top: coords.top !== undefined ? `${coords.top}px` : undefined,
          bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
          left: `${coords.left}px`,
          width: `${coords.width}px`,
          minWidth: buttonRef.current ? `${buttonRef.current.offsetWidth}px` : undefined,
          transformOrigin: coords.isUp ? 'bottom center' : 'top center',
        }}
      >
        {/* Search box if enabled */}
        {shouldEnableSearch && (
          <div className="p-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg pl-7 pr-6 py-1 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Options List */}
        <div
          className="overflow-y-auto py-1 space-y-0.5 no-scrollbar"
          style={{
            maxHeight: `${coords.maxHeight - (shouldEnableSearch ? 46 : 10)}px`,
          }}
        >
          {filteredOptions.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400 italic">
              Không tìm thấy kết quả phù hợp
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    if (!opt.disabled) {
                      onChange(opt.value);
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-left transition-colors duration-150 select-none ${
                    opt.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && <span className="shrink-0">{opt.badge}</span>}
                      </div>
                      {opt.subLabel && (
                        <span className="text-[10px] text-slate-400 block truncate">
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 font-bold" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
      )}

      {/* Dropdown Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 flex items-center justify-between gap-2 shadow-2xs transition-all duration-150 active:scale-[0.99] text-left select-none ${sizeClasses} ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800' : 'cursor-pointer'
        } ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500 z-10' : ''} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={`truncate font-medium ${selectedOption ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            {selectedOption?.badge && <span className="shrink-0">{selectedOption.badge}</span>}
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
          }`}
        />
      </button>

      {/* Floating Popover Menu via Portal */}
      {isOpen && mounted && coords && typeof document !== 'undefined'
        ? createPortal(renderMenuContent(), document.body)
        : null}
    </div>
  );
}


