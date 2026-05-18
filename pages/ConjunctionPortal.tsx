import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type BrandSelection = 'midnight' | 'solstice' | null;

interface ConjunctionPortalProps {
  onEnterBrand: (brand: 'midnight' | 'solstice') => void;
}

export const ConjunctionPortal: React.FC<ConjunctionPortalProps> = ({ onEnterBrand }) => {
  const [hoveredBrand, setHoveredBrand] = useState<BrandSelection>(null);
  const [selectedBrand, setSelectedBrand] = useState<BrandSelection>(null);
  const [fadeOut, setFadeOut] = useState(false);

  const handleSelect = (brand: 'midnight' | 'solstice') => {
    if (selectedBrand) return;
    setSelectedBrand(brand);
    setFadeOut(true);
    setTimeout(() => onEnterBrand(brand), 700);
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center font-sans">
      <AnimatePresence>
        {!fadeOut && (
          <motion.div
            className="absolute z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.7, ease: 'easeInOut' } }}
            style={{
              // Escala y cubre el fondo conservando el aspect-ratio de 1024x592
              width: 'max(100vw, 100vh * (1024 / 592))',
              height: 'max(100vh, 100vw * (592 / 1024))',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Imagen Fotorealista Estática */}
            <img 
              src="/conjunction-bg.png" 
              alt="Midnight vs Solstice Conjunction" 
              className="absolute inset-0 w-full h-full pointer-events-none select-none"
              style={{ objectFit: 'fill' }} // Container strictly enforces aspect ratio
            />

            {/* Máscara de Atenuación al Hover Solstice (Oscurece Izquierda) */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: hoveredBrand === 'solstice' ? 1 : 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 35%, transparent 60%)' }}
            />

            {/* Máscara de Atenuación al Hover Midnight (Oscurece Derecha) */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: hoveredBrand === 'midnight' ? 1 : 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 35%, transparent 60%)' }}
            />

            {/* ═════════════════════════════════════════════════════════════════════════════ */}
            {/* ZONAS INTERACTIVAS (HITBOXES INVISIBLES) */}
            {/* ═════════════════════════════════════════════════════════════════════════════ */}

            {/* Zonas MIDNIGHT */}
            <div 
              title="Midnight Eclipse"
              className="absolute cursor-pointer rounded-full hover:scale-[1.02] transition-transform duration-300"
              style={{ left: '12%', top: '25%', width: '25%', height: '42%', transformOrigin: 'center' }}
              onMouseEnter={() => setHoveredBrand('midnight')}
              onMouseLeave={() => setHoveredBrand(null)}
              onClick={() => handleSelect('midnight')}
            />
            <div 
              title="Midnight Ver Eventos"
              className="absolute cursor-pointer rounded-[40px] hover:bg-white/10 transition-colors duration-300"
              style={{ left: '16%', top: '71%', width: '18%', height: '7%' }}
              onMouseEnter={() => setHoveredBrand('midnight')}
              onMouseLeave={() => setHoveredBrand(null)}
              onClick={() => handleSelect('midnight')}
            />

            {/* Zonas SOLSTICE */}
            <div 
              title="Solstice Awakening"
              className="absolute cursor-pointer rounded-full hover:scale-[1.02] transition-transform duration-300"
              style={{ left: '62%', top: '25%', width: '25%', height: '42%', transformOrigin: 'center' }}
              onMouseEnter={() => setHoveredBrand('solstice')}
              onMouseLeave={() => setHoveredBrand(null)}
              onClick={() => handleSelect('solstice')}
            />
            <div 
              title="Solstice Ver Eventos"
              className="absolute cursor-pointer rounded-[40px] hover:bg-white/10 transition-colors duration-300"
              style={{ left: '66%', top: '71%', width: '18%', height: '7%' }}
              onMouseEnter={() => setHoveredBrand('solstice')}
              onMouseLeave={() => setHoveredBrand(null)}
              onClick={() => handleSelect('solstice')}
            />

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
