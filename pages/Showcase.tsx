
import React, { useEffect, useState } from 'react';
import { EventCard } from '../components/EventCard';
import { useStore } from '../context/StoreContext';
import { Event, UserRole } from '../types';
import { Ticket, Sparkles, UserCheck, PlusCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

interface ShowcaseProps {
  onBuy: (event: Event) => void;
  onNavigate?: (page: string) => void;
}

export const Showcase: React.FC<ShowcaseProps> = ({ onBuy, onNavigate }) => {
  const { events, promoters, currentUser } = useStore();
  const [referralInfo, setReferralInfo] = useState<{name: string, code: string} | null>(null);

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
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Banner de Referido */}
      {referralInfo && (
          <div className="mb-12 rounded-3xl bg-gradient-to-r from-zinc-900 to-midnight-950 border border-white/10 p-1">
              <div className="rounded-[1.3rem] bg-black/40 backdrop-blur-sm p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-purple to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-neon-purple/20">
                          <UserCheck className="w-6 h-6" />
                      </div>
                      <div>
                          <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold">Acceso VIP Invitado por</p>
                          <h3 className="text-xl md:text-2xl font-black text-white">{referralInfo.name}</h3>
                      </div>
                  </div>
                  <div className="px-4 py-2 bg-white/5 rounded-full border border-white/5">
                      <span className="text-xs text-zinc-500 font-mono">CODE: {referralInfo.code}</span>
                  </div>
              </div>
          </div>
      )}

      {/* Hero Section */}
      <div className="text-center mb-16 space-y-4">
        <h1 className="text-4xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">
          DUEÑOS DE LA NOCHE.
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg italic">
          Experiencias curadas para la vanguardia moderna.
        </p>
      </div>

      {/* Grid */}
      {events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map(event => (
            <EventCard key={event.id} event={event} onBuy={onBuy} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 border border-white/5 rounded-[3rem] bg-zinc-900/20 backdrop-blur-sm">
            <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6">
                <Ticket className="w-10 h-10 text-zinc-600" />
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight uppercase">No hay eventos activos</h3>
            <p className="text-zinc-500 mt-2 max-w-xs text-center font-medium">La cartelera está vacía en este momento. Vuelve pronto para nuevas experiencias.</p>
            
            {currentUser?.role === UserRole.ADMIN && (
                <div className="mt-10">
                    <Button onClick={() => onNavigate && onNavigate('admin-events')} className="bg-neon-purple text-white font-black px-8 h-14 rounded-2xl shadow-xl shadow-neon-purple/20">
                        <PlusCircle className="mr-2 w-5 h-5"/> CREAR MI PRIMER EVENTO
                    </Button>
                </div>
            )}
        </div>
      )}
      
      {/* Footer Branding */}
      <div className="mt-24 text-center border-t border-white/5 pt-12">
        <p className="text-[10px] text-gray-700 tracking-[0.4em] uppercase font-black">
          Powered by Midnight ExFi Protocol
        </p>
      </div>
    </div>
  );
};
