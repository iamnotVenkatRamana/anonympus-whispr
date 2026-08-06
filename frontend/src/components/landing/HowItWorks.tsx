import { NETWORK_LABEL } from './facts';

const STEPS = [
  {
    index: '01',
    title: 'write it down',
    body: 'your report is typed into a form that never posts it anywhere. it stays in the memory of your own browser tab.',
    crypto: 'stays in memory · never transmitted',
  },
  {
    index: '02',
    title: 'sealed to the org',
    body: "the browser fetches the organization's public key from the chain and seals your words to it under a one-time sender key, then throws that key away.",
    crypto: 'tweetnacl · ephemeral keypair · 512-byte envelope',
  },
  {
    index: '03',
    title: 'only they can open it',
    body: 'the sealed envelope is published. anyone can check it exists; only the holder of the recipient secret key can read it, on their own machine.',
    crypto: `zero-knowledge · midnight ${NETWORK_LABEL}`,
  },
];

/**
 * Three steps in the light world. The crypto sublabels are set in mono
 * deliberately: the plain line is for the person deciding whether to trust
 * this, the mono line is for the person auditing it.
 */
export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="w-full px-6 py-28 md:px-10 md:py-40"
      style={{ backgroundColor: 'var(--paper)', color: 'var(--text-light)' }}
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="max-w-2xl text-[8vw] leading-[1.05] font-medium tracking-tight lowercase md:text-[3vw]">
          how it works
        </h2>

        <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
          {STEPS.map((step) => (
            <li key={step.index}>
              <p className="mono text-[12px]" style={{ color: 'var(--muted-light)' }}>
                {step.index}
              </p>
              <div
                className="mt-4 h-px w-full"
                style={{ backgroundColor: 'var(--paper-line)' }}
                aria-hidden="true"
              />
              <h3 className="mt-6 text-2xl font-medium lowercase">{step.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed lowercase" style={{ color: 'var(--muted-light)' }}>
                {step.body}
              </p>
              <p className="mono mt-5 text-[12px]" style={{ color: 'var(--text-light)' }}>
                {step.crypto}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
