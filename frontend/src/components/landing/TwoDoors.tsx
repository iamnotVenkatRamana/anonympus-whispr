import { Link } from 'react-router-dom';

/**
 * The two doors into the app. Kept as two equal cards rather than a primary
 * and a secondary: a reporter and a compliance officer arrive with completely
 * different intentions, and neither should have to read past the other's copy
 * to find their own.
 */
export function TwoDoors() {
  return (
    <section
      className="w-full px-6 pb-28 md:px-10 md:pb-40"
      style={{ backgroundColor: 'var(--paper)', color: 'var(--text-light)' }}
    >
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
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
      className="group flex min-h-[16rem] flex-col justify-between rounded-3xl p-8 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/70 md:min-h-[20rem] md:p-10"
      style={{
        backgroundColor: 'var(--paper-surface)',
        border: '1px solid var(--paper-line)',
      }}
    >
      <p className="mono text-[11px] tracking-[0.22em] uppercase" style={{ color: 'var(--muted-light)' }}>
        {kicker}
      </p>
      <div>
        <h3 className="text-[8vw] leading-[1.05] font-medium tracking-tight lowercase md:text-[2.6vw]">
          {title}
        </h3>
        <p className="mt-4 text-[15px] lowercase" style={{ color: 'var(--muted-light)' }}>
          {body}
        </p>
        <span className="mt-6 inline-block text-[15px] lowercase underline decoration-1 underline-offset-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          continue
        </span>
      </div>
    </Link>
  );
}
