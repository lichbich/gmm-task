'use client';

import React from 'react';
import { User, UserRole } from '../../types/task';
import { DecryptedImage } from './DecryptedImage';

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
}

const SIZE_CONFIGS: Record<
  'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl',
  { sizeClass: string; roundedClass: string; textClass: string; statusDotClass: string }
> = {
  xs: {
    sizeClass: 'w-6 h-6',
    roundedClass: 'rounded-lg',
    textClass: 'text-[10px] font-bold',
    statusDotClass: 'w-2 h-2 -bottom-0.5 -right-0.5 border',
  },
  sm: {
    sizeClass: 'w-8 h-8 sm:w-9 sm:h-9',
    roundedClass: 'rounded-xl',
    textClass: 'text-xs font-black',
    statusDotClass: 'w-2.5 h-2.5 sm:w-3 sm:h-3 -bottom-0.5 -right-0.5 border-2',
  },
  md: {
    sizeClass: 'w-10 h-10',
    roundedClass: 'rounded-xl',
    textClass: 'text-sm font-bold',
    statusDotClass: 'w-3 h-3 -bottom-0.5 -right-0.5 border-2',
  },
  lg: {
    sizeClass: 'w-12 h-12',
    roundedClass: 'rounded-2xl',
    textClass: 'text-base font-extrabold',
    statusDotClass: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5 border-2',
  },
  xl: {
    sizeClass: 'w-14 h-14',
    roundedClass: 'rounded-2xl',
    textClass: 'text-xl font-extrabold',
    statusDotClass: 'w-4 h-4 -bottom-0.5 -right-0.5 border-2',
  },
  '2xl': {
    sizeClass: 'w-20 h-20',
    roundedClass: 'rounded-3xl',
    textClass: 'text-2xl font-black',
    statusDotClass: 'w-5 h-5 -bottom-0.5 -right-0.5 border-2',
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
}) => {
  const effectiveAccount = user?.account || account || 'NV';
  const effectiveName = user?.name || name || effectiveAccount;
  const effectiveRole = user?.role || role || 'Member';
  const effectiveAvatarUrl = user?.avatarUrl || avatarUrl;

  const initials = effectiveAccount.slice(0, 2).toUpperCase();
  const roleGrad = getRoleGradient(effectiveRole);

  const cfg = size === 'custom' ? null : SIZE_CONFIGS[size];
  const sizeClass = cfg ? cfg.sizeClass : '';
  const roundedClass = shape === 'circle' ? 'rounded-full' : cfg ? cfg.roundedClass : 'rounded-xl';
  const textClass = cfg ? cfg.textClass : 'text-xs font-bold';
  const statusDotClass = cfg ? cfg.statusDotClass : 'w-2.5 h-2.5 -bottom-0.5 -right-0.5 border-2';

  const defaultTitle = title || `${effectiveName} (@${effectiveAccount}) - ${effectiveRole}`;

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 select-none ${sizeClass} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      title={defaultTitle}
    >
      <div
        className={`w-full h-full ${roundedClass} overflow-hidden flex items-center justify-center shadow-xs transition-transform duration-150 ${
          effectiveAvatarUrl ? 'bg-slate-800' : `bg-gradient-to-tr ${roleGrad}`
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
          <span className={`${textClass} text-white tracking-wider`}>{initials}</span>
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
