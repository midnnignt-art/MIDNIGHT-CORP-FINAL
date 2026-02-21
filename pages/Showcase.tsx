import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Event } from '../types';
import { motion as _motion } from 'framer-motion';
import { CountdownTimer } from '../components/CountdownTimer';
import { MouseTrail } from '../components/MouseTrail';
import { ArrowRight, Barcode, ChevronDown } from 'lucide-react';
import { EventCard } from '../components/EventCard';
import { EclipseLoader } from '../components/EclipseLoader';

const motion = _motion as any;

interface ShowcaseProps {
  onBuy: (event: Event) => void;
  onNavigate?: (page: string) => void;
}

export const Showcase: React.FC<ShowcaseProps> = ({ onBuy, onNavigate }) => {
  const { events, dbStatus } = useStore();
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);

  useEffect(() => {
    const now = new Date().getTime();
    const filtered = events
      .filter(e => (e.status === 'published' || e.status === 'sold_out') && new Date(e.event_date).getTime() > now)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    setActiveEvents(filtered);
  }, [events]);

  // Simulated progress for the cinematic loader
  useEffect(() => {
    if (dbStatus === 'syncing' || !isFullyLoaded) {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 100) {
            if (dbStatus === 'synced') {
              clearInterval(interval);
              setTimeout(() => setIsFullyLoaded(true), 1000);
              return 100;
            }
            return 100;
          }
          // Slow down as it approaches 100
          const increment = prev < 90 ? Math.random() * 5 : Math.random() * 0.5;
          return Math.min(prev + increment, 100);
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [dbStatus, isFullyLoaded]);

  if (!isFullyLoaded && (dbStatus === 'syncing' || loadingProgress < 100)) {
    return <EclipseLoader progress={loadingProgress} />;
  }

  if (activeEvents.length === 0) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-8">
           <Barcode className="w-10 h-10 text-moonlight/20" strokeWidth={1} />
        </div>
        <h2 className="text-2xl md:text-4xl font-black text-moonlight uppercase tracking-tighter mb-4">Próximamente</h2>
        <p className="text-moonlight/40 text-xs md:text-sm font-light tracking-[0.3em] uppercase max-w-md leading-relaxed">
          Estamos preparando las próximas experiencias. Suscríbete para ser el primero en enterarte.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-void font-sans">
      <MouseTrail />
      <div className="noise-overlay" />

      {activeEvents.map((event, index) => {
        const isSoldOut = event.status === 'sold_out';
        const eventDate = new Date(event.event_date);
        const formattedDate = `${eventDate.getDate().toString().padStart(2, '0')} - ${(eventDate.getMonth() + 1).toString().padStart(2, '0')} - ${eventDate.getFullYear()}`;
        const isSoonest = index === 0;

        return (
          <div key={event.id} className="relative h-screen w-full flex flex-col md:flex-row border-b border-moonlight/5 last:border-b-0">
            {/* PANEL IZQUIERDO (40% - EL VISUAL) */}
            <div className="relative w-full md:w-[40%] h-[50vh] md:h-screen overflow-hidden border-b md:border-b-0 md:border-r border-moonlight/10">
              <motion.div 
                initial={{ scale: 1.1, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute inset-0"
              >
                <img 
                  src={event.cover_image || "https://images.unsplash.com/photo-1514525253361-bee8a19740c1?w=1200&fit=crop"} 
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-midnight/40 via-transparent to-void" />
              </motion.div>

              {/* BRANDING ELEMENTS */}
              <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20">
                <div className="border border-moonlight/30 rounded-full px-6 py-1.5 backdrop-blur-sm">
                  <span className="text-[10px] font-light tracking-[0.5em] text-moonlight uppercase">Presents</span>
                </div>
              </div>

              {isSoonest && (
                <div className="absolute top-36 left-1/2 -translate-x-1/2 z-20">
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-eclipse/80 backdrop-blur-md border border-moonlight/20 px-4 py-1"
                  >
                    <span className="text-[9px] font-black tracking-[0.3em] text-moonlight uppercase animate-pulse">Próximo Evento</span>
                  </motion.div>
                </div>
              )}

              <div className="absolute bottom-8 left-8 hidden md:block z-20">
                <div className="space-y-1 opacity-40">
                  <p className="text-[8px] font-light tracking-widest text-moonlight uppercase">Midnight Worldwide</p>
                  <p className="text-[8px] font-light tracking-widest text-moonlight uppercase">Experience Finance Protocol</p>
                </div>
              </div>

              <div className="absolute bottom-8 right-8 flex items-center gap-4 z-20">
                <div className="text-right hidden md:block">
                  <p className="text-[10px] font-black tracking-tighter text-moonlight">TIME SHIFT</p>
                  <p className="text-[10px] font-light tracking-widest text-moonlight/60">12:00 MID</p>
                </div>
                <Barcode className="w-12 h-12 text-moonlight/40" strokeWidth={1} />
              </div>

              {/* POETIC MICRO-DEFINITIONS */}
              <div className="absolute top-24 left-8 text-[7px] font-light tracking-widest text-moonlight/30 uppercase leading-relaxed max-w-[120px] hidden md:block z-20">
                The transition from one day to the next. A moment of absolute potential.
              </div>
              <div className="absolute top-24 right-8 text-[7px] font-light tracking-widest text-moonlight/30 uppercase leading-relaxed max-w-[120px] text-right hidden md:block z-20">
                Architecture of the night. Curated for the modern vanguard.
              </div>
            </div>

            {/* PANEL DERECHO (60% - EL MOTOR) */}
            <div className="relative w-full md:w-[60%] h-[50vh] md:h-screen flex flex-col items-center justify-center px-6 md:px-12 bg-void">
              
              {/* MICROCOPYS ANCLAS */}
              <div className="absolute top-24 left-12 hidden md:block z-20">
                <span className="text-[10px] font-light tracking-[0.4em] text-moonlight/40 uppercase">
                  {isSoonest ? 'Featured Event' : `Event 0${index + 1}`}
                </span>
              </div>
              <div className="absolute top-24 right-12 hidden md:block z-20">
                <span className="text-[10px] font-light tracking-[0.4em] text-moonlight/40 uppercase">Year 2026</span>
              </div>

              {/* EVENT INFO */}
              <motion.div 
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-center space-y-6 md:space-y-10 w-full max-w-2xl"
              >
                <div className="space-y-2">
                  <h1 className="text-4xl md:text-7xl lg:text-8xl font-black tracking-tighter text-moonlight uppercase leading-none break-words">
                    {event.city}
                  </h1>
                  <h2 className="text-xl md:text-3xl font-light tracking-[0.3em] text-moonlight/60 uppercase">
                    {formattedDate}
                  </h2>
                </div>

                {/* TIMER */}
                <div className="py-4 md:py-8 border-y border-moonlight/5">
                  <CountdownTimer targetDate={event.event_date} />
                </div>

                {/* CTA */}
                <div className="pt-4">
                  <button
                    onClick={() => !isSoldOut && onBuy(event)}
                    disabled={isSoldOut}
                    className={`group relative overflow-hidden px-12 md:px-20 py-5 md:py-6 rounded-none transition-all duration-500 ${
                      isSoldOut 
                        ? 'bg-white/5 cursor-not-allowed border border-white/10' 
                        : 'bg-eclipse hover:bg-eclipse/80 shadow-[0_0_40px_rgba(73,15,124,0.3)] hover:shadow-[0_0_60px_rgba(73,15,124,0.5)]'
                    }`}
                  >
                    <span className={`relative z-10 text-xs md:text-sm font-black tracking-[0.5em] uppercase flex items-center gap-3 ${isSoldOut ? 'text-moonlight/30' : 'text-moonlight'}`}>
                      {isSoldOut ? 'Sold Out' : 'Comprar Tickets'}
                      {!isSoldOut && <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />}
                    </span>
                    
                    {!isSoldOut && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    )}
                  </button>
                </div>
              </motion.div>

              {/* SCROLL INDICATOR (Only for first event) */}
              {isSoonest && activeEvents.length > 1 && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-30">
                  <span className="text-[8px] font-light tracking-[0.4em] text-moonlight uppercase">Scroll</span>
                  <ChevronDown className="text-moonlight w-4 h-4" />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* FOOTER */}
      <div className="relative z-20 bg-void py-20 border-t border-moonlight/5 text-center">
        <p className="text-[9px] text-moonlight/20 tracking-[0.5em] uppercase font-light">
          Midnight Worldwide • Experience Finance Protocol • 2026
        </p>
      </div>
    </div>
  );
};

