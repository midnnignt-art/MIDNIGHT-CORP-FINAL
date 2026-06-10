import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Loader2, Shield, CreditCard, CheckCircle2,
  Ship, Calendar, Repeat, ListChecks, Star
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { buildWompiCheckoutUrl } from '../../../lib/wompi';
import { useStore } from '../../../context/StoreContext';
import { SOLSTICE_SEASON_MOCK, SOLSTICE_WEEKS_MOCK, SOLSTICE_DAYS } from '../constants';
import { SolsticeWeek } from '../types';

const C = { bg: '#000', bgS: '#0d0d0d', red: '#E6392F', org: '#FF7A00', gray: '#606060', cream: '#F9F2D7' };

type PaymentMode = 'auto_subscription' | 'manual_monthly' | 'individual_days' | 'full_combo';
type ComboType   = 'full_combo' | 'individual_days';

// Paso 1 — combo: qué está comprando el cliente.
const COMBOS: { id: ComboType; label: string; sub: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'full_combo',      label: 'Combo completo',  sub: '5 días con todo incluido (hospedaje, lancha, fiestas)', icon: <Star size={18} />,        badge: 'Más popular' },
  { id: 'individual_days', label: 'Días sueltos',    sub: 'Elegís solo los días que querés ir',                     icon: <ListChecks size={18} /> },
];

// Paso 1.4 — forma de pago: solo aplica cuando el cliente elige combo completo.
// (Días sueltos siempre se pagan al instante por Bold, sin cuotas posibles.)
type PaymentMethod = 'full_combo' | 'auto_subscription' | 'manual_monthly';
const PAYMENT_METHODS: { id: PaymentMethod; label: string; sub: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'full_combo',        label: 'Todo de una',           sub: 'Pagás hoy, sin cuotas, sin recargos',                  icon: <Star size={18} />,     badge: 'Mejor precio' },
  { id: 'auto_subscription', label: 'Débito automático',     sub: '$40K hoy + cargos automáticos cada mes',               icon: <Repeat size={18} />,   badge: 'Más fácil' },
  { id: 'manual_monthly',    label: 'Mes a mes con tarjeta', sub: '$40K hoy + tarjeta guardada (te avisamos 24h antes)',  icon: <Calendar size={18} /> },
];

// Tabla legacy MODES — la dejamos para compat con código downstream (resumen,
// step 4, etc) que lookup por id.
const MODES: { id: PaymentMode; label: string; sub: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'auto_subscription', label: 'Débito automático',   sub: '$40K hoy + cargos automáticos cada mes',         icon: <Repeat size={18} />,    badge: 'Más fácil' },
  { id: 'manual_monthly',    label: 'Mes a mes con tarjeta', sub: '$40K hoy + tarjeta guardada (te avisamos 24h antes)', icon: <Calendar size={18} /> },
  { id: 'individual_days',   label: 'Días sueltos prepagos', sub: 'Comprás solo los días que querés, 100% online', icon: <ListChecks size={18} /> },
  { id: 'full_combo',        label: 'Todo de una',           sub: 'Pagás hoy, sin cuotas, sin recargos',           icon: <Star size={18} />,     badge: 'Mejor precio' },
];

interface SeasonData {
  id: string;
  entry_price: number;
  combo_total: number;
  installments: number;
  phase1_limit: number;
}

interface Props {
  initialWeek?: string;
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

export default function SolsticeReserva({ initialWeek, initialInviteCode, onBack }: Props) {
  const { requestCustomerOtp, verifyOtpUnified, currentCustomer, currentUser } = useStore();

  // ── Real data from DB (falls back to mock if not yet migrated) ──
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [weeks, setWeeks]   = useState<SolsticeWeek[]>(SOLSTICE_WEEKS_MOCK);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: seasonRow } = await supabase
          .from('solstice_seasons')
          .select('id,entry_price,combo_total,installments,phase1_limit')
          .eq('status', 'open')
          .single();
        if (seasonRow) setSeason(seasonRow as SeasonData);

        const { data: weekRows } = await supabase
          .from('solstice_weeks')
          .select('*')
          .order('start_date');
        if (weekRows && weekRows.length > 0) setWeeks(weekRows as SolsticeWeek[]);
      } catch {
        // DB not yet migrated — mock data stays
      }
    }
    loadData();
  }, []);

  // ── State ──
  // Invitado por link de lancha: arranca directo en datos (2) — su semana/combo
  // se heredan del líder en la auto-validación, no los elige.
  const [step, setStep]       = useState<number>(initialInviteCode ? 2 : (initialWeek ? 1 : 0));
  const [selWeek, setSelWeek] = useState<SolsticeWeek | null>(
    initialWeek ? SOLSTICE_WEEKS_MOCK.find(w => w.university === initialWeek) || null : null
  );
  const [mode, setMode]           = useState<PaymentMode | null>(null);
  const [comboType, setComboType] = useState<ComboType | null>(null);
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
  const [boatOccupancy, setBoatOccupancy] = useState<Record<string, number>>({});
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
          .select('boat_id, slots_claimed, status')
          .neq('status', 'cancelled');
        if (!data || !mounted) return;
        const map: Record<string, number> = {};
        for (const r of data) {
          map[r.boat_id] = (map[r.boat_id] || 0) + (r.slots_claimed || 0);
        }
        setBoatOccupancy(map);
      } catch {}
    }

    loadBoats();
    loadOccupancy();

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
  const isCombo = comboType === 'full_combo';

  // El día 3 (Lanchas + Beach Club) está incluido en el combo; en días sueltos
  // solo si lo eligieron explícitamente.
  const includesBoat = isCombo || (comboType === 'individual_days' && selDays.includes(3));

  const selectedBoat = selectedBoatId ? boats.find(b => b.id === selectedBoatId) : null;
  // Precio "desde": la lancha más barata (para mostrar antes de que elija una).
  const cheapestBoatPrice = (() => {
    const prices = boats.map(b => b.price_per_person || 0).filter(p => p > 0);
    return prices.length ? Math.min(...prices) : 0;
  })();
  // En DÍAS SUELTOS el Día 3 (lanchas) cuesta el precio por persona de la lancha
  // ELEGIDA (cada lancha tiene su precio), no un fijo. Si aún no elige, "desde"
  // la más barata. En combo el día 3 va en el combo y la lancha se suma aparte.
  const dayTotal  = selDays.reduce((a, d) => {
    if (comboType === 'individual_days' && d === 3) {
      return a + (selectedBoat?.price_per_person ?? cheapestBoatPrice);
    }
    return a + (SOLSTICE_DAYS.find(x => x.day === d)?.price || 0);
  }, 0);

  // ¿Hay alguna lancha con cupo? Si TODAS están llenas, el cliente igual debe
  // poder avanzar al pago (el equipo le asigna lancha después) — si no, se
  // queda bloqueado y se pierde la venta.
  const anyBoatAvailable = boats.some(b => {
    const claimed = boatOccupancy[b.id] || 0;
    const available = Math.max(0, (b.capacity || 0) - claimed);
    return b.status !== 'sold_out' && available > 0;
  });
  const allBoatsFull = boats.length > 0 && !anyBoatAvailable;
  // La parte de la lancha solo se cobra aparte en el combo (en días sueltos
  // el día 3 ya la incluye en su precio).
  const boatPart  = (isCombo && includesBoat && selectedBoat)
    ? (selectedBoat.price_per_person || 0)
    : 0;

  // Descuento del vendedor: si el cliente llegó por un link /sol/p/CODE de un
  // vendedor con descuento, se aplica automáticamente al paquete.
  const sellerDiscountPct = (() => {
    try { return Number(sessionStorage.getItem('ms_seller_discount')) || 0; }
    catch { return 0; }
  })();

  // Paquete base (combo o días + lancha), luego descuento del vendedor, luego
  // ticket service 6.6% sobre lo ya descontado.
  // El INVITADO paga el precio por persona de la lancha a la que lo invitaron
  // (no el combo ni los días) — el mismo precio que vio en la invitación.
  const packageBase   = isInvitee
    ? (invitePricePerPerson ?? selectedBoat?.price_per_person ?? 0)
    : (isCombo ? s.combo_total : dayTotal) + boatPart;
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
      // El invitado compra el día 3 (lancha + beach club) de la lancha del líder.
      setComboType('individual_days');
      setSelDays([3]);
      setMode('individual_days');
      // Saltar selección de semana/combo/lancha → directo a sus datos.
      setStep(opts?.advance ? 3 : 2);
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
              status:                 'open',
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
        redirectUrl:      `${window.location.origin}/gracias`,
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

  // Orden nuevo (owner jun 2026): combo(1) → lancha(2.7) → forma de pago(1.4)
  // → datos(2) → otp(2.5) → resumen(3) → pago(4) → confirmación(5).
  // Días sueltos saltan forma de pago (sin cuotas).
  const goBack = () => {
    if      (step === 5)            onBack();
    else if (step === 4)            setStep(3);
    else if (step === 3)            setStep(currentCustomer ? 2 : (2.5 as any));
    else if (step === (2.5 as any)) setStep(2);
    // El invitado heredó semana/combo/lancha: no hay pasos previos a sus datos,
    // así que "atrás" desde datos sale de la reserva (vuelve a la invitación).
    else if (step === 2 && isInvitee) onBack();
    else if (step === 2)            setStep(isCombo ? (1.4 as any) : (includesBoat ? (2.7 as any) : (1.5 as any)));
    else if (step === (1.4 as any)) setStep(2.7 as any);                 // forma de pago viene tras lancha
    else if (step === (2.7 as any)) setStep(isCombo ? 1 : (1.5 as any)); // lancha viene tras combo/días
    else if (step === (1.5 as any)) setStep(1);
    else if (step === 1)            setStep(0);
    else                            onBack();
  };

  const stepLabel = step === (2.7 as any)
    ? 'Lancha'
    : step === (1.4 as any)
      ? 'Forma de pago'
      : step === (1.5 as any)
        ? 'Días'
        : ['Semana', 'Combo', 'Tus datos', '', 'Pago', '✓'][Math.min(Math.floor(step), 5)];
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

      {/* Progress header */}
      <div className="sticky top-0 z-10 px-6 py-4 flex items-center gap-4" style={{ background: C.bg, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
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
                <h2 className="text-3xl uppercase mb-2" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>¿Cuál semana?</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Selecciona tu universidad</p>
              </div>
              <div className="space-y-4">
                {weeks.map(week => {
                  const pct  = (week.reserved / week.capacity) * 100;
                  const left = week.capacity - week.reserved;
                  return (
                    <button key={week.id} onClick={() => { setSelWeek(week); setStep(1); }}
                      className="w-full p-6 text-left"
                      style={{
                        borderRadius: '24px',
                        background: 'rgba(255,255,255,0.04)',
                        backdropFilter: 'blur(32px) saturate(180%)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                        transition: 'all 0.35s cubic-bezier(0.25,0.46,0.45,0.94)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)';
                        (e.currentTarget as HTMLButtonElement).style.border = '0.5px solid rgba(230,57,47,0.30)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLButtonElement).style.border = '0.5px solid rgba(255,255,255,0.10)';
                      }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", fontWeight: 300 }}>{week.university}</h3>
                        <span className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>{week.reserved}/{week.capacity}</span>
                      </div>
                      <p className="text-xs uppercase mb-4" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                        {new Date(week.start_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })} — {new Date(week.end_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                      </p>
                      {/* Urgency / progress bar */}
                      <div className="w-full mb-1" style={{ height: '2px', background: `${C.gray}20`, borderRadius: '999px' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: C.red, borderRadius: '999px', transition: 'width 0.8s' }} />
                      </div>
                      <p className="text-[9px] uppercase" style={{ color: left <= 20 ? C.red : C.gray, letterSpacing: '0.1em', fontWeight: 500 }}>
                        {left <= 20 ? `¡Solo ${left} cupos!` : `${left} cupos disponibles`}
                      </p>
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
            const totalK = Math.round((season?.combo_total ?? 400000) / 1000);
            const comboMeta: Record<ComboType, { headline: string; bigPrice: string; afterPrice?: string; tags: string[] }> = {
              full_combo: {
                headline: '5 días con todo incluido — hospedaje, lancha, fiestas, beach club',
                bigPrice: `$${totalK}K`,
                afterPrice: ' total',
                tags: [`Reservás con $${entryK}K`, 'Después: cuotas o pago de una', 'Mejor precio por día'],
              },
              individual_days: {
                headline: 'Elegís solo los días que querés ir, sin compromiso de combo',
                bigPrice: 'Desde $70K',
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
                    const data = comboMeta[c.id];
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
                          if (comboType === 'individual_days') {
                            setMode('individual_days');
                            setStep(1.5 as any);
                          } else {
                            // Combo: primero elige lancha, después forma de pago.
                            if (mode === 'individual_days') setMode(null);
                            setStep(2.7 as any);
                          }
                        }}
                        className="flex-shrink-0 px-7 py-4 text-sm uppercase flex items-center gap-3"
                        style={{ background: C.red, color: '#fff', letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 600, boxShadow: '0 12px 32px rgba(230,57,47,0.45)' }}
                      >
                        {comboType === 'individual_days' ? 'Elegir días' : 'Elegir lancha'}
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
                headline: `${entryK}K hoy + ${cuotas} cuotas de ${cuotaK}K`,
                bigPrice: `$${cuotaK}K`,
                afterPrice: `/mes · ${cuotas}× automático`,
                tags: ['Cero olvidos', 'Sin recargos por mora'],
                cobro:    `Hoy pagás $${entryK}K por Wompi. Las ${cuotas} cuotas de $${cuotaK}K se cobran cada mes.`,
                respaldo: 'Si la tarjeta no tiene fondos, 7 días de gracia. Devolución del adelanto solo dentro de los primeros 15 días desde la compra.',
              },
              manual_monthly: {
                headline: `${entryK}K hoy + tarjeta guardada`,
                bigPrice: `$${cuotaK}K`,
                afterPrice: `/mes · aviso 24h antes`,
                tags: ['Avisamos por WhatsApp', 'Movés la fecha 1× si necesitás'],
                cobro:    `Hoy pagás $${entryK}K por Wompi. Te avisamos 24h antes de cada cuota de $${cuotaK}K.`,
                respaldo: 'Podés posponer 1 cuota hasta 7 días sin costo. Devolución del adelanto solo dentro de los primeros 15 días desde la compra.',
              },
              full_combo: {
                headline: `Pagás hoy y te olvidás`,
                bigPrice: `$${totalK}K`,
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
                    Combo completo · Reserva hoy con <strong style={{ color: C.red }}>${entryK}K</strong> y elige cómo seguir
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
                              <div className="space-y-3">
                                <div className="flex gap-3">
                                  <span className="text-[9px] uppercase flex-shrink-0 mt-0.5" style={{ color: C.red, letterSpacing: '0.25em', fontWeight: 600, minWidth: '64px' }}>
                                    Cobro
                                  </span>
                                  <p className="text-[11px] leading-relaxed" style={{ color: C.cream, fontWeight: 400 }}>
                                    {data.cobro}
                                  </p>
                                </div>
                                <div className="flex gap-3">
                                  <span className="text-[9px] uppercase flex-shrink-0 mt-0.5" style={{ color: C.red, letterSpacing: '0.25em', fontWeight: 600, minWidth: '64px' }}>
                                    Respaldo
                                  </span>
                                  <p className="text-[11px] leading-relaxed" style={{ color: `${C.gray}dd`, fontWeight: 400 }}>
                                    {data.respaldo}
                                  </p>
                                </div>
                              </div>
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
                    <GarantiaItem step="1" title="Reserva validada" desc={`Tu $${entryK}K se cobra vía Bold con firma cifrada. El lugar queda bloqueado solo si el pago aprueba.`} />
                    <GarantiaItem step="2" title="Tarjeta autorizada" desc="En modalidades de cuotas, autorizás cobros automáticos. Sin autorización, no se confirma." />
                    <GarantiaItem step="3" title="Recordatorios reales" desc="WhatsApp 24h antes de cada pago + email. Si la tarjeta no tiene fondos, 7 días de gracia." />
                  </ul>
                </div>

                {/* Trust strip */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2">
                  <span className="text-[9px] uppercase" style={{ color: `${C.gray}cc`, letterSpacing: '0.2em', fontWeight: 500 }}>
                    🔒 Pago seguro · Bold
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
                          ${chargeK}K <span className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>COP</span>
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
                {SOLSTICE_DAYS.map(day => {
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
                        {day.day === 3
                          ? `desde $${Math.round((cheapestBoatPrice || day.price) / 1000)}K`
                          : `$${Math.round(day.price / 1000)}K`}
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
                    <span>Tu selección ({selDays.length} días)</span><span>${Math.round(dayTotal/1000)}K</span>
                  </div>
                  <div className="flex justify-between text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                    <span>Combo completo</span><span>${Math.round(s.combo_total/1000)}K</span>
                  </div>
                  {dayTotal > s.combo_total && (
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
                  Día 3 · Lanchas + Beach Club
                </p>
                <h2 className="text-3xl md:text-4xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
                  {boatChoice === 'join' ? 'Te unís a una lancha' : 'Elegí tu lancha'}
                </h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>
                  {boatChoice === 'join'
                    ? 'Llegaste por un link de invitación · ya quedás en esa lancha'
                    : 'Elegí tu lancha y al pagar te damos un link para invitar a tus panas'}
                </p>
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
                        Te unís a la lancha {joinLeaderName ? <>de <strong style={{ color: C.cream }}>{joinLeaderName}</strong></> : 'de tu pana'} · <strong style={{ color: C.cream }}>{boats.find(b => b.id === selectedBoatId)?.name || 'Lancha'}</strong>.
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

              {/* Líder: catálogo de lanchas */}
              {boatChoice === 'lead' && (
                <div className="space-y-3">
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
                      const available = Math.max(0, (b.capacity || 0) - claimed);
                      const isFull    = available <= 0;
                      const isSoldOut = b.status === 'sold_out' || isFull;
                      const isJustReserved = recentBoatId === b.id;
                      const priceK = Math.round((b.price_per_person || 0) / 1000);
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
                              Lleno
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
                                      width: photos.length === 1 ? '100%' : '70%',
                                      maxWidth: '320px',
                                      aspectRatio: '4 / 3',
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
                                  color: available <= 5 && available > 0 ? '#FFB48C' : isFull ? C.gray : C.red,
                                  letterSpacing: '0.2em',
                                  fontWeight: 600,
                                }}>
                                  {isFull ? 'Sin cupos' : `${available} de ${b.capacity} cupos`}
                                </span>
                                {priceK > 0 && (
                                  <span className="text-[10px]" style={{ color: C.gray, letterSpacing: '0.05em' }}>
                                    · ${priceK}K / persona
                                  </span>
                                )}
                              </div>
                              {/* Mini barra de ocupación */}
                              {!isFull && (b.capacity || 0) > 0 && (
                                <div className="w-full mt-2 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                                  <div
                                    style={{
                                      width: `${(claimed / b.capacity) * 100}%`,
                                      height: '100%',
                                      background: available <= 5 ? '#FFB48C' : C.red,
                                      transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                                    }}
                                  />
                                </div>
                              )}
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
                const canAdvanceLead = !!selectedBoatId || (boats.length === 0) || allBoatsFull;
                const ready = boatChoice === 'join' ? !!boatReservationId : canAdvanceLead;
                return (
              <button
                onClick={() => {
                  if (!ready) return;
                  setStep(isCombo ? (1.4 as any) : 2);
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
                {isCombo ? 'Cómo pagar' : 'Continuar al resumen'} <ChevronRight size={16} />
              </button>
                );
              })()}
            </motion.div>
          )}

          {/* STEP 3 — Resumen + confirmar */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-3xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>Resumen</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Confirma antes de pagar</p>
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
                  ['Semana',    selWeek?.university],
                  ['Modalidad', MODES.find(m => m.id === mode)?.label],
                  ['Nombre',    name],
                  ['Email',     email],
                  comboType === 'individual_days' ? ['Días', selDays.map(d => `Día ${d}`).join(', ')] : null,
                  includesBoat && selectedBoatId
                    ? ['Lancha', boats.find(b => b.id === selectedBoatId)?.name || 'Seleccionada']
                    : null,
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

                {/* ── Desglose de precio ──────────────────────────────────── */}
                <div className="pt-4 mt-2 space-y-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
                  <div className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em', fontWeight: 500 }}>
                    <span style={{ color: C.gray }}>{isCombo ? 'Combo de fiestas' : `Días sueltos (${selDays.length})`}</span>
                    <span style={{ color: C.cream }}>${Math.round((isCombo ? s.combo_total : dayTotal) / 1000)}K</span>
                  </div>
                  {boatPart > 0 && (
                    <div className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em', fontWeight: 500 }}>
                      <span style={{ color: C.gray }}>Lancha (tu parte)</span>
                      <span style={{ color: C.cream }}>${Math.round(boatPart / 1000)}K</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em', fontWeight: 600 }}>
                      <span style={{ color: '#86efac' }}>Descuento ({sellerDiscountPct}%)</span>
                      <span style={{ color: '#86efac' }}>−${Math.round(discountAmount / 1000)}K</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em', fontWeight: 500 }}>
                    <span style={{ color: C.gray }}>Ticket service (6.6%)</span>
                    <span style={{ color: C.cream }}>${Math.round(ticketService / 1000)}K</span>
                  </div>
                  <div className="flex justify-between items-center pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-xs uppercase" style={{ color: C.cream, fontWeight: 600, letterSpacing: '0.1em' }}>Total</span>
                    <span className="text-xl" style={{ color: C.cream, fontWeight: 400 }}>${Math.round(grandTotal / 1000)}K</span>
                  </div>
                </div>

                {/* Pago de hoy */}
                <div className="pt-3 mt-1 flex justify-between items-center" style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
                  <span className="text-sm uppercase" style={{ color: C.gray, fontWeight: 500 }}>
                    {isInstallmentMode ? 'Adelanto hoy' : 'Pago hoy'}
                  </span>
                  <span className="text-3xl" style={{ color: C.red, fontWeight: 300 }}>${chargeK}K</span>
                </div>
                {isInstallmentMode && (
                  <p className="text-[9px] uppercase text-center" style={{ color: C.gray, fontWeight: 500 }}>
                    + {effectiveInstallments} cuotas de ${Math.round(installmentBase / effectiveInstallments / 1000)}K/mes
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
                {processing ? <Loader2 className="animate-spin" /> : <><Shield size={16} /> Ir a pagar ${chargeK}K</>}
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
                  <p className="text-5xl" style={{ color: C.cream, fontWeight: 300 }}>${chargeK}K</p>
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
                        : <><CreditCard size={16} /> Pagar ${chargeK}K con Wompi</>}
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
                  : `Hoy pagas el adelanto de $${chargeK}K por Wompi · las cuotas se cobran mes a mes`}
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
              <BoardingRow label="Próxima cuota" value={`$${installmentAmountK}K / mes`} highlight />
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
              Eres <strong>líder</strong>. Mandales este <strong>link</strong> a tus panas — al abrirlo quedan automáticamente en tu lancha, sin códigos:
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

        {/* Hospedaje upsell */}
        {lodgings.length > 0 && lodgeStatus !== 'reserved' && (
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
                        {priceK > 0 ? `Desde $${priceK}K/noche` : 'Consultá tarifas'} {l.category ? `· ${l.category}` : ''}
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
            💬 Avisar a tus panas
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
