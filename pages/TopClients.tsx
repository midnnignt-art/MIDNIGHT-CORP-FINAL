import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { UserRole, Order, Event, TicketTier } from '../types';
import { Users, Trophy, Ticket, Calendar, BarChart3, Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface TopClientsProps {
  role: UserRole;
}

export const TopClients: React.FC<TopClientsProps> = ({ role }) => {
  const { orders, events, tiers } = useStore();
  const [searchTerm, setSearchTerm] = React.useState('');

  const topClientsData = useMemo(() => {
    const clients: Record<string, {
      email: string;
      name: string;
      totalTickets: number;
      totalSpent: number;
      eventBreakdown: Record<string, number>;
      stageBreakdown: Record<string, number>;
    }> = {};

    orders.forEach(order => {
      if (order.status !== 'completed') return;
      
      const email = order.customer_email.toLowerCase().trim();
      if (!clients[email]) {
        clients[email] = {
          email,
          name: order.customer_name,
          totalTickets: 0,
          totalSpent: 0,
          eventBreakdown: {},
          stageBreakdown: {
            'early_bird': 0,
            'presale': 0,
            'general': 0,
            'door': 0
          }
        };
      }

      const client = clients[email];
      client.totalSpent += order.total;

      order.items.forEach(item => {
        client.totalTickets += item.quantity;
        
        // Event breakdown
        const event = events.find(e => e.id === order.event_id);
        const eventName = event?.title || 'Evento Desconocido';
        client.eventBreakdown[eventName] = (client.eventBreakdown[eventName] || 0) + item.quantity;

        // Stage breakdown
        const tier = tiers.find(t => t.id === item.tier_id);
        if (tier) {
          client.stageBreakdown[tier.stage] = (client.stageBreakdown[tier.stage] || 0) + item.quantity;
        }
      });
    });

    return Object.values(clients)
      .sort((a, b) => b.totalTickets - a.totalTickets)
      .slice(0, 50);
  }, [orders, events, tiers]);

  const filteredClients = topClientsData.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (role !== UserRole.ADMIN) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-zinc-500 font-black uppercase tracking-widest">Acceso Restringido</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-2">
            MIDNIGHT <span className="text-neon-purple">TOP CLIENTS</span>
          </h1>
          <p className="text-zinc-500 text-xs md:text-sm font-bold uppercase tracking-[0.3em]">Ranking de los 50 mayores compradores de la red</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
          <input 
            type="text"
            placeholder="BUSCAR CLIENTE..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/10 rounded-2xl pl-12 pr-4 h-12 text-xs font-bold text-white uppercase tracking-widest focus:border-neon-purple outline-none transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-zinc-900 border border-white/5 p-8 rounded-[2rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Trophy size={60}/></div>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Total Clientes Únicos</p>
            <p className="text-4xl font-black text-white">{Object.keys(topClientsData).length}</p>
        </div>
        <div className="bg-zinc-900 border border-white/5 p-8 rounded-[2rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><Ticket size={60}/></div>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Tickets Vendidos (Top 50)</p>
            <p className="text-4xl font-black text-white">{topClientsData.reduce((acc, c) => acc + c.totalTickets, 0)}</p>
        </div>
        <div className="bg-zinc-900 border border-white/5 p-8 rounded-[2rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><BarChart3 size={60}/></div>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Ticket Promedio (Top 50)</p>
            <p className="text-4xl font-black text-white">
              ${(topClientsData.reduce((acc, c) => acc + c.totalSpent, 0) / (topClientsData.reduce((acc, c) => acc + c.totalTickets, 0) || 1)).toFixed(2)}
            </p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-[2.5rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                <th className="p-6">#</th>
                <th className="p-6">Cliente</th>
                <th className="p-6 text-center">Etapas (Early/Pre/Gen/Door)</th>
                <th className="p-6">Eventos</th>
                <th className="p-6 text-right">Total Boletas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredClients.map((client, idx) => (
                <tr key={client.email} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-6">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${idx < 3 ? 'bg-neon-purple text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="font-black text-white uppercase tracking-tight text-sm">{client.name}</div>
                    <div className="text-[10px] text-zinc-500 font-bold">{client.email}</div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-zinc-600 font-black uppercase">EB</span>
                        <span className="text-xs font-bold text-white">{client.stageBreakdown['early_bird']}</span>
                      </div>
                      <div className="w-px h-4 bg-white/10" />
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-zinc-600 font-black uppercase">PRE</span>
                        <span className="text-xs font-bold text-white">{client.stageBreakdown['presale']}</span>
                      </div>
                      <div className="w-px h-4 bg-white/10" />
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-zinc-600 font-black uppercase">GEN</span>
                        <span className="text-xs font-bold text-white">{client.stageBreakdown['general']}</span>
                      </div>
                      <div className="w-px h-4 bg-white/10" />
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-zinc-600 font-black uppercase">DR</span>
                        <span className="text-xs font-bold text-white">{client.stageBreakdown['door']}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {Object.entries(client.eventBreakdown).map(([name, qty]) => (
                        <span key={name} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[9px] font-bold text-zinc-400 whitespace-nowrap">
                          {name}: <span className="text-white">{qty}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-6 text-right">
                    <div className="text-2xl font-black text-white">{client.totalTickets}</div>
                    <div className="text-[10px] text-neon-purple font-black uppercase tracking-widest">Boletas</div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-20 text-center">
                    <p className="text-zinc-600 font-black uppercase tracking-[0.5em]">No se encontraron registros</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
