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
    <div className="group relative overflow-hidden rounded-2xl bg-midnight-900 border border-white/5 transition-all hover:border-white/20 hover:shadow-2xl hover:shadow-neon-purple/10">
      {/* Image Container */}
      <div className="relative aspect-[4/5] sm:aspect-square overflow-hidden">
        <img 
          src={event.cover_image} 
          alt={event.title} 
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight-950 via-midnight-950/20 to-transparent" />
        
        {/* Floating Tag */}
        <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
          <span className="text-xs font-bold tracking-widest uppercase text-white">
            {event.status === 'sold_out' ? 'Agotado' : event.current_stage.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-4">
        <div>
          <h3 className="text-2xl font-bold text-white mb-1 tracking-tight">{event.title}</h3>
          <p className="text-gray-400 text-sm line-clamp-2 mb-4">{event.description}</p>
          
          <div className="flex flex-col gap-2 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neon-purple" />
              <span>{new Date(event.event_date).toLocaleDateString()} • {event.doors_open}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-neon-blue" />
              <span>{event.venue}, {event.city}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase">Desde</span>
            <span className="text-xl font-bold text-white">${minPrice}</span>
          </div>
          <Button 
            onClick={() => onBuy(event)}
            disabled={event.status === 'sold_out'}
            className="group-hover:bg-white group-hover:text-black transition-colors"
          >
            {event.status === 'sold_out' ? 'Lista de Espera' : 'Comprar'}
          </Button>
        </div>
      </div>
    </div>
  );
};