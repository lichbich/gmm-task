'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Trophy, AlertTriangle, Award, CheckCircle2, Sparkles, TrendingUp, RefreshCw, Calendar, History, FolderArchive } from 'lucide-react';

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
  } = useApp();

  const [activeSubView, setActiveSubView] = useState<'CURRENT' | 'ARCHIVE'>('CURRENT');

  const topEffortMember = weeklyAwards.find((w) => w.isTopEffort && w.totalEffort > 0);
  const lateMembers = weeklyAwards.filter((w) => w.isLate);

  const handleRollover = () => {
    if (
      confirm(
        `Bạn có chắc chắn muốn KẾT THÚC TUẦN ${selectedWeek}?\n\n- Tất cả task hoàn thành (Done) sẽ được lưu vào Lịch Sử Tuần ${selectedWeek}.\n- Tất cả task làm dở sẽ tự động CHUYỂN SANG TUẦN ${selectedWeek + 1} và giữ nguyên % hoàn thành.`
      )
    ) {
      finishWeekAndRollover();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Bảng Tổng Kết Thưởng, Cảnh Báo & Lịch Sử Tuần
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
              Deadline CN 22:00
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tổng hợp danh hiệu <strong className="text-emerald-600">Báo Xanh (Top Effort)</strong>, <strong className="text-red-600">Báo Đỏ (Nộp muộn)</strong> và chuyển giao task dở sang tuần mới.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Sub View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 border border-slate-200 rounded-xl">
            <button
              onClick={() => setActiveSubView('CURRENT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubView === 'CURRENT'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Tuần Hiện Tại
            </button>
            <button
              onClick={() => setActiveSubView('ARCHIVE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubView === 'ARCHIVE'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="w-3.5 h-3.5" /> Lịch Sử Đã Lưu ({weeklyArchives.length})
            </button>
          </div>

          {/* Week Selector */}
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-400 font-semibold"
          >
            {[35, 36, 37, 38, 39, 40].map((w) => (
              <option key={w} value={w}>
                Tuần {w} ({selectedYear})
              </option>
            ))}
          </select>

          {/* Leader/Admin Rollover Button */}
          {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
            <button
              onClick={handleRollover}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition"
              title="Lưu lịch sử tuần hiện tại và chuyển các task làm dở sang tuần tiếp theo"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Kết Thúc Tuần {selectedWeek} & Chuyển Task Dở
            </button>
          )}
        </div>
      </div>

      {activeSubView === 'CURRENT' ? (
        <>
          {/* Grid Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 🟢 TOP EFFORT BANNER */}
            <div className="bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-300 rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <Trophy className="w-36 h-36 text-emerald-600" />
              </div>

              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider mb-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                🟢 DANH HIỆU BÁO XANH - THƯỞNG TOP EFFORT TUẦN {selectedWeek}
              </div>

              {topEffortMember ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center text-xl font-bold text-emerald-700 shadow-md">
                      {topEffortMember.account.slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">{topEffortMember.userName}</h3>
                      <div className="flex items-center gap-2 text-xs mt-1">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-700 font-semibold">
                          Account: {topEffortMember.account}
                        </span>
                        <span className="text-slate-500">
                          ({topEffortMember.role} - [{topEffortMember.specializations?.join(', ') || 'BA'}])
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-500 block">Tổng số giờ làm việc thực tế:</span>
                      <span className="text-2xl font-black text-emerald-600">
                        {topEffortMember.totalEffort} Giờ (Effort)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Trạng thái thưởng:</span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 px-3 py-1 bg-emerald-100 border border-emerald-300 rounded-full">
                        <Award className="w-4 h-4" /> Được Nhận Thưởng
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Chưa có dữ liệu số giờ báo cáo trong tuần này để tính Báo Xanh.
                </div>
              )}
            </div>

            {/* 🔴 LATE SUBMISSION WARNING */}
            <div className="bg-gradient-to-br from-red-50 to-white border-2 border-red-300 rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <AlertTriangle className="w-36 h-36 text-red-600" />
              </div>

              <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider mb-2">
                <AlertTriangle className="w-4 h-4 animate-bounce" />
                🔴 DANH SÁCH BÁO ĐỎ - CẢNH BÁO NỘP MUỘN (SAU 10H CN)
              </div>

              {lateMembers.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Có <strong className="text-red-600">{lateMembers.length} thành viên</strong> nộp báo cáo quá mốc 22:00 Chủ Nhật:
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {lateMembers.map((m) => (
                      <div
                        key={m.account}
                        className="bg-white p-3 rounded-xl border border-red-200 flex items-center justify-between text-xs shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-red-100 border border-red-300 flex items-center justify-center font-bold text-red-700">
                            {m.account.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block">{m.userName} ({m.account})</span>
                            <span className="text-[10px] text-red-600">
                              Nộp lúc: {m.lastSubmittedAt ? new Date(m.lastSubmittedAt).toLocaleString('vi-VN') : 'Sau 22:00 CN'}
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-red-100 border border-red-300 text-red-700 text-[10px] font-bold rounded-full">
                          BÁO ĐỎ (Tính phạt)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-emerald-600 text-xs font-semibold flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8" />
                  Tất cả thành viên đều nộp báo cáo đúng hạn trước 10h tối Chủ Nhật! Không có Báo Đỏ nào.
                </div>
              )}
            </div>
          </div>

          {/* Member Ranking Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                Bảng Xếp Hạng Effort Tuần {selectedWeek}
              </h3>
              <span className="text-xs text-slate-400">Sắp xếp theo tổng số giờ làm thực tế</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4 w-12 text-center">Hạng</th>
                    <th className="py-3 px-4">Thành Viên</th>
                    <th className="py-3 px-3">Chuyên Môn</th>
                    <th className="py-3 px-3 text-center">Số Task Giao</th>
                    <th className="py-3 px-3 text-center font-bold text-indigo-600">Tổng Effort (h)</th>
                    <th className="py-3 px-4 text-center">Trạng Thái Báo Cáo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {weeklyAwards.map((item, index) => (
                    <tr
                      key={item.account}
                      className={`hover:bg-slate-50 transition ${
                        item.isTopEffort
                          ? 'bg-emerald-50'
                          : item.isLate
                          ? 'bg-red-50'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                        {index === 0 ? '🥇 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : `#${index + 1}`}
                      </td>
                      <td className="py-3 px-4 font-semibold">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
                            {item.account.slice(0, 2)}
                          </div>
                          <div>
                            <span className="text-slate-800 block">{item.userName}</span>
                            <span className="text-[10px] text-slate-400">{item.account}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(item.specializations || ['BA']).map((s) => (
                            <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">{item.totalTasks} task</td>
                      <td className="py-3 px-3 text-center font-mono font-black text-indigo-600 text-sm">
                        {item.totalEffort}h
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {item.isTopEffort && (
                            <span className="px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-700 font-bold rounded-full text-[10px] flex items-center gap-1">
                              <Award className="w-3.5 h-3.5" /> BÁO XANH (Thưởng)
                            </span>
                          )}
                          {item.isLate && (
                            <span className="px-3 py-1 bg-red-100 border border-red-300 text-red-700 font-bold rounded-full text-[10px] flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5" /> BÁO ĐỎ (Phạt)
                            </span>
                          )}
                          {!item.isTopEffort && !item.isLate && (
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] border border-slate-200">
                              Hoàn thành đúng hạn
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* ARCHIVE VIEW */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FolderArchive className="w-5 h-5 text-amber-500" />
              Danh Sách Lịch Sử Các Tuần Đã Lưu
            </h3>

            {weeklyArchives.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs italic">
                Chưa có tuần nào được kết thúc lưu trữ. Nhấn "Kết Thúc Tuần & Chuyển Task Dở" để lưu trữ tuần hiện tại.
              </div>
            ) : (
              <div className="space-y-4">
                {weeklyArchives.map((archive) => {
                  const archiveTasks = tasks.filter(
                    (t) => t.weekNumber === archive.weekNumber && t.year === archive.year
                  );

                  return (
                    <div
                      key={archive.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 font-bold rounded-lg text-xs border border-amber-300">
                            Tuần {archive.weekNumber} / {archive.year}
                          </span>
                          <span className="text-xs text-slate-400">
                            Lưu ngày: {new Date(archive.archivedAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-emerald-600 font-semibold">
                            ✅ {archive.completedTasksCount} Task hoàn thành
                          </span>
                          <span className="text-indigo-600 font-semibold">
                            ➡️ {archive.rolledOverTasksCount} Task chuyển sang tuần sau
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          Các đầu việc trong tuần này:
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {archiveTasks.map((t) => (
                            <div
                              key={t.id}
                              className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs shadow-sm"
                            >
                              <div className="truncate flex-1 pr-2">
                                <span className="font-semibold text-slate-700 block truncate">
                                  {t.title}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Phụ trách: {t.assigneeAccount || 'Trống'} • Effort: {t.actualEffort}h
                                </span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  t.status === 'Done'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-300'
                                }`}
                              >
                                {t.completionPercentage}% ({t.status})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
