import { Logo } from './Logo';
import {
  CONTRACT_ADDRESS,
  EXPLORER_URL,
  GITHUB_URL,
  LIVE_DEMO_URL,
  NETWORK_LABEL,
  X_URL,
} from './facts';

/**
 * The technical trust markers, then the door closing behind you.
 *
 * The contract address is a real deployed address rather than a
 * paste-after-deploy placeholder, and it links to the explorer, because the
 * one claim on this page a sceptic will actually check is whether the thing
 * exists on chain.
 */
export function TechStripFooter() {
  return (
    <>
      <section
        className="w-full border-t px-6 py-10 md:px-10"
        style={{
          backgroundColor: 'var(--paper)',
          borderColor: 'var(--paper-line)',
          color: 'var(--muted-light)',
        }}
      >
        <div className="mono mx-auto flex max-w-5xl flex-col gap-4 text-[12px] md:flex-row md:items-center md:justify-between">
          <p>
            midnight {NETWORK_LABEL} · compact contract · curve25519 · zk proofs
          </p>
          <p className="flex min-w-0 items-center gap-2">
            <span>contract</span>
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate underline decoration-1 underline-offset-4 transition-colors hover:text-black"
              style={{ color: 'var(--text-light)' }}
              title={`${CONTRACT_ADDRESS} (view on Midnight Explorer)`}
            >
              {CONTRACT_ADDRESS}
            </a>
          </p>
        </div>
      </section>

      <footer className="w-full bg-black px-6 py-20 text-white md:px-10 md:py-28">
        <div className="mx-auto max-w-5xl">
          <p className="max-w-3xl text-[7vw] leading-[1.05] font-medium tracking-tight lowercase md:text-[3vw]">
            some things should only ever travel in the dark.
          </p>

          <div className="mt-16 flex flex-col gap-8 border-t border-white/15 pt-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Logo className="size-5" />
              <span className="text-sm tracking-tight lowercase">anonymous whispers</span>
            </div>

            <nav className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm lowercase">
              <FooterLink href={GITHUB_URL}>github</FooterLink>
              {/* PLACEHOLDER. X handle not registered yet. */}
              <FooterLink href={X_URL}>x / @anonwhispers</FooterLink>
              {/* PLACEHOLDER. Filled in with the Vercel URL after deploy. */}
              <FooterLink href={LIVE_DEMO_URL}>live demo</FooterLink>
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}

function FooterLink({ href, children }: { href: string; children: string }) {
  const isPlaceholder = href === '#';
  return (
    <a
      href={href}
      target={isPlaceholder ? undefined : '_blank'}
      rel={isPlaceholder ? undefined : 'noopener noreferrer'}
      // A dead placeholder link should look reachable but not pretend to work,
      // so it is dimmed and marked rather than silently jumping to the top.
      aria-disabled={isPlaceholder || undefined}
      className={`transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${
        isPlaceholder ? 'text-white/40' : 'text-white/70'
      }`}
    >
      {children}
    </a>
  );
}
