'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, Info, X } from 'lucide-react';
import { useModalAnimation } from '../hooks/useModalAnimation';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
}

interface ConfirmModalProps {
  isOpen: boolean;
  options: ConfirmDialogOptions | null;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  options,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);
  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } = useModalAnimation(isOpen, onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isRendered || !options || !mounted) return null;

  const type = options.type || 'danger';
  const confirmText = options.confirmText || (type === 'danger' ? 'Xác nhận xóa' : 'Xác nhận');
  const cancelText = options.cancelText || 'Hủy bỏ';
  const title = options.title || (type === 'danger' ? 'Xác nhận xóa' : 'Thông báo xác nhận');

  const handleConfirmAction = () => {
    options.onConfirm();
    handleClose();
  };

  const modalContent = (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto modal-backdrop-transition ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl max-w-sm w-full max-h-[92vh] overflow-y-auto border border-slate-100 dark:border-slate-800 text-center space-y-4 relative modal-dialog-transition ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Close icon button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition active:scale-95 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon container */}
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-inner transition-transform duration-300 ${
            type === 'danger'
              ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 border border-red-100 dark:border-red-900/50 shadow-red-500/10'
              : type === 'warning'
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 shadow-amber-500/10'
              : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shadow-indigo-500/10'
          }`}
        >
          {type === 'danger' ? (
            <Trash2 className="w-6 h-6" />
          ) : type === 'warning' ? (
            <AlertTriangle className="w-6 h-6" />
          ) : (
            <Info className="w-6 h-6" />
          )}
        </div>

        {/* Title & Message */}
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-2">
            {options.message}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition active:scale-95 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirmAction}
            className={`flex-1 px-4 py-2.5 text-white font-semibold rounded-xl text-xs transition active:scale-95 shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
              type === 'danger'
                ? 'bg-red-600 hover:bg-red-500 shadow-red-600/25'
                : type === 'warning'
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25'
            }`}
          >
            {type === 'danger' && <Trash2 className="w-3.5 h-3.5" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
