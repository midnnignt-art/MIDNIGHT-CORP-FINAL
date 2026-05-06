import React, { useState } from 'react';
import { X, Sun, LayoutDashboard, Users, Settings, DollarSign, LogOut, ChevronRight, AlertCircle, ScanLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type SolsticePage =
  | 'landing'
  | 'reserva'
  | 'admin-config'
  | 'admin-sellers'
  | 'admin-finance'
  | 'admin-cobros'
  | 'check-in'
  | 'seller'
  | 'manager'
  | 'buyer';

interface Props {
  currentPage: SolsticePage;
  onNavigate: (page: SolsticePage) => void;
  onExit: () => void;
  role: 'admin' | 'seller' | 'manager' | 'buyer';
}

const C = {
  bg:   '#0a0000',
  red:  '#E6392F',
  org:  '#FF7A00',
  gray: '#606060',
  cream:'#F9F2D7',
};

const NAV_ITEMS: { page: SolsticePage; label: string; icon: React.ReactNode; roles: string[] }[] = [
  { page: 'landing',       label: 'Vitrina',      icon: <Sun size={15} />,           roles: ['admin','seller','manager','buyer'] },
  { page: 'admin-config',  label: 'Configuración',icon: <Settings size={15} />,      roles: ['admin'] },
  { page: 'admin-sellers', label: 'Equipo ventas',icon: <Users size={15} />,         roles: ['admin','manager'] },
  { page: 'admin-finance', label: 'Finanzas',     icon: <DollarSign size={15} />,    roles: ['admin'] },
  { page: 'admin-cobros', label: 'Cobros',        icon: <AlertCircle size={15} />,   roles: ['admin'] },
  { page: 'check-in',    label: 'Check-in',      icon: <ScanLine size={15} />,      roles: ['admin','manager'] },
  { page: 'seller',        label: 'Mi dashboard', icon: <LayoutDashboard size={15} />,roles: ['seller'] },
  { page: 'manager',       label: 'Mi equipo',    icon: <Users size={15} />,         roles: ['manager'] },
  { page: 'buyer',         label: 'Mi semana',    icon: <LayoutDashboard size={15} />,roles: ['buyer'] },
];

export default function SolsticeNav({ currentPage, onNavigate, onExit, role }: Props) {
  const [open, setOpen] = useState(false);
  const visible = NAV_ITEMS.filter(i => i.roles.includes(role));

  return (
    <>
      {/* Trigger button — always visible */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-5 right-5 z-[180] flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg transition-all hover:scale-105"
        style={{ background: C.red, color: C.cream }}
      >
        <Sun size={14} />
        <span className="text-[10px] font-black uppercase tracking-[0.25em]">Solstice</span>
        <ChevronRight size={11} className="opacity-60" />
      </button>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[190] bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 z-[200] flex flex-col w-72"
              style={{ background: C.bg, borderLeft: `1px solid ${C.red}25` }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${C.red}15` }}>
                <div>
                  <p className="text-base font-black uppercase" style={{ fontFamily: "'Poiret One', sans-serif", color: C.cream, letterSpacing: '0.15em' }}>
                    SOLSTICE
                  </p>
                  <p className="text-[9px] uppercase font-bold mt-0.5" style={{ color: C.red, letterSpacing: '0.4em' }}>
                    2026 · {role.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-full transition-colors"
                  style={{ color: `${C.gray}` }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.gray)}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Nav items */}
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {visible.map(item => {
                  const active = currentPage === item.page;
                  return (
                    <button
                      key={item.page}
                      onClick={() => { onNavigate(item.page); setOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all min-h-[44px] relative"
                      style={{
                        background: active ? `${C.red}18` : 'transparent',
                        color: active ? C.red : `${C.cream}50`,
                      }}
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = C.cream; }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = `${C.cream}50`; }}
                    >
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: C.red }} />
                      )}
                      {item.icon}
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em]">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Footer — salir */}
              <div className="px-4 py-5" style={{ borderTop: `1px solid ${C.red}10` }}>
                <button
                  onClick={() => { setOpen(false); onExit(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
                  style={{ color: `${C.gray}` }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.gray)}
                >
                  <LogOut size={15} />
                  <span className="text-[11px] uppercase tracking-[0.18em]">Volver a Midnight</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
