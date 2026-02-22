import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Showcase } from './pages/Showcase';
import { Dashboard } from './pages/Dashboard';
import { AdminEvents } from './pages/AdminEvents';
import { Projections } from './pages/Projections';
import { SuccessPage } from './pages/SuccessPage'; // Importar nueva página
import { CheckoutModal } from './components/CheckoutModal';
import MagicPanel from './components/MagicPanel';
import { UserRole, Event } from './types';
import { useStore } from './context/StoreContext';
import { CheckCircle2 } from 'lucide-react';

import TicketWallet from './components/TicketWallet';

const App: React.FC = () => {
  const { currentUser, promoters, currentCustomer } = useStore();
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isMagicOpen, setIsMagicOpen] = useState(false);
  
  const [referralToast, setReferralToast] = useState<{show: boolean, name: string}>({show: false, name: ''});

  // Check for Success Page redirect from Bold
  const isSuccessPage = window.location.pathname === '/gracias';

  // Lógica de Atribución de Referidos (Landing Page Personalizada)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    
    // Si hay promotores cargados y un código en la URL
    if (refCode && promoters.length > 0) {
      const code = refCode.toUpperCase();
      const promoter = promoters.find(p => p.code === code);
      
      if (promoter) {
          // 1. Guardar Código para la UI
          localStorage.setItem('midnight_referral_code', code);
          // 2. IMPORTANTE: Guardar ID para la Base de Datos (Comisiones)
          localStorage.setItem('midnight_referral_code_id', promoter.user_id);
          
          setReferralToast({ show: true, name: promoter.name });
          
          // Limpiar la URL para que se vea limpia pero manteniendo la sesión
          const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.pushState({path: newUrl}, '', newUrl);

          setTimeout(() => setReferralToast({ show: false, name: '' }), 5000);
      }
    }
  }, [promoters]);

  useEffect(() => {
    if (!currentUser && (currentPage === 'dashboard' || currentPage === 'admin-events' || currentPage === 'projections')) {
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

  // Si la ruta es /gracias, mostramos el componente dedicado
  if (isSuccessPage) {
      return <SuccessPage />;
  }

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

      {referralToast.show && (
          <div className="fixed top-24 right-0 left-0 md:left-auto md:right-12 z-[90] flex justify-center md:justify-end animate-in slide-in-from-top-5 duration-500">
              <div className="bg-eclipse/20 border border-eclipse/30 backdrop-blur-xl text-moonlight px-8 py-5 rounded-none shadow-[0_0_50px_rgba(73,15,124,0.2)] flex items-center gap-5">
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
        <div className={currentPage === 'home' ? '' : 'pt-24 px-6 md:px-12 max-w-7xl mx-auto pb-20'}>
          {currentPage === 'dashboard' && <Dashboard role={currentUser?.role || UserRole.GUEST} />}
          {currentPage === 'admin-events' && <AdminEvents role={currentUser?.role || UserRole.GUEST} />}
          {currentPage === 'projections' && <Projections role={currentUser?.role || UserRole.GUEST} />}
          {currentPage === 'tickets' && (
            <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
                <div className="mb-12 text-center">
                    <h2 className="text-4xl md:text-6xl font-black text-moonlight uppercase tracking-tighter mb-4">Mis Entradas</h2>
                    <p className="text-moonlight/40 text-xs md:text-sm font-light tracking-[0.3em] uppercase">Tus códigos de acceso para las próximas experiencias</p>
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
    </div>
  );
};

export default App;