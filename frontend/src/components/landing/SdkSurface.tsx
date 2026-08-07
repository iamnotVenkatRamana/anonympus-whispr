import { useRef } from 'react';

import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';

/**
 * The four calls, named as they exist in this repo today rather than as an
 * aspirational API. src/lib/crypto.ts really does export
 * generateRecipientKeypair, encryptToRecipient and decryptWithRecipientKey;
 * the submit step is the contract call in src/lib/contract.ts. Naming them
 * honestly matters more than naming them prettily, because a developer
 * evaluating this will open the files.
 */
const SURFACE = [
  {
    label: 'manage keys',
    call: 'generateRecipientKeypair()',
    body: 'make a recipient keypair in the browser, publish the public half on chain, keep the secret half where it was made.',
  },
  {
    label: 'encrypt',
    call: 'encryptToRecipient()',
    body: 'seal a message to that published key under a single-use sender keypair that is destroyed immediately after.',
  },
  {
    label: 'submit',
    call: 'submitEncrypted()',
    body: 'publish the sealed envelope and its hash through the contract, with a proof that the submission is well formed.',
  },
  {
    label: 'decrypt',
    call: 'decryptWithRecipientKey()',
    body: 'open the envelope client side. the secret key never travels, so there is no server that could be compelled to reveal it.',
  },
];

/**
 * Introduces the actual product. Everything above this point on the page
 * describes one app; this is the section that says the app is a demonstration
 * and the reusable piece is the point.
 */
export function SdkSurface({ reducedMotion }: { reducedMotion: boolean }) {
  const rootRef = useRef<HTMLElement | null>(null);
  useRevealOnScroll(rootRef, reducedMotion);

  return (
    <section
      id="sdk"
      ref={rootRef}
      className="w-full px-6 py-16 md:px-10 md:py-24"
      style={{ color: 'var(--text-light)' }}
    >
      <div className="mx-auto max-w-5xl">
        <p data-reveal className="eyebrow">
          the sdk
        </p>
        <h2
          data-reveal
          className="mt-5 max-w-3xl text-[9vw] leading-[1.02] font-semibold tracking-tight lowercase md:text-[3.2vw]"
        >
          one building block, any private channel
        </h2>
        <p
          data-reveal
          className="mt-6 max-w-2xl text-[16px] leading-relaxed lowercase"
          style={{ color: 'var(--muted-light)' }}
        >
          encrypt to a published key, throw the sender key away, let only the holder of the
          secret key read it. that primitive is not specific to whistleblowing. it is the
          shape of every channel where someone has to be able to speak without being
          identified afterwards.
        </p>

        <div className="mt-14 grid gap-6 md:mt-16 md:grid-cols-2">
          {SURFACE.map((item, index) => (
            <article key={item.call} data-reveal className="surface surface-lift p-7 md:p-8">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-xl font-semibold lowercase">{item.label}</h3>
                <span className="eyebrow" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <p
                className="mono mt-5 truncate text-[13px]"
                style={{ color: 'var(--text-light)' }}
                title={item.call}
              >
                {item.call}
              </p>
              <p
                className="mt-4 text-[15px] leading-relaxed lowercase"
                style={{ color: 'var(--muted-light)' }}
              >
                {item.body}
              </p>
            </article>
          ))}
        </div>

        <p data-reveal className="mt-12 max-w-2xl text-[16px] leading-relaxed lowercase">
          drop it into your own midnight app instead of rebuilding the crypto, key handling,
          and proofs.
        </p>
      </div>
    </section>
  );
}
