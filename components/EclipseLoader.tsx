import React, { useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface EclipseLoaderProps {
  progress?: number; // 0 to 100
}

export const EclipseLoader: React.FC<EclipseLoaderProps> = ({ progress = 0 }) => {
  // Use MotionValues for high-performance updates outside of React's render cycle
  const progressValue = useMotionValue(progress);
  
  // Create a spring for the progress to smooth out any jitter
  const smoothProgress = useSpring(progressValue, {
    damping: 30,
    stiffness: 100,
    mass: 0.5
  });

  // Sync the prop to the motion value
  useEffect(() => {
    progressValue.set(progress);
  }, [progress, progressValue]);

  // Derived values using useTransform for 60fps performance
  const moonX = useTransform(smoothProgress, [0, 100], ["-150%", "150%"]);
  const coronaOpacity = useTransform(smoothProgress, [30, 45, 55, 70], [0, 1, 1, 0]);
  const coronaScale = useTransform(smoothProgress, [45, 50, 55], [1.2, 1.6, 1.2]);
  
  // Logic for discrete states (Diamond Ring)
  const isDiamondRingStart = progress >= 45 && progress < 48;
  const isDiamondRingEnd = progress > 52 && progress <= 55;

  return (
    <div className="fixed inset-0 z-[1000] bg-void flex flex-col items-center justify-center overflow-hidden">
      <div className="relative w-64 h-64 flex items-center justify-center">
        
        {/* CORONA (Organic Glow) */}
        <motion.div
          style={{ 
            opacity: coronaOpacity,
            scale: coronaScale
          }}
          className="absolute inset-0 z-0"
        >
          <div className="absolute inset-0 rounded-full bg-white/30 blur-[40px] scale-110" />
          <div className="absolute inset-0 rounded-full bg-white/10 blur-[80px] scale-150" />
          <div className="absolute inset-0 rounded-full bg-white/5 blur-[120px] scale-[2.5]" />
          
          {/* Subtle pulsing atmospheric light */}
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full bg-white/10 blur-[150px] scale-[3]"
          />
        </motion.div>

        {/* THE SUN (Bright Core) */}
        <div className="absolute w-32 h-32 rounded-full bg-white shadow-[0_0_60px_rgba(255,255,255,0.8),0_0_120px_rgba(255,255,255,0.3)] z-10" />

        {/* DIAMOND RING EFFECT */}
        <AnimatePresence>
          {(isDiamondRingStart || isDiamondRingEnd) && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1.2 }}
              exit={{ opacity: 0, scale: 0 }}
              className="absolute z-30 w-16 h-16 flex items-center justify-center"
              style={{
                left: isDiamondRingStart ? '75%' : '10%',
                top: isDiamondRingStart ? '15%' : '20%',
              }}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-[0_0_30px_#fff,0_0_60px_#fff,0_0_100px_#fff]" />
              <div className="absolute w-32 h-[1px] bg-white/40 blur-[2px]" />
              <div className="absolute h-32 w-[1px] bg-white/40 blur-[2px]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* THE MOON (Matching background color) */}
        <motion.div 
          className="absolute w-[133px] h-[133px] rounded-full bg-void z-20"
          style={{ x: moonX }}
        />
      </div>

      {/* LOADING TEXT (Minimalist) */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-16 flex flex-col items-center gap-6"
      >
        <div className="flex flex-col items-center">
          <span className="text-[12px] font-black tracking-[1.2em] uppercase text-white/40 ml-[1.2em]">
            Midnight
          </span>
          <span className="text-[6px] font-light tracking-[0.8em] text-white/10 uppercase mt-1 ml-[0.8em]">
            Worldwide
          </span>
        </div>
        
        <div className="w-32 h-[1px] bg-white/5 relative overflow-hidden">
          <motion.div 
            className="absolute inset-y-0 left-0 bg-white/20"
            style={{ width: useTransform(smoothProgress, p => `${p}%`) }}
          />
        </div>
      </motion.div>
    </div>
  );
};
