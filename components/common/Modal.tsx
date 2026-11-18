'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalAnimation } from '../../hooks/useModalAnimation';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  subHeader?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  showCloseButton?: boolean;
  hideHeader?: boolean;
  noBodyPadding?: boolean;
  noBodyScroll?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  afterModal?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  containerClassName?: string;
  zIndex?: string;
  closeOnBackdropClick?: boolean;
  onRequestClose?: () => boolean | void;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  eyebrow,
  icon,
  headerExtra,
  subHeader,
  size = 'md',
  showCloseButton = true,
  hideHeader = false,
  noBodyPadding = false,
  noBodyScroll = false,
  children,
  footer,
  afterModal,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  containerClassName = '',
  zIndex = 'z-[140]',
  closeOnBackdropClick = true,
  onRequestClose,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } = useModalAnimation(
    isOpen,
    onClose,
    onRequestClose
  );

  if (!mounted || !isRendered || typeof document === 'undefined') return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-5xl xl:max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-5xl',
  }[size];

  const hasHeaderContent = Boolean(title || eyebrow || description || icon || headerExtra || showCloseButton);

  return createPortal(
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={(e) => {
        if (closeOnBackdropClick) {
          handleBackdropClick(e);
        }
      }}
      className={`fixed inset-0 ${zIndex} saho-modal-backdrop flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto modal-backdrop-transition ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      } ${containerClassName}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`my-auto saho-modal-surface border rounded-[12px] w-full ${sizeClasses} max-h-[92vh] flex flex-col p-0 relative modal-dialog-transition overflow-hidden ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        } ${className}`}
      >
        {/* Full-bleed Header */}
        {!hideHeader && hasHeaderContent && (
          <div
            className={`flex items-start justify-between gap-3 px-5 py-4 sm:px-6 sm:py-4 border-b saho-modal-header shrink-0 ${headerClassName}`}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
              <div className="flex-1 min-w-0">
                {eyebrow && <div className="mb-1">{eyebrow}</div>}
                {title && (
                  <div className="text-sm sm:text-base font-bold text-[#1D202A] dark:text-slate-100 tracking-tight leading-snug break-words">
                    {title}
                  </div>
                )}
                {description && (
                  <div className="text-xs text-[#838899] dark:text-slate-400 mt-0.5 leading-relaxed">
                    {description}
                  </div>
                )}
              </div>
            </div>

            {(headerExtra || showCloseButton) && (
              <div className="flex items-center gap-2 shrink-0">
                {headerExtra}
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-8 h-8 rounded-[8px] saho-modal-close flex items-center justify-center active:scale-95 shrink-0 cursor-pointer"
                    title="Đóng cửa sổ"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Optional Sub-Header (e.g. mobile tabs) */}
        {subHeader}

        {/* Modal Body */}
        {noBodyScroll ? (
          <div
            className={`flex-1 min-h-0 overflow-hidden flex flex-col ${
              noBodyPadding ? '' : 'px-5 py-5 sm:px-6 sm:py-6'
            } ${bodyClassName}`}
          >
            {children}
          </div>
        ) : (
          <div
            className={`overflow-y-auto overflow-x-hidden custom-scrollbar flex-1 min-h-0 overscroll-contain ${
              noBodyPadding ? '' : 'px-5 py-5 sm:px-6 sm:py-6'
            } ${bodyClassName}`}
          >
            {children}
          </div>
        )}

        {/* Full-bleed Footer */}
        {footer && (
          <div
            className={`px-5 py-3.5 sm:px-6 sm:py-4 border-t saho-modal-footer shrink-0 rounded-b-[12px] ${footerClassName}`}
          >
            {footer}
          </div>
        )}
      </div>

      {afterModal}
    </div>,
    document.body
  );
};
