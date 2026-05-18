import { useEffect, useRef, useState } from 'react';

interface Options {
  duration?: number;
  start?: number;
  decimals?: number;
}

/**
 * Hook que anima un número de 0 a `target` cuando el ref entra al viewport.
 * Usa cubic-bezier ease-out para que se sienta natural.
 */
export function useCountUp(target: number, options: Options = {}) {
  const { duration = 2000, start = 0, decimals = 0 } = options;
  const [value, setValue] = useState(start);
  const ref = useRef<HTMLElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || triggered.current) return;

    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || triggered.current) return;
      triggered.current = true;

      const t0 = performance.now();
      const factor = Math.pow(10, decimals);
      const animate = (t: number) => {
        const progress = Math.min(1, (t - t0) / duration);
        // ease-out cubic-bezier(0.16, 1, 0.3, 1)-ish
        const eased = 1 - Math.pow(1 - progress, 3);
        const v = start + (target - start) * eased;
        setValue(Math.round(v * factor) / factor);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
      io.disconnect();
    }, { threshold: 0.25 });

    io.observe(el);
    return () => io.disconnect();
  }, [target, duration, start, decimals]);

  return { value, ref };
}
