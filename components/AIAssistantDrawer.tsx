'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { isAIFeatureEnabled, requestAISystemQuery, ChatHistoryMessage } from '../lib/geminiService';
import {
  Sparkles,
  Bot,
  X,
  Send,
  Trash2,
  Maximize2,
  Minimize2,
  Layers,
  Clock,
  AlertCircle,
  HelpCircle,
  User as UserIcon,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useHoverScrollLock } from '../hooks/useHoverScrollLock';

const SUGGESTION_PROMPTS = [
  '📊 Tổng hợp nhanh tiến độ và số giờ tuần này?',
  '🔍 Có task nào đang bị chậm hoặc kéo dài qua nhiều tuần?',
  '👥 Thống kê tổng số giờ làm theo từng Role tuần này?',
  '🎫 Liệt kê các Ticket yêu cầu đang ở trạng thái Open?',
  '🏆 Ai đang làm việc tích cực và hoàn thành nhiều task nhất?',
];

/** Render inline formatting: bold, italic, code, @Account mentions, and role badges */
function renderChatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    const codeMatch = remaining.match(/`(.*?)`/);
    const italicMatch = remaining.match(/\*(.*?)\*/);
    const mentionMatch = remaining.match(/@([a-zA-Z0-9_-]+)/);
    const bracketMatch = remaining.match(/\[(.*?)\]/);

    const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
    const codeIndex = codeMatch ? remaining.indexOf(codeMatch[0]) : -1;
    const bracketIndex = bracketMatch ? remaining.indexOf(bracketMatch[0]) : -1;
    const mentionIndex = mentionMatch ? remaining.indexOf(mentionMatch[0]) : -1;

    let matchType: 'bold' | 'code' | 'bracket' | 'mention' | 'none' = 'none';
    let firstIndex = remaining.length;

    if (boldIndex !== -1 && boldIndex < firstIndex) {
      firstIndex = boldIndex;
      matchType = 'bold';
    }
    if (codeIndex !== -1 && codeIndex < firstIndex) {
      firstIndex = codeIndex;
      matchType = 'code';
    }
    if (bracketIndex !== -1 && bracketIndex < firstIndex) {
      firstIndex = bracketIndex;
      matchType = 'bracket';
    }
    if (mentionIndex !== -1 && mentionIndex < firstIndex) {
      firstIndex = mentionIndex;
      matchType = 'mention';
    }

    if (matchType === 'none') {
      if (italicMatch && remaining.indexOf(italicMatch[0]) !== -1) {
        const itIndex = remaining.indexOf(italicMatch[0]);
        if (itIndex > 0) {
          parts.push(remaining.substring(0, itIndex));
        }
        parts.push(
          <em key={key++} className="italic text-slate-600 dark:text-slate-300 font-medium">
            {italicMatch[1]}
          </em>
        );
        remaining = remaining.substring(itIndex + italicMatch[0].length);
        continue;
      }
      parts.push(remaining);
      break;
    }

    if (firstIndex > 0) {
      parts.push(remaining.substring(0, firstIndex));
    }

    if (matchType === 'bold' && boldMatch) {
      const boldContent = boldMatch[1];
      const lower = boldContent.toLowerCase().trim();
      let roleBadgeClass = '';
      if (lower === 'be' || lower.includes('backend')) {
        roleBadgeClass = 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      } else if (lower === 'fe' || lower.includes('frontend')) {
        roleBadgeClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      } else if (lower.includes('design')) {
        roleBadgeClass = 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800';
      } else if (lower.includes('test') || lower === 'qc' || lower === 'qa') {
        roleBadgeClass = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      } else if (lower === 'ba' || lower.includes('analyst') || lower.includes('product')) {
        roleBadgeClass = 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
      } else if (lower.includes('devops') || lower.includes('infra')) {
        roleBadgeClass = 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      }

      if (roleBadgeClass) {
        parts.push(
          <span
            key={key++}
            className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-[10px] font-bold border ${roleBadgeClass} mr-1`}
          >
            {boldContent}
          </span>
        );
      } else {
        parts.push(
          <strong key={key++} className="font-bold text-slate-900 dark:text-slate-100">
            {boldContent}
          </strong>
        );
      }
      remaining = remaining.substring(firstIndex + boldMatch[0].length);
    } else if (matchType === 'code' && codeMatch) {
      parts.push(
        <code
          key={key++}
          className="px-1 py-0.2 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono text-[10px] border border-purple-200 dark:border-purple-800"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.substring(firstIndex + codeMatch[0].length);
    } else if (matchType === 'mention' && mentionMatch) {
      parts.push(
        <span
          key={key++}
          className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 font-bold text-[11px] mr-0.5"
        >
          @{mentionMatch[1]}
        </span>
      );
      remaining = remaining.substring(firstIndex + mentionMatch[0].length);
    } else if (matchType === 'bracket' && bracketMatch) {
      const inner = bracketMatch[1].trim();
      const lower = inner.toLowerCase();
      if (['fe', 'be', 'ba', 'qa', 'qc', 'design', 'designer', 'devops', 'pm', 'po', 'sa'].includes(lower)) {
        let badgeClass = 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800';
        if (lower === 'be') badgeClass = 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
        else if (lower === 'fe') badgeClass = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
        else if (lower.includes('design')) badgeClass = 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800';
        else if (lower === 'ba') badgeClass = 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
        else if (lower === 'qa' || lower === 'qc') badgeClass = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';

        parts.push(
          <span
            key={key++}
            className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold border ${badgeClass} mr-1`}
          >
            {inner.toUpperCase()}
          </span>
        );
      } else {
        parts.push(
          <span key={key++} className="font-semibold text-slate-700 dark:text-slate-300">
            [{inner}]
          </span>
        );
      }
      remaining = remaining.substring(firstIndex + bracketMatch[0].length);
    }
  }

  return parts;
}

/** Component to render rich visual elements from AI chat reply (Headings, Tables, Lists, Badges) */
const AIChatMessageContent: React.FC<{ content: string }> = ({ content }) => {
  const blocks = useMemo(() => {
    if (!content) return [];
    const lines = content.split('\n');
    const result: Array<{
      type: 'heading' | 'bullet' | 'numbered' | 'table' | 'paragraph' | 'subdetail';
      text?: string;
      items?: string[];
      tableHeaders?: string[];
      tableRows?: string[][];
    }> = [];

    let currentTableLines: string[] = [];

    const flushTable = () => {
      if (currentTableLines.length >= 2) {
        const parseLine = (l: string) =>
          l
            .trim()
            .replace(/^\|\s*/, '')
            .replace(/\s*\|$/, '')
            .split('|')
            .map((c) => c.trim());

        const headers = parseLine(currentTableLines[0]);
        const H = headers.length;

        // Filter out separator lines like |---|---|
        const rowLines = currentTableLines.slice(1).filter((l) => !/^[\|\s\-:]+$/.test(l.trim()));
        
        const rows = rowLines.map((l) => {
          const rawCells = parseLine(l);
          if (rawCells.length === H) {
            return rawCells;
          }
          if (rawCells.length > H && H >= 2) {
            // Unescaped pipes inside the first column (e.g. task title with pipes)
            const overflow = rawCells.length - H;
            const mergedFirstCell = rawCells.slice(0, overflow + 1).join(' | ');
            const remainingCells = rawCells.slice(overflow + 1);
            return [mergedFirstCell, ...remainingCells];
          }
          if (rawCells.length < H) {
            const padded = [...rawCells];
            while (padded.length < H) {
              padded.push('');
            }
            return padded;
          }
          return rawCells;
        });

        result.push({
          type: 'table',
          tableHeaders: headers,
          tableRows: rows,
        });
      }
      currentTableLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Table line detection
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        currentTableLines.push(trimmed);
        continue;
      } else if (currentTableLines.length > 0) {
        flushTable();
      }

      if (!trimmed || trimmed === '---' || trimmed === '***') continue;

      // Heading detection
      if (trimmed.startsWith('### ') || trimmed.startsWith('## ') || (/^\*\*\d+\./.test(trimmed) && trimmed.endsWith('**'))) {
        const cleanTitle = trimmed.replace(/^[#*]+\s*/, '').replace(/\*+$/, '').trim();
        result.push({ type: 'heading', text: cleanTitle });
        continue;
      }

      // Sub-detail line (e.g. indented "- Trạng thái: ..." or "- Tiến độ: ...")
      if (line.startsWith('   -') || line.startsWith('  -') || line.startsWith('\t-') || (/^-\s+(Trạng thái|Tiến độ|Ước tính|Thực tế|Giờ|Deadline|Tuần)/i.test(trimmed))) {
        const cleanSub = trimmed.replace(/^-\s+/, '').trim();
        result.push({ type: 'subdetail', text: cleanSub });
        continue;
      }

      // Bullet item detection
      if (/^(\*|\-|\•)\s+/.test(trimmed)) {
        const cleanBullet = trimmed.replace(/^(\*|\-|\•)\s+/, '').trim();
        result.push({ type: 'bullet', text: cleanBullet });
        continue;
      }

      // Numbered item detection
      if (/^\d+\.\s+/.test(trimmed)) {
        const cleanNumbered = trimmed.trim();
        result.push({ type: 'numbered', text: cleanNumbered });
        continue;
      }

      // Standard paragraph
      result.push({ type: 'paragraph', text: trimmed });
    }

    if (currentTableLines.length > 0) {
      flushTable();
    }

    return result;
  }, [content]);

  return (
    <div className="space-y-1.5 leading-relaxed text-slate-800 dark:text-slate-100">
      {blocks.map((block: any, idx: number) => {
        if (block.type === 'heading') {
          return (
            <div
              key={idx}
              className="font-bold text-xs sm:text-[13px] text-purple-900 dark:text-purple-300 mt-2.5 mb-1 pb-1 border-b border-purple-100 dark:border-purple-900/50 flex items-center gap-1.5"
            >
              <span>{renderChatInline(block.text || '')}</span>
            </div>
          );
        }

        if (block.type === 'table' && block.tableHeaders) {
          return (
            <div key={idx} className="overflow-x-auto my-2 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-2xs">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="bg-purple-50/90 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    {block.tableHeaders.map((header: string, hIdx: number) => (
                      <th key={hIdx} className="px-2.5 py-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-700/80 whitespace-nowrap">
                        {renderChatInline(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {block.tableRows?.map((row: string[], rIdx: number) => (
                    <tr
                      key={rIdx}
                      className={rIdx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/60 dark:bg-slate-800/40'}
                    >
                      {row.map((cell: string, cIdx: number) => (
                        <td key={cIdx} className="px-2.5 py-1.5 border-r last:border-r-0 border-slate-100 dark:border-slate-800">
                          {renderChatInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === 'subdetail') {
          return (
            <div key={idx} className="ml-5 -mt-0.5 mb-1.5 p-2 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100/80 dark:border-purple-900/40 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
              <ArrowRight className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                {renderChatInline(block.text || '')}
              </div>
            </div>
          );
        }

        if (block.type === 'bullet') {
          const isTaskCard =
            block.text?.startsWith('📌') ||
            block.text?.startsWith('🔹') ||
            block.text?.startsWith('⏳') ||
            block.text?.startsWith('✅') ||
            block.text?.startsWith('⚠️') ||
            block.text?.startsWith('**[') ||
            block.text?.startsWith('[');

          if (isTaskCard) {
            return (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 my-1.5 shadow-2xs">
                <div className="flex items-start gap-2">
                  <div className="flex-1 text-slate-900 dark:text-slate-100 text-xs font-medium leading-relaxed">
                    {renderChatInline(block.text || '')}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={idx} className="flex items-start gap-2 my-1 pl-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400 shrink-0 mt-1.5" />
              <div className="flex-1 text-slate-800 dark:text-slate-200 text-xs">
                {renderChatInline(block.text || '')}
              </div>
            </div>
          );
        }

        if (block.type === 'numbered') {
          const numMatch = (block.text || '').match(/^(\d+)\.\s*(.*)/);
          const numStr = numMatch ? numMatch[1] : '1';
          const numContent = numMatch ? numMatch[2] : block.text || '';
          return (
            <div key={idx} className="flex items-start gap-2 my-1 pl-0.5">
              <span className="w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                {numStr}
              </span>
              <div className="flex-1 text-slate-800 dark:text-slate-200 text-xs">
                {renderChatInline(numContent)}
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed my-1 text-xs">
            {renderChatInline(block.text || '')}
          </p>
        );
      })}
    </div>
  );
};

const getInitialGreeting = (user: any): ChatHistoryMessage => {
  const account = user?.account ? `@${user.account}` : '';
  const fullName = user?.name || '';
  const displayName = fullName ? (account ? `${fullName} (${account})` : fullName) : (account || 'bạn');
  return {
    role: 'model',
    content: `Xin chào **${displayName}**! Tôi là **AI Trợ Lý Dự Án Saho**. Tôi đã được kết nối trực tiếp với dữ liệu thực tế (Tasks, Tickets, Thành viên, Lịch sử tuần). ${account ? `Bạn (${account})` : 'Bạn'} có thể hỏi tôi bất kỳ thông tin nào về tiến độ, rủi ro, phân bổ công việc hoặc số liệu dự án!`,
  };
};

export const AIAssistantDrawer: React.FC = () => {
  const {
    currentUser,
    tasks,
    users,
    milestones,
    tickets,
    weeklyArchives,
    selectedWeek,
    selectedYear,
    isUserAllowedAI,
    aiPermissions,
  } = useApp();

  const storageKey = useMemo(() => {
    return `saho_ai_chat_history_${currentUser?.account || 'guest'}`;
  }, [currentUser]);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const { hoverScrollProps } = useHoverScrollLock(isOpen);
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([getInitialGreeting(currentUser)]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const canUseAI = isUserAllowedAI(currentUser, 'assistant');
  const isAdmin =
    currentUser?.account?.toLowerCase() === 'admin' ||
    currentUser?.role === 'Admin';

  // Load persistent chat history from localStorage on initial render / account switch
  useEffect(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If the cached conversation only contains the old generic Admin greeting, refresh with the current user's greeting
          if (
            parsed.length === 1 &&
            parsed[0].role === 'model' &&
            (parsed[0].content.includes('Xin chào Admin') || parsed[0].content.includes('Chào Admin'))
          ) {
            setMessages([getInitialGreeting(currentUser)]);
          } else {
            setMessages(parsed);
          }
          return;
        }
      }
      setMessages([getInitialGreeting(currentUser)]);
    } catch (e) {
      console.warn('[AIAssistantDrawer] Failed to load chat history:', e);
      setMessages([getInitialGreeting(currentUser)]);
    }
  }, [storageKey, currentUser]);

  // Save chat history to localStorage whenever messages update
  const updateMessages = (updater: (prev: ChatHistoryMessage[]) => ChatHistoryMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) {
        console.warn('[AIAssistantDrawer] Failed to save chat history:', e);
      }
      return next;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const scrollSuggestions = (direction: 'left' | 'right') => {
    if (suggestionsRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      suggestionsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleSuggestionsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (suggestionsRef.current && e.deltaY !== 0) {
      suggestionsRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const text = (customPrompt || inputValue).trim();
    if (!text || isLoading) return;

    const newHistory: ChatHistoryMessage[] = [
      ...messages,
      { role: 'user', content: text },
    ];

    updateMessages(() => newHistory);
    setInputValue('');
    setIsLoading(true);

    try {
      const weekTasks = (tasks || []).filter((t) => {
        if (!t.weekNumber) return false;
        const w = t.weekNumber <= 53 && (!t.year || t.year === 2026) ? t.weekNumber + 55 : t.weekNumber;
        const targetW = selectedWeek <= 53 && selectedYear === 2026 ? selectedWeek + 55 : selectedWeek;
        return w === targetW;
      });

      let weekDone = 0;
      let weekInProgress = 0;
      let weekTodo = 0;
      let weekActual = 0;
      let weekEst = 0;
      const roleAgg: Record<string, { tasks: number; done: number; actual: number; est: number }> = {};

      weekTasks.forEach((t) => {
        if (t.status === 'Done' || t.completionPercentage === 100) weekDone++;
        else if (t.status === 'In Progress' || (t.completionPercentage && t.completionPercentage > 0)) weekInProgress++;
        else weekTodo++;

        const act = t.actualEffort || 0;
        const est = t.estimatedEffort || 0;
        weekActual += act;
        weekEst += est;

        const r = t.role || 'Other';
        if (!roleAgg[r]) roleAgg[r] = { tasks: 0, done: 0, actual: 0, est: 0 };
        roleAgg[r].tasks++;
        if (t.status === 'Done' || t.completionPercentage === 100) roleAgg[r].done++;
        roleAgg[r].actual += act;
        roleAgg[r].est += est;
      });

      const currentWeekMetrics = {
        totalTasks: weekTasks.length,
        doneTasks: weekDone,
        inProgressTasks: weekInProgress,
        todoTasks: weekTodo,
        completionRate: weekTasks.length > 0 ? Math.round((weekDone / weekTasks.length) * 100) : 0,
        totalActualEffort: Math.round(weekActual * 10) / 10,
        totalEstEffort: Math.round(weekEst * 10) / 10,
        roleStats: Object.keys(roleAgg).map((r) => ({
          role: r,
          total: roleAgg[r].tasks,
          done: roleAgg[r].done,
          actualEffort: Math.round(roleAgg[r].actual * 10) / 10,
          estimatedEffort: Math.round(roleAgg[r].est * 10) / 10,
        })),
      };

      const systemContext = {
        currentUser: currentUser
          ? {
              name: currentUser.name,
              account: currentUser.account,
              role: currentUser.role,
              specializations: currentUser.specializations,
            }
          : undefined,
        currentWeek: selectedWeek,
        currentYear: selectedYear,
        currentWeekMetrics,
        users: (users || [])
          .filter((u) => !u.disabled && u.status !== 'disabled')
          .map((u) => ({
            name: u.name,
            account: u.account,
            role: u.role,
            specializations: u.specializations,
          })),
        milestones: (milestones || []).map((m) => ({
          id: m.id,
          title: m.title,
          role: m.role,
          order: m.order,
        })),
        tasks: (tasks || []).map((t) => ({
          id: t.id,
          title: t.title,
          role: t.role,
          assignee: t.assigneeAccount,
          supporters: t.supporterAccounts,
          week: t.weekNumber,
          pct: t.completionPercentage || 0,
          actualEffort: t.actualEffort || 0,
          estEffort: t.estimatedEffort || 0,
          status: t.status,
          notes: t.notes ? t.notes.substring(0, 200) : undefined,
          startDate: t.startDate,
          endDate: t.endDate,
        })),
        tickets: (tickets || []).slice(0, 20).map((tk) => ({
          id: tk.id,
          code: tk.code,
          title: tk.title,
          toRole: tk.toRole,
          priority: tk.priority,
          status: tk.status,
          fromAccount: tk.fromAccount,
          assignedTo: tk.assignedTo,
        })),
        recentArchives: (weeklyArchives || []).slice(0, 3).map((a) => ({
          week: a.weekNumber,
          year: a.year,
          tasksCount: a.tasksSnapshot?.length || 0,
          doneTasksCount: a.tasksSnapshot?.filter((t) => t.status === 'Done').length || 0,
        })),
      };

      const res = await requestAISystemQuery(text, systemContext, newHistory.slice(0, -1));
      if (res.error) {
        updateMessages((prev) => [
          ...prev,
          { role: 'model', content: `⚠️ **Lỗi kết nối:** ${res.error}` },
        ]);
      } else {
        updateMessages((prev) => [
          ...prev,
          { role: 'model', content: res.reply || 'Không có phản hồi từ AI.' },
        ]);
      }
    } catch (err: any) {
      updateMessages((prev) => [
        ...prev,
        { role: 'model', content: `⚠️ **Lỗi xử lý:** ${err?.message || 'Không thể trao đổi với AI.'}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    const initial = [getInitialGreeting(currentUser)];
    setMessages(initial);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {}
  };

  if (!canUseAI) return null;

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-20 sm:bottom-6 left-4 sm:left-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          title="Trợ Lý AI Dự Án Saho"
          className="group relative flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-2xl shadow-xl shadow-purple-600/30 active:scale-95 transition-all duration-200 cursor-pointer border border-white/20"
        >
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <span className="text-xs font-bold tracking-tight pr-1 hidden sm:inline">
            AI Trợ Lý Dự Án
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-0.5" />
        </button>
      </div>

      {/* Floating Chat Drawer / Popover */}
      {isOpen && (
        <div
          {...hoverScrollProps}
          className={`fixed bottom-36 sm:bottom-20 left-3 sm:left-6 z-50 w-[calc(100vw-1.5rem)] max-h-[82vh] bg-white dark:bg-slate-900 border border-purple-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden overscroll-contain animate-in slide-in-from-bottom-5 fade-in duration-200 transition-all ${
            isExpanded ? 'sm:w-[720px] h-[680px]' : 'sm:w-[480px] h-[580px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-900/95 to-indigo-900/95 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-bold tracking-tight">AI Trợ Lý Dự Án</h4>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Live Data
                  </span>
                </div>
                <p className="text-[10px] text-purple-200 truncate">
                  Đã kết nối dữ liệu Tuần {selectedWeek}/{selectedYear}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Thu nhỏ cửa sổ' : 'Mở rộng toàn màn hình'}
                className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer hidden sm:flex"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleClearHistory}
                title="Xóa lịch sử chat"
                className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Đóng cửa sổ"
                className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 bg-slate-50/60 dark:bg-slate-950/60 text-xs overscroll-contain">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'model' && (
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 leading-relaxed break-words shadow-xs ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs font-medium'
                      : 'bg-white dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-bl-xs'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <AIChatMessageContent content={msg.content} />
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 justify-start items-center">
                <div className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shadow-xs text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-ping" />
                  <span>AI đang truy vấn database & phân tích...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips with Navigation Buttons and Mouse Wheel Scrolling */}
          <div className="relative group/suggestions px-2 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollSuggestions('left')}
              title="Cuộn sang trái"
              className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-slate-600 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 border border-slate-200 dark:border-slate-700 shrink-0 transition cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div
              ref={suggestionsRef}
              onWheel={handleSuggestionsWheel}
              className="flex-1 overflow-x-auto flex items-center gap-1.5 py-1 px-1 scroll-smooth select-none"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(168, 85, 247, 0.3) transparent',
              }}
            >
              {SUGGESTION_PROMPTS.map((promptText, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSendMessage(promptText)}
                  className="whitespace-nowrap shrink-0 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50 rounded-xl text-[11px] font-medium transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {promptText}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollSuggestions('right')}
              title="Cuộn sang phải"
              className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-slate-600 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 border border-slate-200 dark:border-slate-700 shrink-0 transition cursor-pointer shadow-2xs"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shrink-0 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              placeholder="Hỏi về task, tiến độ, member, rủi ro..."
              className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
