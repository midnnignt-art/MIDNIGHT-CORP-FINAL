import React, { useState } from 'react';
import { Tag, Ticket } from 'lucide-react';

type Tab = 'fase-inicio' | 'ruleta';

export const CodesDiscounts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('fase-inicio');

  return (
    <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
      {/* Header */}
      <div className="mb-10">
        <p className="text-[10px] font-bold tracking-[0.4em] uppercase text-[#C9A84C]/60 mb-2">Admin</p>
        <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">
          Códigos & Descuentos
        </h1>
        <p className="text-white/25 text-xs font-light tracking-[0.2em] uppercase mt-2">
          Gestión de landing pages y beneficios
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-10 bg-white/[0.02] border border-white/5 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('fase-inicio')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${
            activeTab === 'fase-inicio'
              ? 'bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20'
              : 'text-white/25 hover:text-white/60'
          }`}
        >
          <Ticket size={13} />
          Fase Inicio
        </button>
        <button
          onClick={() => setActiveTab('ruleta')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${
            activeTab === 'ruleta'
              ? 'bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20'
              : 'text-white/25 hover:text-white/60'
          }`}
        >
          <Tag size={13} />
          Ruleta
        </button>
      </div>

      {/* Content */}
      {activeTab === 'fase-inicio' && (
        <div className="animate-in fade-in duration-500">
          <div className="flex flex-col items-center justify-center py-24 border border-white/5 rounded-2xl bg-white/[0.01]">
            <div className="w-16 h-16 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center mb-5">
              <Ticket size={28} className="text-[#C9A84C]/60" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/20 mb-2">
              Próximamente
            </p>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
              Fase Inicio
            </h2>
            <p className="text-white/20 text-xs font-light tracking-widest uppercase mt-2">
              Configuración de landing page con formulario de captura
            </p>
          </div>
        </div>
      )}

      {activeTab === 'ruleta' && (
        <div className="animate-in fade-in duration-500">
          <div className="flex flex-col items-center justify-center py-24 border border-white/5 rounded-2xl bg-white/[0.01]">
            <div className="w-16 h-16 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center mb-5">
              <Tag size={28} className="text-[#C9A84C]/60" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/20 mb-2">
              Próximamente
            </p>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
              Ruleta
            </h2>
            <p className="text-white/20 text-xs font-light tracking-widest uppercase mt-2">
              Configuración de ruleta de beneficios
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
