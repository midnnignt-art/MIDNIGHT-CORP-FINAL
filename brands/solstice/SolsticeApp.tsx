import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
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
import SolsticeTopClients from './pages/SolsticeTopClients';
import SolsticeAdminBoatReservations from './pages/SolsticeAdminBoatReservations';
import SolsticeAdminLodgingReservations from './pages/SolsticeAdminLodgingReservations';
import SolsticeProyecciones from './pages/SolsticeProyecciones';
import SolsticeCodigosDescuentos from './pages/SolsticeCodigosDescuentos';
import SolsticeContabilidad from './pages/SolsticeContabilidad';
import { DUAL_COMMAND_ENABLED } from './featureFlags';
import { UserRole } from '../../types';
import { MouseTrail } from '../../components/MouseTrail';
import { ChevronLeft } from 'lucide-react';

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
  if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) return 'admin';
  if (userRole === UserRole.MANAGER) return 'manager';
  if (userRole === UserRole.PROMOTER) return 'seller';
  return 'buyer';
}

export default function SolsticeApp({ onExit, userRole, userName = '' }: Props) {
  // Detectamos invite_code en la URL al montar — si está, saltamos splash y
  // entramos directo a la reserva con el código pre-validado.
  const initialInviteCode = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('invite') || sessionStorage.getItem('solstice_boat_invite') || '').toUpperCase() || undefined;
    } catch { return undefined; }
  })();

  const [splash, setSplash] = useState(!initialInviteCode);
  const [page, setPage] = useState<SolsticePage>(initialInviteCode ? 'reserva' : 'landing');
  const [reservaWeek, setReservaWeek] = useState<string | undefined>(undefined);
  const [inviteCode] = useState<string | undefined>(initialInviteCode);

  const [commandPlatform, setCommandPlatform] = useState<'solstice' | 'midnight' | null>(
    DUAL_COMMAND_ENABLED ? null : 'solstice'
  );

  const role = solsticeRole(userRole);
  const isSeller = role === 'seller';
  const isAdmin = role === 'admin';

  // Forzar bg negro puro en body/html mientras Solstice esté montado.
  // Sin esto, el bg-void (#0B0316) del body queda visible en overscroll y
  // al final del scroll, dando un "halo morado" que rompe la atmósfera.
  useEffect(() => {
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, []);

  // ── Browser history sync ─────────────────────────────────────────────────
  // Sin esto el botón "atrás" del navegador sale de Solstice al home.
  // Cada cambio de page hace pushState, y popstate restaura el page anterior.
  useEffect(() => {
    // Inicializar el history state si todavía no existe
    if (!window.history.state?.solsticePage) {
      window.history.replaceState({ solsticePage: page }, '');
    }
    const onPop = (e: PopStateEvent) => {
      const target = e.state?.solsticePage;
      if (target && typeof target === 'string') {
        setPage(target as SolsticePage);
      } else {
        // No hay state Solstice en el history → salir limpio
        onExit();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push state cada vez que page cambia (excepto en el primer render)
  const isFirstPageRender = useRef(true);
  useEffect(() => {
    if (isFirstPageRender.current) {
      isFirstPageRender.current = false;
      return;
    }
    if (window.history.state?.solsticePage !== page) {
      window.history.pushState({ solsticePage: page }, '');
    }
  }, [page]);

  // Load branding config from Supabase on mount so all devices stay in sync
  useEffect(() => {
    supabase.storage.from('assets').download('solstice/brand/config.json')
      .then(({ data }) => data?.text())
      .then(text => {
        if (!text) return;
        const cfg = JSON.parse(text);
        if (cfg.logo_url) {
          localStorage.setItem('solstice_logo_url', cfg.logo_url);
          window.dispatchEvent(new CustomEvent('solstice-logo-change', { detail: cfg.logo_url }));
        }
        if (cfg.sizes) Object.entries(cfg.sizes).forEach(([ctx, px]) => {
          localStorage.setItem(`solstice_logo_size_${ctx}`, String(px));
          window.dispatchEvent(new CustomEvent(`solstice-logo-size-${ctx}`, { detail: Number(px) }));
        });
        if (cfg.position) {
          localStorage.setItem('solstice_logo_pos', JSON.stringify(cfg.position));
          window.dispatchEvent(new CustomEvent('solstice-logo-pos', { detail: cfg.position }));
        }
      })
      .catch(() => {}); // silent — use localStorage fallback
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  }, [page, reservaWeek]);

  // ── Permission guard: si el rol actual no permite la página actual, lo
  // mandamos al landing. Mantiene en sync el menú visible (filtrado por
  // rol en SolsticeNav) con el render real — un seller que llegue a una
  // admin-page por URL stale o cambio de rol queda fuera.
  const PAGE_ROLES: Record<SolsticePage, ('admin'|'manager'|'seller'|'buyer')[]> = {
    landing:               ['admin','manager','seller','buyer'],
    programa:              ['admin','manager','seller','buyer'],
    reserva:               ['admin','manager','seller','buyer'],
    'admin-config':        ['admin'],
    'admin-sellers':       ['admin','manager'],
    'admin-finance':       ['admin'],
    'admin-cobros':        ['admin'],
    'admin-proyecciones':  ['admin'],
    'admin-codes':         ['admin'],
    'admin-accounting':    ['admin'],
    'admin-top-clients':   ['admin','manager'],
    'admin-boats':         ['admin','manager'],
    'admin-lodgings':      ['admin','manager'],
    'check-in':            ['admin','manager'],
    seller:                ['seller'],
    manager:               ['manager'],
    buyer:                 ['buyer'],
  };
  useEffect(() => {
    const allowed = PAGE_ROLES[page];
    if (allowed && !allowed.includes(role)) {
      setPage('landing');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, role]);

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

      <MouseTrail rgb="230,57,47" intensity={0.35} />

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

      {/* MIDNIGHT wordmark naranja — consistente en todas las pages de Solstice.
          Fade-in junto al nav. Same look que el logo-main de MidnightApp en
          modo solstice-preview, para que la marca se sienta unificada. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: splash ? 0 : 1 }}
        transition={{ duration: 1.0, delay: splash ? 0 : 0.25, ease: 'easeInOut' }}
        className="logo-main flex flex-col items-center"
        aria-hidden
      >
        <span
          className="text-xl md:text-3xl font-black tracking-[-0.1em]"
          style={{ color: '#E6392F' }}
        >MIDNIGHT</span>
        <span
          className="text-[8px] font-light tracking-[0.8em] uppercase -mt-1 ml-1"
          style={{ color: 'rgba(230,57,47,0.65)' }}
        >Worldwide</span>
      </motion.div>

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

        {/* Botón Volver — visible en todas las sub-páginas excepto landing.
            Usa history.back() para que el browser back también funcione natural. */}
        {page !== 'landing' && page !== 'reserva' && (
          <button
            onClick={() => {
              if (window.history.state?.solsticePage && window.history.state.solsticePage !== 'landing') {
                window.history.back();
              } else {
                setPage('landing');
              }
            }}
            className="fixed left-4 md:left-5 z-[180] flex items-center gap-2 py-2.5 px-4 md:py-3 md:px-5 rounded-full shadow-lg"
            style={{
              top: 'calc(4.5rem + env(safe-area-inset-top, 0px))',
              background: 'rgba(10,0,0,0.78)',
              backdropFilter: 'blur(20px) saturate(160%)',
              border: '0.5px solid rgba(230,57,47,0.40)',
              color: '#F9F2D7',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(230,57,47,0.65)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(230,57,47,0.40)';
            }}
            aria-label="Volver"
          >
            <ChevronLeft size={14} />
            <span className="text-[10px] uppercase hidden sm:inline" style={{ letterSpacing: '0.2em', fontWeight: 600 }}>
              Volver
            </span>
          </button>
        )}

        {page === 'landing'       && <SolsticeLanding onNavigate={handleNavigate} isAdmin={isAdmin} />}
        {page === 'programa'      && <SolsticePrograma onNavigate={handleNavigate} />}
        {page === 'reserva'       && (
          <SolsticeReserva
            initialWeek={reservaWeek}
            initialInviteCode={inviteCode}
            onBack={() => setPage('landing')}
          />
        )}
        {page === 'admin-config'  && <SolsticeAdminConfig />}
        {page === 'admin-sellers' && <SolsticeVentasDashboard role="admin" />}
        {page === 'admin-finance' && <SolsticeAdminFinance />}
        {page === 'admin-cobros'  && <SolsticeAdminCobros />}
        {page === 'admin-proyecciones' && <SolsticeProyecciones />}
        {page === 'admin-codes'        && <SolsticeCodigosDescuentos />}
        {page === 'admin-accounting'   && <SolsticeContabilidad />}
        {page === 'admin-top-clients' && <SolsticeTopClients />}
        {page === 'admin-boats'   && <SolsticeAdminBoatReservations />}
        {page === 'admin-lodgings' && <SolsticeAdminLodgingReservations />}
        {page === 'check-in'      && <SolsticeAdminCheckin />}
        {page === 'seller'        && <SolsticeVentasDashboard role="seller" />}
        {page === 'manager'       && <SolsticeVentasDashboard role="manager" />}
        {page === 'buyer'         && <SolsticeMiSemana />}
      </motion.div>
    </div>
  );
}
