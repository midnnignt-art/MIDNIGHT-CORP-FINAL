import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface EclipseLoaderProps {
  progress?: number; // 0–100
  isExiting?: boolean;
}

// ── Ambient star field ────────────────────────────────────────────────────────
const StarField: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    // Generate stars once
    const stars = Array.from({ length: 80 }, () => ({
      x:    Math.random() * canvas.width,
      y:    Math.random() * canvas.height,
      r:    Math.random() * 1.2 + 0.2,
      base: Math.random(),
      freq: Math.random() * 0.02 + 0.005,
    }));

    let t = 0;
    let animId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        const alpha = 0.1 + 0.25 * Math.abs(Math.sin(t * s.freq + s.base * Math.PI * 2));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,230,255,${alpha})`;
        ctx.fill();
      });
      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
};

// ── Main loader ───────────────────────────────────────────────────────────────
export const EclipseLoader: React.FC<EclipseLoaderProps> = ({ progress = 0, isExiting = false }) => {
  const progressValue  = useMotionValue(progress);
  const smoothProgress = useSpring(progressValue, { damping: 28, stiffness: 90, mass: 0.4 });

  useEffect(() => { progressValue.set(progress); }, [progress, progressValue]);

  // Moon sweeps left → right
  const moonX          = useTransform(smoothProgress, [0, 100], ['-150%', '150%']);
  // Corona peaks at totality (progress ≈ 50)
  const coronaOpacity  = useTransform(smoothProgress, [30, 45, 55, 72], [0, 1, 1, 0]);
  const coronaScale    = useTransform(smoothProgress, [44, 50, 56], [1.1, 1.7, 1.1]);
  // Progress beam width
  const beamWidth      = useTransform(smoothProgress, v => `${v}%`);
  // Shimmer position on beam
  const shimmerX       = useTransform(smoothProgress, [0, 100], ['-100%', '200%']);

  const isDiamondStart = progress >= 45 && progress < 48;
  const isDiamondEnd   = progress > 52 && progress <= 56;

  const pct = Math.round(progress);

  return (
    <motion.div
      key="eclipse-loader"
      className="fixed inset-0 z-[1000] bg-void flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 1.04,
        filter: 'blur(12px)',
        transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] },
      }}
    >
      {/* Ambient star field */}
      <StarField />

      {/* Radial vignette gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.6)_80%)] pointer-events-none" />

      {/* ── Eclipse scene ── */}
      <div className="relative w-64 h-64 flex items-center justify-center">

        {/* Corona glow */}
        <motion.div
          style={{ opacity: coronaOpacity, scale: coronaScale }}
          className="absolute inset-0 z-0"
        >
          <div className="absolute inset-0 rounded-full bg-white/25 blur-[50px] scale-110" />
          <div className="absolute inset-0 rounded-full bg-white/10 blur-[90px] scale-[1.6]" />
          <div className="absolute inset-0 rounded-full bg-eclipse/30 blur-[130px] scale-[2.4]" />

          <motion.div
            animate={{ scale: [1, 1.06, 1], opacity: [0.25, 0.45, 0.25] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full bg-white/8 blur-[160px] scale-[3]"
          />
        </motion.div>

        {/* Sun */}
        <div className="absolute w-32 h-32 rounded-full z-10"
          style={{ background: 'radial-gradient(circle at 38% 38%, #fffbe0, #ffe87a 40%, #fff 100%)', boxShadow: '0 0 60px rgba(255,255,220,0.9), 0 0 120px rgba(255,255,180,0.4)' }}
        />

        {/* Diamond ring flash */}
        {(isDiamondStart || isDiamondEnd) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0.8], scale: [0.5, 1.3, 1.1] }}
            transition={{ duration: 0.25 }}
            className="absolute z-30 w-16 h-16 flex items-center justify-center"
            style={{ left: isDiamondStart ? '74%' : '8%', top: isDiamondStart ? '14%' : '18%' }}
          >
            <div className="w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_20px_#fff,0_0_50px_#fff,0_0_90px_#fff9c4]" />
            <div className="absolute w-28 h-px bg-white/50 blur-[1px]" />
            <div className="absolute h-28 w-px bg-white/50 blur-[1px]" />
          </motion.div>
        )}

        {/* Moon */}
        <motion.div
          className="absolute w-[134px] h-[134px] rounded-full bg-void z-20"
          style={{ x: moonX }}
        />
      </div>

      {/* ── Text + progress ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="mt-14 flex flex-col items-center gap-5"
      >
        {/* Brand */}
        <div className="flex flex-col items-center">
          <span className="text-[13px] font-black tracking-[1.4em] uppercase text-white/50 ml-[1.4em]">
            Midnight
          </span>
          <span className="text-[6px] font-light tracking-[0.9em] text-white/15 uppercase mt-1 ml-[0.9em]">
            Worldwide
          </span>
        </div>

        {/* Progress bar + percentage */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-40 h-px bg-white/8 overflow-hidden">
            {/* Fill */}
            <motion.div
              className="absolute inset-y-0 left-0 bg-white/30"
              style={{ width: beamWidth }}
            />
            {/* Shimmer */}
            <motion.div
              className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/60 to-transparent"
              style={{ x: shimmerX }}
            />
          </div>

          <motion.span
            className="text-[9px] font-black tabular-nums tracking-[0.4em] text-white/20 ml-[0.4em]"
          >
            {pct.toString().padStart(3, '0')}
          </motion.span>
        </div>
      </motion.div>
    </motion.div>
  );
};
