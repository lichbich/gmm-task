'use client';

import React, { useState, useEffect } from 'react';
import { loadDecryptedImageUrl } from '../../lib/imageCryptoHelper';
import { Loader2, ImageOff } from 'lucide-react';

interface DecryptedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackAlt?: string;
  compact?: boolean;
}

export const DecryptedImage: React.FC<DecryptedImageProps> = ({
  src,
  alt,
  fallbackAlt = 'Ảnh',
  compact = false,
  className = '',
  style,
  onClick,
  onDoubleClick,
  draggable = false,
  ...props
}) => {
  const [decryptedSrc, setDecryptedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    if (!src) {
      setIsLoading(false);
      setHasError(true);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    loadDecryptedImageUrl(src)
      .then((url) => {
        if (isMounted) {
          setDecryptedSrc(url);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error decrypting image in component:', err);
        if (isMounted) {
          setDecryptedSrc(src); // fallback to original
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [src]);

  if (isLoading) {
    if (compact) {
      return (
        <div
          className={`flex items-center justify-center bg-slate-200/70 dark:bg-slate-800 animate-pulse text-slate-400 w-full h-full ${className}`}
          style={style}
        >
          <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
        </div>
      );
    }
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 animate-pulse text-slate-400 min-h-[120px] rounded-xl ${className}`}
        style={style}
      >
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (hasError || !decryptedSrc) {
    if (compact) {
      return (
        <div
          className={`flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px] w-full h-full ${className}`}
          style={style}
        >
          {fallbackAlt?.slice(0, 2).toUpperCase() || '??'}
        </div>
      );
    }
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 min-h-[100px] p-3 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}
        style={style}
      >
        <ImageOff className="w-5 h-5 mb-1 text-slate-400" />
        <span className="text-[11px]">Không thể hiển thị ảnh</span>
      </div>
    );
  }

  return (
    <img
      src={decryptedSrc}
      alt={alt || fallbackAlt}
      className={className}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable={draggable}
      onError={() => setHasError(true)}
      {...props}
    />
  );
};
