'use client';

import React, { useState, useMemo } from 'react';
import { Task, getUserRoleColorClass, getUserRoleInSpec, isSpecializationMatchingRole } from '../../types/task';
import { useApp } from '../../context/AppContext';
import { Modal } from './Modal';
import { Search, Link2, Check, Filter, Layers, User as UserIcon } from 'lucide-react';
import { FormattedTaskTitle } from './FormattedTaskTitle';
import { UserAvatar } from './UserAvatar';

interface LinkExistingTasksModalProps {
  parentTask: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LinkExistingTasksModal: React.FC<LinkExistingTasksModalProps> = ({
  parentTask,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { tasks, updateTask, users } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [onlySameRole, setOnlySameRole] = useState(true);
  const [onlySameWeek, setOnlySameWeek] = useState(true);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter candidate tasks that can be merged as subtasks
  const candidateTasks = useMemo(() => {
    if (!parentTask) return [];

    return tasks.filter((t) => {
      // Cannot link to itself
      if (t.id === parentTask.id) return false;

      // Cannot link if already a subtask of this parent
      if (t.subtaskParentId === parentTask.id) return false;

      // Cannot link if the task itself already has subtasks (avoid nesting parent inside parent)
      const hasChildren = tasks.some((child) => child.subtaskParentId === t.id);
      if (hasChildren) return false;

      // Filter by same role if enabled (suggest tasks belonging to parent's role)
      if (onlySameRole && parentTask.role) {
        if (!isSpecializationMatchingRole(t.role, parentTask.role)) return false;
      }

      // Filter by same week if enabled
      if (onlySameWeek && parentTask.weekNumber) {
        if (t.weekNumber !== parentTask.weekNumber) return false;
      }

      // Search keyword
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const titleMatch = (t.title || '').toLowerCase().includes(query);
        const roleMatch = (t.role || '').toLowerCase().includes(query);
        const accMatch = (t.assigneeAccount || '').toLowerCase().includes(query);
        if (!titleMatch && !roleMatch && !accMatch) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Prioritize newly created tasks first
      const getCreatedTime = (item: Task) => {
        if (item.createdAt) {
          const t = new Date(item.createdAt).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        if (item.id && item.id.startsWith('tsk-')) {
          const m = item.id.match(/^tsk-(\d+)/);
          if (m) {
            const t = parseInt(m[1], 10);
            if (!isNaN(t) && t > 0) return t;
          }
        }
        if (item.updatedAt) {
          const t = new Date(item.updatedAt).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        return tasks.indexOf(item);
      };

      const aTime = getCreatedTime(a);
      const bTime = getCreatedTime(b);
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [tasks, parentTask, onlySameRole, onlySameWeek, searchTerm]);

  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.size === candidateTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(candidateTasks.map((t) => t.id)));
    }
  };

  const handleConfirmLink = async () => {
    if (!parentTask || selectedTaskIds.size === 0) return;

    setIsSubmitting(true);
    try {
      // 1. Update all selected tasks to become subtasks of parentTask
      for (const taskId of Array.from(selectedTaskIds)) {
        updateTask(
          taskId,
          {
            isSubtask: true,
            subtaskParentId: parentTask.id,
            subtaskParentTitle: parentTask.title,
            subtaskReviewerAccount: parentTask.assigneeAccount || '',
          },
          { skipLog: false }
        );
      }

      // 2. Mark parentTask as a parent task
      updateTask(
        parentTask.id,
        {
          isParentTask: true,
        },
        { skipLog: true }
      );

      setSelectedTaskIds(new Set());
      setSearchTerm('');
      onSuccess?.();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!parentTask) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>Gộp Task có sẵn vào làm Subtask</span>
        </div>
      }
      description={
        <span>
          Chọn các đầu việc độc lập để gộp vào cây công việc của: <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{parentTask.title}</strong>
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Đã chọn: <strong className="text-indigo-600 font-mono text-sm">{selectedTaskIds.size}</strong> task
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmLink}
              disabled={selectedTaskIds.size === 0 || isSubmitting}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Gộp vào Task cha ({selectedTaskIds.size})</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 pt-1">
        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm task theo tên, mã, người phụ trách..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {parentTask?.role && (
            <button
              type="button"
              onClick={() => setOnlySameRole(!onlySameRole)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 shrink-0 ${
                onlySameRole
                  ? 'bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title="Chỉ hiển thị các task thuộc cùng role/chuyên môn với task cha"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{onlySameRole ? `Chỉ team ${parentTask.role}` : 'Tất cả role'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setOnlySameWeek(!onlySameWeek)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 shrink-0 ${
              onlySameWeek
                ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Lọc task cùng tuần hoặc tất cả các tuần"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{onlySameWeek ? `Cùng Tuần ${parentTask.weekNumber || ''}` : 'Tất cả tuần'}</span>
          </button>
        </div>

        {/* Action helper bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>Tìm thấy {candidateTasks.length} task khả dụng</span>
          {candidateTasks.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              {selectedTaskIds.size === candidateTasks.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          )}
        </div>

        {/* Task Selection List */}
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-2xl p-1 bg-slate-50/50 dark:bg-slate-900/50">
          {candidateTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Không tìm thấy task độc lập nào phù hợp với điều kiện tìm kiếm.
            </div>
          ) : (
            candidateTasks.map((t) => {
              const isSelected = selectedTaskIds.has(t.id);
              const assigneeUser = users.find(
                (u) => u.account.toLowerCase() === (t.assigneeAccount || '').toLowerCase()
              );
              return (
                <div
                  key={t.id}
                  onClick={() => toggleSelectTask(t.id)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 text-xs select-none ${
                    isSelected
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700 shadow-2xs'
                      : 'bg-white dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectTask(t.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        <FormattedTaskTitle title={t.title} />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                        <span className="font-bold text-slate-600 dark:text-slate-300">{t.role}</span>
                        <span>•</span>
                        <span>Tuần: <strong className="font-mono">{t.weekNumber || 'Backlog'}</strong></span>
                        <span>•</span>
                        <span>Effort: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{t.estimatedEffort}h</strong></span>
                        {t.isSubtask && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 font-medium">Đang thuộc task khác (sẽ chuyển sang task này)</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {t.assigneeAccount ? (
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                        <UserAvatar user={assigneeUser} account={t.assigneeAccount} size="xs" shape="circle" />
                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          {t.assigneeAccount}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-amber-500 font-medium bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                        Chưa gán
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
