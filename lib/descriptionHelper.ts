export interface DescriptionItem {
  id: number;
  raw: string;
  isCheckbox: boolean;
  isChecked: boolean;
  text: string;
}

export interface ParsedDescription {
  items: DescriptionItem[];
  totalCheckboxes: number;
  completedCheckboxes: number;
  hasCheckboxes: boolean;
}

/**
 * Parse a task description into structured items (text lines and interactive checkboxes)
 */
export function parseDescription(description: string | undefined | null): ParsedDescription {
  if (!description || !description.trim()) {
    return { items: [], totalCheckboxes: 0, completedCheckboxes: 0, hasCheckboxes: false };
  }

  const lines = description.split('\n');
  let totalCheckboxes = 0;
  let completedCheckboxes = 0;

  const items: DescriptionItem[] = lines.map((line, idx) => {
    // Matches markdown-style task list items like:
    // - [ ] Task 1
    // - [x] Task 2
    // [ ] Task 3
    // * [X] Task 4
    const match = line.match(/^(\s*(?:[-*]\s*)?\[([ xX])\])\s*([\s\S]*)$/);
    if (match) {
      const isChecked = match[2].toLowerCase() === 'x';
      totalCheckboxes++;
      if (isChecked) completedCheckboxes++;
      return {
        id: idx,
        raw: line,
        isCheckbox: true,
        isChecked,
        text: match[3],
      };
    }
    return {
      id: idx,
      raw: line,
      isCheckbox: false,
      isChecked: false,
      text: line,
    };
  });

  return {
    items,
    totalCheckboxes,
    completedCheckboxes,
    hasCheckboxes: totalCheckboxes > 0,
  };
}

/**
 * Toggles a checkbox state on a specific line index in the description string
 */
export function toggleDescriptionCheckbox(description: string, lineIndex: number): string {
  const lines = (description || '').split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return description;

  const line = lines[lineIndex];
  const match = line.match(/^(\s*(?:[-*]\s*)?\[)([ xX])(\]\s*[\s\S]*)$/);
  if (match) {
    const currentChecked = match[2].toLowerCase() === 'x';
    const newChar = currentChecked ? ' ' : 'x';
    lines[lineIndex] = `${match[1]}${newChar}${match[3]}`;
  }

  return lines.join('\n');
}

/**
 * Inserts a new checkbox item template into a text string
 */
export function insertCheckboxToText(currentText: string, itemText: string = ''): string {
  const text = currentText || '';
  const prefix = text.length > 0 && !text.endsWith('\n') ? '\n' : '';
  const item = itemText ? `- [ ] ${itemText}` : '- [ ] ';
  return `${text}${prefix}${item}`;
}
