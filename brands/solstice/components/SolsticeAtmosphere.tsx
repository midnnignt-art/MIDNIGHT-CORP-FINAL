import React, { useEffect, useRef } from 'react';

/**
 * Atardecer animado para el hero de Solstice.
 *
 * Combina:
 *  - CSS gradient en capas (cielo, sol, mar) con animación de keyframes lenta
 *  - Canvas con partículas (motas de luz) que flotan verticalmente
 *  - Sun "breathing" — pulse sutil del disco solar
 *
 * Diseñado para sentirse cinemático sin video file. Performance:
 *  - Canvas a 30fps con max 40 partículas
 *  - requestAnimationFrame con cleanup
 *  - Pausado fuera del viewport via IntersectionObserver
 */
export const SolsticeAtmosphere: React.FC<{ className?: string }> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Pausa cuando no está visible
    const io = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
    });
    io.observe(canvas);

    interface Particle { x: number; y: number; r: number; vy: number; vx: number; o: number; }
    const particles: Particle[] = [];
    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * W(),
        y: Math.random() * H(),
        r: Math.random() * 1.5 + 0.5,
        vy: -(Math.random() * 0.15 + 0.05),
        vx: (Math.random() - 0.5) * 0.05,
        o: Math.random() * 0.5 + 0.2,
      });
    }

    let last = performance.now();
    const TARGET_FPS = 30;
    const FRAME = 1000 / TARGET_FPS;

    const tick = (t: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (!visibleRef.current) return;
      const dt = t - last;
      if (dt < FRAME) return;
      last = t;

      ctx.clearRect(0, 0, W(), H());
      ctx.fillStyle = '#E6392F';
      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx;
        if (p.y < -10) {
          p.y = H() + 10;
          p.x = Math.random() * W();
        }
        if (p.x < -10) p.x = W() + 10;
        if (p.x > W() + 10) p.x = -10;
        ctx.globalAlpha = p.o;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Capa 1: cielo (gradient lento) */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, #0a0205 0%, #2a0e10 30%, #6b1e1c 65%, #1a0506 95%, #000 100%)',
          animation: 'solstice-sky 24s ease-in-out infinite alternate',
        }}
      />

      {/* Capa 2: sol — pulse + glow */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '32%',
          transform: 'translateX(-50%)',
          width: 'min(380px, 50vw)',
          height: 'min(380px, 50vw)',
          borderRadius: '999px',
          background: 'radial-gradient(circle, rgba(255,180,140,0.85) 0%, rgba(230,57,47,0.55) 35%, rgba(230,57,47,0.15) 60%, transparent 75%)',
          filter: 'blur(8px)',
          animation: 'solstice-sun 8s ease-in-out infinite alternate',
        }}
      />

      {/* Capa 3: horizonte — removido. La línea fina de ancho completo se leía
          como una "línea que corta el fondo" a la altura del botón. */}

      {/* Capa 4: mar (gradient con shimmer) */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0,
          bottom: 0,
          height: '30%',
          background: 'linear-gradient(180deg, rgba(20,8,8,0.2) 0%, rgba(0,0,0,0.95) 100%)',
        }}
      />

      {/* Capa 5: motas de luz (partículas) */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* Capa 6: grain overlay sutil para textura cinemática */}
      <div
        style={{
          position: 'absolute', inset: 0,
          opacity: 0.05,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
          backgroundSize: '200px 200px',
          pointerEvents: 'none',
        }}
      />

      <style>{`
        @keyframes solstice-sky {
          0%   { filter: brightness(0.95) saturate(1.1); }
          100% { filter: brightness(1.05) saturate(1.3); }
        }
        @keyframes solstice-sun {
          0%   { transform: translateX(-50%) scale(0.97); opacity: 0.85; }
          100% { transform: translateX(-50%) scale(1.04); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SolsticeAtmosphere;
