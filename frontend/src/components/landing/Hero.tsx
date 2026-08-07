import { useEffect, useRef } from 'react';
import gsap from 'gsap';

import { HeroBackground } from './HeroBackground';
import { Navbar } from './Navbar';
import { NETWORK_LABEL } from './facts';

type HeroProps = {
  reducedMotion: boolean;
  onJump: (id: string) => void;
};

const WORDS = ['whisper', 'the', 'truth'];

/**
 * Full-screen hero, split down the middle: type on the left, figure on the
 * right.
 *
 * The figure was framed with open space on its left, so the headline lives in
 * that space as a plain left-aligned column. Reading order is top to bottom
 * with nothing to work out, and the face and the raised finger stay clear.
 *
 * On mobile there is no left half to use, so the column moves to the top of
 * the frame and an extra gradient darkens the type's own band. The figure
 * still reads underneath it rather than being covered by scattered words.
 */
export function Hero({ reducedMotion, onJump }: HeroProps) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // The resolved state is what the markup already renders; the animation
    // only ever plays it in. So under reduced motion there is nothing to do,
    // and nothing to clean up.
    if (reducedMotion) return;

    const ctx = gsap.context(() => {
      // fromTo, not from, on purpose. With `from`, StrictMode's double mount
      // starts a second tween that reads the element's mid-flight position as
      // its destination, and a word can end up parked at its start offset,
      // permanently off its line. Stating both ends makes the tween
      // idempotent however many times the effect runs.
      gsap.fromTo(
        '[data-hero-reveal]',
        { yPercent: 115 },
        {
          // Each word rises out of its own clip rectangle. The mask is what
          // makes this read as type revealing rather than type sliding, and
          // the stagger runs top to bottom, in reading order.
          yPercent: 0,
          duration: 1.1,
          ease: 'power3.out',
          stagger: 0.12,
        },
      );
      gsap.fromTo(
        '[data-hero-fade]',
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.08, delay: 0.5 },
      );
    }, rootRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section ref={rootRef} className="relative h-screen w-full overflow-hidden bg-black">
      <HeroBackground reducedMotion={reducedMotion} />

      {/*
        Mobile only: the type sits at the top of the frame over whatever the
        footage happens to be doing up there, so this band guarantees its
        contrast without darkening the figure lower down.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[62%] bg-gradient-to-b from-black/85 via-black/45 to-transparent md:hidden"
        aria-hidden="true"
      />

      <Navbar onJump={onJump} />

      <div className="relative flex h-full w-full flex-col justify-start pt-28 md:justify-center md:pt-0 md:pb-24">
        {/*
          The headline is one <h1> read as a single line by assistive tech.
          The visible words are separate blocks only so each can be masked and
          revealed on its own.
        */}
        <h1 className="w-full px-6 md:w-[56%] md:px-10 lg:w-[52%]">
          <span className="sr-only">whisper the truth</span>
          {WORDS.map((word) => (
            <span key={word} className="block overflow-hidden" aria-hidden="true">
              {/*
                Sized up hard from the grotesque these replaced: Fraunces sets
                about a third narrower at the same point size, so the previous
                9vw left the column two hundred pixels short of full. These
                values fill roughly three quarters of the column width while
                keeping all three lines clear of the navbar above and the stat
                row below at a 900px-tall viewport.
              */}
              <span
                data-hero-reveal
                className="hero-title block text-[23vw] font-semibold text-white md:text-[13vw] lg:text-[11.5vw]"
              >
                {word}
              </span>
            </span>
          ))}
        </h1>

        <p
          data-hero-fade
          className="mt-8 max-w-[26rem] px-6 text-[15px] leading-snug text-white/90 lowercase md:mt-10 md:px-10"
        >
          report wrongdoing to your organization without ever revealing who you are. it is
          encrypted in your browser, provable on midnight, and traceable to no one.
        </p>

        {/*
          All three stats sit in one bottom row, out of the headline column's
          way. They used to be scattered into the corners, which put one of
          them directly under the type once the type became a column.
        */}
        <div
          data-hero-fade
          className="absolute right-6 bottom-8 left-6 flex justify-between gap-6 md:right-20 md:bottom-14 md:left-auto md:justify-end md:gap-16"
        >
          <Stat value="0" label="identities stored" />
          <Stat value="100%" label="client-side encryption" />
          <Stat value="live" label={`on midnight ${NETWORK_LABEL}`} />
        </div>

        <div
          className="pointer-events-none absolute right-0 bottom-0 left-0 h-48 bg-gradient-to-b from-transparent to-black"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

/**
 * A stat block with its diagonal hairline divider. Every value here is
 * literally true of the deployed system. No vanity metrics, because a
 * reviewer will check, and a whistleblower has more at stake than a reviewer.
 */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="relative z-10 min-w-0">
      <p className="text-2xl font-medium text-white lowercase md:text-5xl">{value}</p>
      {/* Divider is decoration; it costs legibility on narrow screens. */}
      <div className="my-3 hidden h-px w-24 -rotate-[20deg] bg-white/40 md:block" aria-hidden="true" />
      <p className="mt-1 text-[11px] text-white/70 lowercase md:mt-0 md:text-sm">{label}</p>
    </div>
  );
}
