import { useEffect, useRef } from 'react';

/**
 * The hero's never-blank floor: animated dark grain, a soft central vignette,
 * and a faint hooded silhouette. Used only when the real figure asset fails to
 * load. A black rectangle would read as a broken build; this at least reads
 * as authored.
 *
 * The noise is drawn into a small offscreen buffer and stretched over the
 * canvas rather than filled per-pixel at full resolution: at 1080p a per-pixel
 * fill is ~2M writes per frame and visibly janks the hero reveal running
 * alongside it. The stretch also makes the grain coarser, which suits it.
 */
export function GrainFallback({ animate }: { animate: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const NOISE = 160;
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = NOISE;
    noiseCanvas.height = NOISE;
    const noiseCtx = noiseCanvas.getContext('2d');
    if (!noiseCtx) return;
    const image = noiseCtx.createImageData(NOISE, NOISE);

    let frame = 0;
    let raf = 0;

    const paintNoise = () => {
      const { data } = image;
      for (let i = 0; i < data.length; i += 4) {
        // Near-black speckle: the grain is texture, never a light source.
        const value = 8 + Math.random() * 26;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = 255;
      }
      noiseCtx.putImageData(image, 0, 0);
    };

    const draw = () => {
      const { width, height } = canvas;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(noiseCanvas, 0, 0, width, height);

      // Vignette: pulls the eye to the centre where the headline sits.
      const vignette = ctx.createRadialGradient(
        width / 2,
        height * 0.45,
        Math.min(width, height) * 0.1,
        width / 2,
        height * 0.45,
        Math.max(width, height) * 0.75,
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.92)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      drawSilhouette(ctx, width, height);
    };

    const resize = () => {
      // Capped device pixel ratio: grain gains nothing from 3x and the extra
      // fill rate is real on phones.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      paintNoise();
      draw();
    };

    resize();
    window.addEventListener('resize', resize);

    if (animate) {
      const loop = () => {
        // ~20fps for the grain. Full 60fps noise reads as television static;
        // this reads as film.
        if (frame++ % 3 === 0) {
          paintNoise();
          draw();
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}

/** A hooded head-and-shoulders, barely above the noise floor. */
function drawSilhouette(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cx = width / 2;
  const baseY = height * 0.98;
  const unit = Math.min(width, height) * 0.42;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  // Shoulders.
  ctx.moveTo(cx - unit * 1.15, baseY);
  ctx.bezierCurveTo(
    cx - unit * 1.05,
    baseY - unit * 0.85,
    cx - unit * 0.62,
    baseY - unit * 1.05,
    cx - unit * 0.46,
    baseY - unit * 1.18,
  );
  // Hood, left edge up and over the crown.
  ctx.bezierCurveTo(
    cx - unit * 0.66,
    baseY - unit * 1.62,
    cx - unit * 0.5,
    baseY - unit * 2.1,
    cx,
    baseY - unit * 2.12,
  );
  ctx.bezierCurveTo(
    cx + unit * 0.5,
    baseY - unit * 2.1,
    cx + unit * 0.66,
    baseY - unit * 1.62,
    cx + unit * 0.46,
    baseY - unit * 1.18,
  );
  ctx.bezierCurveTo(
    cx + unit * 0.62,
    baseY - unit * 1.05,
    cx + unit * 1.05,
    baseY - unit * 0.85,
    cx + unit * 1.15,
    baseY,
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
