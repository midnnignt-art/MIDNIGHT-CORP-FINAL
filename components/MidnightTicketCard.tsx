import React, { useRef } from 'react';
import { Download } from 'lucide-react';
import { Event, Order } from '../types';
import { toast } from '../lib/toast';

interface MidnightTicketCardProps {
    order: Order;
    event?: Event;
}

// roundRect polyfill — avoids ctx.roundRect() which isn't on older iOS
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

export const MidnightTicketCard: React.FC<MidnightTicketCardProps> = ({ order, event }) => {
    const [isDownloading, setIsDownloading] = React.useState(false);

    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(order.order_number)}&size=400&ecLevel=H&margin=1`;

    const handleDownload = async () => {
        if (isDownloading) return;
        setIsDownloading(true);

        try {
            // ── 1. Load QR image ─────────────────────────────────────────────
            const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload  = () => resolve(img);
                img.onerror = reject;
                img.src = qrUrl;
            });

            // ── 2. Canvas setup ──────────────────────────────────────────────
            const W = 600, H = 1000;
            const canvas = document.createElement('canvas');
            canvas.width  = W * 2; // @2x retina
            canvas.height = H * 2;
            canvas.style.width  = `${W}px`;
            canvas.style.height = `${H}px`;
            const ctx = canvas.getContext('2d')!;
            ctx.scale(2, 2); // draw at logical px, output at 2x

            // ── 3. Background ────────────────────────────────────────────────
            const bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#0B0316');
            bg.addColorStop(1, '#161344');
            rrect(ctx, 0, 0, W, H, 32);
            ctx.fillStyle = bg;
            ctx.fill();

            // Border
            rrect(ctx, 0.5, 0.5, W - 1, H - 1, 32);
            ctx.strokeStyle = 'rgba(73,15,124,0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // ── 4. Header — MIDNIGHT ────────────────────────────────────────
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 28px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.letterSpacing = '6px';
            ctx.fillText('MIDNIGHT', W / 2, 72);
            ctx.letterSpacing = '0px';
            ctx.font = '300 9px Arial, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText('W O R L D W I D E', W / 2, 90);

            // ── 5. QR container ──────────────────────────────────────────────
            const qrBox = 230;
            const qrPad = 16;
            const qrX   = (W - qrBox - qrPad * 2) / 2;
            const qrY   = 120;

            ctx.fillStyle = '#FFFFFF';
            rrect(ctx, qrX, qrY, qrBox + qrPad * 2, qrBox + qrPad * 2, 16);
            ctx.fill();

            // Purple glow shadow
            ctx.save();
            ctx.shadowColor = 'rgba(73,15,124,0.35)';
            ctx.shadowBlur  = 30;
            rrect(ctx, qrX, qrY, qrBox + qrPad * 2, qrBox + qrPad * 2, 16);
            ctx.fillStyle = 'transparent';
            ctx.fill();
            ctx.restore();

            // QR image
            if (order.used) {
                ctx.globalAlpha = 0.25;
                ctx.filter = 'grayscale(1)';
            }
            ctx.drawImage(qrImg, qrX + qrPad, qrY + qrPad, qrBox, qrBox);
            ctx.globalAlpha = 1;
            ctx.filter = 'none';

            // Used stamp
            if (order.used) {
                ctx.save();
                ctx.translate(W / 2, qrY + (qrBox + qrPad * 2) / 2);
                ctx.rotate(-12 * Math.PI / 180);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.strokeRect(-52, -14, 104, 28);
                ctx.fillStyle = '#000';
                ctx.font = 'bold 13px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('UTILIZADO', 0, 5);
                ctx.restore();
            }

            // ── 6. Order number ──────────────────────────────────────────────
            ctx.fillStyle = 'rgba(242,242,242,0.35)';
            ctx.font = '12px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`ID: ${order.order_number}`, W / 2, qrY + qrBox + qrPad * 2 + 28);

            // ── 7. Event info ────────────────────────────────────────────────
            const infoTop = qrY + qrBox + qrPad * 2 + 64;

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 22px Arial, sans-serif';
            ctx.textAlign = 'center';
            const title = (event?.title || 'Evento Midnight').toUpperCase();
            ctx.fillText(title, W / 2, infoTop, W - 60);

            const dateStr = event
                ? new Date(event.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'Próximamente';
            ctx.fillStyle = 'rgba(242,242,242,0.65)';
            ctx.font = '13px Arial, sans-serif';
            ctx.letterSpacing = '1px';
            ctx.fillText(dateStr.toUpperCase(), W / 2, infoTop + 34);
            ctx.letterSpacing = '0px';

            if (event?.venue || event?.city) {
                ctx.fillStyle = 'rgba(242,242,242,0.35)';
                ctx.font = 'bold 10px Arial, sans-serif';
                ctx.letterSpacing = '2px';
                const venueStr = [event.venue, event.city].filter(Boolean).join('  ·  ').toUpperCase();
                ctx.fillText(venueStr, W / 2, infoTop + 58);
                ctx.letterSpacing = '0px';
            }

            // ── 8. Footer bar ────────────────────────────────────────────────
            const footerH = 56;
            rrect(ctx, 0, H - footerH, W, footerH, 32);
            ctx.fillStyle = '#490F7C';
            ctx.fill();
            // square off top corners of footer
            ctx.fillRect(0, H - footerH, W, 32);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 10px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.letterSpacing = '3px';
            ctx.fillText('PRESENTA ESTE QR EN LA ENTRADA', W / 2, H - footerH / 2 + 4);
            ctx.letterSpacing = '0px';

            // ── 9. Download ──────────────────────────────────────────────────
            const dataUrl = canvas.toDataURL('image/png');
            const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

            if (isIOS) {
                // iOS Safari can't trigger file downloads — open image in new tab, user saves with long-press
                const win = window.open('', '_blank');
                if (win) {
                    win.document.write(
                        `<!DOCTYPE html><html><head><title>MIDNIGHT Ticket</title>` +
                        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
                        `<style>body{margin:0;background:#0B0316;display:flex;justify-content:center;align-items:flex-start;padding:16px;}` +
                        `img{max-width:100%;border-radius:16px;}</style></head>` +
                        `<body><img src="${dataUrl}" /></body></html>`
                    );
                    win.document.close();
                } else {
                    toast.error('Activa las ventanas emergentes para descargar');
                }
            } else {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `MIDNIGHT_TICKET_${order.order_number}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            toast.success(isIOS ? 'Mantén presionada la imagen para guardarla' : 'Tu boleta ha sido guardada');
        } catch (error) {
            console.error('Error generating ticket:', error);
            toast.error('Error al generar la boleta. Intenta de nuevo.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-6">
            {/* TICKET CARD — visual display only */}
            <div
                className="w-full aspect-[3/5] max-h-[70vh] rounded-[2rem] overflow-hidden border border-[#490F7C]/60 flex flex-col relative shadow-2xl"
                style={{ background: 'linear-gradient(180deg, #0B0316 0%, #161344 100%)' }}
            >
                {/* Header */}
                <div className="pt-6 pb-2 text-center">
                    <span className="text-xl md:text-2xl font-black tracking-[0.2em] text-white">MIDNIGHT</span>
                </div>

                {/* QR Section */}
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <div className="bg-white p-3 rounded-2xl shadow-[0_0_30px_rgba(73,15,124,0.3)] relative">
                        <img
                            src={qrUrl}
                            alt="QR Code"
                            className={`w-36 h-36 md:w-48 md:h-48 object-contain ${order.used ? 'blur-sm opacity-30 grayscale' : ''}`}
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
                <div className="px-6 pb-6 text-center space-y-1">
                    <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight leading-tight">
                        {event?.title || 'Evento Midnight'}
                    </h3>
                    <p className="text-[10px] md:text-xs font-light text-white/70 uppercase tracking-[0.1em]">
                        {event ? new Date(event.event_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Próximamente'}
                    </p>
                    <p className="text-[9px] md:text-[10px] font-bold text-white/40 uppercase tracking-widest pt-1">
                        {event?.venue} • {event?.city}
                    </p>
                </div>

                {/* Footer Bar */}
                <div className="bg-[#490F7C] py-3 text-center rounded-b-[2rem]">
                    <span className="text-[9px] font-black text-white tracking-[0.2em] uppercase">
                        PRESENTA ESTE QR EN LA ENTRADA
                    </span>
                </div>
            </div>

            {/* ACTION BUTTON */}
            <div className="w-full flex gap-3">
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex-1 bg-white text-black font-black h-12 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isDownloading ? (
                        <span className="animate-pulse text-[10px] uppercase tracking-widest">Generando...</span>
                    ) : (
                        <>
                            <Download size={18} />
                            <span className="text-xs uppercase tracking-widest">Descargar Imagen</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
