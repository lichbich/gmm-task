'use client';

import React, { useState } from 'react';
import { useApp, formatToLocalISOString } from '../context/AppContext';
import { Clock, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';
import { Modal } from './common/Modal';
import { useSyncModalUrl } from '../lib/sahoUrl';

interface TimeSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TimeSimulator: React.FC<TimeSimulatorProps> = ({ isOpen, onClose }) => {
  const { simulatedTime, setSimulatedTime, resetSimulatedTime } = useApp();
  const [tempTime, setTempTime] = useState(simulatedTime);

  useSyncModalUrl(
    isOpen,
    isOpen ? '/time-simulator' : null,
    onClose,
    'Giả Lập Thời Gian System'
  );

  const handleApply = () => {
    setSimulatedTime(tempTime);
    onClose();
  };

  const handleQuickPreset = (type: 'ON_TIME' | 'LATE' | 'RESET') => {
    const now = new Date();
    if (type === 'RESET') {
      resetSimulatedTime();
      setTempTime(formatToLocalISOString(now));
      return;
    }

    // Find Sunday of this week
    const day = now.getDay();
    const diffToSunday = day === 0 ? 0 : 7 - day;
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + diffToSunday);

    if (type === 'ON_TIME') {
      // Set to Sunday 20:00 (Before 10 PM)
      sunday.setHours(20, 0, 0, 0);
    } else {
      // Set to Sunday 22:15 (After 10 PM -> Trigger Red Alert)
      sunday.setHours(22, 15, 0, 0);
    }

    const isoStr = formatToLocalISOString(sunday);
    setTempTime(isoStr);
    setSimulatedTime(isoStr);
  };

  const formattedCurrent = new Date(simulatedTime).toLocaleString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isPastSunday10PM = () => {
    const d = new Date(simulatedTime);
    return d.getDay() === 0 && d.getHours() >= 22;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      icon={<Clock className="w-5 h-5 text-[#1890FF] shrink-0" />}
      title="Giả Lập Thời Gian System"
      bodyClassName="space-y-4"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleQuickPreset('RESET')}
            className="px-3 py-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium transition flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[8px] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" /> Reset về Giờ Thật
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="saho-modal-btn-secondary"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="saho-modal-btn-primary"
            >
              Áp Dụng
            </button>
          </div>
        </div>
      }
    >
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        Công cụ giả lập thời điểm nộp báo cáo để kiểm thử tính năng <strong className="text-red-600">Phạt (Nộp sau 10h Tối CN)</strong> và <strong className="text-emerald-600">Thưởng (Top Effort)</strong>.
      </p>

      <div className="saho-modal-card p-3.5 sm:p-4 rounded-[12px] border space-y-2">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
          Thời gian hiện tại đang chọn:
        </label>
        <div className="text-base sm:text-lg font-bold text-[#1890FF]">{formattedCurrent}</div>

        {isPastSunday10PM() ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-full">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" /> Trạng thái: Quá 22:00 Chủ Nhật (Kích hoạt Phạt)
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-full">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Trạng thái: Trong hạn nộp (Trước 22:00 CN)
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-slate-700 dark:text-slate-200 block mb-1.5">
          Chọn thời gian giả lập:
        </label>
        <input
          type="datetime-local"
          value={tempTime}
          onChange={(e) => setTempTime(e.target.value)}
          className="saho-modal-input w-full text-xs sm:text-sm"
        />
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-slate-500 block">Lựa chọn nhanh:</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleQuickPreset('ON_TIME')}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-[8px] text-xs text-emerald-700 font-medium transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            Đúng hạn (CN 20:00)
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('LATE')}
            className="px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-[8px] text-xs text-red-700 font-medium transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            Muộn giờ (CN 22:15)
          </button>
        </div>
      </div>
    </Modal>
  );
};
