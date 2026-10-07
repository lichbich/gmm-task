'use client';

import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

export const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const shouldShow = window.scrollY > 300;
      setIsVisible((prev) => (prev !== shouldShow ? shouldShow : prev));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className={`group fixed bottom-[138px] right-5 sm:bottom-[86px] sm:right-7 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-xs text-slate-700 dark:text-slate-200 hover:text-white hover:bg-indigo-600 dark:hover:bg-indigo-600 border border-slate-200/90 dark:border-slate-700 shadow-md hover:shadow-lg hover:shadow-indigo-500/20 flex items-center justify-center cursor-pointer active:scale-90 transition-all duration-300 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-3 scale-90 pointer-events-none'
      }`}
      title="Lên đầu trang"
      aria-label="Lên đầu trang"
    >
      <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200 group-hover:-translate-y-0.5" />
    </button>
  );
};
