import React, { useState, useEffect } from 'react';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import { Loader2, Shield, ChevronLeft, AlertTriangle, CreditCard, User } from 'lucide-react';
import { Input } from './ui/input';
import { TicketTier, Order } from '../types';
import TicketSelector from './TicketSelector';
import { useStore } from '../context/StoreContext';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { isValidEmail, isValidOtp, isValidName, normalizeEmail } from '../lib/validation';
import { buildWompiCheckoutUrl } from '../lib/wompi';
import TurnstileWidget from './TurnstileWidget';

const TURNSTILE_ENABLED = !!(import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined);

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
  const [resendCooldown, setResendCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [gatewayStatus, setGatewayStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [gatewayMessage, setGatewayMessage] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Read applied discount from sessionStorage (set by DiscountLanding, lives only for this tab session)
  const [appliedDiscount] = useState(() => {
    const pct    = parseInt(sessionStorage.getItem('ms_dc_pct')     || '0');
    const tierId = sessionStorage.getItem('ms_dc_tier_id')  || null;
    const label  = sessionStorage.getItem('ms_dc_label')    || '';
    const tname  = sessionStorage.getItem('ms_dc_tier_name')|| '';
    return pct > 0 ? { pct, tierId, label, tierName: tname } : null;
  });

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
                        .update({ status: 'completed', payment_method: 'wompi' })
                        .in('id', otherOrderIds)
                        .then(({ error }) => {
                            if (error) console.error("❌ Error updating group orders:", error);
                            else console.log("✅ Group orders updated to completed");
                        });
                 }
            }

            // Email se envía desde el webhook (servidor) — no desde el browser

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
        initiateWompiTransaction();
    }
  }, [step, pendingOrder, gatewayStatus]);

  // Wompi es un checkout HOSTED (redirect): pedimos la firma de integridad al
  // edge function y redirigimos al Web Checkout de Wompi. Al terminar, Wompi
  // devuelve al cliente a /gracias?reference=MID-XXXX&status=APPROVED, y el
  // webhook wompi-webhook confirma la orden en el servidor.
  const initiateWompiTransaction = async () => {
      setGatewayStatus('loading');
      setGatewayMessage('Redirigiendo a Wompi…');

      try {
          if (!pendingOrder) throw new Error("No hay orden pendiente.");

          const rawAmount = (pendingOrder as any)._groupTotal || pendingOrder.total;
          const rawOrderId = pendingOrder.order_number;

          if (!rawAmount || !rawOrderId) throw new Error("Datos de orden incompletos.");

          console.log("🔑 Iniciando checkout Wompi para:", rawOrderId, rawAmount);

          const url = await buildWompiCheckoutUrl({
            reference:        rawOrderId,               // MID-XXXXX (order_number)
            amountCOP:        Number(rawAmount),
            customerEmail:    email || undefined,
            customerFullName: name || undefined,
            customerPhone:    phone ? phone.replace(/[^0-9]/g, '') : undefined,
            redirectUrl:      `${window.location.origin}/gracias`,
          });

          // Redirige al checkout de Wompi (la página se descarga aquí).
          window.location.href = url;

      } catch (error: any) {
          console.error("❌ Wompi Integration Error:", error);
          setGatewayStatus('error');
          setGatewayMessage(error.message || "Error desconocido al iniciar pago.");
      }
  };

  const selectedItems = Object.entries(selectedTiers)
    .filter(([_, qty]) => (qty as number) > 0)
    .map(([tierId, qty]) => {
      const tier = tiers.find(t => t.id === tierId);
      const base = tier?.price || 0;
      // Apply discount: if no tier_id restriction → applies to all tiers; if tier_id set → only that tier
      const hasDiscount = appliedDiscount && (appliedDiscount.tierId === null || appliedDiscount.tierId === tierId);
      const unitPrice   = hasDiscount ? Math.round(base * (1 - appliedDiscount!.pct / 100)) : base;
      return {
        tier_id:        tier?.id,
        tier_name:      tier?.name,
        quantity:       qty as number,
        unit_price:     unitPrice,
        original_price: hasDiscount ? base : undefined,
        subtotal:       unitPrice * (qty as number),
      };
    });

  const subtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAppliedToSelected = appliedDiscount && selectedItems.some(i =>
    appliedDiscount.tierId === null || appliedDiscount.tierId === i.tier_id
  );

  const translateError = (msg: string = '') => {
      const m = msg.toLowerCase();
      if (m.includes('rate limit')) return 'Espera un momento antes de reintentar.';
      if (m.includes('token')) return 'Código inválido o expirado.';
      return msg || 'Error de conexión.';
  };

  const handleRequestOtp = async () => {
    if (!isValidName(name)) return setAuthError('Ingresa tu nombre completo');
    if (!isValidEmail(email)) return setAuthError('Email inválido');
    if (TURNSTILE_ENABLED && !captchaToken) return setAuthError('Completa la verificación');
    setIsAuthLoading(true);
    setAuthError('');
    const res = await requestCustomerOtp(normalizeEmail(email), { full_name: name.trim(), phone: phone.trim() }, captchaToken ?? undefined);
    setIsAuthLoading(false);
    if (res.success) { setStep(1.5); setResendCooldown(30); }
    else { setAuthError(translateError(res.message)); setCaptchaToken(null); }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isAuthLoading) return;
    if (TURNSTILE_ENABLED && !captchaToken) return setAuthError('Completa la verificación');
    setIsAuthLoading(true);
    setAuthError('');
    const res = await requestCustomerOtp(normalizeEmail(email), { full_name: name.trim(), phone: phone.trim() }, captchaToken ?? undefined);
    setIsAuthLoading(false);
    if (res.success) { setResendCooldown(30); toast.success('Código reenviado'); }
    else { setAuthError(translateError(res.message)); setCaptchaToken(null); }
  };

  const handleVerifyOtp = async () => {
    if (!isValidOtp(otp)) return setAuthError('El código debe tener 6 dígitos');
    setIsAuthLoading(true);
    setAuthError('');
    const success = await verifyCustomerOtp(normalizeEmail(email), otp);
    setIsAuthLoading(false);
    if (success) setStep(2);
    else setAuthError('Código incorrecto.');
  };

  const handlePayment = async () => {
    if (selectedItems.length === 0 || subtotal <= 0) {
      toast.error('Selecciona al menos una entrada.');
      return;
    }
    if (!Number.isFinite(subtotal) || !Number.isInteger(subtotal) || subtotal > 50_000_000) {
      toast.error('Monto inválido. Recarga la página e intenta de nuevo.');
      return;
    }
    setIsProcessing(true);
    try {
      const orderData = await onComplete({
        customerInfo: { name: name.trim() || 'Cliente Midnight', email: normalizeEmail(email), phone: phone.trim() },
        items: selectedItems,
        method: 'wompi'
      });

      if (!orderData) { setIsProcessing(false); return; }

      console.log("📋 Orden creada en BD:", orderData.order_number, "| ID:", orderData.id);
      setPendingOrder(orderData);
      setStep(2.5);

    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-void/95 backdrop-blur-2xl rounded-3xl border border-moonlight/10 overflow-hidden w-full mx-auto shadow-[0_0_100px_rgba(0,0,0,0.5)] relative">
      
      {currentCustomer && step < 2.5 && (
          <div className="absolute top-6 right-8 z-20">
              <button onClick={customerLogout} className="text-[10px] font-black text-moonlight/30 hover:text-red-500 uppercase tracking-widest">Logout</button>
          </div>
      )}

      <div className="p-4 sm:p-8 md:p-12">
        <AnimatePresence mode="wait">
          
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* ── Mini-card del evento (ancla contexto visual) ───────── */}
              <EventMiniCard event={event} />

              {/* ── Step indicator: ENTRADAS · DATOS · PAGO ─────────── */}
              <StepIndicator currentStep={0} skipDataStep={!!currentCustomer} />

              <h3 className="text-2xl md:text-3xl font-black text-moonlight uppercase tracking-tighter">Entradas</h3>

              {/* Discount banner */}
              {appliedDiscount && (
                <div className="flex items-center gap-3 bg-[#C9A84C]/10 border border-[#C9A84C]/25 rounded-xl px-4 py-3">
                  <span className="text-[#C9A84C] text-lg">🏷</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#C9A84C] text-[10px] font-black uppercase tracking-[0.25em]" style={{ fontFamily: "'Space Mono',monospace" }}>
                      Descuento {appliedDiscount.pct}% activo
                    </p>
                    <p className="text-moonlight/40 text-[9px] truncate" style={{ fontFamily: "'Space Mono',monospace" }}>
                      {appliedDiscount.tierName ? `Boleta: ${appliedDiscount.tierName}` : appliedDiscount.label}
                    </p>
                  </div>
                </div>
              )}

              <TicketSelector tiers={tiers} selectedTiers={selectedTiers} onSelect={setSelectedTiers} />

              {/* ── Código promocional (colapsable) ─────────────────── */}
              <PromoCodeField />

              {/* ── Total con roll counter ─────────────────────────── */}
              <div className="flex justify-between items-center py-5 border-t border-moonlight/10">
                <span className="text-moonlight/40 font-light text-[10px] uppercase tracking-[0.3em]">Total</span>
                <div className="text-right">
                  {discountAppliedToSelected && (
                    <p className="text-moonlight/30 text-sm line-through tabular-nums text-right">
                      ${selectedItems.reduce((s, i) => s + (i.original_price ?? i.unit_price) * i.quantity, 0).toLocaleString()}
                    </p>
                  )}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={subtotal}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -12, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="inline-block text-3xl md:text-4xl font-black text-moonlight tabular-nums"
                    >
                      ${subtotal.toLocaleString()}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>

              <button
                onClick={() => setStep(currentCustomer ? 2 : 1)}
                disabled={selectedItems.length === 0}
                className="w-full h-16 bg-moonlight text-void font-black text-sm uppercase tracking-[0.5em] hover:bg-white transition-all disabled:opacity-20 disabled:cursor-not-allowed rounded-2xl"
              >
                {selectedItems.length === 0 ? 'Selecciona Una Entrada' : 'Continuar'}
              </button>

              {/* ── Trust signals ─────────────────────────────────── */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-1">
                <TrustChip>🔒 Pago seguro · Wompi</TrustChip>
                <TrustChip>QR único anti-fraude</TrustChip>
                <TrustChip>Tickets transferibles</TrustChip>
              </div>
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
                <Input aria-label="Nombre completo" autoComplete="name" placeholder="NOMBRE COMPLETO" value={name} onChange={e => setName(e.target.value)} className="h-14 bg-void border-moonlight/10 text-moonlight font-bold text-xs uppercase tracking-widest focus:border-eclipse rounded-2xl" />
                <Input aria-label="Correo electrónico" autoComplete="email" inputMode="email" placeholder="CORREO ELECTRÓNICO" type="email" value={email} onChange={e => setEmail(e.target.value.toLowerCase())} className="h-14 bg-void border-moonlight/10 text-moonlight font-bold text-xs uppercase tracking-widest focus:border-eclipse rounded-2xl" />
                <Input aria-label="Teléfono o celular" autoComplete="tel" inputMode="tel" placeholder="TELÉFONO / CELULAR" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="h-14 bg-void border-moonlight/10 text-moonlight font-bold text-xs uppercase tracking-widest focus:border-eclipse rounded-2xl" />
                {TURNSTILE_ENABLED && (
                  <TurnstileWidget
                    onToken={setCaptchaToken}
                    onExpire={() => setCaptchaToken(null)}
                  />
                )}
                {authError && <p className="text-red-500 text-[10px] text-center font-black uppercase tracking-widest bg-red-500/10 p-3 rounded-xl">{authError}</p>}
              </div>
              <button onClick={handleRequestOtp} disabled={!email || !name || isAuthLoading || (TURNSTILE_ENABLED && !captchaToken)} className="w-full h-16 bg-eclipse text-moonlight font-black text-sm uppercase tracking-[0.5em] hover:bg-eclipse/80 transition-all disabled:opacity-20 rounded-2xl">
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
               <Input autoFocus aria-label="Código de verificación de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={otp} maxLength={6} onChange={e => setOtp(e.target.value)} className="h-20 bg-void border-moonlight/10 text-moonlight font-black text-3xl text-center tracking-[0.5em] focus:border-eclipse rounded-2xl" />
               {authError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center">{authError}</p>}
               <button onClick={handleVerifyOtp} disabled={otp.length < 6 || isAuthLoading} className="w-full h-16 bg-moonlight text-void font-black text-sm uppercase tracking-[0.5em] hover:bg-moonlight/90 transition-all rounded-2xl">
                  {isAuthLoading ? <Loader2 className="animate-spin mx-auto"/> : 'Verificar'}
               </button>
               <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isAuthLoading}
                  className="w-full text-center text-[10px] font-bold uppercase tracking-[0.3em] text-moonlight/40 hover:text-moonlight disabled:text-moonlight/20 disabled:cursor-not-allowed transition-colors"
               >
                  {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
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
              <div className="bg-white/5 p-5 md:p-8 border border-moonlight/5 space-y-4 rounded-2xl">
                  <div className="flex justify-between text-moonlight/40 text-[10px] font-light tracking-[0.3em] uppercase"><span>Producto</span><span>Tickets ({selectedItems.length})</span></div>
                  <div className="flex justify-between text-moonlight font-black text-xl pt-4 border-t border-moonlight/10 tabular-nums"><span>Total</span><span>${subtotal.toLocaleString()}</span></div>
              </div>
              <button onClick={handlePayment} disabled={isProcessing} className="w-full h-16 bg-eclipse text-moonlight font-black text-sm uppercase tracking-[0.5em] hover:bg-eclipse/80 transition-all shadow-[0_0_40px_rgba(73,15,124,0.3)] rounded-2xl">
                {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : "Ir a Pagar"}
              </button>
            </motion.div>
          )}

          {step === 2.5 && pendingOrder && (
             <motion.div key="s2.5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-8 py-4">
                 <div className={`p-5 md:p-8 transition-colors duration-500 rounded-2xl ${paymentStatus === 'failed' || gatewayStatus === 'error' ? 'bg-red-600/10 border border-red-600/30' : paymentStatus === 'paid' ? 'bg-emerald-600/10 border border-emerald-600/30' : 'bg-white/5 border border-moonlight/10'}`}>
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
                                     initiateWompiTransaction();
                                 }} className="h-10 px-6 border border-red-500/30 hover:bg-red-500/10 text-red-500 transition-all mt-2 rounded-xl">Reintentar</button>
                             </div>
                         )}
                     </div>
                 </div>
                 <p className="text-[9px] text-moonlight/30 uppercase font-light tracking-[0.3em] leading-relaxed max-w-xs mx-auto">
                    {paymentStatus === 'paid' ? 'Tu pago ha sido procesado exitosamente.' : 'Serás redirigido a la pasarela oficial de Wompi para completar tu pago de forma segura.'}
                 </p>
             </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes del step 0
// ─────────────────────────────────────────────────────────────────────────────

const EASE_OUT_CB = [0.16, 1, 0.3, 1] as const;

const EventMiniCard: React.FC<{ event: any }> = ({ event }) => {
  if (!event) return null;
  const date = event.event_date
    ? new Date(event.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase().replace('.', '')
    : '';
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT_CB }}
      className="flex items-center gap-3 p-3 rounded-2xl border border-moonlight/10 bg-midnight/30"
    >
      {event.cover_image && (
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex-shrink-0 border border-moonlight/10">
          <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-moonlight uppercase tracking-tight truncate">{event.title}</p>
        <p className="text-[9px] font-light text-moonlight/45 tracking-[0.25em] uppercase mt-0.5">
          {date}{event.venue ? ` · ${event.venue}` : ''}
        </p>
      </div>
    </motion.div>
  );
};

const StepIndicator: React.FC<{ currentStep: number; skipDataStep?: boolean }> = ({ currentStep, skipDataStep }) => {
  // currentStep: 0 = entradas, 1 = datos (o skip si ya está logueado), 2 = pago
  const steps = skipDataStep
    ? [{ label: 'Entradas', i: 0 }, { label: 'Pago', i: 1 }]
    : [{ label: 'Entradas', i: 0 }, { label: 'Datos', i: 1 }, { label: 'Pago', i: 2 }];

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {steps.map((s, idx) => {
        const isActive = idx === currentStep;
        const isDone = idx < currentStep;
        return (
          <React.Fragment key={s.label}>
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  isActive ? 'bg-moonlight shadow-[0_0_8px_rgba(255,255,255,0.6)] scale-150' : isDone ? 'bg-moonlight/60' : 'bg-moonlight/15'
                }`}
              />
              <span className={`text-[9px] font-black tracking-[0.3em] uppercase transition-colors ${
                isActive ? 'text-moonlight' : isDone ? 'text-moonlight/60' : 'text-moonlight/25'
              }`}>
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <span className="w-4 sm:w-6 h-px bg-moonlight/15" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const PromoCodeField: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'applying' | 'invalid'>('idle');

  const applyCode = () => {
    if (!code.trim()) return;
    setStatus('applying');
    // Por ahora UX placeholder — la lógica real de códigos vive en DiscountLanding
    // y se aplica vía sessionStorage. Aquí solo damos feedback al usuario.
    setTimeout(() => setStatus('invalid'), 600);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] font-bold uppercase tracking-[0.25em] text-moonlight/40 hover:text-moonlight transition-colors"
      >
        ¿Tienes código? +
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.3, ease: EASE_OUT_CB }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setStatus('idle'); }}
          placeholder="CÓDIGO"
          aria-label="Código promocional"
          className="flex-1 h-11 bg-void border border-moonlight/10 rounded-xl px-4 text-moonlight font-bold text-xs uppercase tracking-[0.3em] focus:outline-none focus:border-eclipse transition-colors"
        />
        <button
          type="button"
          onClick={applyCode}
          disabled={!code.trim() || status === 'applying'}
          className="h-11 px-5 bg-moonlight/10 hover:bg-moonlight/15 disabled:opacity-30 text-moonlight font-black text-[10px] uppercase tracking-[0.25em] rounded-xl transition-colors"
        >
          {status === 'applying' ? '...' : 'Aplicar'}
        </button>
      </div>
      {status === 'invalid' && (
        <p className="text-[10px] font-bold text-red-400 mt-2 tracking-wide">
          Código no válido. Si tienes uno de promoción, accede vía el link directo.
        </p>
      )}
    </motion.div>
  );
};

const TrustChip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-moonlight/35 inline-flex items-center gap-1">
    {children}
  </span>
);