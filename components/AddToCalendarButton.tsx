import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Check } from 'lucide-react';
import { downloadIcs, googleCalendarLink } from '../lib/icsGenerator';
import { isIOS, isAndroid } from './../lib/platform';

interface Props {
  title: string;
  start: Date | string;
  durationMinutes?: number;
  location?: string;
  description?: string;
  url?: string;
  filename?: string;
}

/**
 * Botón "Add to Calendar". Detección de plataforma:
 *  - iOS/Android → descarga .ics directamente (el OS lo abre nativo)
 *  - Desktop → dropdown con Google Calendar (web) + Apple/Outlook (.ics)
 */
export const AddToCalendarButton: React.FC<Props> = (props) => {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleDownloadIcs = () => {
    downloadIcs(props, props.filename ?? 'midnight-event.ics');
    setAdded(true);
    setOpen(false);
    setTimeout(() => setAdded(false), 2500);
  };

  const handleGoogle = () => {
    window.open(googleCalendarLink(props), '_blank', 'noopener');
    setAdded(true);
    setOpen(false);
    setTimeout(() => setAdded(false), 2500);
  };

  // Mobile: directo .ics (iOS/Android lo abren nativo)
  if (isIOS() || isAndroid()) {
    return (
      <button
        onClick={handleDownloadIcs}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-moonlight/15 bg-moonlight/5 hover:bg-moonlight/10 text-moonlight text-[11px] font-bold uppercase tracking-[0.25em] transition-all active:scale-[0.98]"
      >
        {added ? <Check size={14} className="text-emerald-400" /> : <Calendar size={14} />}
        {added ? 'Añadido' : 'Añadir al calendario'}
      </button>
    );
  }

  // Desktop: dropdown con opciones
  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-moonlight/15 bg-moonlight/5 hover:bg-moonlight/10 text-moonlight text-[11px] font-bold uppercase tracking-[0.25em] transition-all active:scale-[0.98]"
      >
        {added ? <Check size={14} className="text-emerald-400" /> : <Calendar size={14} />}
        {added ? 'Añadido' : 'Añadir al calendario'}
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 z-50 min-w-[200px] bg-void/95 backdrop-blur-xl border border-moonlight/15 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <button onClick={handleGoogle} className="w-full text-left px-4 py-3 text-xs text-moonlight/80 hover:text-moonlight hover:bg-moonlight/5 transition-colors border-b border-moonlight/5">
            Google Calendar
          </button>
          <button onClick={handleDownloadIcs} className="w-full text-left px-4 py-3 text-xs text-moonlight/80 hover:text-moonlight hover:bg-moonlight/5 transition-colors border-b border-moonlight/5">
            Apple Calendar (.ics)
          </button>
          <button onClick={handleDownloadIcs} className="w-full text-left px-4 py-3 text-xs text-moonlight/80 hover:text-moonlight hover:bg-moonlight/5 transition-colors">
            Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  );
};

export default AddToCalendarButton;
