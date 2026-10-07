'use client';

import { useRef, useEffect, useCallback } from 'react';
import { lockBodyScroll, unlockBodyScroll } from './useModalAnimation';

export interface UseHoverScrollLockOptions {
  /** Also lock scroll immediately if on small mobile screens when open */
  lockOnMobile?: boolean;
}

/**
 * Hook to lock background body scroll ONLY when the mouse cursor is hovered over
 * or interacting with a floating popup/widget, and release the lock when the mouse leaves.
 */
export function useHoverScrollLock(isOpen: boolean, options: UseHoverScrollLockOptions = {}) {
  const isLockedRef = useRef(false);
  const { lockOnMobile = true } = options;

  const lock = useCallback(() => {
    if (!isLockedRef.current) {
      isLockedRef.current = true;
      lockBodyScroll();
    }
  }, []);

  const unlock = useCallback(() => {
    if (isLockedRef.current) {
      isLockedRef.current = false;
      unlockBodyScroll();
    }
  }, []);

  // When isOpen state changes or component unmounts
  useEffect(() => {
    if (!isOpen) {
      unlock();
    } else {
      // On mobile screens (< 640px), popups usually take up the screen with a backdrop, lock on open
      if (lockOnMobile && typeof window !== 'undefined' && window.innerWidth < 640) {
        lock();
      }
    }

    return () => {
      unlock();
    };
  }, [isOpen, lockOnMobile, lock, unlock]);

  const handleMouseEnter = useCallback(() => {
    if (!isOpen) return;
    lock();
  }, [isOpen, lock]);

  const handleMouseLeave = useCallback((e?: React.MouseEvent) => {
    // Prevent false unlocks when moving between child elements inside the container
    if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    // On small mobile screens, keep locked while open
    if (lockOnMobile && typeof window !== 'undefined' && window.innerWidth < 640) {
      return;
    }
    unlock();
  }, [lockOnMobile, unlock]);

  const handleWheel = useCallback(() => {
    if (!isOpen) return;
    if (!isLockedRef.current) {
      lock();
    }
  }, [isOpen, lock]);

  return {
    isHoverLocked: isLockedRef.current,
    hoverScrollProps: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onWheel: handleWheel,
    },
    lock,
    unlock,
  };
}
