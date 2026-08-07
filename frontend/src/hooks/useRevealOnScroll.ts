import { useEffect } from 'react';
import type { RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Staggered fade-and-rise for every `[data-reveal]` inside a section, fired
 * once when that section comes into view.
 *
 * Same vocabulary as the dark half of the page: short travel, quick ease, no
 * bounce. The light world earns its motion from cards arriving in sequence
 * rather than from anything moving far.
 *
 * fromTo rather than from, deliberately. Under StrictMode's double mount a
 * `from` tween reads the element's mid-flight state as its destination and can
 * strand a card at partial opacity forever; stating both ends makes the tween
 * idempotent however many times the effect runs.
 *
 * Under reduced motion nothing runs, and because the resting state is what the
 * markup already renders, the cards are simply there.
 */
export function useRevealOnScroll(
  scopeRef: RefObject<HTMLElement | null>,
  reducedMotion: boolean,
): void {
  useEffect(() => {
    if (reducedMotion) return;
    const scope = scopeRef.current;
    if (!scope) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-reveal]',
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power2.out',
          stagger: 0.09,
          scrollTrigger: {
            trigger: scope,
            // Fires with the section a fifth of the way up the viewport, so
            // the cards are already settling by the time they are being read.
            start: 'top 80%',
            once: true,
          },
        },
      );
    }, scopeRef);

    return () => ctx.revert();
  }, [scopeRef, reducedMotion]);
}
