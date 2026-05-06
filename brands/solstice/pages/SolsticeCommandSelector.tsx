import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

/**
 * Selector de plataforma para vendedores activos en AMBOS sistemas.
 * Se muestra cuando DUAL_COMMAND_ENABLED = true y el user_id existe
 * tanto en solstice_sellers como en promoters con órdenes de Midnight.
 *
 * NO ACTIVADO — flip DUAL_COMMAND_ENABLED en featureFlags.ts para habilitar.
 */

interface Props {
  sellerName: string;
  onSelectSolstice:  () => void;
  onSelectMidnight:  () => void;
}

export default function SolsticeCommandSelector({ sellerName, onSelectSolstice, onSelectMidnight }: Props) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-10 px-4"
      style={{ background: '#000', fontFamily: "'Archivo', sans-serif" }}
    >
      {/* Title */}
      <div className="text-center space-y-2">
        <p className="text-[10px] uppercase tracking-[0.4em]" style={{ color: '#606060' }}>
          Bienvenido, {sellerName}
        </p>
        <h1 className="text-2xl uppercase tracking-widest" style={{ color: '#F9F2D7', fontFamily: "'Poiret One', sans-serif" }}>
          ¿Desde dónde vas a vender hoy?
        </h1>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-xl">
        {/* Solstice */}
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onSelectSolstice}
          className="flex flex-col items-center gap-5 p-10 text-center transition-all"
          style={{ background: '#0d0d0d', border: '1px solid rgba(230,57,47,0.4)' }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(230,57,47,0.12)', border: '1px solid rgba(230,57,47,0.5)' }}>
            <Sun size={26} style={{ color: '#E6392F' }} />
          </div>
          <div>
            <p className="text-lg font-black uppercase tracking-widest" style={{ color: '#F9F2D7', letterSpacing: '0.15em' }}>
              Solstice
            </p>
            <p className="text-[10px] uppercase mt-1" style={{ color: '#606060', letterSpacing: '0.2em' }}>
              Boletas & combos Solstice 2026
            </p>
          </div>
        </motion.button>

        {/* Midnight */}
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={onSelectMidnight}
          className="flex flex-col items-center gap-5 p-10 text-center transition-all"
          style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(249,242,215,0.06)', border: '1px solid rgba(249,242,215,0.2)' }}>
            <Moon size={26} style={{ color: '#F9F2D7' }} />
          </div>
          <div>
            <p className="text-lg font-black uppercase tracking-widest" style={{ color: '#F9F2D7', letterSpacing: '0.15em' }}>
              Midnight
            </p>
            <p className="text-[10px] uppercase mt-1" style={{ color: '#606060', letterSpacing: '0.2em' }}>
              Eventos y fiestas regulares
            </p>
          </div>
        </motion.button>
      </div>

      <p className="text-[9px] uppercase tracking-widest" style={{ color: '#303030' }}>
        Los datos de cada plataforma se guardan por separado
      </p>
    </div>
  );
}
