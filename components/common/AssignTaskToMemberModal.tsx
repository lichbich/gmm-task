'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { Task, User, getUserRoleColorClass, getUserRoleInSpec } from '../../types/task';
import { useModalAnimation } from '../../hooks/useModalAnimation';
import { UserAvatar } from './UserAvatar';
import {
  X,
  UserCheck,
  Plus,
  CheckCircle2,
  Clock,
  Flag,
  Flame,
  Sparkles,
  Inbox,
  Check,
} from 'lucide-react';

import { FormattedTaskTitle } from './FormattedTaskTitle';

interface AssignTaskToMemberModalProps {
  isOpen: boolean;
  targetUser: User | null;
  roleCode: string;
  roleLabel: string;
  unassignedTasks: Task[];
  selectedWeek: number;
  selectedYear: number;
  onClose: () => void;
  onAssignTask: (task: Task, user: User) => void;
  onCreateNewTask: (user: User, roleCode: string) => void;
}

export const AssignTaskToMemberModal: React.FC<AssignTaskToMemberModalProps> = ({
  isOpen,
  targetUser,
  roleCode,
  roleLabel,
  unassignedTasks,
  selectedWeek,
  selectedYear,
  onClose,
  onAssignTask,
  onCreateNewTask,
}) => {
  const [mounted, setMounted] = React.useState(false);
  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } =
    useModalAnimation(isOpen, onClose);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!isRendered || !targetUser) return null;

  const displayWeekNumber = selectedWeek <= 53 ? selectedWeek + 55 : selectedWeek;

  const modalContent = (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={`fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[130] flex items-center justify-center p-3 sm:p-4 modal-backdrop-transition overflow-y-auto ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-xl shadow-2xl text-slate-800 dark:text-slate-100 max-h-[90vh] flex flex-col overflow-hidden relative modal-dialog-transition ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-4 sm:px-6 sm:py-4 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              user={targetUser}
              account={targetUser.account}
              size="md"
              shape="circle"
              className="ring-2 ring-indigo-500/30"
            />
            <div className="min-w-0">
              {(() => {
                const targetUserRoleInSpec = getUserRoleInSpec(targetUser, roleCode);
                return (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                        Phân công cho <span className={getUserRoleColorClass(targetUserRoleInSpec)}>{targetUser.name}</span>
                      </h3>
                      <span className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold border ${
                        targetUserRoleInSpec === 'Leader'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                          : targetUserRoleInSpec === 'Advisor'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                          : targetUserRoleInSpec === 'Admin'
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                      }`}>
                        @{targetUser.account} • {targetUserRoleInSpec}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Team {roleLabel || roleCode} • Tuần {displayWeekNumber} / {selectedYear}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition active:scale-95 shrink-0 cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4 min-h-0 bg-slate-50/50 dark:bg-slate-900">
          {/* Section 1: Choose from Unassigned Tasks */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Task đang trống của Team {roleCode} ({unassignedTasks.length}):
                </span>
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                Gán trực tiếp bằng 1 click
              </span>
            </div>

            {unassignedTasks.length > 0 ? (
              <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-0.5">
                {unassignedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-500 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                          <FormattedTaskTitle title={t.title} />
                        </span>
                        {t.priority === 'High' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold text-[9px] shrink-0">
                            <Flame className="w-2.5 h-2.5" /> Cao
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1 font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.2 rounded">
                          <Clock className="w-3 h-3" />
                          {t.estimatedEffort || 0}h
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="font-mono text-[10px] text-slate-400">
                          #{t.id.replace('tsk-', '')}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onAssignTask(t, targetUser);
                        handleClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1 shrink-0"
                      title={`Gán task này cho @${targetUser.account}`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Gán task</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-1">
                <Sparkles className="w-5 h-5 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  Team {roleLabel || roleCode} hiện không có task trống nào trong Tuần {displayWeekNumber}.
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Tất cả các task hiện tại đã có người nhận. Bạn có thể tạo thêm đầu việc mới bên dưới.
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            <span className="absolute bg-slate-50 dark:bg-slate-900 px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              HOẶC
            </span>
          </div>

          {/* Section 2: Create Brand New Task */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5 min-w-0">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Tạo một đầu việc mới hoàn toàn
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mở khung tạo task với thông tin @{targetUser.account} và Role {roleCode} được điền sẵn.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                handleClose();
                setTimeout(() => {
                  onCreateNewTask(targetUser, roleCode);
                }, 150);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs shrink-0 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tạo task mới</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3.5 sm:px-6 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-xl transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(modalContent, document.body) : modalContent;
};
