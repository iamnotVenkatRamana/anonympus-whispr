import { Link } from 'react-router-dom';

/**
 * Deliberately minimal: a reviewer (or a nervous whistleblower) must find
 * their path in seconds. Two doors, nothing else.
 */
export function Landing() {
  return (
    <section className="flex flex-col gap-6">
      <Link
        to="/report"
        className="focus-glow group rounded-2xl border border-edge bg-surface/50 p-10 transition-colors hover:border-signal/40"
      >
        <p className="text-sm tracking-[0.25em] text-signal uppercase">For reporters</p>
        <p className="mt-3 text-2xl font-medium text-bright">I want to submit a report</p>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-dim">
          Write your report, encrypt it in your browser to the organization's key, and
          publish only the sealed envelope. Your identity and your words stay yours.
        </p>
        <p className="mt-5 text-sm font-semibold text-signal group-hover:underline">
          Go to the report form
        </p>
      </Link>

      <Link
        to="/inbox"
        className="focus-glow group rounded-2xl border border-edge bg-surface/30 p-10 transition-colors hover:border-signal/40"
      >
        <p className="text-sm tracking-[0.25em] text-signal uppercase">For organizations</p>
        <p className="mt-3 text-2xl font-medium text-bright">I'm an organization</p>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-dim">
          Register a recipient key on-chain, then read submissions that only you can
          decrypt. The secret key never leaves your machine.
        </p>
        <p className="mt-5 text-sm font-semibold text-signal group-hover:underline">
          Go to the inbox
        </p>
      </Link>
    </section>
  );
}
