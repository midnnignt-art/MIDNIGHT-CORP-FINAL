import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Showcase } from './pages/Showcase';
import { Dashboard } from './pages/Dashboard';
import { AdminEvents } from './pages/AdminEvents';
import { Projections } from './pages/Projections';
import { SuccessPage } from './pages/SuccessPage'; // Importar nueva página
import { CheckoutModal } from './components/CheckoutModal';
import { UserRole, Event } from './types';
import { useStore } from './context/StoreContext';
import { CheckCircle2 } from 'lucide-react';

const App: React.FC = () => {
  const { currentUser, promoters } = useStore();
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
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
  }, [currentUser]);

  const handleNavigate = (page: string) => {
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
    <div className="min-h-screen bg-midnight-950 text-white font-sans selection:bg-neon-purple selection:text-white relative">
      <Navbar 
        onNavigate={handleNavigate}
        currentPage={currentPage}
      />

      {referralToast.show && (
          <div className="fixed top-24 right-0 left-0 md:left-auto md:right-6 z-[90] flex justify-center md:justify-end animate-in slide-in-from-top-5 duration-500">
              <div className="bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md text-emerald-400 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
                  <div className="bg-emerald-500/20 p-2 rounded-full">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">Invitación Aplicada</p>
                      <p className="text-sm text-white">Estás siendo atendido por <span className="font-bold">{referralToast.name}</span></p>
                  </div>
              </div>
          </div>
      )}

      <main>
        {currentPage === 'home' && <Showcase onBuy={handleBuyTicket} onNavigate={handleNavigate} />}
        {currentPage === 'dashboard' && <Dashboard role={currentUser?.role || UserRole.GUEST} />}
        {currentPage === 'admin-events' && <AdminEvents role={currentUser?.role || UserRole.GUEST} />}
        {currentPage === 'projections' && <Projections role={currentUser?.role || UserRole.GUEST} />}
      </main>

      <CheckoutModal 
        event={selectedEvent} 
        isOpen={isCheckoutOpen} 
        onClose={handlePurchaseComplete} 
      />
    </div>
  );
};

export default App;