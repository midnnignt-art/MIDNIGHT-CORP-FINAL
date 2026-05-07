import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SolsticeNav, { SolsticePage } from './components/SolsticeNav';
import SolsticeSplash from './components/SolsticeSplash';
import SolsticeLanding from './pages/SolsticeLanding';
import SolsticeReserva from './pages/SolsticeReserva';
import SolsticeAdminConfig from './pages/SolsticeAdminConfig';
import SolsticeAdminFinance from './pages/SolsticeAdminFinance';
import SolsticeAdminCobros from './pages/SolsticeAdminCobros';
import SolsticeAdminCheckin from './pages/SolsticeAdminCheckin';
import SolsticePrograma from './pages/SolsticePrograma';
import SolsticeVentasDashboard from './pages/SolsticeVentasDashboard';
import SolsticeMiSemana from './pages/SolsticeMiSemana';
import SolsticeCommandSelector from './pages/SolsticeCommandSelector';
import { DUAL_COMMAND_ENABLED } from './featureFlags';
import { UserRole } from '../../types';
import { MouseTrail } from '../../components/MouseTrail';

interface Props {
  onExit: () => void;
  userRole: UserRole;
  userName?: string;
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#000', color: '#606060' }}>
      <div className="w-12 h-12 rounded-full border-2 border-[#E6392F]/30 flex items-center justify-center">
        <span className="text-[#E6392F] text-lg">✦</span>
      </div>
      <p className="text-xs uppercase tracking-[0.4em]" style={{ color: '#E6392F' }}>{title}</p>
      <p className="text-[10px] uppercase tracking-widest">Fase próxima — en construcción</p>
    </div>
  );
}

function solsticeRole(userRole: UserRole): 'admin' | 'seller' | 'manager' | 'buyer' {
  if (userRole === UserRole.ADMIN) return 'admin';
  if (userRole === UserRole.MANAGER) return 'manager';
  if (userRole === UserRole.PROMOTER) return 'seller';
  return 'buyer';
}

export default function SolsticeApp({ onExit, userRole, userName = '' }: Props) {
  const [splash, setSplash] = useState(true);
  const [page, setPage] = useState<SolsticePage>('landing');
  const [reservaWeek, setReservaWeek] = useState<string | undefined>(undefined);

  const [commandPlatform, setCommandPlatform] = useState<'solstice' | 'midnight' | null>(
    DUAL_COMMAND_ENABLED ? null : 'solstice'
  );

  const role = solsticeRole(userRole);
  const isSeller = role === 'seller';

  useEffect(() => {
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  }, [page, reservaWeek]);

  const handleNavigate = (target: string) => {
    if (target === 'home') { onExit(); return; }
    if (target.startsWith('reserva:')) {
      setReservaWeek(target.slice('reserva:'.length));
      setPage('reserva');
      return;
    }
    if (target === 'reserva') {
      setReservaWeek(undefined);
      setPage('reserva');
      return;
    }
    setPage(target as SolsticePage);
  };

  if (DUAL_COMMAND_ENABLED && isSeller && commandPlatform === null) {
    return (
      <SolsticeCommandSelector
        sellerName={userName}
        onSelectSolstice={() => setCommandPlatform('solstice')}
        onSelectMidnight={() => { setCommandPlatform('midnight'); onExit(); }}
      />
    );
  }

  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>

      {/* Splash — z-9000, covers everything while loading */}
      <AnimatePresence>
        {splash && <SolsticeSplash onComplete={() => setSplash(false)} />}
      </AnimatePresence>

      <MouseTrail rgb="230,57,47" />

      {/*
        Top fade mask — covers content scrolling under the fixed MIDNIGHT logo
        + nav button. Safe area inset handled via padding-top so the mask
        truly starts at the physical top on notch/Dynamic Island iPhones.
      */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          // extra height to cover safe-area-inset-top on iPhone
          height: 'calc(5.5rem + env(safe-area-inset-top, 0px))',
          background: 'linear-gradient(to bottom, #000000 0%, rgba(0,0,0,0.75) 45%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 140,
        }}
      />

      {/* Nav + content fade in together after splash exits — prevents nav button popping */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: splash ? 0 : 1 }}
        transition={{ duration: 1.0, delay: splash ? 0 : 0.15, ease: 'easeInOut' }}
      >
        <SolsticeNav
          currentPage={page}
          onNavigate={p => handleNavigate(p)}
          onExit={onExit}
          role={role}
        />

        {page === 'landing'       && <SolsticeLanding onNavigate={handleNavigate} />}
        {page === 'programa'      && <SolsticePrograma onNavigate={handleNavigate} />}
        {page === 'reserva'       && (
          <SolsticeReserva
            initialWeek={reservaWeek}
            onBack={() => setPage('landing')}
          />
        )}
        {page === 'admin-config'  && <SolsticeAdminConfig />}
        {page === 'admin-sellers' && <SolsticeVentasDashboard role="admin" />}
        {page === 'admin-finance' && <SolsticeAdminFinance />}
        {page === 'admin-cobros'  && <SolsticeAdminCobros />}
        {page === 'check-in'      && <SolsticeAdminCheckin />}
        {page === 'seller'        && <SolsticeVentasDashboard role="seller" />}
        {page === 'manager'       && <SolsticeVentasDashboard role="manager" />}
        {page === 'buyer'         && <SolsticeMiSemana />}
      </motion.div>
    </div>
  );
}
