'use client';

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, X, CalendarCheck } from 'lucide-react';
import { formatDateOnlyDisplay, getTodayDateOnlyString } from '../../types/task';

export interface DatePickerProps {
  value?: string; // Format: "YYYY-MM-DD" or ""
  onChange: (dateStr: string) => void;
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  popupClassName?: string;
  disabled?: boolean;
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right' | 'auto';
  direction?: 'up' | 'down' | 'auto';
  minDate?: string;
  maxDate?: string;
}

interface DatePickerCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  isUp: boolean;
}

const DAYS_OF_WEEK = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

export const DatePicker: React.FC<DatePickerProps> = ({
  value = '',
  onChange,
  placeholder = 'Chọn ngày...',
  label,
  icon,
  className = '',
  buttonClassName = '',
  popupClassName = '',
  disabled = false,
  clearable = true,
  size = 'md',
  align = 'auto',
  direction = 'auto',
  minDate,
  maxDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<DatePickerCoords | null>(null);

  // Initialize view year & month from selected value or current date
  const initialDate = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-11

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When value changes from outside, sync view year/month if opened
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [value]);

  // Synchronously compute position coordinates
  const calculatePosition = useCallback((): DatePickerCoords | null => {
    if (!buttonRef.current) return null;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const margin = 8;
    const popupWidth = 280; // standard calendar width
    const popupHeight = 330; // standard calendar height

    if (rect.bottom < 0 || rect.top > viewportHeight) {
      return null;
    }

    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    let isUp = false;
    if (direction === 'up') {
      isUp = true;
    } else if (direction === 'down') {
      isUp = false;
    } else {
      // Auto: prefer down unless space below is tight (< 330px) and space above is larger
      if (spaceBelow < popupHeight && spaceAbove > spaceBelow) {
        isUp = true;
      }
    }

    let left = rect.left;
    if (align === 'right' || (align === 'auto' && rect.left + popupWidth > viewportWidth - margin)) {
      left = rect.right - popupWidth;
    }

    if (left + popupWidth > viewportWidth - margin) {
      left = viewportWidth - popupWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    if (isUp) {
      return {
        bottom: viewportHeight - rect.top + 4,
        left: Math.round(left),
        width: Math.round(popupWidth),
        isUp: true,
      };
    } else {
      return {
        top: Math.round(rect.bottom + 4),
        left: Math.round(left),
        width: Math.round(popupWidth),
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

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      // Sync calendar view to current selected value
      if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m] = value.split('-').map(Number);
        setViewYear(y);
        setViewMonth(m - 1);
      } else {
        const now = new Date();
        setViewYear(now.getFullYear());
        setViewMonth(now.getMonth());
      }

      const initialCoords = calculatePosition();
      if (initialCoords) {
        setCoords(initialCoords);
      }
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

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

  // Click outside handling
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Escape key handling
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

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDate = (year: number, month: number, day: number) => {
    const formatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const todayStr = getTodayDateOnlyString();
    onChange(todayStr);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // Generate calendar day cells
  const calendarCells = useMemo(() => {
    const cells: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateStr: string;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
    }> = [];

    const todayStr = getTodayDateOnlyString();
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    // Convert getDay (0: Sun, 1: Mon, ...) to Monday-based (0: Mon, ..., 6: Sun)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    // Previous month filler days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isDisabled = (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate) || false;

      cells.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateStr,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
        isDisabled: Boolean(isDisabled),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isDisabled = (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate) || false;

      cells.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        dateStr,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
        isDisabled: Boolean(isDisabled),
      });
    }

    // Next month filler days to complete 42 cells grid (6 rows x 7 cols)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isDisabled = (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate) || false;

      cells.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateStr,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
        isDisabled: Boolean(isDisabled),
      });
    }

    return cells;
  }, [viewYear, viewMonth, value, minDate, maxDate]);

  const sizeClasses = {
    sm: 'text-[11px] py-1.5 px-2.5 rounded-lg',
    md: 'text-xs py-2 px-3 rounded-xl',
    lg: 'text-sm py-2.5 px-3.5 rounded-xl',
  }[size];

  const formattedDisplay = value ? formatDateOnlyDisplay(value) : '';

  const renderPopupContent = () => {
    if (!coords) return null;

    return (
      <div
        ref={popupRef}
        className={`fixed z-[999999] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md select-none ${popupClassName}`}
        style={{
          top: coords.top !== undefined ? `${coords.top}px` : undefined,
          bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
          left: `${coords.left}px`,
          width: `${coords.width}px`,
          transformOrigin: coords.isUp ? 'bottom center' : 'top center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Month & Year Navigator */}
        <div className="flex items-center justify-between px-1">
          <div className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1">
            <span>{MONTH_NAMES[viewMonth]}</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-mono">{viewYear}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-6 h-6 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-6 h-6 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {DAYS_OF_WEEK.map((dw, i) => (
            <div
              key={dw}
              className={`text-[10px] font-bold py-0.5 ${
                i >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {dw}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => (
            <button
              key={idx}
              type="button"
              disabled={cell.isDisabled}
              onClick={() => handleSelectDate(cell.year, cell.month, cell.day)}
              className={`w-8 h-7.5 rounded-lg text-xs flex items-center justify-center font-medium transition-all duration-150 cursor-pointer ${
                cell.isDisabled
                  ? 'opacity-20 cursor-not-allowed text-slate-400 dark:text-slate-600 line-through pointer-events-none'
                  : cell.isSelected
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white font-bold shadow-sm shadow-indigo-500/30 scale-105'
                  : cell.isToday
                  ? 'border border-indigo-500/60 dark:border-indigo-400 text-indigo-600 dark:text-indigo-300 font-bold bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                  : cell.isCurrentMonth
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                  : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              {cell.day}
            </button>
          ))}
        </div>

        {/* Footer Quick Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-[11px]">
          {(() => {
            const todayStr = getTodayDateOnlyString();
            const isTodayDisabled = Boolean((minDate && todayStr < minDate) || (maxDate && todayStr > maxDate));
            return (
              <button
                type="button"
                disabled={isTodayDisabled}
                onClick={handleSelectToday}
                className={`px-2 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                  isTodayDisabled
                    ? 'opacity-30 text-slate-400 cursor-not-allowed'
                    : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer'
                }`}
                title={isTodayDisabled ? 'Ngày hôm nay nằm ngoài khoảng cho phép' : 'Chọn ngày hôm nay'}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                Hôm nay
              </button>
            );
          })()}

          <div className="flex items-center gap-1">
            {value && clearable && (
              <button
                type="button"
                onClick={handleClear}
                className="px-2 py-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg font-medium transition cursor-pointer"
              >
                Xóa
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative inline-block text-left w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
      )}

      {/* DatePicker Trigger Button */}
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
          <span className="shrink-0 text-slate-400 dark:text-slate-500">
            {icon || <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />}
          </span>
          <span
            className={`truncate font-medium font-mono ${
              formattedDisplay
                ? 'text-slate-800 dark:text-slate-100 font-semibold'
                : 'text-slate-400 dark:text-slate-500 font-normal font-sans'
            }`}
          >
            {formattedDisplay || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && clearable && !disabled ? (
            <span
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-rose-500 rounded-md transition cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Xóa ngày đã chọn"
            >
              <X className="w-3 h-3" />
            </span>
          ) : (
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
              }`}
            />
          )}
        </div>
      </button>

      {/* Floating Calendar Portal */}
      {isOpen && mounted && coords && typeof document !== 'undefined'
        ? createPortal(renderPopupContent(), document.body)
        : null}
    </div>
  );
};
