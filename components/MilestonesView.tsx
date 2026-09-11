'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Milestone, Task } from '../types/task';
import { TaskModal } from './TaskModal';
import {
  ListOrdered,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Layers,
} from 'lucide-react';

export const MilestonesView: React.FC = () => {
  const {
    milestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    tasks,
    reorderTasksInMilestone,
    deleteTask,
    currentUser,
  } = useApp();

  const [isAddMsOpen, setIsAddMsOpen] = useState(false);
  const [msTitle, setMsTitle] = useState('');
  const [msDesc, setMsDesc] = useState('');
  const [msTargetDate, setMsTargetDate] = useState('');

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Inline edit milestone state
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMsTitle, setEditMsTitle] = useState('');
  const [editMsDesc, setEditMsDesc] = useState('');
  const [editMsTargetDate, setEditMsTargetDate] = useState('');

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim()) return;
    addMilestone({
      title: msTitle,
      description: msDesc,
      targetDate: msTargetDate || '2026-09-30',
      status: 'In Progress',
    });
    setMsTitle('');
    setMsDesc('');
    setMsTargetDate('');
    setIsAddMsOpen(false);
  };

  const handleStartEditMilestone = (ms: Milestone) => {
    setEditingMilestoneId(ms.id);
    setEditMsTitle(ms.title);
    setEditMsDesc(ms.description || '');
    setEditMsTargetDate(ms.targetDate || '');
  };

  const handleSaveMilestone = (msId: string) => {
    updateMilestone(msId, {
      title: editMsTitle,
      description: editMsDesc,
      targetDate: editMsTargetDate,
    });
    setEditingMilestoneId(null);
  };

  const handleMoveTask = (milestoneId: string, taskIndex: number, direction: 'UP' | 'DOWN') => {
    const msTasks = tasks
      .filter((t) => t.milestoneId === milestoneId)
      .sort((a, b) => a.orderInMilestone - b.orderInMilestone);

    if (
      (direction === 'UP' && taskIndex === 0) ||
      (direction === 'DOWN' && taskIndex === msTasks.length - 1)
    ) {
      return;
    }

    const newTasks = [...msTasks];
    const targetIndex = direction === 'UP' ? taskIndex - 1 : taskIndex + 1;
    const temp = newTasks[taskIndex];
    newTasks[taskIndex] = newTasks[targetIndex];
    newTasks[targetIndex] = temp;

    const orderedIds = newTasks.map((t) => t.id);
    reorderTasksInMilestone(milestoneId, orderedIds);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Quản Lý Milestones & Break Tasks
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
              Chức năng cho Leader
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Break các mốc cột mốc thành từng đầu việc cụ thể, sắp xếp thứ tự thực hiện và giao cho thành viên.
          </p>
        </div>

        {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
          <button
            onClick={() => setIsAddMsOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold rounded-xl shadow-md shadow-amber-500/30 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            Tạo Milestone Mới
          </button>
        )}
      </div>

      {/* Add Milestone Form */}
      {isAddMsOpen && (
        <form
          onSubmit={handleCreateMilestone}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            Tạo Cột Mốc Milestone Mới
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 block mb-1">Tên Milestone:</label>
              <input
                type="text"
                placeholder="VD: Milestone 4: Integration & System Testing"
                value={msTitle}
                onChange={(e) => setMsTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Ngày Hoàn Thành Mục Tiêu:</label>
              <input
                type="date"
                value={msTargetDate}
                onChange={(e) => setMsTargetDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Mô tả mục tiêu:</label>
            <input
              type="text"
              placeholder="Chi tiết yêu cầu của milestone..."
              value={msDesc}
              onChange={(e) => setMsDesc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddMsOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-600 text-xs rounded-xl hover:bg-slate-200 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 text-white text-xs font-semibold rounded-xl hover:bg-amber-400 shadow-md transition"
            >
              Lưu Milestone
            </button>
          </div>
        </form>
      )}

      {/* Milestones List & Task Breakdown */}
      <div className="space-y-6">
        {milestones.map((ms) => {
          const msTasks = tasks
            .filter((t) => t.milestoneId === ms.id)
            .sort((a, b) => a.orderInMilestone - b.orderInMilestone);

          const totalHours = msTasks.reduce((acc, t) => acc + t.estimatedEffort, 0);
          const doneTasks = msTasks.filter((t) => t.status === 'Done').length;
          const progress = msTasks.length > 0 ? Math.round((doneTasks / msTasks.length) * 100) : 0;
          const isEditing = editingMilestoneId === ms.id;

          return (
            <div
              key={ms.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Milestone Header Bar */}
              <div className="bg-amber-50 p-4 border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">
                    {ms.order}
                  </div>
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          value={editMsTitle}
                          onChange={(e) => setEditMsTitle(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-lg px-2 py-1 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-400"
                        />
                        <input
                          value={editMsDesc}
                          onChange={(e) => setEditMsDesc(e.target.value)}
                          placeholder="Mô tả..."
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-amber-400"
                        />
                        <input
                          type="date"
                          value={editMsTargetDate}
                          onChange={(e) => setEditMsTargetDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-amber-400"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveMilestone(ms.id)}
                            className="px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-400 transition"
                          >
                            Lưu
                          </button>
                          <button
                            onClick={() => setEditingMilestoneId(null)}
                            className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200 transition"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                          {ms.title}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-slate-500 border border-slate-200 font-medium">
                            {msTasks.length} đầu việc
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">{ms.description}</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs shrink-0">
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Tiến độ Milestone</span>
                    <span className="font-bold text-emerald-600">{progress}% hoàn thành</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Tổng Effort</span>
                    <span className="font-bold text-indigo-600">{totalHours}h</span>
                  </div>

                  {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && !isEditing && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEditMilestone(ms)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition"
                        title="Sửa milestone"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Xóa milestone này? Tất cả task trong milestone cũng sẽ bị xóa.')) {
                            deleteMilestone(ms.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Xóa milestone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTask(null);
                          setIsTaskModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition flex items-center gap-1 shadow-md shadow-indigo-600/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Break Task
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tasks List inside Milestone */}
              <div className="divide-y divide-slate-100">
                {msTasks.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Chưa có đầu việc nào được break trong cột mốc này.
                  </div>
                ) : (
                  msTasks.map((t, idx) => (
                    <div
                      key={t.id}
                      className="p-3.5 hover:bg-slate-50 transition flex items-center justify-between gap-4 text-xs"
                    >
                      {/* Left: Reorder controls & Task Title */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              disabled={idx === 0}
                              onClick={() => handleMoveTask(ms.id, idx, 'UP')}
                              className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded disabled:opacity-30 disabled:hover:bg-transparent transition"
                              title="Chuyển lên trước"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              disabled={idx === msTasks.length - 1}
                              onClick={() => handleMoveTask(ms.id, idx, 'DOWN')}
                              className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded disabled:opacity-30 disabled:hover:bg-transparent transition"
                              title="Chuyển xuống sau"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <span className="w-6 text-center font-mono text-slate-400 font-bold shrink-0">
                          #{idx + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700 truncate">{t.title}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200 font-semibold shrink-0">
                              {t.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            <span>Effort: <strong className="text-indigo-600">{t.estimatedEffort}h</strong></span>
                            <span>•</span>
                            <span>Phân công: <strong className="text-slate-600">{t.assigneeAccount || 'Chưa gán'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Status & Actions */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border ${
                            t.status === 'Done'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : t.status === 'In Progress'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}
                        >
                          {t.status} ({t.completionPercentage}%)
                        </span>

                        {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingTask(t);
                                setIsTaskModalOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Sửa task"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Bạn có chắc muốn xóa đầu việc này?')) {
                                  deleteTask(t.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                              title="Xóa task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskModal
        task={editingTask}
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
      />
    </div>
  );
};
