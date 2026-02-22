import React, { useState } from 'react';
import { Menu, X, Settings, TrendingUp, LogIn, LogOut, User, Database, Zap, PieChart, Copy, Loader2, AlertCircle, Lock, Mail, ChevronRight, ArrowRight, ShieldCheck, Home, LayoutDashboard, Ticket } from 'lucide-react';
import { Button } from './ui/button';
import { UserRole } from '../types';
import { useStore } from '../context/StoreContext';
import { Input } from './ui/input';

export const Navbar: React.FC<{ onNavigate: (page: string) => void; currentPage: string; }> = ({ onNavigate, currentPage }) => {
  const { currentUser, login, logout, dbStatus, requestCustomerOtp, verifyCustomerOtp, currentCustomer, customerLogout } = useStore();
  
  // Modal State
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [authMode, setAuthMode] = useState<'menu' | 'client' | 'staff'>('menu');
  
  // Menu State (Unified for Desktop/Mobile)
  const [menuOpen, setMenuOpen] = useState(false);

  // Staff Login State
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [staffError, setStaffError] = useState(false);
  
  // Client Login State
  const [clientEmail, setClientEmail] = useState('');
  const [clientOtp, setClientOtp] = useState('');
  const [clientStep, setClientStep] = useState(0); // 0: Email, 1: OTP
  const [clientError, setClientError] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const resetModal = () => {
      setShowAccessModal(false);
      setAuthMode('menu');
      setCode(''); setPassword(''); setStaffError(false);
      setClientEmail(''); setClientOtp(''); setClientStep(0); setClientError('');
  };

  const handleNavigateAction = (page: string) => {
      onNavigate(page);
      setMenuOpen(false);
  };

  // --- STAFF HANDLERS ---
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStaffError(false);
    
    setTimeout(async () => {
        const success = await login(code, password);
        setIsLoading(false);
        if (success) {
            resetModal();
            onNavigate('dashboard');
        } else {
            setStaffError(true);
        }
    }, 500);
  };

  // --- CLIENT HANDLERS ---
  const handleClientRequestOtp = async () => {
      if(!clientEmail.includes('@')) return setClientError('Email inválido');
      setIsLoading(true); setClientError('');
      
      const res = await requestCustomerOtp(clientEmail);
      setIsLoading(false);
      
      if(res.success) {
          setClientStep(1);
      } else {
          setClientError(res.message || 'Error al enviar código');
      }
  };

  const handleClientVerifyOtp = async () => {
      if(clientOtp.length < 6) return setClientError('Código incompleto');
      setIsLoading(true); setClientError('');
      
      const success = await verifyCustomerOtp(clientEmail, clientOtp);
      setIsLoading(false);
      
      if(success) {
          resetModal();
          alert('¡Bienvenido! Ya puedes comprar tus tickets rápidamente.');
      } else {
          setClientError('Código incorrecto');
      }
  };

  const handleQuickCopy = () => {
      if(currentUser?.code) {
          const link = `https://midnightcorp.click/?ref=${currentUser.code}`;
          navigator.clipboard.writeText(link);
          alert('Link copiado al portapapeles');
      }
  };

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-[80] bg-transparent px-6 md:px-12 h-20 md:h-24 flex items-center justify-between pointer-events-none">
      {/* LEFT NAV (Status Indicator) */}
      <div className="flex-1 flex items-center pointer-events-auto">
        <div className="flex items-center gap-2 px-2 py-1 border border-moonlight/5 bg-void/20 backdrop-blur-sm rounded-full">
          <div className={`w-1 h-1 rounded-full animate-pulse ${dbStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
          <span className="text-[6px] font-black tracking-[0.2em] uppercase text-moonlight/20">
            {dbStatus === 'synced' ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* CENTRAL LOGO (Perfectly Centered) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
        <div className="flex flex-col items-center cursor-pointer" onClick={() => onNavigate('home')}>
          <span className="text-xl md:text-3xl font-black tracking-[-0.1em] text-moonlight">MIDNIGHT</span>
          <span className="text-[8px] font-light tracking-[0.8em] text-moonlight/30 uppercase -mt-1 ml-1">Worldwide</span>
        </div>
      </div>

      {/* RIGHT NAV (Minimalist Hamburger) */}
      <div className="flex-1 flex justify-end items-center pointer-events-auto">
        <button 
          onClick={() => setMenuOpen(true)} 
          className="group flex items-center gap-3 text-moonlight/40 hover:text-moonlight transition-all duration-300"
        >
          <span className="hidden md:block text-[10px] font-light tracking-[0.4em] uppercase opacity-0 group-hover:opacity-100 transition-opacity">Menu</span>
          <div className="flex flex-col gap-1.5">
            <div className="w-6 h-[1px] bg-current"></div>
            <div className="w-4 h-[1px] bg-current ml-auto"></div>
            <div className="w-6 h-[1px] bg-current"></div>
          </div>
        </button>
      </div>
    </nav>

    {/* UNIFIED NAVIGATION MENU OVERLAY (Minimalist Floating) */}
    {menuOpen && (
        <div className="fixed inset-0 z-[90] flex justify-end p-4 md:p-8 pointer-events-none">
            {/* Backdrop for closing */}
            <div 
                className="fixed inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-500"
                onClick={() => setMenuOpen(false)}
            ></div>

            <div className="relative w-full max-w-[280px] h-fit bg-void/60 backdrop-blur-3xl border border-white/5 rounded-[1.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] pointer-events-auto flex flex-col overflow-hidden animate-in slide-in-from-right-5 fade-in duration-700">
                <div className="flex justify-between items-center p-5 border-b border-white/5">
                     <div className="flex flex-col">
                        <span className="text-base font-black tracking-tighter text-white">MIDNIGHT</span>
                        <span className="text-[5px] font-light tracking-[0.6em] text-moonlight/20 uppercase">Worldwide</span>
                     </div>
                     <button onClick={() => setMenuOpen(false)} className="p-1.5 hover:bg-white/5 rounded-full text-white/20 hover:text-white transition-all">
                         <X size={16}/>
                     </button>
                </div>
                
                <div className="p-4 space-y-0.5">
                    <button onClick={() => handleNavigateAction('home')} className={`w-full text-left py-2.5 px-4 rounded-lg flex items-center justify-between group transition-all ${currentPage === 'home' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                        <span className="font-medium text-[11px] uppercase tracking-[0.2em] flex items-center gap-3">
                            Vitrina
                        </span>
                        <div className={`w-1 h-1 rounded-full bg-white transition-all ${currentPage === 'home' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} />
                    </button>

                    {currentUser && (
                        <button onClick={() => handleNavigateAction('dashboard')} className={`w-full text-left py-2.5 px-4 rounded-lg flex items-center justify-between group transition-all ${currentPage === 'dashboard' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                             <span className="font-medium text-[11px] uppercase tracking-[0.2em] flex items-center gap-3">
                                Command
                             </span>
                             <div className={`w-1 h-1 rounded-full bg-white transition-all ${currentPage === 'dashboard' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} />
                        </button>
                    )}

                    {currentCustomer && (
                        <button onClick={() => handleNavigateAction('tickets')} className={`w-full text-left py-2.5 px-4 rounded-lg flex items-center justify-between group transition-all ${currentPage === 'tickets' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                             <span className="font-medium text-[11px] uppercase tracking-[0.2em] flex items-center gap-3">
                                Entradas
                             </span>
                             <div className={`w-1 h-1 rounded-full bg-white transition-all ${currentPage === 'tickets' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} />
                        </button>
                    )}

                    {(currentUser?.role === UserRole.ADMIN || currentUser?.role === 'ADMIN') && (
                        <div className="pt-3 mt-3 border-t border-white/5 space-y-0.5">
                            <button onClick={() => handleNavigateAction('admin-events')} className={`w-full text-left py-2.5 px-4 rounded-lg flex items-center justify-between group transition-all ${currentPage === 'admin-events' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                                <span className="font-medium text-[11px] uppercase tracking-[0.2em] flex items-center gap-3">
                                    Backoffice
                                </span>
                            </button>
                            <button onClick={() => handleNavigateAction('magic')} className={`w-full text-left py-2.5 px-4 rounded-lg flex items-center justify-between group transition-all ${currentPage === 'magic' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                                <span className="font-medium text-[11px] uppercase tracking-[0.2em] flex items-center gap-3">
                                    MÁGIC
                                </span>
                            </button>
                            <button onClick={() => handleNavigateAction('projections')} className={`w-full text-left py-2.5 px-4 rounded-lg flex items-center justify-between group transition-all ${currentPage === 'projections' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                                <span className="font-medium text-[11px] uppercase tracking-[0.2em] flex items-center gap-3">
                                    Finanzas
                                </span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-5 bg-white/[0.01] border-t border-white/5">
                    {(currentUser || currentCustomer) ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex-shrink-0 flex items-center justify-center font-black text-moonlight text-[10px]">
                                    {currentUser ? currentUser.name.charAt(0).toUpperCase() : currentCustomer.email.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-moonlight text-[10px] uppercase tracking-wider truncate">
                                        {currentUser ? currentUser.name.split(' ')[0] : currentCustomer.email.split('@')[0]}
                                    </p>
                                    <p className="text-[7px] text-moonlight/20 uppercase tracking-[0.1em] font-bold">
                                        {currentUser ? currentUser.role : 'CLIENTE'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    if(currentUser) logout();
                                    else customerLogout();
                                    setMenuOpen(false);
                                }} 
                                className="p-2.5 bg-red-500/5 hover:bg-red-500/20 text-red-500/40 hover:text-red-500 rounded-lg border border-red-500/10 transition-all"
                            >
                                <LogOut size={14}/>
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => { setMenuOpen(false); setShowAccessModal(true); }} 
                            className="w-full h-10 font-bold bg-white/5 hover:bg-white/10 text-white text-[9px] uppercase tracking-[0.2em] transition-all rounded-lg border border-white/5"
                        >
                            Acceso
                        </button>
                    )}
                </div>
            </div>
        </div>
    )}

    {showAccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
            <div className="w-full max-w-sm bg-zinc-900 border border-white/10 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <button onClick={resetModal} className="absolute top-4 right-4 md:top-6 md:right-6 text-zinc-600 hover:text-white z-10"><X size={20}/></button>
                
                {authMode === 'menu' && (
                    <div className="animate-in fade-in zoom-in duration-300">
                        <h2 className="text-xl md:text-2xl font-black text-white text-center mb-2">Bienvenido</h2>
                        <p className="text-zinc-500 text-[10px] md:text-xs text-center mb-6 uppercase font-bold tracking-widest">Selecciona tu perfil de ingreso</p>
                        
                        <div className="space-y-3">
                            <button onClick={() => setAuthMode('client')} className="w-full bg-black hover:bg-zinc-800 border border-white/10 p-4 rounded-2xl flex items-center justify-between group transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-neon-blue/20 flex items-center justify-center text-neon-blue">
                                        <User size={20}/>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-white text-sm md:text-base">Soy Cliente</p>
                                        <p className="text-[9px] text-zinc-500 uppercase font-bold">Ingreso con Email</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors"/>
                            </button>

                            <button onClick={() => setAuthMode('staff')} className="w-full bg-black hover:bg-zinc-800 border border-white/10 p-4 rounded-2xl flex items-center justify-between group transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-neon-purple/20 flex items-center justify-center text-neon-purple">
                                        <ShieldCheck size={20}/>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-white text-sm md:text-base">Soy Staff</p>
                                        <p className="text-[9px] text-zinc-500 uppercase font-bold">Ingreso con Código</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors"/>
                            </button>
                        </div>
                    </div>
                )}

                {authMode === 'staff' && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <button onClick={() => setAuthMode('menu')} className="mb-4 flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white uppercase"><ArrowRight className="rotate-180" size={12}/> Volver</button>
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white/5 rounded-2xl md:rounded-[2rem] flex items-center justify-center border border-white/10 relative">
                                <Lock size={20} className="text-white md:w-6 md:h-6"/>
                                <div className="absolute inset-0 bg-neon-purple/20 blur-xl rounded-full"></div>
                            </div>
                        </div>
                        <h2 className="text-lg md:text-xl font-black text-white text-center mb-4 uppercase">Acceso Staff</h2>
                        <form onSubmit={handleStaffLogin} className="space-y-3">
                            <input 
                                autoFocus 
                                type="text" 
                                placeholder="CÓDIGO DE AGENTE" 
                                value={code} 
                                onChange={e => setCode(e.target.value)} 
                                className="w-full bg-black border border-white/5 p-3 md:p-5 rounded-xl md:rounded-2xl text-center font-bold text-white focus:border-neon-purple outline-none uppercase tracking-widest text-xs md:text-base" 
                            />
                            <input 
                                type="password" 
                                placeholder="CONTRASEÑA" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="w-full bg-black border border-white/5 p-3 md:p-5 rounded-xl md:rounded-2xl text-center font-bold text-white focus:border-neon-purple outline-none text-xs md:text-base" 
                            />
                            {staffError && (
                                <div className="flex items-center gap-2 justify-center text-red-500 text-[10px] font-bold animate-pulse">
                                    <AlertCircle size={10}/> Credenciales inválidas
                                </div>
                            )}
                            <Button type="submit" disabled={isLoading} fullWidth className="h-12 md:h-16 bg-white text-black font-black text-sm md:text-lg rounded-xl md:rounded-2xl">
                                {isLoading ? <Loader2 className="animate-spin" /> : 'INICIAR SESIÓN'}
                            </Button>
                        </form>
                    </div>
                )}

                {authMode === 'client' && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <button onClick={() => setAuthMode('menu')} className="mb-4 flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white uppercase"><ArrowRight className="rotate-180" size={12}/> Volver</button>
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white/5 rounded-2xl md:rounded-[2rem] flex items-center justify-center border border-white/10 relative">
                                <Mail size={20} className="text-white md:w-6 md:h-6"/>
                                <div className="absolute inset-0 bg-neon-blue/20 blur-xl rounded-full"></div>
                            </div>
                        </div>
                        <h2 className="text-lg md:text-xl font-black text-white text-center mb-4 uppercase">Acceso Clientes</h2>
                        
                        {clientStep === 0 ? (
                            <div className="space-y-3">
                                <Input 
                                    autoFocus
                                    placeholder="TU EMAIL" 
                                    value={clientEmail} 
                                    onChange={e => setClientEmail(e.target.value)} 
                                    className="h-12 md:h-14 bg-black border-white/10 text-center font-bold text-sm md:text-lg"
                                />
                                {clientError && <p className="text-red-400 text-[10px] text-center font-bold">{clientError}</p>}
                                <Button onClick={handleClientRequestOtp} disabled={isLoading} fullWidth className="h-12 md:h-16 bg-neon-blue text-black font-black text-sm md:text-lg rounded-xl md:rounded-2xl">
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'ENVIAR CÓDIGO'}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-zinc-500 text-[10px] text-center">Código enviado a {clientEmail}</p>
                                <Input 
                                    autoFocus
                                    placeholder="000000" 
                                    maxLength={8}
                                    value={clientOtp} 
                                    onChange={e => setClientOtp(e.target.value)} 
                                    className="h-14 md:h-16 bg-black border-white/10 text-center font-black text-xl md:text-3xl tracking-[0.5em]"
                                />
                                {clientError && <p className="text-red-400 text-[10px] text-center font-bold">{clientError}</p>}
                                <Button onClick={handleClientVerifyOtp} disabled={isLoading} fullWidth className="h-12 md:h-16 bg-emerald-500 text-black font-black text-sm md:text-lg rounded-xl md:rounded-2xl">
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'VERIFICAR Y ENTRAR'}
                                </Button>
                                <button onClick={() => setClientStep(0)} className="w-full text-center text-[9px] text-zinc-500 hover:text-white font-bold uppercase mt-2">Cambiar Email</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )}
    </>
  );
};