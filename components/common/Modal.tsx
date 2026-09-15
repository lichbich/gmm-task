'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useModalAnimation } from '../../hooks/useModalAnimation';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  showCloseButton?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  closeOnBackdropClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  showCloseButton = true,
  children,
  footer,
  className = '',
  bodyClassName = '',
  closeOnBackdropClick = true,
}) => {
  const { isRendered, isVisible, handleClose } = useModalAnimation(isOpen, onClose);

  if (!isRendered) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-5xl',
  }[size];

  return (
    <div
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 modal-backdrop-transition ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white border border-slate-200/90 rounded-3xl w-full ${sizeClasses} p-6 sm:p-7 shadow-2xl text-slate-800 relative modal-dialog-transition overflow-hidden ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        } ${className}`}
      >
        {/* Header if title or icon provided */}
        {(title || icon || showCloseButton) && (
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95 shrink-0 -mr-1 -mt-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className={bodyClassName}>{children}</div>

        {/* Modal Footer */}
        {footer && <div className="mt-5 pt-4 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
};
