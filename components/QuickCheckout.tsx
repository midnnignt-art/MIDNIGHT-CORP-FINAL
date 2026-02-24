import React, { useState, useEffect } from 'react';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import { Loader2, Shield, ChevronLeft, AlertTriangle, CreditCard, User } from 'lucide-react';
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
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState(''); 
  const [phone, setPhone] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null); 
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'failed'>('pending');
  
  const [gatewayStatus, setGatewayStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [gatewayMessage, setGatewayMessage] = useState('');

  useEffect(() => {
    if (currentCustomer) {
        setEmail(currentCustomer.email || '');
        if (currentCustomer.user_metadata?.full_name) setName(currentCustomer.user_metadata.full_name);
        if (currentCustomer.user_metadata?.phone) setPhone(currentCustomer.user_metadata.phone);
        if (step === 1) setStep(2);
    }
  }, [currentCustomer, step]);

  // ✅ FIX PRINCIPAL: escuchar 'completed' no 'paid'
  useEffect(() => {
    if (!pendingOrder || step !== 2.5) return;

    console.log("🔌 Activando Realtime para orden:", pendingOrder.id);

    const channel = supabase
      .channel(`order-status-${pendingOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${pendingOrder.id}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          console.log("📡 Realtime - Order status changed to:", newStatus);
          
          // ✅ CORREGIDO: el webhook guarda 'completed', no 'paid'
          if (newStatus === 'completed') {
            setPaymentStatus('paid');
            
            // NEW: Update other group orders if they exist
            if ((pendingOrder as any)._groupOrders) {
                 const groupOrders = (pendingOrder as any)._groupOrders as any[];
                 const otherOrderIds = groupOrders.filter(o => o.id !== pendingOrder.id).map(o => o.id);
                 
                 if (otherOrderIds.length > 0) {
                     console.log("🔄 Updating group orders:", otherOrderIds);
                     supabase.from('orders')
                        .update({ status: 'completed', payment_method: 'bold' })
                        .in('id', otherOrderIds)
                        .then(({ error }) => {
                            if (error) console.error("❌ Error updating group orders:", error);
                            else console.log("✅ Group orders updated to completed");
                        });
                 }
            }

            // SEND EMAIL WITH ALL TICKETS
            const allOrders = (pendingOrder as any)._groupOrders || [pendingOrder];
            import('../services/emailService').then(({ sendTicketEmail }) => {
                // Ensure timestamp is present for email template
                const ordersWithTimestamp = allOrders.map((o: any) => ({
                    ...o,
                    timestamp: o.timestamp || o.created_at || new Date().toISOString()
                }));
                sendTicketEmail(ordersWithTimestamp, event).catch(console.error);
            });

            setTimeout(() => {
              window.location.href = `/gracias?order=${pendingOrder.order_number}`;
            }, 2000);
          } else if (newStatus === 'failed') {
            setPaymentStatus('failed');
            setGatewayStatus('error');
            setGatewayMessage('El pago fue rechazado. Por favor intenta de nuevo.');
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 Realtime subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingOrder, step]);

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
          
          const rawAmount = (pendingOrder as any)._groupTotal || pendingOrder.total;
          const rawOrderId = pendingOrder.order_number;

          if (!rawAmount || !rawOrderId) throw new Error("Datos de orden incompletos.");

          console.log("🔑 Iniciando firma para:", rawOrderId, rawAmount);

          const { data, error } = await supabase.functions.invoke('bold-signature', {
            body: {
                orderId: rawOrderId,
                amount: rawAmount,
                currency: 'COP'
            }
          });

          if (error) throw new Error(error.message || "Error al conectar con el servidor de firmas.");
          
          const signature = data?.signature || data?.integritySignature;
          if (!signature) throw new Error("No se recibió una firma válida del servidor.");

          console.log("✅ Firma recibida. OrderId que se enviará a Bold:", rawOrderId);

          const existing = document.querySelector('script[data-bold-button]');
          if (existing) existing.remove();

          const container = document.getElementById("bold-container");
          if (!container) throw new Error("Contenedor 'bold-container' no encontrado.");
          container.innerHTML = '';

          const script = document.createElement("script");
          script.setAttribute("data-bold-button", "dark-L");
          script.setAttribute("data-api-key", "HXR9FR8wKFLJmIXK29TyR74ey1l32zVvLvkV4QDyaVY");
          script.setAttribute("data-order-id", rawOrderId);  // MID-XXXXX
          script.setAttribute("data-currency", "COP");
          script.setAttribute("data-amount", String(rawAmount));
          script.setAttribute("data-integrity-signature", signature);
          script.setAttribute("data-redirection-url", `${window.location.origin}/gracias`);
          script.setAttribute("data-render-mode", "embedded");
          script.src = "https://checkout.bold.co/library/boldPaymentButton.js";
          
          if (email || name) {
             const customerData = { email, fullName: name, phone, dialCode: "+57" };
             script.setAttribute("data-customer-data", JSON.stringify(customerData));
          }

          script.onload = () => {
              setGatewayStatus('ready');
              setGatewayMessage('');
              console.log("✅ Script Bold cargado correctamente");
          };

          script.onerror = () => {
              setGatewayStatus('error');
              setGatewayMessage("No se pudo cargar el botón de pago.");
          };
          
          container.appendChild(script);

      } catch (error: any) {
          console.error("❌ Bold Integration Error:", error);
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

  const handleRequestOtp = async () => {
    if (!email.includes('@')) return setAuthError('Email inválido');
    setIsAuthLoading(true);
    setAuthError('');
    const res = await requestCustomerOtp(email, { full_name: name, phone: phone });
    setIsAuthLoading(false);
    if (res.success) setStep(1.5); 
    else setAuthError(translateError(res.message));
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return setAuthError('El código debe tener 6 dígitos');
    setIsAuthLoading(true);
    setAuthError('');
    const success = await verifyCustomerOtp(email, otp);
    setIsAuthLoading(false);
    if (success) setStep(2); 
    else setAuthError('Código incorrecto.');
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      const orderData = await onComplete({ 
        customerInfo: { name: name || 'Cliente Midnight', email, phone }, 
        items: selectedItems,
        method: 'bold' 
      });

      if (!orderData) { setIsProcessing(false); return; }
      
      console.log("📋 Orden creada en BD:", orderData.order_number, "| ID:", orderData.id);
      setPendingOrder(orderData);
      setStep(2.5);
      
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-void/95 backdrop-blur-2xl rounded-none border border-moonlight/10 overflow-hidden w-full max-w-md mx-auto shadow-[0_0_100px_rgba(0,0,0,0.5)] relative">
      
      {currentCustomer && step < 2.5 && (
          <div className="absolute top-6 right-8 z-20">
              <button onClick={customerLogout} className="text-[10px] font-black text-moonlight/30 hover:text-red-500 uppercase tracking-widest">Logout</button>
          </div>
      )}

      <div className="p-8 md:p-12">
        <AnimatePresence mode="wait">
          
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              <h3 className="text-2xl md:text-3xl font-black text-moonlight uppercase tracking-tighter">Entradas</h3>
              <TicketSelector tiers={tiers} selectedTiers={selectedTiers} onSelect={setSelectedTiers} />
              <div className="flex justify-between items-center py-6 border-t border-moonlight/10">
                <span className="text-moonlight/40 font-light text-[10px] uppercase tracking-[0.3em]">Total</span>
                <span className="text-3xl md:text-4xl font-black text-moonlight tabular-nums">${subtotal.toLocaleString()}</span>
              </div>
              <button 
                onClick={() => setStep(currentCustomer ? 2 : 1)} 
                disabled={selectedItems.length === 0} 
                className="w-full h-16 bg-moonlight text-void font-black text-sm uppercase tracking-[0.5em] hover:bg-moonlight/90 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
              <button onClick={() => setStep(0)} className="text-moonlight/40 hover:text-moonlight flex items-center gap-2 text-[10px] font-light uppercase tracking-[0.3em] transition-colors"><ChevronLeft size={14}/> Volver</button>
              <div className="text-center">
                  <h3 className="text-2xl md:text-3xl font-black text-moonlight uppercase tracking-tighter">Tus Datos</h3>
                  <p className="text-moonlight/40 text-[10px] font-light tracking-[0.2em] uppercase mt-2">Para el envío de tickets</p>
              </div>
              <div className="space-y-4">
                <Input placeholder="NOMBRE COMPLETO" value={name} onChange={e => setName(e.target.value)} className="h-14 bg-void border-moonlight/10 text-moonlight font-bold text-xs uppercase tracking-widest focus:border-eclipse rounded-none" />
                <Input placeholder="CORREO ELECTRÓNICO" type="email" value={email} onChange={e => setEmail(e.target.value.toLowerCase())} className="h-14 bg-void border-moonlight/10 text-moonlight font-bold text-xs uppercase tracking-widest focus:border-eclipse rounded-none" />
                <Input placeholder="TELÉFONO / CELULAR" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="h-14 bg-void border-moonlight/10 text-moonlight font-bold text-xs uppercase tracking-widest focus:border-eclipse rounded-none" />
                {authError && <p className="text-red-500 text-[10px] text-center font-black uppercase tracking-widest bg-red-500/10 p-3">{authError}</p>}
              </div>
              <button onClick={handleRequestOtp} disabled={!email || !name || isAuthLoading} className="w-full h-16 bg-eclipse text-moonlight font-black text-sm uppercase tracking-[0.5em] hover:bg-eclipse/80 transition-all disabled:opacity-20">
                  {isAuthLoading ? <Loader2 className="animate-spin mx-auto"/> : 'Continuar'}
              </button>
            </motion.div>
          )}

          {step === 1.5 && (
            <motion.div key="s1.5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
               <button onClick={() => setStep(1)} className="text-moonlight/40 hover:text-moonlight flex items-center gap-2 text-[10px] font-light uppercase tracking-[0.3em] transition-colors"><ChevronLeft size={14}/> Corregir</button>
               <div className="text-center">
                   <h3 className="text-2xl md:text-3xl font-black text-moonlight uppercase tracking-tighter">Verificar</h3>
                   <p className="text-moonlight/40 text-[10px] font-light tracking-[0.2em] uppercase mt-2">Código enviado a {email}</p>
               </div>
               <Input autoFocus placeholder="000000" value={otp} maxLength={8} onChange={e => setOtp(e.target.value)} className="h-20 bg-void border-moonlight/10 text-moonlight font-black text-3xl text-center tracking-[0.5em] focus:border-eclipse rounded-none" />
               {authError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center">{authError}</p>}
               <button onClick={handleVerifyOtp} disabled={otp.length < 6 || isAuthLoading} className="w-full h-16 bg-moonlight text-void font-black text-sm uppercase tracking-[0.5em] hover:bg-moonlight/90 transition-all">
                  {isAuthLoading ? <Loader2 className="animate-spin mx-auto"/> : 'Verificar'}
               </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-8">
              <button onClick={() => setStep(0)} className="absolute top-6 left-8 text-moonlight/40 hover:text-moonlight flex items-center gap-2 text-[10px] font-light uppercase tracking-[0.3em] transition-colors"><ChevronLeft size={14}/> Modificar</button>
              <div className="w-20 h-20 bg-eclipse/10 rounded-full flex items-center justify-center mx-auto border border-eclipse/20 mt-4">
                <Shield className="text-eclipse w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-moonlight uppercase tracking-tighter">Pasarela Segura</h3>
                <p className="text-moonlight/40 text-[10px] font-light tracking-[0.2em] uppercase mt-2 flex items-center justify-center gap-2">
                    <User size={12}/> {name}
                </p>
              </div>
              <div className="bg-white/5 p-8 border border-moonlight/5 space-y-4">
                  <div className="flex justify-between text-moonlight/40 text-[10px] font-light tracking-[0.3em] uppercase"><span>Producto</span><span>Tickets ({selectedItems.length})</span></div>
                  <div className="flex justify-between text-moonlight font-black text-xl pt-4 border-t border-moonlight/10 tabular-nums"><span>Total</span><span>${subtotal.toLocaleString()}</span></div>
              </div>
              <button onClick={handlePayment} disabled={isProcessing} className="w-full h-16 bg-eclipse text-moonlight font-black text-sm uppercase tracking-[0.5em] hover:bg-eclipse/80 transition-all shadow-[0_0_40px_rgba(73,15,124,0.3)]">
                {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : "Ir a Pagar"}
              </button>
            </motion.div>
          )}

          {step === 2.5 && pendingOrder && (
             <motion.div key="s2.5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-8 py-4">
                 <div className={`p-8 transition-colors duration-500 ${paymentStatus === 'failed' || gatewayStatus === 'error' ? 'bg-red-600/10 border border-red-600/30' : paymentStatus === 'paid' ? 'bg-emerald-600/10 border border-emerald-600/30' : 'bg-white/5 border border-moonlight/10'}`}>
                     <h3 className="text-xl font-black text-moonlight uppercase tracking-[0.3em] flex items-center justify-center gap-3 mb-4">
                         {paymentStatus === 'paid' ? (
                             <span className="text-emerald-500 flex items-center gap-2">✅ Pago Aprobado</span>
                         ) : paymentStatus === 'failed' ? (
                             <span className="text-red-500 flex items-center gap-2">❌ Pago Rechazado</span>
                         ) : (
                             <><CreditCard className="text-eclipse"/> Pago Seguro</>
                         )}
                     </h3>
                     <div className="my-8">
                         <p className="text-[10px] text-moonlight/40 uppercase font-light tracking-[0.4em] mb-2">Total a Pagar</p>
                         <p className="text-5xl font-black text-moonlight tracking-tighter tabular-nums">${subtotal.toLocaleString()}</p>
                         <p className="text-[10px] text-moonlight/30 mt-4 font-mono tracking-widest uppercase">Orden: {pendingOrder.order_number}</p>
                     </div>
                     <div className="flex flex-col items-center justify-center min-h-[80px] gap-4">
                         {paymentStatus === 'paid' && (
                             <div className="text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-bounce">
                                 ¡Gracias! Redirigiendo a tus boletas...
                             </div>
                         )}
                         {paymentStatus === 'pending' && gatewayStatus === 'loading' && (
                             <div className="flex items-center gap-3 text-moonlight/40 text-[10px] font-light tracking-[0.2em] uppercase animate-pulse">
                                 <Loader2 className="animate-spin w-4 h-4"/> {gatewayMessage}
                             </div>
                         )}
                         {(paymentStatus === 'failed' || gatewayStatus === 'error') && (
                             <div className="flex flex-col items-center gap-3 text-red-500 text-[10px] font-black uppercase tracking-widest text-center">
                                 <AlertTriangle size={20}/> {gatewayMessage || 'Error en el proceso de pago.'}
                                 <button onClick={() => {
                                     setPaymentStatus('pending');
                                     setGatewayStatus('idle');
                                     initiateBoldTransaction();
                                 }} className="h-10 px-6 border border-red-500/30 hover:bg-red-500/10 text-red-500 transition-all mt-2">Reintentar</button>
                             </div>
                         )}
                         {paymentStatus === 'pending' && (
                             <div id="bold-container" className="mt-4 flex justify-center w-full min-h-[60px]"></div>
                         )}
                     </div>
                 </div>
                 <p className="text-[9px] text-moonlight/30 uppercase font-light tracking-[0.3em] leading-relaxed max-w-xs mx-auto">
                    {paymentStatus === 'paid' ? 'Tu pago ha sido procesado exitosamente.' : 'Serás redirigido a la pasarela oficial de Bold para completar tu pago de forma segura.'}
                 </p>
             </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}