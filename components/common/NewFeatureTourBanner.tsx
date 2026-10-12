'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { startSubtaskTour, isTourCompleted, markTourCompleted } from '../../lib/tours/tourService';

interface NewFeatureTourBannerProps {
  setActiveTaskTab?: (tab: string) => void;
}

export const NewFeatureTourBanner: React.FC<NewFeatureTourBannerProps> = ({
  setActiveTaskTab,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Chỉ hiện nếu chưa hoàn thành tour và sau 1.5 giây kể từ khi tải trang
    const timer = setTimeout(() => {
      if (!isTourCompleted('subtask')) {
        setIsVisible(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  const handleStart = () => {
    setIsVisible(false);
    startSubtaskTour({
      onTabSwitch: setActiveTaskTab,
      onComplete: () => setIsVisible(false),
    });
  };

  const handleDismiss = () => {
    setIsVisible(false);
    markTourCompleted('subtask');
  };

  return (
    <aside
      aria-label="New feature announcement"
      className="fixed bottom-16 sm:bottom-6 right-3 sm:right-6 z-40 max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-indigo-200 dark:border-indigo-900/60 shadow-[0_15px_30px_-5px_rgba(79,70,229,0.25)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.6)] rounded-2xl p-3.5 animate-in slide-in-from-bottom-5 fade-in duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30">
          <Sparkles className="w-4 h-4 animate-spin-slow" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>Tính năng mới: Subtask!</span>
              <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded-full font-bold">
                Mới
              </span>
            </span>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-lg transition"
              title="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Hệ thống đã hỗ trợ phân cấp công việc con và tự động tính toán tiến độ.
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
            >
              <span>Xem tour 20s</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <button
              onClick={handleDismiss}
              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1 transition cursor-pointer"
            >
              Để sau
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
