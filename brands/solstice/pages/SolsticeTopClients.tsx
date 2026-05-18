import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, Ship, BedDouble, Users, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const C = { bg: '#000', red: '#E6392F', gray: '#606060', cream: '#F9F2D7' };

interface SolsticeClient {
  email: string;
  name: string;
  university: string | null;
  totalSpent: number;
  amountPaid: number;
  registrationsCount: number;
  isLeader: boolean;
  invitedCount: number;
  hasLodging: boolean;
  payment_modes: string[];
}

export default function SolsticeTopClients() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SolsticeClient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'totalSpent' | 'invitedCount' | 'amountPaid'>('totalSpent');

  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';
    async function load() {
      try {
        // Registrations
        const { data: regs } = await supabase
          .from('solstice_registrations')
          .select('id, customer_name, customer_email, customer_university, total_amount, amount_paid, payment_mode, status');

        // Boat reservations (leaders)
        const { data: boatRes } = await supabase
          .from('solstice_boat_reservations')
          .select('id, leader_email, slots_claimed');

        // Lodging reservations
        const { data: lodgeRes } = await supabase
          .from('solstice_lodging_reservations')
          .select('customer_email');

        const map: Record<string, SolsticeClient> = {};
        (regs || []).forEach(r => {
          const email = (r.customer_email || '').toLowerCase().trim();
          if (!email) return;
          if (!map[email]) {
            map[email] = {
              email,
              name: r.customer_name || '—',
              university: r.customer_university || null,
              totalSpent: 0,
              amountPaid: 0,
              registrationsCount: 0,
              isLeader: false,
              invitedCount: 0,
              hasLodging: false,
              payment_modes: [],
            };
          }
          const c = map[email];
          c.totalSpent += Number(r.total_amount || 0);
          c.amountPaid += Number(r.amount_paid || 0);
          c.registrationsCount += 1;
          if (r.payment_mode && !c.payment_modes.includes(r.payment_mode)) {
            c.payment_modes.push(r.payment_mode);
          }
        });

        (boatRes || []).forEach(b => {
          const email = (b.leader_email || '').toLowerCase().trim();
          if (!email || !map[email]) return;
          map[email].isLeader = true;
          // invitedCount = slots_claimed - 1 (excluye al líder)
          map[email].invitedCount += Math.max(0, (b.slots_claimed || 1) - 1);
        });

        (lodgeRes || []).forEach(l => {
          const email = (l.customer_email || '').toLowerCase().trim();
          if (!email || !map[email]) return;
          map[email].hasLodging = true;
        });

        setData(Object.values(map));
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    let arr = data;
    if (q) arr = arr.filter(c => c.email.includes(q) || c.name.toLowerCase().includes(q) || (c.university || '').toLowerCase().includes(q));
    return [...arr].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  }, [data, searchTerm, sortKey]);

  const stats = useMemo(() => ({
    totalClients: data.length,
    totalLeaders: data.filter(c => c.isLeader).length,
    totalInvitedSum: data.reduce((s, c) => s + c.invitedCount, 0),
    totalRevenue: data.reduce((s, c) => s + c.amountPaid, 0),
  }), [data]);

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh' }} className="flex items-center justify-center">
        <Loader2 className="animate-spin" size={28} style={{ color: C.red }} />
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }} className="px-4 md:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
            Solstice · Clientes
          </p>
          <h1 className="text-3xl md:text-4xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
            Top clientes Solstice
          </h1>
          <p className="text-xs uppercase mt-2" style={{ color: C.gray, letterSpacing: '0.2em' }}>
            Ranking por gasto · líderes de lancha · invitados · upsells
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock icon={<Users size={14} />} label="Clientes" value={stats.totalClients.toString()} />
          <StatBlock icon={<Ship size={14} />}  label="Líderes lancha" value={stats.totalLeaders.toString()} accent />
          <StatBlock icon={<Trophy size={14} />} label="Invitados sumados" value={stats.totalInvitedSum.toString()} />
          <StatBlock icon={<BedDouble size={14} />} label="Recaudado" value={`$${(stats.totalRevenue / 1_000_000).toFixed(1)}M`} accent />
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 relative">
            <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.gray }} />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar nombre, email o universidad"
              style={{
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                color: C.cream,
                padding: '12px 16px 12px 38px',
                width: '100%',
                outline: 'none',
                fontSize: '13px',
                letterSpacing: '0.05em',
              }}
            />
          </div>
          <div className="flex gap-2">
            {([['totalSpent', 'Por gasto'], ['amountPaid', 'Por pagado'], ['invitedCount', 'Por invitados']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className="px-4 py-2 text-[10px] uppercase whitespace-nowrap"
                style={{
                  background: sortKey === k ? 'rgba(230,57,47,0.18)' : 'rgba(255,255,255,0.04)',
                  border: sortKey === k ? '0.5px solid rgba(230,57,47,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                  color: sortKey === k ? C.red : C.gray,
                  letterSpacing: '0.2em',
                  borderRadius: '999px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto" style={{
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.025)',
          border: '0.5px solid rgba(255,255,255,0.08)',
        }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                <Th>#</Th>
                <Th>Cliente</Th>
                <Th>Universidad</Th>
                <Th align="right">Gasto total</Th>
                <Th align="right">Pagado</Th>
                <Th align="center">Líder</Th>
                <Th align="center">Invitó</Th>
                <Th align="center">Hospedaje</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12" style={{ color: C.gray, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                    Sin clientes que coincidan
                  </td>
                </tr>
              )}
              {filtered.slice(0, 100).map((c, i) => (
                <tr key={c.email} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                  <Td>
                    <span style={{ color: i < 3 ? C.red : C.gray, fontWeight: i < 3 ? 700 : 500 }}>
                      {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
                    </span>
                  </Td>
                  <Td>
                    <div>
                      <p style={{ color: C.cream, fontWeight: 600, letterSpacing: '0.05em' }}>{c.name}</p>
                      <p style={{ color: C.gray, fontSize: 10 }}>{c.email}</p>
                    </div>
                  </Td>
                  <Td>{c.university || '—'}</Td>
                  <Td align="right">
                    <span style={{ color: C.cream, fontFamily: "'Poiret One', sans-serif", fontSize: 15 }}>
                      ${Math.round(c.totalSpent / 1000)}K
                    </span>
                  </Td>
                  <Td align="right">
                    <span style={{ color: c.amountPaid >= c.totalSpent ? '#10b981' : C.red, fontWeight: 600 }}>
                      ${Math.round(c.amountPaid / 1000)}K
                    </span>
                  </Td>
                  <Td align="center">
                    {c.isLeader
                      ? <Ship size={14} style={{ color: C.red, margin: '0 auto' }} />
                      : <span style={{ color: `${C.gray}50` }}>—</span>}
                  </Td>
                  <Td align="center">
                    <span style={{ color: c.invitedCount > 0 ? C.cream : `${C.gray}80`, fontWeight: c.invitedCount > 0 ? 600 : 400 }}>
                      {c.invitedCount}
                    </span>
                  </Td>
                  <Td align="center">
                    {c.hasLodging
                      ? <BedDouble size={14} style={{ color: '#FFB48C', margin: '0 auto' }} />
                      : <span style={{ color: `${C.gray}50` }}>—</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] uppercase text-center" style={{ color: `${C.gray}80`, letterSpacing: '0.25em' }}>
          Datos en vivo desde Supabase · Mostrando top 100
        </p>
      </div>
    </div>
  );
}

function StatBlock({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="p-4"
      style={{
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.035)',
        border: '0.5px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-2 mb-2" style={{ color: accent ? C.red : C.gray }}>
        {icon}
        <span className="text-[9px] uppercase" style={{ letterSpacing: '0.3em', fontWeight: 500 }}>{label}</span>
      </div>
      <p className="text-2xl tabular-nums" style={{ color: accent ? C.red : C.cream, fontFamily: "'Poiret One', sans-serif", fontWeight: 300 }}>
        {value}
      </p>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      style={{
        padding: '12px 14px',
        textAlign: align,
        color: C.gray,
        letterSpacing: '0.2em',
        fontSize: 9,
        textTransform: 'uppercase',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <td style={{ padding: '14px', textAlign: align, fontSize: 12, whiteSpace: 'nowrap' }}>
      {children}
    </td>
  );
}
