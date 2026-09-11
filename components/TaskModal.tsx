'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Task, Specialization, TaskStatus } from '../types/task';
import { X, Save, Plus, Edit2, ShieldAlert } from 'lucide-react';

interface TaskModalProps {
  task?: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ task, isOpen, onClose }) => {
  const { addTask, updateTask, milestones, users, currentUser } = useApp();

  const primaryRole = currentUser?.specializations?.[0] || 'BA';

  const [title, setTitle] = useState('');
  const [role, setRole] = useState<Specialization>(primaryRole);
  const [estimatedEffort, setEstimatedEffort] = useState<number>(2);
  const [assigneeAccount, setAssigneeAccount] = useState<string>('');
  const [milestoneId, setMilestoneId] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>('To do');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setRole(task.role);
      setEstimatedEffort(task.estimatedEffort || 2);
      setAssigneeAccount(task.assigneeAccount || '');
      setMilestoneId(task.milestoneId || (milestones[0]?.id ?? ''));
      setStatus(task.status || 'To do');
    } else {
      setTitle('');
      setRole(primaryRole);
      setEstimatedEffort(2);
      setAssigneeAccount('');
      setMilestoneId(milestones[0]?.id || '');
      setStatus('To do');
    }
  }, [task, isOpen, milestones, users, primaryRole]);

  if (!isOpen) return null;

  // Filter team members who hold the specialization matching the task's role!
  const eligibleAssignees = users.filter(
    (u) => u.specializations && u.specializations.includes(role)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (task) {
      updateTask(task.id, {
        title,
        role,
        estimatedEffort,
        assigneeAccount,
        milestoneId,
        status,
      });
    } else {
      addTask({
        title,
        role,
        estimatedEffort,
        actualEffort: 0,
        status,
        assigneeAccount,
        milestoneId,
        completionPercentage: 0,
        weekNumber: 37,
        year: 2026,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-slate-800">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold">
              {task ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {task ? 'Chỉnh Sửa & Phân Công Task' : 'Break Task Mới Từ Milestone (Leader)'}
              </h3>
              <p className="text-xs text-slate-500">Thiết lập đầu việc, số giờ ước tính và giao cho thành viên đúng chuyên môn</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-5 space-y-4">
          {/* Milestone Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Thuộc Cột Mốc Milestone:
            </label>
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
              required
            >
              <option value="" disabled>-- Chọn Milestone --</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Task Title */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Tên Đầu Việc (Task Name):
            </label>
            <input
              type="text"
              placeholder="VD: BA | Viết tài liệu phần 'Working schedule'..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Role & Estimated Effort */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Role Phụ Trách:
              </label>
              <select
                value={role}
                onChange={(e) => {
                  const newRole = e.target.value as Specialization;
                  setRole(newRole);
                  setAssigneeAccount(''); // Reset assignee if role changes
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
              >
                <option value="BA">BA (Business Analyst)</option>
                <option value="Design">Design (UI/UX)</option>
                <option value="FE">FE (Front-End)</option>
                <option value="BE">BE (Back-End)</option>
                <option value="QA">QA (Tester)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Ước Tính Giờ (Effort):
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={estimatedEffort}
                onChange={(e) => setEstimatedEffort(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {/* Assignee Account (FILTERED BY SPECIALIZATION MATCHING TASK ROLE) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Phân Công Thành Viên (Chỉ hiển thị thành viên có chuyên môn {role}):
              </label>
              <span className="text-[10px] text-indigo-600 font-medium">
                {eligibleAssignees.length} thành viên phù hợp
              </span>
            </div>
            <select
              value={assigneeAccount}
              onChange={(e) => setAssigneeAccount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Để trống (Chưa phân công) --</option>
              {eligibleAssignees.map((u) => (
                <option key={u.id} value={u.account}>
                  {u.account} - {u.name} ({u.role} - [{u.specializations.join(', ')}])
                </option>
              ))}
            </select>

            {eligibleAssignees.length === 0 && (
              <p className="text-[11px] text-amber-700 mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Chưa có thành viên nào có chuyên môn {role}. Hãy tạo hoặc cấp chuyên môn trong Quản lý User.
              </p>
            )}
          </div>

          {/* Status Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Trạng Thái Ban Đầu:
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="To do">To do</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              {task ? 'Cập Nhật Task' : 'Lưu & Phân Công'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
