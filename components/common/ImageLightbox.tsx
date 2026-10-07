'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ImageIcon,
  Move,
} from 'lucide-react';
import { DecryptedImage } from './DecryptedImage';
import { loadDecryptedImageUrl } from '../../lib/imageCryptoHelper';
import { lockBodyScroll, unlockBodyScroll } from '../../hooks/useModalAnimation';

interface ImageLightboxProps {
  isOpen: boolean;
  imageUrl: string | null;
  altText?: string;
  onClose: () => void;
  onDelete?: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  isOpen,
  imageUrl,
  altText,
  onClose,
  onDelete,
}) => {
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll while lightbox is open
  useEffect(() => {
    if (isOpen) {
      lockBodyScroll();
      return () => {
        unlockBodyScroll();
      };
    }
  }, [isOpen]);

  // Reset zoom & pan and load decrypted URL when image changes or opens
  useEffect(() => {
    if (isOpen && imageUrl) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsDragging(false);

      let isMounted = true;
      loadDecryptedImageUrl(imageUrl).then((url) => {
        if (isMounted) setDisplayUrl(url);
      }).catch(() => {
        if (isMounted) setDisplayUrl(imageUrl);
      });

      return () => {
        isMounted = false;
      };
    } else {
      setDisplayUrl(null);
    }
  }, [isOpen, imageUrl]);

  // Keyboard shortcut controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((prev) => Math.min(5, Number((prev + 0.3).toFixed(2))));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((prev) => {
          const next = Math.max(0.5, Number((prev - 0.3).toFixed(2)));
          if (next <= 1) setPan({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(5, Number((prev + 0.3).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(0.5, Number((prev - 0.3).toFixed(2)));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((prev) => Math.min(5, Number((prev + 0.25).toFixed(2))));
    } else {
      setZoom((prev) => {
        const next = Math.max(0.5, Number((prev - 0.25).toFixed(2)));
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const handleDoubleClick = () => {
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  if (!isOpen || !imageUrl) return null;

  const content = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] bg-slate-950/92 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-5 select-none animate-in fade-in duration-200"
    >
      {/* Top Controls Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl flex items-center justify-between gap-3 text-white pb-3 shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <ImageIcon className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-200 truncate">
            {altText && altText !== 'Ảnh' && altText !== 'Ảnh đính kèm'
              ? altText
              : 'Xem chi tiết ảnh'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer active:scale-95"
            title="Đóng xem ảnh (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center Image Container with Pan and Zoom */}
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 w-full max-w-6xl flex items-center justify-center overflow-hidden relative"
        style={{
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
        }}
      >
        <DecryptedImage
          src={imageUrl}
          alt={altText || 'Ảnh'}
          draggable={false}
          className="max-h-[78vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10 select-none transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>

      {/* Floating Bottom Toolbar (Zoom in, Zoom out, Reset, Drag hint) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="pt-3 shrink-0 flex items-center gap-2 flex-wrap justify-center"
      >
        <div className="flex items-center gap-1 bg-slate-900/90 border border-white/15 rounded-2xl p-1.5 backdrop-blur-md shadow-2xl">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent"
            title="Thu nhỏ (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold text-white hover:bg-white/10 transition cursor-pointer"
            title="Nhấp để đặt lại 100%"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent"
            title="Phóng to (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-white/15 mx-1" />

          <button
            type="button"
            onClick={handleResetZoom}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer flex items-center gap-1"
            title="Đặt lại kích thước ban đầu (0)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold hidden sm:inline">Đặt lại</span>
          </button>
        </div>

        {zoom > 1 && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-indigo-600/80 border border-indigo-400/40 text-white text-[11px] font-medium shadow-lg backdrop-blur-md animate-in fade-in">
            <Move className="w-3.5 h-3.5 animate-pulse" />
            <span>Kéo chuột để di chuyển ảnh</span>
          </div>
        )}
      </div>
    </div>
  );

  return mounted ? createPortal(content, document.body) : content;
};
