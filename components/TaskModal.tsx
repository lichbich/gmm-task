'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Task, Specialization, TaskStatus } from '../types/task';
import { X, Save, Plus, Edit2, ShieldAlert, MessageSquare, FileText, CheckSquare } from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { Dropdown, DropdownOption } from './common/Dropdown';
import { insertCheckboxToText } from '../lib/descriptionHelper';

interface TaskModalProps {
  task?: Task | null;
  isOpen: boolean;
  onClose: () => void;
  initialMilestoneId?: string;
  initialRole?: Specialization;
  defaultWeek?: number;
  defaultAssignee?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  isOpen,
  onClose,
  initialMilestoneId,
  initialRole,
  defaultWeek,
  defaultAssignee,
}) => {
  const { addTask, updateTask, deleteTask, milestones, users, currentUser, confirmDialog, roles, selectedWeek, selectedYear } = useApp();
  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } = useModalAnimation(isOpen, onClose);

  const allRoleCodes = roles.map((r) => r.code);

  // Compute allowed roles for the current user: Admin can define any role, Leader only within specializations
  const allowedRoles: Specialization[] =
    currentUser?.role === 'Admin'
      ? allRoleCodes
      : currentUser?.specializations && currentUser.specializations.length > 0
      ? currentUser.specializations
      : [allRoleCodes[0] || 'BA'];

  const defaultRole: Specialization =
    initialRole && allowedRoles.includes(initialRole)
      ? initialRole
      : allowedRoles[0] || 'BA';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState<Specialization>(defaultRole);
  const [estimatedEffort, setEstimatedEffort] = useState<number | string>(2);
  const [assigneeAccount, setAssigneeAccount] = useState<string>('');
  const [milestoneId, setMilestoneId] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>('To do');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setRole(task.role);
      setEstimatedEffort(task.estimatedEffort || 2);
      setAssigneeAccount(task.assigneeAccount || '');
      setMilestoneId(task.milestoneId || initialMilestoneId || '');
      setStatus(task.status || 'To do');
      setPriority(task.priority || 'Medium');
      setNotes(task.notes || '');
    } else {
      setTitle('');
      setDescription('');
      setRole(defaultRole);
      setEstimatedEffort(2);
      setAssigneeAccount(defaultAssignee !== undefined ? defaultAssignee : (currentUser?.role === 'Member' && currentUser?.account ? currentUser.account : ''));
      // SYNCHRONIZATION: Members always create ad-hoc/standalone tasks (milestoneId = ''), Leaders/Admins use initialMilestoneId
      setMilestoneId(currentUser?.role === 'Member' ? '' : (initialMilestoneId !== undefined ? initialMilestoneId : (milestones[0]?.id || '')));
      setStatus('To do');
      setPriority('Medium');
      setNotes('');
    }
  }, [task, isOpen, milestones, users, defaultRole, initialMilestoneId, defaultAssignee]);

  if (!isRendered) return null;

  const isMember = currentUser?.role === 'Member';

  // Filter active team members who hold the specialization matching the task's role (excluding locked accounts)
  const eligibleAssignees = users.filter((u) => {
    const isLocked = u.disabled || u.status === 'disabled';
    const isCurrentAssignee = task && task.assigneeAccount && u.account.toLowerCase() === task.assigneeAccount.toLowerCase();
    if (isLocked && !isCurrentAssignee) return false;
    return u.specializations && u.specializations.includes(role);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedEffort =
      typeof estimatedEffort === 'number'
        ? estimatedEffort
        : parseFloat(String(estimatedEffort).replace(',', '.')) || 0;

    if (task) {
      updateTask(task.id, {
        title,
        description,
        role,
        estimatedEffort: parsedEffort,
        assigneeAccount,
        milestoneId,
        status,
        priority,
        notes,
      });
    } else {
      addTask({
        title,
        description,
        role,
        estimatedEffort: parsedEffort,
        actualEffort: 0,
        status,
        priority,
        assigneeAccount,
        milestoneId,
        completionPercentage: 0,
        weekNumber: defaultWeek || selectedWeek,
        year: selectedYear,
        notes,
      });
    }
    handleClose();
  };

  const handleDelete = () => {
    if (!task) return;
    confirmDialog({
      title: 'Xác nhận xóa đầu việc',
      message: `Bạn có chắc chắn muốn xóa đầu việc "${task.title}"? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger',
      onConfirm: () => {
        deleteTask(task.id);
        handleClose();
      },
    });
  };

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={`fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 modal-backdrop-transition overflow-y-auto ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        className={`bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl text-slate-800 relative max-h-[92vh] flex flex-col overflow-hidden modal-dialog-transition ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 sm:py-4 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold shadow-xs">
              {task ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {task
                  ? 'Chỉnh Sửa & Phân Công Task'
                  : milestoneId
                  ? 'Break Task Mới từ Milestone'
                  : 'Tạo Task Tự Do Mới'}
              </h3>
              <p className="text-xs text-slate-500">Thiết lập đầu việc, số giờ ước tính, phân công và ghi chú luồng task</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form with Scrollable Content Body and Fixed Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-5 sm:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
            {/* Milestone Selection (Synchronized with clicked milestone or ad-hoc) */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Thuộc Cột Mốc Milestone:
              </label>
              {isMember && !task ? (
                <div className="w-full bg-slate-50 border border-slate-300/90 rounded-xl px-3 py-2 text-slate-700 text-xs font-semibold flex items-center justify-between gap-2 h-[38px] shadow-2xs">
                  <span>📌 Không gán Milestone (Task tự do / Phát sinh ngoài)</span>
                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md font-medium shrink-0">
                    Thành viên (Task Tự Do)
                  </span>
                </div>
              ) : (
                <Dropdown
                  value={milestoneId}
                  onChange={setMilestoneId}
                  options={[
                    { value: '', label: '📌 Không gán Milestone (Task tự do / Phát sinh ngoài)' },
                    ...milestones
                      .filter((m) => {
                        if (currentUser?.role === 'Admin') return true;
                        if (m.role && m.role !== 'ALL') return m.role === role;
                        return true;
                      })
                      .map((m) => ({
                        value: m.id,
                        label: `🚩 ${m.title}${m.role && m.role !== 'ALL' ? ` [${m.role}]` : ''}`,
                      })),
                  ]}
                  className="w-full"
                  buttonClassName="py-2.5 px-3 text-xs bg-slate-50 border-slate-300/90 font-medium"
                />
              )}
            </div>

            {/* Task Title */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Tên Đầu Việc (Task Name): <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: BA | Viết tài liệu phần 'Working schedule'..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300/90 rounded-xl px-3 py-2.5 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                required
              />
            </div>

            {/* Chi Tiết Task (Mô tả công việc chi tiết cho thành viên) */}
            <div>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  Chi Tiết Task (Mô tả & Checklist việc con):
                </label>
                <button
                  type="button"
                  onClick={() => setDescription((prev) => insertCheckboxToText(prev))}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition"
                  title="Chèn thêm checkbox / việc con"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  + Thêm Checkbox
                </button>
              </div>
              <textarea
                rows={3}
                placeholder="Mô tả chi tiết nội dung đầu việc, hướng dẫn thực hiện, hoặc checklist việc con cho thành viên... (Gõ - [ ] Tên việc con để tạo checkbox)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300/90 rounded-xl p-3 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition resize-none leading-relaxed"
              />
            </div>

            {/* Role & Estimated Effort */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Role Phụ Trách:
                </label>
                {allowedRoles.length === 1 ? (
                  <div
                    className="w-full bg-slate-50 border border-slate-300/90 rounded-xl px-3 py-2 text-slate-800 text-xs font-semibold flex items-center justify-between gap-2 h-[38px] shadow-2xs"
                    title={`${role}${roles.find((ro) => ro.code === role)?.name ? ` - ${roles.find((ro) => ro.code === role)?.name}` : ''} (Cố định theo chuyên môn Leader)`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                      <span className="font-bold text-indigo-700 shrink-0">
                        {role}
                      </span>
                      {roles.find((ro) => ro.code === role)?.name && (
                        <span className="text-[11px] text-slate-500 font-normal truncate hidden sm:inline">
                          • {roles.find((ro) => ro.code === role)?.name}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md font-medium shrink-0">
                      Leader
                    </span>
                  </div>
                ) : (
                  <Dropdown
                    value={role}
                    onChange={(newRole) => {
                      setRole(newRole as Specialization);
                      setAssigneeAccount('');
                    }}
                    options={allowedRoles.map((r) => {
                      const matched = roles.find((ro) => ro.code === r);
                      return {
                        value: r,
                        label: matched ? `${r} - ${matched.name}` : r,
                      };
                    })}
                    className="w-full"
                    buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-300/90 h-[38px]"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Ước Tính Giờ (Effort):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={estimatedEffort}
                  onChange={(e) => setEstimatedEffort(e.target.value)}
                  placeholder="2.0"
                  className="w-full bg-slate-50 border border-slate-300/90 rounded-xl px-3 py-2 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition font-mono font-semibold"
                  required
                />
              </div>
            </div>

            {/* Assignee Account */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Phân Công Thành Viên:
                </label>
                <span className="text-[10px] text-indigo-600 font-medium">
                  {eligibleAssignees.length} thành viên phù hợp
                </span>
              </div>
              <Dropdown
                value={assigneeAccount}
                onChange={setAssigneeAccount}
                options={[
                  { value: '', label: '-- Để trống (Chưa phân công) --' },
                  ...eligibleAssignees.map((u) => ({
                    value: u.account,
                    label: `${u.account} - ${u.name}`,
                    subLabel: `${u.role} • [${u.specializations.join(', ')}]`,
                  })),
                ]}
                className="w-full"
                buttonClassName="py-2.5 px-3 text-xs bg-slate-50 border-slate-300/90"
              />

              {eligibleAssignees.length === 0 && (
                <p className="text-[11px] text-amber-700 mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Chưa có thành viên nào có chuyên môn {role}. Hãy tạo hoặc cấp chuyên môn trong Quản lý User.
                </p>
              )}
            </div>

            {/* Status & Priority Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Trạng Thái Ban Đầu:
                </label>
                <Dropdown
                  value={status}
                  onChange={(newStatus) => setStatus(newStatus as TaskStatus)}
                  options={[
                    { value: 'To do', label: 'To do (Cần làm)' },
                    { value: 'In Progress', label: 'In Progress (Đang làm)' },
                    { value: 'Done', label: 'Done (Đã hoàn thành)' },
                  ]}
                  className="w-full"
                  buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-300/90"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Mức Độ Ưu Tiên:
                </label>
                <Dropdown
                  value={priority}
                  onChange={(newPriority) => setPriority(newPriority as 'High' | 'Medium' | 'Low')}
                  options={[
                    { value: 'High', label: '🔴 Cao (Khẩn cấp)' },
                    { value: 'Medium', label: '🟡 Trung bình (Bình thường)' },
                    { value: 'Low', label: '🟢 Thấp' },
                  ]}
                  className="w-full"
                  buttonClassName="py-2 px-3 text-xs bg-slate-50 border-slate-300/90"
                />
              </div>
            </div>

            {/* Dedicated Note & Discussion Field for All Task Management */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                  Ghi Chú & Trao Đổi Luồng Task (Notes / Discussion):
                </label>
                <span className="text-[10px] text-slate-400">Các thành viên cùng theo dõi & phản hồi</span>
              </div>
              <textarea
                rows={3}
                placeholder="Nhập ghi chú yêu cầu, trao đổi luồng công việc hoặc cập nhật giữa các thành viên..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300/90 rounded-xl p-3 text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="p-4 sm:px-6 sm:py-4 border-t border-slate-100 shrink-0 bg-slate-50/60 flex items-center justify-between gap-3 rounded-b-3xl">
            {task && (currentUser?.role === 'Leader' || currentUser?.role === 'Advisor' || currentUser?.role === 'Admin') ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3.5 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 active:scale-95"
              >
                Xóa Task
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-xl transition active:scale-95 shadow-2xs"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition active:scale-95"
              >
                <Save className="w-4 h-4" />
                {task ? 'Cập Nhật Task' : 'Lưu & Phân Công'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
