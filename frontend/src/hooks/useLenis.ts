import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Smooth-momentum scroll for the landing page only. Report/Inbox stay on
 * native scroll: Lenis intercepting wheel/touch events over form inputs is
 * more friction than polish for a compose-and-submit flow.
 *
 * Skipped entirely under prefers-reduced-motion — native scroll is already
 * correct there, and Lenis' easing is exactly the kind of motion that
 * preference exists to opt out of.
 */
export function useLenis(): void {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({ autoRaf: true });
    return () => lenis.destroy();
  }, []);
}
