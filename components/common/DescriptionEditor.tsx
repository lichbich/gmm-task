'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ImageIcon,
  Trash2,
  Maximize2,
  Loader2,
  FileCode,
  Eye,
  CheckSquare,
} from 'lucide-react';
import { DecryptedImage } from './DecryptedImage';
import {
  uploadAndInsertImage,
  getImageFilesFromClipboard,
  getImageFilesFromDrop,
} from '../../lib/imageUploadHelper';

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

/**
 * Auto-resizing textarea subcomponent
 */
const AutoResizeTextarea: React.FC<{
  value: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  minRows?: number;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}> = ({
  value,
  placeholder,
  onChange,
  onKeyDown,
  onPaste,
  onDrop,
  onFocus,
  autoFocus,
  minRows = 2,
  disabled,
  inputRef,
}) => {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const ref = inputRef || internalRef;

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, minRows * 20)}px`;
  }, [minRows, ref]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <textarea
      ref={ref as any}
      value={value}
      onChange={(e) => {
        onChange(e);
        adjustHeight();
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onDrop={onDrop}
      onFocus={onFocus}
      autoFocus={autoFocus}
      placeholder={placeholder}
      disabled={disabled}
      rows={minRows}
      className="w-full bg-transparent border-0 outline-hidden focus:outline-hidden focus:ring-0 p-0 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none leading-relaxed font-sans"
    />
  );
};

export const DescriptionEditor: React.FC<DescriptionEditorProps> = ({
  value,
  onChange,
  placeholder = 'Nhập mô tả chi tiết...',
  minRows = 4,
  className = '',
  onPreviewImage,
  disabled = false,
  autoFocus = false,
}) => {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => parseMarkdownToBlocks(value));
  const [isUploading, setIsUploading] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const lastSerializedRef = useRef<string>(value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const focusedBlockIndexRef = useRef<number>(0);

  // Sync external value changes into blocks if changed externally
  useEffect(() => {
    if (value !== lastSerializedRef.current) {
      lastSerializedRef.current = value;
      setBlocks(parseMarkdownToBlocks(value));
    }
  }, [value]);

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
      updateBlocksAndNotify(newBlocks);
    }
  };

  const handleRemoveImageBlock = (blockId: string) => {
    const blockIndex = blocks.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) return;

    const newBlocks = blocks.filter((b) => b.id !== blockId);

    // Merge adjacent text blocks if any
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
          // Insert right after current block
          newBlocks.splice(targetIdx + 1, 0, newImgBlock, newTrailingTextBlock);
        } else {
          // Insert at the end
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

  const handleInsertCheckbox = () => {
    const targetIdx = focusedBlockIndexRef.current;
    const newBlocks = [...blocks];

    if (newBlocks[targetIdx] && newBlocks[targetIdx].type === 'text') {
      const current = (newBlocks[targetIdx] as TextBlock).content;
      const prefix = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
      newBlocks[targetIdx] = {
        ...(newBlocks[targetIdx] as TextBlock),
        content: `${current}${prefix}- [ ] `,
      };
    } else {
      newBlocks.push({
        type: 'text',
        id: `text-${Date.now()}`,
        content: '- [ ] ',
      });
    }

    updateBlocksAndNotify(newBlocks);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Editor Toolbar Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-0.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Thêm ảnh từ máy hoặc Paste (Ctrl+V) / Kéo thả trực tiếp"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            <span>{isUploading ? 'Đang tải ảnh...' : '+ Thêm Ảnh'}</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={handleInsertCheckbox}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 rounded-lg border border-indigo-200/80 dark:border-indigo-800/80 transition shadow-2xs cursor-pointer"
            title="Chèn việc con / checkbox"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>+ Checkbox</span>
          </button>
        </div>

        {/* Mode Toggle & Tips */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] text-slate-400 dark:text-slate-500">
            Paste (Ctrl+V) ảnh hoặc gõ <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-400">- [ ]</code>
          </span>

          <button
            type="button"
            onClick={() => setRawMode((prev) => !prev)}
            className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 transition cursor-pointer"
            title="Chuyển chế độ xem trực quan / mã nguồn"
          >
            {rawMode ? (
              <>
                <Eye className="w-3 h-3 text-indigo-500" />
                <span>Trực quan</span>
              </>
            ) : (
              <>
                <FileCode className="w-3 h-3 text-slate-400" />
                <span>Markdown</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Editor Card */}
      <div
        onPaste={handlePaste}
        onDrop={handleDrop}
        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition shadow-2xs relative min-h-[110px]"
      >
        {rawMode ? (
          // Raw Markdown Textarea Mode (fallback)
          <textarea
            rows={minRows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full bg-transparent border-0 outline-hidden focus:outline-hidden focus:ring-0 p-0 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-mono resize-none leading-relaxed"
          />
        ) : (
          // Visual Block-based Flow
          <div className="space-y-2">
            {blocks.map((block, idx) => {
              if (block.type === 'text') {
                return (
                  <AutoResizeTextarea
                    key={block.id}
                    value={block.content}
                    placeholder={idx === 0 && blocks.length === 1 ? placeholder : ''}
                    minRows={idx === 0 && blocks.length === 1 ? minRows : 1}
                    disabled={disabled}
                    autoFocus={autoFocus && idx === 0}
                    onChange={(e) => handleTextChange(idx, e.target.value)}
                    onFocus={() => {
                      focusedBlockIndexRef.current = idx;
                    }}
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
    </div>
  );
};
