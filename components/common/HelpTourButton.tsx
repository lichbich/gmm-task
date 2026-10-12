'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Compass, Sparkles, CheckCircle2, ChevronRight, HelpCircle, RotateCcw } from 'lucide-react';
import {
  startSubtaskTour,
  startMilestonesTour,
  isTourCompleted,
  resetTourProgress,
} from '../../lib/tours/tourService';

interface HelpTourButtonProps {
  activeTaskTab?: string;
  setActiveTaskTab?: (tab: string) => void;
}

export const HelpTourButton: React.FC<HelpTourButtonProps> = ({
  activeTaskTab,
  setActiveTaskTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [subtaskDone, setSubtaskDone] = useState(true);
  const [milestonesDone, setMilestonesDone] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const checkStatus = () => {
    setSubtaskDone(isTourCompleted('subtask'));
    setMilestonesDone(isTourCompleted('milestones'));
  };

  useEffect(() => {
    checkStatus();
  }, []);

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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const hasNewTour = !subtaskDone;

  const handleStartSubtask = () => {
    setIsOpen(false);
    startSubtaskTour({
      onTabSwitch: setActiveTaskTab,
      onComplete: () => checkStatus(),
    });
  };

  const handleStartMilestones = () => {
    setIsOpen(false);
    startMilestonesTour({
      onTabSwitch: setActiveTaskTab,
      onComplete: () => checkStatus(),
    });
  };

  const handleReset = () => {
    resetTourProgress();
    checkStatus();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Tour Trigger Button */}
      <button
        type="button"
        data-tour="tour-help-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all active:scale-90 shrink-0 cursor-pointer shadow-2xs group"
        title="Hướng dẫn & Tour tính năng"
      >
        <Compass className="w-4 h-4 transition-transform duration-300 group-hover:rotate-45" />

        {/* Pulse badge if there's a new tour to see */}
        {hasNewTour && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600 border-2 border-white dark:border-slate-900"></span>
          </span>
        )}
      </button>

      {/* Tour Selection Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Tour Hướng Dẫn Tương Tác
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Driver.js</span>
          </div>

          <div className="py-1.5 space-y-1">
            {/* Tour Subtask (NEW) */}
            <button
              onClick={handleStartSubtask}
              className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-left transition group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    Quản lý Subtask (Task con)
                  </span>
                  {!subtaskDone ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-rose-500 text-white rounded-md shrink-0 animate-pulse">
                      Mới
                    </span>
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-tight">
                  Tạo task con, gom nhóm cây phân cấp và tự động tính % tiến độ.
                </p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 mt-2" />
            </button>

            {/* Tour Milestones */}
            <button
              onClick={handleStartMilestones}
              className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-left transition group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <HelpCircle className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    Kho Cột Mốc Milestones
                  </span>
                  {milestonesDone && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-tight">
                  Theo dõi tiến độ theo từng cột mốc dự án và deadline chung.
                </p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0 mt-2" />
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-2">
            <button
              onClick={handleReset}
              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer transition"
              title="Đặt lại trạng thái để xem lại tất cả tour"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Xem lại từ đầu</span>
            </button>
            <span className="text-[10px] text-slate-400 italic">20s tương tác</span>
          </div>
        </div>
      )}
    </div>
  );
};
