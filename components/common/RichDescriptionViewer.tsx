'use client';

import React from 'react';
import { DecryptedImage } from './DecryptedImage';
import { CheckSquare, Square } from 'lucide-react';

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

  return (
    <div className={`space-y-1.5 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        // Image match: ![alt](url)
        const imgMatch = trimmed.match(MARKDOWN_IMAGE_REGEX);
        if (imgMatch) {
          const [, alt, url] = imgMatch;
          return (
            <div
              key={idx}
              onClick={() => onPreviewImage?.(url)}
              className="my-2 max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm cursor-pointer hover:border-indigo-400 transition group"
              title="Click để phóng to ảnh"
            >
              <DecryptedImage src={url} alt={alt || 'Ảnh đính kèm'} className="w-full max-h-60 object-contain" />
            </div>
          );
        }

        // Raw image URL
        if (IMAGE_EXTENSION_REGEX.test(trimmed) || CATBOX_URL_REGEX.test(trimmed)) {
          return (
            <div
              key={idx}
              onClick={() => onPreviewImage?.(trimmed)}
              className="my-2 max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm cursor-pointer hover:border-indigo-400 transition group"
              title="Click để phóng to ảnh"
            >
              <DecryptedImage src={trimmed} alt="Ảnh đính kèm" className="w-full max-h-60 object-contain" />
            </div>
          );
        }

        // Checklist item: - [ ] or - [x]
        const checkMatch = line.match(/^(\s*)- \[( |x|X)\] (.*)$/);
        if (checkMatch) {
          const [, , checkChar, itemText] = checkMatch;
          const isChecked = checkChar.toLowerCase() === 'x';
          return (
            <div
              key={idx}
              className={`flex items-start gap-2 py-0.5 transition-all ${
                allowToggleCheckboxes ? 'cursor-pointer hover:text-indigo-600' : ''
              }`}
              onClick={() => {
                if (allowToggleCheckboxes && onToggleCheckbox) {
                  onToggleCheckbox(idx, !isChecked);
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
        }

        // Headings: ### H3, ## H2, # H1
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-xs text-slate-900 dark:text-white pt-1">
              {renderInlineFormatting(trimmed.substring(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-bold text-sm text-indigo-700 dark:text-indigo-300 pt-1.5 pb-0.5 border-b border-slate-200/60 dark:border-slate-800">
              {renderInlineFormatting(trimmed.substring(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="font-extrabold text-sm text-slate-900 dark:text-white pt-2 pb-1 border-b border-indigo-200 dark:border-indigo-900/60">
              {renderInlineFormatting(trimmed.substring(2))}
            </h2>
          );
        }

        // Blockquote: > Quote
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              className="border-l-3 border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 px-3 py-1.5 my-1 rounded-r-lg text-slate-700 dark:text-slate-300 italic text-[11.5px]"
            >
              {renderInlineFormatting(trimmed.substring(2))}
            </blockquote>
          );
        }

        // Bullet item: - or *
        if (/^(\s*)[-*]\s+/.test(line)) {
          const cleanText = line.replace(/^(\s*)[-*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-1.5 shrink-0" />
              <span className="min-w-0">{renderInlineFormatting(cleanText)}</span>
            </div>
          );
        }

        // Numbered item: 1. or 2.
        const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (numMatch) {
          const [, , num, itemText] = numMatch;
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-2 py-0.5">
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px] shrink-0 min-w-[16px]">
                {num}.
              </span>
              <span className="min-w-0">{renderInlineFormatting(itemText)}</span>
            </div>
          );
        }

        // Regular paragraph
        return (
          <p key={idx} className="leading-relaxed">
            {renderInlineFormatting(line)}
          </p>
        );
      })}
    </div>
  );
};
