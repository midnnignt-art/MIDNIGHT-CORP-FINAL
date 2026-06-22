import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Loader2, Shield, CreditCard, CheckCircle2,
  Ship, Calendar, Repeat, ListChecks, Star, Check
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { buildWompiCheckoutUrl } from '../../../lib/wompi';
import { useStore } from '../../../context/StoreContext';
import { SOLSTICE_SEASON_MOCK, SOLSTICE_WEEKS_MOCK, SOLSTICE_DAYS, fmtCOP } from '../constants';
import { SolsticeWeek } from '../types';

const C = { bg: '#000', bgS: '#0d0d0d', red: '#E6392F', org: '#FF7A00', gray: '#606060', cream: '#F9F2D7' };

type PaymentMode = 'auto_subscription' | 'manual_monthly' | 'individual_days' | 'full_combo';
type ComboType   = 'full_combo' | 'individual_days' | 'events_pack';

// Paso 1 — combo: qué está comprando el cliente.
const COMBOS: { id: ComboType; label: string; sub: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'full_combo',      label: 'Plan Total · 5 días',   sub: 'Los 5 eventos + lancha. El mejor precio por persona.', icon: <Star size={18} />,        badge: 'Más elegido' },
  { id: 'individual_days', label: 'Arma tu propia semana', sub: 'Elegís solo los días que querés ir.',                 icon: <ListChecks size={18} /> },
];

// Paso 1.4 — forma de pago: solo aplica cuando el cliente elige combo completo.
// (Días sueltos siempre se pagan al instante por Wompi, sin cuotas posibles.)
type PaymentMethod = 'full_combo' | 'auto_subscription' | 'manual_monthly';
const PAYMENT_METHODS: { id: PaymentMethod; label: string; sub: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'full_combo',        label: 'Todo de una',           sub: 'Pagás hoy, sin cuotas, sin recargos',                  icon: <Star size={18} />,     badge: 'Mejor precio' },
  { id: 'auto_subscription', label: 'Débito automático',     sub: '$40.000 hoy + cargos automáticos cada mes',               icon: <Repeat size={18} />,   badge: 'Más fácil' },
  { id: 'manual_monthly',    label: 'Mes a mes con tarjeta', sub: '$40.000 hoy + tarjeta guardada (te avisamos 24h antes)',  icon: <Calendar size={18} /> },
];

// Tabla legacy MODES — la dejamos para compat con código downstream (resumen,
// step 4, etc) que lookup por id.
const MODES: { id: PaymentMode; label: string; sub: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'auto_subscription', label: 'Débito automático',   sub: '$40.000 hoy + cargos automáticos cada mes',         icon: <Repeat size={18} />,    badge: 'Más fácil' },
  { id: 'manual_monthly',    label: 'Mes a mes con tarjeta', sub: '$40.000 hoy + tarjeta guardada (te avisamos 24h antes)', icon: <Calendar size={18} /> },
  { id: 'individual_days',   label: 'Días sueltos prepagos', sub: 'Comprás solo los días que querés, 100% online', icon: <ListChecks size={18} /> },
  { id: 'full_combo',        label: 'Todo de una',           sub: 'Pagás hoy, sin cuotas, sin recargos',           icon: <Star size={18} />,     badge: 'Mejor precio' },
];

interface SeasonData {
  id: string;
  entry_price: number;
  combo_total: number;
  events_pack_total: number;
  boat_day_number: number;
  installments: number;
  phase1_limit: number;
}

interface Props {
  initialWeek?: string;
  initialCombo?: ComboType;
  initialInviteCode?: string;
  onBack: () => void;
}

function genOrderNumber() {
  return 'SOL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function addMonths(date: Date, n: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split('T')[0];
}

export default function SolsticeReserva({ initialWeek, initialCombo, initialInviteCode, onBack }: Props) {
  const { requestCustomerOtp, verifyOtpUnified, currentCustomer, currentUser } = useStore();

  // ── Real data from DB (falls back to mock if not yet migrated) ──
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [weeks, setWeeks]   = useState<SolsticeWeek[]>(SOLSTICE_WEEKS_MOCK);
  // Días reales de la temporada (precios configurados por el admin). Si la DB
  // está vacía, caemos a la constante SOLSTICE_DAYS.
  const [programDays, setProgramDays] = useState<Array<{ day: number; title: string; subtitle: string; price: number; highlight: boolean }>>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: seasonRow } = await supabase
          .from('solstice_seasons')
          .select('id,entry_price,combo_total,events_pack_total,boat_day_number,installments,phase1_limit')
          .eq('status', 'open')
          .single();
        if (seasonRow) setSeason(seasonRow as SeasonData);

        const { data: weekRows } = await supabase
          .from('solstice_weeks')
          .select('*')
          .order('start_date');
        if (weekRows && weekRows.length > 0) setWeeks(weekRows as SolsticeWeek[]);

        const { data: dayRows } = await supabase
          .from('solstice_program_days')
          .select('day_number, title, subtitle, price, highlight')
          .order('day_number');
        if (dayRows && dayRows.length > 0) {
          setProgramDays(dayRows.map((d: any) => ({
            day: d.day_number, title: d.title || `Día ${d.day_number}`,
            subtitle: d.subtitle || '', price: d.price || 0, highlight: !!d.highlight,
          })));
        }
      } catch {
        // DB not yet migrated — mock data stays
      }
    }
    loadData();
  }, []);

  // ── State ──
  // Invitado por link de lancha: hereda la SEMANA y la LANCHA del líder, pero SÍ
  // elige el combo → arranca en la selección de combo (1), saltando solo la
  // selección de semana (0).
  // Flujo: plan(1) → configura semana(2.7) → datos → resumen.
  //  • Con plan preelegido desde la principal (initialCombo) → directo a config (2.7).
  //  • Sin plan → arranca eligiendo plan (1).
  //  • Invitado por link → arranca en plan (1), hereda semana/lancha.
  const [step, setStep]       = useState<number>(
    initialInviteCode ? 1
      : initialCombo ? (2.7 as any)
      : 1
  );
  const [selWeek, setSelWeek] = useState<SolsticeWeek | null>(
    initialWeek ? SOLSTICE_WEEKS_MOCK.find(w => w.university === initialWeek) || null : null
  );
  const [mode, setMode]           = useState<PaymentMode | null>(
    initialCombo === 'individual_days' ? 'individual_days'
      : (initialCombo === 'full_combo' || initialCombo === 'events_pack') ? 'full_combo'
      : null
  );
  const [comboType, setComboType] = useState<ComboType | null>(initialCombo ?? null);
  const [selDays, setSelDays]     = useState<number[]>([]);
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [uni, setUni]             = useState('');
  const [cedula, setCedula]       = useState('');
  const [birthDate, setBirthDate] = useState(''); // YYYY-MM-DD
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Validadores
  const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = 'Nombre completo (mínimo 3 caracteres)';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Email inválido';
    if (!PHONE_RE.test(phone.trim())) errs.phone = 'Teléfono inválido (incluí lada)';
    if (uni.trim().length < 2) errs.uni = 'Universidad requerida';
    if (cedula.trim().length < 6) errs.cedula = 'Documento mínimo 6 dígitos';
    if (!birthDate) errs.birthDate = 'Fecha de nacimiento requerida';
    else {
      const age = (Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 16) errs.birthDate = 'Debes tener al menos 16 años';
      if (age > 80) errs.birthDate = 'Fecha de nacimiento inválida';
    }
    if (emergencyName.trim().length < 3) errs.emergencyName = 'Nombre de contacto de emergencia';
    if (!PHONE_RE.test(emergencyPhone.trim())) errs.emergencyPhone = 'Teléfono de emergencia inválido';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };
  const [otp, setOtp]             = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]     = useState('');
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [processing, setProcessing]   = useState(false);
  const [pendingOrderNum, setPendingOrderNum] = useState<string | null>(null);
  const [pendingRegId, setPendingRegId]       = useState<string | null>(null);

  // ── Lanchas ──────────────────────────────────────────────────────────────
  // El combo incluye lancha siempre que el día 3 esté incluido:
  //   - full_combo / auto_subscription / manual_monthly / cash_to_seller → siempre día 3
  //   - individual_days → solo si selDays incluye 3
  const [boats, setBoats]                       = useState<any[]>([]);
  const [selectedBoatId, setSelectedBoatId]     = useState<string | null>(null);
  // Todos son líder por default. Solo los que llegan por link de invitación
  // (initialInviteCode) entran como invitados — ese flujo se auto-valida.
  const [boatChoice, setBoatChoice]             = useState<'lead' | 'join'>(initialInviteCode ? 'join' : 'lead');
  const [joinLeaderName, setJoinLeaderName]     = useState<string | null>(null);
  const [joinValidating, setJoinValidating]     = useState(false);
  const [joinInviteCode, setJoinInviteCode]     = useState(initialInviteCode || '');
  const [joinError, setJoinError]               = useState('');
  const [boatInviteCode, setBoatInviteCode]     = useState<string | null>(null);
  const [boatReservationId, setBoatReservationId] = useState<string | null>(null);
  // Invitado: hereda la semana y el precio de la lancha del líder. Así NO elige
  // semana/combo de nuevo (evita que se una a una semana distinta a su grupo).
  const [inheritedUniversity, setInheritedUniversity] = useState<string | null>(null);
  const [inheritedWeekId, setInheritedWeekId] = useState<string | null>(null);
  const [invitePricePerPerson, setInvitePricePerPerson] = useState<number | null>(null);
  const isInvitee = boatChoice === 'join' && !!boatReservationId;
  const [payStatus, setPayStatus] = useState<'pending' | 'paid'>('pending');
  const [simulating, setSimulating] = useState(false);

  // Mapa boatId → total de pasajeros activos (suma de slots_claimed de todas
  // las reservas de esa lancha). Se hidrata al cargar + se actualiza en
  // realtime cuando alguien reserva/cancela en otra sesión.
  // Reservas crudas (con week_id) → la ocupación de cada yate se calcula POR
  // SEMANA: un yate lleno en una semana NO bloquea las otras.
  const [boatReservationsRaw, setBoatReservationsRaw] = useState<Array<{ boat_id: string; slots_claimed: number; week_id: string | null }>>([]);
  // Descripción general que el admin pone arriba de todas las lanchas.
  const [boatsIntro, setBoatsIntro] = useState<string>('');
  const [recentBoatId, setRecentBoatId]   = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadBoats() {
      try {
        const { data } = await supabase
          .from('solstice_boats')
          .select('*')
          .in('status', ['active', 'sold_out'])
          .order('sort_order', { ascending: true });
        if (data && data.length > 0 && mounted) setBoats(data);
      } catch {
        // tabla aún no migrada
      }
    }

    async function loadOccupancy() {
      try {
        const { data } = await supabase
          .from('solstice_boat_reservations')
          .select('boat_id, slots_claimed, status, week_id')
          .neq('status', 'cancelled')
          .neq('status', 'pending_payment'); // sin pagar → no ocupa cupo
        if (!data || !mounted) return;
        setBoatReservationsRaw(data as any);
      } catch {}
    }

    async function loadBoatsIntro() {
      try {
        const { data } = await supabase
          .from('solstice_config').select('value').eq('key', 'boats_intro').maybeSingle();
        if (mounted && data?.value) setBoatsIntro(typeof data.value === 'string' ? data.value : String(data.value));
      } catch {}
    }

    loadBoats();
    loadOccupancy();
    loadBoatsIntro();

    // Realtime: cuando se inserta/actualiza una reservation, refrescamos
    // ocupación y mostramos un highlight breve sobre la lancha afectada.
    const channel = supabase
      .channel('solstice-boat-reservations')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'solstice_boat_reservations' },
        (payload: any) => {
          const row = (payload.new || payload.old) as any;
          if (!row?.boat_id) return;
          loadOccupancy();
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setRecentBoatId(row.boat_id);
            setTimeout(() => setRecentBoatId(prev => (prev === row.boat_id ? null : prev)), 4000);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // When real weeks load, update the pre-selected week if we had an initialWeek
  useEffect(() => {
    if (initialWeek && weeks !== SOLSTICE_WEEKS_MOCK) {
      const found = weeks.find(w => w.university === initialWeek);
      if (found) setSelWeek(found);
    }
  }, [weeks]);

  const s       = season ?? SOLSTICE_SEASON_MOCK;

  // ── Días y combo POR SEMANA ──────────────────────────────────────────────
  // Catálogo de días con precios reales (DB del admin); si no hay, la constante.
  const daysCatalog = programDays.length > 0 ? programDays : SOLSTICE_DAYS;
  // Días activos de la semana elegida (ej. Javeriana 4 días, Los Andes 5). Si la
  // semana no tiene config, se asumen todos los del catálogo. Esto define qué
  // días aparecen en "días sueltos".
  const activeDayNums = (selWeek?.days && selWeek.days.length > 0) ? selWeek.days : daysCatalog.map(d => d.day);
  const weekDays = daysCatalog.filter(d => activeDayNums.includes(d.day));
  // El COMBO es un precio con descuento por semana (NO la suma de los días
  // sueltos, que son precios individuales). Cada semana puede tener su propio
  // precio de combo; si no, cae al de la temporada.
  const weekCombo = Number((selWeek as any)?.combo_total) || s.combo_total;
  // Pack Fiestas (events_pack) tiene su PROPIO precio (gancho más barato), aparte
  // del precio de covers del Plan Total.
  const eventsPackTotal = Number((s as any).events_pack_total) || 125000;
  // Día de la lancha/Beach Club — configurable por el admin (default día 3).
  const boatDay = Number((s as any).boat_day_number) || 3;

  // ── Modelo de precios (owner, jun 2026) ──────────────────────────────────
  //  • Combo de fiestas (full_combo) = combo_total (150k). NO incluye lancha.
  //  • Días sueltos (individual_days) = suma de días elegidos. El día 3 ya
  //    trae la lancha en su precio (130k), por eso NO se suma boatPart.
  //  • Lancha: se SUMA aparte solo en el combo (130k = price_per_person).
  //  • Ticket service = 6.6% sobre el subtotal, SUMADO al cliente.
  //  • Cuotas: solo para el combo. Días sueltos siempre se pagan de una.
  const TICKET_SERVICE_PCT = 0.066;

  // El "paquete" se define por comboType (combo de fiestas vs días sueltos),
  // independiente de la forma de pago (mode = todo de una / cuotas).
  // events_pack (Pack Fiestas) = los 5 covers SIN lancha (precio fijo de combo,
  // pero no incluye lancha → al Beach Club no se entra sin lancha; se recomienda
  // Plan Total). isCombo = precio fijo de combo (full_combo o events_pack).
  const isEventsPack = comboType === 'events_pack';
  const isCombo = comboType === 'full_combo' || comboType === 'events_pack';

  // El día 3 (Lanchas + Beach Club) trae lancha SOLO en el Plan Total (full_combo);
  // en días sueltos solo si eligieron el día 3. El Pack Fiestas NO incluye lancha.
  const includesBoat = (comboType === 'full_combo' && activeDayNums.includes(boatDay)) || (comboType === 'individual_days' && selDays.includes(boatDay));

  const selectedBoat = selectedBoatId ? boats.find(b => b.id === selectedBoatId) : null;

  // Ajuste dinámico de la lancha según el plan (owner, jun 2026):
  //   • Plan Total (combo)  → −$15.000 sobre el precio ingresado por el admin
  //   • Días sueltos        → +$15.000
  // Misma regla para las invitaciones de líderes de lancha.
  const BOAT_PLAN_ADJ = 15000;
  const adjBoatPrice = (base: number) =>
    (base > 0 ? Math.max(0, base + (isCombo ? -BOAT_PLAN_ADJ : BOAT_PLAN_ADJ)) : 0);

  // Precio "desde": la lancha más barata (para mostrar antes de que elija una).
  const cheapestBoatPrice = (() => {
    const prices = boats.map(b => b.price_per_person || 0).filter(p => p > 0);
    return prices.length ? Math.min(...prices) : 0;
  })();
  // En DÍAS SUELTOS el Día 3 (lanchas) cuesta el precio por persona de la lancha
  // ELEGIDA (cada lancha tiene su precio), no un fijo. Si aún no elige, "desde"
  // la más barata. En combo el día 3 va en el combo y la lancha se suma aparte.
  const dayTotal  = selDays.reduce((a, d) => {
    if (comboType === 'individual_days' && d === boatDay) {
      return a + adjBoatPrice(selectedBoat?.price_per_person ?? cheapestBoatPrice);
    }
    return a + (daysCatalog.find(x => x.day === d)?.price || 0);
  }, 0);

  // Ocupación de cada yate POR SEMANA: solo cuentan las reservas de la semana
  // elegida (las de otras semanas no bloquean). Las reservas sin week_id (legacy)
  // se cuentan de forma conservadora para no sobrevender.
  const boatOccupancy: Record<string, number> = (() => {
    const map: Record<string, number> = {};
    for (const r of boatReservationsRaw) {
      if (selWeek?.id && r.week_id && r.week_id !== selWeek.id) continue;
      map[r.boat_id] = (map[r.boat_id] || 0) + (r.slots_claimed || 0);
    }
    return map;
  })();

  // ¿Hay alguna lancha con cupo? Si TODAS están llenas, el cliente igual debe
  // poder avanzar al pago (el equipo le asigna lancha después) — si no, se
  // queda bloqueado y se pierde la venta.
  // Una lancha está libre (para un nuevo líder) si NO tiene ninguna reserva en la
  // semana (un solo grupo por lancha) y no está marcada como agotada.
  const anyBoatAvailable = boats.some(b => b.status !== 'sold_out' && (boatOccupancy[b.id] || 0) === 0);
  const allBoatsFull = boats.length > 0 && !anyBoatAvailable;
  // En el COMBO la lancha SÍ se suma aparte (combo $160k + lancha $130k = $290k).
  // En días sueltos la lancha se cobra como el precio del Día 3 (ver dayTotal),
  // por eso ahí boatPart no aplica.
  const boatPart  = (isCombo && includesBoat && selectedBoat)
    ? adjBoatPrice(selectedBoat.price_per_person || 0)
    : 0;

  // Descuento del vendedor: si el cliente llegó por un link /sol/p/CODE de un
  // vendedor con descuento, se aplica automáticamente al paquete.
  const sellerDiscountPct = (() => {
    try { return Number(sessionStorage.getItem('ms_seller_discount')) || 0; }
    catch { return 0; }
  })();

  // Paquete base (combo o días + lancha), luego descuento del vendedor, luego
  // ticket service 6.6% sobre lo ya descontado. El invitado sigue el mismo
  // modelo: si elige combo paga el combo + su lancha; si elige días sueltos con
  // Día 3, ese día cuesta el precio de su lancha.
  const comboBase     = isEventsPack ? eventsPackTotal : weekCombo;
  const packageBase   = (isCombo ? comboBase : dayTotal) + boatPart;
  const discountAmount = Math.round(packageBase * sellerDiscountPct / 100);
  const subtotal      = packageBase - discountAmount;
  const ticketService = Math.round(subtotal * TICKET_SERVICE_PCT);
  const grandTotal    = subtotal + ticketService;

  // ── Cuotas dinámicas según meses hasta el evento ─────────────────────────
  // Regla del owner: "si estamos a 4 meses que sea el pago inicial y tres
  // cuotas más" → installments = monthsUntilEvent - 1, cap al máximo de la
  // season. Si el evento está a menos de 2 meses, no se ofrecen cuotas
  // (el mes restante alcanza solo para el pago inicial).
  const monthsUntilEvent = (() => {
    if (!selWeek?.start_date) return s.installments;
    const start = new Date(selWeek.start_date);
    const now   = new Date();
    const months = (start.getFullYear() - now.getFullYear()) * 12
                 + (start.getMonth() - now.getMonth());
    return Math.max(1, months);
  })();
  const effectiveInstallments = Math.max(1, Math.min(s.installments, monthsUntilEvent - 1));

  // Pago de HOY:
  //  • full_combo (todo de una): el grand total con ticket service
  //  • cuotas (auto/manual): solo el adelanto (entry_price, 40k)
  //  • individual_days: el grand total (sin cuotas)
  const isInstallmentMode = mode === 'auto_subscription' || mode === 'manual_monthly';
  const chargeNow = isInstallmentMode ? s.entry_price : grandTotal;
  const chargeK   = Math.round(chargeNow / 1000);
  // Monto que se reparte en cuotas (el resto después del adelanto)
  const installmentBase = Math.max(0, grandTotal - s.entry_price);

  // Días sueltos: si el total cae por debajo de $200.000, el fraccionado deja de
  // estar disponible → forzar pago único.
  useEffect(() => {
    if (comboType === 'individual_days' && grandTotal < 200000 && (mode === 'manual_monthly' || mode === 'auto_subscription')) {
      setMode('individual_days');
    }
  }, [comboType, grandTotal, mode]);

  // Cada vez que cambia el paso, volver al tope — si no, el nuevo paso aparece
  // scrolleado abajo (quejas de "me manda abajo al pasar de paso").
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

  // Prefill auth if customer is already logged in (not staff — staff skips OTP in handleRequestOtp)
  useEffect(() => {
    if (currentCustomer && !currentUser) {
      setEmail(currentCustomer.email || '');
      const meta = currentCustomer.user_metadata || {};
      if (meta.full_name) setName(meta.full_name);
      if (meta.phone)     setPhone(meta.phone);
      if (step === 2)     setStep(3);
    }
  }, [currentCustomer]);

  const handleRequestOtp = async () => {
    // Validación completa de todos los campos antes de avanzar
    if (!validateForm()) {
      setAuthError('Revisa los campos marcados');
      return;
    }
    setAuthError('');

    // Staff testing: skip OTP so it doesn't wipe the admin session.
    // La lancha ya se eligió ANTES de los datos (nuevo orden), así que desde
    // datos vamos directo al resumen (3) — NO de vuelta a la lancha (2.7).
    if (currentUser) {
      setStep(3);
      return;
    }

    setAuthLoading(true);
    const res = await requestCustomerOtp(email, {
      full_name: name,
      phone,
      cedula,
      birth_date: birthDate,
      emergency_contact: { name: emergencyName, phone: emergencyPhone },
    });
    setAuthLoading(false);
    if (res.success) setStep(2.5 as any);
    else setAuthError(res.message || 'Error enviando código.');
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return setAuthError('Código de 6 dígitos');
    setAuthLoading(true); setAuthError('');
    const ok = await verifyOtpUnified(email, otp);
    setAuthLoading(false);
    // Tras verificar OTP → resumen. La lancha ya se eligió antes de los datos.
    if (ok) setStep(3);
    else setAuthError('Código incorrecto o expirado.');
  };

  // ── Validar invite_code y unirse a lancha existente ──────────────────────
  // Ya NO hay input manual de código — esto solo corre cuando alguien llega
  // por el link de invitación del líder (initialInviteCode). Valida y deja
  // listo el join; el usuario sigue su flujo normal (datos → pago).
  const handleValidateInviteCode = async (opts?: { advance?: boolean }) => {
    setJoinError('');
    const code = joinInviteCode.trim().toUpperCase();
    if (code.length < 4) {
      setJoinError('Código demasiado corto');
      return false;
    }
    setJoinValidating(true);
    try {
      const { data, error } = await supabase
        .from('solstice_boat_reservations')
        .select('id, boat_id, status, slots_claimed, total_capacity, leader_name, leader_registration_id')
        .ilike('invite_code', code)
        .maybeSingle();
      if (error || !data) {
        setJoinError('Link de invitación no encontrado');
        return false;
      }
      if (data.status === 'full' || data.slots_claimed >= data.total_capacity) {
        setJoinError('Esta lancha ya está llena');
        return false;
      }
      if (data.status === 'cancelled' || data.status === 'closed') {
        setJoinError('Esta reserva ya no está activa');
        return false;
      }
      // Válido → guardar para usar en handleCreateRegistration
      setBoatReservationId(data.id);
      setSelectedBoatId(data.boat_id);
      setBoatInviteCode(code);
      setJoinLeaderName(data.leader_name || null);

      // HEREDAR el contexto del líder para que el invitado NO elija semana/combo
      // de nuevo (evita el desorden de unirse a otra semana). El invitado compra
      // el cupo de ESA lancha: semana del líder, día 3, precio de la lancha.
      // La semana del líder vive en solstice_registrations, que el INVITADO
      // (anónimo) NO puede leer por RLS. Por eso usamos un RPC SECURITY DEFINER
      // que devuelve la semana del líder a partir del invite_code.
      const [boatRow, leaderInfo] = await Promise.all([
        supabase.from('solstice_boats').select('price_per_person').eq('id', data.boat_id).maybeSingle(),
        supabase.rpc('solstice_invite_leader_info', { p_invite_code: code }),
      ]);
      const info = (leaderInfo?.data as any) || {};
      const leaderWeekId = info.leader_week_id || null;
      const leaderUni = info.leader_university || null;
      if (leaderUni) setInheritedUniversity(leaderUni);
      if (leaderWeekId) setInheritedWeekId(leaderWeekId);
      // Match por week_id (robusto); si las semanas aún no cargaron, el useEffect
      // de respaldo lo fija. Fallback a universidad por las dudas.
      const w =
        (leaderWeekId ? weeks.find(x => x.id === leaderWeekId) : null) ||
        (leaderUni ? (weeks.find(x => x.university === leaderUni) || SOLSTICE_WEEKS_MOCK.find(x => x.university === leaderUni)) : null) ||
        null;
      if (w) setSelWeek(w);
      setInvitePricePerPerson(boatRow?.data?.price_per_person ?? null);
      // Pre-marcar el Día 3 (la lancha a la que lo invitaron) por defecto, pero
      // dejar que ELIJA el combo (combo completo vs días sueltos) y los días.
      setSelDays(prev => prev.includes(3) ? prev : [3]);
      // Saltar solo la selección de SEMANA → a elegir combo. La lancha ya viene
      // fija (la del líder); el resto lo elige.
      setStep(opts?.advance ? 3 : 1);
      return true;
    } catch (err: any) {
      setJoinError('Error validando el link de invitación');
      return false;
    } finally {
      setJoinValidating(false);
    }
  };

  // Auto-validar cuando se llega por link de invitación
  useEffect(() => {
    if (initialInviteCode && boatChoice === 'join' && !boatReservationId) {
      handleValidateInviteCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInviteCode]);

  // Respaldo: si la semana del líder se resolvió antes de que cargaran las
  // semanas reales, fijar selWeek apenas estén disponibles (por week_id o uni).
  useEffect(() => {
    if (!weeks.length) return;
    if (selWeek && (selWeek.id === inheritedWeekId || selWeek.university === inheritedUniversity)) return;
    const w =
      (inheritedWeekId ? weeks.find(x => x.id === inheritedWeekId) : null) ||
      (inheritedUniversity ? weeks.find(x => x.university === inheritedUniversity) : null);
    if (w) setSelWeek(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inheritedUniversity, inheritedWeekId, weeks]);

  const handleCreateRegistration = async () => {
    setProcessing(true);
    setReserveError(null);
    try {
      const orderNum = genOrderNumber();
      const today = new Date();

      const { data: seasonData } = await supabase
        .from('solstice_seasons').select('id').eq('status', 'open').single();
      const { data: weekData } = await supabase
        .from('solstice_weeks').select('id').eq('university', selWeek?.university || '').single();

      const refCode = sessionStorage.getItem('ms_ref_code');

      // Cuotas (solo en modo cuotas): reparten el RESTO (grandTotal − adelanto)
      // sobre los meses. Se mandan dentro del payload del RPC.
      const schedules = isInstallmentMode
        ? Array.from({ length: effectiveInstallments }, (_, i) => ({
            installment_number: i + 1,
            amount:             Math.round(installmentBase / effectiveInstallments),
            due_date:           addMonths(today, i + 1),
          }))
        : [];

      // La reserva se crea con un RPC SECURITY DEFINER. Esto es CRÍTICO: el
      // comprador suele ser anónimo (no lo obligamos a loguearse) y la RLS
      // bloqueaba el insert directo → la venta se perdía en silencio. El RPC
      // graba registration + cuotas + click de referido, y resuelve la
      // atribución al vendedor del lado servidor (anon no puede leer
      // solstice_sellers). Devuelve { id, order_number, seller_id }.
      const { data: rpcRes, error } = await supabase.rpc('solstice_create_reservation', {
        payload: {
          order_number:           orderNum,
          season_id:              seasonData?.id || null,
          week_id:                weekData?.id || null,
          user_id:                currentCustomer?.id || null,
          customer_name:          name,
          customer_email:         email,
          customer_phone:         phone,
          customer_university:    uni || selWeek?.university,
          payment_mode:           mode,
          // total_amount = grand total CON ticket service (lo que paga el cliente)
          total_amount:           grandTotal,
          installments_remaining: isInstallmentMode ? effectiveInstallments : 0,
          days_purchased:         comboType === 'individual_days' ? selDays : null,
          ref_code:               refCode || null,
          payment_provider:       'wompi',
          schedules,
        },
      });

      if (error) throw new Error(error.message);
      if (!rpcRes?.id) throw new Error('La reserva no devolvió un ID');
      const reg = { id: rpcRes.id as string };

      // ── Lancha: crear reservation + passenger ─────────────────────────
      if (includesBoat && selectedBoatId) {
        if (boatChoice === 'lead') {
          // Generar invite_code corto (6 chars, mayúsculas + dígitos)
          const code = Math.random().toString(36).substring(2, 8).toUpperCase();
          const boatRow = boats.find(b => b.id === selectedBoatId);
          const capacity = boatRow?.capacity || 10;

          const { data: bres, error: bresErr } = await supabase
            .from('solstice_boat_reservations')
            .insert({
              boat_id:                selectedBoatId,
              leader_registration_id: reg.id,
              leader_name:            name,
              leader_email:           email,
              invite_code:            code,
              total_capacity:         capacity,
              slots_claimed:          1,
              // 'pending_payment' = aún NO cuenta como ocupada. Un trigger la pasa
              // a 'open' cuando el registro queda pagado (status='active'). Así una
              // lancha NO aparece reservada si el cliente no pagó.
              status:                 'pending_payment',
              // La reserva pertenece a ESTA semana → la ocupación del yate se
              // cuenta por semana (un yate lleno en una semana no bloquea otras).
              week_id:                weekData?.id || null,
            })
            .select()
            .single();

          if (!bresErr && bres) {
            setBoatReservationId(bres.id);
            setBoatInviteCode(code);
            await supabase.from('solstice_boat_passengers').insert({
              boat_reservation_id: bres.id,
              registration_id:     reg.id,
              passenger_name:      name,
              passenger_email:     email,
              passenger_phone:     phone,
              is_leader:           true,
              amount_paid:         0,
            });
          }
        } else if (boatChoice === 'join' && boatReservationId) {
          // Unirse a lancha existente como invitado
          await supabase.from('solstice_boat_passengers').insert({
            boat_reservation_id: boatReservationId,
            registration_id:     reg.id,
            passenger_name:      name,
            passenger_email:     email,
            passenger_phone:     phone,
            is_leader:           false,
            amount_paid:         0,
          });
        }
      }

      setPendingOrderNum(orderNum);
      setPendingRegId(reg.id);
      setStep(4);
    } catch (err: any) {
      // CRÍTICO: si la reserva no se guardó, NO avanzamos al pago. Antes acá se
      // fingía éxito con una orden falsa y la venta se perdía en silencio (el
      // cliente podía hasta pagar sin que quedara registrado). Mostramos el
      // error y dejamos al usuario reintentar.
      console.error('Solstice: falló crear la reserva:', err?.message);
      setReserveError('No pudimos guardar tu reserva. Revisá tu conexión e intentá de nuevo en un momento.');
    } finally {
      setProcessing(false);
    }
  };

  // ── Wompi one-shot redirect ──────────────────────────────────────────────
  // Para modos full_combo + individual_days redirigimos al Web Checkout de
  // Wompi. El webhook (wompi-webhook edge function) marca la registration
  // como 'active' cuando vuelve el evento APPROVED. La URL de retorno cae
  // en /gracias?id=...&reference=...&status=APPROVED.
  const [wompiError, setWompiError] = useState<string | null>(null);
  const handleWompiCheckout = async () => {
    if (!pendingOrderNum) return;
    setSimulating(true);
    setWompiError(null);
    try {
      const url = await buildWompiCheckoutUrl({
        reference:        pendingOrderNum,
        amountCOP:        chargeNow,
        customerEmail:    email,
        customerFullName: name,
        customerPhone:    phone.replace(/[^0-9+]/g, '').replace(/^\+/, ''),
        // ?solstice=1 → la confirmación se muestra Solstice (no la de Midnight).
        // registration=<id> → SolsticeSuccess carga la orden de forma confiable
        // (Wompi no siempre devuelve el 'reference' en el redirect).
        redirectUrl:      `${window.location.origin}/gracias?solstice=1${pendingRegId ? `&registration=${pendingRegId}` : ''}`,
      });
      window.location.href = url;
    } catch (err: any) {
      setWompiError(err?.message || 'Error al iniciar Wompi');
      setSimulating(false);
    }
  };

  const handleTestPayment = async () => {
    setSimulating(true);
    try {
      if (pendingRegId) {
        await supabase
          .from('solstice_registrations')
          .update({ status: 'active', amount_paid: chargeNow })
          .eq('id', pendingRegId);

        // Disparar email de confirmación — fire-and-forget para no bloquear UI
        supabase.functions
          .invoke('send-solstice-confirmation', { body: { registration_id: pendingRegId } })
          .catch(err => console.warn('send-solstice-confirmation falló:', err?.message));
      }
      setPayStatus('paid');
      setTimeout(() => setStep(5), 1000);
    } catch (err: any) {
      console.warn('Test payment error:', err.message);
      setStep(5);
    } finally {
      setSimulating(false);
    }
  };

  // Orden simplificado (owner jun 2026, "como los mockups"):
  //   plan(1) → configura semana(2.7: universidad + días + lancha)
  //   → datos(2) → otp(2.5) → resumen+plan de pago(3) → pago(4) → confirmación(5).
  // La forma de pago (único/fraccionado) se elige DENTRO del resumen.
  const goBack = () => {
    if      (step === 5)            onBack();
    else if (step === 4)            setStep(3);
    else if (step === 3)            setStep(currentCustomer ? 2 : (2.5 as any));
    else if (step === (2.5 as any)) setStep(2);
    else if (step === 2)            setStep(2.7 as any);   // datos ← configura semana
    else if (step === (1.4 as any)) setStep(2.7 as any);  // legacy
    else if (step === (2.7 as any)) setStep(1);           // configura ← plan
    else if (step === (1.5 as any)) setStep(1);           // legacy
    // El invitado heredó la semana: desde plan (1) "atrás" sale de la reserva.
    else if (step === 1)            onBack();
    else                            onBack();
  };

  const stepLabel = step === (2.7 as any)
    ? 'Configura tu semana'
    : step === (1.4 as any)
      ? 'Forma de pago'
      : step === (1.5 as any)
        ? 'Días'
        : ['Plan', 'Plan', 'Tus datos', 'Resumen', 'Pago', '✓'][Math.min(Math.floor(step), 5)];
  const stepNum   = Math.min(Math.floor(step), 5);

  // Shared style helpers
  const inputStyle: React.CSSProperties = {
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '0.5px solid rgba(255,255,255,0.10)',
    color: C.cream,
    padding: '16px 18px',
    letterSpacing: '0.15em',
    width: '100%',
    outline: 'none',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    transition: 'border-color 0.2s ease',
  };

  const primaryBtnStyle: React.CSSProperties = {
    borderRadius: '999px',
    background: 'rgba(230,57,47,0.22)',
    border: '0.5px solid rgba(230,57,47,0.45)',
    color: C.cream,
    letterSpacing: '0.2em',
    width: '100%',
    padding: '16px',
    fontSize: '14px',
    textTransform: 'uppercase' as const,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>

      {/* Progress header — sticky en top:0 con fondo opaco ALTO: el padding-top
          empuja su texto debajo del logo MIDNIGHT (fixed ~2.5rem) y el fondo negro
          tapa cualquier contenido que suba al hacer scroll (antes se cruzaba). */}
      <div className="sticky top-0 z-[60] px-6 pb-4 flex items-center gap-4"
        style={{ paddingTop: 'calc(4.25rem + env(safe-area-inset-top, 0px))', background: C.bg, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        {step > 0 && step < 5 && (
          <button onClick={goBack} className="p-2 rounded-full transition-colors" style={{ color: C.gray }}
            onMouseEnter={e => (e.currentTarget.style.color = C.cream)} onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="flex-1">
          <p className="text-[9px] uppercase" style={{ color: C.red, letterSpacing: '0.4em', fontWeight: 500 }}>
            Reserva SOLSTICE 2026
          </p>
          <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>{stepLabel}</p>
        </div>
        <div className="flex gap-1.5">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{ background: i <= stepNum ? C.red : `${C.gray}40` }} />
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 pb-24">
        <AnimatePresence mode="wait">

          {/* STEP 0 — Selección de semana */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                {comboType && (
                  <p className="text-[10px] uppercase mb-2 inline-flex items-center gap-2 px-3 py-1.5" style={{ letterSpacing: '0.25em', color: C.red, fontWeight: 600, background: 'rgba(230,57,47,0.10)', border: '0.5px solid rgba(230,57,47,0.4)', borderRadius: '999px' }}>
                    {comboType === 'full_combo' ? 'Plan Total · 5 días' : comboType === 'events_pack' ? 'Pack Fiestas · 5 eventos' : 'Arma tu propia semana'}
                  </p>
                )}
                <h2 className="text-3xl uppercase mb-2" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>¿Cuál semana?</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Selecciona tu universidad y fecha</p>
              </div>
              <div className="space-y-4">
                {weeks.map(week => {
                  // Blindar contra NaN: capacity/reserved pueden venir null o como
                  // string desde la BD → "NaN cupos disponibles" en pantalla.
                  const cap  = Number(week.capacity) || 0;
                  const res  = Number(week.reserved) || 0;
                  const pct  = cap > 0 ? Math.min(100, (res / cap) * 100) : 0;
                  const left = Math.max(0, cap - res);
                  const hasCap = cap > 0;
                  return (
                    <button key={week.id} onClick={() => {
                        setSelWeek(week);
                        // Si ya eligió plan en la principal, saltamos el paso de combo.
                        if (comboType === 'individual_days') { setMode('individual_days'); setStep(1.5 as any); }
                        else if (comboType === 'full_combo') { if (mode === 'individual_days') setMode(null); setStep(2.7 as any); }
                        else setStep(1);
                      }}
                      className="w-full p-4 flex items-center justify-between gap-3 text-left"
                      style={{
                        borderRadius: '16px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = '0.5px solid rgba(230,57,47,0.40)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = '0.5px solid rgba(255,255,255,0.10)'; }}
                    >
                      <div className="min-w-0">
                        <h3 className="text-base md:text-lg uppercase truncate" style={{ fontFamily: "'Poiret One', sans-serif", fontWeight: 300, letterSpacing: '0.04em' }}>{week.university}</h3>
                        <p className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.12em', fontWeight: 500 }}>
                          {new Date(week.start_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })} — {new Date(week.end_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[9px] uppercase text-right" style={{ color: hasCap && left <= 20 ? C.red : C.gray, letterSpacing: '0.1em', fontWeight: 500 }}>
                          {!hasCap ? 'Disponible' : left <= 20 ? `¡Solo ${left}!` : `${left} cupos`}
                        </span>
                        <ChevronRight size={16} style={{ color: C.gray }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 1 — Combo: qué quiere comprar (full combo vs días sueltos) ──
              Owner pidió separar la elección del combo de la forma de pago.
              El cliente primero elige QUÉ compra, y después CÓMO paga. */}
          {step === 1 && (() => {
            const entryK = Math.round((season?.entry_price ?? 40000) / 1000);
            // Plan Total "desde" = covers + lancha más barata con descuento (−15k).
            const planTotalFrom = weekCombo + (cheapestBoatPrice > 0 ? Math.max(0, cheapestBoatPrice - BOAT_PLAN_ADJ) : 0);
            const dayFrom = (() => {
              const ps = weekDays.map(d => d.day === boatDay ? (cheapestBoatPrice + BOAT_PLAN_ADJ) : d.price).filter(p => p > 0);
              return ps.length ? Math.min(...ps) : 0;
            })();
            const comboMeta: Partial<Record<ComboType, { headline: string; bigPrice: string; afterPrice?: string; tags: string[] }>> = {
              full_combo: {
                headline: '5 días con todo incluido — lancha, fiestas, beach club',
                bigPrice: `Desde ${fmtCOP(planTotalFrom)}`,
                afterPrice: ' · por persona',
                tags: [`Reservás con ${fmtCOP(entryK * 1000)}`, 'Después: cuotas o pago de una', 'Mejor precio por día'],
              },
              individual_days: {
                headline: 'Elegís solo los días que querés ir, sin compromiso de combo',
                bigPrice: `Desde ${fmtCOP(dayFrom)}`,
                afterPrice: ' /día',
                tags: ['Sin reserva mínima', 'Pagás solo lo que elegís', 'Cada día con su QR'],
              },
            };

            return (
              <motion.div key="s1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 pb-32">
                <div>
                  <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
                    Paso 2 · ¿Qué querés comprar?
                  </p>
                  <h2 className="text-3xl md:text-4xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
                    Elegí tu combo
                  </h2>
                  <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>
                    Semana {selWeek?.university} · Después elegís cómo pagar
                  </p>
                </div>

                <div className="space-y-3">
                  {COMBOS.map(c => {
                    const sel = comboType === c.id;
                    const data = comboMeta[c.id]!;  // COMBOS solo trae full_combo / individual_days
                    return (
                      <motion.button
                        key={c.id}
                        whileTap={{ scale: 0.995 }}
                        onClick={() => setComboType(c.id)}
                        className="w-full p-5 text-left relative overflow-hidden block group"
                        style={{
                          borderRadius: '20px',
                          background: sel ? 'rgba(230,57,47,0.10)' : 'rgba(255,255,255,0.035)',
                          backdropFilter: 'blur(32px) saturate(180%)',
                          border: sel ? '0.5px solid rgba(230,57,47,0.55)' : '0.5px solid rgba(255,255,255,0.10)',
                          boxShadow: sel ? '0 24px 50px rgba(230,57,47,0.15)' : '0 16px 36px rgba(0,0,0,0.25)',
                          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        {c.badge && (
                          <div className="absolute top-3 right-3 px-2.5 py-1 text-[8px] uppercase flex items-center gap-1"
                            style={{ background: C.red, color: C.cream, letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 600 }}>
                            <span style={{ width: 5, height: 5, borderRadius: 999, background: '#fff', animation: 'pulse 2s ease-in-out infinite' }} />
                            {c.badge}
                          </div>
                        )}

                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                            style={{ background: sel ? C.red : `${C.red}15`, color: sel ? C.cream : C.red, transition: 'all 0.3s ease' }}>
                            {c.icon}
                          </div>
                          <div className="flex-1 min-w-0 pr-16">
                            <p className="text-sm md:text-base uppercase" style={{ letterSpacing: '0.08em', fontWeight: 600, color: C.cream }}>
                              {c.label}
                            </p>
                            <p className="text-[10px] md:text-[11px] mt-1" style={{ color: C.gray, letterSpacing: '0.05em' }}>
                              {data.headline}
                            </p>

                            <div className="flex items-baseline gap-1 mt-3">
                              <span className="text-2xl md:text-3xl tabular-nums" style={{ fontFamily: "'Poiret One', sans-serif", color: sel ? C.red : C.cream, fontWeight: 300, letterSpacing: '-0.02em' }}>
                                {data.bigPrice}
                              </span>
                              {data.afterPrice && (
                                <span className="text-[10px] md:text-xs" style={{ color: C.gray, fontWeight: 500 }}>
                                  {data.afterPrice}
                                </span>
                              )}
                            </div>

                            <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                              {data.tags.map((t, i) => (
                                <li key={i} className="text-[9px] uppercase" style={{ color: `${C.gray}cc`, letterSpacing: '0.15em', fontWeight: 500 }}>
                                  · {t}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Sticky CTA — habilitado cuando hay combo elegido */}
                {comboType && step === 1 && (
                  <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="fixed bottom-0 inset-x-0 z-30 px-4 pb-5 pt-4"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.85) 70%, transparent 100%)', backdropFilter: 'blur(20px)' }}
                  >
                    <div className="max-w-2xl mx-auto flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] uppercase" style={{ letterSpacing: '0.3em', color: C.gray, fontWeight: 500 }}>
                          Combo elegido
                        </p>
                        <p className="text-base md:text-lg uppercase" style={{ color: C.cream, fontWeight: 500, letterSpacing: '0.05em' }}>
                          {COMBOS.find(c => c.id === comboType)?.label}
                        </p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          // Modo por defecto según el plan; la forma de pago
                          // (único/fraccionado) se confirma en el resumen.
                          setMode(comboType === 'individual_days' ? 'individual_days' : 'full_combo');
                          setStep(2.7 as any); // → configura tu semana (universidad + días + lancha)
                        }}
                        className="flex-shrink-0 px-7 py-4 text-sm uppercase flex items-center gap-3"
                        style={{ background: C.red, color: '#fff', letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 600, boxShadow: '0 12px 32px rgba(230,57,47,0.45)' }}
                      >
                        Configurar semana
                        <ChevronRight size={16} />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })()}

          {/* STEP 1.4 — Forma de pago (solo si eligió combo completo) ─────────
              Aquí van las 3 opciones de timing de pago: todo de una, débito
              automático, mes a mes con tarjeta. Individual_days nunca llega
              acá porque cada día es one-shot. */}
          {step === (1.4 as any) && comboType === 'full_combo' && (() => {
            const entryK = Math.round((season?.entry_price ?? 40000) / 1000);
            // Total con lancha + ticket service 6.6% (lo que realmente paga)
            const totalK = Math.round(grandTotal / 1000);
            const cuotas = effectiveInstallments;
            const cuotaK = Math.round(installmentBase / cuotas / 1000);
            // Nombre del mes para el timeline de cuotas (mes actual + i).
            const monthName = (i: number) => {
              const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i);
              const s = d.toLocaleDateString('es-CO', { month: 'long' });
              return s.charAt(0).toUpperCase() + s.slice(1);
            };
            const meta: Record<PaymentMethod, {
              headline: string;
              bigPrice: string;
              afterPrice?: string;
              ahorro?: string;
              tags?: string[];
              cobro: string;
              respaldo: string;
            }> = {
              auto_subscription: {
                headline: `${fmtCOP(entryK * 1000)} hoy + ${cuotas} cuotas de ${fmtCOP(cuotaK * 1000)}`,
                bigPrice: `${fmtCOP(cuotaK * 1000)}`,
                afterPrice: `/mes · ${cuotas}× automático`,
                tags: ['Cero olvidos', 'Sin recargos por mora'],
                cobro:    `Hoy pagás ${fmtCOP(entryK * 1000)} por Wompi. Las ${cuotas} cuotas de ${fmtCOP(cuotaK * 1000)} se cobran cada mes.`,
                respaldo: 'Si la tarjeta no tiene fondos, 7 días de gracia. Devolución del adelanto solo dentro de los primeros 15 días desde la compra.',
              },
              manual_monthly: {
                headline: `${fmtCOP(entryK * 1000)} hoy + tarjeta guardada`,
                bigPrice: `${fmtCOP(cuotaK * 1000)}`,
                afterPrice: `/mes · aviso 24h antes`,
                tags: ['Avisamos por WhatsApp', 'Movés la fecha 1× si necesitás'],
                cobro:    `Hoy pagás ${fmtCOP(entryK * 1000)} por Wompi. Te avisamos 24h antes de cada cuota de ${fmtCOP(cuotaK * 1000)}.`,
                respaldo: 'Podés posponer 1 cuota hasta 7 días sin costo. Devolución del adelanto solo dentro de los primeros 15 días desde la compra.',
              },
              full_combo: {
                headline: `Pagás hoy y te olvidás`,
                bigPrice: `${fmtCOP(totalK * 1000)}`,
                afterPrice: ` total`,
                tags: ['Sin pagos pendientes', 'Una sola transacción'],
                cobro:    `1 sola transacción por Wompi con tu tarjeta o transferencia. Quedás cerrado en minutos.`,
                respaldo: 'Tenés 15 días desde la compra para arrepentirte y recibir devolución completa. Después de 15 días: no reembolsable.',
              },
            };
            const recommended: PaymentMethod = 'auto_subscription';

            return (
              <motion.div key="s1.4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 pb-32">
                <div>
                  <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
                    Paso 3 · Forma de pago
                  </p>
                  <h2 className="text-3xl md:text-4xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
                    ¿Cómo te queda mejor pagar?
                  </h2>
                  <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>
                    Combo completo · Reserva hoy con <strong style={{ color: C.red }}>{fmtCOP(entryK * 1000)}</strong> y elige cómo seguir
                  </p>
                </div>

                <div className="space-y-3">
                  {PAYMENT_METHODS.map(m => {
                    const sel = mode === m.id;
                    const isRec = m.id === recommended;
                    const isBestPrice = m.id === 'full_combo';
                    const data = meta[m.id];
                    return (
                      <motion.button
                        key={m.id}
                        whileTap={{ scale: 0.995 }}
                        onClick={() => setMode(m.id)}
                        className="w-full p-5 text-left relative overflow-hidden block group"
                        style={{
                          borderRadius: '20px',
                          background: sel ? 'rgba(230,57,47,0.10)' : 'rgba(255,255,255,0.035)',
                          backdropFilter: 'blur(32px) saturate(180%)',
                          border: sel ? '0.5px solid rgba(230,57,47,0.55)' : '0.5px solid rgba(255,255,255,0.10)',
                          boxShadow: sel ? '0 24px 50px rgba(230,57,47,0.15)' : '0 16px 36px rgba(0,0,0,0.25)',
                          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        {/* Badges */}
                        {isRec && (
                          <div className="absolute top-3 right-3 px-2.5 py-1 text-[8px] uppercase flex items-center gap-1"
                            style={{ background: C.red, color: C.cream, letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 600 }}>
                            <span style={{ width: 5, height: 5, borderRadius: 999, background: '#fff', animation: 'pulse 2s ease-in-out infinite' }} />
                            Más popular
                          </div>
                        )}
                        {isBestPrice && (
                          <div className="absolute top-3 right-3 px-2.5 py-1 text-[8px] uppercase"
                            style={{ background: '#F9F2D7', color: '#0a0a0a', letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 700 }}>
                            Mejor precio
                          </div>
                        )}

                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                            style={{
                              background: sel ? C.red : `${C.red}15`,
                              color: sel ? C.cream : C.red,
                              transition: 'all 0.3s ease',
                            }}>
                            {m.icon}
                          </div>
                          <div className="flex-1 min-w-0 pr-16">
                            <p className="text-sm md:text-base uppercase" style={{ letterSpacing: '0.08em', fontWeight: 600, color: C.cream }}>
                              {m.label}
                            </p>
                            <p className="text-[10px] md:text-[11px] mt-1" style={{ color: C.gray, letterSpacing: '0.05em' }}>
                              {data.headline}
                            </p>

                            <div className="flex items-baseline gap-1 mt-3">
                              <span className="text-2xl md:text-3xl tabular-nums" style={{ fontFamily: "'Poiret One', sans-serif", color: sel ? C.red : C.cream, fontWeight: 300, letterSpacing: '-0.02em' }}>
                                {data.bigPrice}
                              </span>
                              {data.afterPrice && (
                                <span className="text-[10px] md:text-xs" style={{ color: C.gray, fontWeight: 500 }}>
                                  {data.afterPrice}
                                </span>
                              )}
                            </div>

                            {data.ahorro && (
                              <p className="text-[10px] uppercase mt-1.5" style={{ color: '#9be15d', letterSpacing: '0.15em', fontWeight: 600 }}>
                                ✦ {data.ahorro}
                              </p>
                            )}

                            {data.tags && data.tags.length > 0 && (
                              <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                                {data.tags.map((t, i) => (
                                  <li key={i} className="text-[9px] uppercase" style={{ color: `${C.gray}cc`, letterSpacing: '0.15em', fontWeight: 500 }}>
                                    · {t}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {/* Bloque revelado al seleccionar: cómo se cobra + garantía */}
                        {sel && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden mt-4"
                          >
                            <div className="pt-4 border-t" style={{ borderColor: 'rgba(230,57,47,0.25)' }}>
                              {(m.id === 'auto_subscription' || m.id === 'manual_monthly') ? (
                                <>
                                  <p className="text-[9px] uppercase mb-3" style={{ color: C.red, letterSpacing: '0.25em', fontWeight: 600 }}>
                                    Tu plan de pago
                                  </p>
                                  <div className="space-y-2.5">
                                    {[{ label: 'Hoy', note: 'Reserva', amount: entryK },
                                      ...Array.from({ length: cuotas }, (_, i) => ({ label: monthName(i + 1), note: '', amount: cuotaK }))
                                    ].map((row, i) => (
                                      <div key={i} className="flex items-center gap-3">
                                        <span className="flex-shrink-0 rounded-full" style={{ width: 7, height: 7, background: i === 0 ? C.red : `${C.red}55` }} />
                                        <span className="text-[11px] uppercase flex-1" style={{ color: i === 0 ? C.cream : `${C.cream}cc`, letterSpacing: '0.1em', fontWeight: 500 }}>
                                          {row.label}{row.note ? ` · ${row.note}` : ''}
                                        </span>
                                        <span className="text-sm tabular-nums" style={{ color: i === 0 ? C.red : C.cream, fontWeight: 600 }}>
                                          {fmtCOP(row.amount * 1000)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-[10px] leading-relaxed mt-3" style={{ color: `${C.gray}dd` }}>
                                    {m.id === 'auto_subscription'
                                      ? 'Se cobra solo cada mes con tu tarjeta. Te avisamos antes.'
                                      : 'Te avisamos por WhatsApp 24h antes de cada cuota. Movés la fecha 1× si necesitás.'}
                                  </p>
                                </>
                              ) : (
                                <p className="text-[11px] leading-relaxed" style={{ color: C.cream, fontWeight: 400 }}>
                                  {data.cobro}
                                </p>
                              )}
                              <p className="text-[10px] leading-relaxed mt-3" style={{ color: `${C.gray}aa` }}>
                                {data.respaldo}
                              </p>
                            </div>
                          </motion.div>
                        )}

                        {/* Indicador de selección — glow estático (sin layoutId
                            para evitar layout-animations que parpadean al hacer
                            scroll en iOS) */}
                        {sel && (
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              borderRadius: '20px',
                              boxShadow: 'inset 0 0 60px rgba(230,57,47,0.18)',
                            }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* ── Cómo garantizamos tu lugar ── */}
                <div
                  className="p-5 md:p-6 mt-2"
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                    borderRadius: '20px',
                  }}
                >
                  <p className="text-[10px] uppercase mb-4" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
                    Cómo aseguramos tu lugar
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <GarantiaItem step="1" title="Pago seguro" desc={`Tu ${fmtCOP(entryK * 1000)} se cobra por Wompi. El cupo queda bloqueado apenas aprueba.`} />
                    <GarantiaItem step="2" title="Sin sorpresas" desc="Ves tu plan de pago completo antes de confirmar. Vos elegís cómo pagar." />
                    <GarantiaItem step="3" title="Te avisamos" desc="Recordatorio por WhatsApp antes de cada cuota. 7 días de gracia si hace falta." />
                  </ul>
                </div>

                {/* Trust strip */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2">
                  <span className="text-[9px] uppercase" style={{ color: `${C.gray}cc`, letterSpacing: '0.2em', fontWeight: 500 }}>
                    🔒 Pago seguro · Wompi
                  </span>
                  <span style={{ color: `${C.gray}40` }}>·</span>
                  <span className="text-[9px] uppercase" style={{ color: `${C.gray}cc`, letterSpacing: '0.2em', fontWeight: 500 }}>
                    Sin recargo de cuotas
                  </span>
                  <span style={{ color: `${C.gray}40` }}>·</span>
                  <span className="text-[9px] uppercase" style={{ color: `${C.gray}cc`, letterSpacing: '0.2em', fontWeight: 500 }}>
                    15 días para arrepentirte
                  </span>
                </div>

                {/* Sticky CTA bottom — solo en step 1.4 (forma de pago) */}
                {mode && step === (1.4 as any) && (
                  <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="fixed bottom-0 inset-x-0 z-30 px-4 pb-5 pt-4"
                    style={{
                      background: 'linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.85) 70%, transparent 100%)',
                      backdropFilter: 'blur(20px)',
                    }}
                  >
                    <div className="max-w-2xl mx-auto flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] uppercase" style={{ letterSpacing: '0.3em', color: C.gray, fontWeight: 500 }}>
                          {mode === 'full_combo' ? 'Pagás hoy' : 'Reservás hoy con'}
                        </p>
                        <p className="text-xl md:text-2xl tabular-nums" style={{ fontFamily: "'Poiret One', sans-serif", color: C.cream, fontWeight: 300 }}>
                          {fmtCOP(chargeNow)} <span className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>COP</span>
                        </p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setStep(2)}
                        className="flex-shrink-0 px-7 py-4 text-sm uppercase flex items-center gap-3"
                        style={{
                          background: C.red,
                          color: '#fff',
                          letterSpacing: '0.2em',
                          borderRadius: '999px',
                          fontWeight: 600,
                          boxShadow: '0 12px 32px rgba(230,57,47,0.45)',
                        }}
                      >
                        Continuar
                        <ChevronRight size={16} />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })()}

          {/* STEP 1.5 — Días sueltos */}
          {step === (1.5 as any) && (
            <motion.div key="s1.5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-3xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>¿Qué días?</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Selecciona uno o más</p>
              </div>
              <div className="space-y-3">
                {weekDays.map(day => {
                  const selected = selDays.includes(day.day);
                  return (
                    <button key={day.day}
                      onClick={() => setSelDays(prev => selected ? prev.filter(d => d !== day.day) : [...prev, day.day])}
                      className="w-full p-5 flex items-center gap-4"
                      style={{
                        borderRadius: '20px',
                        background: selected ? 'rgba(230,57,47,0.08)' : 'rgba(255,255,255,0.04)',
                        backdropFilter: 'blur(32px) saturate(180%)',
                        border: selected ? '0.5px solid rgba(230,57,47,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 flex-shrink-0"
                        style={selected ? { background: C.red, borderColor: C.red } : { borderColor: `${C.gray}50` }}>
                        {day.highlight
                          ? <Ship size={16} style={{ color: selected ? C.cream : C.gray }} />
                          : <span className="text-xs" style={{ color: selected ? C.cream : C.gray }}>{day.day}</span>}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm uppercase" style={{ color: day.highlight ? C.red : C.cream, letterSpacing: '0.1em', fontWeight: 500 }}>{day.title}</p>
                        <p className="text-[10px]" style={{ color: C.gray }}>{day.subtitle}</p>
                      </div>
                      <p className="text-sm" style={{ color: selected ? C.red : C.gray, fontWeight: 500 }}>
                        {day.day === boatDay
                          ? `desde ${fmtCOP((cheapestBoatPrice || day.price))}`
                          : `${fmtCOP(day.price)}`}
                      </p>
                    </button>
                  );
                })}
              </div>
              {selDays.length > 0 && (
                <div className="p-5" style={{
                  borderRadius: '28px',
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(24px)',
                  border: '0.5px solid rgba(230,57,47,0.50)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                }}>
                  <div className="flex justify-between text-xs uppercase mb-1" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                    <span>Tu selección ({selDays.length} días)</span><span>{fmtCOP(dayTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                    <span>Combo completo</span><span>{fmtCOP(weekCombo)}</span>
                  </div>
                  {dayTotal > weekCombo && (
                    <p className="text-[9px] mt-2 uppercase text-center" style={{ color: C.red }}>
                      El combo sale más barato — considera cambiarlo
                    </p>
                  )}
                </div>
              )}
              <button
                onClick={() => setStep(includesBoat ? (2.7 as any) : 2)}
                disabled={selDays.length === 0}
                style={{
                  ...primaryBtnStyle,
                  opacity: selDays.length === 0 ? 0.35 : 1,
                }}
                onMouseEnter={e => {
                  if (selDays.length > 0) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(230,57,47,0.20)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                Continuar
              </button>
            </motion.div>
          )}

          {/* STEP 2 — Datos personales */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
                  Paso 3 · Tus datos
                </p>
                <h2 className="text-3xl md:text-4xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
                  Quién eres
                </h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>
                  Lo necesitamos para tu QR de acceso y tu pase Solstice
                </p>
              </div>

              {/* Datos personales */}
              <FieldGroup title="Identidad">
                <SolField
                  label="Nombre completo"
                  value={name}
                  onChange={v => { setName(v); if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' }); }}
                  error={fieldErrors.name}
                  type="text"
                  autoComplete="name"
                  placeholder="Como aparece en tu cédula"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SolField
                    label="Documento / Cédula"
                    value={cedula}
                    onChange={v => { setCedula(v.replace(/\D/g, '')); if (fieldErrors.cedula) setFieldErrors({ ...fieldErrors, cedula: '' }); }}
                    error={fieldErrors.cedula}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="1234567890"
                  />
                  <SolField
                    label="Fecha de nacimiento"
                    value={birthDate}
                    onChange={v => { setBirthDate(v); if (fieldErrors.birthDate) setFieldErrors({ ...fieldErrors, birthDate: '' }); }}
                    error={fieldErrors.birthDate}
                    type="date"
                    autoComplete="bday"
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </FieldGroup>

              <FieldGroup title="Contacto">
                <SolField
                  label="Correo electrónico"
                  value={email}
                  onChange={v => { setEmail(v.toLowerCase()); if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' }); }}
                  error={fieldErrors.email}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                />
                <SolField
                  label="Teléfono / WhatsApp"
                  value={phone}
                  onChange={v => { setPhone(v); if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: '' }); }}
                  error={fieldErrors.phone}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+57 300 123 4567"
                />
                <SolField
                  label="Universidad"
                  value={uni}
                  onChange={v => { setUni(v); if (fieldErrors.uni) setFieldErrors({ ...fieldErrors, uni: '' }); }}
                  error={fieldErrors.uni}
                  type="text"
                  autoComplete="organization"
                  placeholder="Javeriana, Andes, CESA, etc."
                />
              </FieldGroup>

              <FieldGroup title="Contacto de emergencia" hint="Para emergencias durante la semana. No los molestaremos por nada más.">
                <SolField
                  label="Nombre del contacto"
                  value={emergencyName}
                  onChange={v => { setEmergencyName(v); if (fieldErrors.emergencyName) setFieldErrors({ ...fieldErrors, emergencyName: '' }); }}
                  error={fieldErrors.emergencyName}
                  type="text"
                  placeholder="Papá / Mamá / Pareja / Mejor amig@"
                />
                <SolField
                  label="Teléfono del contacto"
                  value={emergencyPhone}
                  onChange={v => { setEmergencyPhone(v); if (fieldErrors.emergencyPhone) setFieldErrors({ ...fieldErrors, emergencyPhone: '' }); }}
                  error={fieldErrors.emergencyPhone}
                  type="tel"
                  inputMode="tel"
                  placeholder="+57 300 123 4567"
                />
              </FieldGroup>

              {authError && (
                <p className="text-xs uppercase text-center py-2" style={{ color: C.red, letterSpacing: '0.15em', fontWeight: 500 }}>
                  {authError}
                </p>
              )}

              <button onClick={handleRequestOtp} disabled={authLoading}
                style={{
                  ...primaryBtnStyle,
                  padding: '18px 16px',
                  opacity: authLoading ? 0.35 : 1,
                }}
                onMouseEnter={e => {
                  if (!authLoading) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 28px rgba(230,57,47,0.30)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                {authLoading ? <Loader2 className="animate-spin" /> : <>Continuar al pago <ChevronRight size={16} /></>}
              </button>

              <p className="text-[9px] uppercase text-center" style={{ color: `${C.gray}aa`, letterSpacing: '0.25em', fontWeight: 500 }}>
                🔒 Datos cifrados · Solo Solstice los ve
              </p>
            </motion.div>
          )}

          {/* STEP 2.5 — OTP */}
          {step === (2.5 as any) && (
            <motion.div key="s2.5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8 text-center">
              <div>
                <h2 className="text-3xl uppercase mb-2" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>Verifica tu email</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Código enviado a {email}</p>
              </div>
              <input autoFocus placeholder="000000" value={otp} maxLength={6}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setAuthError(''); }}
                style={{
                  ...inputStyle,
                  padding: '24px 18px',
                  textAlign: 'center',
                  fontSize: '36px',
                  fontWeight: 500,
                  letterSpacing: '0.5em',
                  textTransform: 'none' as const,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(230,57,47,0.60)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              {authError && <p className="text-xs uppercase" style={{ color: C.red, fontWeight: 500 }}>{authError}</p>}
              <button onClick={handleVerifyOtp} disabled={otp.length < 6 || authLoading}
                style={{
                  ...primaryBtnStyle,
                  opacity: (otp.length < 6 || authLoading) ? 0.35 : 1,
                }}
                onMouseEnter={e => {
                  if (otp.length >= 6 && !authLoading) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(230,57,47,0.20)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                {authLoading ? <Loader2 className="animate-spin" /> : 'Verificar'}
              </button>
            </motion.div>
          )}

          {/* STEP 2.7 — Escoge tu lancha (líder elige; invitado llega por link) */}
          {step === (2.7 as any) && (
            <motion.div key="s2.7" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
                  Paso 2 · {boatChoice === 'join' ? 'Confirmá tu lancha' : `Configura tu ${isEventsPack ? 'pack fiestas' : isCombo ? 'plan total' : 'semana'}`}
                </p>
                <h2 className="text-3xl md:text-4xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
                  {boatChoice === 'join' ? 'Te unís a una lancha' : 'Configura tu semana'}
                </h2>
                {/* Chip de estado — qué falta configurar (universidad · lancha) */}
                {boatChoice === 'lead' ? (
                  <div className="mt-3 inline-flex flex-wrap items-center gap-3 px-3.5 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)', borderRadius: '12px' }}>
                    <span className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.18em', fontWeight: 600 }}>Configurando:</span>
                    <span className="text-[9px] uppercase flex items-center gap-1.5" style={{ color: selWeek ? C.red : C.gray, letterSpacing: '0.1em', fontWeight: 600 }}>
                      {selWeek ? <Check size={11} /> : <span style={{ width: 5, height: 5, borderRadius: 999, border: `1px solid ${C.gray}` }} />} Universidad
                    </span>
                    <span className="text-[9px] uppercase flex items-center gap-1.5" style={{ color: selectedBoatId ? C.red : C.gray, letterSpacing: '0.1em', fontWeight: 600 }}>
                      {selectedBoatId ? <Check size={11} /> : <span style={{ width: 5, height: 5, borderRadius: 999, border: `1px solid ${C.gray}` }} />} Lancha
                    </span>
                  </div>
                ) : (
                  <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>
                    Llegaste por un link de invitación · ya quedás en esa lancha
                  </p>
                )}
              </div>


              {/* Invitado por link: card de confirmación (sin selección manual) */}
              {boatChoice === 'join' && (
                <div className="space-y-3">
                  {joinValidating ? (
                    <div className="p-6 text-center" style={{ borderRadius: '20px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                      <Loader2 className="animate-spin mx-auto mb-2" size={20} style={{ color: C.red }} />
                      <p className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>Validando invitación…</p>
                    </div>
                  ) : joinError ? (
                    <div className="p-6 text-center" style={{ borderRadius: '20px', background: 'rgba(230,57,47,0.08)', border: '0.5px solid rgba(230,57,47,0.30)' }}>
                      <p className="text-xs uppercase" style={{ color: C.red, letterSpacing: '0.15em', fontWeight: 600 }}>{joinError}</p>
                      <p className="text-[10px] mt-2" style={{ color: `${C.gray}cc` }}>Pedile al líder que te reenvíe el link.</p>
                    </div>
                  ) : boatReservationId ? (
                    <div className="p-6" style={{ borderRadius: '20px', background: 'rgba(230,57,47,0.08)', border: '0.5px solid rgba(230,57,47,0.40)' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <CheckCircle2 size={20} style={{ color: C.red }} />
                        <p className="text-sm uppercase" style={{ color: C.cream, letterSpacing: '0.1em', fontWeight: 600 }}>
                          Invitación válida
                        </p>
                      </div>
                      <p className="text-xs" style={{ color: C.gray, lineHeight: 1.6 }}>
                        Te unís a la lancha {joinLeaderName ? <>de <strong style={{ color: C.cream }}>{joinLeaderName}</strong></> : 'de tu amigo'} · <strong style={{ color: C.cream }}>{boats.find(b => b.id === selectedBoatId)?.name || 'Lancha'}</strong>.
                        Continuá para completar tus datos y pago.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Aviso: todas las lanchas llenas → igual se puede avanzar */}
              {boatChoice === 'lead' && allBoatsFull && (
                <div className="p-5 mb-1" style={{ borderRadius: '20px', background: 'rgba(255,180,140,0.08)', border: '0.5px solid rgba(255,180,140,0.40)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Ship size={15} style={{ color: '#FFB48C' }} />
                    <p className="text-[10px] uppercase" style={{ color: '#FFB48C', letterSpacing: '0.25em', fontWeight: 600 }}>
                      Lanchas con cupo agotado
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: `${C.cream}cc`, lineHeight: 1.5 }}>
                    Por ahora todas las lanchas están llenas, pero podés continuar y completar tu compra.
                    <strong style={{ color: C.cream }}> El equipo te asigna lancha</strong> apenas se abra un cupo o se sume una nueva.
                  </p>
                </div>
              )}

              {/* 1) Universidad y fecha — filas compactas (logo box U1/U2/U3 +
                  semana + fechas), como el mockup "Configura tu semana". */}
              {boatChoice === 'lead' && (
                <div>
                  <p className="text-sm uppercase mb-3" style={{ color: C.cream, letterSpacing: '0.12em', fontWeight: 600 }}>
                    <span style={{ color: C.red }}>1)</span> Seleccioná tu universidad y fecha
                  </p>
                  <div className="space-y-2">
                    {weeks.map((w, i) => {
                      const wsel = selWeek?.id === w.id;
                      const cap  = Number(w.capacity) || 0;
                      const left = Math.max(0, cap - (Number(w.reserved) || 0));
                      return (
                        <button key={w.id} type="button"
                          onClick={() => { setSelWeek(w); setSelectedBoatId(null); }}
                          className="w-full p-3 flex items-center gap-3 text-left"
                          style={{
                            borderRadius: '14px',
                            background: wsel ? 'rgba(230,57,47,0.10)' : 'rgba(255,255,255,0.04)',
                            border: `0.5px solid ${wsel ? 'rgba(230,57,47,0.55)' : 'rgba(255,255,255,0.10)'}`,
                            transition: 'all 0.25s ease',
                          }}>
                          <div className="w-11 h-11 flex items-center justify-center flex-shrink-0"
                            style={{ borderRadius: '11px', background: wsel ? C.red : 'rgba(255,255,255,0.06)', color: wsel ? C.cream : C.gray, fontWeight: 700 }}>
                            <span className="text-[12px]">{`U${i + 1}`}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] uppercase truncate" style={{ color: C.cream, letterSpacing: '0.06em', fontWeight: 600 }}>{w.university}</p>
                            <p className="text-[9px] uppercase" style={{ color: cap > 0 && left <= 20 ? C.red : C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
                              {new Date(w.start_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })} — {new Date(w.end_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                              {cap > 0 && left <= 20 ? ` · ¡Solo ${left}!` : ''}
                            </p>
                          </div>
                          {wsel
                            ? <Check size={16} style={{ color: C.red, flexShrink: 0 }} />
                            : <ChevronRight size={15} style={{ color: C.gray, flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2) Días — solo "arma tu propia semana"; el combo incluye todos */}
              {boatChoice === 'lead' && comboType === 'individual_days' && selWeek && (
                <div>
                  <p className="text-sm uppercase mb-3" style={{ color: C.cream, letterSpacing: '0.12em', fontWeight: 600 }}>
                    <span style={{ color: C.red }}>2)</span> Elegí los días que vas
                  </p>
                  <div className="space-y-2">
                    {weekDays.map(day => {
                      const selected = selDays.includes(day.day);
                      return (
                        <button key={day.day} type="button"
                          onClick={() => setSelDays(prev => selected ? prev.filter(d => d !== day.day) : [...prev, day.day])}
                          className="w-full p-3.5 flex items-center gap-3 text-left"
                          style={{
                            borderRadius: '14px',
                            background: selected ? 'rgba(230,57,47,0.08)' : 'rgba(255,255,255,0.04)',
                            border: `0.5px solid ${selected ? 'rgba(230,57,47,0.50)' : 'rgba(255,255,255,0.10)'}`,
                            transition: 'all 0.25s ease',
                          }}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center border-2 flex-shrink-0"
                            style={selected ? { background: C.red, borderColor: C.red } : { borderColor: `${C.gray}50` }}>
                            {day.highlight
                              ? <Ship size={14} style={{ color: selected ? C.cream : C.gray }} />
                              : <span className="text-[11px]" style={{ color: selected ? C.cream : C.gray }}>{day.day}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] uppercase" style={{ color: day.highlight ? C.red : C.cream, letterSpacing: '0.06em', fontWeight: 600 }}>{day.title}</p>
                            <p className="text-[9px]" style={{ color: C.gray }}>{day.subtitle}</p>
                          </div>
                          <p className="text-[11px]" style={{ color: selected ? C.red : C.gray, fontWeight: 600 }}>
                            {day.day === boatDay ? `desde ${fmtCOP(cheapestBoatPrice || day.price)}` : fmtCOP(day.price)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* N) Lancha — catálogo. Para días sueltos solo aplica si va el día 3. */}
              {boatChoice === 'lead' && selWeek && includesBoat && (
                <div className="space-y-3">
                  <p className="text-sm uppercase mb-1" style={{ color: C.cream, letterSpacing: '0.12em', fontWeight: 600 }}>
                    <span style={{ color: C.red }}>{isCombo ? '2)' : '3)'}</span> Seleccioná tu lancha <span style={{ color: C.gray, fontWeight: 400 }}>· día {boatDay}</span>
                  </p>

                  {/* Descripción general de las lanchas (configurable por el admin) */}
                  {boatsIntro && (
                    <div className="p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)', borderRadius: '18px' }}>
                      <p className="text-xs" style={{ color: `${C.cream}dd`, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{boatsIntro}</p>
                    </div>
                  )}

                  {/* Notas clave — botellas incluidas + link de invitación */}
                  <div className="p-4 space-y-2.5" style={{ background: 'rgba(230,57,47,0.08)', border: '0.5px solid rgba(230,57,47,0.30)', borderRadius: '18px' }}>
                    <div className="flex items-start gap-2.5">
                      <span className="flex-shrink-0" style={{ fontSize: 14 }}>🍾</span>
                      <p className="text-[11px]" style={{ color: `${C.cream}dd`, lineHeight: 1.5 }}>
                        El precio de la lancha <strong style={{ color: C.cream }}>incluye 2 botellas cada 5 personas</strong> en el Beach Club.
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex-shrink-0" style={{ fontSize: 14 }}>🔗</span>
                      <p className="text-[11px]" style={{ color: `${C.cream}dd`, lineHeight: 1.5 }}>
                        Sé el <strong style={{ color: C.cream }}>primero de tu grupo</strong> en elegir lancha: apenas pagás, te damos un <strong style={{ color: C.cream }}>link</strong> para que tus amigos se unan a TU lancha.
                      </p>
                    </div>
                  </div>
                  {boats.length === 0 ? (
                    <div className="p-6 text-center" style={{
                      borderRadius: '20px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '0.5px solid rgba(255,255,255,0.08)',
                    }}>
                      <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>
                        No hay lanchas configuradas todavía.
                      </p>
                      <p className="text-[10px] mt-2" style={{ color: `${C.gray}80` }}>
                        Continúa, el equipo asignará lancha después del pago.
                      </p>
                    </div>
                  ) : (
                    boats.map(b => {
                      const sel = selectedBoatId === b.id;
                      const claimed   = boatOccupancy[b.id] || 0;
                      // Una lancha la reserva UN solo grupo por semana: si ya tiene
                      // reserva (claimed > 0), no se puede elegir como nueva — los
                      // amigos entran por el link del líder, no seleccionándola acá.
                      const isTaken   = claimed > 0;
                      const isSoldOut = b.status === 'sold_out' || isTaken;
                      const isJustReserved = recentBoatId === b.id;
                      // Precio mostrado = ajustado por plan (Plan Total −15k / días +15k)
                      const boatShownPrice = adjBoatPrice(b.price_per_person || 0);
                      const priceK = Math.round(boatShownPrice / 1000);
                      return (
                        <motion.button
                          key={b.id}
                          whileTap={{ scale: 0.995 }}
                          animate={isJustReserved ? { scale: [1, 1.012, 1] } : { scale: 1 }}
                          transition={isJustReserved ? { duration: 0.6, ease: 'easeOut' } : undefined}
                          onClick={() => !isSoldOut && setSelectedBoatId(b.id)}
                          disabled={isSoldOut}
                          className="w-full p-5 text-left relative overflow-hidden block"
                          style={{
                            borderRadius: '20px',
                            background: sel ? 'rgba(230,57,47,0.10)' : 'rgba(255,255,255,0.035)',
                            backdropFilter: 'blur(32px) saturate(180%)',
                            border: sel
                              ? '0.5px solid rgba(230,57,47,0.55)'
                              : isJustReserved
                                ? '0.5px solid rgba(255,180,140,0.55)'
                                : '0.5px solid rgba(255,255,255,0.10)',
                            boxShadow: sel
                              ? '0 24px 50px rgba(230,57,47,0.15)'
                              : isJustReserved
                                ? '0 16px 36px rgba(255,180,140,0.25)'
                                : '0 16px 36px rgba(0,0,0,0.25)',
                            opacity: isSoldOut ? 0.4 : 1,
                            cursor: isSoldOut ? 'not-allowed' : 'pointer',
                            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          {isSoldOut && (
                            <div className="absolute top-3 right-3 px-2.5 py-1 text-[8px] uppercase"
                              style={{ background: C.gray, color: '#000', letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 700 }}>
                              {b.status === 'sold_out' ? 'No disponible' : 'Reservada'}
                            </div>
                          )}
                          {!isSoldOut && isJustReserved && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="absolute top-3 right-3 px-2.5 py-1 text-[8px] uppercase flex items-center gap-1.5"
                              style={{
                                background: '#FFB48C',
                                color: '#0a0a0a',
                                letterSpacing: '0.2em',
                                borderRadius: '999px',
                                fontWeight: 700,
                              }}
                            >
                              <span style={{
                                width: 5, height: 5, borderRadius: 999, background: '#0a0a0a',
                                animation: 'pulse 1.4s ease-in-out infinite',
                              }} />
                              Recién reservada
                            </motion.div>
                          )}
                          {/* Galería horizontal — el cliente puede deslizar para ver
                              todas las fotos ANTES de elegir la lancha. */}
                          {(() => {
                            const photos: string[] = (Array.isArray(b.gallery) && b.gallery.length > 0)
                              ? b.gallery
                              : (b.image_url ? [b.image_url] : []);
                            if (photos.length === 0) {
                              return (
                                <div className="w-full h-32 mb-4 flex items-center justify-center"
                                  style={{ borderRadius: '14px', background: `${C.red}10`, color: C.red, border: '0.5px solid rgba(230,57,47,0.20)' }}>
                                  <Ship size={32} />
                                </div>
                              );
                            }
                            return (
                              <div
                                className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1"
                                style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
                              >
                                {photos.map((url, i) => (
                                  <img
                                    key={`${url}-${i}`}
                                    src={url}
                                    alt={`${b.name} foto ${i+1}`}
                                    loading="lazy"
                                    className="object-cover flex-shrink-0"
                                    style={{
                                      width: '100%',
                                      aspectRatio: '16 / 10',
                                      borderRadius: '14px',
                                      scrollSnapAlign: 'start',
                                    }}
                                  />
                                ))}
                                {photos.length > 1 && (
                                  <div className="flex items-center justify-center flex-shrink-0 px-3 text-[9px] uppercase"
                                    style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>
                                    {photos.length} fotos →
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm md:text-base uppercase" style={{ letterSpacing: '0.08em', fontWeight: 600, color: C.cream }}>
                                {b.name}
                              </p>
                              {b.description && (
                                <p className="text-[10px] mt-1" style={{ color: C.gray, letterSpacing: '0.05em' }}>
                                  {b.description}
                                </p>
                              )}
                              <div className="flex items-baseline gap-3 mt-2 flex-wrap">
                                <span className="text-[10px] uppercase tabular-nums" style={{
                                  color: isTaken ? C.gray : C.red,
                                  letterSpacing: '0.2em',
                                  fontWeight: 600,
                                }}>
                                  {isTaken ? 'Reservada' : `${b.capacity} cupos`}
                                </span>
                                {priceK > 0 && !isTaken && (
                                  <span className="text-[12px]" style={{ color: C.cream, letterSpacing: '0.04em', fontWeight: 600 }}>
                                    · {fmtCOP(priceK * 1000)} <span style={{ color: C.gray, fontWeight: 400 }}>/ persona</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Continuar — combo va a forma de pago; días sueltos a datos.
                  Si todas las lanchas están llenas (lead), se puede avanzar sin
                  selección (el equipo asigna después) para no bloquear la venta. */}
              {(() => {
                // Para avanzar (lead): universidad elegida + (días sueltos: al menos
                // 1 día). La lancha NO es obligatoria si todas están llenas o si no
                // va el día 3 — el equipo asigna después.
                const daysOk = isCombo || selDays.length > 0;
                const boatOk = !selWeek || !includesBoat
                  ? true
                  : (!!selectedBoatId || boats.length === 0 || allBoatsFull);
                const canAdvanceLead = !!selWeek && daysOk && boatOk;
                const ready = boatChoice === 'join' ? !!boatReservationId : canAdvanceLead;
                const hint = !selWeek ? 'Elegí tu universidad'
                  : (!daysOk ? 'Elegí al menos un día' : null);
                return (
              <div style={{ position: 'sticky', bottom: 0, zIndex: 20, paddingTop: '20px', paddingBottom: '10px', marginTop: '4px', background: 'linear-gradient(to top, #0a0000 62%, rgba(10,0,0,0))' }}>
              {hint && boatChoice === 'lead' && (
                <p className="text-[10px] uppercase text-center mb-2" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>{hint}</p>
              )}
              <button
                onClick={() => {
                  if (!ready) return;
                  setStep(2);
                }}
                disabled={!ready}
                style={{
                  ...primaryBtnStyle,
                  padding: '18px 16px',
                  opacity: ready ? 1 : 0.35,
                }}
                onMouseEnter={e => {
                  if (ready) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 28px rgba(230,57,47,0.30)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                Ir al resumen y pago <ChevronRight size={16} />
              </button>
              </div>
                );
              })()}
            </motion.div>
          )}

          {/* STEP 3 — Resumen + confirmar */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
                  Paso 3 · Resumen y {isInstallmentMode ? 'reserva' : 'pago'}
                </p>
                <h2 className="text-3xl md:text-4xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
                  {isEventsPack ? 'Tu Pack Fiestas' : isCombo ? 'Tu Plan Total' : 'Tus días elegidos'}
                </h2>
              </div>

              {/* ── Detalles de lo que incluye (como el mockup) ── */}
              <div className="p-5 space-y-3.5" style={{
                borderRadius: '24px',
                background: 'rgba(230,57,47,0.05)',
                border: '0.5px solid rgba(230,57,47,0.30)',
              }}>
                <p className="text-[11px] uppercase" style={{ letterSpacing: '0.25em', color: C.red, fontWeight: 700 }}>
                  {isEventsPack ? 'Pack Fiestas · 5 eventos' : isCombo ? 'Detalles del Plan Total' : 'Resumen de tu selección'}
                </p>
                {isEventsPack ? (
                  <>
                    {([
                      [<Calendar size={17} style={{ color: C.red }} />, 'Acceso a los 5 eventos', 'Clubes exclusivos de toda la semana'],
                      [<span style={{ fontSize: 15 }}>🌊</span>, 'Acceso al Beach Club', 'OJO: solo se entra EN LANCHA'],
                    ] as [React.ReactNode, string, string][]).map(([icon, title, sub], i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(230,57,47,0.12)' }}>{icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] uppercase" style={{ color: C.cream, letterSpacing: '0.04em', fontWeight: 600, lineHeight: 1.3 }}>{title}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: C.gray, lineHeight: 1.4 }}>{sub}</p>
                        </div>
                      </div>
                    ))}
                    {/* Advertencia + upsell a Plan Total (pedido del owner) */}
                    <div className="p-3.5 mt-1" style={{ borderRadius: '14px', background: 'rgba(255,180,80,0.08)', border: '0.5px solid rgba(255,180,80,0.35)' }}>
                      <p className="text-[11px]" style={{ color: `${C.cream}ee`, lineHeight: 1.5 }}>
                        Esta oferta te da acceso a <strong style={{ color: C.cream }}>todos los eventos y al Beach Club</strong> 🌊. Pero ojo: al Beach Club <strong style={{ color: C.cream }}>solo se entra en lancha</strong>, y solo las nuestras están autorizadas. Con esta opción vas a necesitar <strong style={{ color: C.cream }}>sumar una lancha aparte</strong>.
                      </p>
                      <p className="text-[11px] mt-2" style={{ color: '#FFD9A0', lineHeight: 1.5, fontWeight: 600 }}>
                        💡 Mejor llevá el Plan Total — incluye todo (eventos + lancha + Beach Club).
                      </p>
                      <button type="button"
                        onClick={() => { setComboType('full_combo'); setMode('full_combo'); setSelectedBoatId(null); setStep(2.7 as any); }}
                        className="mt-3 w-full py-2.5 text-center text-[11px] uppercase flex items-center justify-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg, #E6392F 0%, #FF7A1A 100%)', color: C.cream, borderRadius: '999px', letterSpacing: '0.12em', fontWeight: 700 }}>
                        Cambiar a Plan Total <ChevronRight size={14} />
                      </button>
                    </div>
                  </>
                ) : isCombo ? (
                  [
                    [<Ship size={17} style={{ color: C.red }} />, 'Recorrido en lancha VIP & sonido pro', 'Fiesta en lancha con plataforma de audio premium'],
                    [<Calendar size={17} style={{ color: C.red }} />, 'Acceso completo a los 5 eventos', 'Clubes exclusivos + Beach Club Boat Party'],
                    [<span style={{ fontSize: 15 }}>🍾</span>, 'Cortesía de 2 botellas (por cada 5 personas)', 'Válido para tu grupo en el Beach Club'],
                  ].map(([icon, title, sub], i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(230,57,47,0.12)' }}>{icon as React.ReactNode}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] uppercase" style={{ color: C.cream, letterSpacing: '0.04em', fontWeight: 600, lineHeight: 1.3 }}>{title as string}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: C.gray, lineHeight: 1.4 }}>{sub as string}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="space-y-2">
                    {selDays.slice().sort((a, b) => a - b).map(dn => {
                      const d = weekDays.find(x => x.day === dn);
                      return (
                        <div key={dn} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: dn === boatDay ? C.red : 'rgba(255,255,255,0.06)' }}>
                            {dn === boatDay ? <Ship size={13} style={{ color: C.cream }} /> : <span className="text-[10px]" style={{ color: C.cream }}>{dn}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] uppercase" style={{ color: dn === boatDay ? C.red : C.cream, letterSpacing: '0.04em', fontWeight: 600 }}>
                              Día {dn} · {d?.title || ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {selDays.includes(boatDay) && (
                      <p className="text-[10px] pt-1" style={{ color: C.gray, lineHeight: 1.5 }}>
                        Incluye el cupo en el Bote & Beach Club con audio premium y botellas de cortesía (por cada 5 personas).
                      </p>
                    )}
                  </div>
                )}
                <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-[10px] uppercase pt-2" style={{ color: C.gray, letterSpacing: '0.1em' }}>
                    Semana: <strong style={{ color: C.cream }}>{selWeek?.university}</strong>
                  </span>
                  {includesBoat && selectedBoatId && (
                    <span className="text-[10px] uppercase pt-2" style={{ color: C.gray, letterSpacing: '0.1em' }}>
                      Lancha: <strong style={{ color: C.cream }}>{boats.find(b => b.id === selectedBoatId)?.name || 'Seleccionada'}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 p-6" style={{
                borderRadius: '28px',
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(24px)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}>
                {/* Datos informativos */}
                {([
                  ['Nombre',    name],
                  ['Email',     email],
                  includesBoat && boatChoice === 'lead'
                    ? ['Rol lancha', 'Líder (te damos link para invitar)']
                    : includesBoat && boatChoice === 'join'
                    ? ['Rol lancha', 'Invitado']
                    : null,
                ] as ([string, string | undefined] | null)[])
                  .filter((x): x is [string, string | undefined] => Boolean(x))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.12em', fontWeight: 500 }}>
                      <span style={{ color: C.gray }}>{k}</span>
                      <span style={{ color: C.cream }}>{v}</span>
                    </div>
                  ))}

                {/* ── Tabla Concepto / Valor (COP) ───────────────────────── */}
                <div className="flex justify-between text-[10px] uppercase pb-1" style={{ letterSpacing: '0.15em', color: C.gray, fontWeight: 600, borderBottom: '0.5px solid rgba(255,255,255,0.10)' }}>
                  <span>Concepto</span><span>Valor (COP)</span>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em', fontWeight: 500 }}>
                    <span style={{ color: C.gray }}>{isCombo ? 'Covers a clubes premium' : `Covers (${selDays.length} días)`}</span>
                    <span style={{ color: C.cream }}>{fmtCOP((isCombo ? comboBase : dayTotal))}</span>
                  </div>
                  {boatPart > 0 && (
                    <div className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em', fontWeight: 500 }}>
                      <span style={{ color: C.gray }}>Experiencia Bote & Beach Club</span>
                      <span style={{ color: C.cream }}>{fmtCOP(boatPart)}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em', fontWeight: 600 }}>
                      <span style={{ color: '#86efac' }}>Descuento ({sellerDiscountPct}%)</span>
                      <span style={{ color: '#86efac' }}>−{fmtCOP(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em', fontWeight: 500 }}>
                    <span style={{ color: C.gray }}>Ticket service (6.6%)</span>
                    <span style={{ color: C.cream }}>{fmtCOP(ticketService)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-xs uppercase" style={{ color: C.cream, fontWeight: 600, letterSpacing: '0.1em' }}>Total</span>
                    <span className="text-xl" style={{ color: C.cream, fontWeight: 400 }}>{fmtCOP(grandTotal)}</span>
                  </div>
                </div>

                {/* Seleccioná tu plan de pago — fraccionado disponible desde $200.000.
                    Pago único = cobra el total hoy; fraccionado = adelanto + cuotas. */}
                {(isCombo || grandTotal >= 200000) && (
                  <div className="pt-4 mt-1 space-y-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
                    <p className="text-[11px] uppercase text-center" style={{ letterSpacing: '0.25em', color: C.red, fontWeight: 700 }}>Seleccioná tu plan de pago</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Pago único */}
                      <button type="button" onClick={() => setMode(isCombo ? 'full_combo' : 'individual_days')}
                        className="p-4 text-left relative" style={{ borderRadius: '16px', background: !isInstallmentMode ? 'rgba(230,57,47,0.12)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${!isInstallmentMode ? 'rgba(230,57,47,0.55)' : 'rgba(255,255,255,0.10)'}` }}>
                        {!isInstallmentMode && <CheckCircle2 size={15} style={{ color: C.red, position: 'absolute', top: 12, right: 12 }} />}
                        <p className="text-[12px] uppercase" style={{ color: C.cream, fontWeight: 700, letterSpacing: '0.05em' }}>Pago único</p>
                        <p className="text-[11px] mt-1" style={{ color: C.red, fontWeight: 600 }}>{fmtCOP(grandTotal)}</p>
                        <p className="text-[9px] mt-1.5" style={{ color: C.gray, lineHeight: 1.4 }}>Garantizás todo con un solo pago hoy.</p>
                      </button>
                      {/* Pago fraccionado */}
                      <button type="button" onClick={() => setMode('manual_monthly')}
                        className="p-4 text-left relative" style={{ borderRadius: '16px', background: isInstallmentMode ? 'rgba(230,57,47,0.12)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${isInstallmentMode ? 'rgba(230,57,47,0.55)' : 'rgba(255,255,255,0.10)'}` }}>
                        {isInstallmentMode && <CheckCircle2 size={15} style={{ color: C.red, position: 'absolute', top: 12, right: 12 }} />}
                        <p className="text-[12px] uppercase" style={{ color: C.cream, fontWeight: 700, letterSpacing: '0.05em' }}>Fraccionado</p>
                        <p className="text-[11px] mt-1" style={{ color: C.red, fontWeight: 600 }}>Reservá con {fmtCOP(s.entry_price)}</p>
                        <p className="text-[9px] mt-1.5" style={{ color: C.gray, lineHeight: 1.4 }}>
                          + {effectiveInstallments} {effectiveInstallments === 1 ? 'cuota' : 'cuotas'} de {fmtCOP(installmentBase / effectiveInstallments)}.
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Pago de hoy */}
                <div className="pt-3 mt-1 flex justify-between items-center" style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
                  <span className="text-sm uppercase" style={{ color: C.gray, fontWeight: 500 }}>
                    {isInstallmentMode ? 'Adelanto hoy' : 'Pago hoy'}
                  </span>
                  <span className="text-3xl" style={{ color: C.red, fontWeight: 300 }}>{fmtCOP(chargeNow)}</span>
                </div>
                {isInstallmentMode && (
                  <p className="text-[9px] uppercase text-center" style={{ color: C.gray, fontWeight: 500 }}>
                    + {effectiveInstallments} cuotas de {fmtCOP(installmentBase / effectiveInstallments)}/mes
                  </p>
                )}

                {/* Disclaimer de política de reembolso — visible antes de pagar */}
                <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-[9px] uppercase mb-1.5" style={{ letterSpacing: '0.3em', color: C.red, fontWeight: 600 }}>
                    Política de reembolso
                  </p>
                  <p className="text-[10px] leading-relaxed" style={{ color: `${C.gray}dd` }}>
                    Tenés <strong style={{ color: C.cream }}>15 días</strong> desde la compra para arrepentirte y pedir devolución del adelanto.
                    Pasados los 15 días, <strong style={{ color: C.cream }}>ninguna compra es reembolsable</strong> — aplica a todas las modalidades.
                  </p>
                </div>
              </div>
              <button onClick={handleCreateRegistration} disabled={processing}
                style={{
                  ...primaryBtnStyle,
                  padding: '20px 16px',
                  opacity: processing ? 0.35 : 1,
                }}
                onMouseEnter={e => {
                  if (!processing) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(230,57,47,0.20)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                {processing ? <Loader2 className="animate-spin" /> : <><Shield size={16} /> {isInstallmentMode ? 'Confirmar reserva con' : 'Confirmar y pagar'} {fmtCOP(chargeNow)}</>}
              </button>
              {reserveError && (
                <p className="text-xs text-center mt-3" style={{ color: C.red, fontWeight: 500, lineHeight: 1.5 }}>
                  {reserveError}
                </p>
              )}
            </motion.div>
          )}

          {/* STEP 4 — Pago real (Wompi para one-shot, simulado para cuotas) */}
          {step === 4 && (() => {
            const isOneShot = mode === 'full_combo' || mode === 'individual_days';
            return (
            <motion.div key="s4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 text-center">
              <div className="p-8 space-y-8" style={{
                borderRadius: '28px',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(32px) saturate(180%)',
                border: payStatus === 'paid' ? '0.5px solid rgba(16,185,129,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}>
                {/* Provider badge — siempre Wompi (el pago de hoy se cobra ahí) */}
                <div className="inline-flex items-center gap-2 px-3 py-1"
                  style={{ background: 'rgba(16,185,129,0.10)', border: '0.5px solid rgba(16,185,129,0.40)', borderRadius: '999px' }}>
                  <Shield size={10} style={{ color: '#10b981' }} />
                  <span className="text-[9px] uppercase" style={{ color: '#10b981', letterSpacing: '0.3em', fontWeight: 600 }}>
                    Pago seguro · Wompi
                  </span>
                </div>

                <div>
                  <p className="text-[10px] uppercase mb-2" style={{ color: C.gray, letterSpacing: '0.3em', fontWeight: 500 }}>
                    {isOneShot ? 'Total a pagar ahora' : 'Reserva hoy con'}
                  </p>
                  <p className="text-5xl" style={{ color: C.cream, fontWeight: 300 }}>{fmtCOP(chargeNow)}</p>
                  <p className="text-[10px] uppercase mt-2" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                    {MODES.find(m => m.id === mode)?.label}
                  </p>
                  {pendingOrderNum && (
                    <p className="text-[9px] mt-3 font-mono" style={{ color: `${C.gray}70` }}>{pendingOrderNum}</p>
                  )}
                </div>

                {payStatus === 'paid' ? (
                  <div className="space-y-3">
                    <CheckCircle2 size={36} className="mx-auto" style={{ color: '#10b981' }} />
                    <p className="text-[10px] uppercase animate-pulse" style={{ color: '#10b981', letterSpacing: '0.2em', fontWeight: 500 }}>
                      ¡Pago registrado! Preparando confirmación…
                    </p>
                  </div>
                ) : (
                  <>
                    {/* TODOS los modos cobran el pago de HOY por Wompi:
                        - full_combo / días sueltos → monto total
                        - cuotas (auto/manual) → el adelanto ($40K); las cuotas
                          siguientes quedan agendadas en payment_schedules */}
                    <button
                      onClick={handleWompiCheckout}
                      disabled={simulating}
                      style={{
                        ...primaryBtnStyle,
                        padding: '20px 16px',
                        opacity: simulating ? 0.35 : 1,
                      }}
                      onMouseEnter={e => {
                        if (!simulating) {
                          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(230,57,47,0.20)';
                        }
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                      }}
                    >
                      {simulating
                        ? <><Loader2 className="animate-spin" size={18} /> Redirigiendo a Wompi…</>
                        : <><CreditCard size={16} /> Pagar {fmtCOP(chargeNow)} con Wompi</>}
                    </button>
                    {wompiError && (
                      <p className="text-[10px]" style={{ color: C.red, letterSpacing: '0.1em' }}>
                        · {wompiError}
                      </p>
                    )}
                  </>
                )}
              </div>

              <p className="text-[9px] uppercase" style={{ color: `${C.gray}50`, letterSpacing: '0.2em', fontWeight: 500 }}>
                {isOneShot
                  ? 'Te redirigimos a Wompi · vuelves automáticamente al finalizar'
                  : `Hoy pagas el adelanto de ${fmtCOP(chargeNow)} por Wompi · las cuotas se cobran mes a mes`}
              </p>
            </motion.div>
            );
          })()}

          {/* STEP 5 — Confirmación */}
          {step === 5 && (
            <ConfirmationCinematic
              weekUniversity={selWeek?.university}
              weekStartDate={selWeek?.start_date}
              email={email}
              name={name}
              modalityLabel={MODES.find(m => m.id === mode)?.label || ''}
              orderNum={pendingOrderNum ?? '—'}
              installmentAmountK={Math.round(installmentBase / (effectiveInstallments || 1) / 1000)}
              showInstallments={isInstallmentMode}
              boatInviteCode={boatChoice === 'lead' ? boatInviteCode : null}
              boatName={selectedBoatId ? boats.find(b => b.id === selectedBoatId)?.name : undefined}
              registrationId={pendingRegId}
              onBack={onBack}
            />
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Pantalla de confirmación cinemática ─────────────────────────────────

interface ConfirmationProps {
  weekUniversity?: string;
  weekStartDate?: string;
  email: string;
  name: string;
  modalityLabel: string;
  orderNum: string;
  installmentAmountK: number;
  showInstallments: boolean;
  boatInviteCode?: string | null;
  boatName?: string;
  registrationId?: string | null;
  onBack: () => void;
}

function ConfirmationCinematic({
  weekUniversity, weekStartDate, email, name, modalityLabel, orderNum,
  installmentAmountK, showInstallments, boatInviteCode, boatName, registrationId, onBack,
}: ConfirmationProps) {
  const firstName = (name || '').split(' ')[0] || 'Tu pase';
  const [countdown, setCountdown] = useState(() => calcCountdown(weekStartDate));
  const [lodgings, setLodgings]   = useState<any[]>([]);
  const [lodgeStatus, setLodgeStatus] = useState<'idle' | 'reserving' | 'reserved' | 'error'>('idle');
  const [reservedLodgeName, setReservedLodgeName] = useState<string | null>(null);

  useEffect(() => {
    if (!weekStartDate) return;
    const id = setInterval(() => setCountdown(calcCountdown(weekStartDate)), 1000);
    return () => clearInterval(id);
  }, [weekStartDate]);

  useEffect(() => {
    supabase
      .from('solstice_lodgings')
      .select('id, name, image_url, description, price_per_night, price_per_person, units_available, category')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) setLodgings(data);
      });
  }, []);

  const handleReserveLodge = async (lodgeId: string, lodgeName: string, pricePerNight: number) => {
    setLodgeStatus('reserving');
    try {
      const nights = 5; // semana completa por defecto
      const { data: inserted, error } = await supabase
        .from('solstice_lodging_reservations')
        .insert({
          lodging_id:    lodgeId,
          registration_id: registrationId || null,
          customer_name:   name,
          customer_email:  email,
          nights,
          guests:          1,
          total_amount:    nights * pricePerNight,
          status:          'pending',
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);

      // Notificación al operador del hospedaje + confirmación al cliente
      // Fire-and-forget: no bloquea la UI ni rompe el upsell si el email falla.
      if (inserted?.id) {
        supabase.functions
          .invoke('send-lodging-notification', { body: { reservation_id: inserted.id } })
          .catch(err => console.warn('send-lodging-notification falló:', err?.message));
      }

      setReservedLodgeName(lodgeName);
      setLodgeStatus('reserved');
    } catch (err: any) {
      console.warn('Lodging reserve error:', err.message);
      setLodgeStatus('error');
    }
  };

  return (
    <motion.div
      key="s5-cinematic"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative"
    >
      {/* Confetti partículas */}
      <ConfettiBurst />

      <div className="relative z-10 space-y-8 py-8">
        {/* Sun/check animado */}
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 180, damping: 14 }}
          className="relative w-24 h-24 mx-auto"
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(230,57,47,0.5) 0%, rgba(230,57,47,0.15) 50%, transparent 80%)',
              filter: 'blur(20px)',
              animation: 'pulse 2.5s ease-in-out infinite',
            }}
          />
          <div
            className="relative w-full h-full rounded-full flex items-center justify-center"
            style={{
              background: '#E6392F',
              boxShadow: '0 0 50px rgba(230,57,47,0.6), inset 0 -10px 20px rgba(0,0,0,0.2)',
            }}
          >
            <CheckCircle2 size={42} style={{ color: '#F9F2D7' }} strokeWidth={2} />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <p className="text-[10px] uppercase mb-3" style={{ letterSpacing: '0.4em', color: '#E6392F', fontWeight: 600 }}>
            Reserva confirmada
          </p>
          <h2 className="uppercase mb-3" style={{
            fontFamily: "'Poiret One', sans-serif",
            fontSize: 'clamp(2rem, 6vw, 3.5rem)',
            letterSpacing: '-0.01em',
            fontWeight: 300,
            color: '#F9F2D7',
            lineHeight: 1.05,
          }}>
            Bienvenido,<br/>{firstName}
          </h2>
          <p className="text-sm md:text-base" style={{ color: '#606060', fontFamily: "'Archivo', sans-serif" }}>
            Tu lugar en <strong style={{ color: '#F9F2D7' }}>Solstice — {weekUniversity}</strong> está bloqueado.
          </p>
        </motion.div>

        {/* Countdown */}
        {weekStartDate && countdown.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
            style={{
              padding: '24px 16px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(230,57,47,0.08), rgba(255,180,140,0.04))',
              border: '0.5px solid rgba(230,57,47,0.30)',
            }}
          >
            <p className="text-[10px] uppercase mb-3" style={{ letterSpacing: '0.35em', color: '#E6392F', fontWeight: 600 }}>Faltan</p>
            <div className="flex items-center justify-center gap-3 md:gap-5 flex-wrap">
              {([['días', countdown.days, true], ['horas', countdown.hours, false], ['min', countdown.mins, false], ['seg', countdown.secs, false]] as [string, number, boolean][]).map(([label, val, big]) => (
                <div key={label} className="flex flex-col items-center min-w-[56px]">
                  <span className="tabular-nums leading-none" style={{
                    fontFamily: "'Poiret One', sans-serif",
                    fontSize: big ? 'clamp(2.5rem, 7vw, 4.5rem)' : 'clamp(1.5rem, 4vw, 2.5rem)',
                    fontWeight: 300,
                    color: big ? '#E6392F' : '#F9F2D7',
                    letterSpacing: '-0.02em',
                  }}>
                    {String(val).padStart(2, '0')}
                  </span>
                  <span className="text-[9px] uppercase mt-1.5" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] uppercase mt-3" style={{ letterSpacing: '0.3em', color: '#606060aa', fontWeight: 500 }}>
              para tu atardecer en Santa Marta
            </p>
          </motion.div>
        )}

        {/* Boarding pass */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.035)',
            backdropFilter: 'blur(28px) saturate(180%)',
            border: '0.5px solid rgba(255,255,255,0.10)',
            overflow: 'hidden',
            boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Banda superior estilo boarding pass */}
          <div style={{ padding: '14px 22px', background: 'linear-gradient(90deg, rgba(230,57,47,0.10) 0%, transparent 100%)', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase" style={{ letterSpacing: '0.35em', color: '#E6392F', fontWeight: 600 }}>Solstice Boarding</span>
              <span className="text-[9px] uppercase font-mono" style={{ letterSpacing: '0.15em', color: '#606060' }}>2026</span>
            </div>
          </div>

          {/* Cuerpo */}
          <div style={{ padding: '22px' }} className="space-y-4">
            <BoardingRow label="Pasajero"    value={name || 'Sin nombre'} />
            <BoardingRow label="Universidad" value={weekUniversity || '—'} />
            <BoardingRow label="Modalidad"   value={modalityLabel} />
            {showInstallments && (
              <BoardingRow label="Próxima cuota" value={`${fmtCOP(installmentAmountK * 1000)} / mes`} highlight />
            )}
            <BoardingRow label="Confirmación a" value={email} small />
          </div>

          {/* Footer con perforación */}
          <div style={{ position: 'relative', borderTop: '1px dashed rgba(255,255,255,0.15)', padding: '14px 22px', background: 'rgba(0,0,0,0.25)' }}>
            <div style={{ position: 'absolute', left: -10, top: -10, width: 20, height: 20, borderRadius: '999px', background: '#000' }} />
            <div style={{ position: 'absolute', right: -10, top: -10, width: 20, height: 20, borderRadius: '999px', background: '#000' }} />
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 500 }}>Orden</span>
              <span className="font-mono text-xs" style={{ color: '#F9F2D7', letterSpacing: '0.1em' }}>{orderNum}</span>
            </div>
          </div>
        </motion.div>

        {/* Tarjeta: Tu código de invitación (solo líderes de lancha) */}
        {boatInviteCode && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(230,57,47,0.12) 0%, rgba(255,122,0,0.06) 100%)',
              border: '0.5px solid rgba(230,57,47,0.40)',
              padding: '24px 22px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Ship size={16} style={{ color: '#E6392F' }} />
              <p className="text-[10px] uppercase" style={{ letterSpacing: '0.35em', color: '#E6392F', fontWeight: 600 }}>
                Tu lancha · {boatName || 'Lancha + Beach Club'}
              </p>
            </div>
            <p className="text-xs mb-3" style={{ color: '#F9F2D7', lineHeight: 1.55 }}>
              Eres <strong>líder</strong>. Mandales este <strong>link</strong> a tus amigos — al abrirlo quedan automáticamente en tu lancha, sin códigos:
            </p>

            <div
              style={{
                background: 'rgba(0,0,0,0.45)',
                border: '0.5px dashed rgba(230,57,47,0.45)',
                borderRadius: '14px',
                padding: '14px 16px',
                textAlign: 'center',
                marginBottom: '14px',
              }}
            >
              <p
                className="font-mono break-all"
                style={{
                  fontSize: '13px',
                  color: '#F9F2D7',
                  letterSpacing: '0.02em',
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                {`${window.location.origin}/sol/i/${boatInviteCode}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/sol/i/${boatInviteCode}`;
                  const msg = `Ya reservé lancha para Solstice 🌅 Únete a mi lancha con este link:\n${url}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                }}
                style={{
                  borderRadius: '999px',
                  background: 'rgba(16,185,129,0.15)',
                  border: '0.5px solid rgba(16,185,129,0.45)',
                  color: '#10b981',
                  letterSpacing: '0.2em',
                  padding: '12px',
                  fontSize: '11px',
                  textTransform: 'uppercase' as const,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                💬 Enviar por WhatsApp
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/sol/i/${boatInviteCode}`;
                  navigator.clipboard?.writeText(url);
                }}
                style={{
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '0.5px solid rgba(255,255,255,0.18)',
                  color: '#F9F2D7',
                  letterSpacing: '0.2em',
                  padding: '12px',
                  fontSize: '11px',
                  textTransform: 'uppercase' as const,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Copiar link
              </button>
            </div>

            <p className="text-[10px] uppercase mt-3" style={{ color: '#606060aa', letterSpacing: '0.2em', fontWeight: 500 }}>
              Cada invitado paga su entrada por separado
            </p>
          </motion.div>
        )}

        {/* Hospedaje: ya NO es un paso de la compra. Se reserva APARTE desde
            "Mi Semana", cuando el cliente decide dónde quedarse. */}
        <p className="text-[10px] uppercase text-center" style={{ color: '#606060', letterSpacing: '0.2em', fontWeight: 500 }}>
          ¿Hospedaje? Reservalo cuando quieras desde <strong style={{ color: '#F9F2D7' }}>Mi Semana</strong>.
        </p>
        {false && lodgings.length > 0 && lodgeStatus !== 'reserved' && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              borderRadius: '24px',
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(28px) saturate(180%)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              padding: '22px',
              overflow: 'hidden',
            }}
          >
            <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.35em', color: '#E6392F', fontWeight: 600 }}>
              ¿Dónde te quedás?
            </p>
            <h3 className="text-xl uppercase mb-3" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
              Hospedajes curados Solstice
            </h3>
            <p className="text-[11px] mb-4" style={{ color: '#606060', lineHeight: 1.55 }}>
              Reservás ahora, te confirmamos por WhatsApp y pagás directo al hotel. Estos lugares saben que vienes con Solstice.
            </p>

            <div className="space-y-2.5">
              {lodgings.slice(0, 3).map(l => {
                const priceK = Math.round((l.price_per_night || 0) / 1000);
                return (
                  <div key={l.id}
                    className="flex items-center gap-3 p-3"
                    style={{
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.025)',
                      border: '0.5px solid rgba(255,255,255,0.06)',
                    }}>
                    {l.image_url ? (
                      <img src={l.image_url} alt={l.name} className="w-14 h-14 object-cover flex-shrink-0"
                        style={{ borderRadius: '10px' }} />
                    ) : (
                      <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center"
                        style={{ borderRadius: '10px', background: 'rgba(230,57,47,0.10)', color: '#E6392F', fontSize: 18 }}>
                        ✦
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] uppercase truncate" style={{ color: '#F9F2D7', letterSpacing: '0.1em', fontWeight: 600 }}>
                        {l.name}
                      </p>
                      <p className="text-[10px]" style={{ color: '#606060' }}>
                        {priceK > 0 ? `Desde ${fmtCOP(priceK * 1000)}/noche` : 'Consultá tarifas'} {l.category ? `· ${l.category}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleReserveLodge(l.id, l.name, l.price_per_night || 0)}
                      disabled={lodgeStatus === 'reserving'}
                      className="flex-shrink-0 px-3 py-2 text-[10px] uppercase"
                      style={{
                        background: 'rgba(230,57,47,0.18)',
                        border: '0.5px solid rgba(230,57,47,0.50)',
                        color: '#E6392F',
                        letterSpacing: '0.2em',
                        borderRadius: '999px',
                        fontWeight: 600,
                        opacity: lodgeStatus === 'reserving' ? 0.4 : 1,
                        cursor: lodgeStatus === 'reserving' ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {lodgeStatus === 'reserving' ? '...' : 'Reservar'}
                    </button>
                  </div>
                );
              })}
            </div>

            {lodgeStatus === 'error' && (
              <p className="text-[10px] mt-3 text-center" style={{ color: '#E6392F' }}>
                · No pudimos reservar. Intenta de nuevo.
              </p>
            )}
          </motion.div>
        )}

        {lodgeStatus === 'reserved' && reservedLodgeName && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              borderRadius: '20px',
              background: 'rgba(16,185,129,0.10)',
              border: '0.5px solid rgba(16,185,129,0.40)',
              padding: '18px',
              textAlign: 'center',
            }}
          >
            <CheckCircle2 size={20} style={{ color: '#10b981', margin: '0 auto 6px' }} />
            <p className="text-xs uppercase" style={{ color: '#10b981', letterSpacing: '0.2em', fontWeight: 600 }}>
              Hospedaje reservado · {reservedLodgeName}
            </p>
            <p className="text-[10px] mt-1" style={{ color: '#606060' }}>
              Te contactamos por WhatsApp en las próximas 24h
            </p>
          </motion.div>
        )}

        {/* Próximos pasos */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="space-y-3"
        >
          <p className="text-[10px] uppercase text-center mb-3" style={{ letterSpacing: '0.35em', color: '#E6392F', fontWeight: 600 }}>Próximos pasos</p>
          <NextStepItem icon="✉" title="Revisa tu inbox" desc="Te enviamos el QR de confirmación a tu email" />
          <NextStepItem icon="💬" title="Activá WhatsApp" desc="Te avisamos 24h antes de cada cobro" />
          <NextStepItem icon="🌅" title="Llegada a Santa Marta" desc="Te mandamos guía completa 7 días antes del evento" />
        </motion.div>

        {/* Botones */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.5 }}
          className="space-y-3 pt-2"
        >
          <button
            onClick={() => {
              const url = window.location.origin;
              const msg = `Acabo de reservar Solstice 2026 — Semana ${weekUniversity} ✨ Te dejo el link: ${url}`;
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
            }}
            style={{
              borderRadius: '999px',
              background: 'rgba(16,185,129,0.15)',
              border: '0.5px solid rgba(16,185,129,0.45)',
              color: '#10b981',
              letterSpacing: '0.2em',
              width: '100%',
              padding: '16px',
              fontSize: '13px',
              textTransform: 'uppercase' as const,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.25)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.15)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >
            💬 Avisar a tus amigos
          </button>

          <button
            onClick={onBack}
            style={{
              borderRadius: '999px',
              background: 'transparent',
              border: '0.5px solid rgba(255,255,255,0.12)',
              color: '#606060',
              letterSpacing: '0.2em',
              width: '100%',
              padding: '14px',
              fontSize: '12px',
              textTransform: 'uppercase' as const,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#F9F2D7';
              (e.currentTarget as HTMLButtonElement).style.color = '#F9F2D7';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)';
              (e.currentTarget as HTMLButtonElement).style.color = '#606060';
            }}
          >
            Volver al inicio
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

function calcCountdown(date?: string) {
  if (!date) return { total: 0, days: 0, hours: 0, mins: 0, secs: 0 };
  const diff = new Date(date + 'T00:00:00').getTime() - Date.now();
  if (diff <= 0) return { total: 0, days: 0, hours: 0, mins: 0, secs: 0 };
  return {
    total: diff,
    days:  Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins:  Math.floor((diff % 3600000) / 60000),
    secs:  Math.floor((diff % 60000) / 1000),
  };
}

function BoardingRow({ label, value, highlight, small }: { label: string; value: string; highlight?: boolean; small?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[9px] uppercase flex-shrink-0" style={{ letterSpacing: '0.3em', color: '#606060', fontWeight: 500 }}>
        {label}
      </span>
      <span
        className={small ? 'text-[10px]' : 'text-[13px]'}
        style={{
          color: highlight ? '#E6392F' : '#F9F2D7',
          fontWeight: highlight ? 600 : 500,
          letterSpacing: '0.03em',
          textAlign: 'right',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function NextStepItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3 items-start p-4" style={{
      borderRadius: '16px',
      background: 'rgba(255,255,255,0.025)',
      border: '0.5px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ fontSize: '18px', flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div>
        <p className="text-[11px] uppercase mb-0.5" style={{ letterSpacing: '0.15em', color: '#F9F2D7', fontWeight: 600 }}>
          {title}
        </p>
        <p className="text-[10px]" style={{ color: '#606060', lineHeight: 1.5 }}>
          {desc}
        </p>
      </div>
    </div>
  );
}

function ConfettiBurst() {
  const PIECES = 30;
  const items = Array.from({ length: PIECES }, (_, i) => i);
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {items.map(i => {
        const angle = (Math.random() - 0.5) * 180;
        const distance = 100 + Math.random() * 280;
        const size = 4 + Math.random() * 7;
        const colors = ['#E6392F', '#F9F2D7', '#FFB48C', '#FF7A00'];
        const color = colors[i % colors.length];
        const delay = Math.random() * 0.3;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos((angle * Math.PI) / 180) * distance,
              y: Math.sin((angle * Math.PI) / 180) * distance * 0.6 + 200,
              rotate: 360 + Math.random() * 360,
              scale: 0.3,
            }}
            transition={{ duration: 1.8 + Math.random() * 0.8, delay, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '20%',
              left: '50%',
              width: `${size}px`,
              height: `${size * 0.4}px`,
              background: color,
              borderRadius: '2px',
            }}
          />
        );
      })}
    </div>
  );
}

// ── Form fields del step Tus Datos ──────────────────────────────────────

interface SolFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'url';
  autoComplete?: string;
  placeholder?: string;
}

function SolField({ label, value, onChange, error, type = 'text', inputMode, autoComplete, placeholder }: SolFieldProps) {
  return (
    <div>
      <label className="text-[9px] uppercase block mb-1.5" style={{ letterSpacing: '0.25em', color: error ? '#E6392F' : '#606060', fontWeight: 600 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        inputMode={inputMode as any}
        autoComplete={autoComplete as any}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        style={{
          borderRadius: '14px',
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px) saturate(180%)',
          border: error ? '0.5px solid rgba(230,57,47,0.55)' : '0.5px solid rgba(255,255,255,0.10)',
          color: '#F9F2D7',
          padding: '14px 16px',
          width: '100%',
          outline: 'none',
          fontSize: '13px',
          fontFamily: "'Archivo', sans-serif",
          fontWeight: 400,
          letterSpacing: '0.02em',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = 'rgba(230,57,47,0.55)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(230,57,47,0.10)';
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = error ? 'rgba(230,57,47,0.55)' : 'rgba(255,255,255,0.10)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {error && (
        <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: '#E6392F', fontWeight: 500 }}>
          <span>·</span> {error}
        </p>
      )}
    </div>
  );
}

function FieldGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase" style={{ letterSpacing: '0.35em', color: '#E6392F', fontWeight: 600 }}>
          {title}
        </p>
        {hint && <p className="text-[10px] mt-1" style={{ color: '#606060aa', fontWeight: 400 }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Sub-componente: item de garantía en el bloque "Cómo aseguramos tu lugar"
function GarantiaItem({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <span
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          border: '0.5px solid rgba(230,57,47,0.45)',
          color: '#E6392F',
          fontSize: '11px',
          fontWeight: 600,
        }}
      >
        {step}
      </span>
      <div>
        <p className="text-[11px] uppercase mb-1" style={{ color: '#F9F2D7', letterSpacing: '0.15em', fontWeight: 600 }}>{title}</p>
        <p className="text-[10px] leading-relaxed" style={{ color: '#606060cc', fontWeight: 400 }}>{desc}</p>
      </div>
    </li>
  );
}
