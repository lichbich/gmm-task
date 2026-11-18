'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

export type SahoToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface SahoToastPayload {
  id?: string;
  variant: SahoToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface ActiveToast extends Required<Pick<SahoToastPayload, 'id' | 'variant' | 'title' | 'duration'>> {
  description?: string;
}

const TOAST_EVENT = 'saho-toast-dispatch';

function dispatchToast(payload: SahoToastPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SahoToastPayload>(TOAST_EVENT, { detail: payload }));
}

/**
 * Global Saho Toast helper following the Figma Saho Toast design system.
 */
export const sahoToast = {
  success: (title: string, description?: string, duration = 3500) =>
    dispatchToast({ variant: 'success', title, description, duration }),
  info: (title: string, description?: string, duration = 3500) =>
    dispatchToast({ variant: 'info', title, description, duration }),
  warning: (title: string, description?: string, duration = 4200) =>
    dispatchToast({ variant: 'warning', title, description, duration }),
  error: (title: string, description?: string, duration = 4800) =>
    dispatchToast({ variant: 'error', title, description, duration }),
};

const VARIANT_CONFIG: Record<
  SahoToastVariant,
  {
    bgGradient: string;
    iconBg: string;
    accentColor: string;
    borderAccent: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  success: {
    bgGradient:
      'bg-[radial-gradient(circle_at_0%_50%,rgba(10,177,133,0.18),rgba(255,255,255,0.92)_58%)] dark:bg-[radial-gradient(circle_at_0%_50%,rgba(10,177,133,0.22),rgba(15,23,42,0.95)_62%)]',
    iconBg: 'bg-[rgba(10,177,133,0.16)] text-[#0AB185]',
    accentColor: '#0AB185',
    borderAccent: 'border-[#0AB185]/30 dark:border-[#0AB185]/40',
    Icon: CheckCircle2,
  },
  info: {
    bgGradient:
      'bg-[radial-gradient(circle_at_0%_50%,rgba(24,144,255,0.18),rgba(255,255,255,0.92)_58%)] dark:bg-[radial-gradient(circle_at_0%_50%,rgba(24,144,255,0.22),rgba(15,23,42,0.95)_62%)]',
    iconBg: 'bg-[rgba(24,144,255,0.16)] text-[#1890FF]',
    accentColor: '#1890FF',
    borderAccent: 'border-[#1890FF]/30 dark:border-[#1890FF]/40',
    Icon: Info,
  },
  warning: {
    bgGradient:
      'bg-[radial-gradient(circle_at_0%_50%,rgba(255,169,64,0.22),rgba(255,255,255,0.92)_58%)] dark:bg-[radial-gradient(circle_at_0%_50%,rgba(255,169,64,0.22),rgba(15,23,42,0.95)_62%)]',
    iconBg: 'bg-[rgba(255,169,64,0.16)] text-[#FF7A45]',
    accentColor: '#FF7A45',
    borderAccent: 'border-[#FFA940]/40 dark:border-[#FFA940]/40',
    Icon: AlertTriangle,
  },
  error: {
    bgGradient:
      'bg-[radial-gradient(circle_at_0%_50%,rgba(255,77,79,0.20),rgba(255,255,255,0.92)_58%)] dark:bg-[radial-gradient(circle_at_0%_50%,rgba(255,77,79,0.22),rgba(15,23,42,0.95)_62%)]',
    iconBg: 'bg-[rgba(255,77,79,0.16)] text-[#FF4D4F]',
    accentColor: '#FF4D4F',
    borderAccent: 'border-[#FF4D4F]/35 dark:border-[#FF4D4F]/40',
    Icon: XCircle,
  },
};

const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export const SahoToaster: React.FC = () => {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const mounted = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<SahoToastPayload>;
      const detail = custom.detail;
      if (!detail?.title) return;

      const id = detail.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = detail.duration ?? 3500;
      const item: ActiveToast = {
        id,
        variant: detail.variant || 'info',
        title: detail.title,
        description: detail.description,
        duration,
      };

      setToasts((prev) => [item, ...prev].slice(0, 4));

      if (duration > 0) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    };

    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  if (!mounted || toasts.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-[999999] flex flex-col gap-2.5 pointer-events-none max-w-[calc(100vw-24px)]"
    >
      {toasts.map((item) => {
        const cfg = VARIANT_CONFIG[item.variant];
        const IconComp = cfg.Icon;
        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto min-h-[56px] w-[280px] sm:w-[320px] px-3 py-2.5 rounded-[12px] border backdrop-blur-[25px] shadow-[0_8px_24px_rgba(29,32,42,0.12)] flex items-center gap-2.5 relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200 ${cfg.bgGradient} ${cfg.borderAccent}`}
          >
            <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
              <IconComp className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#1D202A] dark:text-slate-100 leading-snug truncate">
                {item.title}
              </p>
              {item.description && (
                <p className="text-[12px] text-[#838899] dark:text-slate-400 leading-snug line-clamp-2 mt-0.5">
                  {item.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== item.id))}
              aria-label="Đóng thông báo"
              className="p-1 rounded-[6px] text-[#A2A6B4] hover:text-[#1D202A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <span
              className="absolute bottom-0 left-0 h-[2px] w-full opacity-70"
              style={{ backgroundColor: cfg.accentColor }}
            />
          </div>
        );
      })}
    </div>,
    document.body
  );
};
