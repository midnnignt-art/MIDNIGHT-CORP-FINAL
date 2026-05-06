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
      style={{ background: '#0d0d0d', fontFamily: "'Archivo', sans-serif" }}
    >
      {/* Title */}
      <div className="text-center space-y-2">
        <p
          className="text-[10px] uppercase"
          style={{ color: '#606060', fontWeight: 500, letterSpacing: '0.08em' }}
        >
          Bienvenido, {sellerName}
        </p>
        <h1
          className="text-2xl uppercase"
          style={{
            color: '#F9F2D7',
            fontFamily: "'Poiret One', sans-serif",
            fontWeight: 300,
            letterSpacing: '-0.02em',
          }}
        >
          ¿Desde dónde vas a vender hoy?
        </h1>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-xl">
        {/* Solstice */}
        <motion.button
          whileHover={{ scale: 1.005, y: -4 }}
          whileTap={{ scale: 0.97 }}
          onClick={onSelectSolstice}
          className="flex flex-col items-center gap-5 p-6 text-center"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '0.5px solid rgba(230,57,47,0.40)',
            borderRadius: '24px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.30)',
            transition: 'all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 32px 64px rgba(0,0,0,0.40)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 24px 48px rgba(0,0,0,0.30)';
          }}
        >
          <div
            className="w-14 h-14 flex items-center justify-center"
            style={{
              background: 'rgba(230,57,47,0.12)',
              border: '0.5px solid rgba(230,57,47,0.40)',
              borderRadius: '14px',
            }}
          >
            <Sun size={26} style={{ color: '#E6392F' }} />
          </div>
          <div>
            <p
              className="text-lg uppercase"
              style={{ color: '#F9F2D7', letterSpacing: '0.15em', fontWeight: 600 }}
            >
              Solstice
            </p>
            <p
              className="text-[10px] uppercase mt-1"
              style={{ color: '#606060', letterSpacing: '0.08em', fontWeight: 500 }}
            >
              Boletas & combos Solstice 2026
            </p>
          </div>
        </motion.button>

        {/* Midnight */}
        <motion.button
          whileHover={{ scale: 1.005, y: -4 }}
          whileTap={{ scale: 0.97 }}
          onClick={onSelectMidnight}
          className="flex flex-col items-center gap-5 p-6 text-center"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '0.5px solid rgba(255,255,255,0.10)',
            borderRadius: '24px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.30)',
            transition: 'all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 32px 64px rgba(0,0,0,0.40)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 24px 48px rgba(0,0,0,0.30)';
          }}
        >
          <div
            className="w-14 h-14 flex items-center justify-center"
            style={{
              background: 'rgba(249,242,215,0.06)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: '14px',
            }}
          >
            <Moon size={26} style={{ color: '#F9F2D7' }} />
          </div>
          <div>
            <p
              className="text-lg uppercase"
              style={{ color: '#F9F2D7', letterSpacing: '0.15em', fontWeight: 600 }}
            >
              Midnight
            </p>
            <p
              className="text-[10px] uppercase mt-1"
              style={{ color: '#606060', letterSpacing: '0.08em', fontWeight: 500 }}
            >
              Eventos y fiestas regulares
            </p>
          </div>
        </motion.button>
      </div>

      <p
        className="text-[9px] uppercase"
        style={{ color: '#303030', letterSpacing: '0.08em', fontWeight: 500 }}
      >
        Los datos de cada plataforma se guardan por separado
      </p>
    </div>
  );
}
