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
    const pct = parseInt(localStorage.getItem('ms_dc_pct') || '0');
    if (!pct) return null;
    return {
      pct,
      label:    localStorage.getItem('ms_dc_label')     || '',
      tierName: localStorage.getItem('ms_dc_tier_name') || '',
      eventId:  localStorage.getItem('ms_dc_event_id')  || '',
    };
  });

  function handleDiscountBuy() {
    if (!discountBanner?.eventId) return;
    const ev = events.find(e => e.id === discountBanner.eventId);
    if (ev) { setSelectedEvent(ev); setIsCheckoutOpen(true); }
  }

  function dismissDiscountBanner() {
    setDiscountBanner(null);
  }
  
  const [referralToast, setReferralToast] = useState<{show: boolean, name: string}>({show: false, name: ''});

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

  // Lógica de Atribución de Referidos (Landing Page Personalizada)
  useEffect(() => {
    if (!pendingRef || promoters.length === 0) return;

    const code = pendingRef.toUpperCase();
    const promoter = promoters.find(p => p.code === code);

    if (promoter) {
      // 1. Guardar para la UI y atribución de ventas
      localStorage.setItem('midnight_referral_code', code);
      localStorage.setItem('midnight_referral_code_id', promoter.user_id);

      // 2. Incrementar contador via RPC (bypasa RLS con SECURITY DEFINER)
      supabase.rpc('increment_link_views', { p_code: code }).then(() => {});

      // 3. Mostrar toast de bienvenida
      setReferralToast({ show: true, name: promoter.name });
      setTimeout(() => setReferralToast({ show: false, name: '' }), 5000);

      // 4. Limpiar la URL
      const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
      window.history.pushState({}, '', cleanUrl);

      // 5. No volver a procesar
      setPendingRef(null);
    }
  }, [promoters, pendingRef]);

  useEffect(() => {
    if (!currentUser && (currentPage === 'dashboard' || currentPage === 'admin-events' || currentPage === 'projections' || currentPage === 'contabilidad' || currentPage === 'codes-discounts')) {
      setCurrentPage('home');
    }
    if (!currentCustomer && currentPage === 'tickets') {
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

      {/* Discount banner */}
      {discountBanner && (
        <div className="fixed top-0 left-0 right-0 z-[95] flex items-center justify-center gap-3 px-4 py-3 animate-in slide-in-from-top-3 duration-500"
          style={{ background: 'linear-gradient(90deg,#C9A84C,#A07820,#C9A84C)', backgroundSize: '200% 100%' }}
        >
          <Tag className="w-4 h-4 text-black/70 flex-shrink-0" />
          <p className="text-black font-black text-xs md:text-sm tracking-wide text-center flex-1">
            Tienes un <strong>{discountBanner.pct}% de descuento</strong>
            {discountBanner.tierName ? <> en <strong>{discountBanner.tierName}</strong></> : ''}
            {' '}— {discountBanner.label}
          </p>
          {discountBanner.eventId && (
            <button
              onClick={handleDiscountBuy}
              className="bg-black/20 hover:bg-black/30 text-black font-black text-[10px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-full transition-all flex-shrink-0"
            >
              Comprar →
            </button>
          )}
          <button onClick={dismissDiscountBanner} className="text-black/50 hover:text-black transition-colors flex-shrink-0 p-1">
            <XIcon size={16} />
          </button>
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