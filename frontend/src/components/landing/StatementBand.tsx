/**
 * The thesis, alone on black. No supporting paragraph on purpose: the whole
 * product argument is that a promise and a proof are different things, and
 * padding it with detail would soften it.
 */
export function StatementBand() {
  return (
    <section className="w-full bg-black px-6 py-32 md:px-10 md:py-48">
      <p className="mx-auto max-w-4xl text-[7vw] leading-[1.05] font-medium tracking-tight text-white lowercase md:text-[3.4vw]">
        a promise of anonymity is worth nothing. so we make it mathematically
        impossible to know it was you.
      </p>
    </section>
  );
}
