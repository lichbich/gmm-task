export interface DescriptionItem {
  id: number;
  raw: string;
  isCheckbox: boolean;
  isChecked: boolean;
  isImage: boolean;
  imageUrl?: string;
  imageAlt?: string;
  text: string;
}

export interface ParsedDescription {
  items: DescriptionItem[];
  images: string[];
  totalCheckboxes: number;
  completedCheckboxes: number;
  hasCheckboxes: boolean;
}

const IMAGE_EXTENSION_REGEX = /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i;
const CATBOX_URL_REGEX = /^https?:\/\/files\.catbox\.moe\/[a-zA-Z0-9._-]+$/i;
const MARKDOWN_IMAGE_REGEX = /^!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)$/;

/**
 * Parse a task description into structured items (text lines, interactive checkboxes, and images)
 */
export function parseDescription(description: string | undefined | null): ParsedDescription {
  if (!description || !description.trim()) {
    return { items: [], images: [], totalCheckboxes: 0, completedCheckboxes: 0, hasCheckboxes: false };
  }

  const lines = description.split('\n');
  let totalCheckboxes = 0;
  let completedCheckboxes = 0;
  const images: string[] = [];

  const items: DescriptionItem[] = lines.map((line, idx) => {
    const trimmed = line.trim();

    // 1. Check for markdown image format: ![alt](url)
    const mdImageMatch = trimmed.match(MARKDOWN_IMAGE_REGEX);
    if (mdImageMatch) {
      const alt = mdImageMatch[1] || 'Ảnh đính kèm';
      const url = mdImageMatch[2];
      images.push(url);
      return {
        id: idx,
        raw: line,
        isCheckbox: false,
        isChecked: false,
        isImage: true,
        imageUrl: url,
        imageAlt: alt,
        text: alt,
      };
    }

    // 2. Check for standalone direct image URL or Catbox URL
    if (IMAGE_EXTENSION_REGEX.test(trimmed) || CATBOX_URL_REGEX.test(trimmed)) {
      images.push(trimmed);
      return {
        id: idx,
        raw: line,
        isCheckbox: false,
        isChecked: false,
        isImage: true,
        imageUrl: trimmed,
        imageAlt: 'Ảnh đính kèm',
        text: trimmed,
      };
    }

    // 3. Matches markdown-style task list items like:
    // - [ ] Task 1
    // - [x] Task 2
    // [ ] Task 3
    // * [X] Task 4
    const checkboxMatch = line.match(/^(\s*(?:[-*]\s*)?\[([ xX])\])\s*([\s\S]*)$/);
    if (checkboxMatch) {
      const isChecked = checkboxMatch[2].toLowerCase() === 'x';
      totalCheckboxes++;
      if (isChecked) completedCheckboxes++;
      return {
        id: idx,
        raw: line,
        isCheckbox: true,
        isChecked,
        isImage: false,
        text: checkboxMatch[3],
      };
    }

    // 4. Regular text line
    return {
      id: idx,
      raw: line,
      isCheckbox: false,
      isChecked: false,
      isImage: false,
      text: line,
    };
  });

  return {
    items,
    images,
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

/**
 * Removes an image link (markdown format ![alt](url) or plain url) from a description string
 */
export function removeImageFromDescription(description: string | undefined | null, imageUrl: string): string {
  if (!description || !imageUrl) return '';
  const lines = description.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed === imageUrl) return false;
    const mdMatch = trimmed.match(/^!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)$/);
    if (mdMatch && mdMatch[2] === imageUrl) return false;
    return true;
  });
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
