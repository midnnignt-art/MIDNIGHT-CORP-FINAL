import React from 'react';
import { motion as _motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Users, Sparkles } from 'lucide-react';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Event } from '../types';

const motion = _motion as any;

interface EventHeroProps {
    event: Event | null;
    className?: string;
}

export default function EventHero({ event, className }: EventHeroProps) {
  const eventDate = event?.event_date ? new Date(event.event_date) : new Date();
  const soldPercentage = event?.total_capacity 
    ? Math.round((event.tickets_sold / event.total_capacity) * 100) 
    : 0;

  return (
    <div className={cn("relative min-h-[50vh] flex items-end rounded-3xl overflow-hidden mb-8", className)}>
      {/* Background image */}
      <div className="absolute inset-0">
        {event?.cover_image ? (
          <img 
            src={event.cover_image} 
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900 via-zinc-900 to-black" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-midnight-950 via-midnight-950/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full px-6 pb-8 pt-32">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          {/* Status badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {event?.status === 'sold_out' && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                SOLD OUT
              </Badge>
            )}
            {event?.current_stage === 'early_bird' && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-black border-0">
                <Sparkles className="w-3 h-3 mr-1" />
                EARLY BIRD
              </Badge>
            )}
            {event?.nft_benefits?.length > 0 && (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                NFT TICKET
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none mb-4">
            {event?.title || 'Event Name'}
          </h1>

          {/* Artists */}
          {event?.artists?.length > 0 && (
            <p className="text-lg text-zinc-300 mb-6">
              {event.artists.join(' • ')}
            </p>
          )}

          {/* Event details */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2 text-zinc-400">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">
                {format(eventDate, "EEEE d MMMM, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{event?.doors_open || '8:00 PM'}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{event?.venue || 'Venue'}</span>
            </div>
          </div>

          {/* Capacity progress */}
          {event?.total_capacity && (
            <div className="space-y-2 max-w-md">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400 flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {event.tickets_sold?.toLocaleString() || 0} / {event.total_capacity?.toLocaleString()}
                </span>
                <span className="text-white font-semibold">{soldPercentage}% Sold</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${soldPercentage}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  className={cn(
                    "h-full rounded-full",
                    soldPercentage >= 90 ? "bg-red-500" : 
                    soldPercentage >= 70 ? "bg-amber-500" : 
                    "bg-gradient-to-r from-emerald-500 to-cyan-500"
                  )}
                />
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}