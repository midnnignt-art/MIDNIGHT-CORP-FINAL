import React, { useState } from 'react';
import { Menu, X, Settings, TrendingUp, LogIn, LogOut, User, Database, Zap, PieChart, Copy, Loader2, AlertCircle, Lock, Mail, ChevronRight, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { UserRole } from '../types';
import { useStore } from '../context/StoreContext';
import { Input } from './ui/input';

export const Navbar: React.FC<{ onNavigate: (page: string) => void; currentPage: string; }> = ({ onNavigate, currentPage }) => {
  const { currentUser, login, logout, dbStatus, requestCustomerOtp, verifyCustomerOtp, currentCustomer, customerLogout } = useStore();
  
  // Modal State
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [authMode, setAuthMode] = useState<'menu' | 'client' | 'staff'>('menu');

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
        {currentCustomer && !currentUser && (
             <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-full border border-white/5">
                 <div className="w-2 h-2 bg-neon-blue rounded-full"></div>
                 <span className="text-xs font-bold text-white">{currentCustomer.email}</span>
                 <button onClick={customerLogout} className="ml-2 text-zinc-500 hover:text-white"><LogOut size={12}/></button>
             </div>
        )}

        {!currentUser ? (
            <Button onClick={() => setShowAccessModal(true)} className="bg-white text-black font-black h-11 px-6 rounded-xl flex items-center gap-2">
                <User size={16}/> ACCESO
            </Button>
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

    {showAccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
            <div className="w-full max-w-sm bg-zinc-900 border border-white/10 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <button onClick={resetModal} className="absolute top-6 right-6 text-zinc-600 hover:text-white z-10"><X size={24}/></button>
                
                {authMode === 'menu' && (
                    <div className="animate-in fade-in zoom-in duration-300">
                        <h2 className="text-2xl font-black text-white text-center mb-2">Bienvenido</h2>
                        <p className="text-zinc-500 text-xs text-center mb-8 uppercase font-bold tracking-widest">Selecciona tu perfil de ingreso</p>
                        
                        <div className="space-y-4">
                            <button onClick={() => setAuthMode('client')} className="w-full bg-black hover:bg-zinc-800 border border-white/10 p-6 rounded-3xl flex items-center justify-between group transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-neon-blue/20 flex items-center justify-center text-neon-blue">
                                        <User size={24}/>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-white text-lg">Soy Cliente</p>
                                        <p className="text-[10px] text-zinc-500 uppercase font-bold">Ingreso con Email</p>
                                    </div>
                                </div>
                                <ChevronRight className="text-zinc-600 group-hover:text-white transition-colors"/>
                            </button>

                            <button onClick={() => setAuthMode('staff')} className="w-full bg-black hover:bg-zinc-800 border border-white/10 p-6 rounded-3xl flex items-center justify-between group transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-neon-purple/20 flex items-center justify-center text-neon-purple">
                                        <ShieldCheck size={24}/>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-white text-lg">Soy Staff</p>
                                        <p className="text-[10px] text-zinc-500 uppercase font-bold">Ingreso con Código</p>
                                    </div>
                                </div>
                                <ChevronRight className="text-zinc-600 group-hover:text-white transition-colors"/>
                            </button>
                        </div>
                    </div>
                )}

                {authMode === 'staff' && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <button onClick={() => setAuthMode('menu')} className="mb-6 flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-white uppercase"><ArrowRight className="rotate-180" size={14}/> Volver</button>
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/10 relative">
                                <Lock size={24} className="text-white"/>
                                <div className="absolute inset-0 bg-neon-purple/20 blur-xl rounded-full"></div>
                            </div>
                        </div>
                        <h2 className="text-xl font-black text-white text-center mb-6 uppercase">Acceso Staff</h2>
                        <form onSubmit={handleStaffLogin} className="space-y-4">
                            <input 
                                autoFocus 
                                type="text" 
                                placeholder="CÓDIGO DE AGENTE" 
                                value={code} 
                                onChange={e => setCode(e.target.value)} 
                                className="w-full bg-black border border-white/5 p-5 rounded-2xl text-center font-bold text-white focus:border-neon-purple outline-none uppercase tracking-widest" 
                            />
                            <input 
                                type="password" 
                                placeholder="CONTRASEÑA" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="w-full bg-black border border-white/5 p-5 rounded-2xl text-center font-bold text-white focus:border-neon-purple outline-none" 
                            />
                            {staffError && (
                                <div className="flex items-center gap-2 justify-center text-red-500 text-xs font-bold animate-pulse">
                                    <AlertCircle size={12}/> Credenciales inválidas
                                </div>
                            )}
                            <Button type="submit" disabled={isLoading} fullWidth className="h-16 bg-white text-black font-black text-lg rounded-2xl">
                                {isLoading ? <Loader2 className="animate-spin" /> : 'INICIAR SESIÓN'}
                            </Button>
                        </form>
                    </div>
                )}

                {authMode === 'client' && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <button onClick={() => setAuthMode('menu')} className="mb-6 flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-white uppercase"><ArrowRight className="rotate-180" size={14}/> Volver</button>
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/10 relative">
                                <Mail size={24} className="text-white"/>
                                <div className="absolute inset-0 bg-neon-blue/20 blur-xl rounded-full"></div>
                            </div>
                        </div>
                        <h2 className="text-xl font-black text-white text-center mb-6 uppercase">Acceso Clientes</h2>
                        
                        {clientStep === 0 ? (
                            <div className="space-y-4">
                                <Input 
                                    autoFocus
                                    placeholder="TU EMAIL" 
                                    value={clientEmail} 
                                    onChange={e => setClientEmail(e.target.value)} 
                                    className="h-14 bg-black border-white/10 text-center font-bold text-lg"
                                />
                                {clientError && <p className="text-red-400 text-xs text-center font-bold">{clientError}</p>}
                                <Button onClick={handleClientRequestOtp} disabled={isLoading} fullWidth className="h-16 bg-neon-blue text-black font-black text-lg rounded-2xl">
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'ENVIAR CÓDIGO'}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-zinc-500 text-xs text-center">Código enviado a {clientEmail}</p>
                                <Input 
                                    autoFocus
                                    placeholder="000000" 
                                    maxLength={8}
                                    value={clientOtp} 
                                    onChange={e => setClientOtp(e.target.value)} 
                                    className="h-16 bg-black border-white/10 text-center font-black text-3xl tracking-[0.5em]"
                                />
                                {clientError && <p className="text-red-400 text-xs text-center font-bold">{clientError}</p>}
                                <Button onClick={handleClientVerifyOtp} disabled={isLoading} fullWidth className="h-16 bg-emerald-500 text-black font-black text-lg rounded-2xl">
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'VERIFICAR Y ENTRAR'}
                                </Button>
                                <button onClick={() => setClientStep(0)} className="w-full text-center text-[10px] text-zinc-500 hover:text-white font-bold uppercase mt-4">Cambiar Email</button>
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