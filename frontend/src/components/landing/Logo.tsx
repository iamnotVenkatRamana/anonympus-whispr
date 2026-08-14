/**
 * The brand mark: a featureless hooded figure.
 *
 * One solid silhouette (hood plus shoulders) with the face punched out as
 * negative space via fill-rule evenodd, so the void is genuinely empty rather
 * than a lighter shape painted on top. That matters for the two places this
 * has to survive: it inherits currentColor, so the hole shows the dark navbar
 * through it and the light footer through it, with no second colour involved.
 *
 * There are no features inside the void on purpose. The absence is the mark.
 *
 * Geometry notes, for anyone editing it: the shape sits inside 32x32 with an
 * even 2.6 unit margin on all four sides, so it stays centred when used as a
 * standalone square avatar. The hood rim is ~4.5 units thick at its narrowest,
 * which is what keeps the void from closing up at 16px.
 */
export function Logo({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16 2.6c5.2 0 9.4 4.4 9.4 10 0 3-.8 5.4-2.2 7 3.8 1.6 6.2 5.2 6.2 9.8H2.6c0-4.6 2.4-8.2 6.2-9.8-1.4-1.6-2.2-4-2.2-7 0-5.6 4.2-10 9.4-10zM16 8c-2.7 0-4.9 2.6-4.9 5.9s2.2 5.9 4.9 5.9 4.9-2.6 4.9-5.9S18.7 8 16 8z"
      />
    </svg>
  );
}
