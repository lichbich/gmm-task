'use client';

import React, { useRef } from 'react';
import { Bold, Sparkles } from 'lucide-react';
import { applyInlineFormatting } from '../../lib/textFormattingHelper';
import { FormattedTaskTitle } from './FormattedTaskTitle';

interface TaskTitleInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  showPreview?: boolean;
}

export const TaskTitleInput: React.FC<TaskTitleInputProps> = ({
  value,
  onChange,
  placeholder = "VD: BA | Viết tài liệu phần 'Working schedule'...",
  className = '',
  inputClassName = '',
  required = false,
  autoFocus = false,
  disabled = false,
  showPreview = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBoldToggle = () => {
    const input = inputRef.current;
    if (!input || disabled) return;

    const { newValue, newSelection } = applyInlineFormatting(
      input,
      '**',
      '**',
      'nội dung quan trọng'
    );
    onChange(newValue);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(newSelection.start, newSelection.end);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl + B or Cmd + B
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      handleBoldToggle();
    }
  };

  const hasFormatting =
    value.includes('**') ||
    value.includes('<b>') ||
    value.includes('<u>') ||
    value.includes('<mark>') ||
    value.includes('==');

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          disabled={disabled}
          className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-300/90 dark:border-slate-700 rounded-xl px-3 py-2.5 pr-20 text-slate-800 dark:text-slate-100 text-xs focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950 transition font-medium ${inputClassName}`}
        />

        {/* Quick Format Toolbar (Bold Button + Ctrl+B Hint) */}
        <div className="absolute right-2 flex items-center gap-1">
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
