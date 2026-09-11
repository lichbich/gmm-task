'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Task } from '../types/task';
import { X, MessageSquare, Clock, AlertTriangle, Award, Save, Lock, CheckCircle, UserCheck } from 'lucide-react';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReport?: (task: Task) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onOpenReport,
}) => {
  const { milestones, updateTaskNotes, canEditTask, weeklyAwards } = useApp();
  const [notesText, setNotesText] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (task) {
      setNotesText(task.notes || '');
      setIsSaved(false);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const milestone = milestones.find((m) => m.id === task.milestoneId);
  const isEditable = canEditTask(task);

  const award = weeklyAwards.find((w) => w.account === task.assigneeAccount);
  const isTopEffort = award?.isTopEffort || false;
  const isLate = task.isSubmittedLate;

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) return;
    updateTaskNotes(task.id, notesText);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl text-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                {task.role}
              </span>
              <span className="text-xs text-slate-400">STT #{task.id.replace('tsk-', '')}</span>
              {isLate && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-300 text-[10px] font-bold rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> BÁO ĐỎ (Nộp muộn)
                </span>
              )}
              {isTopEffort && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-bold rounded-full flex items-center gap-1">
                  <Award className="w-3 h-3" /> BÁO XANH (Top Effort)
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">{task.title}</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task Grid Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Phụ trách:</span>
            <span className="font-semibold text-indigo-600 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              {task.assigneeAccount || 'Chưa gán'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Milestone:</span>
            <span className="font-semibold text-slate-700 truncate block">
              {milestone ? milestone.title : 'Chưa gán'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Effort Thực tế / Ước tính:</span>
            <span className="font-mono font-bold text-emerald-600">
              {task.actualEffort}h / {task.estimatedEffort}h
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Trạng thái:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-full inline-block text-[10px] ${
                task.status === 'Done'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                  : task.status === 'In Progress'
                  ? 'bg-blue-50 text-blue-700 border border-blue-300'
                  : 'bg-slate-100 text-slate-600 border border-slate-300'
              }`}
            >
              {task.status} ({task.completionPercentage}%)
            </span>
          </div>
        </div>

        {/* Completion Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Tiến độ hoàn thành:</span>
            <span className="font-bold text-indigo-600">{task.completionPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-300 ${
                task.completionPercentage === 100
                  ? 'bg-emerald-500'
                  : task.completionPercentage > 0
                  ? 'bg-indigo-500'
                  : 'bg-slate-300'
              }`}
              style={{ width: `${task.completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Section: Notes for Leader */}
        <form onSubmit={handleSaveNotes} className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              Ghi Chú Gửi Leader (Blockers, Trao đổi, Cập nhật):
            </label>
            {!isEditable && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Chỉ người phụ trách mới được ghi chú
              </span>
            )}
          </div>

          <textarea
            rows={4}
            disabled={!isEditable}
            placeholder={
              isEditable
                ? 'Nhập nội dung vướng mắc, cập nhật hoặc ghi chú gửi cho Leader...'
                : 'Bạn không có quyền chỉnh sửa ghi chú task này.'
            }
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 resize-none"
          />

          {isEditable && (
            <div className="flex items-center justify-between">
              {isSaved ? (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Đã lưu ghi chú gửi Leader thành công!
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">Ghi chú sẽ được lưu trực tiếp vào task</span>
              )}

              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Lưu Ghi Chú
              </button>
            </div>
          )}
        </form>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-xl transition"
          >
            Đóng
          </button>

          {isEditable && onOpenReport && (
            <button
              onClick={() => {
                onClose();
                onOpenReport(task);
              }}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              Nộp Báo Cáo Tiến Độ
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
