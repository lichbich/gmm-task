'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Clock, AlertTriangle, CheckCircle, RotateCcw, X } from 'lucide-react';

interface TimeSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TimeSimulator: React.FC<TimeSimulatorProps> = ({ isOpen, onClose }) => {
  const { simulatedTime, setSimulatedTime, resetSimulatedTime } = useApp();
  const [tempTime, setTempTime] = useState(simulatedTime);

  if (!isOpen) return null;

  const handleApply = () => {
    setSimulatedTime(tempTime);
    onClose();
  };

  const handleQuickPreset = (type: 'ON_TIME' | 'LATE' | 'RESET') => {
    const now = new Date();
    if (type === 'RESET') {
      resetSimulatedTime();
      setTempTime(now.toISOString().slice(0, 16));
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

    const isoStr = sunday.toISOString().slice(0, 16);
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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-slate-800">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-base sm:text-lg">
            <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
            Giả Lập Thời Gian System
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Công cụ giả lập thời điểm nộp báo cáo để kiểm thử tính năng <strong className="text-red-600">Phạt (Nộp sau 10h Tối CN)</strong> và <strong className="text-emerald-600">Thưởng (Top Effort)</strong>.
          </p>

          <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              Thời gian hiện tại đang chọn:
            </label>
            <div className="text-base sm:text-lg font-bold text-indigo-600">{formattedCurrent}</div>
            
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
            <label className="text-xs font-medium text-slate-700 block mb-1.5">
              Chọn thời gian giả lập:
            </label>
            <input
              type="datetime-local"
              value={tempTime}
              onChange={(e) => setTempTime(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-xs sm:text-sm focus:bg-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-500 block">Lựa chọn nhanh:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPreset('ON_TIME')}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Đúng hạn (CN 20:00)
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('LATE')}
                className="px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-xs text-red-700 font-medium transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                Muộn giờ (CN 22:15)
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/80 shrink-0">
          <button
            type="button"
            onClick={() => handleQuickPreset('RESET')}
            className="px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-medium transition flex items-center gap-1 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" /> Reset về Giờ Thật
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleApply}
              className="px-3.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-medium rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
            >
              Áp Dụng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
