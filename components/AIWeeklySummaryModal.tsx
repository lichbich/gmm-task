'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { useApp } from '../context/AppContext';
import { Task, formatDateOnlyDisplay, getTodayDateOnlyString } from '../types/task';
import {
  requestAIWeeklySummary,
  WeeklySummaryRequestData,
  fetchSavedWeeklySummary,
  saveWeeklySummaryToDb,
  StoredWeeklySummary,
} from '../lib/geminiService';
import {
  Sparkles,
  X,
  Copy,
  Check,
  Download,
  RotateCw,
  AlertTriangle,
  Layers,
  Clock,
  TrendingUp,
  Award,
  CheckCircle2,
  CircleDashed,
  ArrowRight,
  ShieldAlert,
  Target,
  BarChart3,
  Eye,
  Code2,
  Info,
  Calendar,
  Database,
  Lightbulb,
  Zap,
  FileText,
} from 'lucide-react';
import { generateWeeklySummaryDocxBlob } from '../lib/docxExportHelper';

interface AIWeeklySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekNumber: number;
  year: number;
  tasks: Task[];
}

/** Helper to render inline bold, code, roles, bracket tags, and italic cleanly */
function renderInlineFormatted(text: string) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    const italicMatch = remaining.match(/\*(.*?)\*/);
    const codeMatch = remaining.match(/`(.*?)`/);
    const bracketMatch = remaining.match(/\[(.*?)\]/);

    const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
    const codeIndex = codeMatch ? remaining.indexOf(codeMatch[0]) : -1;
    const bracketIndex = bracketMatch ? remaining.indexOf(bracketMatch[0]) : -1;

    let matchType: 'bold' | 'code' | 'bracket' | 'none' = 'none';
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

    if (matchType === 'none') {
      if (italicMatch && remaining.indexOf(italicMatch[0]) !== -1) {
        const itIndex = remaining.indexOf(italicMatch[0]);
        if (itIndex > 0) {
          parts.push(remaining.substring(0, itIndex));
        }
        parts.push(
          <em key={key++} className="italic text-slate-700 dark:text-slate-100 font-medium">
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
        roleBadgeClass = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/80';
      } else if (lower === 'fe' || lower.includes('frontend')) {
        roleBadgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700/80';
      } else if (lower.includes('design')) {
        roleBadgeClass = 'bg-pink-50 text-pink-700 dark:bg-pink-950/80 dark:text-pink-200 border-pink-200 dark:border-pink-700/80';
      } else if (lower.includes('test') || lower === 'qc' || lower === 'qa') {
        roleBadgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border-amber-200 dark:border-amber-700/80';
      } else if (lower === 'ba' || lower.includes('analyst') || lower.includes('product')) {
        roleBadgeClass = 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700/80';
      } else if (lower.includes('devops') || lower.includes('infra')) {
        roleBadgeClass = 'bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-200 border-purple-200 dark:border-purple-700/80';
      } else if (lower.includes('pm') || lower.includes('po') || lower.includes('sa')) {
        roleBadgeClass = 'bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-200 border-blue-200 dark:border-blue-700/80';
      }

      if (roleBadgeClass) {
        parts.push(
          <span
            key={key++}
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${roleBadgeClass} mr-1.5`}
          >
            {boldContent}
          </span>
        );
      } else {
        parts.push(
          <strong key={key++} className="font-bold text-slate-900 dark:text-white">
            {boldContent}
          </strong>
        );
      }
      remaining = remaining.substring(firstIndex + boldMatch[0].length);
    } else if (matchType === 'code' && codeMatch) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-200 font-mono text-[11px] border border-purple-200 dark:border-purple-700"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.substring(firstIndex + codeMatch[0].length);
    } else if (matchType === 'bracket' && bracketMatch) {
      const inner = bracketMatch[1].trim();
      const lower = inner.toLowerCase();

      if (['fe', 'be', 'ba', 'qa', 'qc', 'designer', 'design', 'devops', 'pm', 'po', 'sa'].includes(lower)) {
        let roleBadgeClass = 'bg-slate-500/10 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700';
        if (lower === 'be') roleBadgeClass = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700/80';
        else if (lower === 'fe') roleBadgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700/80';
        else if (lower.includes('design')) roleBadgeClass = 'bg-pink-50 text-pink-700 dark:bg-pink-950/80 dark:text-pink-200 border-pink-200 dark:border-pink-700/80';
        else if (lower === 'ba') roleBadgeClass = 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700/80';
        else if (lower === 'qa' || lower === 'qc') roleBadgeClass = 'bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border-amber-200 dark:border-amber-700/80';
        
        parts.push(
          <span
            key={key++}
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${roleBadgeClass} mr-1.5`}
          >
            {inner.toUpperCase()}
          </span>
        );
      } else if (lower.includes('quá hạn')) {
        parts.push(
          <span
            key={key++}
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-200 border border-rose-200 dark:border-rose-700/80 mr-1"
          >
            {inner}
          </span>
        );
      } else if (lower.includes('trong hạn') || lower.includes('đang trong hạn')) {
        parts.push(
          <span
            key={key++}
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700/80 mr-1"
          >
            {inner}
          </span>
        );
      } else if (lower.includes('kéo dài') || lower.includes('tồn đọng') || lower.includes('tuần ')) {
        parts.push(
          <span
            key={key++}
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-200 dark:border-amber-700/80 mr-1"
          >
            {inner}
          </span>
        );
      } else {
        parts.push(
          <span key={key++} className="font-semibold text-slate-700 dark:text-slate-100">
            [{inner}]
          </span>
        );
      }
      remaining = remaining.substring(firstIndex + bracketMatch[0].length);
    }
  }

  return parts;
}

/** Component to render structured sections from markdown */
const FormattedMarkdownReport: React.FC<{ markdownText: string }> = ({ markdownText }) => {
  const sections = useMemo(() => {
    if (!markdownText) return [];

    const lines = markdownText.split('\n');
    const parsedSections: Array<{
      title: string;
      type: 'overview' | 'highlights' | 'inprogress' | 'risks' | 'actions' | 'general';
      icon: any;
      headerBg: string;
      borderColor: string;
      items: string[];
    }> = [];

    let currentSection: {
      title: string;
      type: 'overview' | 'highlights' | 'inprogress' | 'risks' | 'actions' | 'general';
      icon: any;
      headerBg: string;
      borderColor: string;
      items: string[];
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Ignore title, horizontal rules, and conversational preambles
      if (
        line === '---' ||
        line === '***' ||
        line === '___' ||
        line.startsWith('# ') ||
        line.toLowerCase().startsWith('ngày báo cáo:') ||
        line.toLowerCase().startsWith('tuyệt vời!') ||
        line.toLowerCase().startsWith('với vai trò')
      ) {
        continue;
      }

      // Detect Section Heading (H2, H3, ###)
      if (
        line.startsWith('### ') ||
        line.startsWith('## ') ||
        (line.startsWith('**') &&
          line.endsWith('**') &&
          (line.includes('1.') || line.includes('2.') || line.includes('3.') || line.includes('4.') || line.includes('5.')))
      ) {
        if (currentSection && currentSection.items.length > 0) {
          parsedSections.push({ ...currentSection });
        }

        const rawTitle = line.replace(/^[#*]+\s*/, '').replace(/\*+$/, '').trim();
        const lower = rawTitle.toLowerCase();

        if (lower.includes('1.') || lower.includes('tổng quan') || lower.includes('hiệu suất')) {
          currentSection = {
            title: rawTitle,
            type: 'overview',
            icon: BarChart3,
            headerBg: 'bg-blue-50/90 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200',
            borderColor: 'border-blue-200 dark:border-blue-800/80',
            items: [],
          };
        } else if (lower.includes('2.') || lower.includes('kết quả') || lower.includes('nổi bật') || lower.includes('hoàn thành')) {
          currentSection = {
            title: rawTitle,
            type: 'highlights',
            icon: Award,
            headerBg: 'bg-emerald-50/90 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200',
            borderColor: 'border-emerald-200 dark:border-emerald-800/80',
            items: [],
          };
        } else if (lower.includes('3.') || lower.includes('đang làm') || lower.includes('triển khai') || lower.includes('chuyển tiếp') || lower.includes('rollover')) {
          currentSection = {
            title: rawTitle,
            type: 'inprogress',
            icon: Clock,
            headerBg: 'bg-amber-50/90 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200',
            borderColor: 'border-amber-200 dark:border-amber-800/80',
            items: [],
          };
        } else if (lower.includes('4.') || lower.includes('điểm nghẽn') || lower.includes('rủi ro') || lower.includes('blocker')) {
          currentSection = {
            title: rawTitle,
            type: 'risks',
            icon: ShieldAlert,
            headerBg: 'bg-rose-50/90 text-rose-900 dark:bg-rose-950/80 dark:text-rose-200',
            borderColor: 'border-rose-200 dark:border-rose-800/80',
            items: [],
          };
        } else if (lower.includes('5.') || lower.includes('đề xuất') || lower.includes('hành động') || lower.includes('kế hoạch')) {
          currentSection = {
            title: rawTitle,
            type: 'actions',
            icon: Target,
            headerBg: 'bg-purple-50/90 text-purple-900 dark:bg-purple-950/80 dark:text-purple-200',
            borderColor: 'border-purple-200 dark:border-purple-800/80',
            items: [],
          };
        } else {
          currentSection = {
            title: rawTitle,
            type: 'general',
            icon: Info,
            headerBg: 'bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
            borderColor: 'border-slate-200 dark:border-slate-800',
            items: [],
          };
        }
        continue;
      }

      if (currentSection) {
        currentSection.items.push(line);
      }
    }

    if (currentSection && currentSection.items.length > 0) {
      parsedSections.push(currentSection);
    }

    return parsedSections;
  }, [markdownText]);

  if (sections.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 dark:text-slate-400">
        Chưa có nội dung báo cáo.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((sec, idx) => {
        const IconComponent = sec.icon;
        return (
          <div
            key={idx}
            className={`rounded-2xl border ${sec.borderColor} bg-white dark:bg-slate-900/95 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md`}
          >
            {/* Section Header */}
            <div className={`px-4 py-3 flex items-center justify-between border-b ${sec.borderColor} ${sec.headerBg}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/90 dark:bg-slate-900/90 shadow-xs flex items-center justify-center">
                  <IconComponent className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold tracking-tight">
                  {sec.title}
                </h4>
              </div>
            </div>

            {/* Section Content */}
            <div className="p-4 sm:p-5 space-y-3 text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-100">
              {sec.items.map((item, itemIdx) => {
                const trimmed = item.trim();
                if (trimmed === '---' || trimmed === '***' || trimmed === '___') return null;

                const isTaskDone = /^(\*|\-)?\s*\[[xXvV]\]/.test(trimmed);
                const isTaskPending = /^(\*|\-)?\s*\[\s*\]/.test(trimmed);
                const isBullet = /^(\*|\-)\s+/.test(trimmed);
                const isNumbered = /^\d+\.\s+/.test(trimmed);
                const isExplanationSubLine = /^(\*|\-)?\s*(➔|->)\s*/.test(trimmed) || /^\s*(➔|->)\s*/.test(trimmed);
                const isExecutiveCallout =
                  sec.type === 'overview' &&
                  (trimmed.includes('💡') ||
                    trimmed.toLowerCase().includes('lưu ý nổi bật') ||
                    trimmed.toLowerCase().includes('điểm cốt lõi') ||
                    trimmed.toLowerCase().includes('trọng tâm:'));

                // Strip leading markdown prefixes
                const cleanText = trimmed
                  .replace(/^(\*|\-)?\s*\[[xXvV\s]\]\s*/, '')
                  .replace(/^(\*|\-|\d+\.)\s+/, '')
                  .replace(/^(\*|\-)?\s*(➔|->)\s*/, '')
                  .trim();

                // 1. Executive Callout Note in Section 1
                if (isExecutiveCallout) {
                  return (
                    <div
                      key={itemIdx}
                      className="mt-2 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/90 dark:from-blue-950/70 dark:via-indigo-950/60 dark:to-purple-950/70 border border-blue-200/90 dark:border-blue-700/80 text-blue-950 dark:text-blue-100 flex items-start gap-3 shadow-xs"
                    >
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="flex-1 text-xs sm:text-sm leading-relaxed font-medium">
                        {renderInlineFormatted(cleanText)}
                      </div>
                    </div>
                  );
                }

                // 2. Standalone Sub-explanation line (e.g. ➔ Nguyên nhân & Hướng xử lý: ...)
                if (isExplanationSubLine) {
                  return (
                    <div
                      key={itemIdx}
                      className="ml-6 -mt-1.5 mb-1 p-2.5 sm:p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/60 border border-amber-200/90 dark:border-amber-700/80 text-xs sm:text-[13px] text-amber-950 dark:text-amber-100 flex items-start gap-2 shadow-2xs"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                      <div className="flex-1 leading-relaxed text-slate-800 dark:text-amber-100 font-medium">
                        {renderInlineFormatted(cleanText)}
                      </div>
                    </div>
                  );
                }

                // 3. Task Done item
                if (isTaskDone || (sec.type === 'highlights' && isBullet)) {
                  return (
                    <div
                      key={itemIdx}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-50/50 dark:bg-slate-950/60 border border-emerald-100 dark:border-emerald-800/60 text-slate-800 dark:text-slate-100"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1 text-slate-800 dark:text-slate-100">
                        {renderInlineFormatted(cleanText)}
                      </div>
                    </div>
                  );
                }

                // 4. Task Pending / Rollover item in Section 3
                if (isTaskPending || (sec.type === 'inprogress' && isBullet)) {
                  const hasInlineArrow = cleanText.includes(' ➔ ') || cleanText.includes(' -> ');
                  if (hasInlineArrow) {
                    const arrowSplit = cleanText.split(/\s+(?:➔|->)\s+/);
                    const taskHeader = arrowSplit[0];
                    const taskReason = arrowSplit.slice(1).join(' - ');

                    return (
                      <div key={itemIdx} className="space-y-1.5">
                        <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/50 dark:bg-slate-950/60 border border-amber-100 dark:border-amber-800/60 text-slate-800 dark:text-slate-100 font-medium">
                          <CircleDashed className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="flex-1 text-slate-800 dark:text-slate-100 font-medium">
                            {renderInlineFormatted(taskHeader)}
                          </div>
                        </div>
                        {taskReason && (
                          <div className="ml-6 p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/60 border border-amber-200/90 dark:border-amber-700/80 text-xs sm:text-[13px] text-amber-950 dark:text-amber-100 flex items-start gap-2 shadow-2xs">
                            <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                            <div className="flex-1 leading-relaxed text-slate-800 dark:text-amber-100 font-medium">
                              {renderInlineFormatted(taskReason)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={itemIdx}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/50 dark:bg-slate-950/60 border border-amber-100 dark:border-amber-800/60 text-slate-800 dark:text-slate-100 font-medium"
                    >
                      <CircleDashed className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 text-slate-800 dark:text-slate-100">
                        {renderInlineFormatted(cleanText)}
                      </div>
                    </div>
                  );
                }

                // 5. Bullet Point with styling based on section type
                if (isBullet) {
                  return (
                    <div key={itemIdx} className="flex items-start gap-2.5 pl-1">
                      {sec.type === 'risks' ? (
                        <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                      ) : sec.type === 'actions' ? (
                        <ArrowRight className="w-4 h-4 text-purple-500 dark:text-purple-400 shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
                      )}
                      <div className="flex-1 text-slate-800 dark:text-slate-100">
                        {renderInlineFormatted(cleanText)}
                      </div>
                    </div>
                  );
                }

                // 6. Numbered list item
                if (isNumbered) {
                  const numMatch = trimmed.match(/^(\d+)\.\s+/);
                  const numStr = numMatch ? numMatch[1] : `${itemIdx + 1}`;
                  return (
                    <div key={itemIdx} className="flex items-start gap-2.5 pl-1">
                      <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-200 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        {numStr}
                      </span>
                      <div className="flex-1 text-slate-800 dark:text-slate-100">
                        {renderInlineFormatted(cleanText)}
                      </div>
                    </div>
                  );
                }

                // 7. Paragraph / Subheading
                return (
                  <p key={itemIdx} className="leading-relaxed text-slate-800 dark:text-slate-100">
                    {renderInlineFormatted(trimmed)}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const AIWeeklySummaryModal: React.FC<AIWeeklySummaryModalProps> = ({
  isOpen,
  onClose,
  weekNumber,
  year,
  tasks,
}) => {
  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } =
    useModalAnimation(isOpen, onClose);

  const { tickets, currentUser } = useApp();
  const [summaryText, setSummaryText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'visual' | 'markdown'>('visual');
  const [savedMeta, setSavedMeta] = useState<{ updatedAt?: number; author?: string; tasksCount?: number } | null>(null);

  // Compute actual week tasks & KPI metrics directly from real data
  const {
    targetTasks,
    totalTasksCount,
    doneCount,
    inProgressCount,
    todoCount,
    completionRate,
    totalActualEffort,
    totalEstEffort,
  } = useMemo(() => {
    const list = tasks.filter((t) => {
      if (!t.weekNumber) return false;
      const w = t.weekNumber <= 53 && (!t.year || t.year === 2026) ? t.weekNumber + 55 : t.weekNumber;
      const targetW = weekNumber <= 53 && year === 2026 ? weekNumber + 55 : weekNumber;
      return w === targetW;
    });

    let done = 0;
    let inProgress = 0;
    let todo = 0;
    let actual = 0;
    let est = 0;

    list.forEach((t) => {
      if (t.status === 'Done' || t.completionPercentage === 100) done++;
      else if (t.status === 'In Progress' || (t.completionPercentage && t.completionPercentage > 0)) inProgress++;
      else todo++;

      actual += t.actualEffort || 0;
      est += t.estimatedEffort || 0;
    });

    const rate = list.length > 0 ? Math.round((done / list.length) * 100) : 0;

    return {
      targetTasks: list,
      totalTasksCount: list.length,
      doneCount: done,
      inProgressCount: inProgress,
      todoCount: todo,
      completionRate: rate,
      totalActualEffort: Math.round(actual * 10) / 10,
      totalEstEffort: Math.round(est * 10) / 10,
    };
  }, [tasks, weekNumber, year]);

  // Generate or Regenerate Weekly Summary via AI and Save to DB
  const handleGenerateSummary = useCallback(
    async (isManualRefresh: boolean = false) => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Prepare current week tasks with rollover context & deadline tracking
        const currentWeekTasks = targetTasks.map((t) => {
          const rootId = t.parentTaskId || t.id;
          const titleLower = (t.title || '').trim().toLowerCase();
          const assigneeLower = (t.assigneeAccount || '').trim().toLowerCase();
          const roleLower = (t.role || '').trim().toLowerCase();

          // Find all matching instances across all weeks in tasks
          const matchingWeeks = new Set<number>();
          tasks.forEach((ot) => {
            const isMatch =
              ot.parentTaskId === rootId ||
              ot.id === rootId ||
              (t.parentTaskId && (ot.parentTaskId === t.parentTaskId || ot.id === t.parentTaskId)) ||
              (ot.title?.trim().toLowerCase() === titleLower &&
                (ot.assigneeAccount || '').trim().toLowerCase() === assigneeLower &&
                (ot.role || '').trim().toLowerCase() === roleLower);

            if (isMatch && ot.weekNumber) {
              matchingWeeks.add(ot.weekNumber);
            }
          });
          matchingWeeks.add(weekNumber);

          const sortedWeeks = Array.from(matchingWeeks).sort((a, b) => a - b);
          const rolloverWeeksCount = sortedWeeks.length;
          const isRollover = rolloverWeeksCount > 1;
          const rolloverHistory = isRollover
            ? `Kéo dài qua ${rolloverWeeksCount} tuần (Tuần ${sortedWeeks.join(' ➔ Tuần ')})`
            : `Bắt đầu trong tuần ${weekNumber}`;

          // Calculate deadline status
          let deadlineStr = '';
          let deadlineStatus = 'Chưa đặt deadline';
          if (t.endDate) {
            deadlineStr = formatDateOnlyDisplay(t.endDate);
            const todayIso = getTodayDateOnlyString();
            if (t.endDate < todayIso && (t.completionPercentage || 0) < 100 && t.status !== 'Done') {
              deadlineStatus = `Đã quá hạn (Hạn chót: ${deadlineStr})`;
            } else {
              deadlineStatus = `Trong hạn (Hạn chót: ${deadlineStr})`;
            }
          }

          return {
            id: t.id,
            title: t.title,
            role: t.role,
            assigneeAccount: t.assigneeAccount,
            completionPercentage: t.completionPercentage || 0,
            actualEffort: t.actualEffort || 0,
            estimatedEffort: t.estimatedEffort || 0,
            status: t.status,
            notes: t.notes ? t.notes.substring(0, 400) : undefined,
            startDate: t.startDate,
            endDate: t.endDate,
            deadline: deadlineStr || undefined,
            deadlineStatus,
            rolloverWeeksCount,
            rolloverHistory,
            isRollover,
          };
        });

        // 2. Compute Role-level stats
        const roleMap: Record<string, { total: number; done: number; inProgress: number; actual: number; est: number }> = {};
        targetTasks.forEach((t) => {
          const r = t.role || 'Other';
          if (!roleMap[r]) roleMap[r] = { total: 0, done: 0, inProgress: 0, actual: 0, est: 0 };
          roleMap[r].total += 1;
          if (t.status === 'Done' || t.completionPercentage === 100) roleMap[r].done += 1;
          else if (t.status === 'In Progress' || (t.completionPercentage && t.completionPercentage > 0)) roleMap[r].inProgress += 1;
          roleMap[r].actual += t.actualEffort || 0;
          roleMap[r].est += t.estimatedEffort || 0;
        });

        const roleStats = Object.keys(roleMap).map((r) => ({
          role: r,
          totalTasks: roleMap[r].total,
          doneTasks: roleMap[r].done,
          inProgressTasks: roleMap[r].inProgress,
          actualEffort: Math.round(roleMap[r].actual * 10) / 10,
          estimatedEffort: Math.round(roleMap[r].est * 10) / 10,
        }));

        // 3. Compute Member-level stats
        const memberMap: Record<string, { role: string; total: number; done: number; inProgress: number; actual: number; est: number }> = {};
        targetTasks.forEach((t) => {
          const acc = t.assigneeAccount || 'Unassigned';
          if (!memberMap[acc]) memberMap[acc] = { role: t.role || 'Other', total: 0, done: 0, inProgress: 0, actual: 0, est: 0 };
          memberMap[acc].total += 1;
          if (t.status === 'Done' || t.completionPercentage === 100) memberMap[acc].done += 1;
          else if (t.status === 'In Progress' || (t.completionPercentage && t.completionPercentage > 0)) memberMap[acc].inProgress += 1;
          memberMap[acc].actual += t.actualEffort || 0;
          memberMap[acc].est += t.estimatedEffort || 0;
        });

        const memberStats = Object.keys(memberMap).map((acc) => ({
          account: acc,
          role: memberMap[acc].role,
          totalTasks: memberMap[acc].total,
          doneTasks: memberMap[acc].done,
          inProgressTasks: memberMap[acc].inProgress,
          actualEffort: Math.round(memberMap[acc].actual * 10) / 10,
          estimatedEffort: Math.round(memberMap[acc].est * 10) / 10,
        })).sort((a, b) => b.actualEffort - a.actualEffort);

        // 4. Overdue tasks
        const overdueTasks = currentWeekTasks
          .filter((t) => t.deadlineStatus?.startsWith('Đã quá hạn'))
          .map((t) => ({
            title: t.title,
            role: t.role,
            assigneeAccount: t.assigneeAccount,
            deadline: t.deadline,
            completionPercentage: t.completionPercentage,
          }));

        // 5. Prepare tickets summary
        const ticketsSummary = (tickets || []).slice(0, 15).map((tk) => ({
          id: tk.id,
          code: tk.code,
          title: tk.title,
          toRole: tk.toRole,
          priority: tk.priority,
          status: tk.status,
          fromAccount: tk.fromAccount,
          assignedTo: tk.assignedTo,
        }));

        const overallStats = {
          totalTasks: totalTasksCount,
          doneTasks: doneCount,
          inProgressTasks: inProgressCount,
          todoCount: todoCount,
          todoTasks: todoCount,
          completionRate,
          totalActualEffort,
          totalEstEffort,
        };

        const requestPayload: WeeklySummaryRequestData = {
          weekNumber,
          year,
          overallStats,
          tasksSummary: currentWeekTasks,
          ticketsSummary,
          roleStats,
          memberStats,
          overdueTasks,
        };

        const result = await requestAIWeeklySummary(requestPayload);
        if (result.error) {
          setError(result.error);
        } else {
          setSummaryText(result.summary);
          const author = currentUser?.account || 'admin';
          const now = Date.now();
          setSavedMeta({ updatedAt: now, author, tasksCount: targetTasks.length });
          // Save to Firebase Realtime Database
          await saveWeeklySummaryToDb(weekNumber, year, result.summary, author, targetTasks.length);
        }
      } catch (err: any) {
        setError(err?.message || 'Đã xảy ra lỗi khi tạo bản tổng hợp.');
      } finally {
        setIsLoading(false);
      }
    },
    [
      targetTasks,
      tasks,
      tickets,
      weekNumber,
      year,
      currentUser,
      totalTasksCount,
      doneCount,
      inProgressCount,
      todoCount,
      completionRate,
      totalActualEffort,
      totalEstEffort,
    ]
  );

  // When modal opens: Check Firebase DB first. If found, load in 0ms!
  useEffect(() => {
    let isCancelled = false;

    async function loadInitialReport() {
      if (!isOpen) return;

      setIsLoading(true);
      setError(null);

      try {
        const cached = await fetchSavedWeeklySummary(weekNumber, year);
        if (isCancelled) return;

        if (cached && cached.summary) {
          setSummaryText(cached.summary);
          setSavedMeta({
            updatedAt: cached.updatedAt || cached.createdAt,
            author: cached.generatedBy || 'admin',
            tasksCount: cached.tasksCount,
          });
          setIsLoading(false);
          return;
        }

        // Not cached yet -> Generate from AI
        await handleGenerateSummary(false);
      } catch (e: any) {
        if (!isCancelled) {
          setError(e?.message || 'Không thể tải báo cáo.');
          setIsLoading(false);
        }
      }
    }

    loadInitialReport();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, weekNumber, year, handleGenerateSummary]);

  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);

  const handleCopy = () => {
    if (!summaryText) return;
    navigator.clipboard.writeText(summaryText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadDocx = async () => {
    if (!summaryText || isExportingDocx) return;
    setIsExportingDocx(true);
    try {
      const blob = await generateWeeklySummaryDocxBlob({
        weekNumber,
        year,
        author: savedMeta?.author || currentUser?.account || 'Admin',
        totalTasksCount,
        doneCount,
        inProgressCount,
        todoCount,
        completionRate,
        totalActualEffort,
        totalEstEffort,
        summaryText,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Bao_Cao_Tong_Hop_Tuan_${weekNumber}_${year}.docx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Error exporting docx:', e);
      alert('Không thể tạo file Word (.docx): ' + (e?.message || 'Vui lòng thử lại.'));
    } finally {
      setIsExportingDocx(false);
    }
  };

  const formattedSavedTime = useMemo(() => {
    if (!savedMeta?.updatedAt) return null;
    const d = new Date(savedMeta.updatedAt);
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${timeStr} ngày ${dateStr}`;
  }, [savedMeta]);

  if (!isRendered) return null;

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={`fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-2 sm:p-4 modal-backdrop-transition overflow-y-auto backdrop-blur-xs ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        className={`bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-slate-800 dark:text-slate-100 relative overflow-hidden modal-dialog-transition ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Báo Cáo Tổng Hợp Tuần {weekNumber}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-purple-500/10 to-indigo-500/10 text-purple-700 dark:text-purple-300 border border-purple-300/60 dark:border-purple-700/60">
                  AI Multi-Engine
                </span>
                {formattedSavedTime && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Đã lưu ({formattedSavedTime})</span>
                  </span>
                )}
                {savedMeta?.tasksCount !== undefined && savedMeta.tasksCount !== totalTasksCount && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Dữ liệu có cập nhật mới ({totalTasksCount} task so với {savedMeta.tasksCount} lúc lưu)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Năm {year}</span>
                <span>•</span>
                <span>{totalTasksCount} đầu việc trong tuần</span>
                {savedMeta?.author && (
                  <>
                    <span>•</span>
                    <span>Tạo bởi: @{savedMeta.author}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="hidden sm:flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('visual')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'visual'
                    ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Trực quan</span>
              </button>
              <button
                onClick={() => setViewMode('markdown')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'markdown'
                    ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Markdown</span>
              </button>
            </div>

            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition active:scale-95 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain space-y-5">
          {/* Quick Metrics KPI Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Card 1: Total Tasks */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-300">
                <span className="text-[11px] font-bold uppercase tracking-wider">Tổng Task</span>
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {totalTasksCount}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">task</span>
              </div>
            </div>

            {/* Card 2: Done Tasks */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-300">
                <span className="text-[11px] font-bold uppercase tracking-wider">Hoàn thành</span>
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {doneCount}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600/90 dark:text-emerald-300">
                    ({completionRate}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 dark:bg-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, completionRate)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 3: In Progress & Todo */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-300">
                <span className="text-[11px] font-bold uppercase tracking-wider">Đang làm / Chờ</span>
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <div>
                  <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                    {inProgressCount}
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-300 font-semibold ml-0.5">đang làm</span>
                </div>
                <span className="text-xs text-slate-300 dark:text-slate-600">•</span>
                <div>
                  <span className="text-base font-bold text-slate-600 dark:text-slate-200">
                    {todoCount}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium ml-0.5">to do</span>
                </div>
              </div>
            </div>

            {/* Card 4: Effort */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-300">
                <span className="text-[11px] font-bold uppercase tracking-wider">Giờ Thực Tế</span>
                <div className="w-6 h-6 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400">
                  {totalActualEffort}h
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">
                  / {totalEstEffort}h ước tính
                </span>
              </div>
            </div>
          </div>

          {/* Report Body */}
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4 text-center bg-white dark:bg-slate-800/60 rounded-3xl border border-slate-200/80 dark:border-slate-800">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-xl shadow-purple-500/25 animate-bounce">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="absolute inset-0 rounded-2xl border-2 border-purple-400 animate-ping opacity-30" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  AI đang đối soát và phân tích tiến độ tuần {weekNumber}...
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                  Đang phân tích {totalTasksCount} task, tổng hợp năng suất theo Role và nhận diện điểm nghẽn.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Không thể tạo bản tổng hợp báo cáo
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  {error.startsWith('{') && error.includes('message')
                    ? 'Máy chủ AI đang có lượng truy cập cao tạm thời. Vui lòng bấm nút "Thử lại" bên dưới.'
                    : error}
                </p>
                <button
                  onClick={() => handleGenerateSummary(true)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow-sm transition active:scale-95 cursor-pointer"
                >
                  Thử lại ngay
                </button>
              </div>
            </div>
          ) : viewMode === 'visual' ? (
            <FormattedMarkdownReport markdownText={summaryText} />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {summaryText}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <button
            onClick={() => handleGenerateSummary(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-xl transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Phân tích lại</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadDocx}
              disabled={!summaryText || isLoading || isExportingDocx}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{isExportingDocx ? 'Đang tạo .docx...' : 'Tải file .docx'}</span>
            </button>

            <button
              onClick={handleCopy}
              disabled={!summaryText || isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-md shadow-purple-600/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Đã sao chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép báo cáo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
