import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wand2,
  Check,
  PlusCircle,
  ListPlus,
  AlertCircle,
  Copy,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { SubTaskSuggestion, requestAIBreakdown } from '../lib/geminiService';
import { Specialization } from '../types/task';

interface AITaskAssistantProps {
  currentTitle: string;
  currentDescription: string;
  currentRole: Specialization;
  milestoneTitle?: string;
  onApplySingleTask: (task: SubTaskSuggestion) => void;
  onAppendChecklist: (tasks: SubTaskSuggestion[]) => void;
  onBatchCreateTasks?: (tasks: SubTaskSuggestion[]) => void;
  canBatchCreate?: boolean;
}

export const AITaskAssistant: React.FC<AITaskAssistantProps> = ({
  currentTitle,
  currentDescription,
  currentRole,
  milestoneTitle,
  onApplySingleTask,
  onAppendChecklist,
  onBatchCreateTasks,
  canBatchCreate = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SubTaskSuggestion[]>([]);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const [checklistAdded, setChecklistAdded] = useState(false);

  const handleUseCurrentContent = () => {
    const combined = [currentTitle, currentDescription].filter(Boolean).join('\n\n');
    if (combined) {
      setPrompt(combined);
    }
  };

  const handleBreakdown = async () => {
    const query = prompt.trim() || [currentTitle, currentDescription].filter(Boolean).join('\n\n');
    if (!query) {
      setError('Vui lòng nhập mô tả tính năng hoặc nhập tiêu đề task trước khi phân tách.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    setAppliedIndex(null);
    setChecklistAdded(false);

    try {
      const result = await requestAIBreakdown(query, {
        milestoneTitle,
        currentRole,
      });

      if (result.error) {
        setError(result.error);
      } else if (!result.tasks || result.tasks.length === 0) {
        setError('Không nhận được danh sách bóc tách từ AI. Vui lòng thử lại.');
      } else {
        setSuggestions(result.tasks);
      }
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra khi gọi AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('design')) {
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700';
    }
    if (r.includes('front') || r === 'fe') {
      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700';
    }
    if (r.includes('back') || r === 'be') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700';
    }
    if (r.includes('test') || r.includes('qa')) {
      return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700';
    }
    return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700';
  };

  return (
    <div className="border border-indigo-200/90 dark:border-indigo-800/80 rounded-2xl overflow-hidden bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-pink-50/30 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-pink-950/10 shadow-xs transition-all">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-indigo-100/40 dark:hover:bg-indigo-900/30 transition cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                ✨ AI Phân Tách Task & Gợi Ý
              </span>
              <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-300 px-1.5 py-0.2 rounded-md">
                Gemini 3.5 Flash
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Nhập tính năng lớn để AI tự động bóc tách task con theo chuyên môn & ước tính giờ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <span className="text-xs font-medium">{isOpen ? 'Thu gọn' : 'Mở trợ lý'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Accordion Body */}
      {isOpen && (
        <div className="p-4 pt-2 border-t border-indigo-100 dark:border-indigo-900/50 space-y-3 animate-in fade-in duration-200">
          {/* Input prompt area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                Mô tả tính năng / Đầu việc lớn cần bóc tách:
              </label>
              {(currentTitle || currentDescription) && (
                <button
                  type="button"
                  onClick={handleUseCurrentContent}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  Lấy từ form hiện tại
                </button>
              )}
            </div>

            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="VD: Xây dựng luồng xác thực hai bước (2FA) qua mã OTP SMS và ứng dụng Authenticator, có màn hình cấu hình bảo mật trong cài đặt tài khoản..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition resize-none leading-relaxed"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              💡 Bóc tách tự động ra: <b>Designer, Frontend, Backend, Tester</b> kèm giờ làm.
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleBreakdown}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gemini đang phân tích...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Bóc Tách Bằng AI</span>
                </>
              )}
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {/* Suggestions List */}
          {suggestions.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-indigo-100 dark:border-indigo-900/50">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  AI đã bóc tách được ({suggestions.length} task con):
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onAppendChecklist(suggestions);
                      setChecklistAdded(true);
                      setTimeout(() => setChecklistAdded(false), 2500);
                    }}
                    className="text-[11px] px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                  >
                    {checklistAdded ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Đã chèn checklist!</span>
                      </>
                    ) : (
                      <>
                        <ListPlus className="w-3 h-3 text-indigo-600" />
                        <span>Chèn vào mô tả</span>
                      </>
                    )}
                  </button>

                  {canBatchCreate && onBatchCreateTasks && (
                    <button
                      type="button"
                      onClick={() => onBatchCreateTasks(suggestions)}
                      className="text-[11px] px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 dark:bg-indigo-900/50 dark:border-indigo-700 dark:text-indigo-200 rounded-lg font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <PlusCircle className="w-3 h-3 text-indigo-600" />
                      <span>Tạo tất cả {suggestions.length} task</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {suggestions.map((st, idx) => {
                  const isApplied = appliedIndex === idx;
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1.5 shadow-2xs hover:border-indigo-300 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-slate-800 dark:text-slate-100 flex-1 min-w-0">
                          <span className="text-slate-400 mr-1.5 font-mono">#{idx + 1}</span>
                          {st.taskName}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadgeStyle(
                              st.role
                            )}`}
                          >
                            {st.role}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                            ⏱️ {st.estimatedEffort}h
                          </span>
                        </div>
                      </div>

                      {st.description && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                          {st.description}
                        </p>
                      )}

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            onApplySingleTask(st);
                            setAppliedIndex(idx);
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                            isApplied
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                          }`}
                        >
                          {isApplied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Đã áp dụng vào form</span>
                            </>
                          ) : (
                            <>
                              <ArrowRight className="w-3 h-3" />
                              <span>Áp dụng vào form</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
