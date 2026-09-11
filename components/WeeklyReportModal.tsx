'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus } from '../types/task';
import { X, Clock, AlertTriangle, CheckCircle, Save, MessageSquare } from 'lucide-react';

interface WeeklyReportModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({
  task,
  isOpen,
  onClose,
}) => {
  const { submitTaskReport, simulatedTime, canEditTask } = useApp();

  const [actualEffort, setActualEffort] = useState<number>(0);
  const [completionPercentage, setCompletionPercentage] = useState<number>(0);
  const [status, setStatus] = useState<TaskStatus>('In Progress');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (task) {
      setActualEffort(task.actualEffort || 0);
      setCompletionPercentage(task.completionPercentage || 0);
      setStatus(task.status || 'In Progress');
      setNotes(task.notes || '');
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const isEditable = canEditTask(task);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) return;
    submitTaskReport(task.id, actualEffort, completionPercentage, status, notes);
    onClose();
  };

  const simDate = new Date(simulatedTime);
  const isLateSimulated = simDate.getDay() === 0 && simDate.getHours() >= 22;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-slate-800">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs uppercase font-semibold tracking-wider text-indigo-600">
              Báo Cáo Tiến Độ Tuần
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5 line-clamp-1">
              {task.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="py-5 space-y-5">
          {/* Deadline Warning Banner */}
          {isLateSimulated ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-red-800">CẢNH BÁO NỘP BÁO CÁO MUỘN (BÁO ĐỎ)!</span>
                Thời điểm hiện tại đã quá hạn 10h tối Chủ Nhật (22:00). Việc nộp/cập nhật này sẽ bị ghi nhận báo đỏ và tính phạt theo quy định.
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-start gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-emerald-800">Nộp Đúng Hạn (Trước 10h Tối CN)</span>
                Báo cáo của bạn được cập nhật trước 22:00 Chủ Nhật.
              </div>
            </div>
          )}

          {/* Task Info Summary */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Role phụ trách:</span>
              <span className="font-semibold text-slate-800">{task.role}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Ước tính (Estimated Effort):</span>
              <span className="font-semibold text-slate-800">{task.estimatedEffort} giờ</span>
            </div>
            <div>
              <span className="text-slate-500 block">Người thực hiện:</span>
              <span className="font-semibold text-indigo-600">{task.assigneeAccount}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Mốc tuần (Week):</span>
              <span className="font-semibold text-slate-800">Tuần {task.weekNumber} / {task.year}</span>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              Trạng Thái Công Việc (Status):
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['To do', 'In Progress', 'Done'] as TaskStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={!isEditable}
                  onClick={() => {
                    setStatus(st);
                    if (st === 'Done') setCompletionPercentage(100);
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                    status === st
                      ? st === 'Done'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                        : st === 'In Progress'
                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                        : 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Actual Effort (Hours Worked) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Số Giờ Làm Việc Thực Tế trong tuần (Actual Effort):
              </label>
              <span className="text-xs font-bold text-indigo-600">{actualEffort} giờ</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                disabled={!isEditable}
                value={actualEffort}
                onChange={(e) => setActualEffort(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:bg-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              💡 Người có số giờ làm việc thực tế cao nhất tuần sẽ được thưởng Báo Xanh (Green Award).
            </p>
          </div>

          {/* Completion Percentage Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Phần Trăm Hoàn Thành (% Completed):
              </label>
              <span className="text-xs font-bold text-indigo-600">{completionPercentage}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              disabled={!isEditable}
              value={completionPercentage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setCompletionPercentage(val);
                if (val === 100) setStatus('Done');
                else if (val > 0 && status === 'To do') setStatus('In Progress');
              }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
            />
          </div>

          {/* Leader Notes Input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
              Ghi Chú Gửi Leader (Vướng mắc, Trao đổi):
            </label>
            <textarea
              rows={3}
              disabled={!isEditable}
              placeholder="Nhập nội dung vướng mắc hoặc ghi chú cho Leader..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!isEditable}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Nộp Báo Cáo Tuần
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
