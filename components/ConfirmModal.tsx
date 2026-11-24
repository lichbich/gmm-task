'use client';

import React from 'react';
import { Trash2, AlertTriangle, Info, X } from 'lucide-react';
import { Modal } from './common/Modal';

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
  const type = options?.type || 'danger';
  const confirmText = options?.confirmText || (type === 'danger' ? 'Xác nhận xóa' : 'Xác nhận');
  const cancelText = options?.cancelText || 'Hủy bỏ';
  const title = options?.title || (type === 'danger' ? 'Xác nhận xóa' : 'Thông báo xác nhận');

  const handleConfirmAction = () => {
    options?.onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen && Boolean(options)}
      onClose={onClose}
      size="sm"
      zIndex="z-[150]"
      hideHeader
      bodyClassName="text-center space-y-4 relative"
    >
      {/* Close icon button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center saho-modal-close rounded-[8px] active:scale-95 cursor-pointer"
        title="Đóng cửa sổ"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Icon container */}
      <div
        className={`w-12 h-12 rounded-[12px] flex items-center justify-center mx-auto transition-transform duration-300 ${
          type === 'danger'
            ? 'bg-[rgba(255,77,79,0.16)] text-[#FF4D4F] dark:bg-red-950/60 dark:text-red-400'
            : type === 'warning'
            ? 'bg-[rgba(255,169,64,0.16)] text-[#FF7A45] dark:bg-amber-950/60 dark:text-amber-400'
            : 'bg-[rgba(24,144,255,0.16)] text-[#1890FF] dark:bg-sky-950/60 dark:text-sky-400'
        }`}
      >
        {type === 'danger' ? (
          <Trash2 className="w-5 h-5" />
        ) : type === 'warning' ? (
          <AlertTriangle className="w-5 h-5" />
        ) : (
          <Info className="w-5 h-5" />
        )}
      </div>

      {/* Title & Message */}
      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-[#1D202A] dark:text-slate-100 tracking-tight">
          {title}
        </h3>
        <p className="text-[13px] text-[#838899] dark:text-slate-400 leading-relaxed px-2">
          {options?.message}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-stretch gap-2.5 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 min-h-[38px] py-2 px-3.5 bg-white dark:bg-slate-800 hover:bg-[#F8FAFB] dark:hover:bg-slate-700 border border-[#E8E9EF] dark:border-slate-700 text-[#1D202A] dark:text-slate-300 font-medium rounded-[8px] text-[13px] leading-snug transition active:scale-95 flex items-center justify-center text-center cursor-pointer"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={handleConfirmAction}
          className={`flex-1 min-h-[38px] py-2 px-3.5 text-white font-medium rounded-[8px] text-[13px] leading-snug transition active:scale-95 flex items-center justify-center gap-1.5 text-center cursor-pointer ${
            type === 'danger'
              ? 'bg-[#FF4D4F] hover:bg-[#ff7875]'
              : type === 'warning'
              ? 'bg-[#FF7A45] hover:bg-[#FFA940]'
              : 'bg-[#1890FF] hover:bg-[#40A9FF]'
          }`}
        >
          {type === 'danger' && <Trash2 className="w-3.5 h-3.5 shrink-0" />}
          <span>{confirmText}</span>
        </button>
      </div>
    </Modal>
  );
};
