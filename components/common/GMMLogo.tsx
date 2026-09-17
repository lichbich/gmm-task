import React from 'react';

interface GMMLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
  subtextClassName?: string;
}

export const GMMLogo: React.FC<GMMLogoProps> = ({
  className = '',
  size = 42,
  showText = false,
  textClassName = '',
  subtextClassName = '',
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Icon Emblem Container */}
      <div
        className="relative shrink-0 flex items-center justify-center transition-transform duration-300 hover:scale-105 active:scale-95 group"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="backCardGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient id="checkGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <filter id="softShadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.15" />
            </filter>
            <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#065F46" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Layer 1: Back Blue Slanted Card */}
          <rect
            x="14"
            y="16"
            width="58"
            height="68"
            rx="16"
            fill="url(#backCardGrad)"
            transform="rotate(-8 43 50)"
          />

          {/* Layer 2: Front White Card */}
          <rect
            x="26"
            y="16"
            width="58"
            height="68"
            rx="16"
            fill="#FFFFFF"
            filter="url(#softShadow)"
          />

          {/* Layer 3: Task Items Inside Card */}
          {/* Item 1: Blue Bullet + Rounded Bar */}
          <circle cx="39" cy="32" r="4.5" fill="#3B82F6" />
          <rect x="49" y="29" width="25" height="6" rx="3" fill="#E2E8F0" />

          {/* Item 2: Green Bullet + Rounded Bar */}
          <circle cx="39" cy="46" r="4.5" fill="#10B981" />
          <rect x="49" y="43" width="25" height="6" rx="3" fill="#E2E8F0" />

          {/* Item 3: Blue Bullet + Short Rounded Bar */}
          <circle cx="39" cy="60" r="4.5" fill="#3B82F6" />
          <rect x="49" y="57" width="18" height="6" rx="3" fill="#E2E8F0" />

          {/* Layer 4: Green Checkmark Badge at Bottom Right */}
          <circle cx="68" cy="67" r="16" fill="url(#checkGrad)" filter="url(#badgeShadow)" />
          <path
            d="M 60 67 L 65 72 L 76 61"
            stroke="#FFFFFF"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {showText && (
        <div className="leading-tight min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className={`text-sm sm:text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight whitespace-nowrap truncate ${textClassName}`}>
              Saho Task System
            </h1>
          </div>
          <p className={`hidden sm:block text-xs text-slate-500 dark:text-slate-400 font-medium truncate ${subtextClassName}`}>
            Hệ thống quản lý task & báo cáo thưởng/phạt 10h CN
          </p>
        </div>
      )}
    </div>
  );
};
