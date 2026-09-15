'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Task } from '../types/task';
import {
  X,
  MessageSquare,
  Clock,
  AlertTriangle,
  Award,
  Save,
  Send,
  CheckCircle,
  UserCheck,
  Flag,
  FolderOpen,
  Trash2,
  Edit3,
  FileText,
  User,
  Calendar,
  Sparkles,
  Flame,
  Check,
  Info,
} from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReport?: (task: Task) => void;
}

const formatDateTime = (isoOrStr?: string): string => {
  if (!isoOrStr) return '';
  try {
    const d = new Date(isoOrStr);
    if (isNaN(d.getTime())) return isoOrStr;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${minutes} • ${day}/${month}/${year}`;
  } catch {
    return isoOrStr;
  }
};

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onOpenReport,
}) => {
  const {
    milestones,
    updateTaskNotes,
    updateTask,
    canEditTask,
    weeklyAwards,
    deleteTask,
    currentUser,
    users,
    confirmDialog,
    markNoteAsRead,
  } = useApp();
  const { isRendered, isVisible, handleClose } = useModalAnimation(isOpen, onClose);

  const [notesText, setNotesText] = useState('');
  const [quickComment, setQuickComment] = useState('');
  const [isEditingRaw, setIsEditingRaw] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Task description states
  const [descText, setDescText] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSavedDesc, setIsSavedDesc] = useState(false);

  useEffect(() => {
    if (task) {
      setNotesText(task.notes || '');
      setDescText(task.description || '');
      setQuickComment('');
      setIsSaved(false);
      setIsEditingRaw(false);
      setIsEditingDesc(false);
      setIsSavedDesc(false);
      if (task.notes) {
        markNoteAsRead(task.id, task.notes);
      }
    }
  }, [task]);

  if (!isRendered || !task) return null;

  const milestone = milestones.find((m) => m.id === task.milestoneId);
  const isEditable = canEditTask(task);
  const assigneeUser = users.find(
    (u) => u.account.toLowerCase() === task.assigneeAccount.toLowerCase()
  );

  const award = weeklyAwards.find((w) => w.account === task.assigneeAccount);
  const isTopEffort = award?.isTopEffort || false;
  const isLate = task.isSubmittedLate;

  // Metadata fallbacks
  const creatorDisplay = task.createdBy || 'QuynhNV (Leader)';
  const createdDateDisplay = formatDateTime(task.createdAt || '2026-09-14T08:30:00Z');
  const updatedDateDisplay = task.updatedAt ? formatDateTime(task.updatedAt) : null;
  const priority = task.priority || 'Medium';

  // Handle saving inline description
  const handleSaveDescription = (e: React.FormEvent) => {
    e.preventDefault();
    updateTask(task.id, { description: descText.trim() });
    setIsEditingDesc(false);
    setIsSavedDesc(true);
    setTimeout(() => setIsSavedDesc(false), 2500);
  };

  // Handle appending quick discussion / exchange note
  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickComment.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const userRole = currentUser?.specializations?.[0] || currentUser?.role || 'Member';
    const senderTag = currentUser ? `${currentUser.name} (${userRole})` : 'Thành viên';
    const newEntry = `[${senderTag} - ${timeStr}]: ${quickComment.trim()}`;
    const updated = notesText ? `${notesText}\n${newEntry}` : newEntry;

    setNotesText(updated);
    updateTaskNotes(task.id, updated);
    setQuickComment('');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Handle direct raw notes update
  const handleSaveRawNotes = (e: React.FormEvent) => {
    e.preventDefault();
    updateTaskNotes(task.id, notesText);
    setIsEditingRaw(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
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

  // Parse lines for rich discussion display
  const noteLines = notesText
    ? notesText.split('\n').filter((l) => l.trim().length > 0)
    : [];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 modal-backdrop-transition ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl text-slate-800 dark:text-slate-100 max-h-[92vh] flex flex-col overflow-hidden relative modal-dialog-transition ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Fixed Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-5 sm:px-6 sm:py-4 shrink-0 bg-white dark:bg-slate-900">
          <div className="space-y-2 flex-1 pr-2 min-w-0">
            {/* Status & Category Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 text-xs font-semibold">
                {task.role}
              </span>

              {/* Priority badge */}
              {priority === 'High' ? (
                <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80 text-xs font-semibold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-rose-500" /> Ưu tiên Cao
                </span>
              ) : priority === 'Low' ? (
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                  Ưu tiên Thấp
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80 text-xs font-semibold">
                  Ưu tiên Trung bình
                </span>
              )}

              {/* Status badge */}
              <span
                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                  task.status === 'Done'
                    ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80'
                    : task.status === 'In Progress'
                    ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/80'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {task.status}
              </span>

              <span className="text-xs text-slate-400 font-mono">#{task.id.replace('tsk-', '')}</span>

              {isLate && (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 text-[10px] font-bold rounded-full flex items-center gap-1 shrink-0">
                  <AlertTriangle className="w-3 h-3" /> PHẠT (Nộp muộn)
                </span>
              )}
              {isTopEffort && (
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1 shrink-0">
                  <Award className="w-3 h-3" /> THƯỞNG (Top Effort)
                </span>
              )}
            </div>

            {/* Task Title */}
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug break-words pt-1">
              {task.title}
            </h3>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition active:scale-95 shrink-0"
            title="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body with custom-scrollbar */}
        <div className="p-5 sm:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4 min-h-0 bg-white dark:bg-slate-900">
          {/* Creator & Creation Date Info Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 dark:text-slate-400">Người tạo:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{creatorDisplay}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-400">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>Khởi tạo: {createdDateDisplay}</span>
                  {updatedDateDisplay && (
                    <>
                      <span>•</span>
                      <span>Cập nhật: {updatedDateDisplay}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right text-[11px] shrink-0">
              <span className="font-medium bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                Tuần {task.weekNumber} / {task.year}
              </span>
            </div>
          </div>

          {/* Task Details / Description Section */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Mô Tả Chi Tiết & Hướng Dẫn Kỹ Thuật (Leader):</span>
              </div>

              {!isEditingDesc && (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(true)}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 hover:underline transition"
                >
                  <Edit3 className="w-3 h-3" />
                  {task.description ? 'Chỉnh sửa mô tả' : '+ Thêm mô tả'}
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <form onSubmit={handleSaveDescription} className="space-y-2 pt-1">
                <textarea
                  rows={4}
                  value={descText}
                  onChange={(e) => setDescText(e.target.value)}
                  placeholder="Nhập mô tả chi tiết công việc, hướng dẫn thực hiện, tiêu chí nghiệm thu hoặc checklist cho thành viên..."
                  className="w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition resize-none leading-relaxed"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDescText(task.description || '');
                      setIsEditingDesc(false);
                    }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-xl font-medium transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Lưu Mô Tả
                  </button>
                </div>
              </form>
            ) : (
              <div>
                {task.description ? (
                  <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3">
                    <p className="text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-normal">
                      {task.description}
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingDesc(true)}
                    className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-3.5 text-center text-xs cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition space-y-1"
                  >
                    <div className="font-medium text-slate-600 dark:text-slate-300">Chưa có mô tả chi tiết cho task này</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-400">
                      Bấm vào đây để thêm nội dung hướng dẫn hoặc yêu cầu nghiệm thu từ Leader.
                    </div>
                  </div>
                )}
              </div>
            )}

            {isSavedDesc && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 animate-fade-in pt-1">
                <CheckCircle className="w-3.5 h-3.5" /> Đã cập nhật mô tả task thành công!
              </div>
            )}
          </div>

          {/* Comprehensive Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">Người phụ trách:</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 truncate" title={assigneeUser?.name || task.assigneeAccount}>
                <UserCheck className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                {assigneeUser ? `${assigneeUser.name} (${task.assigneeAccount})` : task.assigneeAccount || 'Chưa gán'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">Cột mốc Milestone:</span>
              {milestone ? (
                <span className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 px-2 py-0.5 rounded-md truncate max-w-full" title={milestone.title}>
                  <Flag className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">{milestone.title}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                  <FolderOpen className="w-3 h-3 text-slate-400 shrink-0" />
                  Ngoài Milestone
                </span>
              )}
            </div>

            <div>
              <span className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">Effort Thực tế / Ước tính:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                {task.actualEffort}h <span className="text-slate-400 font-normal">/</span> {task.estimatedEffort}h
              </span>
            </div>

            <div>
              <span className="text-slate-400 dark:text-slate-400 block mb-1 text-[11px] font-medium">Tiến độ hoàn thành:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                {task.completionPercentage}%
              </span>
            </div>
          </div>

          {/* Completion Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-200/80 dark:border-slate-700">
              <div
                className={`h-full transition-all duration-300 ${
                  task.completionPercentage === 100
                    ? 'bg-emerald-500'
                    : task.completionPercentage > 0
                    ? 'bg-indigo-600 dark:bg-indigo-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
                style={{ width: `${task.completionPercentage}%` }}
              />
            </div>
          </div>

          {/* SECTION: Collaborative Notes & Discussion Feed (Luồng Trao Đổi Task) */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Luồng Trao Đổi & Ghi Chú Task (Notes & Discussion):
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingRaw(!isEditingRaw)}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1 hover:underline"
                >
                  <Edit3 className="w-3 h-3" />
                  {isEditingRaw ? 'Quay lại xem trao đổi' : 'Sửa trực tiếp toàn bộ note'}
                </button>
              </div>
            </div>

            {isEditingRaw ? (
              /* Direct RAW Note Edit */
              <form onSubmit={handleSaveRawNotes} className="space-y-2">
                <textarea
                  rows={5}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Nhập toàn bộ ghi chú công việc..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none font-mono"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingRaw(false)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-xl transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Lưu Thay Đổi Note
                  </button>
                </div>
              </form>
            ) : (
              /* Rich Thread Display & Quick Discussion Post */
              <div className="space-y-2.5">
                {/* Discussion History Container */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 max-h-52 overflow-y-auto custom-scrollbar space-y-2">
                  {noteLines.length === 0 ? (
                    <div className="text-center py-5 text-slate-400 dark:text-slate-400 text-xs flex flex-col items-center gap-1.5">
                      <MessageSquare className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                      <span>Chưa có ghi chú hoặc trao đổi nào cho task này.</span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-400">Hãy nhập phản hồi bên dưới để bắt đầu trao đổi luồng task!</span>
                    </div>
                  ) : (
                    noteLines.map((line, idx) => {
                      const isTaggedMessage = line.startsWith('[') && line.includes(']:');
                      if (isTaggedMessage) {
                        const match = line.match(/^\[(.*?)\]:\s*(.*)$/);
                        const authorInfo = match ? match[1] : '';
                        const messageBody = match ? match[2] : line;
                        return (
                          <div
                            key={idx}
                            className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-2.5 shadow-2xs text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-indigo-600 dark:text-indigo-300 text-[11px] bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800/80">
                                {authorInfo}
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap pl-1">
                              {messageBody}
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={idx}
                          className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap"
                        >
                          {line}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Collaborative Input Field for ANY team member */}
                <form onSubmit={handleSendComment} className="flex gap-2">
                  <input
                    type="text"
                    value={quickComment}
                    onChange={(e) => setQuickComment(e.target.value)}
                    placeholder={`Gửi ghi chú/trao đổi luồng task với vai trò ${currentUser?.name || 'thành viên'}...`}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="submit"
                    disabled={!quickComment.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Gửi Phản Hồi
                  </button>
                </form>

                {isSaved && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 animate-fade-in">
                    <CheckCircle className="w-3.5 h-3.5" /> Đã lưu và đồng bộ ghi chú task thành công!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-between gap-3 p-4 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/60 dark:bg-slate-900 rounded-b-3xl">
          {(currentUser?.role === 'Leader' || currentUser?.role === 'Admin') ? (
            <button
              type="button"
              onClick={handleDelete}
              className="px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa Task
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl transition active:scale-95 shadow-2xs"
            >
              Đóng
            </button>

            {isEditable && onOpenReport && (
              <button
                onClick={() => {
                  handleClose();
                  setTimeout(() => {
                    onOpenReport(task);
                  }, 200);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 active:scale-95"
              >
                <Clock className="w-3.5 h-3.5" />
                Nộp Báo Cáo Tiến Độ
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
