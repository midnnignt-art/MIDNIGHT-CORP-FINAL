import React, { useState, useEffect } from 'react';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import { Loader2, Shield, ChevronLeft, Lock, AlertTriangle, CreditCard, User, Phone, Mail } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { TicketTier, Order } from '../types';
import TicketSelector from './TicketSelector';
import { useStore } from '../context/StoreContext';
import { supabase } from '../lib/supabase';

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
  const [phone, setPhone] = useState(''); // Campo opcional solicitado
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // Order State
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null); 
  
  // Bold Integration State
  const [gatewayStatus, setGatewayStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [gatewayMessage, setGatewayMessage] = useState('');

  // Auto-fill if user is already logged in (customer)
  useEffect(() => {
    if (currentCustomer) {
        setEmail(currentCustomer.email || '');
        if (currentCustomer.user_metadata?.full_name) {
            setName(currentCustomer.user_metadata.full_name);
        }
        // Intentar recuperar teléfono de metadata si existe
        if (currentCustomer.user_metadata?.phone) {
            setPhone(currentCustomer.user_metadata.phone);
        }
        if (step === 1) setStep(2);
    }
  }, [currentCustomer, step]);

  // INITIATE BOLD API FLOW
  useEffect(() => {
    if (step === 2.5 && pendingOrder && gatewayStatus === 'idle') {
        initiateBoldTransaction();
    }
  }, [step, pendingOrder, gatewayStatus]);

  const initiateBoldTransaction = async () => {
      setGatewayStatus('loading');
      setGatewayMessage('Conectando con Bold...');
      
      try {
          if (!pendingOrder) throw new Error("No hay orden pendiente.");
          
          const rawAmount = pendingOrder.total;
          const rawOrderId = pendingOrder.order_number;

          if (!rawAmount || !rawOrderId) throw new Error("Datos de orden incompletos.");

          console.log("Iniciando firma para:", rawOrderId, rawAmount);

          // 1. Pedir la firma a tu Edge Function
          const { data, error } = await supabase.functions.invoke('bold-signature', {
            body: {
                orderId: rawOrderId,
                amount: rawAmount,
                currency: 'COP'
            }
          });

          if (error) {
              console.error("Supabase Error:", error);
              throw new Error(error.message || "Error al conectar con el servidor de firmas.");
          }
          
          if (!data || !data.integritySignature) {
              throw new Error("No se recibió una firma válida.");
          }

          const signature = data.integritySignature;

          // 2. Inyectar el script de Bold con los atributos correctos
          // Limpiar scripts previos si existen
          const existing = document.querySelector('script[data-bold-button]');
          if (existing) existing.remove();

          const container = document.getElementById("bold-container");
          if (!container) throw new Error("Contenedor 'bold-container' no encontrado.");
          container.innerHTML = '';

          const script = document.createElement("script");
          script.setAttribute("data-bold-button", "dark-L");
          script.setAttribute("data-api-key", "K8mOAoWetfE5onyHWlhgvpLFcJIltm9Q64tZGv0Rmrs");
          script.setAttribute("data-order-id", rawOrderId); // Usar el ID original
          script.setAttribute("data-currency", "COP");
          script.setAttribute("data-amount", String(rawAmount)); // Usar el monto original (entero)
          script.setAttribute("data-integrity-signature", signature);
          script.setAttribute("data-redirection-url", `${window.location.origin}/gracias`);
          script.setAttribute("data-render-mode", "embedded");
          script.src = "https://checkout.bold.co/library/boldPaymentButton.js";
          
          // Datos del cliente (Opcional, mantenemos para mejor UX)
          if (email || name) {
             const customerData = { email, fullName: name, phone, dialCode: "+57" };
             script.setAttribute("data-customer-data", JSON.stringify(customerData));
          }

          // Listener para detectar carga
          script.onload = () => {
              setGatewayStatus('ready');
              setGatewayMessage('');
          };

          script.onerror = () => {
              console.error("Error cargando script de Bold");
              setGatewayStatus('error');
              setGatewayMessage("No se pudo cargar el botón de pago.");
          };
          
          container.appendChild(script);

      } catch (error: any) {
          console.error("Bold Integration Error:", error);
          setGatewayStatus('error');
          setGatewayMessage(error.message || "Error desconocido al iniciar pago.");
      }
  };

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

  const translateError = (msg: string = '') => {
      const m = msg.toLowerCase();
      if (m.includes('rate limit')) return 'Espera un momento antes de reintentar.';
      if (m.includes('token')) return 'Código inválido o expirado.';
      return msg || 'Error de conexión.';
  };

  // AUTH HANDLERS
  const handleRequestOtp = async () => {
    if (!email.includes('@')) return setAuthError('Email inválido');
    setIsAuthLoading(true);
    setAuthError('');
    
    // Pasamos metadata adicional (nombre, telefono) para guardarlo en el usuario si es nuevo
    const res = await requestCustomerOtp(email, { full_name: name, phone: phone });
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
        setAuthError('Código incorrecto.');
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      const orderData = await onComplete({ 
        customerInfo: { name: name || 'Cliente Midnight', email, phone }, 
        items: selectedItems,
        method: 'bold' 
      });

      if (!orderData) {
         setIsProcessing(false);
         return; 
      }
      
      setPendingOrder(orderData);
      setStep(2.5);
      
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-zinc-900/95 backdrop-blur-2xl rounded-[2rem] md:rounded-[2.5rem] border border-white/10 overflow-hidden w-full max-w-md mx-auto shadow-2xl relative">
      
      {currentCustomer && step < 2.5 && (
          <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
              <button onClick={customerLogout} className="text-[9px] md:text-[10px] font-bold text-zinc-500 hover:text-red-400 uppercase">Cerrar Sesión</button>
          </div>
      )}

      <div className="p-5 md:p-8">
        <AnimatePresence mode="wait">
          
          {/* STEP 0: SELECCIÓN */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 md:space-y-6">
              <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Entradas</h3>
              <TicketSelector tiers={tiers} selectedTiers={selectedTiers} onSelect={setSelectedTiers} />
              <div className="flex justify-between items-center py-3 md:py-4 border-t border-white/5">
                <span className="text-zinc-500 font-bold text-xs uppercase">Total a pagar</span>
                <span className="text-2xl md:text-3xl font-black text-white">${subtotal.toLocaleString()}</span>
              </div>
              <Button onClick={() => setStep(currentCustomer ? 2 : 1)} disabled={selectedItems.length === 0} fullWidth className="h-12 md:h-16 bg-white text-black font-black text-base md:text-lg rounded-xl md:rounded-2xl">CONTINUAR</Button>
            </motion.div>
          )}

          {/* STEP 1: AUTH (EMAIL & PHONE) */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 md:space-y-6">
              <button onClick={() => setStep(0)} className="text-zinc-500 hover:text-white flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase"><ChevronLeft size={14} className="md:w-4 md:h-4"/> Volver</button>
              
              <div className="text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-neon-blue/20 rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4 border border-neon-blue/20">
                      <Lock className="text-neon-blue w-6 h-6 md:w-8 md:h-8" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Tus Datos</h3>
                  <p className="text-zinc-500 text-xs md:text-sm mt-1 md:mt-2">Necesarios para enviar tus tickets.</p>
              </div>
              
              <div className="space-y-3 md:space-y-4">
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4"/>
                    <Input placeholder="NOMBRE COMPLETO" value={name} onChange={e => setName(e.target.value)} className="pl-10 h-10 md:h-12 bg-black border-white/10 text-white font-bold text-xs md:text-sm" />
                </div>
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4"/>
                    <Input placeholder="CORREO ELECTRÓNICO" type="email" value={email} onChange={e => setEmail(e.target.value.toLowerCase())} className="pl-10 h-10 md:h-12 bg-black border-white/10 text-white font-bold text-xs md:text-sm" />
                </div>
                <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4"/>
                    <Input placeholder="TELÉFONO / CELULAR" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="pl-10 h-10 md:h-12 bg-black border-white/10 text-white font-bold text-xs md:text-sm" />
                </div>

                {authError && <p className="text-red-400 text-xs text-center font-bold bg-red-500/10 p-2 rounded">{authError}</p>}
              </div>
              
              <Button onClick={handleRequestOtp} disabled={!email || !name || isAuthLoading} fullWidth className="h-12 md:h-16 bg-neon-blue text-black font-black text-base md:text-lg rounded-xl md:rounded-2xl">
                  {isAuthLoading ? <Loader2 className="animate-spin"/> : 'CONTINUAR'}
              </Button>
            </motion.div>
          )}

          {/* STEP 1.5: AUTH (OTP) */}
          {step === 1.5 && (
            <motion.div key="s1.5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 md:space-y-6">
               <button onClick={() => setStep(1)} className="text-zinc-500 hover:text-white flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase"><ChevronLeft size={14} className="md:w-4 md:h-4"/> Corregir Datos</button>
               
               <div className="text-center">
                   <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Verificar Email</h3>
                   <p className="text-zinc-500 text-xs md:text-sm mt-1 md:mt-2">Código enviado a <span className="text-white font-bold">{email}</span></p>
               </div>

               <Input autoFocus placeholder="000000" value={otp} maxLength={8} onChange={e => setOtp(e.target.value)} className="h-14 md:h-20 bg-black border-white/10 text-white font-black text-2xl md:text-3xl text-center tracking-[0.5em] rounded-xl md:rounded-2xl focus:border-neon-blue" />
               {authError && <p className="text-red-400 text-xs font-bold text-center">{authError}</p>}

               <Button onClick={handleVerifyOtp} disabled={otp.length < 6 || isAuthLoading} fullWidth className="h-12 md:h-16 bg-emerald-500 text-black font-black text-base md:text-lg rounded-xl md:rounded-2xl">
                  {isAuthLoading ? <Loader2 className="animate-spin"/> : 'VERIFICAR'}
               </Button>
            </motion.div>
          )}

          {/* STEP 2: RESUMEN */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 md:space-y-6">
              <button onClick={() => setStep(0)} className="absolute top-4 left-4 md:top-6 md:left-6 text-zinc-500 hover:text-white flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase"><ChevronLeft size={14} className="md:w-4 md:h-4"/> Modificar</button>
              
              <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 mt-2 md:mt-4">
                <Shield className="text-emerald-500 w-8 h-8 md:w-10 md:h-10" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Pasarela Segura</h3>
                <p className="text-zinc-500 text-xs md:text-sm mt-1 md:mt-2 flex items-center justify-center gap-2">
                    <User size={12}/> {name}
                </p>
              </div>
              <div className="bg-black/40 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/5 space-y-2">
                  <div className="flex justify-between text-zinc-500 text-[10px] md:text-xs font-bold"><span>PRODUCTO</span><span>TICKETS ({selectedItems.length})</span></div>
                  <div className="flex justify-between text-white font-black text-lg md:text-xl pt-2 border-t border-white/5"><span>TOTAL A PAGAR</span><span>${subtotal.toLocaleString()}</span></div>
              </div>
              <Button onClick={handlePayment} disabled={isProcessing} fullWidth className="h-12 md:h-16 bg-white text-black font-black text-base md:text-lg rounded-xl md:rounded-2xl">
                {isProcessing ? <Loader2 className="animate-spin" /> : "IR A PAGAR CON BOLD"}
              </Button>
            </motion.div>
          )}

          {/* STEP 2.5: BOLD WIDGET CONTAINER */}
          {step === 2.5 && pendingOrder && (
             <motion.div key="s2.5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6 py-4">
                 
                 <div className={`p-6 rounded-3xl relative overflow-hidden transition-colors duration-500 ${gatewayStatus === 'error' ? 'bg-red-600/10 border border-red-600/30' : 'bg-zinc-800 border border-white/5'}`}>
                     
                     <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center justify-center gap-2 mb-2">
                         <CreditCard className="text-neon-blue"/> PAGO SEGURO
                     </h3>
                     
                     <div className="my-6">
                         <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Total a Pagar</p>
                         <p className="text-4xl font-black text-white tracking-tighter">${subtotal.toLocaleString()}</p>
                         <p className="text-[10px] text-zinc-500 mt-1 font-mono">ORDEN: {pendingOrder.order_number}</p>
                     </div>

                     <div className="flex flex-col items-center justify-center min-h-[60px] gap-2">
                         {gatewayStatus === 'loading' && (
                             <div className="flex items-center gap-2 text-zinc-400 text-xs animate-pulse">
                                 <Loader2 className="animate-spin w-4 h-4"/> {gatewayMessage}
                             </div>
                         )}
                         {gatewayStatus === 'error' && (
                             <div className="flex flex-col items-center gap-2 text-red-400 text-[10px] font-bold text-center">
                                 <AlertTriangle size={16}/> {gatewayMessage}
                                 <Button onClick={initiateBoldTransaction} variant="outline" className="h-8 text-xs mt-2 border-red-500/30 hover:bg-red-500/10 text-red-400">Reintentar Conexión</Button>
                             </div>
                         )}
                         
                         {/* CONTENEDOR PARA EL SCRIPT DE BOLD */}
                         <div id="bold-container" className="mt-2 flex justify-center w-full min-h-[50px]">
                             {/* El script inyectará el botón aquí automáticamente */}
                         </div>
                     </div>
                 </div>
                 
                 <p className="text-[10px] text-zinc-500 uppercase font-bold max-w-xs mx-auto">
                    Serás redirigido a la pasarela oficial de Bold para completar tu pago de forma segura.
                 </p>
             </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}