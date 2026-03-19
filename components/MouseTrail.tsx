import React, { useEffect, useRef } from 'react';

// ── Breathing Orb ─────────────────────────────────────────────────────────────
// A single soft orb that follows the cursor with spring lag and breathes gently.
// Desktop-only (pointer: fine). Uses a single div — zero canvas overhead.

export const MouseTrail: React.FC = () => {
  const orbRef  = useRef<HTMLDivElement>(null);
  const posRef  = useRef({ x: -200, y: -200 });   // current rendered position
  const targetRef = useRef({ x: -200, y: -200 }); // where cursor actually is
  const movingRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const orb = orbRef.current;
    if (!orb) return;

    const onMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };

      if (!movingRef.current) {
        movingRef.current = true;
        orb.style.transform = `translate(-50%, -50%) scale(1.5)`;
        orb.style.opacity   = '1';
      }

      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        movingRef.current = false;
        orb.style.transform = `translate(-50%, -50%) scale(1)`;
        orb.style.opacity   = '0.75';
      }, 120);
    };

    window.addEventListener('mousemove', onMove);

    // Lerp loop — 0.09 gives a silky lag without feeling sluggish
    const LERP = 0.09;
    const tick = () => {
      const p = posRef.current;
      const t = targetRef.current;

      p.x += (t.x - p.x) * LERP;
      p.y += (t.y - p.y) * LERP;

      if (orb) {
        orb.style.left = `${p.x}px`;
        orb.style.top  = `${p.y}px`;
      }

      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(animRef.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  return (
    <div
      ref={orbRef}
      aria-hidden
      className="fixed pointer-events-none z-[9] will-change-transform"
      style={{
        left: '-200px',
        top:  '-200px',
        width:  '420px',
        height: '420px',
        transform: 'translate(-50%, -50%) scale(1)',
        opacity: 0.85,
        transition: 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.5s ease',
        background: 'radial-gradient(circle, rgba(160,40,255,0.32) 0%, rgba(110,15,190,0.18) 35%, rgba(73,15,124,0.06) 60%, transparent 75%)',
        mixBlendMode: 'screen',
        animation: 'orb-breathe 3.8s ease-in-out infinite',
      }}
    />
  );
};
