import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import Lenis from 'lenis';

/**
 * Smooth-momentum scroll for the landing page only. Report/Inbox stay on
 * native scroll: Lenis intercepting wheel/touch events over form inputs is
 * more friction than polish for a compose-and-submit flow.
 *
 * Skipped entirely under prefers-reduced-motion. Native scroll is already
 * correct there, and Lenis' easing is exactly the kind of motion that
 * preference exists to opt out of.
 *
 * @param onScroll Called on every Lenis scroll frame. The landing page passes
 *   `ScrollTrigger.update` here: Lenis moves the page with a transform-free
 *   scrollTo on its own rAF loop, and without this hand-off ScrollTrigger only
 *   samples on the browser's native scroll event and the pinned privacy morph
 *   lags visibly behind the pointer.
 * @returns The live instance (null under reduced motion, or before mount), so
 *   callers can drive programmatic scrolls through the same easing the wheel
 *   uses instead of fighting it with scrollIntoView.
 */
export function useLenis(onScroll?: () => void): RefObject<Lenis | null> {
  const lenisRef = useRef<Lenis | null>(null);
  // Held in a ref so a caller passing an inline arrow does not tear down and
  // rebuild the whole scroll instance on every render.
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({ autoRaf: true });
    lenis.on('scroll', () => onScrollRef.current?.());
    lenisRef.current = lenis;

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return lenisRef;
}
