import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  return matches;
}

export function useIsMobile() {
  return useMediaQuery('(max-width: 768px)');
}

export function useIsTablet() {
  return useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  
  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Check mobile devices
    const isMobile = window.innerWidth < 768;
    
    // Check low-end devices (<= 4 CPU cores or <= 4GB RAM)
    const isLowEnd = navigator.hardwareConcurrency <= 4 || 
                    (navigator as any).deviceMemory <= 4;
    
    // Reduce motion if any condition is met
    setReduced(prefersReduced || isMobile || isLowEnd);
  }, []);
  
  return reduced;
}
