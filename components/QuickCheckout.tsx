
import React, { useState } from 'react';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import { Loader2, Shield, ChevronLeft, CheckCircle2, Mail, Download, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { TicketTier, Order } from '../types';
import TicketSelector from './TicketSelector';
import { GoogleGenAI } from "@google/genai";

const motion = _motion as any;

interface QuickCheckoutProps {
  event: any;
  tiers: TicketTier[];
  onComplete: (data: any) => Promise<Order>;
}

export default function QuickCheckout({ event, tiers, onComplete }: QuickCheckoutProps) {
  const [step, setStep] = useState(0);
  const [selectedTiers, setSelectedTiers] = useState<{ [key: string]: number }>({});
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [aiMessage, setAiMessage] = useState('');

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

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      // 1. Llamada al Contexto (que simula el backend)
      const orderData = await onComplete({ 
        customerInfo, 
        items: selectedItems 
      });
      
      // 2. Generar mensaje de bienvenida con IA para el éxito
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Eres Midnight Corp. Genera un mensaje corto (15 palabras) de bienvenida VIP para ${customerInfo.name} que acaba de comprar tickets para ${event.title}. Usa un tono ultra exclusivo.`,
      });
      
      setAiMessage(response.text || '¡Bienvenido a la experiencia Midnight!');
      setCompletedOrder(orderData);
      setStep(3); // Salto a éxito
    } catch (error) {
      alert("Error en el proceso. Intente de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-zinc-900/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 overflow-hidden w-full max-w-md mx-auto shadow-2xl">
      <div className="p-8">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Entradas</h3>
              <TicketSelector tiers={tiers} selectedTiers={selectedTiers} onSelect={setSelectedTiers} />
              <div className="flex justify-between items-center py-4 border-t border-white/5">
                <span className="text-zinc-500 font-bold text-xs uppercase">Total a pagar</span>
                <span className="text-3xl font-black text-white">${subtotal.toLocaleString()}</span>
              </div>
              <Button onClick={() => setStep(1)} disabled={selectedItems.length === 0} fullWidth className="h-16 bg-white text-black font-black text-lg rounded-2xl">CONTINUAR</Button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <button onClick={() => setStep(0)} className="text-zinc-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase"><ChevronLeft size={16}/> Volver</button>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Tu Información</h3>
              <div className="space-y-4">
                <Input placeholder="NOMBRE COMPLETO" value={customerInfo.name} onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} className="h-14 bg-black border-white/10 text-white font-bold" />
                <Input placeholder="EMAIL DE ENVÍO" type="email" value={customerInfo.email} onChange={e => setCustomerInfo({...customerInfo, email: e.target.value})} className="h-14 bg-black border-white/10 text-white font-bold" />
              </div>
              <Button onClick={() => setStep(2)} disabled={!customerInfo.name || !customerInfo.email} fullWidth className="h-16 bg-neon-blue text-black font-black text-lg rounded-2xl">IR AL PAGO</Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                <Shield className="text-emerald-500 w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Pasarela Segura</h3>
                <p className="text-zinc-500 text-sm mt-2">Serás procesado por nuestro sistema de verificación de pagos encriptado.</p>
              </div>
              <div className="bg-black/40 p-6 rounded-3xl border border-white/5 space-y-2">
                  <div className="flex justify-between text-zinc-500 text-xs font-bold"><span>PRODUCTO</span><span>TICKETS ({selectedItems.length})</span></div>
                  <div className="flex justify-between text-white font-black text-xl pt-2 border-t border-white/5"><span>TOTAL</span><span>${subtotal.toLocaleString()}</span></div>
              </div>
              <Button onClick={handlePayment} disabled={isProcessing} fullWidth className="h-16 bg-white text-black font-black text-lg rounded-2xl">
                {isProcessing ? <Loader2 className="animate-spin" /> : "VERIFICAR Y PAGAR"}
              </Button>
            </motion.div>
          )}

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
                      <Mail size={12}/> Enviado a {customerInfo.email}
                  </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
