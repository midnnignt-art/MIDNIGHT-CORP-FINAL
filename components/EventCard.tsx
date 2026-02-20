import React from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { Event } from '../types';
import { Button } from './ui/button';
import { useStore } from '../context/StoreContext';

interface EventCardProps {
  event: Event;
  onBuy: (event: Event) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onBuy }) => {
  const { getEventTiers } = useStore();
  const tiers = getEventTiers(event.id);
  
  // Find lowest price
  const minPrice = tiers.length > 0 ? Math.min(...tiers.map(t => t.price)) : 0;

  return (
    <div className="group relative overflow-hidden rounded-none bg-void border border-moonlight/10 transition-all duration-500 hover:border-eclipse hover:shadow-[0_0_50px_rgba(73,15,124,0.1)]">
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden">
        <img 
          src={event.cover_image} 
          alt={event.title} 
          className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-60 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/20 to-transparent" />
        
        {/* Floating Tag */}
        <div className="absolute top-4 right-4 bg-eclipse px-3 py-1 border border-moonlight/10">
          <span className="text-[10px] font-black tracking-widest uppercase text-moonlight">
            {event.status === 'sold_out' ? 'Agotado' : event.current_stage.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col gap-6">
        <div>
          <h3 className="text-2xl font-black text-moonlight mb-2 uppercase tracking-tight truncate">{event.title}</h3>
          <p className="text-moonlight/40 text-[10px] font-light tracking-wide line-clamp-2 mb-4 uppercase leading-relaxed">{event.description}</p>
          
          <div className="flex flex-col gap-2 text-[10px] text-moonlight/60 uppercase tracking-widest font-light">
            <div className="flex items-center gap-3">
              <Calendar className="w-3 h-3 text-eclipse" />
              <span>{new Date(event.event_date).toLocaleDateString()} • {event.doors_open}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-3 h-3 text-eclipse" />
              <span>{event.venue}, {event.city}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-moonlight/10">
          <div className="flex flex-col">
            <span className="text-[9px] text-moonlight/30 uppercase tracking-widest font-light">Desde</span>
            <span className="text-xl font-black text-moonlight tabular-nums">${minPrice.toLocaleString()}</span>
          </div>
          <button 
            onClick={() => onBuy(event)}
            disabled={event.status === 'sold_out'}
            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
              event.status === 'sold_out' 
                ? 'bg-white/5 text-moonlight/20 cursor-not-allowed' 
                : 'bg-moonlight text-void hover:bg-eclipse hover:text-moonlight'
            }`}
          >
            {event.status === 'sold_out' ? 'Sold Out' : 'Tickets'}
          </button>
        </div>
      </div>
    </div>
  );
};