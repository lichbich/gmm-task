'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../../types/task';
import { getTaskShareUrl, getTaskMRTemplateText, copyTextToClipboard } from '../../lib/taskLinkHelper';
import { Link2, GitPullRequest, Check, Copy, Share2, Sparkles } from 'lucide-react';

interface TaskShareButtonProps {
  task: Partial<Task> & { id: string; title: string };
  variant?: 'button' | 'icon' | 'compact-pill';
  className?: string;
  align?: 'left' | 'right';
}

export const TaskShareButton: React.FC<TaskShareButtonProps> = ({
  task,
  variant = 'button',
  className = '',
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<'link' | 'mr' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const handleCopy = async (e: React.MouseEvent, type: 'link' | 'mr') => {
    e.stopPropagation();
    e.preventDefault();

    let textToCopy = '';
    if (type === 'link') {
      textToCopy = getTaskShareUrl(task.id);
    } else {
      textToCopy = getTaskMRTemplateText(task);
    }

    const success = await copyTextToClipboard(textToCopy);
    if (success) {
      setCopiedType(type);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedType(null);
        setIsOpen(false);
      }, 1500);
    }
  };

  const shareUrl = getTaskShareUrl(task.id);
  const mrText = getTaskMRTemplateText(task);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`} onClick={(e) => e.stopPropagation()}>
      {/* Trigger Button Variants */}
      {variant === 'icon' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className={`p-1.5 rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer ${
            isOpen || copiedType
              ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-400/40'
              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
          }`}
          title="Chia sẻ hoặc Sao chép link task"
        >
          {copiedType ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-in zoom-in" />
          ) : (
            <Share2 className="w-3.5 h-3.5" />
          )}
        </button>
      )}

      {variant === 'compact-pill' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer ${
            isOpen || copiedType
              ? 'bg-indigo-600 text-white shadow-indigo-600/20'
              : 'bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700'
          }`}
          title="Sao chép link task để gắn vào Merge Request"
        >
          {copiedType ? (
            <>
              <Check className="w-3 h-3 text-emerald-300 animate-in zoom-in" />
              <span className="text-[11px] text-white">Đã copy</span>
            </>
          ) : (
            <>
              <Link2 className="w-3 h-3" />
              <span className="text-[11px]">Copy Link</span>
            </>
          )}
        </button>
      )}

      {variant === 'button' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
            isOpen || copiedType
              ? 'bg-indigo-600 text-white shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
          }`}
        >
          {copiedType ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400 animate-in zoom-in" />
              <span>Đã sao chép</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Chia sẻ Link Task</span>
            </>
          )}
        </button>
      )}

      {/* Popover / Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100`}
        >
          <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Chia Sẻ Link Task
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              #{task.id.replace(/^tsk-/, '')}
            </span>
          </div>

          <div className="space-y-1.5">
            {/* Option 1: Copy Direct Link */}
            <button
              type="button"
              onClick={(e) => handleCopy(e, 'link')}
              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                copiedType === 'link'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-slate-50/80 dark:bg-slate-800/60 hover:bg-indigo-50/70 dark:hover:bg-slate-800 border-slate-200/70 dark:border-slate-700/70 hover:border-indigo-300'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${copiedType === 'link' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'}`}>
                {copiedType === 'link' ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold leading-snug">
                    {copiedType === 'link' ? 'Đã sao chép link task!' : 'Sao chép Link trực tiếp'}
                  </span>
                  <Copy className="w-3 h-3 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-mono">
                  {shareUrl}
                </p>
              </div>
            </button>

            {/* Option 2: Copy Merge Request Markdown Template */}
            <button
              type="button"
              onClick={(e) => handleCopy(e, 'mr')}
              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                copiedType === 'mr'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-slate-50/80 dark:bg-slate-800/60 hover:bg-purple-50/70 dark:hover:bg-slate-800 border-slate-200/70 dark:border-slate-700/70 hover:border-purple-300'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${copiedType === 'mr' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400'}`}>
                {copiedType === 'mr' ? <Check className="w-4 h-4" /> : <GitPullRequest className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold leading-snug">
                    {copiedType === 'mr' ? 'Đã copy cú pháp Merge Request!' : 'Chuẩn Template Merge Request'}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                    Git MR
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-mono">
                  {mrText}
                </p>
              </div>
            </button>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 text-center">
            Link sẽ tự động mở đúng popup task khi người khác bấm vào
          </div>
        </div>
      )}
    </div>
  );
};
