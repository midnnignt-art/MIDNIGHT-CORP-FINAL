import React, { useEffect, useState } from 'react';
import { EventCard } from '../components/EventCard';
import { useStore } from '../context/StoreContext';
import { Event, UserRole } from '../types';
import { Ticket, Sparkles, UserCheck, PlusCircle, Grid, Wallet, Crown, Zap } from 'lucide-react';
import { Button } from '../components/ui/button';
import TicketWallet from '../components/TicketWallet';
import { motion } from 'framer-motion';

interface ShowcaseProps {
  onBuy: (event: Event) => void;
  onNavigate?: (page: string) => void;
}

export const Showcase: React.FC<ShowcaseProps> = ({ onBuy, onNavigate }) => {
  const { events, promoters, currentUser, currentCustomer } = useStore();
  const [referralInfo, setReferralInfo] = useState<{name: string, code: string} | null>(null);
  const [activeTab, setActiveTab] = useState<'events' | 'wallet'>('events');

  useEffect(() => {
      const storedCode = localStorage.getItem('midnight_referral_code');
      if (storedCode && promoters.length > 0) {
          const promoter = promoters.find(p => p.code === storedCode);
          if (promoter) {
              setReferralInfo({ name: promoter.name, code: promoter.code });
          }
      }
  }, [promoters]);

  return (
    <div className="min-h-screen pt-20 md:pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* PERSONALIZED LANDING HERO (Si hay referido) */}
      {referralInfo ? (
          <div className="mb-8 rounded-3xl bg-gradient-to-r from-zinc-900 to-black border border-white/10 relative overflow-hidden animate-in fade-in zoom-in duration-700 shadow-2xl shadow-neon-purple/5">
              <div className="absolute top-0 right-0 p-24 bg-neon-purple/10 blur-[80px] rounded-full pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between py-6 px-6 md:px-10 gap-6">
                  <div className="text-center md:text-left flex-1">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur-md mb-2">
                          <Crown className="w-3 h-3 text-amber-500 fill-amber-500" />
                          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Acceso VIP Activado</span>
                      </div>
                      
                      <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none mb-2">
                          INVITADO POR {referralInfo.name.split(' ')[0].toUpperCase()}
                      </h1>
                      
                      <p className="text-xs md:text-sm text-zinc-400 font-medium max-w-md">
                          Enlace exclusivo verificado. Tienes prioridad en la fila virtual y acceso a tickets reservados.
                      </p>
                  </div>

                  <div className="flex items-center gap-4">
                      <div className="px-5 py-2 bg-zinc-950/50 rounded-xl border border-white/10 flex items-center gap-4 backdrop-blur-sm">
                          <div className="flex flex-col text-right">
                              <span className="text-[9px] text-zinc-500 uppercase font-black">Código</span>
                              <span className="text-base font-mono font-bold text-white tracking-widest">{referralInfo.code}</span>
                          </div>
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse"></div>
                      </div>
                  </div>
              </div>
          </div>
      ) : (
          /* HERO STANDARD (Si no hay referido) */
          <div className="text-center mb-8 md:mb-12 space-y-2 md:space-y-4">
            <h1 className="text-3xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">
              DUEÑOS DE LA NOCHE.
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto text-sm md:text-lg italic px-4">
              Experiencias curadas para la vanguardia moderna.
            </p>
          </div>
      )}

      {/* TABS DE NAVEGACIÓN */}
      <div className="flex justify-center mb-8 md:mb-12">
          <div className="bg-zinc-900/50 p-1 md:p-1.5 rounded-full border border-white/10 inline-flex relative">
               <button 
                  onClick={() => setActiveTab('events')}
                  className={`relative z-10 px-4 py-1.5 md:px-6 md:py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'events' ? 'text-black' : 'text-zinc-500 hover:text-white'}`}
               >
                   <span className="flex items-center gap-2"><Grid size={12} className="md:w-[14px] md:h-[14px]"/> Cartelera</span>
               </button>
               <button 
                  onClick={() => setActiveTab('wallet')}
                  className={`relative z-10 px-4 py-1.5 md:px-6 md:py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'wallet' ? 'text-black' : 'text-zinc-500 hover:text-white'}`}
               >
                   <span className="flex items-center gap-2"><Wallet size={12} className="md:w-[14px] md:h-[14px]"/> Mis Boletas</span>
               </button>
               
               {/* Fondo Animado del Tab Activo */}
               <motion.div 
                  className="absolute top-1 md:top-1.5 bottom-1 md:bottom-1.5 bg-white rounded-full shadow-lg shadow-white/10"
                  initial={false}
                  animate={{ 
                      left: activeTab === 'events' ? '4px' : '50%', 
                      width: activeTab === 'events' ? 'calc(50% - 4px)' : 'calc(50% - 4px)',
                      x: activeTab === 'wallet' ? 0 : 0
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
               />
          </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      {activeTab === 'events' ? (
          <div className="animate-in fade-in zoom-in duration-300">
              {events.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {events.map(event => (
                    <EventCard key={event.id} event={event} onBuy={onBuy} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 md:py-32 border border-white/5 rounded-[2rem] md:rounded-[3rem] bg-zinc-900/20 backdrop-blur-sm px-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4 md:mb-6">
                        <Ticket className="w-8 h-8 md:w-10 md:h-10 text-zinc-600" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase text-center">No hay eventos activos</h3>
                    <p className="text-zinc-500 mt-2 max-w-xs text-center font-medium text-sm md:text-base">La cartelera está vacía en este momento. Vuelve pronto para nuevas experiencias.</p>
                    
                    {currentUser?.role === UserRole.ADMIN && (
                        <div className="mt-8 md:mt-10">
                            <Button onClick={() => onNavigate && onNavigate('admin-events')} className="bg-neon-purple text-white font-black px-6 md:px-8 h-12 md:h-14 rounded-xl md:rounded-2xl shadow-xl shadow-neon-purple/20 text-xs md:text-sm">
                                <PlusCircle className="mr-2 w-4 h-4 md:w-5 md:h-5"/> CREAR MI PRIMER EVENTO
                            </Button>
                        </div>
                    )}
                </div>
              )}
          </div>
      ) : (
          <div className="animate-in fade-in slide-in-from-right duration-300">
              <TicketWallet />
          </div>
      )}
      
      {/* Footer Branding */}
      <div className="mt-16 md:mt-24 text-center border-t border-white/5 pt-8 md:pt-12">
        <p className="text-[9px] md:text-[10px] text-gray-700 tracking-[0.4em] uppercase font-black">
          Powered by Midnight ExFi Protocol
        </p>
      </div>
    </div>
  );
};