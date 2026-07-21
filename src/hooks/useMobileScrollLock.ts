import { useEffect, useState } from 'react';

/**
 * Custom hook to detect mobile viewports and perfectly lock document body
 * scrolling to prevent rubber-band scrolling and layout shifts ("jumping").
 * 
 * @param isLocked Whether the lock is active (e.g. modal lies open)
 */
export function useMobileScrollLock(isLocked: boolean) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if matching mobile dimensions or user-agent indicators
    const checkIsMobile = () => {
      const isMobileSize = window.matchMedia('(max-width: 768px)').matches;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(isMobileSize || hasTouch);
    };

    // Initialize check
    checkIsMobile();

    // Listen to resize changes to handle live responsive debugging smoothly
    window.addEventListener('resize', checkIsMobile);
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  useEffect(() => {
    // We only trigger scroll lock behavior on mobile dimensions
    if (!isMobile || !isLocked) return;

    // Capture precise scroll coordinates to prevent body from jumping
    const scrollY = window.scrollY;

    // Apply strict non-scrollable configuration
    const originalStyleOverflow = document.body.style.overflow;
    const originalStylePosition = document.body.style.position;
    const originalStyleTop = document.body.style.top;
    const originalStyleWidth = document.body.style.width;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      // Revert styles safely
      document.body.style.position = originalStylePosition;
      document.body.style.overflow = originalStyleOverflow;
      document.body.style.top = originalStyleTop;
      document.body.style.width = originalStyleWidth;

      // Scroll back to verified historical scroll container offset
      window.scrollTo(0, scrollY);
    };
  }, [isMobile, isLocked]);

  return { isMobile };
}
