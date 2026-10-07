'use client';

import React from 'react';
import {
  Peek,
  type Expression,
  type Frame,
  type Gaze,
  type Face,
  type Color,
} from '@doan-labs/peek';
import { User, getTodayDateOnlyString } from '../../types/task';
import { DecryptedImage } from './DecryptedImage';
import { useOptionalApp } from '../../context/AppContext';
import { getMemberUniqueTraits, computeMemberEmotion } from '../../lib/avatarHelper';

export interface UserAvatarProps {
  user?: Partial<User> | null;
  account?: string;
  name?: string;
  avatarUrl?: string;
  role?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  shape?: 'rounded' | 'circle';
  className?: string;
  showStatus?: boolean;
  isOnline?: boolean;
  onClick?: () => void;
  title?: string;
  // Peek avatar customization options
  expression?: Expression;
  face?: Face;
  color?: Color;
  animate?: boolean;
  animateOnHover?: boolean;
  animateEmotion?: boolean; // Tự động chạy animation tương ứng với biểu cảm (mặc định: true)
  gaze?: Gaze | 'pointer';
  frame?: Frame;
  scale?: string; // Zoom scale (defaults to scale-135)
}

const EMOTION_ANIMATION_CLASSES: Record<Expression, string> = {
  angry: 'animate-peek-angry',
  excited: 'animate-peek-excited',
  sleepy: 'animate-peek-sleepy',
  attentive: 'animate-peek-attentive',
  bored: 'animate-peek-bored',
  happy: 'animate-peek-happy',
  normal: 'animate-peek-normal',
  sad: 'animate-peek-sad',
  curious: 'animate-peek-attentive',
  surprised: 'animate-peek-excited',
  confused: 'animate-peek-bored',
};

const SIZE_CONFIGS: Record<
  'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl',
  { sizeClass: string; roundedClass: string; textClass: string; statusDotClass: string; pixelSize: number }
> = {
  xs: {
    sizeClass: 'w-6 h-6',
    roundedClass: 'rounded-lg',
    textClass: 'text-[10px] font-bold',
    statusDotClass: 'w-2 h-2 -bottom-0.5 -right-0.5 border',
    pixelSize: 24,
  },
  sm: {
    sizeClass: 'w-8 h-8 sm:w-9 sm:h-9',
    roundedClass: 'rounded-xl',
    textClass: 'text-xs font-black',
    statusDotClass: 'w-2.5 h-2.5 sm:w-3 sm:h-3 -bottom-0.5 -right-0.5 border-2',
    pixelSize: 36,
  },
  md: {
    sizeClass: 'w-10 h-10',
    roundedClass: 'rounded-xl',
    textClass: 'text-sm font-bold',
    statusDotClass: 'w-3 h-3 -bottom-0.5 -right-0.5 border-2',
    pixelSize: 40,
  },
  lg: {
    sizeClass: 'w-12 h-12',
    roundedClass: 'rounded-2xl',
    textClass: 'text-base font-extrabold',
    statusDotClass: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5 border-2',
    pixelSize: 48,
  },
  xl: {
    sizeClass: 'w-14 h-14',
    roundedClass: 'rounded-2xl',
    textClass: 'text-xl font-extrabold',
    statusDotClass: 'w-4 h-4 -bottom-0.5 -right-0.5 border-2',
    pixelSize: 56,
  },
  '2xl': {
    sizeClass: 'w-20 h-20',
    roundedClass: 'rounded-3xl',
    textClass: 'text-2xl font-black',
    statusDotClass: 'w-5 h-5 -bottom-0.5 -right-0.5 border-2',
    pixelSize: 80,
  },
};

function getRoleGradient(role?: string): string {
  switch (role) {
    case 'Admin':
      return 'from-purple-600 to-indigo-600 text-white shadow-purple-500/20';
    case 'Leader':
      return 'from-amber-500 to-orange-600 text-white shadow-amber-500/20';
    case 'Advisor':
      return 'from-emerald-600 to-teal-600 text-white shadow-emerald-500/20';
    default:
      return 'from-indigo-600 to-blue-500 text-white shadow-indigo-500/20';
  }
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  account,
  name,
  avatarUrl,
  role,
  size = 'sm',
  shape = 'rounded',
  className = '',
  showStatus = false,
  isOnline = false,
  onClick,
  title,
  expression,
  face,
  color,
  animate = true,
  animateOnHover = false,
  animateEmotion = true,
  gaze = 'pointer',
  frame = 'none',
  scale = 'scale-120',
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const app = useOptionalApp();

  const effectiveAccount = user?.account || account || 'NV';
  const effectiveName = user?.name || name || effectiveAccount;
  const effectiveRole = user?.role || role || 'Member';
  const effectiveAvatarUrl = user?.avatarUrl || avatarUrl;

  const initials = effectiveAccount.slice(0, 2).toUpperCase();
  const seedName = (effectiveName || effectiveAccount || 'NV').trim() || 'NV';

  // 1. Collision-free traits: ensure every member has a distinctive (face, color) combination
  const { face: autoFace, color: autoColor } = React.useMemo(() => {
    return getMemberUniqueTraits(effectiveAccount, app?.users);
  }, [effectiveAccount, app?.users]);

  const resolvedFace = face ?? autoFace;
  const resolvedColor = color ?? autoColor;

  // 2. Dynamic emotion based on task state
  const todayStr = React.useMemo(() => {
    return getTodayDateOnlyString(app?.simulatedTime);
  }, [app?.simulatedTime]);

  const emotionResult = React.useMemo(() => {
    if (expression) {
      return { expression, reason: '' };
    }
    return computeMemberEmotion(
      effectiveAccount,
      app?.tasks,
      app?.users,
      todayStr,
      app?.selectedWeek,
      app?.selectedYear
    );
  }, [
    expression,
    effectiveAccount,
    app?.tasks,
    app?.users,
    todayStr,
    app?.selectedWeek,
    app?.selectedYear,
  ]);

  const resolvedExpression = expression ?? emotionResult.expression;

  // 3. Compensate for Peek's floor positioning (FLOOR=370) and expression sinking (especially sleepy alt=-1.12 & bored)
  // to ensure faces are always perfectly centered vertically without getting sunken or cut off at the bottom.
  const verticalShift = React.useMemo(() => {
    if (resolvedExpression === 'sleepy') {
      return resolvedFace === 'semicircle' ? '-translate-y-[28%]' : '-translate-y-[24%]';
    }
    if (resolvedExpression === 'bored') {
      return resolvedFace === 'semicircle' ? '-translate-y-[18%]' : '-translate-y-[12%]';
    }
    if (resolvedFace === 'semicircle') {
      return '-translate-y-[14%]';
    }
    return '-translate-y-[8%]';
  }, [resolvedExpression, resolvedFace]);

  const cfg = size === 'custom' ? null : SIZE_CONFIGS[size];
  const sizeClass = cfg ? cfg.sizeClass : '';
  const roundedClass = shape === 'circle' ? 'rounded-full' : cfg ? cfg.roundedClass : 'rounded-xl';
  const statusDotClass = cfg ? cfg.statusDotClass : 'w-2.5 h-2.5 -bottom-0.5 -right-0.5 border-2';

  const defaultTitle =
    title ||
    `${effectiveName} (@${effectiveAccount}) - ${effectiveRole}${
      emotionResult.reason ? ` • ${emotionResult.reason}` : ''
    }`;

  const effectiveAnimate = animate || (animateOnHover && isHovered);
  const effectiveGaze = gaze ?? (animateOnHover && isHovered ? 'pointer' : undefined);

  const emotionAnimClass =
    animateEmotion && !effectiveAvatarUrl
      ? EMOTION_ANIMATION_CLASSES[resolvedExpression] || 'animate-peek-normal'
      : '';

  return (
    <div
      onClick={onClick}
      onMouseEnter={animateOnHover ? () => setIsHovered(true) : undefined}
      onMouseLeave={animateOnHover ? () => setIsHovered(false) : undefined}
      className={`relative shrink-0 select-none ${sizeClass} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      title={defaultTitle}
    >
      <div
        className={`w-full h-full ${roundedClass} overflow-hidden flex items-center justify-center transition-transform duration-150 ${emotionAnimClass} ${
          effectiveAvatarUrl
            ? 'bg-slate-800 shadow-xs'
            : frame === 'none'
            ? 'bg-transparent'
            : 'bg-[#1A1918] shadow-xs'
        }`}
      >
        {effectiveAvatarUrl ? (
          <DecryptedImage
            src={effectiveAvatarUrl}
            alt={effectiveName}
            className="w-full h-full object-cover"
            fallbackAlt={initials}
            compact
          />
        ) : (
          <Peek
            name={seedName}
            face={resolvedFace}
            color={resolvedColor}
            size={cfg?.pixelSize ?? 48}
            expression={resolvedExpression}
            animate={effectiveAnimate}
            gaze={effectiveGaze}
            frame={frame}
            square={shape !== 'circle'}
            title={false}
            className={`w-full h-full block ${scale} ${verticalShift} transition-transform duration-200`}
            style={{ transformOrigin: 'center center' }}
          />
        )}
      </div>

      {showStatus && (
        <span
          className={`absolute ${statusDotClass} rounded-full border-white dark:border-slate-900 shadow-xs ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
        />
      )}
    </div>
  );
};

