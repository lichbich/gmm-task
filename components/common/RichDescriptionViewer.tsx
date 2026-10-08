'use client';

import React, { useState } from 'react';
import { DecryptedImage } from './DecryptedImage';
import { CheckSquare, Square, Copy, Check, Code as CodeIcon } from 'lucide-react';

interface RichDescriptionViewerProps {
  content: string;
  className?: string;
  onPreviewImage?: (url: string) => void;
  onToggleCheckbox?: (lineIndex: number, newChecked: boolean) => void;
  allowToggleCheckboxes?: boolean;
}

const MARKDOWN_IMAGE_REGEX = /^!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)$/;
const CATBOX_URL_REGEX = /^https?:\/\/files\.catbox\.moe\/[a-zA-Z0-9._-]+$/i;
const IMAGE_EXTENSION_REGEX = /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i;

/**
 * Parses and renders inline markdown formatting (bold, italic, underline, strikethrough, highlight, code)
 */
export const renderInlineFormatting = (text: string): React.ReactNode => {
  if (!text) return null;

  // Split on bold, italic, underline, strikethrough, highlight, inline code
  // **bold**, *italic*, <u>underline</u>, ~~strike~~, <mark>highlight</mark>, ==highlight==, `code`
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|<u>.*?<\/u>|~~.*?~~|<mark>.*?<\/mark>|==[^=]+==|`[^`]+`)/gi;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Bold **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="font-bold text-slate-900 dark:text-white">
          {renderInlineFormatting(part.substring(2, part.length - 2))}
        </strong>
      );
    }

    // Italic *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={idx} className="italic text-slate-800 dark:text-slate-200">
          {renderInlineFormatting(part.substring(1, part.length - 1))}
        </em>
      );
    }

    // Underline <u>text</u>
    const uMatch = part.match(/^<u>(.*?)<\/u>$/i);
    if (uMatch) {
      return (
        <span key={idx} className="underline decoration-indigo-400 underline-offset-2">
          {renderInlineFormatting(uMatch[1])}
        </span>
      );
    }

    // Strikethrough ~~text~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
      return (
        <del key={idx} className="line-through text-slate-400 dark:text-slate-500">
          {renderInlineFormatting(part.substring(2, part.length - 2))}
        </del>
      );
    }

    // Highlight <mark>text</mark> or ==text==
    const markMatch = part.match(/^<mark>(.*?)<\/mark>$/i);
    if (markMatch) {
      return (
        <mark
          key={idx}
          className="bg-amber-200/90 dark:bg-amber-900/60 text-slate-900 dark:text-amber-100 px-1 py-0.5 rounded-sm font-medium"
        >
          {renderInlineFormatting(markMatch[1])}
        </mark>
      );
    }
    if (part.startsWith('==') && part.endsWith('==') && part.length >= 4) {
      return (
        <mark
          key={idx}
          className="bg-amber-200/90 dark:bg-amber-900/60 text-slate-900 dark:text-amber-100 px-1 py-0.5 rounded-sm font-medium"
        >
          {renderInlineFormatting(part.substring(2, part.length - 2))}
        </mark>
      );
    }

    // Inline code `text`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] border border-slate-200/80 dark:border-slate-700 font-semibold"
        >
          {part.substring(1, part.length - 1)}
        </code>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
};

export const CodeBlockViewer: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(console.error);
    }
  };

  return (
    <div className="code-block-container my-2.5 rounded-xl border border-slate-750 bg-slate-900 text-slate-100 dark:bg-slate-950 shadow-md overflow-hidden font-mono text-[11.5px] selection:bg-indigo-600 selection:text-white">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-800/90 dark:bg-slate-900/90 border-b border-slate-700/70 text-[10.5px] text-slate-400 select-none">
        <span className="font-semibold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
          <CodeIcon className="w-3.5 h-3.5" />
          {language || 'Code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-[10px] font-sans"
          title="Sao chép toàn bộ mã"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-block-content p-3.5 overflow-x-auto custom-scrollbar leading-relaxed text-slate-100 font-mono selection:bg-indigo-600 selection:text-white">
        <code className="font-mono text-slate-100 selection:bg-indigo-600 selection:text-white">{code}</code>
      </pre>
    </div>
  );
};

export const RichDescriptionViewer: React.FC<RichDescriptionViewerProps> = ({
  content,
  className = '',
  onPreviewImage,
  onToggleCheckbox,
  allowToggleCheckboxes = false,
}) => {
  if (!content || !content.trim()) {
    return <span className="text-slate-400 dark:text-slate-500 italic text-xs">Chưa có mô tả chi tiết.</span>;
  }

  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Explicit fenced code block: ```[language] ... ```
    if (trimmed.startsWith('```')) {
      const language = trimmed.substring(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++; // skip closing ```
      }
      renderedElements.push(
        <CodeBlockViewer
          key={`code-block-${renderedElements.length}`}
          code={codeLines.join('\n')}
          language={language}
        />
      );
      continue;
    }

    // 2. Intelligent detection of consecutive lines that are each wrapped entirely in `...`
    // (e.g. user pasted multi-line code and each line got wrapped with inline backticks)
    if (
      trimmed.startsWith('`') &&
      trimmed.endsWith('`') &&
      trimmed.length >= 2 &&
      !trimmed.slice(1, -1).includes('`') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith('`') &&
      lines[i + 1].trim().endsWith('`')
    ) {
      const consecutiveCodeLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim().startsWith('`') &&
        lines[i].trim().endsWith('`') &&
        lines[i].trim().length >= 2 &&
        !lines[i].trim().slice(1, -1).includes('`')
      ) {
        consecutiveCodeLines.push(lines[i].trim().slice(1, -1));
        i++;
      }
      renderedElements.push(
        <CodeBlockViewer
          key={`detected-code-block-${renderedElements.length}`}
          code={consecutiveCodeLines.join('\n')}
          language=""
        />
      );
      continue;
    }

    // 3. Empty line
    if (!trimmed) {
      renderedElements.push(<div key={`empty-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // 4. Image match: ![alt](url)
    const imgMatch = trimmed.match(MARKDOWN_IMAGE_REGEX);
    if (imgMatch) {
      const [, alt, url] = imgMatch;
      renderedElements.push(
        <div
          key={`img-${i}`}
          onClick={() => onPreviewImage?.(url)}
          className="my-2 max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm cursor-pointer hover:border-indigo-400 transition group"
          title="Click để phóng to ảnh"
        >
          <DecryptedImage src={url} alt={alt || 'Ảnh đính kèm'} className="w-full max-h-60 object-contain" />
        </div>
      );
      i++;
      continue;
    }

    // 5. Raw image URL
    if (IMAGE_EXTENSION_REGEX.test(trimmed) || CATBOX_URL_REGEX.test(trimmed)) {
      renderedElements.push(
        <div
          key={`rawimg-${i}`}
          onClick={() => onPreviewImage?.(trimmed)}
          className="my-2 max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm cursor-pointer hover:border-indigo-400 transition group"
          title="Click để phóng to ảnh"
        >
          <DecryptedImage src={trimmed} alt="Ảnh đính kèm" className="w-full max-h-60 object-contain" />
        </div>
      );
      i++;
      continue;
    }

    // 6. Checklist item: - [ ] or - [x]
    const checkMatch = line.match(/^(\s*)- \[( |x|X)\] (.*)$/);
    if (checkMatch) {
      const lineIdx = i;
      const [, , checkChar, itemText] = checkMatch;
      const isChecked = checkChar.toLowerCase() === 'x';
      renderedElements.push(
        <div
          key={`check-${i}`}
          className={`flex items-start gap-2 py-0.5 transition-all ${
            allowToggleCheckboxes ? 'cursor-pointer hover:text-indigo-600' : ''
          }`}
          onClick={() => {
            if (allowToggleCheckboxes && onToggleCheckbox) {
              onToggleCheckbox(lineIdx, !isChecked);
            }
          }}
        >
          <span className="mt-0.5 shrink-0">
            {isChecked ? (
              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400 dark:text-slate-500 hover:text-indigo-500" />
            )}
          </span>
          <span className={`min-w-0 ${isChecked ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
            {renderInlineFormatting(itemText)}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 7. Headings: ###, ##, #
    if (trimmed.startsWith('### ')) {
      renderedElements.push(
        <h4 key={`h3-${i}`} className="font-bold text-xs text-slate-900 dark:text-white pt-1">
          {renderInlineFormatting(trimmed.substring(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      renderedElements.push(
        <h3 key={`h2-${i}`} className="font-bold text-sm text-indigo-700 dark:text-indigo-300 pt-1.5 pb-0.5 border-b border-slate-200/60 dark:border-slate-800">
          {renderInlineFormatting(trimmed.substring(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      renderedElements.push(
        <h2 key={`h1-${i}`} className="font-extrabold text-sm text-slate-900 dark:text-white pt-2 pb-1 border-b border-indigo-200 dark:border-indigo-900/60">
          {renderInlineFormatting(trimmed.substring(2))}
        </h2>
      );
      i++;
      continue;
    }

    // 8. Blockquote: > Quote
    if (trimmed.startsWith('> ')) {
      renderedElements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-3 border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 px-3 py-1.5 my-1 rounded-r-lg text-slate-700 dark:text-slate-300 italic text-[11.5px]"
        >
          {renderInlineFormatting(trimmed.substring(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    // 9. Bullet item: - or *
    if (/^(\s*)[-*]\s+/.test(line)) {
      const cleanText = line.replace(/^(\s*)[-*]\s+/, '');
      renderedElements.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 pl-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-1.5 shrink-0" />
          <span className="min-w-0">{renderInlineFormatting(cleanText)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 10. Numbered item: 1. or 2.
    const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const [, , num, itemText] = numMatch;
      renderedElements.push(
        <div key={`num-${i}`} className="flex items-start gap-1.5 pl-2 py-0.5">
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px] shrink-0 min-w-[16px]">
            {num}.
          </span>
          <span className="min-w-0">{renderInlineFormatting(itemText)}</span>
        </div>
      );
      i++;
      continue;
    }

    // 11. Regular paragraph
    renderedElements.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {renderInlineFormatting(line)}
      </p>
    );
    i++;
  }

  return (
    <div className={`space-y-1.5 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans ${className}`}>
      {renderedElements}
    </div>
  );
};
