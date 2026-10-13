import { useEffect, useRef, useState } from 'react';

// Animate only observed updates. First observations and reduced motion settle
// immediately; a new update starts at the last displayed value, never at zero.
export function useTelemetryMotion(target: number[], enabled = true): number[] {
  const [display, setDisplay] = useState(target);
  const current = useRef(target);
  const wasEnabled = useRef(false);
  const identity = JSON.stringify(target);
  useEffect(() => {
    const next: number[] = JSON.parse(identity);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let disposed = false;
    const from = current.current;
    const settle = () => {
      cancelAnimationFrame(frame);
      current.current = next;
      setDisplay(next);
    };
    const first = !wasEnabled.current;
    wasEnabled.current = enabled;
    if (!enabled || first || media.matches || from.length !== next.length) {
      settle();
      return;
    }
    const start = performance.now();
    const tick = (time: number) => {
      if (disposed) return;
      const progress = Math.min(1, Math.max(0, (time - start) / 680));
      const eased = 1 - Math.pow(1 - progress, 3);
      const values = next.map((value, i) => from[i] + (value - from[i]) * eased);
      current.current = values;
      setDisplay(values);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const preferenceChanged = () => { if (media.matches) settle(); };
    media.addEventListener('change', preferenceChanged);
    frame = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      media.removeEventListener('change', preferenceChanged);
    };
  }, [identity, enabled]);
  return display;
}
