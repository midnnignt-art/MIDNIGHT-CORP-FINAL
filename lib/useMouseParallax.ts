// Mouse parallax — un solo listener global, hook compartido throttled.
// Devuelve offset (-1 a 1) por dimensión. Componentes multiplican por su intensity propia.

import { useEffect, useState } from 'react';

let targetX = 0;
let targetY = 0;
let smoothX = 0;
let smoothY = 0;
const subscribers = new Set<() => void>();
let rafId: number | null = null;
let frameCount = 0;

function ensureLoop() {
  if (rafId !== null) return;
  const tick = () => {
    smoothX += (targetX - smoothX) * 0.06;
    smoothY += (targetY - smoothY) * 0.06;
    frameCount++;
    // Notify a ~15fps para no saturar re-renders
    if (frameCount % 4 === 0) {
      subscribers.forEach(fn => fn());
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', onMove);
  }
}

function stopLoop() {
  if (subscribers.size === 0 && rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', onMove);
    }
  }
}

// Pausa el rAF cuando la pestaña no es visible — crítico para no consumir
// CPU/batería en background con tráfico alto.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (subscribers.size > 0) {
      ensureLoop();
    }
  });
}

function onMove(e: MouseEvent) {
  targetX = (e.clientX / window.innerWidth - 0.5) * 2;
  targetY = (e.clientY / window.innerHeight - 0.5) * 2;
}

export function useMouseParallax() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(n => (n + 1) % 1000000);
    subscribers.add(fn);
    ensureLoop();
    return () => {
      subscribers.delete(fn);
      stopLoop();
    };
  }, []);
  return { x: smoothX, y: smoothY };
}

// Helper: detecta prefers-reduced-motion
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
