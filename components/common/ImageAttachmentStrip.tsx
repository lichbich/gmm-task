import React from 'react';
import { X, Image as ImageIcon, Maximize2 } from 'lucide-react';
import { parseDescription } from '../../lib/descriptionHelper';
import { DecryptedImage } from './DecryptedImage';

interface ImageAttachmentStripProps {
  description: string;
  onRemoveImage?: (imageUrl: string) => void;
  onPreviewImage: (imageUrl: string) => void;
  disabled?: boolean;
}

export const ImageAttachmentStrip: React.FC<ImageAttachmentStripProps> = ({
  description,
  onRemoveImage,
  onPreviewImage,
  disabled,
}) => {
  const { images } = parseDescription(description);

  if (!images || images.length === 0) return null;

  return (
    <div className="mt-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2 animate-in fade-in duration-150">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
          <span>Ảnh đính kèm ({images.length})</span>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
          Click để xem • Hover để xóa
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar flex-wrap">
        {images.map((url, idx) => (
          <div
            key={idx}
            className="relative group/thumb rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-16 h-16 shrink-0 shadow-2xs"
          >
            <DecryptedImage
              src={url}
              alt="Ảnh đính kèm"
              onClick={() => onPreviewImage(url)}
              className="w-full h-full object-cover cursor-pointer group-hover/thumb:scale-105 transition duration-150"
              loading="lazy"
              compact
            />

            {/* Click to expand overlay */}
            <div
              onClick={() => onPreviewImage(url)}
              className="absolute inset-0 bg-slate-900/0 group-hover/thumb:bg-slate-900/30 transition-all flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </div>

            {/* Delete button */}
            {onRemoveImage && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveImage(url);
                }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 hover:bg-rose-700 transition duration-150 shadow-xs cursor-pointer active:scale-90 z-10"
                title="Xóa ảnh này"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
