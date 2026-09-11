'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus } from '../types/task';
import { WeeklyReportModal } from './WeeklyReportModal';
import { TaskDetailModal } from './TaskDetailModal';
import { AlertTriangle, Award, Plus, Edit2, MessageSquare, UserX } from 'lucide-react';

interface KanbanBoardProps {
  onOpenTaskModal?: (task?: Task) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ onOpenTaskModal }) => {
  const { tasks, updateTask, weeklyAwards, currentUser, canReportTask } = useApp();
  const [reportingTask, setReportingTask] = useState<Task | null>(null);
  const [viewingDetailTask, setViewingDetailTask] = useState<Task | null>(null);

  const columns: { status: TaskStatus; title: string; bgColor: string; borderColor: string; headerColor: string }[] = [
    { status: 'To do', title: 'To Do (Cần làm)', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', headerColor: 'bg-slate-100 border-slate-200' },
    { status: 'In Progress', title: 'In Progress (Đang làm)', bgColor: 'bg-blue-50/50', borderColor: 'border-blue-200', headerColor: 'bg-blue-50 border-blue-200' },
    { status: 'Done', title: 'Done (Đã hoàn thành)', bgColor: 'bg-emerald-50/50', borderColor: 'border-emerald-200', headerColor: 'bg-emerald-50 border-emerald-200' },
  ];

  const isTopEffortAccount = (acc: string) => {
    if (!acc) return false;
    const award = weeklyAwards.find((w) => w.account === acc);
    return award?.isTopEffort || false;
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask || !canReportTask(currentTask)) return;

    let newComp = currentTask.completionPercentage;
    if (newStatus === 'Done') newComp = 100;
    else if (newStatus === 'To do') newComp = 0;
    else if (newStatus === 'In Progress' && newComp === 0) newComp = 50;

    updateTask(taskId, { status: newStatus, completionPercentage: newComp });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">Bảng Kanban Trực Quan</h2>
          <p className="text-xs text-slate-500">Bấm vào thẻ task để xem chi tiết & gửi ghi chú cho Leader.</p>
        </div>
        {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
          <button
            onClick={() => onOpenTaskModal?.()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            Tạo Task
          </button>
        )}
      </div>

      {/* Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);

          return (
            <div
              key={col.status}
              className={`border rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[500px] ${col.bgColor} ${col.borderColor}`}
            >
              {/* Column Header */}
              <div className={`flex items-center justify-between p-4 border-b ${col.headerColor}`}>
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  {col.title}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 font-mono shadow-sm">
                    {colTasks.length}
                  </span>
                </h3>
              </div>

              {/* Tasks List */}
              <div className="space-y-3 flex-1 overflow-y-auto p-4">
                {colTasks.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400 italic">
                    Chưa có task nào ở trạng thái này.
                  </div>
                ) : (
                  colTasks.map((t) => {
                    const isTop = isTopEffortAccount(t.assigneeAccount);
                    const isLate = t.isSubmittedLate;
                    const isAssignedToMe = canReportTask(t);

                    return (
                      <div
                        key={t.id}
                        onClick={() => setViewingDetailTask(t)}
                        className={`bg-white border rounded-xl p-4 shadow-sm space-y-3 transition cursor-pointer hover:shadow-md ${
                          isLate
                            ? 'border-red-300 bg-red-50'
                            : isTop
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Task Role & Badges */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {t.role}
                          </span>
                          <div className="flex items-center gap-1">
                            {isLate && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-300 text-[9px] font-bold rounded-full flex items-center gap-1 animate-pulse">
                                <AlertTriangle className="w-3 h-3" /> BÁO ĐỎ
                              </span>
                            )}
                            {isTop && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-300 text-[9px] font-bold rounded-full flex items-center gap-1">
                                <Award className="w-3 h-3" /> BÁO XANH
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs font-semibold text-slate-700 line-clamp-2">
                          {t.title}
                        </h4>

                        {t.notes && (
                          <p className="text-[10px] text-amber-600 font-medium line-clamp-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 shrink-0" />
                            {t.notes}
                          </p>
                        )}

                        {/* Effort & Progress */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Effort: <strong className="text-indigo-600">{t.actualEffort > 0 ? t.actualEffort : t.estimatedEffort}h</strong></span>
                            <span>{t.completionPercentage}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className="bg-indigo-500 h-full transition-all duration-300"
                              style={{ width: `${t.completionPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Assignee & Quick Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {t.assigneeAccount ? (
                              <>
                                <div className="w-5 h-5 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[9px] font-bold text-indigo-700">
                                  {t.assigneeAccount.slice(0, 2)}
                                </div>
                                <span className="text-slate-600 text-[11px]">{t.assigneeAccount}</span>
                              </>
                            ) : (
                              <span className="text-amber-600 font-semibold flex items-center gap-1 text-[11px]">
                                <UserX className="w-3.5 h-3.5" /> Task trống
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {isAssignedToMe && (
                              <button
                                onClick={() => setReportingTask(t)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold rounded-lg transition"
                                title="Nộp báo cáo"
                              >
                                Báo cáo
                              </button>
                            )}

                            {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
                              <button
                                onClick={() => onOpenTaskModal?.(t)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Quick Status Dropdown ONLY IF ASSIGNED TO ME */}
                        {isAssignedToMe && (
                          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={t.status}
                              onChange={(e) => handleStatusChange(t.id, e.target.value as TaskStatus)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-slate-600 focus:outline-none focus:border-indigo-400"
                            >
                              <option value="To do">Chuyển sang: To do</option>
                              <option value="In Progress">Chuyển sang: In Progress</option>
                              <option value="Done">Chuyển sang: Done</option>
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDetailModal
        task={viewingDetailTask}
        isOpen={!!viewingDetailTask}
        onClose={() => setViewingDetailTask(null)}
        onOpenReport={(t) => setReportingTask(t)}
      />

      <WeeklyReportModal
        task={reportingTask}
        isOpen={!!reportingTask}
        onClose={() => setReportingTask(null)}
      />
    </div>
  );
};
