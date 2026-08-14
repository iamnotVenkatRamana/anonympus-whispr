import { useState } from 'react';

import { GrainFallback } from './GrainFallback';

const VIDEO_SRC = '/hero/figure.mp4';
const POSTER_SRC = '/hero/figure-poster.jpg';

/**
 * The full-bleed hero background: an anonymous figure, finger to lips.
 *
 * The real asset is the default. The authored grain/silhouette canvas is a
 * fallback for one case only, the asset failing to load (absent at build
 * time, or blocked), so the hero is never a blank black rectangle.
 *
 * Under prefers-reduced-motion the figure is still shown, as the poster still
 * frame rather than the looping video. Serving the real image is closer to the
 * intended page than swapping in an animated noise canvas would be, and the
 * grain is the thing that would need suppressing anyway.
 */
export function HeroBackground({ reducedMotion }: { reducedMotion: boolean }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  if (reducedMotion) {
    return (
      <>
        {posterFailed ? (
          <GrainFallback animate={false} />
        ) : (
          <img
            src={POSTER_SRC}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setPosterFailed(true)}
          />
        )}
        <Scrim />
      </>
    );
  }

  return (
    <>
      {videoFailed ? (
        <GrainFallback animate />
      ) : (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          poster={POSTER_SRC}
          src={VIDEO_SRC}
          aria-hidden="true"
          // Fires when the file is missing or undecodable. Swapping to the
          // grain canvas here is the whole "never blank" guarantee.
          onError={() => setVideoFailed(true)}
        />
      )}
      <Scrim />
    </>
  );
}

/** Dark wash over the footage so white type keeps its contrast ratio. */
function Scrim() {
  return <div className="absolute inset-0 bg-black/40" aria-hidden="true" />;
}
