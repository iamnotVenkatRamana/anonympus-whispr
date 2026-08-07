import { useCallback } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { Hero } from '../components/landing/Hero';
import { HowItWorks } from '../components/landing/HowItWorks';
import { PrivacyMorph } from '../components/landing/PrivacyMorph';
import { SdkSurface } from '../components/landing/SdkSurface';
import { StatementBand } from '../components/landing/StatementBand';
import { SiteFooter, TechStrip } from '../components/landing/TechStripFooter';
import { TwoDoors } from '../components/landing/TwoDoors';
import { UseCases } from '../components/landing/UseCases';
import { useLenis } from '../hooks/useLenis';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * The immersive landing page. Rendered outside the app Shell (see App.tsx):
 * every section here is full-bleed, and the Shell's centred max-w-3xl column
 * and wallet header belong to /report and /inbox, not to this page.
 *
 * The page argues in one direction: here is a channel nobody can trace, here
 * is exactly what an observer sees, here is the reusable piece that does it,
 * here is everywhere else it applies, and here is the sample app running.
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
    <main className="landing w-full bg-black">
      <Hero reducedMotion={reducedMotion} onJump={jumpTo} />
      <StatementBand />
      <PrivacyMorph reducedMotion={reducedMotion} />

      {/*
        One continuous light surface from the morph's resolved paper value all
        the way down to the footer, so the four sections inside read as one
        world rather than four stacked white blocks.
      */}
      <div className="light-world">
        <HowItWorks reducedMotion={reducedMotion} />
        <SdkSurface reducedMotion={reducedMotion} />
        <UseCases reducedMotion={reducedMotion} />
        <TwoDoors reducedMotion={reducedMotion} />
        <TechStrip />
      </div>

      <SiteFooter />
    </main>
  );
}
