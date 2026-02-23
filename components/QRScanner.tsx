import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, CheckCircle2, AlertCircle, XCircle, AlertTriangle, Loader2, QrCode } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { motion, AnimatePresence } from 'framer-motion';

interface QRScannerProps {
  eventId?: string;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ eventId, onClose }) => {
  const { validarYQuemarTicket, events } = useStore();
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(eventId);
  const [scanResult, setScanResult] = useState<{
    status: 'success' | 'used' | 'invalid' | 'idle';
    message: string;
  }>({ status: 'idle', message: '' });
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessing = useRef(false);

  // Get current event info
  const targetEvent = events.find(e => e.id === (selectedEventId || eventId));

  useEffect(() => {
    if (scanResult.status !== 'idle') {
        const timer = setTimeout(() => {
            setScanResult({ status: 'idle', message: '' });
            isProcessing.current = false;
        }, 3000);
        return () => clearTimeout(timer);
    }
  }, [scanResult.status]);

  useEffect(() => {
    if (!selectedEventId && events.length > 0 && !eventId) {
        // If no event selected and multiple available, don't start yet or default to first
        // But better to default to first if only one
        if (events.length === 1) setSelectedEventId(events[0].id);
    }
  }, [events, eventId, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) return;

    const startScanner = async () => {
      try {
        // Cleanup previous if exists
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
        }

        const html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCodeRef.current = html5QrCode;

        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          async (decodedText) => {
            if (isProcessing.current || scanResult.status !== 'idle') return;
            
            isProcessing.current = true;
            
            if (navigator.vibrate) {
                navigator.vibrate(100);
            }

            const result = await validarYQuemarTicket(decodedText, selectedEventId);
            setScanResult({
                status: result.status,
                message: result.message
            });
          },
          (errorMessage) => {}
        );
        
        setIsCameraReady(true);
      } catch (err: any) {
        console.error("Error starting scanner:", err);
        setCameraError(err.message || "No se pudo acceder a la cámara");
      }
    };

    startScanner();

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop()
          .then(() => html5QrCodeRef.current?.clear())
          .catch(err => console.error("Failed to stop scanner", err));
      }
    };
  }, [selectedEventId]);

  return (
    <div className="fixed inset-0 z-[200] bg-void flex flex-col">
      {/* Header */}
      <div className="p-6 flex justify-between items-center border-b border-white/10 bg-void">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-eclipse/20 rounded-full">
            <Camera className="w-5 h-5 text-moonlight" />
          </div>
          <div>
            <h2 className="text-lg font-black text-moonlight uppercase tracking-tighter">Escáner de Acceso</h2>
            {!selectedEventId ? (
                <p className="text-[10px] text-amber-500 uppercase tracking-widest font-bold animate-pulse">Seleccione un evento para comenzar</p>
            ) : (
                <p className="text-[10px] text-moonlight/40 uppercase tracking-widest font-light">
                    Validando para: <span className="text-neon-purple">{targetEvent?.title}</span>
                </p>
            )}
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 transition-colors rounded-full"
        >
          <X className="w-6 h-6 text-moonlight" />
        </button>
      </div>

      {/* Event Selector if not provided */}
      {!eventId && events.length > 1 && (
          <div className="p-4 bg-black/40 border-b border-white/5">
              <select 
                value={selectedEventId || ''} 
                onChange={(e) => {
                    setSelectedEventId(e.target.value);
                    setIsCameraReady(false);
                }}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 h-12 text-xs text-white font-bold uppercase tracking-widest outline-none focus:border-neon-purple"
              >
                  <option value="">-- SELECCIONAR EVENTO --</option>
                  {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
          </div>
      )}

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {!selectedEventId ? (
            <div className="text-center space-y-6 max-w-xs">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                    <QrCode className="w-10 h-10 text-zinc-600" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Configuración Requerida</h3>
                <p className="text-xs text-zinc-500 font-bold uppercase leading-relaxed">Debes seleccionar el evento que vas a controlar antes de iniciar el escaneo.</p>
            </div>
        ) : (
            <>
                <div className="w-full max-w-md aspect-square bg-white/5 border border-white/10 rounded-2xl overflow-hidden relative">
                  <div id="qr-reader" className="w-full h-full"></div>
                  
                  {!isCameraReady && !cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/80 z-10">
                      <Loader2 className="w-10 h-10 text-neon-purple animate-spin mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Iniciando Cámara...</p>
                    </div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/90 z-10 p-8 text-center">
                      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                      <p className="text-sm font-black uppercase tracking-widest text-white mb-2">Error de Cámara</p>
                      <p className="text-xs text-zinc-500">{cameraError}</p>
                      <button 
                        onClick={() => window.location.reload()}
                        className="mt-6 px-6 py-2 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-full"
                      >
                        Reintentar
                      </button>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 pointer-events-none border-[40px] border-void/60 flex items-center justify-center">
                     <div className="w-[250px] h-[250px] border-2 border-eclipse shadow-[0_0_0_9999px_rgba(5,5,5,0.4)]" />
                  </div>
                </div>

                {/* Status / Feedback */}
                <div className="mt-12 w-full max-w-md space-y-4">
                    <div className="text-center space-y-2 opacity-40">
                      <p className="text-xs font-light tracking-[0.2em] uppercase">Apunte la cámara al código QR</p>
                      <div className="flex justify-center gap-1">
                        <div className="w-1 h-1 bg-moonlight rounded-full animate-bounce" />
                        <div className="w-1 h-1 bg-moonlight rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1 h-1 bg-moonlight rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                </div>
            </>
        )}

        {/* FULL SCREEN RESULT OVERLAY */}
        <AnimatePresence>
            {scanResult.status !== 'idle' && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`absolute inset-0 z-[210] flex flex-col items-center justify-center p-8 text-center ${
                        scanResult.status === 'success' ? 'bg-emerald-900' : 
                        scanResult.status === 'used' ? 'bg-red-900' : 'bg-amber-900'
                    }`}
                >
                    <motion.div
                        initial={{ scale: 0.5, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {scanResult.status === 'success' && <CheckCircle2 size={120} className="mx-auto text-white" />}
                        {scanResult.status === 'used' && <XCircle size={120} className="mx-auto text-white" />}
                        {scanResult.status === 'invalid' && <AlertTriangle size={120} className="mx-auto text-white" />}
                        
                        <div>
                            <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">
                                {scanResult.message}
                            </h2>
                            <p className="text-white/60 text-sm font-bold uppercase tracking-widest">
                                {scanResult.status === 'success' ? 'Bienvenido a Midnight' : 'Verifique la entrada'}
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-8 border-t border-white/10 text-center bg-void">
        <p className="text-[9px] text-moonlight/20 tracking-[0.4em] uppercase font-light">
          Midnight Access Protocol • Secure Validation
        </p>
      </div>
    </div>
  );
};

export default QRScanner;

