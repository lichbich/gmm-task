'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Trophy, AlertTriangle, Award, CheckCircle2, Sparkles, TrendingUp, RefreshCw, Calendar, History, FolderArchive, Clock } from 'lucide-react';
import { Dropdown } from './common/Dropdown';
import { getWeekDateRangeStr } from './WorkHistoryView';

export const AwardLeaderboard: React.FC = () => {
  const {
    weeklyAwards,
    selectedWeek,
    setSelectedWeek,
    selectedYear,
    currentUser,
    finishWeekAndRollover,
    weeklyArchives,
    tasks,
    confirmDialog,
  } = useApp();

  const isWeekFinalized = weeklyArchives.some(
    (a) => a.weekNumber === selectedWeek && a.year === selectedYear
  );

  const topEffortMember = isWeekFinalized ? weeklyAwards.find((w) => w.isTopEffort && w.totalEffort > 0) : undefined;
  const lateMembers = isWeekFinalized ? weeklyAwards.filter((w) => w.isLate) : [];

  const handleRollover = () => {
    confirmDialog({
      title: 'Xác nhận Chốt tuần & Lưu trữ',
      message: `Bạn có chắc chắn muốn KẾT THÚC TUẦN ${selectedWeek}? Các task hoàn thành sẽ lưu vào Lịch sử Tuần ${selectedWeek}, các task làm dở sẽ tự động chuyển sang Tuần ${selectedWeek + 1} và giữ nguyên % tiến độ.`,
      confirmText: 'Chốt tuần',
      type: 'warning',
      onConfirm: () => finishWeekAndRollover(),
    });
  };

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-1.5 sm:gap-2">
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
                <span className="sm:hidden">Thưởng & Cảnh Báo</span>
                <span className="hidden sm:inline">Bảng Tổng Kết Thưởng & Cảnh Báo (Thưởng / Phạt)</span>
              </h2>
              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0">
                Deadline CN 22:00
              </span>
            </div>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tổng hợp danh hiệu <strong className="text-emerald-600 dark:text-emerald-400">Thưởng (Top Effort)</strong> và danh sách <strong className="text-red-600 dark:text-red-400">Cảnh Báo Phạt (sau 22:00 CN)</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Week Selector */}
            <div className="flex-1 sm:flex-none">
              <Dropdown
                value={selectedWeek}
                onChange={(val) => setSelectedWeek(Number(val))}
                options={Array.from({ length: 15 }, (_, i) => selectedWeek - 5 + i).map((w) => {
                  const range = getWeekDateRangeStr(w, selectedYear);
                  return {
                    value: w,
                    label: `Tuần ${w} (${range.startDate.slice(0, 5)}-${range.endDate.slice(0, 5)})`,
                  };
                })}
                buttonClassName="py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 font-semibold w-full sm:w-auto"
              />
            </div>

            {/* Leader/Advisor/Admin Rollover Button */}
            {(currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') && (
              <button
                onClick={handleRollover}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-xs transition active:scale-95 shrink-0 cursor-pointer"
                title="Lưu lịch sử tuần hiện tại và chuyển các task làm dở sang tuần tiếp theo"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Kết Thúc Tuần {selectedWeek} & Chuyển Task</span>
                <span className="sm:hidden">Chốt Tuần {selectedWeek}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notice if Week Not Finalized */}
      {!isWeekFinalized && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 sm:p-4 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300 shadow-xs">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong className="block text-amber-900 dark:text-amber-200 text-sm mb-0.5">
              Chưa chốt Tuần {selectedWeek}
            </strong>
            <span>
              Admin chưa bấm nút <strong>"Chốt Tuần {selectedWeek}"</strong>. Danh hiệu <strong>Thưởng (Top Effort)</strong> và các mức <strong>Cảnh Báo Phạt</strong> sẽ chỉ được áp dụng và hiển thị chính thức sau khi tuần được chốt.
            </span>
          </div>
        </div>
      )}

      {/* Grid Highlights (Top Effort & Penalty Warning) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* 🟢 TOP EFFORT BANNER */}
        <div className="bg-gradient-to-br from-emerald-50/90 to-white dark:from-emerald-950/60 dark:to-slate-900 border border-emerald-300 dark:border-emerald-700/80 rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
            <Trophy className="w-24 h-24 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] sm:text-xs uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>Top Effort Tuần {selectedWeek}</span>
          </div>

          {topEffortMember ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/80 border border-emerald-300 dark:border-emerald-600 flex items-center justify-center text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-200 shadow-2xs shrink-0">
                    {topEffortMember.account.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate">
                      {topEffortMember.userName}
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      <span className="font-mono text-emerald-700 dark:text-emerald-300 font-semibold">@{topEffortMember.account}</span>
                      <span>•</span>
                      <span>{topEffortMember.specializations?.join(', ') || 'BA'}</span>
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 rounded-full shrink-0">
                  <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Được Thưởng
                </span>
              </div>

              <div className="bg-emerald-100/60 dark:bg-emerald-950/60 px-2.5 py-1.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">Tổng giờ thực tế:</span>
                <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300 font-mono">
                  {topEffortMember.totalEffort} Giờ (Effort)
                </span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-slate-400 text-xs">
              {isWeekFinalized
                ? 'Chưa có dữ liệu tính Thưởng tuần này.'
                : `Chưa chốt Tuần ${selectedWeek}. Danh hiệu Thưởng sẽ công bố sau khi chốt tuần.`}
            </div>
          )}
        </div>

        {/* 🔴 LATE / UNREPORTED SUBMISSION WARNING */}
        <div className="bg-gradient-to-br from-red-50/90 to-white dark:from-red-950/60 dark:to-slate-900 border border-red-300 dark:border-red-700/80 rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
            <AlertTriangle className="w-24 h-24 text-red-600 dark:text-red-400" />
          </div>

          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 font-bold text-[11px] sm:text-xs uppercase tracking-wider truncate">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Cảnh Báo Phạt (Sau 22h CN)</span>
            </div>
            {lateMembers.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 shrink-0">
                {lateMembers.length} vi phạm
              </span>
            )}
          </div>

          {lateMembers.length > 0 ? (
            <div className="space-y-1.5 max-h-32 sm:max-h-40 overflow-y-auto custom-scrollbar">
              {lateMembers.map((m) => (
                <div
                  key={m.account}
                  className="bg-white/90 dark:bg-slate-800/90 p-2 rounded-xl border border-red-200 dark:border-red-800/80 flex items-center justify-between text-xs gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-red-100 dark:bg-red-950/80 border border-red-300 dark:border-red-800 flex items-center justify-center text-[10px] font-bold text-red-700 dark:text-red-300 shrink-0">
                      {m.account.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-100 block text-xs truncate">{m.userName}</span>
                      <span className="text-[10px] text-red-600 dark:text-red-400 block truncate">
                        {m.isMissingReport ? `Chưa nộp (${m.submittedCount}/${m.totalTasks} task)` : 'Nộp muộn sau 22:00'}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md shrink-0 ${
                    m.isMissingReport
                      ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300'
                  }`}>
                    {m.isMissingReport ? 'Chưa nộp' : 'Nộp muộn'}
                  </span>
                </div>
              ))}
            </div>
          ) : isWeekFinalized ? (
            <div className="py-4 text-center text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>100% thành viên đã nộp đúng hạn! Không có phạt nào.</span>
            </div>
          ) : (
            <div className="py-4 text-center text-slate-400 text-xs">
              Chưa chốt Tuần {selectedWeek}. Cảnh báo Phạt sẽ công bố sau khi chốt tuần.
            </div>
          )}
        </div>
      </div>

      {/* Member Ranking Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs p-3 sm:p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <h3 className="text-xs sm:text-sm md:text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
            <span>Bảng Xếp Hạng Effort Tuần {selectedWeek}</span>
          </h3>
          <span className="text-[10px] sm:text-[11px] text-slate-400">Xếp theo tổng giờ thực tế</span>
        </div>

        {/* DESKTOP VIEW: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-3 w-12 text-center">Hạng</th>
                <th className="py-2.5 px-3">Thành Viên</th>
                <th className="py-2.5 px-3">Chuyên Môn</th>
                <th className="py-2.5 px-3 text-center">Số Task Giao</th>
                <th className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">Tổng Effort (h)</th>
                <th className="py-2.5 px-3 text-center">Trạng Thái Báo Cáo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {weeklyAwards.map((item, index) => (
                <tr
                  key={item.account}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition ${
                    item.isTopEffort
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                      : item.isLate
                      ? 'bg-red-50/70 dark:bg-red-950/30'
                      : ''
                  }`}
                >
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                    {index === 0 ? '🥇 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : `#${index + 1}`}
                  </td>
                  <td className="py-2.5 px-3 font-semibold">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        {item.account.slice(0, 2)}
                      </div>
                      <div>
                        <span className="text-slate-800 dark:text-slate-100 block">{item.userName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">@{item.account}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap gap-1">
                      {(item.specializations || ['BA']).map((s) => (
                        <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300">{item.totalTasks} task</td>
                  <td className="py-2.5 px-3 text-center font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                    {item.totalEffort}h
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {item.isTopEffort && (
                        <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/80 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-200 font-bold rounded-full text-[10px] flex items-center gap-1">
                          <Award className="w-3.5 h-3.5" /> THƯỞNG (Top Effort)
                        </span>
                      )}
                      {item.isMissingReport ? (
                        <span className="px-2.5 py-0.5 bg-red-100 dark:bg-red-900/80 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 font-bold rounded-full text-[10px] flex items-center gap-1 animate-pulse" title={item.penaltyReason}>
                          <AlertTriangle className="w-3.5 h-3.5" /> PHẠT (Chưa nộp)
                        </span>
                      ) : item.isLate ? (
                        <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-900/80 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-bold rounded-full text-[10px] flex items-center gap-1" title={item.penaltyReason}>
                          <Clock className="w-3.5 h-3.5" /> PHẠT (Nộp muộn)
                        </span>
                      ) : item.totalTasks > 0 && item.submittedCount === item.totalTasks ? (
                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] border border-emerald-200 dark:border-emerald-800">
                          Đã nộp ({item.submittedCount}/{item.totalTasks})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-[10px] border border-slate-200 dark:border-slate-700">
                          {item.totalTasks === 0 ? 'Không có task' : `Chờ nộp (${item.submittedCount}/${item.totalTasks})`}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW: Ranking Cards */}
        <div className="md:hidden space-y-2">
          {weeklyAwards.map((item, index) => (
            <div
              key={item.account}
              className={`p-2.5 rounded-xl border space-y-1.5 shadow-2xs ${
                item.isTopEffort
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                  : item.isLate
                  ? 'bg-red-50/60 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    {index === 0 ? '🥇 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : `#${index + 1}`}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                    {item.account.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block truncate">
                      {item.userName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block truncate">
                      @{item.account}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm">
                    {item.totalEffort}h
                  </span>
                </div>
              </div>

              {/* Badges & Status */}
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-700/80 flex-wrap">
                <div className="flex items-center gap-1 flex-wrap">
                  {(item.specializations || ['BA']).map((s) => (
                    <span key={s} className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      {s}
                    </span>
                  ))}
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.totalTasks} task
                  </span>
                </div>

                <div>
                  {item.isTopEffort ? (
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/80 border border-emerald-300 text-emerald-700 dark:text-emerald-200 font-bold rounded-full text-[9px] flex items-center gap-1">
                      <Award className="w-3 h-3" /> THƯỞNG
                    </span>
                  ) : item.isMissingReport ? (
                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/80 border border-red-300 text-red-700 dark:text-red-200 font-bold rounded-full text-[9px] flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Chưa nộp
                    </span>
                  ) : item.isLate ? (
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/80 border border-amber-300 text-amber-800 dark:text-amber-200 font-bold rounded-full text-[9px] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Nộp muộn
                    </span>
                  ) : item.totalTasks > 0 && item.submittedCount === item.totalTasks ? (
                    <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full text-[9px] border border-emerald-200">
                      Đã nộp ({item.submittedCount}/{item.totalTasks})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full text-[9px] border border-slate-200">
                      Chờ nộp ({item.submittedCount}/{item.totalTasks})
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
