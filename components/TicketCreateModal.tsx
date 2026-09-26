'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { Ticket, TicketPriority, Specialization } from '../types/task';
import { Dropdown, DropdownOption } from './common/Dropdown';
import {
  X,
  Send,
  AlertCircle,
  Link as LinkIcon,
  Plus,
  Trash2,
  Sparkles,
  Flame,
  Layers,
} from 'lucide-react';

interface TicketCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (ticket: Ticket) => void;
  defaultToRole?: string;
  defaultRelatedTaskId?: string;
  defaultRelatedMilestoneId?: string;
}

export const TicketCreateModal: React.FC<TicketCreateModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  defaultToRole,
  defaultRelatedTaskId,
  defaultRelatedMilestoneId,
}) => {
  const {
    currentUser,
    roles,
    tasks,
    milestones,
    createTicket,
  } = useApp();

  const userSpecializations = currentUser?.specializations && currentUser.specializations.length > 0
    ? currentUser.specializations
    : [currentUser?.role === 'Admin' ? 'PO' : 'BA'];

  const [fromRole, setFromRole] = useState<string>(userSpecializations[0] || 'Design');
  const [toRole, setToRole] = useState<string>(defaultToRole || 'BA');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [relatedTaskId, setRelatedTaskId] = useState<string>(defaultRelatedTaskId || '');
  const [relatedMilestoneId, setRelatedMilestoneId] = useState<string>(defaultRelatedMilestoneId || '');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const {
    isRendered,
    isVisible,
    handleClose,
    handleBackdropMouseDown,
    handleBackdropClick,
  } = useModalAnimation(isOpen, onClose);

  // Available roles for destination
  const availableToRoles = roles && roles.length > 0
    ? roles.map((r) => r.code)
    : ['BA', 'Design', 'FE', 'BE', 'QA', 'SA', 'DevOps', 'Mobile', 'AI'];

  const fromRoleOptions: DropdownOption[] = (
    currentUser?.role === 'Admin' ? availableToRoles : userSpecializations
  ).map((r) => ({
    value: r,
    label: `Team ${r} ${userSpecializations.includes(r) ? '(Bạn)' : ''}`,
  }));

  const toRoleOptions: DropdownOption[] = availableToRoles.map((r) => ({
    value: r,
    label: `Team ${r}`,
    subLabel: `Leader & Advisor ${r}`,
  }));

  const milestoneOptions: DropdownOption[] = [
    { value: '', label: '-- Không liên kết Milestone --' },
    ...milestones.map((m) => ({
      value: m.id,
      label: m.title,
      subLabel: `[${m.role || 'ALL'}]`,
    })),
  ];

  const taskOptions: DropdownOption[] = [
    { value: '', label: '-- Không liên kết Task --' },
    ...tasks.map((t) => ({
      value: t.id,
      label: t.title,
      subLabel: `[${t.role}] Tuần ${t.weekNumber}`,
    })),
  ];

  const handleAddAttachment = () => {
    setAttachmentUrls([...attachmentUrls, '']);
  };

  const handleUpdateAttachment = (index: number, value: string) => {
    const updated = [...attachmentUrls];
    updated[index] = value;
    setAttachmentUrls(updated);
  };

  const handleRemoveAttachment = (index: number) => {
    const updated = attachmentUrls.filter((_, i) => i !== index);
    setAttachmentUrls(updated.length > 0 ? updated : ['']);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!title.trim()) {
      setErrorMessage('Vui lòng nhập tiêu đề yêu cầu.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Vui lòng mô tả chi tiết khúc mắc hoặc nội dung yêu cầu hỗ trợ.');
      return;
    }

    if (!toRole) {
      setErrorMessage('Vui lòng chọn Team / Nghiệp vụ tiếp nhận yêu cầu.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const selectedTask = relatedTaskId ? tasks.find((t) => t.id === relatedTaskId) : undefined;
      const selectedMilestone = relatedMilestoneId ? milestones.find((m) => m.id === relatedMilestoneId) : undefined;
      const validAttachments = attachmentUrls.map((u) => u.trim()).filter((u) => u.length > 0);

      const created = await createTicket({
        title: title.trim(),
        description: description.trim(),
        fromRole: fromRole as Specialization,
        fromAccount: currentUser.account,
        fromName: currentUser.name,
        fromUserRole: currentUser.role,
        toRole: toRole as Specialization,
        priority,
        status: 'Open',
        relatedTaskId: selectedTask ? selectedTask.id : undefined,
        relatedTaskTitle: selectedTask ? selectedTask.title : undefined,
        relatedMilestoneId: selectedMilestone ? selectedMilestone.id : undefined,
        relatedMilestoneTitle: selectedMilestone ? selectedMilestone.title : undefined,
        attachments: validAttachments,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('Medium');
      setRelatedTaskId('');
      setRelatedMilestoneId('');
      setAttachmentUrls(['']);

      if (onCreated) {
        onCreated(created);
      }
      handleClose();
    } catch (err: any) {
      console.error('Error creating ticket:', err);
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi tạo ticket yêu cầu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isRendered) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-auto">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] transition-all duration-200 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Tạo Request Ticket Liên Team
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gửi yêu cầu tài liệu, thiết kế, API hoặc làm rõ nghiệp vụ sang team khác
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Flow Selector: From Team -> To Team with Common Dropdown */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Luồng phối hợp giữa các Team (From ➔ To)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
              {/* From Team */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Team của bạn (From):
                </span>
                <Dropdown
                  value={fromRole}
                  onChange={(val) => setFromRole(val)}
                  options={fromRoleOptions}
                  placeholder="Chọn team gửi..."
                  size="md"
                  className="w-full"
                />
              </div>

              {/* To Team */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Gửi đến Team tiếp nhận (To): <span className="text-red-500">*</span>
                </span>
                <Dropdown
                  value={toRole}
                  onChange={(val) => setToRole(val)}
                  options={toRoleOptions}
                  placeholder="Chọn team tiếp nhận..."
                  size="md"
                  className="w-full"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
              Hệ thống sẽ gửi thông báo trực tiếp đến <strong>Leader</strong> và <strong>Advisor</strong> của Team <strong>{toRole}</strong>.
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Tiêu đề Request <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Cần tài liệu đặc tả luồng lấy account thành viên đăng nhập..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Mức độ ưu tiên
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['Low', 'Medium', 'High', 'Urgent'] as TicketPriority[]).map((p) => {
                const isSelected = priority === p;
                let colorClasses = '';
                let label = '';
                switch (p) {
                  case 'Urgent':
                    label = 'Khẩn cấp';
                    colorClasses = isSelected
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/30'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:border-rose-400';
                    break;
                  case 'High':
                    label = 'Cao';
                    colorClasses = isSelected
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-600/30'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:border-amber-400';
                    break;
                  case 'Medium':
                    label = 'Trung bình';
                    colorClasses = isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/30'
                      : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400';
                    break;
                  case 'Low':
                    label = 'Thấp';
                    colorClasses = isSelected
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400';
                    break;
                }

                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-2 px-1.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer active:scale-95 flex items-center justify-center gap-1 ${colorClasses}`}
                  >
                    {p === 'Urgent' && <Flame className="w-3.5 h-3.5 shrink-0" />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Mô tả chi tiết khúc mắc & yêu cầu hỗ trợ <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả cụ thể bối cảnh: Team bạn đang làm gì, đang gặp vướng mắc ở phần nào, và cần team đích cung cấp hay xử lý thông tin gì để có thể tiếp tục..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Linked Milestone / Task with Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Milestone liên quan (Tùy chọn)
              </label>
              <Dropdown
                value={relatedMilestoneId}
                onChange={(val) => setRelatedMilestoneId(val)}
                options={milestoneOptions}
                placeholder="Chọn milestone liên quan..."
                searchable={true}
                size="md"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Task công việc liên quan (Tùy chọn)
              </label>
              <Dropdown
                value={relatedTaskId}
                onChange={(val) => setRelatedTaskId(val)}
                options={taskOptions}
                placeholder="Chọn task liên quan..."
                searchable={true}
                size="md"
                className="w-full"
              />
            </div>
          </div>

          {/* Attachments / Reference Links */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span>Link tài liệu / Thiết kế / Figma / API đính kèm (Tùy chọn)</span>
              </label>
              <button
                type="button"
                onClick={handleAddAttachment}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Thêm link
              </button>
            </div>

            <div className="space-y-2">
              {attachmentUrls.map((url, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleUpdateAttachment(idx, e.target.value)}
                    placeholder="https://figma.com/file/... hoặc link Google Docs, Drive"
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {attachmentUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang gửi...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Gửi Request Đến Team {toRole}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
