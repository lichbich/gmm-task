'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Task } from '../types/task';
import {
  X,
  MessageSquare,
  Send,
  CheckCircle,
  Edit3,
  Save,
  User,
  ExternalLink,
  Flame,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface TaskDiscussionModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenFullDetail?: (task: Task) => void;
}

export const TaskDiscussionModal: React.FC<TaskDiscussionModalProps> = ({
  task,
  isOpen,
  onClose,
  onOpenFullDetail,
}) => {
  const { currentUser, tasks, updateTaskNotes, markNoteAsRead, users } = useApp();
  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } = useModalAnimation(isOpen, onClose);

  // Keep task updated in real-time with context
  const activeTask = tasks.find((t) => t.id === task?.id) || task;

  const [notesText, setNotesText] = useState('');
  const [quickComment, setQuickComment] = useState('');
  const [isEditingRaw, setIsEditingRaw] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTask) {
      setNotesText(activeTask.notes || '');
      setQuickComment('');
      setIsSaved(false);
      setIsEditingRaw(false);
      if (activeTask.notes) {
        markNoteAsRead(activeTask.id, activeTask.notes);
      }
    }
  }, [activeTask?.id, activeTask?.notes]);

  // Auto scroll to bottom of discussion
  useEffect(() => {
    if (!isEditingRaw && isVisible) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [notesText, isEditingRaw, isVisible]);

  if (!isRendered || !activeTask) return null;

  const assigneeUser = users.find(
    (u) => u.account.toLowerCase() === (activeTask.assigneeAccount || '').toLowerCase()
  );

  const displayWeekNumber =
    activeTask.weekNumber <= 53 ? activeTask.weekNumber + 55 : activeTask.weekNumber;

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickComment.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(
      now.getMonth() + 1
    ).padStart(2, '0')}`;
    const userRole = currentUser?.specializations?.[0] || currentUser?.role || 'Member';
    const senderTag = currentUser ? `${currentUser.name} (${userRole})` : 'Thành viên';
    const newEntry = `[${senderTag} - ${timeStr}]: ${quickComment.trim()}`;
    const updated = notesText ? `${notesText}\n${newEntry}` : newEntry;

    setNotesText(updated);
    updateTaskNotes(activeTask.id, updated);
    setQuickComment('');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleSaveRawNotes = (e: React.FormEvent) => {
    e.preventDefault();
    updateTaskNotes(activeTask.id, notesText);
    setIsEditingRaw(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const noteLines = notesText
    ? notesText.split('\n').filter((l) => l.trim().length > 0)
    : [];

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 modal-backdrop-transition ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl text-slate-800 dark:text-slate-100 max-h-[90vh] flex flex-col overflow-hidden relative modal-dialog-transition ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 shrink-0 bg-white dark:bg-slate-900">
          <div className="space-y-1.5 min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 text-xs font-bold">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Luồng Trao Đổi Task
              </span>

              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                {activeTask.role}
              </span>

              <span className="text-[11px] font-mono text-slate-400">
                Tuần {displayWeekNumber} / {activeTask.year}
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug break-words">
              {activeTask.title}
            </h3>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
              <span>Phụ trách:</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {assigneeUser?.name || activeTask.assigneeAccount || 'Chưa gán'}
              </span>
              {activeTask.assigneeAccount && (
                <span className="font-mono text-slate-400">(@{activeTask.assigneeAccount})</span>
              )}
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition active:scale-95 shrink-0"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Conversation Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-0 bg-slate-50/50 dark:bg-slate-900/60">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>Nội dung ghi chú & trao đổi ({noteLines.length}):</span>
            </span>

            <button
              type="button"
              onClick={() => setIsEditingRaw(!isEditingRaw)}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold flex items-center gap-1 hover:underline"
            >
              <Edit3 className="w-3 h-3" />
              {isEditingRaw ? 'Quay lại dạng tin nhắn' : 'Sửa trực tiếp toàn bộ note'}
            </button>
          </div>

          {isEditingRaw ? (
            /* RAW Note Editing Form */
            <form onSubmit={handleSaveRawNotes} className="space-y-3">
              <textarea
                rows={10}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Nhập toàn bộ ghi chú công việc..."
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-3.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-mono resize-none leading-relaxed"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingRaw(false)}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-xl font-medium transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Lưu Ghi Chú
                </button>
              </div>
            </form>
          ) : (
            /* Message Bubbles Stream */
            <div className="space-y-2.5">
              {noteLines.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-500">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Chưa có ghi chú hoặc trao đổi nào.
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Nhập phản hồi bên dưới để bắt đầu trao đổi với người phụ trách hoặc Leader!
                  </span>
                </div>
              ) : (
                noteLines.map((line, idx) => {
                  const isTaggedMessage = line.startsWith('[') && line.includes(']:');
                  if (isTaggedMessage) {
                    const match = line.match(/^\[(.*?)\]:\s*(.*)$/);
                    const authorInfo = match ? match[1] : '';
                    const messageBody = match ? match[2] : line;

                    // Check if current user is author
                    const isMyMessage =
                      currentUser &&
                      (authorInfo.toLowerCase().includes(currentUser.name.toLowerCase()) ||
                        authorInfo.toLowerCase().includes(currentUser.account.toLowerCase()));

                    return (
                      <div
                        key={idx}
                        className={`rounded-2xl p-3 text-xs space-y-1 shadow-2xs transition ${
                          isMyMessage
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-200/90 dark:border-indigo-800/80 ml-4'
                            : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-semibold text-[11px] px-2 py-0.5 rounded-md ${
                              isMyMessage
                                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-bold'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {authorInfo}
                          </span>
                        </div>
                        <p className="text-slate-800 dark:text-slate-100 text-xs leading-relaxed whitespace-pre-wrap pl-0.5 pt-0.5">
                          {messageBody}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-3 text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap"
                    >
                      {line}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input & Quick Actions Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 space-y-3">
          {!isEditingRaw && (
            <form onSubmit={handleSendComment} className="flex gap-2">
              <input
                type="text"
                value={quickComment}
                onChange={(e) => setQuickComment(e.target.value)}
                placeholder={`Nhập phản hồi / trao đổi với vai trò ${
                  currentUser?.name || 'thành viên'
                }...`}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                autoFocus
              />
              <button
                type="submit"
                disabled={!quickComment.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 shrink-0 active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Gửi</span>
              </button>
            </form>
          )}

          {isSaved && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle className="w-3.5 h-3.5" /> Đã lưu & đồng bộ trao đổi thành công!
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between pt-1">
            {onOpenFullDetail ? (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  setTimeout(() => {
                    onOpenFullDetail(activeTask);
                  }, 180);
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Xem toàn bộ chi tiết task
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
