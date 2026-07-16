import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { supabase } from './lib/supabase';
import { Navbar } from './components/Navbar';
import { Showcase } from './pages/Showcase';
import { SuccessPage } from './pages/SuccessPage';
import { CheckoutModal } from './components/CheckoutModal';
import MagicPanel from './components/MagicPanel';
import { UserRole, Event } from './types';
import { useStore } from './context/StoreContext';
import { isAdminLevel } from './lib/permissions';
import { CheckCircle2 } from 'lucide-react';

import TicketWallet from './components/TicketWallet';
import { ToastContainer } from './components/ToastContainer';
import { Tag, X as XIcon } from 'lucide-react';
import { ConjunctionPortal } from './pages/ConjunctionPortal';
import { useSolsticeVisibility } from './lib/useSolsticeVisibility';

// Code-split: páginas admin (cargan solo cuando se navega a ellas)
const Dashboard       = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const AdminEvents     = lazy(() => import('./pages/AdminEvents').then(m => ({ default: m.AdminEvents })));
const Projections     = lazy(() => import('./pages/Projections').then(m => ({ default: m.Projections })));
const TopClients      = lazy(() => import('./pages/TopClients').then(m => ({ default: m.TopClients })));
const Accounting      = lazy(() => import('./pages/Accounting').then(m => ({ default: m.Accounting })));
const CodesDiscounts  = lazy(() => import('./pages/CodesDiscounts').then(m => ({ default: m.CodesDiscounts })));
const SystemConfig    = lazy(() => import('./pages/SystemConfig').then(m => ({ default: m.SystemConfig })));

// Code-split: rutas públicas dedicadas (no necesarias en home)
const BouncerScanner         = lazy(() => import('./pages/BouncerScanner'));
const SolsticeBouncerScanner = lazy(() => import('./brands/solstice/pages/SolsticeBouncerScanner'));
const PromoLanding      = lazy(() => import('./pages/PromoLanding'));
const GuestListLanding  = lazy(() => import('./pages/GuestListLanding'));
const DiscountLanding   = lazy(() => import('./pages/DiscountLanding'));
const NotFound          = lazy(() => import('./pages/NotFound'));
const EventDetail       = lazy(() => import('./pages/EventDetail').then(m => ({ default: m.EventDetail })));

// Code-split: sub-marca completa (Solstice tiene su propio splash al cargar)
const SolsticeApp = lazy(() => import('./brands/solstice/SolsticeApp'));
const SolsticeInviteLanding = lazy(() => import('./brands/solstice/pages/SolsticeInviteLanding'));
const SolsticePromoLanding  = lazy(() => import('./brands/solstice/pages/SolsticePromoLanding'));

const App: React.FC = () => {
  const { currentUser, promoters, currentCustomer, events } = useStore();
  const [currentPage, setCurrentPage] = useState<string>('portal');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<'tickets' | 'tables'>('tickets');
  const [isMagicOpen, setIsMagicOpen] = useState(false);

  // Feature flag para mostrar el planeta SOLSTICE en el portal. Mientras la
  // sub-marca no esté lista para el mercado, solo admins pueden verlo.
  // Se activa desde admin (system-config) cuando salga al público.
  // En desarrollo local (import.meta.env.DEV) siempre se muestra para poder
  // probar Solstice con todos los roles; en producción NO afecta (DEV=false).
  const [solsticePublicVisible] = useSolsticeVisibility();
  const showSolsticeInPortal = solsticePublicVisible || isAdminLevel(currentUser?.role) || import.meta.env.DEV;

  // Discount banner — shown when user arrived via a discount link
  const [discountBanner, setDiscountBanner] = useState<{ pct: number; label: string; tierName: string; eventId: string } | null>(() => {
    const pct = parseInt(sessionStorage.getItem('ms_dc_pct') || '0');
    if (!pct) return null;
    return {
      pct,
      label:    sessionStorage.getItem('ms_dc_label')     || '',
      tierName: sessionStorage.getItem('ms_dc_tier_name') || '',
      eventId:  sessionStorage.getItem('ms_dc_event_id')  || '',
    };
  });

  function handleDiscountBuy() {
    if (!discountBanner?.eventId) return;
    const ev = events.find(e => e.id === discountBanner.eventId);
    if (ev) { setSelectedEvent(ev); setIsCheckoutOpen(true); }
  }

  function clearDiscountSession() {
    ['ms_dc_code','ms_dc_pct','ms_dc_label','ms_dc_event_id','ms_dc_tier_id','ms_dc_tier_name']
      .forEach(k => sessionStorage.removeItem(k));
  }

  function dismissDiscountBanner() {
    setDiscountBanner(null);
    clearDiscountSession();
  }
  
  const [referralToast, setReferralToast] = useState<{show: boolean, name: string}>({show: false, name: ''});
  // staffId resuelto — se pasa directamente al checkout
  const [referralStaffId, setReferralStaffId] = useState<string | null>(null);

  // Capturar el código INMEDIATAMENTE al montar — SÍNCRONO, sin queries
  const [pendingRef] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      // Guardar el código raw en sessionStorage AHORA, antes de cualquier render
      sessionStorage.setItem('ms_ref_code', ref.toUpperCase());
      // Limpiar URL inmediatamente
      const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
    return ref ? ref.toUpperCase() : null;
  });

  // Check for special routes
  const pathname       = window.location.pathname;
  const isHomePage     = pathname === '/' || pathname === '';
  const isSuccessPage  = pathname === '/gracias';
  const isBouncerPage  = pathname === '/bouncer';
  const isSolsticeBouncerPage = pathname === '/sol/bouncer';
  const promoMatch     = pathname.match(/^\/promo\/([^/]+)$/);
  const glMatch        = pathname.match(/^\/gl\/([^/]+)$/);
  const discountMatch  = pathname.match(/^\/d\/([^/]+)$/);
  const eventMatch     = pathname.match(/^\/event\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  const solsticeInviteMatch = pathname.match(/^\/sol\/i\/([A-Za-z0-9]{4,12})$/);
  const solsticePromoMatch  = pathname.match(/^\/sol\/p\/([A-Za-z0-9_-]{2,32})$/);
  const isSolsticePublic = pathname === '/sol' || pathname === '/sol/' || pathname.startsWith('/sol/reserva');
  const isKnownRoute   = isHomePage || isSuccessPage || isBouncerPage || isSolsticeBouncerPage || !!promoMatch || !!glMatch || !!discountMatch || !!eventMatch || !!solsticeInviteMatch || !!solsticePromoMatch || isSolsticePublic;

  // Conteo de vistas del link: incrementar apenas hay un ?ref=, SIN depender de
  // que la lista de promotores esté cargada en el cliente. Un visitante anónimo
  // (el caso normal de un link) NO tiene `promoters` cargado por RLS, así que el
  // increment de abajo nunca corría. El RPC matchea el code server-side. Una sola
  // vez por sesión para no inflar el conteo en cada render/navegación.
  useEffect(() => {
    if (!pendingRef) return;
    const key = `ms_viewed_ref_${pendingRef}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    supabase.rpc('increment_link_views', { p_code: pendingRef }).then(() => {}, () => {});
  }, [pendingRef]);

  // Una vez cargados los promotores, resolver el nombre para el toast y el staffId para el checkout
  useEffect(() => {
    if (!pendingRef || promoters.length === 0) return;

    const promoter = promoters.find(p => p.code?.toUpperCase() === pendingRef);
    if (promoter) {
      setReferralStaffId(promoter.user_id);
      localStorage.setItem('midnight_referral_code', pendingRef);
      localStorage.setItem('midnight_referral_code_id', promoter.user_id);
      setReferralToast({ show: true, name: promoter.name });
      setTimeout(() => setReferralToast({ show: false, name: '' }), 5000);
    }
  }, [promoters, pendingRef]);

  useEffect(() => {
    if (!currentUser && (currentPage === 'dashboard' || currentPage === 'admin-events' || currentPage === 'projections' || currentPage === 'contabilidad' || currentPage === 'codes-discounts' || currentPage === 'system-config')) {
      setCurrentPage('home');
    }
    if (!currentCustomer && !currentUser && currentPage === 'tickets') {
      setCurrentPage('home');
    }
  }, [currentUser, currentCustomer]);

  const handleNavigate = (page: string) => {
    if (page === 'magic') {
      setIsMagicOpen(true);
      return;
    }
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  // ── Sync currentPage con el history del browser para que el back button
  // del navegador funcione. Cuando el user sale del portal hacia una marca,
  // pusheamos al historial; cuando da back, volvemos al portal.
  useEffect(() => {
    if (!window.history.state || window.history.state.appPage !== currentPage) {
      // Replace inicial — sin generar entrada extra
      if (!window.history.state?.appPage) {
        window.history.replaceState({ appPage: currentPage }, '');
      } else {
        window.history.pushState({ appPage: currentPage }, '');
      }
    }
  }, [currentPage]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const target = e.state?.appPage;
      if (typeof target === 'string') {
        setCurrentPage(target);
      } else {
        // Sin state Midnight: volver al portal por defecto
        setCurrentPage('portal');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleBuyTicket = (event: Event, mode: 'tickets' | 'tables' = 'tickets') => {
    setSelectedEvent(event);
    setCheckoutMode(mode);
    setIsCheckoutOpen(true);
  };

  const handlePurchaseComplete = () => {
    setIsCheckoutOpen(false);
    setDiscountBanner(null);
    clearDiscountSession();
  };

  if (isSuccessPage)   return <SuccessPage />;
  if (isBouncerPage)   return <Suspense fallback={null}><BouncerScanner /></Suspense>;
  if (isSolsticeBouncerPage) return <Suspense fallback={null}><SolsticeBouncerScanner /></Suspense>;
  if (promoMatch)      return <Suspense fallback={null}><PromoLanding    codigo={promoMatch[1]} /></Suspense>;
  if (glMatch)         return <Suspense fallback={null}><GuestListLanding codigo={glMatch[1]} /></Suspense>;
  if (discountMatch)   return <Suspense fallback={null}><DiscountLanding  codigo={discountMatch[1]} /></Suspense>;
  if (solsticeInviteMatch) return <Suspense fallback={null}><SolsticeInviteLanding inviteCode={solsticeInviteMatch[1]} /></Suspense>;
  if (solsticePromoMatch)  return <Suspense fallback={null}><SolsticePromoLanding refCode={solsticePromoMatch[1]} /></Suspense>;
  if (isSolsticePublic) return (
    <Suspense fallback={null}>
      <SolsticeApp
        onExit={() => { window.location.href = '/'; }}
        userRole={currentUser?.role || UserRole.GUEST}
        userName={currentUser?.name || ''}
      />
    </Suspense>
  );
  if (eventMatch) return (
    <>
      <Suspense fallback={null}>
        <EventDetail
          eventId={eventMatch[1]}
          onBuy={handleBuyTicket}
          onBack={() => { window.location.href = '/'; }}
        />
      </Suspense>
      <CheckoutModal
        event={selectedEvent}
        isOpen={isCheckoutOpen}
        onClose={handlePurchaseComplete}
        referralStaffId={referralStaffId}
        mode={checkoutMode}
      />
      <ToastContainer />
    </>
  );
  if (!isKnownRoute)   return <Suspense fallback={null}><NotFound /></Suspense>;

  const isSolstice = currentPage === 'solstice-preview';
  const isPortal = currentPage === 'portal';

  return (
    <div className="min-h-screen bg-black text-moonlight font-sans selection:bg-eclipse selection:text-white relative">
      {/* GLOBAL DYNAMIC LOGO — orange+blend in Solstice mode, white otherwise */}
      {!isPortal && (
        <div className="logo-main flex flex-col items-center">
          <span
            className="text-xl md:text-3xl font-black tracking-[-0.1em]"
            style={{ color: isSolstice ? '#E6392F' : 'white', transition: 'color 0.6s ease' }}
          >MIDNIGHT</span>
          <span
            className="text-[8px] font-light tracking-[0.8em] uppercase -mt-1 ml-1"
            style={{ color: isSolstice ? 'rgba(230,57,47,0.65)' : 'rgba(255,255,255,0.7)', transition: 'color 0.6s ease' }}
          >Worldwide</span>
        </div>
      )}

      {/* Midnight navbar — hidden while inside Solstice or Portal to avoid overlap */}
      {!isSolstice && !isPortal && (
        <Navbar onNavigate={handleNavigate} currentPage={currentPage} />
      )}

      {/* Discount banner — hidden in Solstice or Portal */}
      {discountBanner && !isSolstice && !isPortal && (
        <div className="fixed top-[4.5rem] md:top-[3.8rem] left-1/2 -translate-x-1/2 z-[95] animate-in slide-in-from-top-2 duration-400 px-4 w-full max-w-xs">
          <div className="flex items-center gap-2.5 bg-[#0A0A0A]/95 border border-[#C9A84C]/30 rounded-full px-4 py-1.5 shadow-[0_0_20px_rgba(201,168,76,0.10)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] flex-shrink-0 shadow-[0_0_6px_#C9A84C]" />
            <p className="text-[#C9A84C] text-[11px] font-bold flex-1 truncate" style={{ fontFamily: "'Space Mono',monospace" }}>
              {discountBanner.pct}% off{discountBanner.tierName ? ` · ${discountBanner.tierName}` : ''}
            </p>
            {discountBanner.eventId && (
              <button
                onClick={handleDiscountBuy}
                className="bg-[#C9A84C] text-black text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full hover:opacity-90 transition-all flex-shrink-0 whitespace-nowrap"
              >
                Comprar →
              </button>
            )}
            <button onClick={dismissDiscountBanner} className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0">
              <XIcon size={12} />
            </button>
          </div>
        </div>
      )}

      {referralToast.show && !isSolstice && (
          <div className="fixed top-24 right-0 left-0 md:left-auto md:right-12 z-[90] flex justify-center md:justify-end animate-in slide-in-from-top-5 duration-500">
              <div className="bg-eclipse/20 border border-eclipse/30 backdrop-blur-xl text-moonlight px-5 md:px-8 py-4 md:py-5 rounded-2xl shadow-[0_0_50px_rgba(73,15,124,0.2)] flex items-center gap-4 md:gap-5 mx-4 md:mx-0">
                  <div className="bg-eclipse/40 p-2.5 rounded-full">
                      <CheckCircle2 className="w-5 h-5 text-moonlight" />
                  </div>
                  <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-moonlight/40 mb-1">Invitación Aplicada</p>
                      <p className="text-sm text-moonlight font-light tracking-wide">Atendido por <span className="font-black">{referralToast.name.toUpperCase()}</span></p>
                  </div>
              </div>
          </div>
      )}

      <main>
        {currentPage === 'portal' && (
          <ConjunctionPortal
            showSolstice={showSolsticeInPortal}
            onEnterBrand={(brand) => {
              if (brand === 'midnight') setCurrentPage('home');
              // Solstice → ruta pública /sol con su propio splash de marca
              if (brand === 'solstice') { window.location.href = '/sol'; }
            }}
          />
        )}
        {currentPage === 'home' && (
          <div key="midnight-enter" className="animate-midnight-enter">
            <Showcase onBuy={handleBuyTicket} onNavigate={handleNavigate} />
          </div>
        )}
        {currentPage === 'solstice-preview' && isAdminLevel(currentUser?.role) && (
          <Suspense fallback={null}>
            <SolsticeApp onExit={() => handleNavigate('home')} userRole={currentUser.role} userName={currentUser?.name || ''} />
          </Suspense>
        )}
        <div className={currentPage === 'home' ? '' : 'pt-20 md:pt-24 px-4 sm:px-6 md:px-12 max-w-7xl mx-auto pb-20'}>
          <Suspense fallback={null}>
            {currentPage === 'dashboard' && <Dashboard role={currentUser?.role || UserRole.GUEST} />}
            {currentPage === 'admin-events' && <AdminEvents role={currentUser?.role || UserRole.GUEST} />}
            {currentPage === 'projections' && <Projections role={currentUser?.role || UserRole.GUEST} />}
            {currentPage === 'top-clients' && <TopClients role={currentUser?.role || UserRole.GUEST} />}
            {currentPage === 'contabilidad' && <Accounting />}
            {currentPage === 'codes-discounts' && <CodesDiscounts />}
            {currentPage === 'system-config' && <SystemConfig />}
          </Suspense>
          {currentPage === 'tickets' && (
            <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl md:text-6xl font-black text-moonlight uppercase tracking-tighter mb-4">Mis Entradas</h2>
                    <p className="text-moonlight/40 text-xs md:text-sm font-light tracking-[0.15em] md:tracking-[0.3em] uppercase">Tus códigos de acceso para las próximas experiencias</p>
                </div>
                <TicketWallet />
            </div>
          )}
        </div>
      </main>

      <CheckoutModal
        event={selectedEvent}
        isOpen={isCheckoutOpen}
        onClose={handlePurchaseComplete}
        referralStaffId={referralStaffId}
        mode={checkoutMode}
      />

      <MagicPanel
        isOpen={isMagicOpen}
        onClose={() => setIsMagicOpen(false)}
      />

      <ToastContainer />
    </div>
  );
};

export default App;