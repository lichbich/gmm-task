'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus, getUserRoleColorClass, getTodayDateOnlyString, formatDateOnlyDisplay, getMemberTaskEffort } from '../types/task';
import { X, Clock, AlertTriangle, CheckCircle, Save, MessageSquare, Info, Calendar, Users } from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { getWeekDeadline, getWeekSundayNoon } from './WorkHistoryView';
import { UserAvatar } from './common/UserAvatar';
import { DatePicker } from './common/DatePicker';
import { FormattedTaskTitle } from './common/FormattedTaskTitle';
import { calculateTaskAccumulatedEffort } from '../lib/taskEffortHelper';

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
  const { submitTaskReport, simulatedTime, canReportTask, users, confirmDialog, tasks, weeklyArchives, authSession } = useApp();
  const [actualEffort, setActualEffort] = useState<number | string>(0);
  const [completionPercentage, setCompletionPercentage] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const reportingAccount = useMemo(() => {
    if (!authSession || !task) return task?.assigneeAccount || '';
    const userAcc = authSession.account.toLowerCase();
    if (task.assigneeAccount && task.assigneeAccount.toLowerCase() === userAcc) {
      return task.assigneeAccount;
    }
    if (task.supporterAccounts?.some((s) => s.toLowerCase() === userAcc)) {
      return authSession.account;
    }
    return task.assigneeAccount || authSession.account;
  }, [authSession, task]);

  const accumulatedEffort = useMemo(() => {
    return calculateTaskAccumulatedEffort(task, tasks, weeklyArchives);
  }, [task, tasks, weeklyArchives]);

  const priorWeeksEffort = useMemo(() => {
    if (!accumulatedEffort.hasMultiWeekHistory || !task) return 0;
    return accumulatedEffort.weeklyBreakdown
      .filter((item) => item.weekNumber !== task.weekNumber)
      .reduce((sum, item) => sum + item.effort, 0);
  }, [accumulatedEffort, task]);

  // Track initial state when modal opened to compare and restore accurately
  const initialFormStateRef = React.useRef<{
    percentage: number;
    effort: number | string;
    startDate: string;
    endDate: string;
    notes: string;
  }>({
    percentage: 0,
    effort: 0,
    startDate: '',
    endDate: '',
    notes: '',
  });

  // Track state before user transitioned to Done/100% via End Date
  const prevBeforeDoneRef = React.useRef<{
    percentage: number;
    effort: number | string;
    startDate: string;
    endDate: string;
  } | null>(null);

  const checkDirtyAndConfirmClose = useCallback((): boolean => {
    if (!task) return true;
    const origEffort = getMemberTaskEffort(task, reportingAccount);
    const origCompletion = task.completionPercentage || 0;
    const origNotes = task.notes || '';
    const origStartDate = task.startDate || '';
    const origEndDate = task.endDate || '';

    const parsedEffort =
      typeof actualEffort === 'number'
        ? actualEffort
        : parseFloat(String(actualEffort).replace(',', '.')) || 0;

    const isDirty =
      parsedEffort !== origEffort ||
      completionPercentage !== origCompletion ||
      notes.trim() !== origNotes.trim() ||
      startDate !== origStartDate ||
      endDate !== origEndDate;

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
  }, [task, actualEffort, completionPercentage, notes, startDate, endDate, confirmDialog, reportingAccount]);

  const { isRendered, isVisible, handleClose, forceClose, handleBackdropMouseDown, handleBackdropClick } =
    useModalAnimation(isOpen, onClose, checkDirtyAndConfirmClose);

  useEffect(() => {
    if (!isOpen || !task) return;
    const initialPct = task.completionPercentage || 0;
    const initialEffort = getMemberTaskEffort(task, reportingAccount);
    const initialStartDate = task.startDate || '';
    const initialEndDate = task.endDate || '';
    const initialNotes = task.notes || '';

    setActualEffort(initialEffort);
    setCompletionPercentage(initialPct);
    setNotes(initialNotes);
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);

    initialFormStateRef.current = {
      percentage: initialPct,
      effort: initialEffort,
      startDate: initialStartDate,
      endDate: initialEndDate,
      notes: initialNotes,
    };

    prevBeforeDoneRef.current = {
      percentage: initialPct,
      effort: initialEffort,
      startDate: initialStartDate,
      endDate: initialEndDate,
    };
  }, [isOpen, task?.id, reportingAccount]);

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
  const todayStr = getTodayDateOnlyString(simulatedTime);

  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate);
    if (newStartDate && endDate && endDate < newStartDate) {
      setEndDate(newStartDate);
    }
  };

  const handleEndDateChange = (newEndDate: string) => {
    setEndDate(newEndDate);
    if (newEndDate) {
      if (newEndDate <= todayStr) {
        // Ngày kết thúc là HÔM NAY hoặc TRONG QUÁ KHỨ -> Task ĐÃ hoàn thành thực tế (Done 100%)
        if (!prevBeforeDoneRef.current || completionPercentage < 100) {
          prevBeforeDoneRef.current = {
            percentage: completionPercentage,
            effort: actualEffort,
            startDate: startDate,
            endDate: endDate,
          };
        }

        // 1. Tự động kéo thanh tiến trình lên 100%
        setCompletionPercentage(100);

        // 2. Số giờ làm việc tự động được lấy theo Est nếu hiện tại là 0
        setActualEffort((prev) => {
          const p = typeof prev === 'number' ? prev : parseFloat(String(prev).replace(',', '.')) || 0;
          return p > 0 ? prev : (task.estimatedEffort || 0);
        });

        // 3. Tự động điền start date nếu chưa có
        setStartDate((prev) => {
          if (prev) {
            if (prev > newEndDate) return newEndDate;
            return prev;
          }
          return newEndDate;
        });
      } else {
        // Ngày kết thúc là TRONG TƯƠNG LAI (sau hôm nay, VD: 04/10 khi hôm nay là 03/10)
        // -> Đây là hạn chót / kế hoạch dự kiến, hôm nay CHƯA THỂ Done được!
        if (completionPercentage === 100) {
          if (prevBeforeDoneRef.current && prevBeforeDoneRef.current.percentage < 100 && prevBeforeDoneRef.current.percentage > 0) {
            setCompletionPercentage(prevBeforeDoneRef.current.percentage);
            setActualEffort(prevBeforeDoneRef.current.effort);
            setStartDate(prevBeforeDoneRef.current.startDate || todayStr);
          } else {
            setCompletionPercentage(50);
          }
        }
      }
    } else {
      // Khi XOÁ end date: khôi phục lại trạng thái trước đó của task
      if (prevBeforeDoneRef.current) {
        const prevPct = prevBeforeDoneRef.current.percentage;
        if (prevPct < 100) {
          setCompletionPercentage(prevPct);
          setActualEffort(prevBeforeDoneRef.current.effort);
          if (prevPct === 0) {
            setStartDate(initialFormStateRef.current.startDate);
          }
        } else {
          setCompletionPercentage(50);
        }
      } else {
        setCompletionPercentage(50);
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMyTaskToReport) return;
    let parsedEffort =
      typeof actualEffort === 'number'
        ? actualEffort
        : parseFloat(String(actualEffort).replace(',', '.')) || 0;

    // Only default to estimated effort if task is Done (100%) and actual effort was left empty (0)
    if (completionPercentage === 100 && parsedEffort === 0) {
      parsedEffort = task.estimatedEffort || 0;
    }

    if (parsedEffort > 24) {
      alert('Số giờ thực tế (Effort) không được vượt quá 24h!');
      return;
    }

    if (parsedEffort > 0 && completionPercentage === 0) {
      confirmDialog({
        title: 'Nhắc nhở cập nhật % tiến độ',
        message: `Bạn đang nhập ${parsedEffort}h làm việc nhưng phần trăm tiến độ vẫn để 0%.\n\n• Theo quy định, nếu tiến độ 0% (coi như chưa làm) thì số giờ làm việc thực tế sẽ tự động chuyển về 0h và trạng thái là "To do" (không thể đánh Done).\n• Bạn có muốn quay lại điều chỉnh % tiến độ không? Hoặc bấm "Vẫn lưu 0%" để lưu task chưa làm (số giờ sẽ tự động về 0h).`,
        confirmText: 'Vẫn lưu 0% (Giờ = 0h)',
        cancelText: 'Cập nhật lại tiến độ',
        type: 'warning',
        onConfirm: () => {
          submitTaskReport(task.id, 0, 0, 'To do', notes, {
            startDate: undefined,
            endDate: undefined,
          }, reportingAccount);
          forceClose();
        },
      });
      return;
    }

    // If progress is In Progress (> 0% and < 100%) but actual effort is 0, prompt user to enter effort
    if (completionPercentage > 0 && completionPercentage < 100 && parsedEffort === 0) {
      confirmDialog({
        title: 'Chưa nhập số giờ thực tế trong tuần',
        message: `Bạn đang cập nhật tiến độ ${completionPercentage}% (In Progress) nhưng số giờ làm việc thực tế đang để 0h.\n\n• Hãy nhập số giờ thực tế bạn đã làm việc trong tuần này cho task để tính công và ghi nhận báo cáo chuẩn xác.\n• Bấm "Quay lại điền giờ" để nhập số giờ thực tế, hoặc "Vẫn lưu 0h" nếu tuần này chưa làm thêm giờ nào.`,
        confirmText: 'Vẫn lưu 0h',
        cancelText: 'Quay lại điền giờ',
        type: 'warning',
        onConfirm: () => {
          const finalStatus: TaskStatus = isSundayOrLate ? 'Done' : 'In Progress';
          submitTaskReport(task.id, 0, completionPercentage, finalStatus, notes, {
            startDate: startDate.trim() || undefined,
            endDate: endDate.trim() || undefined,
          }, reportingAccount);
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

    submitTaskReport(task.id, finalEffort, completionPercentage, finalStatus, notes, {
      startDate: startDate.trim() || undefined,
      endDate: endDate.trim() || undefined,
    }, reportingAccount);
    forceClose();
  };

  const isCollabTask = Boolean(task.supporterAccounts && task.supporterAccounts.length > 0);

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
              <FormattedTaskTitle title={task.title} />
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
            <div className="space-y-2 bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 text-xs">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <span className="text-slate-500 block text-[11px]">Role phụ trách:</span>
                  <span className="font-semibold text-slate-800">{task.role}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Ước tính (Est):</span>
                  <span className="font-semibold text-slate-800">{task.estimatedEffort} giờ</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] mb-1">Người thực hiện chính:</span>
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
                          @{task.assigneeAccount} {isCollabTask && `(${getMemberTaskEffort(task, task.assigneeAccount)}h)`}
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

              {/* Collab row if any */}
              {isCollabTask && (
                <div className="pt-2 border-t border-slate-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500 block text-[11px] font-medium">Thành viên Collab (Hợp tác):</span>
                    <span className="text-[10px] text-indigo-600 font-semibold font-mono">
                      Tổng task: {task.actualEffort || 0}h
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {task.supporterAccounts?.map((supAcc) => {
                      const supUser = users.find((u) => u.account.toLowerCase() === supAcc.toLowerCase());
                      const supEffort = getMemberTaskEffort(task, supAcc);
                      const isReportingSup = reportingAccount.toLowerCase() === supAcc.toLowerCase();
                      return (
                        <span
                          key={supAcc}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${
                            isReportingSup
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold ring-1 ring-indigo-200'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <UserAvatar
                            user={supUser}
                            account={supAcc}
                            name={supUser?.name}
                            size="xs"
                            shape="circle"
                          />
                          <span>{supUser?.name || supAcc}</span>
                          <span className="font-mono text-[11px] font-bold text-indigo-600">
                            {supEffort}h
                          </span>
                          <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700">
                            Collab
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actual Effort (Hours Worked) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  {isCollabTask ? (
                    <span>
                      Số Giờ Của Bạn <b className="text-indigo-600">(@{reportingAccount})</b>:
                    </span>
                  ) : (
                    'Số Giờ Làm Việc Thực Tế trong tuần (Actual Effort):'
                  )}
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
                  max="24"
                  disabled={!isMyTaskToReport}
                  value={actualEffort}
                  onChange={(e) => setActualEffort(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-sm focus:bg-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-semibold"
                />
              </div>
              {isCollabTask && (
                <div className="mt-1.5 px-2.5 py-1.5 bg-indigo-50/70 border border-indigo-200/70 rounded-lg text-[11px] text-indigo-800 flex items-center justify-between">
                  <span>💡 Đây là task Collab. Bạn đang nhập số giờ của riêng bạn (@{reportingAccount}).</span>
                </div>
              )}
              {accumulatedEffort.hasMultiWeekHistory && priorWeeksEffort > 0 && (
                <div className="mt-2 p-2.5 bg-indigo-50/80 border border-indigo-200/90 rounded-xl text-xs text-indigo-900 flex flex-wrap items-center justify-between gap-1.5 shadow-2xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Các tuần trước đã tích lũy: <b className="font-mono text-indigo-700">{priorWeeksEffort}h</b></span>
                  </span>
                  <span className="font-mono font-bold text-xs text-indigo-700 bg-white px-2 py-0.5 rounded-lg border border-indigo-200">
                    Dự kiến tổng: {priorWeeksEffort + (Number(actualEffort) || 0)}h
                  </span>
                </div>
              )}
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
                  const todayStr = getTodayDateOnlyString(simulatedTime);

                  if (val === 0) {
                    // Reset to 0% (To do)
                    setActualEffort(
                      initialFormStateRef.current.percentage === 0
                        ? initialFormStateRef.current.effort
                        : 0
                    );
                    // Restore exact original dates when returning to 0%
                    setStartDate(
                      initialFormStateRef.current.percentage === 0
                        ? initialFormStateRef.current.startDate
                        : ''
                    );
                    setEndDate(initialFormStateRef.current.endDate);
                    prevBeforeDoneRef.current = {
                      percentage: 0,
                      effort: 0,
                      startDate: initialFormStateRef.current.startDate,
                      endDate: initialFormStateRef.current.endDate,
                    };
                  } else if (val === 100) {
                    if (completionPercentage < 100) {
                      prevBeforeDoneRef.current = {
                        percentage: completionPercentage,
                        effort: actualEffort,
                        startDate: startDate,
                        endDate: endDate,
                      };
                    }
                    setActualEffort((prev) => {
                      const p = typeof prev === 'number' ? prev : parseFloat(String(prev).replace(',', '.')) || 0;
                      return p > 0 ? prev : (task.estimatedEffort || 0);
                    });
                    // Auto-fill Start Date if not already set, and set End Date to today if not set or was in future
                    setStartDate((prev) => prev || todayStr);
                    setEndDate((prev) => (!prev || prev > todayStr ? todayStr : prev));
                  } else {
                    // 0 < val < 100 (In Progress)
                    if (completionPercentage === 100) {
                      // If user was at 100% (Done) and drags slider back to In Progress, restore previous effort and dates before Done
                      if (prevBeforeDoneRef.current && prevBeforeDoneRef.current.percentage < 100) {
                        setActualEffort(prevBeforeDoneRef.current.effort);
                        if (prevBeforeDoneRef.current.startDate) {
                          setStartDate(prevBeforeDoneRef.current.startDate);
                        }
                      }
                      // Restore planned endDate if it was overwritten to todayStr when dragging to 100%
                      if (initialFormStateRef.current.endDate && initialFormStateRef.current.endDate > todayStr) {
                        setEndDate(initialFormStateRef.current.endDate);
                      } else if (endDate === todayStr) {
                        setEndDate(initialFormStateRef.current.endDate || '');
                      }
                    } else if (completionPercentage === 0) {
                      // Moving from 0% -> In Progress: auto-fill start date to today if empty, keep planned end date
                      setStartDate((prev) => prev || todayStr);
                    }
                    prevBeforeDoneRef.current = {
                      percentage: val,
                      effort: actualEffort,
                      startDate: startDate || todayStr,
                      endDate: endDate,
                    };
                  }
                }}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
              />

              {/* Reminder when In Progress but effort is 0 */}
              {(typeof actualEffort === 'number' ? actualEffort : parseFloat(String(actualEffort).replace(',', '.')) || 0) === 0 && completionPercentage > 0 && completionPercentage < 100 && (
                <div className="mt-2.5 p-3 bg-indigo-50/80 border border-indigo-200/80 rounded-xl flex items-start gap-2.5 text-xs text-indigo-900 animate-in fade-in duration-200">
                  <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-indigo-950">Vui lòng nhập số giờ thực tế:</span>
                    Task đang ở trạng thái <strong>In Progress ({completionPercentage}%)</strong>. Vui lòng nhập số giờ bạn đã làm trong tuần này vào ô <strong>Số Giờ Làm Việc Thực Tế</strong> ở trên.
                  </div>
                </div>
              )}

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

            {/* Start Date & End Date (Custom DatePicker matching Dropdown) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Ngày bắt đầu (Start Date):</span>
                </label>
                <DatePicker
                  value={startDate}
                  onChange={handleStartDateChange}
                  disabled={!isMyTaskToReport}
                  placeholder="Chọn ngày bắt đầu..."
                  maxDate={(endDate && endDate < todayStr) ? endDate : todayStr}
                  icon={<Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Ngày hoàn thành (End Date):</span>
                </label>
                <DatePicker
                  value={endDate}
                  onChange={handleEndDateChange}
                  disabled={!isMyTaskToReport}
                  placeholder="Chọn ngày hoàn thành..."
                  minDate={startDate || undefined}
                  icon={<Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                />
              </div>
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
