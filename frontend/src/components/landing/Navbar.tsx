import { Link } from 'react-router-dom';

import { Logo } from './Logo';

type NavbarProps = {
  /** Scrolls to an in-page section id through the page's own smooth scroll. */
  onJump: (id: string) => void;
};

const LINK_CLASS =
  'rounded-full px-5 py-2 text-sm text-neutral-300 transition-colors hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70';

/**
 * Floating pill navbar. Three pills rather than one bar: the brand and the
 * primary action stay reachable on mobile while the section links, which have
 * no meaning on a small screen where the whole page is one scroll, drop out.
 */
export function Navbar({ onJump }: NavbarProps) {
  return (
    <div className="absolute top-0 right-0 left-0 z-20 px-6 pt-6 md:px-10">
      <nav className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 rounded-full bg-neutral-900/90 py-3 pr-6 pl-4 backdrop-blur">
          {/* No colour class: the mark takes currentColor from its context. */}
          <Logo className="size-5" />
          <span className="text-sm font-normal tracking-tight text-white lowercase">
            anonymous whispers
          </span>
        </div>

        {/*
          Appears at lg, not md: at ~800px the three pills together overflow
          the row and the "make a report" button gets pushed off screen.
        */}
        <div className="hidden items-center gap-1 rounded-full bg-neutral-900/90 px-3 py-2 backdrop-blur lg:flex">
          <button type="button" className={LINK_CLASS} onClick={() => onJump('how-it-works')}>
            how it works
          </button>
          <button type="button" className={LINK_CLASS} onClick={() => onJump('privacy')}>
            privacy
          </button>
          <button type="button" className={LINK_CLASS} onClick={() => onJump('sdk')}>
            sdk
          </button>
          <Link to="/report" className={LINK_CLASS}>
            report
          </Link>
          <Link to="/inbox" className={LINK_CLASS}>
            inbox
          </Link>
        </div>

        <Link
          to="/report"
          className="rounded-full bg-white px-6 py-3 text-sm font-normal text-black transition-colors hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
        >
          make a report
        </Link>
      </nav>
    </div>
  );
}
