import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Ship, Users, Loader2, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Props {
  inviteCode: string;
}

interface BoatReservationDetail {
  id: string;
  invite_code: string;
  leader_name: string;
  status: string;
  total_capacity: number;
  slots_claimed: number;
  boat: {
    name: string;
    image_url: string | null;
    description: string | null;
    capacity: number;
    price_per_person: number;
  } | null;
}

const C = { bg: '#000', red: '#E6392F', cream: '#F9F2D7', gray: '#606060' };

export default function SolsticeInviteLanding({ inviteCode }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData]       = useState<BoatReservationDetail | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';

    async function load() {
      const code = inviteCode.toUpperCase();
      try {
        const { data: res, error: e1 } = await supabase
          .from('solstice_boat_reservations')
          .select('id, invite_code, leader_name, status, total_capacity, slots_claimed, boat_id')
          .ilike('invite_code', code)
          .maybeSingle();

        if (e1 || !res) {
          setError('Código no encontrado.');
          setLoading(false);
          return;
        }

        const { data: boat } = await supabase
          .from('solstice_boats')
          .select('name, image_url, description, capacity, price_per_person')
          .eq('id', res.boat_id)
          .maybeSingle();

        setData({ ...res, boat: boat as any });
        setLoading(false);
      } catch (err: any) {
        setError('Error al cargar la invitación.');
        setLoading(false);
      }
    }
    load();
  }, [inviteCode]);

  const handleAccept = () => {
    const code = inviteCode.toUpperCase();
    sessionStorage.setItem('solstice_boat_invite', code);
    window.location.href = '/sol?invite=' + encodeURIComponent(code);
  };

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={28} style={{ color: C.red }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }} className="flex flex-col items-center justify-center px-6 text-center gap-4">
        <AlertCircle size={28} style={{ color: C.red }} />
        <h1 className="text-2xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>
          Invitación no válida
        </h1>
        <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>
          {error || 'Esta lancha ya no acepta invitados.'}
        </p>
        <a href="/?solstice=1" className="text-xs uppercase mt-4"
          style={{ color: C.red, letterSpacing: '0.2em', textDecoration: 'underline' }}>
          Reservar lancha propia
        </a>
      </div>
    );
  }

  const isFull   = data.status === 'full' || data.slots_claimed >= data.total_capacity;
  const isClosed = data.status === 'cancelled' || data.status === 'closed';
  const slotsLeft = Math.max(0, data.total_capacity - data.slots_claimed);
  const priceK = Math.round((data.boat?.price_per_person || 0) / 1000);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }} className="px-5 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
            Te invitaron a una lancha
          </p>
          <h1 className="text-3xl md:text-4xl uppercase mb-2" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300, lineHeight: 1.1 }}>
            {data.leader_name?.split(' ')[0] || 'Un pana'}<br/>te reservó cupo
          </h1>
          <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>
            Día 3 · Lanchas + Beach Club · Solstice 2026
          </p>
        </motion.div>

        {/* Boat card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '0.5px solid rgba(255,255,255,0.10)',
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          }}
        >
          {data.boat?.image_url ? (
            <img src={data.boat.image_url} alt={data.boat.name}
              className="w-full h-44 object-cover"
              style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }} />
          ) : (
            <div className="w-full h-44 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${C.red}20, ${C.red}05)`, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
              <Ship size={48} style={{ color: C.red }} />
            </div>
          )}

          <div className="p-5 space-y-3">
            <div>
              <p className="text-[10px] uppercase mb-1" style={{ color: C.red, letterSpacing: '0.3em', fontWeight: 600 }}>
                Lancha
              </p>
              <h2 className="text-xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
                {data.boat?.name || '—'}
              </h2>
              {data.boat?.description && (
                <p className="text-[11px] mt-2" style={{ color: C.gray, lineHeight: 1.5 }}>
                  {data.boat.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
              <Stat icon={<Users size={14} />} label="Capacidad" value={`${data.total_capacity}`} />
              <Stat
                icon={<CheckCircle2 size={14} />}
                label="Cupos libres"
                value={`${slotsLeft}`}
                accent={slotsLeft <= 2}
              />
            </div>
          </div>
        </motion.div>

        {/* Estado / CTA */}
        {isClosed && (
          <div className="p-5 text-center" style={{ background: 'rgba(230,57,47,0.10)', border: '0.5px solid rgba(230,57,47,0.40)', borderRadius: '20px' }}>
            <p className="text-xs uppercase" style={{ color: C.red, letterSpacing: '0.2em', fontWeight: 600 }}>
              Esta reserva fue cerrada por el líder
            </p>
          </div>
        )}

        {isFull && !isClosed && (
          <div className="p-5 text-center" style={{ background: 'rgba(230,57,47,0.10)', border: '0.5px solid rgba(230,57,47,0.40)', borderRadius: '20px' }}>
            <p className="text-xs uppercase mb-2" style={{ color: C.red, letterSpacing: '0.2em', fontWeight: 600 }}>
              Lancha llena
            </p>
            <p className="text-[11px]" style={{ color: C.gray }}>
              Pero puedes liderar tu propia lancha:
            </p>
            <a href="/?solstice=1" className="inline-block mt-3 text-xs uppercase"
              style={{ color: C.red, letterSpacing: '0.2em', textDecoration: 'underline', fontWeight: 600 }}>
              Reservar lancha propia →
            </a>
          </div>
        )}

        {!isFull && !isClosed && (
          <>
            <motion.button
              onClick={handleAccept}
              whileTap={{ scale: 0.97 }}
              className="w-full flex items-center justify-center gap-3"
              style={{
                borderRadius: '999px',
                background: C.red,
                color: '#fff',
                letterSpacing: '0.2em',
                padding: '18px',
                fontSize: '13px',
                textTransform: 'uppercase' as const,
                fontWeight: 600,
                boxShadow: '0 12px 32px rgba(230,57,47,0.45)',
                cursor: 'pointer',
              }}
            >
              Aceptar invitación · ${priceK || '—'}K
              <ChevronRight size={16} />
            </motion.button>

            <p className="text-[10px] uppercase text-center" style={{ color: `${C.gray}aa`, letterSpacing: '0.2em' }}>
              · Pagás tu entrada Solstice por separado · Tu cupo en la lancha queda reservado al pagar ·
            </p>
          </>
        )}

        <a href="/?solstice=1" className="block text-center text-[10px] uppercase mt-8"
          style={{ color: `${C.gray}aa`, letterSpacing: '0.25em' }}>
          Solstice 2026 · Santa Marta
        </a>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: accent ? C.red : C.gray }}>{icon}</span>
      <div>
        <p className="text-[9px] uppercase" style={{ letterSpacing: '0.25em', color: C.gray, fontWeight: 500 }}>{label}</p>
        <p className="text-base tabular-nums" style={{ color: accent ? C.red : C.cream, fontFamily: "'Poiret One', sans-serif", fontWeight: 400 }}>
          {value}
        </p>
      </div>
    </div>
  );
}
