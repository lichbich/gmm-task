'use client';

import React, { useState, useRef, useEffect } from 'react';
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
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Auto-enable search if there are more than 7 options unless explicitly specified false
  const shouldEnableSearch = searchable ?? options.length > 7;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && shouldEnableSearch) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
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

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {label}
        </label>
      )}

      {/* Dropdown Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-white border border-slate-200/90 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 flex items-center justify-between gap-2 shadow-2xs transition-all duration-150 active:scale-[0.99] text-left select-none ${sizeClasses} ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
        } ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500' : ''} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={`truncate font-medium ${selectedOption ? 'text-slate-800' : 'text-slate-400'}`}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            {selectedOption?.badge && <span className="shrink-0">{selectedOption.badge}</span>}
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 top-full mt-1.5 z-50 min-w-full w-max max-w-xs bg-white border border-slate-200/90 rounded-2xl shadow-xl p-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 ${menuClassName}`}
          style={{ minWidth: '100%' }}
        >
          {/* Search box if enabled */}
          {shouldEnableSearch && (
            <div className="p-1.5 pb-1 border-b border-slate-100">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm..."
                  className="w-full bg-slate-50 border border-slate-200/80 rounded-lg pl-7 pr-6 py-1 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
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
                        ? 'bg-indigo-50 text-indigo-800 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
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
                      <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 font-bold" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
