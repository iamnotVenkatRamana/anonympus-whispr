import { useRef } from 'react';

import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import { NETWORK_LABEL } from './facts';

const STEPS = [
  {
    index: '01',
    title: 'write it down',
    body: "the message is composed in the sender's own browser tab and posted nowhere. no draft, no autosave, no server that has ever seen it.",
    crypto: 'stays in memory · never transmitted',
  },
  {
    index: '02',
    title: 'sealed to the recipient',
    body: "the sdk reads the recipient's public key off the chain and seals the message to it under a fresh sender keypair, then discards that keypair. two messages from one person cannot be linked.",
    crypto: 'tweetnacl · ephemeral keypair · 512-byte envelope',
  },
  {
    index: '03',
    title: 'only they can open it',
    body: "the sealed envelope goes on chain with a proof that it is well formed. anyone can audit that it exists. only the secret key opens it, on the holder's own machine.",
    crypto: `zero-knowledge · midnight ${NETWORK_LABEL}`,
  },
];

/**
 * The flow, framed as the thing the SDK does rather than the thing this one
 * app does. Same three steps as before because the steps were right; the copy
 * now says "the sender" and "the recipient" instead of naming a whistleblower
 * and an organization, since the next section widens it out.
 */
export function HowItWorks({ reducedMotion }: { reducedMotion: boolean }) {
  const rootRef = useRef<HTMLElement | null>(null);
  useRevealOnScroll(rootRef, reducedMotion);

  return (
    <section
      id="how-it-works"
      ref={rootRef}
      className="w-full px-6 pt-28 pb-16 md:px-10 md:pt-40 md:pb-24"
      style={{ color: 'var(--text-light)' }}
    >
      <div className="mx-auto max-w-5xl">
        <p data-reveal className="eyebrow">
          the primitive
        </p>
        <h2
          data-reveal
          className="mt-5 max-w-2xl text-[9vw] leading-[1.02] font-semibold tracking-tight lowercase md:text-[3.2vw]"
        >
          how it works
        </h2>

        <ol className="mt-14 grid gap-6 md:mt-20 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.index} data-reveal className="surface surface-lift p-7 md:p-8">
              {/* An ordinal, not machine output, so it stays off mono. */}
              <p className="eyebrow">{step.index}</p>
              <h3 className="mt-6 text-2xl font-semibold lowercase">{step.title}</h3>
              <p
                className="mt-4 text-[15px] leading-relaxed lowercase"
                style={{ color: 'var(--muted-light)' }}
              >
                {step.body}
              </p>
              <p
                className="mono mt-7 border-t pt-5 text-[12px]"
                style={{ borderColor: 'rgb(10 10 11 / 0.08)' }}
              >
                {step.crypto}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
