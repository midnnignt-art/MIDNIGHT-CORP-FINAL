import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { BrandSelection } from '../pages/ConjunctionPortal';

interface UIProps {
  selectedBrand: BrandSelection;
  hoveredBrand: BrandSelection;
  onSelect: (brand: BrandSelection) => void;
  onHover: (brand: BrandSelection) => void;
}

// Curva cinemática solicitada por el brief
const EASE = [0.25, 1, 0.5, 1] as const;

export const ConjunctionUI: React.FC<UIProps> = ({ selectedBrand, hoveredBrand, onSelect, onHover }) => {
  const isMidnightHovered = hoveredBrand === 'midnight';
  const isSolsticeHovered = hoveredBrand === 'solstice';
  const isMidnightSelected = selectedBrand === 'midnight';
  const isSolsticeSelected = selectedBrand === 'solstice';

  const titleVariants: Variants = {
    initial: { letterSpacing: '0.08em', opacity: 0.85, filter: 'blur(0px)' },
    hover:   { letterSpacing: '0.32em', opacity: 1, filter: 'blur(0px)' },
    fading:  { letterSpacing: '0.08em', opacity: 0.15, filter: 'blur(2px)' },
    selected:{ letterSpacing: '0.85em', opacity: 0, filter: 'blur(14px)' },
  };

  const getAnim = (brand: 'midnight' | 'solstice') => {
    if (selectedBrand === brand) return 'selected';
    if (selectedBrand && selectedBrand !== brand) return 'fading';
    if (hoveredBrand === brand) return 'hover';
    if (hoveredBrand && hoveredBrand !== brand) return 'fading';
    return 'initial';
  };

  return (
    <div className="w-full h-full pointer-events-none select-none relative">

      {/* ─── TOP METADATA ─── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
        className="absolute top-6 md:top-10 left-1/2 -translate-x-1/2 flex items-center gap-4"
      >
        <span style={{ width: 30, height: 0.5, background: 'rgba(249,242,215,0.40)' }} />
        <span
          className="text-[9px] md:text-[10px] uppercase"
          style={{
            fontFamily: "'JetBrains Mono', 'Space Mono', monospace",
            color: 'rgba(249,242,215,0.55)',
            letterSpacing: '0.55em',
            fontWeight: 500,
          }}
        >
          Universe Selector
        </span>
        <span style={{ width: 30, height: 0.5, background: 'rgba(249,242,215,0.40)' }} />
      </motion.div>

      {/* ─── Corner metadata top-left ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: EASE, delay: 0.6 }}
        className="absolute top-6 md:top-10 left-6 md:left-10 flex items-center gap-2"
      >
        <span
          aria-hidden
          style={{
            width: 6, height: 6, borderRadius: 999,
            background: '#10b981',
            boxShadow: '0 0 8px rgba(16,185,129,0.85)',
            animation: 'pulse 2.4s ease-in-out infinite',
          }}
        />
        <span
          className="text-[8px] md:text-[9px] uppercase"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            color: 'rgba(249,242,215,0.45)',
            letterSpacing: '0.4em',
          }}
        >
          Signal · Online
        </span>
      </motion.div>

      {/* ─── Corner metadata top-right ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: EASE, delay: 0.6 }}
        className="absolute top-6 md:top-10 right-6 md:right-10"
      >
        <span
          className="text-[8px] md:text-[9px] uppercase"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            color: 'rgba(249,242,215,0.40)',
            letterSpacing: '0.4em',
          }}
        >
          MMXXVI · Worldwide
        </span>
      </motion.div>

      {/* ─── CENTER: titulares posicionados al lado de cada cuerpo ─── */}
      <div className="absolute inset-0 flex items-center justify-between px-6 md:px-16 lg:px-24">

        {/* MIDNIGHT — title alineado a la izquierda */}
        <button
          onClick={() => onSelect('midnight')}
          onMouseEnter={() => onHover('midnight')}
          onMouseLeave={() => onHover(null)}
          aria-label="Entrar a Midnight"
          className="pointer-events-auto group focus:outline-none flex flex-col items-start"
          style={{
            background: 'transparent', border: 0, cursor: 'pointer',
            padding: '60px 20px',
          }}
        >
          <motion.div
            variants={titleVariants}
            initial="initial"
            animate={getAnim('midnight')}
            transition={{ duration: 1.0, ease: EASE }}
            className="flex flex-col"
            style={{ position: 'relative' }}
          >
            {/* Lens-flare bloom para Midnight cuando está hovered */}
            {(isMidnightHovered || isMidnightSelected) && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  inset: -20,
                  background: 'radial-gradient(ellipse at center, rgba(176,38,255,0.30) 0%, transparent 70%)',
                  filter: 'blur(20px)',
                  pointerEvents: 'none',
                  zIndex: -1,
                }}
              />
            )}
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
                fontSize: 'clamp(2.2rem, 7vw, 5.5rem)',
                fontWeight: 400,
                lineHeight: 0.95,
                color: '#F2F2F2',
                textShadow: '0 4px 32px rgba(73,15,124,0.75), 0 2px 10px rgba(0,0,0,0.85)',
                letterSpacing: 'inherit',
                textTransform: 'uppercase',
              }}
            >
              Midnight
            </h1>
            <span
              className="mt-2 ml-1"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 'clamp(8px, 0.8vw, 11px)',
                color: '#b026ff',
                textShadow: '0 1px 6px rgba(73,15,124,0.85)',
                textTransform: 'uppercase',
                fontWeight: 500,
                letterSpacing: '0.4em',
              }}
            >
              The Eclipse
            </span>
          </motion.div>
        </button>

        {/* SOLSTICE — title alineado a la derecha */}
        <button
          onClick={() => onSelect('solstice')}
          onMouseEnter={() => onHover('solstice')}
          onMouseLeave={() => onHover(null)}
          aria-label="Entrar a Solstice"
          className="pointer-events-auto group focus:outline-none flex flex-col items-end"
          style={{
            background: 'transparent', border: 0, cursor: 'pointer',
            padding: '60px 20px',
          }}
        >
          <motion.div
            variants={titleVariants}
            initial="initial"
            animate={getAnim('solstice')}
            transition={{ duration: 1.0, ease: EASE }}
            className="flex flex-col items-end"
            style={{ position: 'relative' }}
          >
            {/* Lens-flare bloom para Solstice */}
            {(isSolsticeHovered || isSolsticeSelected) && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  inset: -20,
                  background: 'radial-gradient(ellipse at center, rgba(255,122,0,0.35) 0%, transparent 70%)',
                  filter: 'blur(20px)',
                  pointerEvents: 'none',
                  zIndex: -1,
                }}
              />
            )}
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
                fontSize: 'clamp(2.2rem, 7vw, 5.5rem)',
                fontWeight: 400,
                lineHeight: 0.95,
                color: '#F9F2D7',
                textShadow: '0 4px 32px rgba(230,57,47,0.75), 0 2px 10px rgba(0,0,0,0.85)',
                letterSpacing: 'inherit',
                textTransform: 'uppercase',
              }}
            >
              Solstice
            </h1>
            <span
              className="mt-2 mr-1"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 'clamp(8px, 0.8vw, 11px)',
                color: '#FFB48C',
                textShadow: '0 1px 6px rgba(230,57,47,0.85)',
                textTransform: 'uppercase',
                fontWeight: 500,
                letterSpacing: '0.4em',
              }}
            >
              The Awakening
            </span>
          </motion.div>
        </button>
      </div>

      {/* ─── BOTTOM METADATA ─── */}
      <AnimatePresence>
        {selectedBrand === null && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: EASE, delay: 0.9 }}
            className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 whitespace-nowrap"
          >
            <span style={{ width: 18, height: 0.5, background: 'rgba(249,242,215,0.35)' }} />
            <span
              className="text-[9px] md:text-[10px] uppercase"
              style={{
                fontFamily: "'JetBrains Mono', 'Space Mono', monospace",
                color: 'rgba(249,242,215,0.50)',
                letterSpacing: '0.5em',
                fontWeight: 500,
              }}
            >
              Choose Your Path
            </span>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: 'rgba(230,57,47,0.6)' }} />
            <span
              className="text-[9px] md:text-[10px] uppercase"
              style={{
                fontFamily: "'JetBrains Mono', 'Space Mono', monospace",
                color: 'rgba(249,242,215,0.50)',
                letterSpacing: '0.5em',
                fontWeight: 500,
              }}
            >
              Selección Celestial
            </span>
            <span style={{ width: 18, height: 0.5, background: 'rgba(249,242,215,0.35)' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Cinematic tagline al seleccionar ─── */}
      <AnimatePresence>
        {selectedBrand && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.4 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-32 text-center pointer-events-none"
          >
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                color: selectedBrand === 'midnight' ? '#b026ff' : '#FFB48C',
                letterSpacing: '0.6em',
                textTransform: 'uppercase',
                fontWeight: 500,
                textShadow: selectedBrand === 'midnight'
                  ? '0 0 12px rgba(176,38,255,0.6)'
                  : '0 0 12px rgba(255,180,140,0.6)',
              }}
            >
              Entrando a {selectedBrand === 'midnight' ? 'Midnight' : 'Solstice'}
            </p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.8, ease: 'linear', delay: 0.4 }}
              style={{
                height: 1,
                width: 180,
                margin: '12px auto 0',
                background: selectedBrand === 'midnight' ? '#b026ff' : '#E6392F',
                transformOrigin: 'left center',
                boxShadow: `0 0 12px ${selectedBrand === 'midnight' ? '#b026ff' : '#E6392F'}`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
