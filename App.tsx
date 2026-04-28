import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Navbar } from './components/Navbar';
import { Showcase } from './pages/Showcase';
import { Dashboard } from './pages/Dashboard';
import { AdminEvents } from './pages/AdminEvents';
import { Projections } from './pages/Projections';
import { TopClients } from './pages/TopClients';
import { Accounting } from './pages/Accounting';
import { CodesDiscounts } from './pages/CodesDiscounts';
import { Ruleta } from './pages/Ruleta';
import { SuccessPage } from './pages/SuccessPage';
import BouncerScanner from './pages/BouncerScanner';
import PromoLanding from './pages/PromoLanding';
import GuestListLanding from './pages/GuestListLanding';
import DiscountLanding from './pages/DiscountLanding';
import { CheckoutModal } from './components/CheckoutModal';
import MagicPanel from './components/MagicPanel';
import { UserRole, Event } from './types';
import { useStore } from './context/StoreContext';
import { CheckCircle2 } from 'lucide-react';

import TicketWallet from './components/TicketWallet';
import { ToastContainer } from './components/ToastContainer';
import { Tag, X as XIcon } from 'lucide-react';

const App: React.FC = () => {
  const { currentUser, promoters, currentCustomer, events } = useStore();
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isMagicOpen, setIsMagicOpen] = useState(false);

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
  // staffId resuelto del link ?ref=CODE — se pasa directamente al checkout (no depende de localStorage)
  const [referralStaffId, setReferralStaffId] = useState<string | null>(null);

  // Capturar el código INMEDIATAMENTE al montar (antes de que se limpie la URL)
  const [pendingRef, setPendingRef] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref');
  });

  // Check for special routes
  const isSuccessPage  = window.location.pathname === '/gracias';
  const isBouncerPage  = window.location.pathname === '/bouncer';
  const promoMatch     = window.location.pathname.match(/^\/promo\/([^/]+)$/);
  const glMatch        = window.location.pathname.match(/^\/gl\/([^/]+)$/);
  const discountMatch  = window.location.pathname.match(/^\/d\/([^/]+)$/);

  // Atribución de referidos — query directa e inmediata, sin depender del estado promoters
  useEffect(() => {
    if (!pendingRef) return;

    const code = pendingRef.toUpperCase();

    async function resolveReferral() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, code')
        .ilike('code', code)
        .maybeSingle();

      if (data?.id) {
        // Guardar en estado React (primera prioridad al checkout) Y en localStorage (fallback)
        setReferralStaffId(data.id);
        localStorage.setItem('midnight_referral_code', code);
        localStorage.setItem('midnight_referral_code_id', data.id);
        supabase.rpc('increment_link_views', { p_code: code }).then(() => {});
        setReferralToast({ show: true, name: data.full_name || 'Vendedor' });
        setTimeout(() => setReferralToast({ show: false, name: '' }), 5000);
      } else {
        // Código inválido — limpiar localStorage stale para evitar atribuciones erróneas
        localStorage.removeItem('midnight_referral_code');
        localStorage.removeItem('midnight_referral_code_id');
      }

      const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
      window.history.pushState({}, '', cleanUrl);
      setPendingRef(null);
    }

    resolveReferral();
  }, [pendingRef]);

  useEffect(() => {
    if (!currentUser && (currentPage === 'dashboard' || currentPage === 'admin-events' || currentPage === 'projections' || currentPage === 'contabilidad' || currentPage === 'codes-discounts')) {
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

  const handleBuyTicket = (event: Event) => {
    setSelectedEvent(event);
    setIsCheckoutOpen(true);
  };

  const handlePurchaseComplete = () => {
    setIsCheckoutOpen(false);
    setDiscountBanner(null);
    clearDiscountSession();
  };

  if (isSuccessPage)   return <SuccessPage />;
  if (isBouncerPage)   return <BouncerScanner />;
  if (promoMatch)      return <PromoLanding    codigo={promoMatch[1]} />;
  if (glMatch)         return <GuestListLanding codigo={glMatch[1]} />;
  if (discountMatch)   return <DiscountLanding  codigo={discountMatch[1]} />;

  return (
    <div className="min-h-screen bg-void text-moonlight font-sans selection:bg-eclipse selection:text-white relative">
      {/* GLOBAL DYNAMIC LOGO */}
      <div className="logo-main flex flex-col items-center">
        <span className="text-xl md:text-3xl font-black tracking-[-0.1em] text-white">MIDNIGHT</span>
        <span className="text-[8px] font-light tracking-[0.8em] text-white/70 uppercase -mt-1 ml-1">Worldwide</span>
      </div>

      <Navbar 
        onNavigate={handleNavigate}
        currentPage={currentPage}
      />

      {/* Discount banner — just below the Midnight logo */}
      {discountBanner && (
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

      {referralToast.show && (
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
        {currentPage === 'home' && <Showcase onBuy={handleBuyTicket} onNavigate={handleNavigate} />}
        <div className={currentPage === 'home' ? '' : 'pt-20 md:pt-24 px-4 sm:px-6 md:px-12 max-w-7xl mx-auto pb-20'}>
          {currentPage === 'dashboard' && <Dashboard role={currentUser?.role || UserRole.GUEST} />}
          {currentPage === 'admin-events' && <AdminEvents role={currentUser?.role || UserRole.GUEST} />}
          {currentPage === 'projections' && <Projections role={currentUser?.role || UserRole.GUEST} />}
          {currentPage === 'top-clients' && <TopClients role={currentUser?.role || UserRole.GUEST} />}
          {currentPage === 'contabilidad' && <Accounting />}
          {currentPage === 'codes-discounts' && <CodesDiscounts />}
          {currentPage === 'ruleta' && <Ruleta />}
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