import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Starfield from '../components/portal/Starfield';
import PlanetOrb from '../components/portal/PlanetOrb';

export type BrandSelection = 'midnight' | 'solstice' | null;

interface ConjunctionPortalProps {
  onEnterBrand: (brand: 'midnight' | 'solstice') => void;
}

export const ConjunctionPortal: React.FC<ConjunctionPortalProps> = ({ onEnterBrand }) => {
  const [hoveredSide, setHoveredSide] = useState<'midnight' | 'solstice' | null>(null);
  const [selected, setSelected] = useState<'midnight' | 'solstice' | null>(null);

  const handleSelect = (brand: 'midnight' | 'solstice') => {
    if (selected) return;
    setSelected(brand);
    setTimeout(() => onEnterBrand(brand), 650);
  };

  return (
    <div
      className={`relative min-h-screen w-full select-none flex flex-col justify-between overflow-x-hidden text-zinc-300 font-body bg-[#05020a] transition-opacity duration-500 ${
        selected ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <Starfield />

      {/* Ambient gradient rings */}
      <div
        className="absolute top-1/4 left-1/4 w-[50vw] h-[50vw] rounded-full filter blur-[150px] pointer-events-none opacity-45 transition-all duration-1000 mix-blend-screen z-0"
        style={{
          background:
            hoveredSide === 'midnight'
              ? 'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, transparent 85%)'
              : hoveredSide === 'solstice'
              ? 'radial-gradient(circle, rgba(234, 88, 12, 0.18) 0%, transparent 85%)'
              : 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 85%)',
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[50vw] h-[50vw] rounded-full filter blur-[150px] pointer-events-none opacity-45 transition-all duration-1000 mix-blend-screen z-0"
        style={{
          background:
            hoveredSide === 'solstice'
              ? 'radial-gradient(circle, rgba(234, 88, 12, 0.28) 0%, transparent 85%)'
              : hoveredSide === 'midnight'
              ? 'radial-gradient(circle, rgba(129, 140, 248, 0.16) 0%, transparent 85%)'
              : 'radial-gradient(circle, rgba(234, 88, 12, 0.07) 0%, transparent 85%)',
        }}
      />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="relative z-50 w-full max-w-7xl mx-auto px-6 py-6 sm:py-8 flex items-center justify-between pointer-events-auto shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.85)]" />
          <span className="text-[10px] tracking-[0.25em] font-sans-clean text-zinc-400 uppercase font-medium">ONLINE</span>
        </div>

        <div className="flex flex-col items-center justify-center pointer-events-none">
          <span className="text-indigo-400 text-xs mb-1.5 opacity-90">🌙</span>
          <span className="text-lg sm:text-2xl font-serif-celestial tracking-[0.45em] font-bold text-white text-center pl-[0.45em]">
            MIDNIGHT
          </span>
          <div className="flex items-center gap-3 w-56 sm:w-64 mt-2">
            <div className="h-[0.5px] flex-grow bg-zinc-800/80" />
            <span className="text-[7.5px] sm:text-[9px] font-sans-clean tracking-[0.55em] text-zinc-500 uppercase shrink-0">
              WORLDWIDE
            </span>
            <div className="h-[0.5px] flex-grow bg-zinc-800/80" />
          </div>
        </div>

        <div className="w-[60px]" aria-hidden />
      </header>

      {/* ── SELECTOR ────────────────────────────────────────────────────────── */}
      <main className="relative z-10 w-full flex-grow flex items-center justify-center py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key="split-selector"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full flex flex-col justify-center items-center"
          >
            <div className="text-center mb-10 select-none pointer-events-none px-4 max-w-lg">
              <p className="text-[10px] sm:text-[11.5px] font-sans-clean tracking-[0.35em] text-zinc-400 uppercase leading-relaxed">
                DOS EXPERIENCIAS. UN MISMO UNIVERSO.
              </p>
              <div className="w-8 h-[1px] bg-zinc-800/80 mx-auto mt-4" />
            </div>

            <div className="w-full max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-zinc-900/50 gap-16 lg:gap-0 justify-center items-center">
              {/* MIDNIGHT */}
              <div
                className="flex flex-col items-center justify-center text-center px-4 lg:px-12 relative cursor-pointer"
                onMouseEnter={() => setHoveredSide('midnight')}
                onMouseLeave={() => setHoveredSide(null)}
                onClick={() => handleSelect('midnight')}
              >
                <div className="flex flex-col items-center select-none pointer-events-none mb-2">
                  <span className="text-indigo-400/80 text-xs mb-1">🌙</span>
                  <h2 className="font-serif-celestial text-3xl sm:text-4xl text-white tracking-[0.3em] font-bold pl-[0.3em]">
                    MIDNIGHT
                  </h2>
                  <span className="text-[9px] font-sans-clean tracking-[0.3em] text-[#818cf8] uppercase mt-1">
                    — THE ECLIPSE —
                  </span>
                </div>

                <div className="relative z-10 my-4">
                  <PlanetOrb type="midnight" isActive={false} isHovered={hoveredSide === 'midnight'} />
                </div>

                <div className="space-y-1 mt-2 select-none pointer-events-none">
                  <p className="text-[11px] font-sans-clean tracking-[0.25em] text-zinc-400 uppercase">MISTERIO. VIBRAS.</p>
                  <p className="text-[11px] font-sans-clean tracking-[0.25em] text-zinc-400 uppercase">TODA LA NOCHE.</p>
                </div>

                <div className="mt-8">
                  <button
                    type="button"
                    className={`px-8 py-3 rounded-full border text-[10px] font-sans-clean font-semibold tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 ${
                      hoveredSide === 'midnight'
                        ? 'bg-indigo-950/20 text-white border-indigo-400/80 shadow-[0_0_15px_rgba(129,140,248,0.25)] scale-[1.02]'
                        : 'bg-zinc-950/30 text-zinc-400 border-zinc-800/60'
                    }`}
                  >
                    <span>ENTRAR A MIDNIGHT</span>
                    <span className="font-mono text-xs">→</span>
                  </button>
                </div>
              </div>

              {/* SOLSTICE */}
              <div
                className="flex flex-col items-center justify-center text-center px-4 lg:px-12 relative cursor-pointer"
                onMouseEnter={() => setHoveredSide('solstice')}
                onMouseLeave={() => setHoveredSide(null)}
                onClick={() => handleSelect('solstice')}
              >
                <div className="flex flex-col items-center select-none pointer-events-none mb-2">
                  <span className="text-orange-400/80 text-xs mb-1">☀️</span>
                  <h2 className="font-serif-celestial text-3xl sm:text-4xl text-white tracking-[0.3em] font-bold pl-[0.3em]">
                    SOLSTICE
                  </h2>
                  <span className="text-[9px] font-sans-clean tracking-[0.3em] text-orange-500 uppercase mt-1">
                    — THE AWAKENING —
                  </span>
                </div>

                <div className="relative z-10 my-4">
                  <PlanetOrb type="solstice" isActive={false} isHovered={hoveredSide === 'solstice'} />
                </div>

                <div className="space-y-1 mt-2 select-none pointer-events-none">
                  <p className="text-[11px] font-sans-clean tracking-[0.25em] text-zinc-400 uppercase">ENERGÍA. LUZ.</p>
                  <p className="text-[11px] font-sans-clean tracking-[0.25em] text-zinc-400 uppercase">UN NUEVO COMIENZO.</p>
                </div>

                <div className="mt-8">
                  <button
                    type="button"
                    className={`px-8 py-3 rounded-full border text-[10px] font-sans-clean font-semibold tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 ${
                      hoveredSide === 'solstice'
                        ? 'bg-orange-950/20 text-white border-orange-400/80 shadow-[0_0_15px_rgba(249,115,22,0.25)] scale-[1.02]'
                        : 'bg-zinc-950/30 text-zinc-400 border-zinc-800/60'
                    }`}
                  >
                    <span>ENTRAR A SOLSTICE</span>
                    <span className="font-mono text-xs">→</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="text-center mt-12 py-4 select-none pointer-events-none">
              <p className="text-[9.5px] font-sans-clean tracking-[0.4em] text-zinc-500 uppercase">
                ELIGE TU EXPERIENCIA
              </p>
              <div className="h-10 w-[0.5px] bg-gradient-to-b from-zinc-700 to-transparent mx-auto mt-4 relative">
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 text-[8px] text-zinc-600 animate-pulse">
                  ✦
                </span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="relative z-40 w-full max-w-7xl mx-auto px-6 py-5 border-t border-zinc-900/60 flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-auto shrink-0 select-none">
        <span className="text-[9.5px] font-mono tracking-widest text-zinc-500">
          CURIOSA SINFONÍA ESTELAR
        </span>
        <div className="text-[10px] font-sans-clean text-zinc-600 tracking-wider text-center">
          Coord: 11.2408° N, 74.1990° W • Santa Marta
        </div>
        <span className="text-[10px] font-sans-clean tracking-[0.2em] text-zinc-600">&copy; 2026 MIDNIGHT</span>
      </footer>
    </div>
  );
};
