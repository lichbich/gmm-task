'use client';

import React from 'react';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { useApp } from '../context/AppContext';
import { Sparkles, RefreshCw, X, Clock } from 'lucide-react';

export const AutoUpdateBanner: React.FC = () => {
  const { simulatedTime } = useApp();
  const {
    hasUpdate,
    newVersionInfo,
    sundayMilestone,
    isDismissed,
    dismiss,
    reloadNow,
    currentVersion,
  } = useAutoUpdate(simulatedTime);

  const isSundayReload = Boolean(sundayMilestone) && !hasUpdate;
  const shouldShow = (hasUpdate || isSundayReload) && !isDismissed;

  if (!shouldShow) {
    return null;
  }

  const versionText = newVersionInfo?.version ? `v${newVersionInfo.version}` : 'mới nhất';
  const releaseNote = newVersionInfo?.releaseNote;

  const titleText = isSundayReload
    ? (sundayMilestone?.type === 'SUNDAY_12H'
        ? 'Cổng báo cáo tuần đã mở (12:00)'
        : 'Cập nhật trạng thái báo cáo (16:00)')
    : `Đã có bản cập nhật ${versionText}`;

  const badgeText = isSundayReload ? 'Chủ Nhật' : 'Mới';

  const descText = isSundayReload
    ? 'Hệ thống cần làm mới trang để đồng bộ các nút báo cáo tuần. Trang sẽ tự reload khi bạn chuyển tab hoặc đóng tác vụ hiện tại.'
    : (releaseNote || 'Hệ thống sẽ tự động cập nhật ngầm khi bạn chuyển tab, hoặc bạn có thể cập nhật ngay.');

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-2xl bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-xl border border-blue-500/30 shadow-2xl shadow-blue-500/10 p-4 text-white">
        {/* Glow backdrop accent */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl ${isSundayReload ? 'bg-gradient-to-tr from-amber-500 to-indigo-600' : 'bg-gradient-to-tr from-blue-600 to-indigo-500'} flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30`}>
              {isSundayReload ? (
                <Clock className="w-5 h-5 text-white animate-pulse" />
              ) : (
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              )}
            </div>

            <div className="space-y-1 pr-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  {titleText}
                </h4>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${isSundayReload ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'}`}>
                  {badgeText}
                </span>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2">
                {descText}
              </p>
            </div>
          </div>

          <button
            onClick={dismiss}
            title="Đóng thông báo"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action bar */}
        <div className="mt-3.5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Tự reload khi chuyển tab</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={dismiss}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              Để sau
            </button>
            <button
              onClick={reloadNow}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-blue-600/30 active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isSundayReload ? 'Làm mới ngay' : 'Cập nhật ngay'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
