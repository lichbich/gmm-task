'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task, WeeklyHistoryArchive, TaskStatus } from '../types/task';
import { TaskDetailModal } from './TaskDetailModal';
import { Dropdown } from './common/Dropdown';
import {
  History,
  FolderArchive,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Flame,
  Award,
  AlertTriangle,
  MessageSquare,
  FileText,
  User,
  Flag,
  FolderOpen,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';

interface WorkHistoryViewProps {
  onOpenTaskModal?: (task?: Task) => void;
}

export const getWeekDateRangeStr = (weekNo: number, year: number = 2026): { startDate: string; endDate: string; label: string } => {
  // ISO Week 1 calculation base for 2026
  // Week 37 of 2026: 14/09/2026 - 20/09/2026
  // Week 36 of 2026: 07/09/2026 - 13/09/2026
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);

  const start = new Date(firstMonday);
  start.setDate(firstMonday.getDate() + (weekNo - 1) * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const formatDate = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${day}/${month}/${yyyy}`;
  };

  const startStr = formatDate(start);
  const endStr = formatDate(end);
  return {
    startDate: startStr,
    endDate: endStr,
    label: `Tuần ${weekNo} (${startStr} đến ${endStr})`,
  };
};

export const WorkHistoryView: React.FC<WorkHistoryViewProps> = () => {
  const {
    tasks,
    weeklyArchives,
    selectedWeek,
    selectedYear,
    finishWeekAndRollover,
    currentUser,
    confirmDialog,
    roles,
    milestones,
    hasUnreadNote,
  } = useApp();

  const [selectedArchiveId, setSelectedArchiveId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [viewingDetailTask, setViewingDetailTask] = useState<Task | null>(null);

  // If archives exist and no selection, pick the latest archive
  const activeArchive =
    weeklyArchives.find((a) => a.id === selectedArchiveId) ||
    (weeklyArchives.length > 0 ? weeklyArchives[weeklyArchives.length - 1] : null);

  const handleRollover = () => {
    const range = getWeekDateRangeStr(selectedWeek, selectedYear);
    confirmDialog({
      title: `Chốt Lịch Sử & Kết Thúc Tuần ${selectedWeek}`,
      message: `Bạn có chắc chắn muốn chốt lịch sử công việc Tuần ${selectedWeek} (${range.startDate} đến ${range.endDate})?\n\n• Tất cả log công việc tuần ${selectedWeek} sẽ được lưu trữ vào Lịch Sử Công Việc.\n• Các công việc HOÀN THÀNH (100%) sẽ được lưu lại trong lịch sử.\n• Các công việc LÀM DỞ sẽ tự động chuyển sang Tuần ${selectedWeek + 1} để các thành viên làm tiếp.\n• Leader có thể phân công thêm task mới cho Tuần ${selectedWeek + 1}.`,
      confirmText: `Đồng ý kết thúc Tuần ${selectedWeek}`,
      cancelText: 'Hủy bỏ',
      type: 'warning',
      onConfirm: () => finishWeekAndRollover(),
    });
  };

  // Determine tasks list for selected archive (Only assigned tasks are in history logs)
  const archivedTasksSnapshot: Task[] = React.useMemo(() => {
    if (!activeArchive) return [];
    const snapshot = activeArchive.tasksSnapshot || [];
    
    // Also include tasks currently assigned to this week
    const currentWeekTasks = tasks.filter(
      (t) => t.weekNumber === activeArchive.weekNumber && t.year === activeArchive.year && t.assigneeAccount && t.assigneeAccount.trim() !== ''
    );

    const map = new Map<string, Task>();
    snapshot.forEach((t) => map.set(t.id, t));
    currentWeekTasks.forEach((t) => {
      if (!map.has(t.id)) {
        map.set(t.id, t);
      }
    });

    return Array.from(map.values()).filter((t) => t.assigneeAccount && t.assigneeAccount.trim() !== '');
  }, [activeArchive, tasks]);

  // Filter archived tasks by search & role
  const filteredArchivedTasks = React.useMemo(() => {
    return archivedTasksSnapshot.filter((t) => {
      if (roleFilter !== 'ALL' && t.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchAssignee = (t.assigneeAccount || '').toLowerCase().includes(q);
        const matchRole = t.role.toLowerCase().includes(q);
        if (!matchTitle && !matchAssignee && !matchRole) return false;
      }
      return true;
    });
  }, [archivedTasksSnapshot, roleFilter, searchQuery]);

  // Group filtered archived tasks by Role
  const tasksByRole = React.useMemo(() => {
    const map = new Map<string, Task[]>();

    roles.forEach((r) => {
      map.set(r.code, []);
    });

    filteredArchivedTasks.forEach((t) => {
      const existing = map.get(t.role);
      if (existing) {
        existing.push(t);
      } else {
        map.set(t.role, [t]);
      }
    });

    return Array.from(map.entries()).filter(([_, list]) => list.length > 0);
  }, [filteredArchivedTasks, roles]);

  const completedCount = React.useMemo(() => {
    return archivedTasksSnapshot.filter((t) => t.status === 'Done').length;
  }, [archivedTasksSnapshot]);

  const rolledOverCount = React.useMemo(() => {
    return archivedTasksSnapshot.filter((t) => t.status !== 'Done').length;
  }, [archivedTasksSnapshot]);

  const activeRangeStr = activeArchive
    ? getWeekDateRangeStr(activeArchive.weekNumber, activeArchive.year)
    : getWeekDateRangeStr(selectedWeek, selectedYear);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <History className="w-6 h-6 text-indigo-600" />
                Lịch Sử Công Việc & Nhật Ký Hoạt Động Tuần
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                Log Đã Lưu
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Quản lý và tra cứu toàn bộ log bảng công việc đã lưu trữ của nhóm theo từng tuần cho tất cả các Role (BA, Design, FE, BE, QA).
            </p>
          </div>

          {/* Action Button: End Current Week & Rollover */}
          {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
            <button
              onClick={handleRollover}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition active:scale-95 shrink-0"
              title="Chốt dữ liệu tuần hiện tại, lưu vào lịch sử và chuyển task dở sang tuần tiếp theo"
            >
              <RefreshCw className="w-4 h-4" />
              Chốt Tuần {selectedWeek} & Lưu Lịch Sử
            </button>
          )}
        </div>

        {/* Informational Workflow Cards */}
        <div className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 p-4 rounded-xl border border-indigo-100 text-xs text-slate-700 space-y-2">
          <div className="flex items-center gap-2 text-indigo-900 font-bold">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            Quy trình tổng kết tuần và lưu lịch sử công việc (Weekly Rollover Workflow):
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="bg-white/80 p-3 rounded-lg border border-indigo-100/60 shadow-2xs">
              <span className="font-bold text-indigo-700 block mb-1">1. Báo cáo & Kiểm tra tuần</span>
              Đến hạn 22:00 Chủ Nhật, thành viên hoàn thành báo cáo số giờ & % tiến độ. Admin/Leader kiểm tra công việc trong tuần.
            </div>
            <div className="bg-white/80 p-3 rounded-lg border border-indigo-100/60 shadow-2xs">
              <span className="font-bold text-indigo-700 block mb-1">2. Chốt & Lưu lịch sử</span>
              Nhấn <strong>Chốt Tuần</strong>: Toàn bộ bảng log công việc tuần sẽ được đưa vào phần Lịch Sử này để lưu trữ vĩnh viễn.
            </div>
            <div className="bg-white/80 p-3 rounded-lg border border-indigo-100/60 shadow-2xs">
              <span className="font-bold text-indigo-700 block mb-1">3. Chuyển task dở & Tuần mới</span>
              Công việc dở dang tự động đẩy sang tuần mới. Leader define/assign thêm task mới cho cả team làm tiếp.
            </div>
          </div>
        </div>
      </div>

      {/* Integrated Week Archive Section Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Header & Controls Toolbar */}
        <div className="p-5 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-amber-500 shrink-0" />
            <h3 className="text-sm font-bold text-slate-800">
              Danh Sách Nhật Ký Các Tuần Đã Lưu Lưu Trữ ({weeklyArchives.length})
            </h3>
          </div>

          {/* Search, Week Selector Dropdown & Role Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm task trong lịch sử..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Week Selector Dropdown */}
            {weeklyArchives.length > 0 && (
              <Dropdown
                value={activeArchive?.id || ''}
                onChange={(val) => setSelectedArchiveId(val)}
                options={weeklyArchives.map((archive) => {
                  const range = getWeekDateRangeStr(archive.weekNumber, archive.year);
                  return {
                    value: archive.id,
                    label: `Tuần ${archive.weekNumber} (${range.startDate} - ${range.endDate})`,
                  };
                })}
                buttonClassName="py-1.5 px-3 text-xs bg-indigo-50 border-indigo-200 text-indigo-700 font-bold"
              />
            )}

            {/* Role Filter Dropdown */}
            <Dropdown
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: 'ALL', label: 'Tất cả Role' },
                ...roles.map((r) => ({ value: r.code, label: `Role: ${r.code}` })),
              ]}
              buttonClassName="py-1.5 px-3 text-xs bg-slate-50 border-slate-200"
            />
          </div>
        </div>

        {/* Content Body */}
        {weeklyArchives.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 text-xs text-slate-500 space-y-2">
            <History className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700">Chưa có bản lưu lịch sử tuần nào</p>
            <p className="text-[11px] max-w-md mx-auto text-slate-400">
              Vào Chủ Nhật cuối tuần, sau khi thành viên hoàn tất báo cáo, Leader hoặc Admin hãy nhấn <strong>"Chốt Tuần & Lưu Lịch Sử"</strong> ở trên để tổng kết và lưu trữ vĩnh viễn.
            </p>
          </div>
        ) : activeArchive ? (
          <div>
            {/* Integrated Color Summary Banner */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-white/20 text-white font-mono font-bold text-xs uppercase tracking-wider">
                    NHẬT KÝ LỊCH SỬ TUẦN {activeArchive.weekNumber} ({activeArchive.year})
                  </span>
                  <span className="text-xs text-indigo-200 font-medium">
                    Thời gian: {activeRangeStr.startDate} đến {activeRangeStr.endDate}
                  </span>
                </div>
                <p className="text-xs text-indigo-100/90 mt-1">
                  Đã lưu trữ lúc: {new Date(activeArchive.archivedAt).toLocaleString('vi-VN')}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10 text-center min-w-[90px]">
                  <span className="text-[10px] text-indigo-200 block uppercase font-medium">Hoàn thành</span>
                  <span className="text-xs sm:text-sm font-extrabold text-emerald-400">
                    {completedCount} Task
                  </span>
                </div>

                <div className="bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10 text-center min-w-[90px]">
                  <span className="text-[10px] text-indigo-200 block uppercase font-medium">Chuyển tuần sau</span>
                  <span className="text-xs sm:text-sm font-extrabold text-amber-300">
                    {rolledOverCount} Task
                  </span>
                </div>
              </div>
            </div>

            {/* Task Log Table Container */}
            <div>

            {filteredArchivedTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs italic">
                Không tìm thấy công việc nào phù hợp trong bản lưu Tuần {activeArchive.weekNumber}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">STT</th>
                      <th className="py-3 px-4 min-w-[240px]">TASK NAME</th>
                      <th className="py-3 px-3 text-center">ROLE</th>
                      <th className="py-3 px-3 text-center">EFFORT (H)</th>
                      <th className="py-3 px-3 text-center">STATUS</th>
                      <th className="py-3 px-3">ACCOUNT</th>
                      <th className="py-3 px-3 min-w-[120px]">TIẾN ĐỘ (%)</th>
                      <th className="py-3 px-3 text-center">THƯỞNG / PHẠT</th>
                      <th className="py-3 px-4 text-center w-20">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {tasksByRole.map(([roleCode, roleTasks]) => (
                      <React.Fragment key={roleCode}>
                        {/* Role Group Header */}
                        <tr className="bg-indigo-50/50 border-y border-indigo-100/80">
                          <td colSpan={9} className="py-2.5 px-4">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-indigo-900 text-xs uppercase tracking-wide">
                                Role: {roleCode} ({roleTasks.length} đầu việc)
                              </span>
                              <span className="text-[11px] text-indigo-600 font-semibold">
                                Tổng Effort: {roleTasks.reduce((acc, curr) => acc + (curr.actualEffort || 0), 0)}h
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Tasks in Role */}
                        {roleTasks.map((t, idx) => {
                          const milestone = milestones.find((m) => m.id === t.milestoneId);
                          const unreadNotes = hasUnreadNote(t);

                          return (
                            <tr
                              key={t.id}
                              className="hover:bg-slate-50/80 transition-colors group"
                            >
                              <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                                {t.id.replace('tsk-', '')}
                              </td>

                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      onClick={() => setViewingDetailTask(t)}
                                      className="font-bold text-slate-800 hover:text-indigo-600 transition cursor-pointer leading-snug"
                                    >
                                      {t.title}
                                    </span>

                                    {/* High Priority Badge */}
                                    {t.priority === 'High' && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 border border-red-200 text-red-700 font-bold text-[10px] shrink-0 shadow-2xs">
                                        <Flame className="w-3 h-3 text-red-500 fill-red-500" />
                                        Ưu tiên cao
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                                    {milestone ? (
                                      <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                        <Flag className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                                        {milestone.title}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                        <FolderOpen className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                        Ngoài Milestone
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold border border-slate-200">
                                  {t.role}
                                </span>
                              </td>

                              <td className="py-3 px-3 text-center font-mono font-bold text-indigo-600">
                                {t.actualEffort}h
                              </td>

                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                                    t.status === 'Done'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : t.status === 'In Progress'
                                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                                      : 'bg-slate-100 text-slate-700 border-slate-300'
                                  }`}
                                >
                                  {t.status}
                                </span>
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 text-xs text-slate-700">
                                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {(t.assigneeAccount || '?').slice(0, 1).toUpperCase()}
                                  </div>
                                  <span className="truncate">{t.assigneeAccount || 'Chưa phân công'}</span>
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                                    <span>{t.completionPercentage}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                    <div
                                      className={`h-full transition-all duration-300 ${
                                        t.completionPercentage === 100
                                          ? 'bg-emerald-500'
                                          : t.completionPercentage > 0
                                          ? 'bg-indigo-500'
                                          : 'bg-slate-300'
                                      }`}
                                      style={{ width: `${t.completionPercentage}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3 text-center">
                                {(() => {
                                  const assigneeAward = activeArchive.awards.find(
                                    (a) => a.account === t.assigneeAccount
                                  );
                                  const isTopEffort = assigneeAward?.isTopEffort || false;
                                  const isLate = assigneeAward?.isLate || t.isSubmittedLate || false;

                                  return (
                                    <div className="flex items-center justify-center gap-1">
                                      {isTopEffort && (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                                          <Award className="w-3 h-3 text-emerald-600" /> THƯỞNG
                                        </span>
                                      )}
                                      {isLate && (
                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-300 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3 text-red-500" /> PHẠT
                                        </span>
                                      )}
                                      {!isTopEffort && !isLate && (
                                        <span className="text-[10px] text-slate-400 font-normal">
                                          Đúng hạn
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>

                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setViewingDetailTask(t)}
                                    className={`p-1.5 rounded-lg border transition ${
                                      unreadNotes
                                        ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                    }`}
                                    title="Xem chi tiết & Nhật ký ghi chú"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
      </div>

      {/* Task Detail View Modal */}
      {viewingDetailTask && (
        <TaskDetailModal
          task={viewingDetailTask}
          isOpen={!!viewingDetailTask}
          onClose={() => setViewingDetailTask(null)}
        />
      )}
    </div>
  );
};
