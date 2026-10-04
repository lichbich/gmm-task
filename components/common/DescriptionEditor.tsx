'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  ImageIcon,
  Trash2,
  Maximize2,
  Loader2,
  Eye,
  Undo2,
  Redo2,
} from 'lucide-react';
import { DecryptedImage } from './DecryptedImage';
import {
  uploadAndInsertImage,
  getImageFilesFromClipboard,
  getImageFilesFromDrop,
} from '../../lib/imageUploadHelper';
import {
  applyInlineFormatting,
  applyLinePrefix,
  handleSmartEnter,
} from '../../lib/textFormattingHelper';
import { RichDescriptionViewer } from './RichDescriptionViewer';

export interface DescriptionEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
  onPreviewImage?: (url: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

interface TextBlock {
  type: 'text';
  id: string;
  content: string;
}

interface ImageBlock {
  type: 'image';
  id: string;
  url: string;
  alt: string;
}

type EditorBlock = TextBlock | ImageBlock;

const MARKDOWN_IMAGE_REGEX = /^!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)$/;
const CATBOX_URL_REGEX = /^https?:\/\/files\.catbox\.moe\/[a-zA-Z0-9._-]+$/i;
const IMAGE_EXTENSION_REGEX = /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i;

/**
 * Parse markdown string into alternating text and image blocks
 */
function parseMarkdownToBlocks(markdown: string): EditorBlock[] {
  if (!markdown) {
    return [{ type: 'text', id: 'text-init-0', content: '' }];
  }

  const lines = markdown.split('\n');
  const blocks: EditorBlock[] = [];
  let currentTextLines: string[] = [];
  let idCounter = 0;

  const flushText = () => {
    if (currentTextLines.length > 0 || blocks.length === 0) {
      blocks.push({
        type: 'text',
        id: `text-${idCounter++}`,
        content: currentTextLines.join('\n'),
      });
      currentTextLines = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const mdMatch = trimmed.match(MARKDOWN_IMAGE_REGEX);

    if (mdMatch) {
      flushText();
      blocks.push({
        type: 'image',
        id: `img-${idCounter++}-${mdMatch[2]}`,
        url: mdMatch[2],
        alt: mdMatch[1] || 'Ảnh đính kèm',
      });
    } else if (IMAGE_EXTENSION_REGEX.test(trimmed) || CATBOX_URL_REGEX.test(trimmed)) {
      flushText();
      blocks.push({
        type: 'image',
        id: `img-${idCounter++}-${trimmed}`,
        url: trimmed,
        alt: 'Ảnh đính kèm',
      });
    } else {
      currentTextLines.push(line);
    }
  }

  flushText();

  // Ensure there's always at least one text block at end if last block is an image
  if (blocks.length > 0 && blocks[blocks.length - 1].type === 'image') {
    blocks.push({
      type: 'text',
      id: `text-end-${idCounter++}`,
      content: '',
    });
  }

  return blocks;
}

/**
 * Serialize blocks back into a standard markdown string
 */
function serializeBlocksToMarkdown(blocks: EditorBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === 'text') {
      parts.push(block.content);
    } else if (block.type === 'image') {
      const imgLine = `![${block.alt || 'Ảnh'}](${block.url})`;
      parts.push(imgLine);
    }
  }

  return parts.join('\n').replace(/\n{4,}/g, '\n\n\n');
}

export const DescriptionEditor: React.FC<DescriptionEditorProps> = ({
  value,
  onChange,
  placeholder = 'Mô tả chi tiết nội dung đầu việc, hướng dẫn thực hiện, hoặc checklist việc con...',
  minRows = 3,
  className = '',
  onPreviewImage,
  disabled = false,
  autoFocus = false,
}) => {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => parseMarkdownToBlocks(value));
  const [isUploading, setIsUploading] = useState(false);
  const [editorMode, setEditorMode] = useState<'visual' | 'preview'>('visual');
  const lastSerializedRef = useRef<string>(value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const focusedBlockIndexRef = useRef<number>(0);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Undo / Redo History Management
  interface HistorySnapshot {
    markdown: string;
    blockIndex?: number;
    selection?: { start: number; end: number };
  }

  const historyRef = useRef<HistorySnapshot[]>([{ markdown: value, blockIndex: 0 }]);
  const historyIndexRef = useRef<number>(0);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const isUndoingRedoingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const pushSnapshot = useCallback(
    (
      newMarkdown: string,
      blockIndex?: number,
      selection?: { start: number; end: number }
    ) => {
      if (isUndoingRedoingRef.current) return;
      const currentSnapshot = historyRef.current[historyIndexRef.current];
      if (currentSnapshot && currentSnapshot.markdown === newMarkdown) {
        return;
      }

      // Discard future redo history
      const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      nextHistory.push({
        markdown: newMarkdown,
        blockIndex: blockIndex ?? focusedBlockIndexRef.current,
        selection,
      });

      // Keep max 60 history steps
      if (nextHistory.length > 60) {
        nextHistory.shift();
      }

      historyRef.current = nextHistory;
      historyIndexRef.current = nextHistory.length - 1;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(false);
    },
    []
  );

  const handleUndo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (historyIndexRef.current <= 0) return;

    isUndoingRedoingRef.current = true;
    historyIndexRef.current -= 1;
    const target = historyRef.current[historyIndexRef.current];

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);

    const newBlocks = parseMarkdownToBlocks(target.markdown);
    setBlocks(newBlocks);
    lastSerializedRef.current = target.markdown;
    onChange(target.markdown);

    setTimeout(() => {
      const blockIdx = target.blockIndex ?? 0;
      const textarea = textareaRefs.current[blockIdx] || textareaRefs.current[0];
      if (textarea) {
        textarea.focus();
        if (target.selection) {
          textarea.setSelectionRange(target.selection.start, target.selection.end);
        }
      }
      isUndoingRedoingRef.current = false;
    }, 0);
  }, [onChange]);

  const handleRedo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (historyIndexRef.current >= historyRef.current.length - 1) return;

    isUndoingRedoingRef.current = true;
    historyIndexRef.current += 1;
    const target = historyRef.current[historyIndexRef.current];

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);

    const newBlocks = parseMarkdownToBlocks(target.markdown);
    setBlocks(newBlocks);
    lastSerializedRef.current = target.markdown;
    onChange(target.markdown);

    setTimeout(() => {
      const blockIdx = target.blockIndex ?? 0;
      const textarea = textareaRefs.current[blockIdx] || textareaRefs.current[0];
      if (textarea) {
        textarea.focus();
        if (target.selection) {
          textarea.setSelectionRange(target.selection.start, target.selection.end);
        }
      }
      isUndoingRedoingRef.current = false;
    }, 0);
  }, [onChange]);

  // Sync external value changes into blocks
  useEffect(() => {
    if (value !== lastSerializedRef.current) {
      lastSerializedRef.current = value;
      setBlocks(parseMarkdownToBlocks(value));
      if (!isUndoingRedoingRef.current) {
        pushSnapshot(value);
      }
    }
  }, [value, pushSnapshot]);

  const updateBlocksAndNotify = useCallback(
    (newBlocks: EditorBlock[]) => {
      setBlocks(newBlocks);
      const serialized = serializeBlocksToMarkdown(newBlocks);
      lastSerializedRef.current = serialized;
      onChange(serialized);
    },
    [onChange]
  );

  const handleTextChange = (index: number, newContent: string) => {
    const newBlocks = [...blocks];
    if (newBlocks[index] && newBlocks[index].type === 'text') {
      newBlocks[index] = {
        ...(newBlocks[index] as TextBlock),
        content: newContent,
      };
      setBlocks(newBlocks);
      const serialized = serializeBlocksToMarkdown(newBlocks);
      lastSerializedRef.current = serialized;
      onChange(serialized);

      const textarea = textareaRefs.current[index];
      const start = textarea?.selectionStart ?? 0;
      const end = textarea?.selectionEnd ?? 0;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        pushSnapshot(serialized, index, { start, end });
      }, 350);
    }
  };

  const getActiveTextarea = (): HTMLTextAreaElement | null => {
    const idx = focusedBlockIndexRef.current;
    return textareaRefs.current[idx] || textareaRefs.current[0] || null;
  };

  // Inline formatting helper
  const applyInline = (prefix: string, suffix: string = prefix, placeholderText: string = 'văn bản') => {
    const textarea = getActiveTextarea();
    if (!textarea || disabled) return;

    const idx = focusedBlockIndexRef.current;
    const currStart = textarea.selectionStart ?? 0;
    const currEnd = textarea.selectionEnd ?? 0;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pushSnapshot(lastSerializedRef.current, idx, { start: currStart, end: currEnd });

    const { newValue, newSelection } = applyInlineFormatting(textarea, prefix, suffix, placeholderText);

    const newBlocks = [...blocks];
    if (newBlocks[idx] && newBlocks[idx].type === 'text') {
      newBlocks[idx] = {
        ...(newBlocks[idx] as TextBlock),
        content: newValue,
      };
      updateBlocksAndNotify(newBlocks);
      pushSnapshot(serializeBlocksToMarkdown(newBlocks), idx, newSelection);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newSelection.start, newSelection.end);
    }, 0);
  };

  // Line prefix formatting helper
  const applyPrefix = (linePrefix: string, isNumbered: boolean = false) => {
    const textarea = getActiveTextarea();
    if (!textarea || disabled) return;

    const idx = focusedBlockIndexRef.current;
    const currStart = textarea.selectionStart ?? 0;
    const currEnd = textarea.selectionEnd ?? 0;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pushSnapshot(lastSerializedRef.current, idx, { start: currStart, end: currEnd });

    const { newValue, newSelection } = applyLinePrefix(textarea, linePrefix, isNumbered);

    const newBlocks = [...blocks];
    if (newBlocks[idx] && newBlocks[idx].type === 'text') {
      newBlocks[idx] = {
        ...(newBlocks[idx] as TextBlock),
        content: newValue,
      };
      updateBlocksAndNotify(newBlocks);
      pushSnapshot(serializeBlocksToMarkdown(newBlocks), idx, newSelection);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newSelection.start, newSelection.end);
    }, 0);
  };

  // Keyboard Shortcuts Handler
  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRefs.current[idx];
    if (!textarea) return;

    // Ctrl / Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();

      // Undo: Ctrl + Z (without Shift)
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl + Y or Ctrl + Shift + Z
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Bold: Ctrl + B
      if (key === 'b') {
        e.preventDefault();
        applyInline('**', '**', 'in đậm');
        return;
      }

      // Italic: Ctrl + I
      if (key === 'i') {
        e.preventDefault();
        applyInline('*', '*', 'in nghiêng');
        return;
      }

      // Underline: Ctrl + U
      if (key === 'u') {
        e.preventDefault();
        applyInline('<u>', '</u>', 'gạch chân');
        return;
      }

      // Strikethrough: Ctrl + Shift + X
      if (e.shiftKey && key === 'x') {
        e.preventDefault();
        applyInline('~~', '~~', 'gạch ngang');
        return;
      }

      // Highlight: Ctrl + Shift + H
      if (e.shiftKey && key === 'h') {
        e.preventDefault();
        applyInline('<mark>', '</mark>', 'nổi bật');
        return;
      }

      // Inline code: Ctrl + E
      if (key === 'e') {
        e.preventDefault();
        applyInline('`', '`', 'mã');
        return;
      }
    }

    // Smart Enter list continuation
    if (e.key === 'Enter') {
      const currStart = textarea.selectionStart ?? 0;
      const currEnd = textarea.selectionEnd ?? 0;

      const handled = handleSmartEnter(textarea, e, (newVal) => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        pushSnapshot(lastSerializedRef.current, idx, { start: currStart, end: currEnd });
        handleTextChange(idx, newVal);
        setTimeout(() => {
          const pos = textarea.selectionStart ?? 0;
          pushSnapshot(lastSerializedRef.current, idx, { start: pos, end: pos });
        }, 0);
      });
      if (handled) return;
    }
  };

  const handleRemoveImageBlock = (blockId: string) => {
    const blockIndex = blocks.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) return;

    const newBlocks = blocks.filter((b) => b.id !== blockId);

    // Merge adjacent text blocks
    const mergedBlocks: EditorBlock[] = [];
    for (let i = 0; i < newBlocks.length; i++) {
      const curr = newBlocks[i];
      const prev = mergedBlocks[mergedBlocks.length - 1];

      if (curr.type === 'text' && prev && prev.type === 'text') {
        mergedBlocks[mergedBlocks.length - 1] = {
          ...prev,
          content: prev.content + (prev.content.endsWith('\n') ? '' : '\n') + curr.content,
        };
      } else {
        mergedBlocks.push(curr);
      }
    }

    if (mergedBlocks.length === 0) {
      mergedBlocks.push({ type: 'text', id: `text-${Date.now()}`, content: '' });
    }

    updateBlocksAndNotify(mergedBlocks);
  };

  const insertImageFile = async (file: File) => {
    setIsUploading(true);
    try {
      let tempText = '';
      const uploadedUrl = await uploadAndInsertImage(file, (valOrFn) => {
        if (typeof valOrFn === 'function') {
          tempText = valOrFn('');
        } else {
          tempText = valOrFn;
        }
      });

      if (uploadedUrl) {
        const targetIdx = focusedBlockIndexRef.current;
        const newBlocks = [...blocks];

        const newImgBlock: ImageBlock = {
          type: 'image',
          id: `img-${Date.now()}-${uploadedUrl}`,
          url: uploadedUrl,
          alt: 'Ảnh đính kèm',
        };

        const newTrailingTextBlock: TextBlock = {
          type: 'text',
          id: `text-${Date.now() + 1}`,
          content: '',
        };

        if (targetIdx >= 0 && targetIdx < newBlocks.length) {
          newBlocks.splice(targetIdx + 1, 0, newImgBlock, newTrailingTextBlock);
        } else {
          newBlocks.push(newImgBlock, newTrailingTextBlock);
        }

        updateBlocksAndNotify(newBlocks);
      }
    } catch (err: any) {
      console.error('Failed to upload image in editor:', err);
      alert(err.message || 'Không thể tải ảnh lên. Vui lòng thử lại!');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const files = getImageFilesFromClipboard(e);
    if (files.length > 0) {
      e.preventDefault();
      for (const file of files) {
        await insertImageFile(file);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    const files = getImageFilesFromDrop(e);
    if (files.length > 0) {
      e.preventDefault();
      for (const file of files) {
        await insertImageFile(file);
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      await insertImageFile(files[i]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* RICH TEXT FORMATTING TOOLBAR */}
      <div className="bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 px-1.5 flex items-center justify-between gap-1.5 shadow-2xs overflow-x-auto no-scrollbar">
        {/* Left Toolbar Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Undo */}
          <button
            type="button"
            disabled={disabled || !canUndo || editorMode === 'preview'}
            onClick={handleUndo}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Hoàn tác (Ctrl + Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          {/* Redo */}
          <button
            type="button"
            disabled={disabled || !canRedo || editorMode === 'preview'}
            onClick={handleRedo}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Làm lại (Ctrl + Y / Ctrl + Shift + Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Bold */}
          <button
            type="button"
            disabled={disabled || editorMode === 'preview'}
            onClick={() => applyInline('**', '**', 'in đậm')}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
            title="In đậm (Ctrl + B)"
          >
            <Bold className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          {/* Italic */}
          <button
            type="button"
            disabled={disabled || editorMode === 'preview'}
            onClick={() => applyInline('*', '*', 'in nghiêng')}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
            title="In nghiêng (Ctrl + I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* Underline */}
          <button
            type="button"
            disabled={disabled || editorMode === 'preview'}
            onClick={() => applyInline('<u>', '</u>', 'gạch chân')}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
            title="Gạch chân (Ctrl + U)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          {/* Strikethrough */}
          <button
            type="button"
            disabled={disabled || editorMode === 'preview'}
            onClick={() => applyInline('~~', '~~', 'gạch ngang')}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
            title="Gạch ngang (Ctrl + Shift + X)"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>

          {/* Highlight */}
          <button
            type="button"
            disabled={disabled || editorMode === 'preview'}
            onClick={() => applyInline('<mark>', '</mark>', 'nổi bật')}
            className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-100/70 dark:hover:bg-amber-950/60 transition cursor-pointer disabled:opacity-40"
            title="Highlight làm nổi bật (Ctrl + Shift + H)"
          >
            <Highlighter className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Heading */}
          <button
            type="button"
            disabled={disabled || editorMode === 'preview'}
            onClick={() => applyPrefix('## ')}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
            title="Tiêu đề mục con (Heading 2)"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>

          {/* Bullet list */}
          <button
            type="button"
            disabled={disabled || editorMode === 'preview'}
            onClick={() => applyPrefix('- ')}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
            title="Danh sách gạch đầu dòng"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          {/* Numbered list */}
          <button
            type="button"
            disabled={disabled || editorMode === 'preview'}
            onClick={() => applyPrefix('1. ', true)}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
            title="Danh sách đánh số thứ tự"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          {/* Checklist */}
          <button
            type="button"
            disabled={disabled || editorMode === 'preview'}
            onClick={() => applyPrefix('- [ ] ')}
            className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 transition cursor-pointer disabled:opacity-40 font-bold"
            title="Việc con / Checklist (- [ ])"
          >
            <CheckSquare className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>

          {/* Quote */}
          <button
            type="button"
            disabled={disabled || editorMode === 'preview'}
            onClick={() => applyPrefix('> ')}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
            title="Trích dẫn / Ghi chú quan trọng"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>

          {/* Code */}
          <button
            type="button"
            disabled={disabled || editorMode === 'preview'}
            onClick={() => applyInline('`', '`', 'mã')}
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
            title="Code / Thông số kỹ thuật (Ctrl + E)"
          >
            <Code className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Image Upload Button */}
          <button
            type="button"
            disabled={disabled || isUploading || editorMode === 'preview'}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 transition shadow-2xs cursor-pointer disabled:opacity-40"
            title="Thêm ảnh từ máy hoặc Paste (Ctrl+V) / Kéo thả"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            <span>{isUploading ? 'Đang tải...' : 'Ảnh'}</span>
          </button>
        </div>

        {/* Right View Modes Toggle (Soạn thảo | Xem trước) */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="bg-slate-200/80 dark:bg-slate-700/80 p-0.5 rounded-lg flex items-center text-[10px] font-medium">
            <button
              type="button"
              onClick={() => setEditorMode('visual')}
              className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                editorMode === 'visual'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Chế độ soạn thảo trực quan"
            >
              Soạn thảo
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('preview')}
              className={`px-2 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1 ${
                editorMode === 'preview'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Xem trước kết quả hiển thị"
            >
              <Eye className="w-3 h-3" />
              <span>Xem trước</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor Body */}
      <div
        onPaste={handlePaste}
        onDrop={handleDrop}
        className="w-full bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl p-3 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition shadow-2xs relative min-h-[110px]"
      >
        {editorMode === 'preview' ? (
          // Preview Render
          <div className="p-1">
            <RichDescriptionViewer
              content={value}
              onPreviewImage={onPreviewImage}
            />
          </div>
        ) : (
          // Visual Flow Mode
          <div className="space-y-2">
            {blocks.map((block, idx) => {
              if (block.type === 'text') {
                return (
                  <textarea
                    key={block.id}
                    ref={(el) => {
                      textareaRefs.current[idx] = el;
                    }}
                    value={block.content}
                    placeholder={idx === 0 && blocks.length === 1 ? placeholder : ''}
                    rows={Math.max(minRows, (block.content.match(/\n/g) || []).length + 1)}
                    disabled={disabled}
                    autoFocus={autoFocus && idx === 0}
                    onChange={(e) => handleTextChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onFocus={() => {
                      focusedBlockIndexRef.current = idx;
                    }}
                    className="w-full bg-transparent border-0 outline-hidden focus:outline-hidden focus:ring-0 p-0 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none leading-relaxed font-sans"
                  />
                );
              }

              if (block.type === 'image') {
                return (
                  <div
                    key={block.id}
                    className="my-2 p-2 bg-slate-50 dark:bg-slate-900/90 rounded-xl border border-slate-200/90 dark:border-slate-700/90 flex items-center justify-between gap-3 group/imgcard hover:border-indigo-300 dark:hover:border-indigo-500 transition shadow-2xs select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        onClick={() => onPreviewImage?.(block.url)}
                        className="w-11 h-11 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 relative cursor-pointer group-hover/imgcard:scale-[1.03] transition duration-150"
                        title="Click để phóng to ảnh"
                      >
                        <DecryptedImage
                          src={block.url}
                          alt={block.alt}
                          className="w-full h-full object-cover"
                          compact
                        />
                      </div>

                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block">
                          {block.alt || 'Ảnh đính kèm'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onPreviewImage && (
                        <button
                          type="button"
                          onClick={() => onPreviewImage(block.url)}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-2xs text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
                          title="Xem ảnh phóng to"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Xem</span>
                        </button>
                      )}

                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => handleRemoveImageBlock(block.id)}
                          className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-900/80 shadow-2xs text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
                          title="Xóa ảnh này khỏi mô tả"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Xóa</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}

        {/* Uploading indicator overlay */}
        {isUploading && (
          <div className="absolute right-3 bottom-3 flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Đang xử lý ảnh lên...</span>
          </div>
        )}
      </div>

      {/* Helper Shortcut Legend */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-1 pt-0.5">
        <span>
          Phím tắt: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-indigo-600 dark:text-indigo-400">Ctrl+Z</code> (Hoàn tác), <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-indigo-600 dark:text-indigo-400">Ctrl+Y</code> (Làm lại), <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-indigo-600 dark:text-indigo-400">Ctrl+B</code> (Đậm), <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-indigo-600 dark:text-indigo-400">Ctrl+I</code> (Nghiêng), <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-indigo-600 dark:text-indigo-400">Ctrl+U</code> (Gạch chân)
        </span>
      </div>
    </div>
  );
};
