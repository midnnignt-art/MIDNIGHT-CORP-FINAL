import React, { useState } from 'react';
import { Menu, X, Settings, TrendingUp, LogIn, LogOut, User, Database, Zap, PieChart, Copy, Loader2, AlertCircle, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { UserRole } from '../types';
import { useStore } from '../context/StoreContext';

export const Navbar: React.FC<{ onNavigate: (page: string) => void; currentPage: string; }> = ({ onNavigate, currentPage }) => {
  const { currentUser, login, logout, dbStatus } = useStore();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(false);
    
    // Simular un pequeño delay de red
    setTimeout(async () => {
        const success = await login(code, password);
        setIsLoading(false);
        if (success) {
            setShowLoginModal(false);
            setCode('');
            setPassword('');
            onNavigate('dashboard');
        } else {
            setLoginError(true);
        }
    }, 500);
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
            <Button onClick={() => setShowLoginModal(true)} className="bg-white text-black font-black h-11 px-6 rounded-xl">LOGIN STAFF</Button>
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
                <button onClick={() => setShowLoginModal(false)} className="absolute top-6 right-6 text-zinc-600 hover:text-white"><X size={24}/></button>
                
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/10 relative">
                        <Lock size={32} className="text-white"/>
                        <div className="absolute inset-0 bg-neon-purple/20 blur-xl rounded-full"></div>
                    </div>
                </div>
                
                <h2 className="text-2xl font-black text-white text-center mb-2">Acceso Restringido</h2>
                <p className="text-zinc-500 text-xs text-center mb-8 uppercase font-bold tracking-widest">Solo personal autorizado</p>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <input 
                        autoFocus 
                        type="text" 
                        placeholder="CÓDIGO DE AGENTE" 
                        value={code} 
                        onChange={e => setCode(e.target.value)} 
                        className="w-full bg-black border border-white/5 p-5 rounded-2xl text-center font-bold text-white focus:border-neon-purple focus:ring-1 focus:ring-neon-purple outline-none uppercase" 
                    />
                    <input 
                        type="password" 
                        placeholder="CONTRASEÑA" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="w-full bg-black border border-white/5 p-5 rounded-2xl text-center font-bold text-white focus:border-neon-purple focus:ring-1 focus:ring-neon-purple outline-none" 
                    />
                    
                    {loginError && (
                        <div className="flex items-center gap-2 justify-center text-red-500 text-xs font-bold animate-pulse">
                            <AlertCircle size={12}/> Credenciales inválidas
                        </div>
                    )}

                    <Button type="submit" disabled={isLoading} fullWidth className="h-16 bg-white text-black font-black text-lg">
                        {isLoading ? <Loader2 className="animate-spin" /> : 'INICIAR SESIÓN'}
                    </Button>
                </form>
            </div>
        </div>
    )}
    </>
  );
};