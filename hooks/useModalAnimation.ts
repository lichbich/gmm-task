'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Global reference counter for open modals across the entire app
let modalScrollLockCount = 0;
let originalBodyOverflow = '';
let originalHtmlOverflow = '';

export function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  modalScrollLockCount++;
  if (modalScrollLockCount === 1) {
    originalBodyOverflow = document.body.style.overflow;
    originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('modal-scroll-locked');
    document.documentElement.classList.add('modal-scroll-locked');
  }
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  modalScrollLockCount = Math.max(0, modalScrollLockCount - 1);
  if (modalScrollLockCount === 0) {
    document.body.style.overflow = originalBodyOverflow || '';
    document.documentElement.style.overflow = originalHtmlOverflow || '';
    document.body.classList.remove('modal-scroll-locked');
    document.documentElement.classList.remove('modal-scroll-locked');
  }
}

export interface UseModalAnimationOptions {
  lockScroll?: boolean;
  onRequestClose?: () => boolean | void;
}

export function useModalAnimation(
  isOpen: boolean,
  onClose: () => void,
  onRequestCloseOrOptions?: (() => boolean | void) | UseModalAnimationOptions
) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const isMouseDownOnBackdrop = useRef(false);

  const onRequestClose =
    typeof onRequestCloseOrOptions === 'function'
      ? onRequestCloseOrOptions
      : onRequestCloseOrOptions?.onRequestClose;

  const shouldLockScroll =
    typeof onRequestCloseOrOptions === 'object' && onRequestCloseOrOptions?.lockScroll !== undefined
      ? onRequestCloseOrOptions.lockScroll
      : true;

  const onRequestCloseRef = useRef(onRequestClose);

  useEffect(() => {
    onRequestCloseRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 15);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll while modal is actively rendered
  useEffect(() => {
    if (!shouldLockScroll || !isRendered) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isRendered, shouldLockScroll]);

  const forceClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (onRequestCloseRef.current) {
      const allowed = onRequestCloseRef.current();
      if (allowed === false) {
        return;
      }
    }
    forceClose();
  }, [forceClose]);

  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    isMouseDownOnBackdrop.current = e.target === e.currentTarget;
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (isMouseDownOnBackdrop.current && e.target === e.currentTarget) {
        handleClose();
      }
      isMouseDownOnBackdrop.current = false;
    },
    [handleClose]
  );

  // Handle ESC key to smoothly close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  return {
    isRendered,
    isVisible,
    handleClose,
    forceClose,
    handleBackdropMouseDown,
    handleBackdropClick,
    backdropProps: {
      onMouseDown: handleBackdropMouseDown,
      onClick: handleBackdropClick,
    },
  };
}

