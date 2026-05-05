import React, { useState } from 'react';
import SolsticeNav, { SolsticePage } from './components/SolsticeNav';
import SolsticeLanding from './pages/SolsticeLanding';
import { UserRole } from '../../types';

interface Props {
  onExit: () => void;
  userRole: UserRole;
}

// Placeholder para páginas aún no construidas
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#000', color: '#606060' }}>
      <div className="w-12 h-12 rounded-full border-2 border-[#E6392F]/30 flex items-center justify-center">
        <span className="text-[#E6392F] text-lg">✦</span>
      </div>
      <p className="text-xs uppercase tracking-[0.4em]" style={{ color: '#E6392F' }}>{title}</p>
      <p className="text-[10px] uppercase tracking-widest">Fase próxima — en construcción</p>
    </div>
  );
}

function solsticeRole(userRole: UserRole): 'admin' | 'seller' | 'manager' | 'buyer' {
  if (userRole === UserRole.ADMIN) return 'admin';
  if (userRole === UserRole.MANAGER) return 'manager';
  if (userRole === UserRole.PROMOTER) return 'seller';
  return 'buyer';
}

export default function SolsticeApp({ onExit, userRole }: Props) {
  const [page, setPage] = useState<SolsticePage>('landing');
  const role = solsticeRole(userRole);

  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      <SolsticeNav
        currentPage={page}
        onNavigate={setPage}
        onExit={onExit}
        role={role}
      />

      {page === 'landing'       && <SolsticeLanding onNavigate={p => setPage(p as SolsticePage)} />}
      {page === 'admin-config'  && <ComingSoon title="Configuración de Temporada" />}
      {page === 'admin-sellers' && <ComingSoon title="Equipo de Ventas" />}
      {page === 'admin-finance' && <ComingSoon title="Finanzas Solstice" />}
      {page === 'seller'        && <ComingSoon title="Dashboard Vendedor" />}
      {page === 'manager'       && <ComingSoon title="Dashboard Gerente" />}
      {page === 'buyer'         && <ComingSoon title="Mi Semana" />}
    </div>
  );
}
