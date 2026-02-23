import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, CheckCircle2, AlertCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { motion, AnimatePresence } from 'framer-motion';

interface QRScannerProps {
  eventId?: string;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ eventId, onClose }) => {
  const { validarYQuemarTicket, events } = useStore();
  const [scanResult, setScanResult] = useState<{
    status: 'success' | 'used' | 'invalid' | 'idle';
    message: string;
  }>({ status: 'idle', message: '' });
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isProcessing = useRef(false);

  // Get current event info
  const targetEvent = events.find(e => e.id === eventId) || events[0];

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
    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      /* verbose= */ false
    );

    scanner.render(
      async (decodedText) => {
        if (isProcessing.current || scanResult.status !== 'idle') return;
        
        isProcessing.current = true;
        
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }

        const result = await validarYQuemarTicket(decodedText, targetEvent?.id || '');
        setScanResult({
            status: result.status,
            message: result.message
        });
      },
      (errorMessage) => {
        // Error callback (usually just "no QR code found in frame")
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, [targetEvent?.id]);

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
            <p className="text-[10px] text-moonlight/40 uppercase tracking-widest font-light">
                Validando para: <span className="text-neon-purple">{targetEvent?.title}</span>
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 transition-colors rounded-full"
        >
          <X className="w-6 h-6 text-moonlight" />
        </button>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-md aspect-square bg-white/5 border border-white/10 rounded-2xl overflow-hidden relative">
          <div id="qr-reader" className="w-full h-full"></div>
          
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

