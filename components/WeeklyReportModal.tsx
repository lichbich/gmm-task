'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus } from '../types/task';
import { X, Clock, AlertTriangle, CheckCircle, Save, MessageSquare, Info } from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { getWeekDeadline, getWeekSundayNoon } from './WorkHistoryView';

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
  const { submitTaskReport, simulatedTime, canReportTask, users } = useApp();
  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } = useModalAnimation(isOpen, onClose);

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

  if (!isRendered || !task) return null;

  const isMyTaskToReport = canReportTask(task);
  const assigneeUser = users.find(
    (u) => u.account.toLowerCase() === (task.assigneeAccount || '').toLowerCase()
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMyTaskToReport) return;
    submitTaskReport(task.id, actualEffort, completionPercentage, status, notes);
    handleClose();
  };

  const sundayNoon = getWeekSundayNoon(task.weekNumber, task.year);
  const deadline = getWeekDeadline(task.weekNumber, task.year);
  const simDate = new Date(simulatedTime);
  const isBeforeSundayNoon = simDate.getTime() < sundayNoon.getTime();
  const isSundayReportOpen = simDate.getTime() >= sundayNoon.getTime() && simDate.getTime() <= deadline.getTime();
  const isLateSimulated = simDate.getTime() > deadline.getTime();

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={`fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 modal-backdrop-transition overflow-y-auto ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        className={`bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl text-slate-800 relative overflow-hidden modal-dialog-transition ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
          <div className="pr-2 min-w-0">
            <span className="text-[11px] uppercase font-bold tracking-wider text-indigo-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {isBeforeSundayNoon ? 'Cập Nhật Tiến Độ Task' : 'Báo Cáo Tiến Độ Tuần'}
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 leading-snug break-words">
              {task.title}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
            {/* Status Banners */}
            {status === 'Done' || completionPercentage === 100 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-emerald-800">CÔNG VIỆC HOÀN THÀNH (DONE 100%)</span>
                  Task hoàn thành 100% sẽ được hệ thống tự động ghi nhận là "Đã báo cáo" hoàn tất cho tuần này.
                </div>
              </div>
            ) : isBeforeSundayNoon ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-700">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-blue-800">CẬP NHẬT TIẾN ĐỘ TRONG TUẦN</span>
                  Bạn đang cập nhật tiến độ công việc. Cổng nộp báo cáo tuần chính thức sẽ mở từ <strong>12:00 trưa Chủ Nhật</strong> đến <strong>22:00 tối Chủ Nhật</strong>.
                </div>
              </div>
            ) : isSundayReportOpen ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-emerald-800">CỔNG BÁO CÁO ĐANG MỞ (12h - 22h Chủ Nhật)</span>
                  Báo cáo của bạn được cập nhật đúng hạn trước 22:00 Chủ Nhật.
                </div>
              </div>
            ) : isLateSimulated ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-red-800">CẢNH BÁO: Báo Cáo Muộn (Sau 22h CN)</span>
                  Bạn đang nộp báo cáo sau 22:00 Chủ Nhật. Hệ thống sẽ ghi nhận trạng thái nộp trễ và tính phạt cho tuần này.
                </div>
              </div>
            ) : null}

            {/* Task Info Summary */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Role phụ trách:</span>
                <span className="font-semibold text-slate-800">{task.role}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Ước tính (Est):</span>
                <span className="font-semibold text-slate-800">{task.estimatedEffort} giờ</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] mb-0.5">Người thực hiện:</span>
                <div className="font-semibold text-indigo-600 break-words">
                  {assigneeUser?.name || task.assigneeAccount || 'Chưa gán'}
                  {task.assigneeAccount && (
                    <span className="text-[10px] font-normal text-slate-500 block font-mono">
                      @{task.assigneeAccount}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] mb-0.5">Mốc tuần (Week):</span>
                <span className="font-semibold text-slate-800">Tuần {task.weekNumber <= 53 ? task.weekNumber + 55 : task.weekNumber} / {task.year}</span>
              </div>
            </div>

            {/* Status Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Trạng Thái Công Việc (Status):
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['To do', 'In Progress', 'Done'] as TaskStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={!isMyTaskToReport}
                    onClick={() => {
                      setStatus(st);
                      if (st === 'Done') setCompletionPercentage(100);
                    }}
                    className={`py-2 px-2 sm:px-3 rounded-xl border text-xs font-semibold transition cursor-pointer active:scale-95 ${
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
                <span className="text-xs font-bold text-indigo-600 font-mono">{actualEffort} giờ</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  disabled={!isMyTaskToReport}
                  value={actualEffort}
                  onChange={(e) => setActualEffort(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:bg-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-semibold"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {isBeforeSundayNoon
                  ? '💡 Đây là cập nhật tiến độ trong tuần. Vào Chủ Nhật (từ 12:00 trưa đến 22:00 tối), bạn hãy vào nộp báo cáo tuần chính thức (kể cả 0h) để được tính là "Đã báo cáo".'
                  : '💡 Kể cả số giờ làm là 0h (chưa làm trong tuần), bạn vẫn cần bấm "Nộp Báo Cáo Tuần" trước 22:00 Chủ Nhật để hệ thống ghi nhận đúng hạn và tránh bị phạt.'}
              </p>
            </div>

            {/* Completion Percentage Slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Phần Trăm Hoàn Thành (% Completed):
                </label>
                <span className="text-xs font-bold text-indigo-600 font-mono">{completionPercentage}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                disabled={!isMyTaskToReport}
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
                disabled={!isMyTaskToReport}
                placeholder="Nhập nội dung vướng mắc hoặc ghi chú cho Leader..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 resize-none"
              />
            </div>
          </div>

          {/* Sticky Action Footer */}
          <div className="flex items-center justify-end gap-2.5 p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/80 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!isMyTaskToReport}
              className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 active:scale-95 ${
                status === 'Done' || completionPercentage === 100
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : isBeforeSundayNoon
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                  : isLateSimulated
                  ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
              }`}
            >
              <Save className="w-4 h-4" />
              {status === 'Done' || completionPercentage === 100
                ? 'Lưu & Hoàn Thành Báo Cáo'
                : isBeforeSundayNoon
                ? 'Lưu Cập Nhật Tiến Độ'
                : isLateSimulated
                ? 'Nộp Báo Cáo Tuần (Muộn)'
                : 'Nộp Báo Cáo Tuần'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
