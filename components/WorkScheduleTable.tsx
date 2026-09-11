'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus } from '../types/task';
import { WeeklyReportModal } from './WeeklyReportModal';
import { TaskDetailModal } from './TaskDetailModal';
import {
  Search,
  Plus,
  Edit2,
  AlertTriangle,
  Award,
  Clock,
  UserCheck,
  Globe,
  Lock,
  MessageSquare,
  UserX,
} from 'lucide-react';

interface WorkScheduleTableProps {
  onOpenTaskModal?: (task?: Task) => void;
}

export const WorkScheduleTable: React.FC<WorkScheduleTableProps> = ({ onOpenTaskModal }) => {
  const { tasks, users, milestones, currentUser, weeklyAwards, canReportTask } = useApp();

  // Sub-tabs state: ALWAYS DEFAULT to 'MY_TASKS' when accessing
  const [subTab, setSubTab] = useState<'MY_TASKS' | 'ALL_TASKS'>('MY_TASKS');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [reportingTask, setReportingTask] = useState<Task | null>(null);
  const [viewingDetailTask, setViewingDetailTask] = useState<Task | null>(null);

  // Force default 'MY_TASKS' on component mount
  useEffect(() => {
    setSubTab('MY_TASKS');
  }, []);

  // Filter Tasks
  const filteredTasks = tasks.filter((t) => {
    // Sub-tab filter: My Tasks default
    if (subTab === 'MY_TASKS') {
      if (!currentUser || !t.assigneeAccount || t.assigneeAccount.toLowerCase() !== currentUser.account.toLowerCase()) {
        return false;
      }
    }

    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedRole !== 'ALL' && t.role !== selectedRole) return false;
    if (selectedAccount !== 'ALL' && t.assigneeAccount !== selectedAccount) return false;
    if (selectedMilestone !== 'ALL' && t.milestoneId !== selectedMilestone) return false;
    if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
    return true;
  });

  const totalEstimatedEffort = filteredTasks.reduce((acc, t) => acc + (t.estimatedEffort || 0), 0);
  const totalActualEffort = filteredTasks.reduce((acc, t) => acc + (t.actualEffort || 0), 0);

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'Done':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'BA':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Design':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'FE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'BE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'QA':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const isTopEffortAccount = (acc: string) => {
    if (!acc) return false;
    const award = weeklyAwards.find((w) => w.account === acc);
    return award?.isTopEffort || false;
  };

  return (
    <div className="space-y-4">
      {/* Header & Sub-tabs Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                Work Schedules (Bảng Công Việc Chi Tiết)
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {filteredTasks.length} đầu việc
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Quản lý tiến độ, giờ làm thực tế (Effort) và trao đổi ghi chú với Leader.
            </p>
          </div>

          {/* Sub-tabs Navigation */}
          <div className="flex items-center bg-slate-100 p-1 border border-slate-200 rounded-xl">
            <button
              onClick={() => setSubTab('MY_TASKS')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                subTab === 'MY_TASKS'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Task Của Tôi (Mặc định)
            </button>
            <button
              onClick={() => setSubTab('ALL_TASKS')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                subTab === 'ALL_TASKS'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Tất Cả Công Việc
            </button>
          </div>

          {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
            <button
              onClick={() => onOpenTaskModal?.()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tạo / Break Task Mới
            </button>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="ALL">Tất cả Role (BA, Design, FE...)</option>
              <option value="BA">BA (Business Analyst)</option>
              <option value="Design">Design (UI/UX)</option>
              <option value="FE">FE (Front-End)</option>
              <option value="BE">BE (Back-End)</option>
              <option value="QA">QA (Quality Assurance)</option>
            </select>
          </div>

          {/* Account Filter */}
          {subTab === 'ALL_TASKS' && (
            <div>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
              >
                <option value="ALL">Tất cả Thành Viên (Account)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.account}>
                    {u.account} ({u.name})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Milestone Filter */}
          <div>
            <select
              value={selectedMilestone}
              onChange={(e) => setSelectedMilestone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="ALL">Tất cả Milestone</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="ALL">Tất cả Trạng Thái</option>
              <option value="To do">To do</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">STT</th>
                <th className="py-3.5 px-4 min-w-[280px]">Task Name (Bấm xem chi tiết)</th>
                <th className="py-3.5 px-3 w-24">Role</th>
                <th className="py-3.5 px-3 w-24 text-center">Effort (h)</th>
                <th className="py-3.5 px-3 w-28 text-center">Status</th>
                <th className="py-3.5 px-3 w-36">Account</th>
                <th className="py-3.5 px-3 w-36">Tiến độ (%)</th>
                <th className="py-3.5 px-3 w-32 text-center">Alert</th>
                <th className="py-3.5 px-4 w-28 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    {subTab === 'MY_TASKS'
                      ? 'Bạn chưa được phân công đầu việc nào phù hợp với bộ lọc.'
                      : 'Không tìm thấy đầu việc nào phù hợp.'}
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t, idx) => {
                  const isTopEffort = isTopEffortAccount(t.assigneeAccount);
                  const isLate = t.isSubmittedLate;

                  // STRICT PERMISSION: Only the ASSIGNEE gets the report button!
                  const isAssignedToMe = canReportTask(t);
                  const hasAlert = isLate || isTopEffort;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => setViewingDetailTask(t)}
                      className={`hover:bg-slate-50/80 transition cursor-pointer group ${
                        isLate
                          ? 'bg-red-50/50'
                          : isTopEffort
                          ? 'bg-emerald-50/50'
                          : ''
                      }`}
                    >
                      {/* STT */}
                      <td className="py-3 px-4 text-center text-slate-400 font-mono font-medium">
                        {idx + 1250}
                      </td>

                      {/* Task Name */}
                      <td className="py-3 px-4 font-medium text-slate-800">
                        <div className="flex flex-col">
                          <span className="line-clamp-2 font-semibold text-slate-800 group-hover:text-indigo-600 transition">
                            {t.title}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400">
                              {milestones.find((m) => m.id === t.milestoneId)?.title || 'Chưa gán Milestone'}
                            </span>
                            {t.notes && (
                              <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                                <MessageSquare className="w-3 h-3" /> Có ghi chú
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${getRoleStyle(
                            t.role
                          )}`}
                        >
                          {t.role}
                        </span>
                      </td>

                      {/* Effort */}
                      <td className="py-3 px-3 text-center font-mono">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-indigo-600">
                            {t.actualEffort > 0 ? t.actualEffort : t.estimatedEffort}h
                          </span>
                          {t.actualEffort > 0 && t.actualEffort !== t.estimatedEffort && (
                            <span className="text-[9px] text-slate-400">
                              est: {t.estimatedEffort}h
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-3 py-1 text-[11px] rounded-full border ${getStatusBadge(
                            t.status
                          )}`}
                        >
                          {t.status}
                        </span>
                      </td>

                      {/* Account */}
                      <td className="py-3 px-3 font-medium">
                        {t.assigneeAccount ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[9px] font-bold text-indigo-600">
                              {t.assigneeAccount.slice(0, 2)}
                            </div>
                            <span className="text-slate-700">{t.assigneeAccount}</span>
                          </div>
                        ) : (
                          <span className="text-amber-600 font-semibold flex items-center gap-1 text-[11px]">
                            <UserX className="w-3.5 h-3.5" /> Task trống
                          </span>
                        )}
                      </td>

                      {/* Completion Progress Bar */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500 font-medium">{t.completionPercentage}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className={`h-full transition-all duration-300 ${
                                t.completionPercentage === 100
                                  ? 'bg-emerald-500'
                                  : t.completionPercentage > 0
                                  ? 'bg-indigo-600'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${t.completionPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Alert Status (Clean: Blank if no alert exists) */}
                      <td className="py-3 px-3 text-center">
                        {hasAlert ? (
                          <div className="flex items-center justify-center gap-1">
                            {isLate && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold rounded-full"
                                title="Báo cáo nộp sau 10h tối Chủ Nhật (Bị phạt)"
                              >
                                <AlertTriangle className="w-3 h-3 text-red-500" />
                                BÁO ĐỎ
                              </span>
                            )}
                            {isTopEffort && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-full"
                                title="Người có tổng giờ làm nhiều nhất tuần (Được thưởng)"
                              >
                                <Award className="w-3 h-3 text-emerald-600" />
                                BÁO XANH
                              </span>
                            )}
                          </div>
                        ) : null}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* ONLY RENDER BÁO CÁO BUTTON IF TASK IS ASSIGNED TO CURRENT USER! HIDE COMPLETELY FOR OTHERS */}
                          {isAssignedToMe && (
                            <button
                              onClick={() => setReportingTask(t)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-semibold transition flex items-center gap-1"
                              title="Nộp báo cáo số giờ làm & % hoàn thành"
                            >
                              <Clock className="w-3 h-3 text-indigo-600" />
                              <span className="hidden lg:inline">Báo cáo</span>
                            </button>
                          )}

                          {/* Leader/Admin Edit Button */}
                          {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
                            <button
                              onClick={() => onOpenTaskModal?.(t)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                              title="Chỉnh sửa task / Giao việc"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 text-slate-700 font-semibold">
                <td colSpan={3} className="py-3 px-4 text-right uppercase text-[10px] tracking-wider text-slate-500">
                  Tổng Cộng ({filteredTasks.length} task):
                </td>
                <td className="py-3 px-3 text-center font-mono text-indigo-600 font-bold">
                  {totalActualEffort > 0 ? `${totalActualEffort}h` : `${totalEstimatedEffort}h`}
                </td>
                <td colSpan={5}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Task Detail Modal with Notes */}
      <TaskDetailModal
        task={viewingDetailTask}
        isOpen={!!viewingDetailTask}
        onClose={() => setViewingDetailTask(null)}
        onOpenReport={(t) => setReportingTask(t)}
      />

      {/* Weekly Report Modal */}
      <WeeklyReportModal
        task={reportingTask}
        isOpen={!!reportingTask}
        onClose={() => setReportingTask(null)}
      />
    </div>
  );
};
