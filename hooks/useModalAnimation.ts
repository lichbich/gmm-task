'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export function useModalAnimation(isOpen: boolean, onClose: () => void) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const isMouseDownOnBackdrop = useRef(false);

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

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    isMouseDownOnBackdrop.current = e.target === e.currentTarget;
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (isMouseDownOnBackdrop.current && e.target === e.currentTarget) {
      handleClose();
    }
    isMouseDownOnBackdrop.current = false;
  }, [handleClose]);

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
    handleBackdropMouseDown,
    handleBackdropClick,
    backdropProps: {
      onMouseDown: handleBackdropMouseDown,
      onClick: handleBackdropClick,
    },
  };
}

