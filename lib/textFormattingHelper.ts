/**
 * Utilities for rich text / markdown formatting, shortcuts, and smart list continuation
 */

export interface SelectionRange {
  start: number;
  end: number;
}

/**
 * Toggle inline formatting (e.g., Bold **, Italic *, Underline <u>, Strikethrough ~~, Highlight <mark>, Code `)
 */
export function applyInlineFormatting(
  input: HTMLInputElement | HTMLTextAreaElement,
  prefix: string,
  suffix: string = prefix,
  defaultPlaceholder: string = 'văn bản'
): { newValue: string; newSelection: SelectionRange } {
  const value = input.value;
  const start = input.selectionStart ?? value.length;
  const end = input.selectionEnd ?? value.length;
  const selectedText = value.substring(start, end);

  // Check if selected text is already wrapped with prefix and suffix
  const isWrapped =
    selectedText.startsWith(prefix) &&
    selectedText.endsWith(suffix) &&
    selectedText.length >= prefix.length + suffix.length;

  // Check if the surrounding text outside selection is already wrapped
  const beforeSelection = value.substring(Math.max(0, start - prefix.length), start);
  const afterSelection = value.substring(end, Math.min(value.length, end + suffix.length));
  const isSurroundWrapped = beforeSelection === prefix && afterSelection === suffix;

  if (isWrapped) {
    // Unwrap selection: **text** -> text
    const innerText = selectedText.substring(prefix.length, selectedText.length - suffix.length);
    const newValue = value.substring(0, start) + innerText + value.substring(end);
    return {
      newValue,
      newSelection: { start, end: start + innerText.length },
    };
  } else if (isSurroundWrapped) {
    // Unwrap surrounding: **[text]** -> [text]
    const unwrapStart = start - prefix.length;
    const unwrapEnd = end + suffix.length;
    const newValue = value.substring(0, unwrapStart) + selectedText + value.substring(unwrapEnd);
    return {
      newValue,
      newSelection: { start: unwrapStart, end: unwrapStart + selectedText.length },
    };
  } else if (selectedText.length > 0) {
    // Wrap selected text: text -> **text**
    const wrappedText = `${prefix}${selectedText}${suffix}`;
    const newValue = value.substring(0, start) + wrappedText + value.substring(end);
    return {
      newValue,
      newSelection: { start, end: start + wrappedText.length },
    };
  } else {
    // No text selected: insert **văn bản** with placeholder highlighted
    const insertText = `${prefix}${defaultPlaceholder}${suffix}`;
    const newValue = value.substring(0, start) + insertText + value.substring(end);
    return {
      newValue,
      newSelection: {
        start: start + prefix.length,
        end: start + prefix.length + defaultPlaceholder.length,
      },
    };
  }
}

/**
 * Toggle line-based prefix (e.g. # Heading, - Bullet, 1. Numbered, > Quote, - [ ] Checklist)
 */
export function applyLinePrefix(
  input: HTMLTextAreaElement,
  linePrefix: string,
  isNumbered: boolean = false
): { newValue: string; newSelection: SelectionRange } {
  const value = input.value;
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;

  // Find start of the first line and end of the last line in selection
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = value.length;

  const affectedText = value.substring(lineStart, lineEnd);
  const lines = affectedText.split('\n');

  // Check if all lines already have this prefix
  const allHavePrefix = lines.every((line) => {
    if (isNumbered) {
      return /^\d+\.\s/.test(line);
    }
    return line.startsWith(linePrefix);
  });

  const modifiedLines = lines.map((line, idx) => {
    if (allHavePrefix) {
      // Remove prefix
      if (isNumbered) {
        return line.replace(/^\d+\.\s/, '');
      }
      return line.substring(linePrefix.length);
    } else {
      // Strip other standard prefixes before adding new one
      const cleanLine = line.replace(/^(\s*)(- \[[ xX]\]\s+|- |\* |\d+\.\s+|#+\s+|> )/, '$1');
      if (isNumbered) {
        return `${idx + 1}. ${cleanLine}`;
      }
      return `${linePrefix}${cleanLine}`;
    }
  });

  const newAffectedText = modifiedLines.join('\n');
  const newValue = value.substring(0, lineStart) + newAffectedText + value.substring(lineEnd);
  const lengthDiff = newAffectedText.length - affectedText.length;

  return {
    newValue,
    newSelection: {
      start: lineStart,
      end: Math.max(lineStart, end + lengthDiff),
    },
  };
}

/**
 * Handle smart Enter key inside textarea (Word / Notion list continuation)
 */
export function handleSmartEnter(
  textarea: HTMLTextAreaElement,
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  onChange: (val: string) => void
): boolean {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) {
    return false;
  }

  const value = textarea.value;
  const pos = textarea.selectionStart ?? 0;

  // Find start of current line
  const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
  const currentLine = value.substring(lineStart, pos);

  // Match list prefixes
  const checklistMatch = currentLine.match(/^(\s*)- \[[ xX]\]\s*(.*)$/);
  const bulletMatch = currentLine.match(/^(\s*)([-*])\s+(.*)$/);
  const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
  const quoteMatch = currentLine.match(/^(\s*)>\s+(.*)$/);

  if (checklistMatch) {
    const [, indent, content] = checklistMatch;
    if (content.trim() === '') {
      // Empty checklist item -> exit list
      e.preventDefault();
      const newValue = value.substring(0, lineStart) + value.substring(pos);
      onChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = lineStart;
      }, 0);
      return true;
    } else {
      // Continue checklist item
      e.preventDefault();
      const insert = `\n${indent}- [ ] `;
      const newValue = value.substring(0, pos) + insert + value.substring(pos);
      onChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = pos + insert.length;
      }, 0);
      return true;
    }
  }

  if (bulletMatch) {
    const [, indent, bulletChar, content] = bulletMatch;
    if (content.trim() === '') {
      // Empty bullet -> exit list
      e.preventDefault();
      const newValue = value.substring(0, lineStart) + value.substring(pos);
      onChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = lineStart;
      }, 0);
      return true;
    } else {
      // Continue bullet
      e.preventDefault();
      const insert = `\n${indent}${bulletChar} `;
      const newValue = value.substring(0, pos) + insert + value.substring(pos);
      onChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = pos + insert.length;
      }, 0);
      return true;
    }
  }

  if (numberedMatch) {
    const [, indent, numStr, content] = numberedMatch;
    if (content.trim() === '') {
      // Empty numbered -> exit list
      e.preventDefault();
      const newValue = value.substring(0, lineStart) + value.substring(pos);
      onChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = lineStart;
      }, 0);
      return true;
    } else {
      // Continue numbered list
      e.preventDefault();
      const nextNum = parseInt(numStr, 10) + 1;
      const insert = `\n${indent}${nextNum}. `;
      const newValue = value.substring(0, pos) + insert + value.substring(pos);
      onChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = pos + insert.length;
      }, 0);
      return true;
    }
  }

  if (quoteMatch) {
    const [, indent, content] = quoteMatch;
    if (content.trim() === '') {
      // Empty quote -> exit quote
      e.preventDefault();
      const newValue = value.substring(0, lineStart) + value.substring(pos);
      onChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = lineStart;
      }, 0);
      return true;
    } else {
      // Continue quote
      e.preventDefault();
      const insert = `\n${indent}> `;
      const newValue = value.substring(0, pos) + insert + value.substring(pos);
      onChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = pos + insert.length;
      }, 0);
      return true;
    }
  }

  return false;
}

/**
 * Remove markdown formatting tags from a title or search query for clean comparison
 */
export function stripMarkdownForSearch(text?: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/==(.*?)==/g, '$1')
    .replace(/<\/?(b|strong|i|em|u|ins|del|s|mark)[^>]*>/gi, '')
    .trim();
}
