import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  RotateCcw,
  Check,
  PlusCircle,
  ListPlus,
  AlertCircle,
  Copy,
  Layers,
  ArrowRight,
  Bot,
  User,
  Zap,
} from 'lucide-react';
import { SubTaskSuggestion, ChatHistoryMessage, requestAIChat } from '../lib/geminiService';
import { Specialization } from '../types/task';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'model';
  content: string;
  tasks?: SubTaskSuggestion[];
  timestamp: string;
}

interface AITaskChatBoxProps {
  currentTitle: string;
  currentDescription: string;
  currentRole: Specialization;
  milestoneTitle?: string;
  onApplySingleTask: (task: SubTaskSuggestion) => void;
  onApplyFullBreakdown: (tasks: SubTaskSuggestion[]) => void;
  onAppendChecklist: (tasks: SubTaskSuggestion[]) => void;
  onBatchCreateTasks?: (tasks: SubTaskSuggestion[]) => void;
  canBatchCreate?: boolean;
}

export const AITaskChatBox: React.FC<AITaskChatBoxProps> = ({
  currentTitle,
  currentDescription,
  currentRole,
  milestoneTitle,
  onApplySingleTask,
  onApplyFullBreakdown,
  onAppendChecklist,
  onBatchCreateTasks,
  canBatchCreate = false,
}) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedItemKey, setAppliedItemKey] = useState<string | null>(null);
  const [appliedFullTurnId, setAppliedFullTurnId] = useState<string | null>(null);
  const [checklistAddedTurnId, setChecklistAddedTurnId] = useState<string | null>(null);
  const [scope, setScope] = useState<'current_role' | 'all_roles'>('current_role');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt !== undefined ? customPrompt : inputValue).trim();
    if (!textToSend || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const newUserMsg: ChatMessageItem = {
      id: userMessageId,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    // Prepare history for API
    const historyPayload: ChatHistoryMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, newUserMsg]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await requestAIChat(textToSend, historyPayload, {
        milestoneTitle,
        currentRole,
        currentTaskTitle: currentTitle,
        scope,
      });

      if (response.error) {
        setError(response.error);
      } else {
        const botMessageId = `bot-${Date.now()}`;
        const newBotMsg: ChatMessageItem = {
          id: botMessageId,
          role: 'model',
          content: response.message || 'Dưới đây là danh sách task đã được phân tích.',
          tasks: response.tasks,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, newBotMsg]);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi xử lý phản hồi từ AI.');
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setError(null);
    setInputValue('');
  };

  const handleUseCurrentContent = () => {
    const combined = [currentTitle, currentDescription].filter(Boolean).join('\n\n');
    if (combined) {
      setInputValue(`Phân tích và bóc tách các task cho team ${currentRole}:\n${combined}`);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    const r = (role || '').toLowerCase();
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

  // Dynamic sample prompts based on currentRole and scope
  const getSamplePrompts = () => {
    if (scope === 'all_roles') {
      return [
        'Phân tích toàn diện: Luồng quét mã QR thanh toán',
        'Phân tích toàn diện: Đăng nhập 2FA qua OTP SMS/Email',
        'Phân tích toàn diện: Dashboard thống kê tiến độ tuần',
        'Phân tích toàn diện: Quản lý phân quyền tài khoản',
      ];
    }
    const r = (currentRole || '').toLowerCase();
    if (r.includes('design')) {
      return [
        'Thiết kế UI/UX: Dashboard thống kê tiến độ theo tuần',
        'Thiết kế màn hình & UI Flow: Quét mã QR thanh toán',
        'Thiết kế Wireframe & Prototype: Cài đặt bảo mật 2FA',
        'Thiết kế Design System: Bộ icons & biểu đồ thống kê',
      ];
    }
    if (r.includes('back') || r === 'be') {
      return [
        'Xây dựng Database & API: Dashboard thống kê tiến độ tuần',
        'Phát triển API: Xác thực 2FA OTP qua SMS/Email',
        'Xây dựng API: Xử lý webhook & thanh toán mã QR',
        'Tối ưu hóa Database: Indexing & Cache Redis cho báo cáo',
      ];
    }
    if (r.includes('front') || r === 'fe') {
      return [
        'Phát triển UI Component: Dashboard biểu đồ thống kê tuần',
        'Ghép API & State: Màn hình xác thực 2FA OTP',
        'Xây dựng giao diện: Quét mã QR thanh toán Responsive',
        'Tối ưu hiệu năng FE: Lazy loading & Client Cache',
      ];
    }
    if (r.includes('test') || r.includes('qa')) {
      return [
        'Kế hoạch kiểm thử: Dashboard thống kê tiến độ theo tuần',
        'Kiểm thử bảo mật & Tải: Luồng xác thực 2FA OTP',
        'Viết Test Cases: Thanh toán mã QR & các mã lỗi',
        'Kiểm thử hồi quy: Tính năng phân quyền tài khoản',
      ];
    }
    return [
      `Phân tích các đầu việc chuyên môn cho team ${currentRole}`,
      'Phân tích tính năng: Dashboard thống kê tiến độ theo tuần',
      'Phân tích tính năng: Xác thực 2FA qua OTP SMS/Email',
      'Phân tích tính năng: Quét mã QR thanh toán',
    ];
  };

  // Dynamic follow-up chips based on currentRole and scope
  const getQuickFollowUps = () => {
    const r = (currentRole || '').toLowerCase();
    if (scope === 'current_role') {
      if (r.includes('design')) {
        return [
          '🎨 Thêm task UI Wireframe & Prototype',
          '📱 Bổ sung giao diện Mobile Responsive',
          '⏱️ Tối ưu lại số giờ Designer',
          '📋 Chi tiết checklist thiết kế',
        ];
      }
      if (r.includes('back') || r === 'be') {
        return [
          '🗄️ Thêm task Database Schema & Migrations',
          '🔐 Thêm task API Bảo mật & Xác thực',
          '⏱️ Tối ưu lại số giờ Backend',
          '📋 Chi tiết checklist API & Swagger',
        ];
      }
      if (r.includes('front') || r === 'fe') {
        return [
          '⚛️ Thêm task ghép API & State Management',
          '🎨 Căn chỉnh giao diện Responsive & Animation',
          '⏱️ Tối ưu lại số giờ Frontend',
          '📋 Chi tiết checklist FE Component',
        ];
      }
      if (r.includes('test') || r.includes('qa')) {
        return [
          '🧪 Thêm task Test Cases & Test Matrix',
          '🐞 Thêm task Test Tải & Bảo Mật',
          '⏱️ Tối ưu lại số giờ Tester',
          '📋 Chi tiết checklist kiểm thử',
        ];
      }
    }
    return [
      '⏱️ Tối ưu lại số giờ thực tế hơn',
      '➕ Thêm task kiểm thử bảo mật & tải',
      '🛠️ Chia nhỏ hơn các task phức tạp',
      '📋 Viết checklist kỹ thuật chi tiết hơn',
    ];
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/70 dark:bg-slate-900/50 border-r border-slate-200/90 dark:border-slate-800/80 overflow-hidden">
      {/* Top Header of Chat */}
      <div className="p-3 sm:px-4 sm:py-3 border-b border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                ✨ AI Co-pilot Task
              </span>
              <span className="text-[10px] font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-1.5 py-0.2 rounded-md shadow-2xs">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Phân rã & trao đổi đa vòng (Multi-turn chat)
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleResetChat}
            className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Xóa lịch sử và bắt đầu hội thoại mới"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Làm mới chat</span>
          </button>
        )}
      </div>

      {/* Scope Selector: Focus exclusively on current team vs all teams */}
      <div className="px-3.5 py-2 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
          <span>🎯 Phạm vi gợi ý:</span>
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
          <button
            type="button"
            onClick={() => setScope('current_role')}
            className={`px-2 py-0.8 text-[10.5px] font-bold rounded-md transition cursor-pointer flex items-center gap-1 ${
              scope === 'current_role'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title={`Chỉ bóc tách và tạo task cho role ${currentRole}`}
          >
            <span>Chỉ team {currentRole}</span>
          </button>
          <button
            type="button"
            onClick={() => setScope('all_roles')}
            className={`px-2 py-0.8 text-[10.5px] font-bold rounded-md transition cursor-pointer flex items-center gap-1 ${
              scope === 'all_roles'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Bóc tách đầy đủ các team Frontend, Backend, Designer, Tester..."
          >
            <span>🌐 Toàn bộ team</span>
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto custom-scrollbar space-y-3.5 min-h-0">
        {messages.length === 0 ? (
          <div className="space-y-3 pt-1">
            <div className="p-3.5 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950 rounded-2xl shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                <Bot className="w-4 h-4 text-indigo-600" />
                <span>
                  {scope === 'current_role'
                    ? `AI đang hỗ trợ chuyên biệt cho team ${currentRole}`
                    : 'AI đang hỗ trợ bóc tách cho toàn bộ team'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {scope === 'current_role' ? (
                  <>
                    Nhập tính năng cần thực hiện. AI sẽ tập trung bóc tách các task con và ước tính số giờ riêng cho vai trò <b className="text-indigo-600 dark:text-indigo-400 font-bold">{currentRole}</b>.
                  </>
                ) : (
                  <>
                    Nhập tính năng lớn cần triển khai. AI sẽ bóc tách đầy đủ các vai trò <b>Designer, Frontend, Backend, Tester</b>.
                  </>
                )}
              </p>

              {(currentTitle || currentDescription) && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleUseCurrentContent}
                    className="text-[11px] px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 rounded-xl font-semibold flex items-center gap-1.5 transition border border-indigo-200/80 dark:border-indigo-800 cursor-pointer shadow-2xs"
                  >
                    <Copy className="w-3 h-3 text-indigo-600" />
                    <span>Lấy nội dung từ Tên & Mô tả đang nhập ở Form</span>
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" /> Gợi ý nhanh:
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {getSamplePrompts().map((sp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(sp)}
                    className="text-left p-2.5 bg-white dark:bg-slate-900 hover:bg-indigo-50/70 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium transition active:scale-[0.99] cursor-pointer shadow-2xs flex items-center justify-between gap-2"
                  >
                    <span>{sp}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="space-y-2 animate-in fade-in duration-150">
              {msg.role === 'user' ? (
                /* User Message Bubble */
                <div className="flex items-start justify-end gap-2">
                  <div className="max-w-[85%] bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-xs text-xs shadow-xs space-y-1 leading-relaxed">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className="text-[9.5px] text-indigo-200 text-right font-mono">
                      {msg.timestamp}
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] shrink-0 mt-1 font-bold">
                    <User className="w-3 h-3" />
                  </div>
                </div>
              ) : (
                /* AI Response Bubble */
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-[10px] shrink-0 mt-1 shadow-xs">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div className="max-w-[92%] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3.5 rounded-2xl rounded-tl-xs text-xs shadow-xs space-y-2.5">
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>

                    {/* Generated Subtasks Preview List */}
                    {msg.tasks && msg.tasks.length > 0 && (
                      <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <Layers className="w-3 h-3 text-indigo-600" />
                            Đề xuất {msg.tasks.length} task con:
                          </span>
                        </div>

                        {/* Task Cards */}
                        <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
                          {msg.tasks.map((st, sIdx) => {
                            const itemKey = `${msg.id}-${sIdx}`;
                            const isSingleApplied = appliedItemKey === itemKey;
                            return (
                              <div
                                key={sIdx}
                                className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl space-y-1 text-xs hover:border-indigo-300 transition shadow-2xs"
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="font-semibold text-slate-800 dark:text-slate-100 flex-1 min-w-0">
                                    <span className="text-slate-400 mr-1 font-mono text-[10px]">
                                      #{sIdx + 1}
                                    </span>
                                    {st.taskName}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span
                                      className={`px-1.5 py-0.2 rounded-md text-[9.5px] font-bold border ${getRoleBadgeStyle(
                                        st.role
                                      )}`}
                                    >
                                      {st.role}
                                    </span>
                                    <span className="px-1.5 py-0.2 rounded-md text-[9.5px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                                      ⏱️ {st.estimatedEffort}h
                                    </span>
                                  </div>
                                </div>

                                {st.description && (
                                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                    {st.description}
                                  </p>
                                )}

                                <div className="flex justify-end pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onApplySingleTask(st);
                                      setAppliedItemKey(itemKey);
                                    }}
                                    className={`text-[10px] px-2 py-0.8 rounded-lg font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                                      isSingleApplied
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
                                    }`}
                                  >
                                    {isSingleApplied ? (
                                      <>
                                        <Check className="w-2.5 h-2.5 text-emerald-600" />
                                        <span>Đã điền form</span>
                                      </>
                                    ) : (
                                      <>
                                        <ArrowRight className="w-2.5 h-2.5" />
                                        <span>Áp dụng vào Form</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Batch Action Toolbar for this Turn */}
                        <div className="pt-2 flex items-center gap-1.5 flex-wrap border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              onApplyFullBreakdown(msg.tasks!);
                              setAppliedFullTurnId(msg.id);
                              setTimeout(() => setAppliedFullTurnId(null), 2500);
                            }}
                            className="text-[10.5px] px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                          >
                            {appliedFullTurnId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-300" />
                                <span>Đã áp dụng vào Form!</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Áp dụng kết quả này</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onAppendChecklist(msg.tasks!);
                              setChecklistAddedTurnId(msg.id);
                              setTimeout(() => setChecklistAddedTurnId(null), 2500);
                            }}
                            className="text-[10.5px] px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
                          >
                            {checklistAddedTurnId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600 font-bold">Đã chèn checklist!</span>
                              </>
                            ) : (
                              <>
                                <ListPlus className="w-3 h-3 text-indigo-600" />
                                <span>Chèn vào Mô tả</span>
                              </>
                            )}
                          </button>

                          {canBatchCreate && onBatchCreateTasks && (
                            <button
                              type="button"
                              onClick={() => onBatchCreateTasks(msg.tasks!)}
                              className="text-[10.5px] px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-lg font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs"
                            >
                              <PlusCircle className="w-3 h-3 text-purple-600" />
                              <span>Tạo tất cả {msg.tasks.length} task</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-[9.5px] text-slate-400 text-right font-mono">
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="flex items-start gap-2 animate-in fade-in">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-[10px] shrink-0 mt-1 shadow-xs">
              <Sparkles className="w-3 h-3 animate-spin" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 p-3 rounded-2xl rounded-tl-xs text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-2 shadow-2xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>Gemini đang suy nghĩ và điều chỉnh danh sách task...</span>
            </div>
          </div>
        )}

        {/* Error notice */}
        {error && (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Follow-up Adjustment Chips */}
      {messages.length > 0 && !isLoading && (
        <div className="px-3 py-1.5 bg-white/60 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
          <span className="text-[10px] text-slate-400 shrink-0 font-medium">Gợi ý phản hồi:</span>
          {getQuickFollowUps().map((qf, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(qf)}
              className="text-[10.5px] px-2 py-0.8 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/50 hover:text-indigo-700 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 rounded-lg shrink-0 transition active:scale-95 cursor-pointer font-medium"
            >
              {qf}
            </button>
          ))}
        </div>
      )}

      {/* Input Form Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                messages.length === 0
                  ? 'Nhập mô tả tính năng cần bóc tách (VD: Luồng xác thực 2FA, thanh toán QR...)'
                  : 'Nhập phản hồi tiếp theo (VD: Tăng giờ FE lên 4h, thêm task Swagger...)'
              }
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300/90 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950 transition resize-none leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center shrink-0 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20 cursor-pointer mb-0.5"
            title="Gửi yêu cầu (Enter)"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
