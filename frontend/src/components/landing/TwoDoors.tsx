import { useRef } from 'react';
import { Link } from 'react-router-dom';

import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import { NETWORK_LABEL } from './facts';

/**
 * The two doors into the running app, now framed as what they actually are:
 * a reference implementation of the sdk, deployed and usable, rather than the
 * whole of the product.
 */
export function TwoDoors({ reducedMotion }: { reducedMotion: boolean }) {
  const rootRef = useRef<HTMLElement | null>(null);
  useRevealOnScroll(rootRef, reducedMotion);

  return (
    <section
      ref={rootRef}
      className="w-full px-6 pt-16 pb-28 md:px-10 md:pt-24 md:pb-40"
      style={{ color: 'var(--text-light)' }}
    >
      <div className="mx-auto max-w-5xl">
        <p data-reveal className="eyebrow">
          the sample app, running live
        </p>
        <h2
          data-reveal
          className="mt-5 max-w-3xl text-[9vw] leading-[1.02] font-semibold tracking-tight lowercase md:text-[3.2vw]"
        >
          anonymous whispers
        </h2>
        <p
          data-reveal
          className="mt-6 max-w-2xl text-[16px] leading-relaxed lowercase"
          style={{ color: 'var(--muted-light)' }}
        >
          the reference implementation, built on the four calls above and deployed on
          midnight {NETWORK_LABEL}. both halves of it are open below. read the source to see
          exactly how little there is between a message and its envelope.
        </p>

        <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-2">
          <Door
            to="/report"
            kicker="for reporters"
            title="make a report"
            body="no sign-in, no name, no way back to you."
          />
          <Door
            to="/inbox"
            kicker="for organizations"
            title="open the inbox"
            body="register your key, read what only you can decrypt."
          />
        </div>
      </div>
    </section>
  );
}

function Door({
  to,
  kicker,
  title,
  body,
}: {
  to: string;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      data-reveal
      className="surface surface-lift group flex min-h-[15rem] flex-col justify-between p-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black/60 md:min-h-[18rem] md:p-10"
    >
      <p className="eyebrow">{kicker}</p>
      <div>
        <h3 className="text-[8vw] leading-[1.02] font-semibold tracking-tight lowercase md:text-[2.4vw]">
          {title}
        </h3>
        <p className="mt-4 text-[15px] lowercase" style={{ color: 'var(--muted-light)' }}>
          {body}
        </p>
        <span className="mt-6 inline-flex items-center gap-2 text-[15px] lowercase">
          <span className="underline decoration-1 underline-offset-4">continue</span>
          <span
            className="transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden="true"
          >
            &rsaquo;
          </span>
        </span>
      </div>
    </Link>
  );
}
