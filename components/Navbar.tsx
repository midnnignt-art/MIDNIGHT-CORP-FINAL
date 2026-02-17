
import React, { useState } from 'react';
import { Menu, X, Settings, TrendingUp, LogIn, LogOut, User, Database, Zap, PieChart, Copy, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { UserRole } from '../types';
import { useStore } from '../context/StoreContext';

export const Navbar: React.FC<{ onNavigate: (page: string) => void; currentPage: string; }> = ({ onNavigate, currentPage }) => {
  const { currentUser, logout, login, dbStatus } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginCode, setLoginCode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loginCode) return;
      
      setIsLoggingIn(true);
      try {
          // Intentamos el login
          const success = await login(loginCode);
          if (success) {
              setShowLoginModal(false);
              setLoginCode('');
              // Navegamos al dashboard tras éxito
              onNavigate('dashboard');
          } else {
              alert('Acceso denegado. Verifica el código o contacta al administrador.');
          }
      } catch (err) {
          console.error("Login component error:", err);
          alert('Error de conexión. Intente con ADMIN123 para modo de emergencia.');
      } finally {
          setIsLoggingIn(false);
      }
  };
  
  const handleQuickCopy = () => {
      if(currentUser?.code) {
          const link = `${window.location.origin}/?ref=${currentUser.code}`;
          navigator.clipboard.writeText(link);
          alert('Link copiado al portapapeles');
      }
  };

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-[80] bg-black/80 backdrop-blur-2xl border-b border-white/5 px-6 h-20 flex items-center justify-between">
      <div className="flex items-center gap-10">
          <div className="cursor-pointer" onClick={() => onNavigate('home')}>
            <span className="text-2xl font-black tracking-tighter text-white">MIDNIGHT <span className="text-zinc-600 text-xs font-normal">CORP</span></span>
          </div>

          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-zinc-900/50 rounded-full border border-white/5">
            <div className={`w-2 h-2 rounded-full ${dbStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500 animate-pulse'}`}></div>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{dbStatus === 'synced' ? 'Engine Online' : 'Syncing...'}</span>
          </div>
      </div>

      <div className="hidden md:flex items-center gap-6">
        <button onClick={() => onNavigate('home')} className={`text-xs font-black uppercase tracking-widest ${currentPage === 'home' ? 'text-white' : 'text-zinc-500'}`}>Vitrina</button>
        
        {currentUser && (
            <button onClick={() => onNavigate('dashboard')} className={`text-xs font-black uppercase tracking-widest ${currentPage === 'dashboard' ? 'text-white' : 'text-zinc-500'}`}>Command Center</button>
        )}
        
        {currentUser?.role === UserRole.ADMIN && (
            <>
                <button onClick={() => onNavigate('admin-events')} className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${currentPage === 'admin-events' ? 'text-neon-purple' : 'text-zinc-500'}`}>
                    <Settings size={14}/> Backoffice
                </button>
                <button onClick={() => onNavigate('projections')} className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${currentPage === 'projections' ? 'text-neon-green' : 'text-zinc-500'}`}>
                    <PieChart size={14}/> Finanzas
                </button>
            </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {!currentUser ? (
            <Button onClick={() => setShowLoginModal(true)} className="bg-white text-black font-black h-11 px-6 rounded-xl">LOG STAFF</Button>
        ) : (
            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter leading-none">{currentUser.role === 'ADMIN' ? 'SUPER ADMIN' : currentUser.role}</p>
                    <p className="text-sm font-bold text-white cursor-pointer hover:text-neon-blue transition-colors" onClick={handleQuickCopy} title="Clic para copiar Link de Venta">{currentUser.name}</p>
                </div>
                <button onClick={logout} className="p-3 bg-zinc-900 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all"><LogOut size={18}/></button>
            </div>
        )}
      </div>
    </nav>

    {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
            <div className="w-full max-w-sm bg-zinc-900 border border-white/10 p-10 rounded-[2.5rem] shadow-2xl relative">
                <div className="flex justify-center mb-8">
                    <div className="w-20 h-20 bg-neon-purple/20 rounded-[2rem] flex items-center justify-center border border-neon-purple/20">
                        <User size={40} className="text-neon-purple"/>
                    </div>
                </div>
                
                <h2 className="text-2xl font-black text-white text-center mb-2">Acceso Midnight</h2>
                <p className="text-zinc-500 text-xs text-center mb-6 uppercase font-bold tracking-widest">Authorized Personnel Only</p>
                
                {dbStatus === 'offline' && (
                    <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                        <AlertCircle className="text-amber-500 shrink-0 w-4 h-4 mt-0.5" />
                        <p className="text-[10px] text-amber-500 font-bold leading-tight uppercase">El sistema está offline. Usa ADMIN123 para entrar en modo de emergencia.</p>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <input 
                        autoFocus 
                        type="text" 
                        placeholder="CÓDIGO" 
                        value={loginCode} 
                        onChange={e => setLoginCode(e.target.value.toUpperCase())} 
                        className="w-full bg-black border border-white/5 p-5 rounded-2xl text-center font-black tracking-[0.4em] text-white focus:border-neon-purple focus:ring-1 focus:ring-neon-purple outline-none" 
                    />
                    
                    <Button type="submit" disabled={isLoggingIn} fullWidth className="h-16 bg-white text-black font-black text-lg">
                        {isLoggingIn ? <Loader2 className="animate-spin" /> : 'ENTRAR'}
                    </Button>
                    
                    <button 
                        type="button" 
                        onClick={() => setShowLoginModal(false)} 
                        className="w-full py-2 text-xs text-zinc-600 font-bold hover:text-white uppercase tracking-widest transition-colors"
                    >
                        Cancelar
                    </button>
                </form>
            </div>
        </div>
    )}
    </>
  );
};
