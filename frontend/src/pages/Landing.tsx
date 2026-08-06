import { useCallback } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { Hero } from '../components/landing/Hero';
import { HowItWorks } from '../components/landing/HowItWorks';
import { PrivacyMorph } from '../components/landing/PrivacyMorph';
import { StatementBand } from '../components/landing/StatementBand';
import { TechStripFooter } from '../components/landing/TechStripFooter';
import { TwoDoors } from '../components/landing/TwoDoors';
import { useLenis } from '../hooks/useLenis';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * The immersive landing page. Rendered outside the app Shell (see App.tsx):
 * every section here is full-bleed, and the Shell's centred max-w-3xl column
 * and wallet header belong to /report and /inbox, not to this page.
 */
export function Landing() {
  // `?rm=1` forces the reduced-motion rendering without changing an OS
  // setting. Kept because the resolved end-state of the privacy morph is
  // otherwise only reachable by scrolling, which makes it awkward to check.
  const reducedMotion =
    useReducedMotion() || new URLSearchParams(window.location.search).has('rm');
  // Lenis drives the page; ScrollTrigger has to be told when it moves.
  const lenisRef = useLenis(() => ScrollTrigger.update());

  const jumpTo = useCallback(
    (id: string) => {
      const target = document.getElementById(id);
      if (!target) return;
      // Going through Lenis keeps the jump on the same easing as the wheel.
      // Without it (reduced motion), native scrolling is already what the
      // user asked for, so jump instantly rather than smooth-scrolling.
      if (lenisRef.current) lenisRef.current.scrollTo(target, { offset: 0 });
      else target.scrollIntoView({ behavior: 'auto', block: 'start' });
    },
    [lenisRef],
  );

  return (
    <main className="w-full bg-black">
      <Hero reducedMotion={reducedMotion} onJump={jumpTo} />
      <StatementBand />
      <PrivacyMorph reducedMotion={reducedMotion} />
      <HowItWorks />
      <TwoDoors />
      <TechStripFooter />
    </main>
  );
}
