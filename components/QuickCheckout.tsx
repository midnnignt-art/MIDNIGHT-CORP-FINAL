import React, { useState, useEffect } from 'react';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import { Loader2, Shield, ChevronLeft, CheckCircle2, Mail, Download, Smartphone, Lock, User, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { TicketTier, Order } from '../types';
import TicketSelector from './TicketSelector';
import { GoogleGenAI } from "@google/genai";
import { useStore } from '../context/StoreContext';

const motion = _motion as any;

interface QuickCheckoutProps {
  event: any;
  tiers: TicketTier[];
  onComplete: (data: any) => Promise<Order | null>;
}

export default function QuickCheckout({ event, tiers, onComplete }: QuickCheckoutProps) {
  const { requestCustomerOtp, verifyCustomerOtp, currentCustomer, customerLogout } = useStore();
  
  const [step, setStep] = useState(0);
  const [selectedTiers, setSelectedTiers] = useState<{ [key: string]: number }>({});
  
  // Auth State
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState(''); 
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // Order State
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [aiMessage, setAiMessage] = useState('');

  // Auto-fill if user is already logged in (customer)
  useEffect(() => {
    if (currentCustomer) {
        setEmail(currentCustomer.email || '');
        if (currentCustomer.user_metadata?.full_name) {
            setName(currentCustomer.user_metadata.full_name);
        }
        if (step === 1) setStep(2);
    }
  }, [currentCustomer, step]);

  const selectedItems = Object.entries(selectedTiers)
    .filter(([_, qty]) => (qty as number) > 0)
    .map(([tierId, qty]) => {
      const tier = tiers.find(t => t.id === tierId);
      return { 
        tier_id: tier?.id, 
        tier_name: tier?.name, 
        quantity: qty as number, 
        unit_price: tier?.price || 0,
        subtotal: (tier?.price || 0) * (qty as number) 
      };
    });

  const subtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);

  // Helper para traducir errores de Supabase
  const translateError = (msg: string = '') => {
      const m = msg.toLowerCase();
      if (m.includes('rate limit') || m.includes('too many requests')) return 'Límite de envíos. Usa el Modo Demo o espera.';
      if (m.includes('token has expired') || m.includes('invalid token')) return 'Código inválido o expirado.';
      // Este es el error específico de SMTP mal configurado
      if (m.includes('error sending')) return 'ERROR SMTP: Configura "SMTP Settings" en Supabase o usa demo@midnight.com';
      if (m.includes('security purposes')) return 'Bloqueo de seguridad. Espera unos minutos.';
      return msg || 'Error de conexión. Intenta de nuevo.';
  };

  const useDemoMode = () => {
      setEmail('demo@midnight.com');
      setName('Usuario Demo');
      setAuthError('');
  };

  // AUTH HANDLERS
  const handleRequestOtp = async () => {
    if (!email.includes('@')) return setAuthError('Email inválido');
    setIsAuthLoading(true);
    setAuthError('');
    
    // Pasamos el nombre para que quede guardado en auth.users meta_data
    const res = await requestCustomerOtp(email, { full_name: name });
    setIsAuthLoading(false);
    
    if (res.success) {
        setStep(1.5); 
    } else {
        setAuthError(translateError(res.message));
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return setAuthError('El código debe tener 6 dígitos');
    setIsAuthLoading(true);
    setAuthError('');
    const success = await verifyCustomerOtp(email, otp);
    setIsAuthLoading(false);

    if (success) {
        setStep(2); 
    } else {
        setAuthError('Código incorrecto. Verifica tu correo.');
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      // 1. Intentar crear la orden en base de datos
      const orderData = await onComplete({ 
        customerInfo: { name: name || 'Cliente Midnight', email }, 
        items: selectedItems 
      });

      if (!orderData) {
         // Si falla, detenemos aquí. El error específico ya debió ser alertado por StoreContext.
         setIsProcessing(false);
         return; 
      }
      
      setCompletedOrder(orderData);
      
      // 2. Intentar generar mensaje con IA (Opcional - No bloqueante)
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Eres Midnight Corp. Genera un mensaje corto (15 palabras) de bienvenida VIP para ${name} que acaba de comprar tickets para ${event.title}. Tono cyber-punk elegante.`,
        });
        setAiMessage(response.text || '¡Bienvenido a la experiencia Midnight!');
      } catch (aiError) {
        console.warn("AI Generation failed, skipping:", aiError);
        setAiMessage('¡Acceso concedido! Bienvenido al protocolo.');
      }

      setStep(3);
    } catch (error: any) {
      console.error(error);
      alert(`Error crítico: ${error.message || 'Fallo desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-zinc-900/95 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 overflow-hidden w-full max-w-md mx-auto shadow-2xl relative">
      
      {currentCustomer && step < 3 && (
          <div className="absolute top-6 right-6 z-20">
              <button onClick={customerLogout} className="text-[10px] font-bold text-zinc-500 hover:text-red-400 uppercase">Cerrar Sesión</button>
          </div>
      )}

      <div className="p-8">
        <AnimatePresence mode="wait">
          
          {/* STEP 0: SELECCIÓN DE TICKETS */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Entradas</h3>
              <TicketSelector tiers={tiers} selectedTiers={selectedTiers} onSelect={setSelectedTiers} />
              <div className="flex justify-between items-center py-4 border-t border-white/5">
                <span className="text-zinc-500 font-bold text-xs uppercase">Total a pagar</span>
                <span className="text-3xl font-black text-white">${subtotal.toLocaleString()}</span>
              </div>
              <Button onClick={() => setStep(currentCustomer ? 2 : 1)} disabled={selectedItems.length === 0} fullWidth className="h-16 bg-white text-black font-black text-lg rounded-2xl">CONTINUAR</Button>
            </motion.div>
          )}

          {/* STEP 1: AUTH (EMAIL) */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <button onClick={() => setStep(0)} className="text-zinc-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase"><ChevronLeft size={16}/> Volver</button>
              
              <div className="text-center">
                  <div className="w-16 h-16 bg-neon-blue/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neon-blue/20">
                      <Lock className="text-neon-blue" size={24}/>
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Identificación Segura</h3>
                  <p className="text-zinc-500 text-sm mt-2">Te enviaremos un código de acceso a tu correo. Sin contraseñas.</p>
              </div>
              
              <div className="space-y-4">
                <Input placeholder="TU NOMBRE" value={name} onChange={e => setName(e.target.value)} className="h-14 bg-black border-white/10 text-white font-bold text-center" />
                <Input placeholder="TU EMAIL" type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-14 bg-black border-white/10 text-white font-bold text-center" />
                
                {authError && (
                    <div className="flex flex-col gap-2 items-center justify-center bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                            <p className="text-red-400 text-xs font-bold text-left leading-tight">{authError}</p>
                        </div>
                        {authError.includes('SMTP') && (
                            <button onClick={useDemoMode} className="text-[10px] bg-red-500/20 text-white px-3 py-1 rounded-lg uppercase font-bold hover:bg-red-500/40 mt-1">
                                Usar Modo Demo
                            </button>
                        )}
                    </div>
                )}
              </div>
              
              <Button onClick={handleRequestOtp} disabled={!email || !name || isAuthLoading} fullWidth className="h-16 bg-neon-blue text-black font-black text-lg rounded-2xl">
                  {isAuthLoading ? <Loader2 className="animate-spin"/> : 'ENVIAR CÓDIGO'}
              </Button>
            </motion.div>
          )}

          {/* STEP 1.5: AUTH (OTP) */}
          {step === 1.5 && (
            <motion.div key="s1.5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
               <button onClick={() => setStep(1)} className="text-zinc-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase"><ChevronLeft size={16}/> Cambiar Email</button>
               
               <div className="text-center">
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Verificar Email</h3>
                   <p className="text-zinc-500 text-sm mt-2">Introduce el código de 6 dígitos enviado a <br/><span className="text-white font-bold">{email}</span></p>
               </div>

               <Input 
                 autoFocus
                 placeholder="000000" 
                 value={otp} 
                 maxLength={6}
                 onChange={e => setOtp(e.target.value)} 
                 className="h-20 bg-black border-white/10 text-white font-black text-3xl text-center tracking-[0.5em] rounded-2xl focus:border-neon-blue" 
               />
               {authError && <p className="text-red-400 text-xs font-bold text-center bg-red-500/10 py-2 rounded-lg">{authError}</p>}

               <Button onClick={handleVerifyOtp} disabled={otp.length < 6 || isAuthLoading} fullWidth className="h-16 bg-emerald-500 text-black font-black text-lg rounded-2xl">
                  {isAuthLoading ? <Loader2 className="animate-spin"/> : 'VERIFICAR Y CONTINUAR'}
               </Button>
               
               <p className="text-[10px] text-zinc-600 text-center uppercase font-bold cursor-pointer hover:text-zinc-400" onClick={handleRequestOtp}>¿No llegó? Reenviar código (Revisa Spam)</p>
            </motion.div>
          )}

          {/* STEP 2: PAGO (CHECKOUT) */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
              <button onClick={() => setStep(0)} className="absolute top-6 left-6 text-zinc-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase"><ChevronLeft size={16}/> Modificar</button>
              
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 mt-4">
                <Shield className="text-emerald-500 w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Pasarela Segura</h3>
                <p className="text-zinc-500 text-sm mt-2 flex items-center justify-center gap-2">
                    <User size={12}/> {name || email}
                </p>
              </div>
              <div className="bg-black/40 p-6 rounded-3xl border border-white/5 space-y-2">
                  <div className="flex justify-between text-zinc-500 text-xs font-bold"><span>PRODUCTO</span><span>TICKETS ({selectedItems.length})</span></div>
                  <div className="flex justify-between text-white font-black text-xl pt-2 border-t border-white/5"><span>TOTAL</span><span>${subtotal.toLocaleString()}</span></div>
              </div>
              <Button onClick={handlePayment} disabled={isProcessing} fullWidth className="h-16 bg-white text-black font-black text-lg rounded-2xl">
                {isProcessing ? <Loader2 className="animate-spin" /> : "PAGAR AHORA"}
              </Button>
            </motion.div>
          )}

          {/* STEP 3: ÉXITO */}
          {step === 3 && completedOrder && (
            <motion.div key="success" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6 py-4">
              <div className="w-24 h-24 bg-neon-purple/20 rounded-[2.5rem] flex items-center justify-center mx-auto border border-neon-purple/30">
                <CheckCircle2 className="text-neon-purple w-12 h-12" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">¡LISTO!</h2>
                <p className="text-zinc-500 text-sm mt-2">Tu pago ha sido verificado por Midnight ExFi.</p>
              </div>
              
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10"><Smartphone size={40}/></div>
                  <p className="text-neon-purple text-[10px] font-black uppercase tracking-[0.2em] mb-2">Mensaje VIP</p>
                  <p className="text-white font-bold italic text-lg leading-tight">"{aiMessage}"</p>
              </div>

              <div className="space-y-3">
                  <Button fullWidth className="h-14 bg-emerald-500 text-black font-black rounded-xl">
                      <Download className="mr-2 w-4 h-4"/> DESCARGAR TICKET (PDF)
                  </Button>
                  <div className="flex items-center justify-center gap-2 text-zinc-500 font-bold text-[10px] uppercase">
                      <Mail size={12}/> Enviado a {email}
                  </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}