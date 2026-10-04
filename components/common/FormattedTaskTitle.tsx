'use client';

import React from 'react';

interface FormattedTaskTitleProps {
  title: string;
  className?: string;
  highlightSearch?: string;
}

/**
 * Parses and renders task title supporting **bold**, <b>bold</b>, <u>underline</u>, and <mark>highlight</mark>
 */
export const FormattedTaskTitle: React.FC<FormattedTaskTitleProps> = ({
  title,
  className = '',
  highlightSearch,
}) => {
  if (!title) return null;

  // Regex to split on formatting tokens: **bold**, <b>bold</b>, <u>underline</u>, <mark>highlight</mark>, ==highlight==
  const formatRegex = /(\*\*[^*]+\*\*|<b>.*?<\/b>|<u>.*?<\/u>|<mark>.*?<\/mark>|==[^=]+==)/gi;
  const parts = title.split(formatRegex);

  return (
    <span className={`inline ${className}`}>
      {parts.map((part, idx) => {
        if (!part) return null;

        // Markdown bold **text**
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          const content = part.substring(2, part.length - 2);
          return (
            <strong
              key={idx}
              className="font-bold text-slate-900 dark:text-white"
            >
              {content}
            </strong>
          );
        }

        // HTML <b>text</b> or <strong>text</strong>
        const bMatch = part.match(/^<(?:b|strong)>(.*?)<\/(?:b|strong)>$/i);
        if (bMatch) {
          return (
            <strong
              key={idx}
              className="font-bold text-slate-900 dark:text-white"
            >
              {bMatch[1]}
            </strong>
          );
        }

        // Underline <u>text</u>
        const uMatch = part.match(/^<u>(.*?)<\/u>$/i);
        if (uMatch) {
          return (
            <span key={idx} className="underline decoration-indigo-400 underline-offset-2">
              {uMatch[1]}
            </span>
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
              {markMatch[1]}
            </mark>
          );
        }
        if (part.startsWith('==') && part.endsWith('==') && part.length >= 4) {
          const content = part.substring(2, part.length - 2);
          return (
            <mark
              key={idx}
              className="bg-amber-200/90 dark:bg-amber-900/60 text-slate-900 dark:text-amber-100 px-1 py-0.5 rounded-sm font-medium"
            >
              {content}
            </mark>
          );
        }

        // Regular text
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
};
