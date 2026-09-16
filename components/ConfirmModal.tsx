'use client';

import React from 'react';
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
  const { isRendered, isVisible, handleClose, handleBackdropMouseDown, handleBackdropClick } = useModalAnimation(isOpen, onClose);

  if (!isRendered || !options) return null;

  const type = options.type || 'danger';
  const confirmText = options.confirmText || (type === 'danger' ? 'Xác nhận xóa' : 'Xác nhận');
  const cancelText = options.cancelText || 'Hủy bỏ';
  const title = options.title || (type === 'danger' ? 'Xác nhận xóa' : 'Thông báo xác nhận');

  const handleConfirmAction = () => {
    options.onConfirm();
    handleClose();
  };

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 modal-backdrop-transition ${
        isVisible ? 'modal-backdrop-open' : 'modal-backdrop-closed'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-3xl p-6 sm:p-7 shadow-2xl max-w-sm w-full border border-slate-100 text-center space-y-4 relative modal-dialog-transition overflow-hidden ${
          isVisible ? 'modal-dialog-open' : 'modal-dialog-closed'
        }`}
      >
        {/* Close icon button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition active:scale-95"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon container */}
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-inner transition-transform duration-300 ${
            type === 'danger'
              ? 'bg-red-50 text-red-600 border border-red-100 shadow-red-500/10'
              : type === 'warning'
              ? 'bg-amber-50 text-amber-600 border border-amber-100 shadow-amber-500/10'
              : 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-indigo-500/10'
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
          <h3 className="text-base font-bold text-slate-800 tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed px-2">
            {options.message}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition active:scale-95"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirmAction}
            className={`flex-1 px-4 py-2.5 text-white font-semibold rounded-xl text-xs transition active:scale-95 shadow-md flex items-center justify-center gap-1.5 ${
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
};
