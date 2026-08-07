import { useRef } from 'react';

import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';

/**
 * Six channels with the same shape: many untrusted senders, one accountable
 * recipient, content that has to stay sealed. Each differs only in who
 * registers the recipient key and where its fingerprint gets published.
 */
const CASES = [
  {
    title: 'anonymous whistleblowing',
    body: 'compliance channels where the reporter was never identified in the first place, so there is nothing to hand over later.',
  },
  {
    title: 'healthcare incident reports',
    body: 'clinicians flag unsafe practice without attaching their name to a complaint about the people who write their rota.',
  },
  {
    title: 'confidential hr channels',
    body: 'conduct and harassment reports that reach one named desk and are readable nowhere else in the company.',
  },
  {
    title: 'government tip lines',
    body: 'members of the public submit what they know without an account, a login, or a trail leading back to their door.',
  },
  {
    title: "protecting journalists' sources",
    body: 'a source hands over documents through a channel that holds no record capable of unmasking them.',
  },
  {
    title: 'academic misconduct reporting',
    body: 'raise a concern about a supervisor or a lab without staking your own position on how it is received.',
  },
];

/** The breadth argument, made concrete. */
export function UseCases({ reducedMotion }: { reducedMotion: boolean }) {
  const rootRef = useRef<HTMLElement | null>(null);
  useRevealOnScroll(rootRef, reducedMotion);

  return (
    <section
      id="use-cases"
      ref={rootRef}
      className="w-full px-6 py-16 md:px-10 md:py-24"
      style={{ color: 'var(--text-light)' }}
    >
      <div className="mx-auto max-w-5xl">
        <p data-reveal className="eyebrow">
          where it fits
        </p>
        <h2
          data-reveal
          className="mt-5 max-w-3xl text-[9vw] leading-[1.02] font-semibold tracking-tight lowercase md:text-[3.2vw]"
        >
          built once, useful everywhere someone needs to speak safely
        </h2>

        <ul className="mt-14 grid gap-5 md:mt-16 md:grid-cols-2 lg:grid-cols-3">
          {CASES.map((useCase) => (
            <li
              key={useCase.title}
              data-reveal
              className="surface surface-lift flex min-h-[13rem] flex-col justify-between p-6 md:p-7"
            >
              <h3 className="text-lg leading-snug font-semibold lowercase">{useCase.title}</h3>
              <p
                className="mt-5 text-[14px] leading-relaxed lowercase"
                style={{ color: 'var(--muted-light)' }}
              >
                {useCase.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
