'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function NavigationProgress() {
  const router = useRouter();
  const progressRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showProgress = () => {
    if (progressRef.current) {
      progressRef.current.style.opacity = '1';
      progressRef.current.style.width = '70%';
    }
  };

  const completeProgress = () => {
    if (progressRef.current) {
      progressRef.current.style.width = '100%';
      timeoutRef.current = setTimeout(() => {
        if (progressRef.current) {
          progressRef.current.style.opacity = '0';
          timeoutRef.current = setTimeout(() => {
            if (progressRef.current) {
              progressRef.current.style.width = '0%';
            }
          }, 300);
        }
      }, 300);
    }
  };

  useEffect(() => {
    showProgress();
    completeProgress();
  }, []);

  useEffect(() => {
    const handleStart = () => showProgress();
    const handleStop = () => completeProgress();

    window.addEventListener('load', handleStop);
    return () => {
      window.removeEventListener('load', handleStop);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={progressRef}
      className="fixed top-0 left-0 h-1 bg-gradient-to-r from-[#d8b960] to-[#c9a84c] transition-all duration-500 ease-out opacity-0 z-50"
      style={{ width: '0%' }}
    />
  );
}
