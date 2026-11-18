'use client';

import React from 'react';
import { Check, Minus } from 'lucide-react';

/* --------------------------------------------------------------------------
 * SahoCheckbox - Figma BaseComponents/check box
 * -------------------------------------------------------------------------- */
export interface SahoCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
  label?: React.ReactNode;
  size?: 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  stopPropagation?: boolean;
  title?: string;
}

export const SahoCheckbox: React.FC<SahoCheckboxProps> = ({
  checked,
  onChange,
  indeterminate = false,
  label,
  size = 'md',
  disabled = false,
  className = '',
  stopPropagation = false,
  title,
}) => {
  const boxDim = size === 'lg' ? 'w-[18px] h-[18px]' : 'w-[16px] h-[16px]';
  const iconDim = size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5';

  const handleToggle = (e: React.MouseEvent | React.ChangeEvent<HTMLInputElement>) => {
    if (stopPropagation && 'stopPropagation' in e) {
      e.stopPropagation();
    }
    if (disabled) return;
    onChange(!checked);
  };

  return (
    <label
      title={title}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
      }}
      className={`inline-flex items-center gap-2 select-none group ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={handleToggle}
      />
      <span
        aria-hidden="true"
        className={`${boxDim} rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-150 ${
          checked || indeterminate
            ? 'bg-[#1890FF] border-[#1890FF] text-white shadow-[0_0_0_2px_rgba(24,144,255,0.14)]'
            : 'bg-white dark:bg-slate-900 border-[#A2A6B4] dark:border-slate-600 group-hover:bg-[rgba(64,169,255,0.08)] group-hover:border-[#40A9FF] group-hover:shadow-[0_0_0_2px_#E6F7FF] dark:group-hover:shadow-[0_0_0_2px_rgba(24,144,255,0.22)]'
        }`}
      >
        {indeterminate ? (
          <Minus className={iconDim} strokeWidth={3} />
        ) : checked ? (
          <Check className={iconDim} strokeWidth={3} />
        ) : null}
      </span>
      {label && (
        <span
          className={`${
            size === 'lg' ? 'text-[14px]' : 'text-[13px]'
          } font-medium text-[#1D202A] dark:text-slate-200 group-hover:text-[#1890FF] transition-colors`}
        >
          {label}
        </span>
      )}
    </label>
  );
};

/* --------------------------------------------------------------------------
 * SahoToggle - Figma BaseComponents/Toggle (squircle 35x20px, radius 6px)
 * -------------------------------------------------------------------------- */
export interface SahoToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  stopPropagation?: boolean;
  title?: string;
}

export const SahoToggle: React.FC<SahoToggleProps> = ({
  checked,
  onChange,
  label,
  size = 'md',
  disabled = false,
  className = '',
  stopPropagation = false,
  title,
}) => {
  const trackCls = size === 'sm' ? 'w-[30px] h-[18px]' : 'w-[35px] h-[20px]';
  const thumbCls = size === 'sm' ? 'w-[14px] h-[14px]' : 'w-[16px] h-[16px]';
  const translateCls = size === 'sm' ? 'translate-x-[12px]' : 'translate-x-[15px]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={`inline-flex items-center gap-2 select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <span
        className={`${trackCls} p-[2px] rounded-[6px] inline-flex items-center transition-colors duration-200 shrink-0 ${
          checked
            ? 'bg-[#1890FF]'
            : 'bg-[rgba(73,82,106,0.24)] dark:bg-slate-700 hover:bg-[rgba(73,82,106,0.34)]'
        }`}
      >
        <span
          className={`${thumbCls} rounded-[4px] bg-white shadow-xs transition-transform duration-200 ${
            checked ? translateCls : 'translate-x-0'
          }`}
        />
      </span>
      {label && (
        <span className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200">
          {label}
        </span>
      )}
    </button>
  );
};

/* --------------------------------------------------------------------------
 * SahoRadio - Figma BaseComponents/radio button
 * -------------------------------------------------------------------------- */
export interface SahoRadioProps {
  checked: boolean;
  onChange: () => void;
  label?: React.ReactNode;
  color?: 'blue' | 'green';
  disabled?: boolean;
  className?: string;
}

export const SahoRadio: React.FC<SahoRadioProps> = ({
  checked,
  onChange,
  label,
  color = 'blue',
  disabled = false,
  className = '',
}) => {
  const accentBorder = color === 'green' ? 'border-[#0AB185]' : 'border-[#1890FF]';
  const accentDot = color === 'green' ? 'bg-[#0AB185]' : 'bg-[#1890FF]';

  return (
    <label
      className={`inline-flex items-center gap-2 select-none group ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <input
        type="radio"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={() => {
          if (!disabled) onChange();
        }}
      />
      <span
        aria-hidden="true"
        className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150 ${
          checked
            ? `${accentBorder} bg-white dark:bg-slate-900 shadow-[0_0_0_3px_#E6F7FF] dark:shadow-[0_0_0_3px_rgba(24,144,255,0.22)]`
            : 'border-[#A2A6B4] dark:border-slate-600 bg-white dark:bg-slate-900 group-hover:border-[#40A9FF] group-hover:shadow-[0_0_0_3px_#E6F7FF] dark:group-hover:shadow-[0_0_0_3px_rgba(24,144,255,0.18)]'
        }`}
      >
        {checked && <span className={`w-[8px] h-[8px] rounded-full ${accentDot}`} />}
      </span>
      {label && (
        <span className="text-[13px] font-medium text-[#1D202A] dark:text-slate-200">
          {label}
        </span>
      )}
    </label>
  );
};

/* --------------------------------------------------------------------------
 * SahoProgressLine - Figma BaseComponents/Progress-Line
 * -------------------------------------------------------------------------- */
export interface SahoProgressLineProps {
  value: number;
  showLabel?: boolean;
  status?: 'auto' | 'normal' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}

export const SahoProgressLine: React.FC<SahoProgressLineProps> = ({
  value,
  showLabel = true,
  status = 'auto',
  size = 'md',
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value || 0)));

  const resolvedStatus =
    status !== 'auto'
      ? status
      : clamped >= 100
      ? 'success'
      : clamped > 0
      ? 'normal'
      : 'normal';

  const fillColor =
    resolvedStatus === 'success'
      ? 'bg-[#0AB185]'
      : resolvedStatus === 'warning'
      ? 'bg-[#FFA940]'
      : resolvedStatus === 'danger'
      ? 'bg-[#FF4D4F]'
      : 'bg-[#1890FF]';

  const heightCls = size === 'sm' ? 'h-[6px]' : 'h-[8px]';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`flex-1 min-w-0 ${heightCls} rounded-full bg-[#F3F4F7] dark:bg-slate-800 overflow-hidden`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${fillColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[12px] font-medium text-[#1D202A] dark:text-slate-200 tabular-nums shrink-0 min-w-[32px] text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
};

/* --------------------------------------------------------------------------
 * SahoProgressRing - Figma RingChart (compact circular progress)
 * -------------------------------------------------------------------------- */
export interface SahoProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
  className?: string;
}

export const SahoProgressRing: React.FC<SahoProgressRingProps> = ({
  value,
  size = 34,
  strokeWidth = 3.5,
  label,
  color,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, value || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    color || (clamped >= 100 ? '#0AB185' : clamped > 0 ? '#1890FF' : '#A2A6B4');

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-[#E8E9EF] dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-[#1D202A] dark:text-slate-100 tabular-nums leading-none">
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
};

/* --------------------------------------------------------------------------
 * SahoStatusTag - Figma label state & Tag/color
 * -------------------------------------------------------------------------- */
export type SahoTagVariant = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'purple';

export interface SahoStatusTagProps {
  children: React.ReactNode;
  variant?: SahoTagVariant;
  showDot?: boolean;
  shape?: 'pill' | 'tag';
  size?: 'sm' | 'md';
  className?: string;
}

const TAG_VARIANT_STYLES: Record<SahoTagVariant, { wrap: string; dot: string }> = {
  success: {
    wrap: 'bg-[rgba(10,177,133,0.16)] text-[#0AB185] dark:bg-emerald-950/60 dark:text-emerald-300',
    dot: 'bg-[#0AB185]',
  },
  info: {
    wrap: 'bg-[rgba(24,144,255,0.16)] text-[#1890FF] dark:bg-sky-950/60 dark:text-sky-300',
    dot: 'bg-[#1890FF]',
  },
  warning: {
    wrap: 'bg-[rgba(255,169,64,0.16)] text-[#FF7A45] dark:bg-amber-950/60 dark:text-amber-300',
    dot: 'bg-[#FF7A45]',
  },
  danger: {
    wrap: 'bg-[rgba(255,77,79,0.16)] text-[#FF4D4F] dark:bg-rose-950/60 dark:text-rose-300',
    dot: 'bg-[#FF4D4F]',
  },
  neutral: {
    wrap: 'bg-[rgba(162,166,180,0.16)] text-[#838899] dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-[#A2A6B4]',
  },
  purple: {
    wrap: 'bg-[rgba(179,127,235,0.16)] text-[#9254DE] dark:bg-purple-950/60 dark:text-purple-300',
    dot: 'bg-[#B37FEB]',
  },
};

export const SahoStatusTag: React.FC<SahoStatusTagProps> = ({
  children,
  variant = 'neutral',
  showDot = false,
  shape = 'pill',
  size = 'md',
  className = '',
}) => {
  const styles = TAG_VARIANT_STYLES[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${
        shape === 'pill' ? 'rounded-[12px]' : 'rounded-[4px]'
      } ${size === 'sm' ? 'h-[18px] px-1.5 text-[11px]' : 'h-[22px] px-2 text-[12px]'} ${
        styles.wrap
      } ${className}`}
    >
      {showDot && <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${styles.dot}`} />}
      {children}
    </span>
  );
};
