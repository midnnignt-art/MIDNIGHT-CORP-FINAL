import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { CheckCircle2, Sparkles, Send, Copy, Check, MessageCircle } from 'lucide-react';
import { motion as _motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { AddToCalendarButton } from '../components/AddToCalendarButton';
import { PaseBadge } from '../components/PaseBadge';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

// Lazy-load la versión Solstice para no inflar el bundle Midnight
const SolsticeSuccess = lazy(() => import('../brands/solstice/pages/SolsticeSuccess'));

const motion = _motion as any;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * SuccessPage rediseñada — "Bienvenido a la familia".
 *
 * Reemplaza la vieja pantalla genérica de "pago exitoso" por una que convierte
 * al comprador one-time en miembro:
 *   - Heading personal con nombre del cliente
 *   - QR del ticket
 *   - Add to Calendar (botón con dropdown Google/Apple/Outlook)
 *   - Toggle WhatsApp opt-in (persiste en customer_preferences)
 *   - Compartir con un amigo (referral code propio)
 *   - Sugerencia del próximo evento
 *   - Pase MIDNIGHT visible
 */
export const SuccessPage: React.FC = () => {
  // Si el usuario viene de un pago Solstice (cuota o reserva), render branded.
  // Detectamos via URL params: ?solstice=1 (genérico) o ?schedule={uuid} (cuota).
  const isSolstice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    const ref = p.get('reference') || '';
    // Wompi vuelve con ?id=...&reference=SOL-XXXX&status=APPROVED — la
    // referencia que empieza con SOL- nos dice que fue checkout Solstice.
    return p.get('solstice') === '1'
        || !!p.get('schedule')
        || !!p.get('registration')
        || ref.startsWith('SOL-');
  }, []);

  if (isSolstice) {
    return (
      <Suspense fallback={<div style={{ background: '#000', minHeight: '100vh' }} />}>
        <SolsticeSuccess />
      </Suspense>
    );
  }

  return <SuccessPageMidnight />;
};

const SuccessPageMidnight: React.FC = () => {
  const { orders, events, currentCustomer } = useStore();

  // Al volver de Wompi la URL trae ?reference=MID-XXXX. La orden puede seguir
  // 'pending' unos segundos hasta que el webhook la confirme → hacemos polling
  // directo a la BD por esa referencia y mostramos la boleta apenas quede lista.
  const [polledOrder, setPolledOrder] = useState<any | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ref = (p.get('reference') || p.get('order') || '').trim();
    if (!ref.startsWith('MID-')) return;
    let alive = true;
    let tries = 0;
    setConfirming(true);
    const tick = async () => {
      const { data } = await supabase
        .from('orders')
        .select('order_number, event_id, customer_name, customer_email, status, created_at')
        .eq('order_number', ref)
        .maybeSingle();
      if (!alive) return;
      if (data?.status === 'completed') {
        setPolledOrder({ ...data, timestamp: data.created_at });
        setConfirming(false);
        return;
      }
      if (tries++ < 25) { setTimeout(tick, 2000); }
      else setConfirming(false);
    };
    tick();
    return () => { alive = false; };
  }, []);

  // Última orden completada del cliente (asumimos que llegó acá tras pago)
  const storeOrder = useMemo(() => {
    if (!currentCustomer?.email) return null;
    const email = currentCustomer.email.toLowerCase().trim();
    return orders
      .filter(o => o.customer_email?.toLowerCase().trim() === email && o.status === 'completed')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] ?? null;
  }, [orders, currentCustomer]);

  const latestOrder = polledOrder ?? storeOrder;

  const event = useMemo(
    () => latestOrder ? events.find(e => e.id === latestOrder.event_id) : null,
    [latestOrder, events]
  );

  const nextEvent = useMemo(() => {
    const now = Date.now();
    return events
      .filter(e => e.status === 'published' && e.id !== event?.id && new Date(e.event_date).getTime() > now)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0] ?? null;
  }, [events, event?.id]);

  const customerName = currentCustomer?.user_metadata?.full_name ?? latestOrder?.customer_name ?? 'Miembro Midnight';
  const firstName = customerName.split(' ')[0];

  return (
    <div className="min-h-screen bg-void relative overflow-hidden text-moonlight">
      <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-eclipse/15 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[400px] h-[400px] bg-neon-purple/8 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12 md:py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 18 }}
            className="relative w-20 h-20 mx-auto mb-6"
          >
            <div className="absolute inset-0 bg-eclipse/50 blur-2xl rounded-full scale-110" />
            <div className="relative w-full h-full bg-eclipse rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(73,15,124,0.6)]">
              <CheckCircle2 className="w-10 h-10 text-moonlight" strokeWidth={1.5} />
            </div>
          </motion.div>

          <p className="text-[10px] font-black tracking-[0.4em] text-moonlight/40 uppercase mb-3">Bienvenido a la familia</p>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-tight">
            {firstName},<br/>tu pase MIDNIGHT está activo
          </h1>
          {event && (
            <p className="text-moonlight/50 text-sm md:text-base font-light mt-4">
              Nos vemos en <span className="text-moonlight font-bold uppercase">{event.title}</span>
            </p>
          )}
        </motion.div>

        {/* Pase MIDNIGHT */}
        {currentCustomer?.email && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6, ease: EASE_OUT }}
            className="mb-6"
          >
            <PaseBadge email={currentCustomer.email} variant="full" />
          </motion.div>
        )}

        {confirming && !latestOrder && (
          <div className="mb-6 rounded-2xl border border-moonlight/10 bg-midnight/30 p-5 text-center">
            <p className="text-[10px] font-black tracking-[0.3em] text-eclipse uppercase mb-2 animate-pulse">Confirmando tu pago…</p>
            <p className="text-moonlight/50 text-xs font-light">Esto puede tardar unos segundos. Tu entrada y el correo con el QR llegan apenas Wompi confirme.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Ticket QR */}
          {latestOrder && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6, ease: EASE_OUT }}
              className="rounded-2xl border border-moonlight/10 bg-midnight/30 p-5 md:p-6"
            >
              <p className="text-[10px] font-black tracking-[0.3em] text-moonlight/40 uppercase mb-3">Tu Entrada</p>
              <div className="aspect-square max-w-[200px] mx-auto bg-white p-3 rounded-xl mb-4">
                <img
                  src={`https://quickchart.io/qr?text=${encodeURIComponent(latestOrder.order_number)}&size=400&ecLevel=H&margin=1`}
                  alt="QR"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-center font-mono text-[10px] text-moonlight/50 tracking-[0.2em] uppercase mb-4">
                ID: {latestOrder.order_number}
              </p>
              <div className="flex justify-center">
                {event && (
                  <AddToCalendarButton
                    title={`MIDNIGHT — ${event.title}`}
                    start={event.event_date}
                    durationMinutes={6 * 60}
                    location={[event.venue, event.venue_address, event.city].filter(Boolean).join(', ')}
                    description={`Tu entrada Midnight Corp. Order: ${latestOrder.order_number}. Más info: https://midnightcorp.click/event/${event.id}`}
                    url={`https://midnightcorp.click/event/${event.id}`}
                    filename={`midnight-${event.slug || event.id}.ics`}
                  />
                )}
              </div>
            </motion.div>
          )}

          {/* Compartir + WhatsApp opt-in */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6, ease: EASE_OUT }}
            className="space-y-4"
          >
            <ShareWithFriendCard customerEmail={currentCustomer?.email} customerName={customerName} />
            <WhatsAppOptInCard email={currentCustomer?.email} phone={currentCustomer?.user_metadata?.phone} />
          </motion.div>
        </div>

        {/* Sugerencia próximo evento */}
        {nextEvent && (
          <motion.a
            href={`/event/${nextEvent.id}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6, ease: EASE_OUT }}
            className="block rounded-2xl border border-moonlight/10 bg-midnight/30 overflow-hidden mb-6 group hover:border-moonlight/25 transition-colors"
          >
            <div className="flex items-center gap-5 p-5">
              {nextEvent.cover_image && (
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden flex-shrink-0 border border-moonlight/10">
                  <img src={nextEvent.cover_image} alt={nextEvent.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" decoding="async" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black tracking-[0.3em] text-moonlight/35 uppercase mb-1">También te puede gustar</p>
                <h3 className="text-base md:text-lg font-black text-moonlight uppercase tracking-tight truncate">{nextEvent.title}</h3>
                <p className="text-[10px] text-moonlight/50 font-light uppercase tracking-[0.2em] mt-0.5">
                  {new Date(nextEvent.event_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  {nextEvent.venue ? ` · ${nextEvent.venue}` : ''}
                </p>
              </div>
              <span className="text-moonlight/30 group-hover:text-moonlight transition-colors text-xl">→</span>
            </div>
          </motion.a>
        )}

        {/* CTA back to home */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="text-center"
        >
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.4em] uppercase text-moonlight/40 hover:text-moonlight transition-colors"
          >
            ← Volver al inicio
          </a>
        </motion.div>
      </div>
    </div>
  );
};

// ── Share with friend ──────────────────────────────────────────────────────

const ShareWithFriendCard: React.FC<{ customerEmail?: string; customerName: string }> = ({ customerEmail, customerName }) => {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!customerEmail) return;
    (async () => {
      // 1. Buscar referral existente
      const { data: existing } = await supabase
        .from('customer_referrals')
        .select('code')
        .eq('email', customerEmail.toLowerCase())
        .maybeSingle();
      if (existing?.code) { setCode(existing.code); return; }

      // 2. Generar uno nuevo determinista
      const newCode = generateReferralCode(customerName);
      const { error } = await supabase.from('customer_referrals').insert({
        email: customerEmail.toLowerCase(),
        code: newCode,
        invites_count: 0,
        credit_amount: 0,
      });
      if (!error) setCode(newCode);
      else {
        // Si ya existe con otro registro (race condition), re-fetch
        const { data } = await supabase.from('customer_referrals').select('code').eq('email', customerEmail.toLowerCase()).maybeSingle();
        if (data?.code) setCode(data.code);
      }
    })();
  }, [customerEmail, customerName]);

  const link = code ? `https://midnightcorp.click/?ref=${code}` : '';

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No pudimos copiar. Selecciona el link manualmente.');
    }
  };

  const handleWhatsApp = () => {
    if (!link) return;
    const msg = `Te invito a Midnight. Si comprás con mi link, ambos ganamos crédito 🌙\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  return (
    <div className="rounded-2xl border border-eclipse/40 bg-eclipse/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-eclipse" />
        <p className="text-[10px] font-black tracking-[0.3em] text-moonlight uppercase">Invitá a un amigo</p>
      </div>
      <p className="text-xs text-moonlight/60 mb-4 leading-relaxed">
        Si tu amigo compra con tu link, vos ganás <strong className="text-moonlight">$10K en crédito</strong> y él un 10% off su primera entrada.
      </p>
      {code ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-void/60 border border-moonlight/10 rounded-xl px-3 py-2">
            <code className="flex-1 text-[11px] text-moonlight font-mono truncate">{link}</code>
            <button onClick={handleCopy} aria-label="Copiar link" className="text-moonlight/60 hover:text-moonlight transition-colors">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
          <button
            onClick={handleWhatsApp}
            className="w-full h-11 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-black text-[11px] uppercase tracking-[0.25em] rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <MessageCircle size={14} /> Compartir por WhatsApp
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-moonlight/40">Generando tu link…</p>
      )}
    </div>
  );
};

function generateReferralCode(name: string): string {
  const prefix = name.split(' ')[0]?.toUpperCase().slice(0, 4).replace(/[^A-Z]/g, '') || 'MID';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

// ── WhatsApp opt-in card ───────────────────────────────────────────────────

const WhatsAppOptInCard: React.FC<{ email?: string; phone?: string }> = ({ email, phone }) => {
  const [optin, setOptin] = useState(true);
  const [phoneInput, setPhoneInput] = useState(phone || '');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!email) return;
    const { error } = await supabase.from('customer_preferences').upsert({
      email: email.toLowerCase(),
      phone: phoneInput.trim() || null,
      whatsapp_optin: optin,
      updated_at: new Date().toISOString(),
    });
    if (!error) {
      setSaved(true);
      toast.success(optin ? 'Te avisaremos por WhatsApp' : 'Preferencias guardadas');
      setTimeout(() => setSaved(false), 2000);
    } else {
      toast.error('No pudimos guardar tus preferencias');
    }
  };

  return (
    <div className="rounded-2xl border border-moonlight/10 bg-midnight/30 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Send size={14} className="text-emerald-400" />
        <p className="text-[10px] font-black tracking-[0.3em] text-moonlight uppercase">Avisos por WhatsApp</p>
      </div>
      <label className="flex items-start gap-3 cursor-pointer mb-3">
        <input
          type="checkbox"
          checked={optin}
          onChange={e => setOptin(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-emerald-500"
        />
        <span className="text-xs text-moonlight/65 leading-relaxed">
          Recibir recordatorio 24h antes del evento + invitaciones exclusivas a los próximos drops.
        </span>
      </label>
      <input
        type="tel"
        value={phoneInput}
        onChange={e => setPhoneInput(e.target.value)}
        placeholder="+57 300 123 4567"
        aria-label="Celular WhatsApp"
        className="w-full h-10 bg-void/60 border border-moonlight/10 rounded-xl px-3 text-xs text-moonlight font-medium focus:outline-none focus:border-emerald-500/40 mb-3"
      />
      <button
        onClick={handleSave}
        className="w-full h-10 bg-moonlight text-void font-black text-[10px] uppercase tracking-[0.3em] rounded-xl hover:bg-white transition-colors disabled:opacity-50"
        disabled={!email || saved}
      >
        {saved ? '✓ Guardado' : 'Guardar'}
      </button>
    </div>
  );
};

export default SuccessPage;
