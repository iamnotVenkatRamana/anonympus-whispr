import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * The privacy model, as one scroll.
 *
 * Two worlds: the dark half is the reporter's device (private witness), the
 * light half is the public ledger. Scrolling carries the same report across
 * the boundary. The redaction bars retract to show what actually gets
 * published, and a proof rises alongside it. The point of the retraction is
 * that what comes out from under the bars is ciphertext, not prose: the chain
 * gains a verifiable record and still learns nothing about the author.
 *
 * This section is the README's "what an observer can and cannot learn"
 * diagram, made scrollable.
 */
export function PrivacyMorph({ reducedMotion }: { reducedMotion: boolean }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const headPrivateRef = useRef<HTMLHeadingElement | null>(null);
  const headPublicRef = useRef<HTMLHeadingElement | null>(null);
  const chipRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);

  // The label is text, not a style, so it flips discretely at the midpoint
  // rather than being interpolated. Held in state (guarded so it only ever
  // sets on an actual crossing) instead of written into the DOM by hand, so
  // React stays the owner of what the element says.
  const [isPublic, setIsPublic] = useState(reducedMotion);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const render = (p: number) => {
      // World colours. Everything downstream reads these custom properties,
      // so one write per frame repaints the entire scene.
      const world = smoothstep(0.12, 0.88, p);
      scene.style.setProperty('--world-bg', mixHex('#000000', '#f4f5f6', world));
      scene.style.setProperty('--world-text', mixHex('#f5f6f7', '#0a0a0b', world));
      scene.style.setProperty('--world-muted', mixHex('#8b8b93', '#5b5b63', world));
      scene.style.setProperty('--world-card', mixHex('#141416', '#ffffff', world));
      scene.style.setProperty('--world-line', mixHex('#26262a', '#dadce0', world));

      // Redaction bars retract left-to-right, each one trailing the last, so
      // the document uncovers as a sweep rather than a single snap.
      barsRef.current.forEach((bar, index) => {
        if (!bar) return;
        const start = 0.28 + index * 0.045;
        const scale = 1 - smoothstep(start, start + 0.3, p);
        bar.style.transform = `scaleX(${scale})`;
      });

      // Heading crossfade across the midpoint.
      if (headPrivateRef.current) {
        headPrivateRef.current.style.opacity = String(1 - smoothstep(0.36, 0.52, p));
      }
      if (headPublicRef.current) {
        headPublicRef.current.style.opacity = String(smoothstep(0.48, 0.64, p));
      }

      // The proof only exists once the report has been published, so the chip
      // rises in the back half.
      if (chipRef.current) {
        const rise = smoothstep(0.52, 0.86, p);
        chipRef.current.style.opacity = String(rise);
        chipRef.current.style.transform = `translateY(${(1 - rise) * 32}px)`;
      }

      const crossed = p >= 0.5;
      setIsPublic((current) => (current === crossed ? current : crossed));
    };

    if (reducedMotion) {
      // No scroll scene at all: paint the resolved end state once and leave it.
      render(1);
      return;
    }

    render(0);
    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => render(self.progress),
    });

    return () => trigger.kill();
  }, [reducedMotion]);

  return (
    <section
      id="privacy"
      ref={sectionRef}
      // 300vh of scroll against one sticky screen: the extra height is the
      // timeline the scene is scrubbed along.
      className={reducedMotion ? 'relative w-full' : 'relative h-[300vh] w-full'}
    >
      <div
        ref={sceneRef}
        className={`${
          reducedMotion ? 'relative' : 'sticky top-0'
        } flex h-screen w-full flex-col justify-center overflow-hidden px-6 md:px-10`}
        style={{ backgroundColor: 'var(--world-bg, #000)', color: 'var(--world-text, #fff)' }}
      >
        <div className="mx-auto w-full max-w-5xl">
          {/*
            The two headings are stacked absolutely so they can crossfade in
            place, which means this box has to reserve their height itself.
            Taller on mobile, where the line wraps three ways.
          */}
          <div className="relative mb-10 h-[3.8em] md:mb-14 md:h-[2.6em]">
            <h2
              ref={headPrivateRef}
              className="absolute inset-0 max-w-2xl text-[7vw] leading-[1.05] font-medium tracking-tight lowercase md:text-[2.8vw]"
            >
              what you write never leaves your device.
            </h2>
            <h2
              ref={headPublicRef}
              className="absolute inset-0 max-w-2xl text-[7vw] leading-[1.05] font-medium tracking-tight lowercase md:text-[2.8vw]"
              style={{ opacity: 0 }}
            >
              what the chain records can't identify you.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-[1.15fr_1fr] md:gap-10">
            <ReportDocument isPublic={isPublic} barsRef={barsRef} />
            <ProofChip chipRef={chipRef} reducedMotion={reducedMotion} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Six lines of ciphertext under six retractable redaction bars. */
function ReportDocument({
  isPublic,
  barsRef,
}: {
  isPublic: boolean;
  barsRef: RefObject<Array<HTMLSpanElement | null>>;
}) {
  return (
    <figure
      // min-w-0: the ciphertext lines are unbreakable nowrap strings, so a
      // grid item sized by its content would push the card wider than the
      // phone it is on.
      className="min-w-0 rounded-2xl p-6 md:p-8"
      style={{
        backgroundColor: 'var(--world-card, #141416)',
        border: '1px solid var(--world-line, #26262a)',
      }}
    >
      <figcaption
        className="mono text-[11px] tracking-[0.22em] uppercase"
        style={{ color: 'var(--world-muted, #8b8b93)' }}
      >
        {isPublic ? 'PUBLIC · ON-CHAIN' : 'PRIVATE · WITNESS'}
      </figcaption>

      <div className="mt-6 flex flex-col gap-3">
        {CIPHERTEXT_LINES.map((line, index) => (
          <div key={line} className="relative">
            <p
              className="mono truncate text-[12px] md:text-[13px]"
              style={{ color: 'var(--world-muted, #8b8b93)' }}
            >
              {line}
            </p>
            <span
              ref={(node) => {
                barsRef.current[index] = node;
              }}
              aria-hidden="true"
              className="absolute inset-0 origin-left rounded-[2px]"
              style={{ backgroundColor: 'var(--world-text, #fff)' }}
            />
          </div>
        ))}
      </div>

      <p className="mt-6 text-[12px] lowercase" style={{ color: 'var(--world-muted, #8b8b93)' }}>
        illustrative. what the ledger holds is the sealed envelope, never the words.
      </p>
    </figure>
  );
}

/** What an observer actually gets: a record with no author in it. */
function ProofChip({
  chipRef,
  reducedMotion,
}: {
  chipRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}) {
  return (
    <div
      ref={chipRef}
      className="min-w-0 self-start rounded-2xl p-6 md:p-8"
      style={{
        backgroundColor: 'var(--world-card, #141416)',
        border: '1px solid var(--world-line, #26262a)',
        // Reduced motion renders the resolved state; otherwise the effect
        // fades it in from below as the public world arrives.
        opacity: reducedMotion ? 1 : 0,
      }}
    >
      <p
        className="mono text-[11px] tracking-[0.22em] uppercase"
        style={{ color: 'var(--world-muted, #8b8b93)' }}
      >
        VERIFIABLE ON-CHAIN
      </p>
      <dl className="mono mt-6 flex flex-col gap-4 text-[12px] md:text-[13px]">
        {PROOF_FIELDS.map(({ key, value }) => (
          <div key={key} className="flex items-baseline justify-between gap-4">
            <dt style={{ color: 'var(--world-muted, #8b8b93)' }}>{key}</dt>
            <dd className="truncate">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Stand-ins for a 512-byte envelope, shaped like the real thing (hex, fixed
 * width) without pretending to be a specific submission.
 */
const CIPHERTEXT_LINES = [
  '8f3a1c07d94b6e250af71b38c6d0925e4471aa08bd63f1c2',
  '2b95e7043fd8a1c6709e5b24d0f38617ac4e92b50d7168fa',
  'c40d827be59137a0e6b48f21d95c30ea7f18b6402ad9e357',
  '61ea3f8c07d25b94a1638e0fd47c29b05ea836147bf0d92c',
  'ad7b0e4936c81f2a5d0473e9b8c162af350de79418b6c0d2',
  '05c9d3168be2740af9236c5d81e0b47f2ac68950d31e7b4a',
];

const PROOF_FIELDS = [
  { key: 'report_hash', value: '4f2c…a91b' },
  { key: 'recipient_key', value: '7d3e…08fa' },
  { key: 'submitted', value: 'block #…' },
  { key: 'sender', value: 'none' },
];

/** Hermite interpolation: eases the ends so nothing starts or stops abruptly. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Channel-wise interpolation between two #rrggbb colours. */
function mixHex(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const channel = (index: number) => Math.round(a[index] + (b[index] - a[index]) * t);
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

function parseHex(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
