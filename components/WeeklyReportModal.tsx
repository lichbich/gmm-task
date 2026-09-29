'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus, getUserRoleColorClass } from '../types/task';
import { X, Clock, AlertTriangle, CheckCircle, Save, MessageSquare, Info } from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { getWeekDeadline, getWeekSundayNoon } from './WorkHistoryView';
import { UserAvatar } from './common/UserAvatar';

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
  const { submitTaskReport, simulatedTime, canReportTask, users, confirmDialog } = useApp();
  const [actualEffort, setActualEffort] = useState<number | string>(0);
  const [completionPercentage, setCompletionPercentage] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const checkDirtyAndConfirmClose = useCallback((): boolean => {
    if (!task) return true;
    const origEffort = task.actualEffort !== undefined ? task.actualEffort : 0;
    const origCompletion = task.completionPercentage || 0;
    const origNotes = task.notes || '';

    const parsedEffort =
      typeof actualEffort === 'number'
        ? actualEffort
        : parseFloat(String(actualEffort).replace(',', '.')) || 0;

    const isDirty =
      parsedEffort !== origEffort ||
      completionPercentage !== origCompletion ||
      notes !== origNotes;

    if (isDirty) {
      confirmDialog({
        title: 'Báo cáo đang điền dở dang',
        message: 'Bạn đang điền dở thông tin tiến độ / giờ làm việc. Bạn có chắc chắn muốn hủy và thoát không? Các thay đổi vừa nhập sẽ không được lưu.',
        confirmText: 'Rời khỏi & Không lưu',
        cancelText: 'Tiếp tục báo cáo',
        type: 'warning',
        onConfirm: () => {
          forceClose();
        },
      });
      return false;
    }
    return true;
  }, [task, actualEffort, completionPercentage, notes, confirmDialog]);

  const { isRendered, isVisible, handleClose, forceClose, handleBackdropMouseDown, handleBackdropClick } =
    useModalAnimation(isOpen, onClose, checkDirtyAndConfirmClose);

  useEffect(() => {
    if (!isOpen || !task) return;
    setActualEffort(task.actualEffort !== undefined ? task.actualEffort : 0);
    setCompletionPercentage(task.completionPercentage || 0);
    setNotes(task.notes || '');
  }, [isOpen, task?.id]);

  if (!isRendered || !task) return null;

  const isMyTaskToReport = canReportTask(task);
  const assigneeUser = users.find(
    (u) => u.account.toLowerCase() === (task.assigneeAccount || '').toLowerCase()
  );

  const sundayNoon = getWeekSundayNoon(task.weekNumber, task.year);
  const deadline = getWeekDeadline(task.weekNumber, task.year);
  const simDate = new Date(simulatedTime);
  const isBeforeSundayNoon = simDate.getTime() < sundayNoon.getTime();
  const isSundayReportOpen = simDate.getTime() >= sundayNoon.getTime() && simDate.getTime() <= deadline.getTime();
  const isLateSimulated = simDate.getTime() > deadline.getTime();
  const isSundayOrLate = isSundayReportOpen || isLateSimulated;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMyTaskToReport) return;
    let parsedEffort =
      typeof actualEffort === 'number'
        ? actualEffort
        : parseFloat(String(actualEffort).replace(',', '.')) || 0;

    // If progress > 0% but actual effort is not filled or is 0, default to estimated effort
    if (completionPercentage > 0 && parsedEffort === 0) {
      parsedEffort = task.estimatedEffort || 0;
    }

    if (parsedEffort > 0 && completionPercentage === 0) {
      confirmDialog({
        title: 'Nhắc nhở cập nhật % tiến độ',
        message: `Bạn đang nhập ${parsedEffort}h làm việc nhưng phần trăm tiến độ vẫn để 0%.\n\n• Theo quy định, nếu tiến độ 0% (coi như chưa làm) thì số giờ làm việc thực tế sẽ tự động chuyển về 0h và trạng thái là "To do" (không thể đánh Done).\n• Bạn có muốn quay lại điều chỉnh % tiến độ không? Hoặc bấm "Vẫn lưu 0%" để lưu task chưa làm (số giờ sẽ tự động về 0h).`,
        confirmText: 'Vẫn lưu 0% (Giờ = 0h)',
        cancelText: 'Cập nhật lại tiến độ',
        type: 'warning',
        onConfirm: () => {
          submitTaskReport(task.id, 0, 0, 'To do', notes);
          forceClose();
        },
      });
      return;
    }

    const finalEffort = completionPercentage === 0 ? 0 : parsedEffort;
    const finalStatus: TaskStatus =
      completionPercentage === 0
        ? 'To do'
        : completionPercentage === 100
        ? 'Done'
        : isSundayOrLate
        ? 'Done'
        : 'In Progress';

    submitTaskReport(task.id, finalEffort, completionPercentage, finalStatus, notes);
    forceClose();
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
            {completionPercentage === 100 ? (
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
                  Bạn đang cập nhật tiến độ công việc (Trạng thái: <strong>{completionPercentage === 0 ? 'To do' : 'In Progress'}</strong>). Cổng nộp báo cáo tuần chính thức sẽ mở từ <strong>12:00 trưa Chủ Nhật</strong> đến <strong>22:00 tối Chủ Nhật</strong>.
                </div>
              </div>
            ) : isSundayReportOpen ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-emerald-800">CỔNG BÁO CÁO ĐANG MỞ (12h - 22h Chủ Nhật)</span>
                  Bấm &ldquo;Nộp Báo Cáo Tuần&rdquo; để xác nhận hoàn thành báo cáo tuần này. {completionPercentage > 0 && completionPercentage < 100 ? 'Task làm dở sẽ bảo toàn % tiến độ và số giờ đã làm để lưu lịch sử và tự động chuyển tiếp sang tuần tới.' : ''}
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
                <span className="text-slate-500 block text-[11px] mb-1">Người thực hiện:</span>
                <div className="flex items-center gap-2">
                  <UserAvatar
                    user={assigneeUser}
                    account={task.assigneeAccount}
                    name={assigneeUser?.name}
                    size="xs"
                    shape="circle"
                  />
                  <div className={`font-semibold break-words text-xs ${getUserRoleColorClass(assigneeUser?.role)}`}>
                    {assigneeUser?.name || task.assigneeAccount || 'Chưa gán'}
                    {task.assigneeAccount && (
                      <span className={`text-[10px] font-mono block ${getUserRoleColorClass(assigneeUser?.role)}`}>
                        @{task.assigneeAccount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] mb-0.5">Mốc tuần (Week):</span>
                <span className="font-semibold text-slate-800">Tuần {task.weekNumber <= 53 ? task.weekNumber + 55 : task.weekNumber} / {task.year}</span>
              </div>
            </div>

            {/* Actual Effort (Hours Worked) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Số Giờ Làm Việc Thực Tế trong tuần (Actual Effort):
                </label>
                <span className="text-xs font-bold text-indigo-600 font-mono">
                  {typeof actualEffort === 'number'
                    ? actualEffort
                    : parseFloat(String(actualEffort).replace(',', '.')) || 0}{' '}
                  giờ
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  disabled={!isMyTaskToReport}
                  value={actualEffort}
                  onChange={(e) => setActualEffort(e.target.value)}
                  placeholder="0.0"
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
                  if (val === 0) {
                    setActualEffort(0);
                  } else {
                    setActualEffort((prev) => {
                      const p = typeof prev === 'number' ? prev : parseFloat(String(prev).replace(',', '.')) || 0;
                      return p > 0 ? prev : (task.estimatedEffort || 0);
                    });
                  }
                }}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
              />

              {/* Warning if effort > 0 but completion percentage is 0 */}
              {(typeof actualEffort === 'number' ? actualEffort : parseFloat(String(actualEffort).replace(',', '.')) || 0) > 0 && completionPercentage === 0 && (
                <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-amber-900">Lưu ý: Tiến độ đang để 0%</span>
                    Bạn đã nhập <strong>{typeof actualEffort === 'number' ? actualEffort : parseFloat(String(actualEffort).replace(',', '.')) || 0}h</strong> làm việc nhưng % tiến độ vẫn là <strong>0%</strong>. Hãy kéo thanh tiến độ lên nếu bạn đã làm. Nếu giữ 0% (chưa làm), hệ thống sẽ tự động đặt số giờ về <strong>0h</strong>.
                  </div>
                </div>
              )}
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
                completionPercentage === 100
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : isBeforeSundayNoon
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                  : isLateSimulated
                  ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
              }`}
            >
              <Save className="w-4 h-4" />
              {completionPercentage === 100
                ? 'Lưu & Hoàn Thành Task (Done)'
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
