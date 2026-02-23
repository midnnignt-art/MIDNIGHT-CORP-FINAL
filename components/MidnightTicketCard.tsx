import React, { useRef } from 'react';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Event, Order } from '../types';

interface MidnightTicketCardProps {
    order: Order;
    event?: Event;
}

export const MidnightTicketCard: React.FC<MidnightTicketCardProps> = ({ order, event }) => {
    const ticketRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        if (!ticketRef.current) return;
        
        try {
            const canvas = await html2canvas(ticketRef.current, {
                backgroundColor: '#0B0316',
                scale: 2, // Higher quality
                logging: false,
                useCORS: true // Important for external images like QR
            });
            
            const image = canvas.toDataURL("image/png");
            const link = document.createElement('a');
            link.href = image;
            link.download = `MIDNIGHT_TICKET_${order.order_number}.png`;
            link.click();
            
            // Show notification (assuming alert for now, or I can use a toast if available)
            alert("Tu boleta ha sido guardada 🌙");
        } catch (error) {
            console.error("Error generating ticket image:", error);
            alert("Error al descargar la boleta.");
        }
    };

    const qrUrl = `https://quickchart.io/qr?text=${order.order_number}&size=300&ecLevel=H`;

    return (
        <div className="flex flex-col items-center gap-6">
            {/* TICKET CARD */}
            <div 
                ref={ticketRef}
                className="w-full max-w-[340px] aspect-[3/5] rounded-[2rem] overflow-hidden border border-[#490F7C]/60 flex flex-col relative shadow-2xl"
                style={{
                    background: 'linear-gradient(180deg, #0B0316 0%, #161344 100%)'
                }}
            >
                {/* Header */}
                <div className="pt-8 pb-4 text-center">
                    <span className="text-2xl font-black tracking-[0.2em] text-white">MIDNIGHT</span>
                </div>

                {/* QR Section */}
                <div className="flex-1 flex flex-col items-center justify-center px-8">
                    <div className="bg-white p-4 rounded-2xl shadow-[0_0_30px_rgba(73,15,124,0.3)] relative">
                        <img 
                            src={qrUrl} 
                            alt="QR Code" 
                            className={`w-48 h-48 object-contain ${order.used ? 'blur-sm opacity-30 grayscale' : ''}`}
                            crossOrigin="anonymous"
                        />
                        {order.used && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-black font-black text-xs uppercase tracking-tighter border-2 border-black px-2 py-1 rotate-[-12deg]">UTILIZADO</span>
                            </div>
                        )}
                    </div>
                    <p className="mt-4 font-mono text-[10px] text-[#F2F2F2]/50 tracking-[0.2em] uppercase">
                        ID: {order.order_number}
                    </p>
                </div>

                {/* Event Info */}
                <div className="px-8 pb-8 text-center space-y-1">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight leading-tight">
                        {event?.title || 'Evento Midnight'}
                    </h3>
                    <p className="text-xs font-light text-white/70 uppercase tracking-[0.1em]">
                        {event ? new Date(event.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Próximamente'}
                    </p>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest pt-1">
                        {event?.venue} • {event?.city}
                    </p>
                </div>

                {/* Footer Bar */}
                <div className="bg-[#490F7C] py-3 text-center">
                    <span className="text-[9px] font-black text-white tracking-[0.2em] uppercase">
                        PRESENTA ESTE QR EN LA ENTRADA
                    </span>
                </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="w-full max-w-[340px] flex gap-3">
                <button 
                    onClick={handleDownload}
                    className="flex-1 bg-white text-black font-black h-12 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 transition-all active:scale-95"
                >
                    <Download size={18} />
                    <span className="text-xs uppercase tracking-widest">Descargar Imagen</span>
                </button>
            </div>
        </div>
    );
};
