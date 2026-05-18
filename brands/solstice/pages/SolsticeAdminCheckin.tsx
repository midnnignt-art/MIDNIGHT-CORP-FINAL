import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, CheckCircle2, Clock, Loader2, RefreshCw,
  Camera, CameraOff, Users, CalendarCheck, X, ScanLine,
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../context/StoreContext';
import { toast } from '../../../lib/toast';

const C = {
  bg: '#000', bgS: '#0d0d0d', bgT: '#111',
  red: '#E6392F', gray: '#606060', cream: '#F9F2D7',
  green: '#10b981', yellow: '#f59e0b',
};

interface Reg {
  id: string; order_number: string; customer_name: string;
  customer_phone: string; customer_university: string;
  payment_mode: string; status: string; total_amount: number; amount_paid: number;
}
interface CheckinRecord { registration_id: string; day_number: number; checked_in_at: string; }

const DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function SolsticeAdminCheckin() {
  const { currentUser } = useStore();
  const [regs, setRegs]         = useState<Reg[]>([]);
  const [checkins, setCheckins] = useState<CheckinRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [day, setDay]           = useState(1);
  const [uniFilter, setUniFilter] = useState('all');
  const [boatFilter, setBoatFilter] = useState('all');
  const [boatPassengers, setBoatPassengers] = useState<Array<{ registration_id: string; boat_id: string; boat_name: string }>>([]);
  const [search, setSearch]     = useState('');
  const [scanning, setScanning] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: r }, { data: c }] = await Promise.all([
        supabase.from('solstice_registrations')
          .select('id,order_number,customer_name,customer_phone,customer_university,payment_mode,status,total_amount,amount_paid')
          .neq('status', 'cancelled')
          .order('customer_name'),
        supabase.from('solstice_checkins').select('registration_id,day_number,checked_in_at'),
      ]);
      setRegs((r || []) as Reg[]);
      setCheckins((c || []) as CheckinRecord[]);

      // Cargar pasajeros de lanchas para filtro del Día 3
      const { data: pax } = await supabase
        .from('solstice_boat_passengers')
        .select('registration_id, boat_reservation_id');
      if (pax && pax.length > 0) {
        const resIds = [...new Set(pax.map(p => p.boat_reservation_id))];
        const { data: bres } = await supabase
          .from('solstice_boat_reservations')
          .select('id, boat_id')
          .in('id', resIds);
        const boatIds = [...new Set((bres || []).map(b => b.boat_id))];
        const { data: boats } = await supabase
          .from('solstice_boats')
          .select('id, name')
          .in('id', boatIds);
        const bresMap = new Map((bres || []).map(b => [b.id, b]));
        const boatMap = new Map((boats || []).map(b => [b.id, b.name]));
        setBoatPassengers(
          pax.map((p: any) => {
            const br = bresMap.get(p.boat_reservation_id);
            return {
              registration_id: p.registration_id,
              boat_id: br?.boat_id ?? '',
              boat_name: br ? (boatMap.get(br.boat_id) || '—') : '—',
            };
          }).filter(x => x.boat_id)
        );
      }
    } catch { /* DB not ready */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // ── QR scanner lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!scanning) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    const scanner = new Html5QrcodeScanner(
      'qr-checkin-reader',
      { fps: 10, qrbox: { width: 260, height: 260 } },
      false,
    );
    scanner.render(
      async (text: string) => {
        // text is the order_number or full URL — extract order
        const order = text.includes('?') ? text.split('?')[0].split('/').pop() : text.trim();
        const found = regs.find(r => r.order_number === order);
        if (!found) {
          toast.error(`Orden no encontrada: ${order}`);
          return;
        }
        setScanning(false);
        await checkinReg(found.id, found.customer_name);
      },
      () => { /* ignore per-frame errors */ },
    );
    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [scanning, regs]);

  // ── Universities ──────────────────────────────────────────────────────────
  const universities = useMemo(
    () => [...new Set(regs.map(r => r.customer_university))].sort(),
    [regs],
  );

  // ── Boats list para filtro del Día 3 ─────────────────────────────────────
  const boatsList = useMemo(() => {
    const byBoat = new Map<string, string>();
    boatPassengers.forEach(p => {
      if (p.boat_id && !byBoat.has(p.boat_id)) byBoat.set(p.boat_id, p.boat_name);
    });
    return Array.from(byBoat.entries()).map(([id, name]) => ({ id, name }));
  }, [boatPassengers]);

  // Mapa rápido registration_id → boat_id
  const regToBoat = useMemo(() => {
    const m = new Map<string, string>();
    boatPassengers.forEach(p => { m.set(p.registration_id, p.boat_id); });
    return m;
  }, [boatPassengers]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return regs
      .filter(r => uniFilter === 'all' || r.customer_university === uniFilter)
      .filter(r => {
        // Filtro de lancha solo aplica si día === 3
        if (day !== 3 || boatFilter === 'all') return true;
        return regToBoat.get(r.id) === boatFilter;
      })
      .filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return r.customer_name.toLowerCase().includes(q) ||
               r.order_number.toLowerCase().includes(q) ||
               r.customer_phone.includes(q);
      });
  }, [regs, uniFilter, search, day, boatFilter, regToBoat]);

  const isCheckedIn = (regId: string) =>
    checkins.some(c => c.registration_id === regId && c.day_number === day);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const scope = uniFilter === 'all' ? regs : regs.filter(r => r.customer_university === uniFilter);
    const done  = scope.filter(r => isCheckedIn(r.id)).length;
    return { total: scope.length, done, pending: scope.length - done };
  }, [regs, checkins, day, uniFilter]);

  // ── Check-in action ───────────────────────────────────────────────────────
  const checkinReg = async (regId: string, name: string) => {
    if (!currentUser || isCheckedIn(regId)) return;
    setCheckingId(regId);
    try {
      const { error } = await supabase.from('solstice_checkins').insert({
        registration_id: regId,
        day_number: day,
        checked_in_by: currentUser.user_id,
      });
      if (error && error.code !== '23505') throw error; // 23505 = unique violation (already in)
      toast.success(`✓ Check-in: ${name} — Día ${day}`);
      setCheckins(prev => [...prev, { registration_id: regId, day_number: day, checked_in_at: new Date().toISOString() }]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCheckingId(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <Loader2 size={28} className="animate-spin" style={{ color: C.red }} />
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>

      {/* Header */}
      <div className="px-8 pt-10 pb-6" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.10)' }}>
        <p className="text-[9px] uppercase mb-1"
          style={{ color: C.red, letterSpacing: '0.08em', fontWeight: 500 }}>Admin</p>
        <h1 className="text-3xl uppercase"
          style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
          Check-in
        </h1>
        <p className="text-xs uppercase mt-1" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
          Control de asistencia por día · SOLSTICE 2026
        </p>
      </div>

      {/* Day selector + filters */}
      <div className="px-8 pt-6 space-y-4">

        {/* Day tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[9px] uppercase mr-2"
            style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Día</span>
          {DAYS.map(d => (
            <button key={d} onClick={() => setDay(d)}
              className="w-9 h-9 text-xs transition-all"
              style={{
                background: day === d ? C.red : 'rgba(255,255,255,0.04)',
                color: day === d ? C.cream : C.gray,
                border: day === d ? '0.5px solid rgba(230,57,47,0.40)' : '0.5px solid rgba(255,255,255,0.10)',
                borderRadius: '999px',
                fontWeight: day === d ? 500 : 400,
                transition: 'all 0.3s ease',
              }}>
              {d}
            </button>
          ))}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 max-w-sm">
          {[
            { label: 'Registrados',  value: stats.total,   color: C.cream  },
            { label: 'Check-in ✓',   value: stats.done,    color: C.green  },
            { label: 'Pendientes',   value: stats.pending, color: stats.pending > 0 ? C.yellow : C.gray },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(32px) saturate(180%)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                borderRadius: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}>
              <p className="text-[8px] uppercase mb-1"
                style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>{label}</p>
              <p className="text-xl" style={{ color, fontWeight: 600 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-52 px-3 py-2"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(32px) saturate(180%)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: '16px',
            }}>
            <Search size={13} style={{ color: C.gray }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nombre, orden o teléfono…"
              className="flex-1 text-xs outline-none bg-transparent"
              style={{ color: C.cream }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ color: C.gray, transition: 'all 0.3s ease' }}>
                <X size={12} />
              </button>
            )}
          </div>
          <select value={uniFilter} onChange={e => setUniFilter(e.target.value)}
            className="px-3 py-2 text-xs outline-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(32px) saturate(180%)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: '16px',
              color: C.cream,
            }}>
            <option value="all">Todas las universidades</option>
            {universities.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          {day === 3 && boatsList.length > 0 && (
            <select value={boatFilter} onChange={e => setBoatFilter(e.target.value)}
              className="px-3 py-2 text-xs outline-none"
              style={{
                background: 'rgba(230,57,47,0.10)',
                backdropFilter: 'blur(32px) saturate(180%)',
                border: '0.5px solid rgba(230,57,47,0.30)',
                borderRadius: '16px',
                color: C.cream,
              }}>
              <option value="all">Todas las lanchas</option>
              {boatsList.map(b => <option key={b.id} value={b.id}>🚤 {b.name}</option>)}
            </select>
          )}
          <button onClick={() => setScanning(v => !v)}
            className="flex items-center gap-2 px-6 py-3 text-[10px] uppercase tracking-widest transition-all"
            style={{
              background: scanning ? 'rgba(230,57,47,0.20)' : 'transparent',
              border: scanning ? '0.5px solid rgba(230,57,47,0.40)' : '0.5px solid rgba(255,255,255,0.15)',
              color: scanning ? C.red : C.gray,
              borderRadius: '999px',
              fontWeight: 500,
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}>
            {scanning ? <CameraOff size={13} /> : <Camera size={13} />}
            {scanning ? 'Cerrar cámara' : 'Escanear QR'}
          </button>
          <button onClick={load}
            className="p-2 transition-all"
            style={{ color: C.gray, borderRadius: '999px', transition: 'all 0.3s ease' }}
            onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
            onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* QR Scanner panel */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-8 pt-4 overflow-hidden">
            <div className="max-w-sm p-4 space-y-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(32px) saturate(180%)',
                border: '0.5px solid rgba(230,57,47,0.40)',
                borderRadius: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}>
              <div className="flex items-center gap-2">
                <ScanLine size={13} style={{ color: C.red }} />
                <p className="text-[9px] uppercase"
                  style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
                  Escanea el QR del ticket — Día {day}
                </p>
              </div>
              <div id="qr-checkin-reader" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Registration list */}
      <div className="px-8 pt-5 pb-20 max-w-4xl">
        {filtered.length === 0 ? (
          <div className="py-20 text-center" style={{ color: C.gray }}>
            <Users size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-xs uppercase" style={{ letterSpacing: '0.08em', fontWeight: 500 }}>Sin registros</p>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '0.5px solid rgba(255,255,255,0.10)',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          }}>
            <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase"
              style={{ color: C.gray, borderBottom: '0.5px solid rgba(255,255,255,0.10)', letterSpacing: '0.08em', fontWeight: 500 }}>
              <div className="col-span-4">Comprador</div>
              <div className="col-span-3">Universidad</div>
              <div className="col-span-2">Orden</div>
              <div className="col-span-3 text-right">Día {day}</div>
            </div>
            {filtered.map(reg => {
              const done = isCheckedIn(reg.id);
              const busy = checkingId === reg.id;
              return (
                <div key={reg.id}
                  className="grid grid-cols-12 px-5 py-3.5 items-center"
                  style={{
                    borderBottom: '0.5px solid rgba(255,255,255,0.08)',
                    background: done ? 'rgba(16,185,129,0.06)' : 'transparent',
                    transition: 'all 0.3s ease',
                  }}>
                  <div className="col-span-4">
                    <p className="text-xs font-medium uppercase truncate"
                      style={{ color: done ? C.green : C.cream }}>
                      {reg.customer_name}
                    </p>
                    <p className="text-[9px]" style={{ color: C.gray }}>{reg.customer_phone}</p>
                  </div>
                  <div className="col-span-3 text-[10px] uppercase truncate" style={{ color: C.gray }}>
                    {reg.customer_university}
                  </div>
                  <div className="col-span-2 text-[9px] font-mono" style={{ color: C.gray }}>
                    {reg.order_number}
                  </div>
                  <div className="col-span-3 flex justify-end">
                    {done ? (
                      <div className="flex items-center gap-1.5 px-3 py-1"
                        style={{
                          background: 'rgba(16,185,129,0.15)',
                          border: '0.5px solid rgba(16,185,129,0.30)',
                          borderRadius: '999px',
                        }}>
                        <CheckCircle2 size={12} style={{ color: C.green }} />
                        <span className="text-[9px] uppercase" style={{ color: C.green, fontWeight: 500 }}>
                          Ingresó
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => checkinReg(reg.id, reg.customer_name)}
                        disabled={busy}
                        className="flex items-center gap-1.5 px-4 py-2 text-[9px] uppercase tracking-widest disabled:opacity-40"
                        style={{
                          background: 'rgba(230,57,47,0.20)',
                          border: '0.5px solid rgba(230,57,47,0.40)',
                          color: C.red,
                          borderRadius: '999px',
                          fontWeight: 500,
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={e => {
                          if (!busy) {
                            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                        }}>
                        {busy
                          ? <Loader2 size={10} className="animate-spin" />
                          : <><CalendarCheck size={10} /> Check-in</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary bar */}
        {stats.total > 0 && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(32px) saturate(180%)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: '24px',
            }}>
            <div className="flex-1 h-1.5 overflow-hidden" style={{ background: 'rgba(96,96,96,0.20)', borderRadius: '999px' }}>
              <div className="h-full transition-all"
                style={{ width: `${(stats.done / stats.total) * 100}%`, background: C.green, borderRadius: '999px' }} />
            </div>
            <span className="text-[10px] shrink-0" style={{ color: C.green, fontWeight: 600 }}>
              {stats.done}/{stats.total} — {Math.round((stats.done / stats.total) * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
