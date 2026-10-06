import React, { useRef } from 'react';
import { Bold, Sparkles, Plus } from 'lucide-react';
import { applyInlineFormatting } from '../../lib/textFormattingHelper';
import { FormattedTaskTitle } from './FormattedTaskTitle';
import { getRoleTaskPrefix, hasTaskPrefix, ensureTaskTitlePrefix } from '../../lib/taskPrefixHelper';

interface TaskTitleInputProps {
  value: string;
  onChange: (val: string) => void;
  role?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  showPreview?: boolean;
  autoPrefixOnBlur?: boolean;
}

export const TaskTitleInput: React.FC<TaskTitleInputProps> = ({
  value,
  onChange,
  role,
  placeholder,
  className = '',
  inputClassName = '',
  required = false,
  autoFocus = false,
  disabled = false,
  showPreview = true,
  autoPrefixOnBlur = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const rolePrefix = role ? getRoleTaskPrefix(role) : '';
  const alreadyHasPrefix = hasTaskPrefix(value, role);
  const defaultPlaceholder = rolePrefix
    ? `VD: ${rolePrefix}Tên công việc...`
    : "VD: BA | Viết tài liệu phần 'Working schedule'...";
  const effectivePlaceholder = placeholder || defaultPlaceholder;

  // History Stack for Undo / Redo
  interface TitleHistory {
    value: string;
    selection: { start: number; end: number };
  }

  const historyRef = useRef<TitleHistory[]>([
    { value, selection: { start: value.length, end: value.length } },
  ]);
  const historyIndexRef = useRef<number>(0);
  const isUndoingRedoingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const pushTitleSnapshot = (
    newVal: string,
    selection?: { start: number; end: number }
  ) => {
    if (isUndoingRedoingRef.current) return;
    const current = historyRef.current[historyIndexRef.current];
    if (current && current.value === newVal) return;

    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push({
      value: newVal,
      selection: selection || { start: newVal.length, end: newVal.length },
    });
    if (nextHistory.length > 50) nextHistory.shift();
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
  };

  const handleUndo = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (historyIndexRef.current <= 0) return;
    isUndoingRedoingRef.current = true;
    historyIndexRef.current -= 1;
    const target = historyRef.current[historyIndexRef.current];
    onChange(target.value);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(target.selection.start, target.selection.end);
      }
      isUndoingRedoingRef.current = false;
    }, 0);
  };

  const handleRedo = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    isUndoingRedoingRef.current = true;
    historyIndexRef.current += 1;
    const target = historyRef.current[historyIndexRef.current];
    onChange(target.value);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(target.selection.start, target.selection.end);
      }
      isUndoingRedoingRef.current = false;
    }, 0);
  };

  const handleBoldToggle = () => {
    const input = inputRef.current;
    if (!input || disabled) return;

    const currStart = input.selectionStart ?? 0;
    const currEnd = input.selectionEnd ?? 0;
    pushTitleSnapshot(value, { start: currStart, end: currEnd });

    const { newValue, newSelection } = applyInlineFormatting(
      input,
      '**',
      '**',
      'nội dung quan trọng'
    );
    onChange(newValue);
    pushTitleSnapshot(newValue, newSelection);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(newSelection.start, newSelection.end);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      // Undo: Ctrl + Z
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Redo: Ctrl + Y or Ctrl + Shift + Z
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Bold: Ctrl + B or Cmd + B
      if (key === 'b') {
        e.preventDefault();
        handleBoldToggle();
        return;
      }
    }
  };

  const hasFormatting =
    value.includes('**') ||
    value.includes('<b>') ||
    value.includes('<u>') ||
    value.includes('<mark>') ||
    value.includes('==');

  const handleBlur = () => {
    if (autoPrefixOnBlur && role && value.trim() && !hasTaskPrefix(value, role)) {
      const formatted = ensureTaskTitlePrefix(value, role);
      onChange(formatted);
      pushTitleSnapshot(formatted);
    }
  };

  const handleApplyPrefix = () => {
    if (!rolePrefix) return;
    const formatted = ensureTaskTitlePrefix(value, role);
    onChange(formatted);
    pushTitleSnapshot(formatted);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            const newVal = e.target.value;
            const start = e.target.selectionStart ?? 0;
            const end = e.target.selectionEnd ?? 0;
            onChange(newVal);
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
              pushTitleSnapshot(newVal, { start, end });
            }, 300);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={effectivePlaceholder}
          required={required}
          autoFocus={autoFocus}
          disabled={disabled}
          className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-300/90 dark:border-slate-700 rounded-xl px-3 py-2.5 pr-28 text-slate-800 dark:text-slate-100 text-xs focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950 transition font-medium ${inputClassName}`}
        />

        {/* Quick Format Toolbar (Role Prefix Hint + Bold Button) */}
        <div className="absolute right-2 flex items-center gap-1">
          {rolePrefix && !alreadyHasPrefix && (
            <button
              type="button"
              onClick={handleApplyPrefix}
              disabled={disabled}
              className="p-1 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 transition cursor-pointer flex items-center gap-1 text-[10.5px] font-bold shadow-2xs active:scale-95 border border-indigo-200 dark:border-indigo-800"
              title={`Tự động thêm tiền tố [${rolePrefix}] vào đầu task`}
            >
              <Plus className="w-3 h-3 stroke-[3]" />
              <span>{rolePrefix.replace(/\s*\|\s*$/, '')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleBoldToggle}
            disabled={disabled}
            className="p-1 px-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-950/80 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer flex items-center gap-1 text-[10.5px] font-bold shadow-2xs active:scale-95"
            title="In đậm đoạn văn bản đã bôi đen (Ctrl + B)"
          >
            <Bold className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="text-[9.5px] font-mono font-semibold opacity-70 hidden sm:inline">Ctrl+B</span>
          </button>
        </div>
      </div>

      {/* Live Preview if title contains bold / formatting */}
      {showPreview && hasFormatting && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-lg text-xs text-slate-700 dark:text-slate-200">
          <span className="text-[10px] uppercase font-bold text-indigo-500 shrink-0 font-mono">
            Xem trước:
          </span>
          <div className="truncate min-w-0 font-medium">
            <FormattedTaskTitle title={value} />
          </div>
        </div>
      )}
    </div>
  );
};
