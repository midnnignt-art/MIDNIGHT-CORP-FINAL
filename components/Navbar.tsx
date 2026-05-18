import React, { useState, useEffect } from 'react';
import { X, LogOut, Loader2, AlertCircle, Mail, ArrowRight, Sparkles, Smartphone, Send, TrendingUp } from 'lucide-react';
import { toast } from '../lib/toast';
import { Button } from './ui/button';
import { UserRole } from '../types';
import { useStore } from '../context/StoreContext';
import { isAdminLevel } from '../lib/permissions';
import { Input } from './ui/input';
import { isValidEmail, isValidOtp, normalizeEmail } from '../lib/validation';
import TurnstileWidget from './TurnstileWidget';
import { signInWithGoogle } from '../lib/oauth';

const TURNSTILE_ENABLED = !!(import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined);

export const Navbar: React.FC<{ onNavigate: (page: string) => void; currentPage: string; }> = ({ onNavigate, currentPage }) => {
  const { currentUser, login, logout, dbStatus, requestCustomerOtp, verifyOtpUnified, currentCustomer, customerLogout } = useStore();
  
  // Modal State
  const [showAccessModal, setShowAccessModal] = useState(false);
  // flow: 'email' → 'otp'
  const [authStep, setAuthStep] = useState<'email' | 'otp'>('email');

  // Menu State (Unified for Desktop/Mobile)
  const [menuOpen, setMenuOpen] = useState(false);

  const [unifiedEmail, setUnifiedEmail] = useState('');
  const [unifiedPhone, setUnifiedPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => {
      if (resendCooldown <= 0) return;
      const t = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000);
      return () => clearInterval(t);
  }, [resendCooldown]);

  const resetModal = () => {
      setShowAccessModal(false);
      setAuthStep('email');
      setUnifiedEmail(''); setUnifiedPhone(''); setOtpCode(''); setAuthError('');
      setResendCooldown(0);
      setCaptchaToken(null);
  };

  const handleNavigateAction = (page: string) => {
      onNavigate(page);
      setMenuOpen(false);
  };

  // PASO 1: Enviar OTP al email (aplica para todos). El phone es opcional
  // pero recomendado: si lo pasan, queda persistido en user_metadata para
  // poder notificar por WhatsApp luego.
  const handleEmailSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const email = normalizeEmail(unifiedEmail);
      if (!isValidEmail(email)) return setAuthError('Email inválido');
      if (TURNSTILE_ENABLED && !captchaToken) return setAuthError('Completa la verificación');
      setIsLoading(true); setAuthError('');

      const phone = unifiedPhone.trim();
      const metadata = phone ? { phone } : undefined;

      const res = await requestCustomerOtp(email, metadata, captchaToken ?? undefined);
      setIsLoading(false);

      if (res.success) {
          setAuthStep('otp');
          setResendCooldown(30);
      } else {
          setAuthError(res.message || 'Error al enviar código. Intenta de nuevo.');
          setCaptchaToken(null);
      }
  };

  const handleGoogleSignIn = async () => {
      setIsLoading(true);
      setAuthError('');
      const { error } = await signInWithGoogle();
      if (error) {
          setIsLoading(false);
          // Mensaje específico cuando el provider no está activado en Supabase
          if (error.toLowerCase().includes('provider') || error.toLowerCase().includes('not enabled')) {
              setAuthError('Google Sign-In pendiente de activación. Usá email por ahora.');
          } else {
              setAuthError(error);
          }
      }
      // En éxito, el browser redirige y no llegamos acá.
  };

  const handleResendOtp = async () => {
      if (resendCooldown > 0 || isLoading) return;
      if (TURNSTILE_ENABLED && !captchaToken) return setAuthError('Completa la verificación');
      setIsLoading(true); setAuthError('');
      const res = await requestCustomerOtp(normalizeEmail(unifiedEmail), undefined, captchaToken ?? undefined);
      setIsLoading(false);
      if (res.success) {
          setResendCooldown(30);
          toast.success('Código reenviado');
      } else {
          setAuthError(res.message || 'No pudimos reenviar el código.');
          setCaptchaToken(null);
      }
  };

  // PASO 2: Verificar OTP — el sistema detecta automáticamente staff o cliente
  const handleOtpVerify = async () => {
      if (!isValidOtp(otpCode)) return setAuthError('Código incompleto');
      setIsLoading(true); setAuthError('');

      const success = await verifyOtpUnified(normalizeEmail(unifiedEmail), otpCode);
      setIsLoading(false);

      if (success) {
          resetModal();
      } else {
          setAuthError('Código incorrecto o expirado. Intenta de nuevo.');
      }
  };

  const handleQuickCopy = () => {
      if(currentUser?.code) {
          const link = `https://midnightcorp.click/?ref=${currentUser.code}`;
          navigator.clipboard.writeText(link);
          toast.success('Link copiado al portapapeles');
      }
  };

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-[80] bg-transparent px-6 md:px-12 h-20 md:h-24 flex items-center justify-between pointer-events-none">
      {/* LEFT NAV (Status Indicator) */}
      <div className="flex-1 flex items-center pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 border border-moonlight/8 bg-void/40 backdrop-blur-sm rounded-full">
          <div className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'synced' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)] animate-pulse'}`} />
          <span className="text-[7px] font-bold tracking-[0.25em] uppercase text-moonlight/35">
            {dbStatus === 'synced' ? 'Online' : 'Sync'}
          </span>
        </div>
      </div>

      {/* CENTRAL LOGO (Interaction Layer Only) */}
      <div 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer w-32 h-12 z-[101]" 
        onClick={() => onNavigate('home')}
      />

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
                     <button onClick={() => setMenuOpen(false)} className="p-2.5 hover:bg-white/5 rounded-full text-white/20 hover:text-white transition-all">
                         <X size={18}/>
                     </button>
                </div>
                
                <div className="p-3 space-y-0.5">
                    {/* Volver al portal — entrada al sistema solar */}
                    <button
                        onClick={() => handleNavigateAction('portal')}
                        className="w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] text-white/50 hover:text-white hover:bg-white/[0.03]"
                    >
                        <span className="font-medium text-[11px] uppercase tracking-[0.25em] flex items-center gap-2">
                            <span style={{ fontSize: 14 }}>←</span>
                            The Conjunction
                        </span>
                        <span className="text-[8px] tracking-[0.3em] text-white/30 uppercase">Portal</span>
                    </button>

                    <button onClick={() => handleNavigateAction('home')} className={`w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] ${currentPage === 'home' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                        <span className="font-medium text-[11px] uppercase tracking-[0.2em] flex items-center gap-3">
                            Vitrina
                        </span>
                        <div className={`w-1 h-1 rounded-full bg-white transition-all ${currentPage === 'home' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} />
                    </button>


                    {currentUser && (
                        <button onClick={() => handleNavigateAction('dashboard')} className={`w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] ${currentPage === 'dashboard' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                             <span className="font-medium text-[11px] uppercase tracking-[0.2em] flex items-center gap-3">
                                Command
                             </span>
                             <div className={`w-1 h-1 rounded-full bg-white transition-all ${currentPage === 'dashboard' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} />
                        </button>
                    )}

                    {(currentCustomer || currentUser) && (
                        <button onClick={() => handleNavigateAction('tickets')} className={`w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] ${currentPage === 'tickets' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                             <span className="font-medium text-[11px] uppercase tracking-[0.2em] flex items-center gap-3">
                                Entradas
                             </span>
                             <div className={`w-1 h-1 rounded-full bg-white transition-all ${currentPage === 'tickets' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} />
                        </button>
                    )}

                    {currentUser && (isAdminLevel(currentUser.role) || currentUser.role === UserRole.HEAD_OF_SALES || currentUser.role === UserRole.HEAD) && (
                        <div className="pt-2 mt-2 border-t border-white/5 space-y-0.5">
                            {isAdminLevel(currentUser.role) && (<>
                            <button onClick={() => handleNavigateAction('admin-events')} className={`w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] ${currentPage === 'admin-events' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                                <span className="font-medium text-[11px] uppercase tracking-[0.2em]">Backoffice</span>
                            </button>
                            <button
                                onClick={() => handleNavigateAction('solstice-preview')}
                                className={`w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] ${currentPage === 'solstice-preview' ? 'bg-[#E6392F]/15 text-[#E6392F]' : 'text-[#E6392F]/40 hover:text-[#E6392F] hover:bg-[#E6392F]/5'}`}
                            >
                                <span className="font-medium text-[11px] uppercase tracking-[0.2em] flex items-center gap-2">
                                    Preview · Solstice
                                    <span className="text-[8px] bg-[#E6392F]/20 px-1.5 py-0.5 rounded-sm font-bold tracking-widest">2026</span>
                                </span>
                                <div className={`w-1 h-1 rounded-full bg-[#E6392F] transition-all ${currentPage === 'solstice-preview' ? 'opacity-100' : 'opacity-0'}`} />
                            </button>
                            <button onClick={() => handleNavigateAction('magic')} className={`w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] ${currentPage === 'magic' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                                <span className="font-medium text-[11px] uppercase tracking-[0.2em]">MÁGIC</span>
                            </button>
                            <button onClick={() => handleNavigateAction('projections')} className={`w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] ${currentPage === 'projections' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                                <span className="font-medium text-[11px] uppercase tracking-[0.2em]">Finanzas</span>
                            </button>
                            <button onClick={() => handleNavigateAction('contabilidad')} className={`w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] ${currentPage === 'contabilidad' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                                <span className="font-medium text-[11px] uppercase tracking-[0.2em]">Contabilidad</span>
                            </button>
                            <button onClick={() => handleNavigateAction('codes-discounts')} className={`w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] ${currentPage === 'codes-discounts' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                                <span className="font-medium text-[11px] uppercase tracking-[0.2em]">Códigos y Descuentos</span>
                            </button>
                            <button onClick={() => handleNavigateAction('system-config')} className={`w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] ${currentPage === 'system-config' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                                <span className="font-medium text-[11px] uppercase tracking-[0.2em] flex items-center gap-2">
                                    Sistema
                                    <span className="text-[7px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-sm font-bold tracking-widest">NEW</span>
                                </span>
                            </button>
                            </>)}
                            <button onClick={() => handleNavigateAction('top-clients')} className={`w-full text-left py-3 px-4 rounded-lg flex items-center justify-between group transition-all min-h-[44px] ${currentPage === 'top-clients' ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white hover:bg-white/[0.02]'}`}>
                                <span className="font-medium text-[11px] uppercase tracking-[0.2em]">Top Clients</span>
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
                            className="w-full h-11 font-bold bg-white/5 hover:bg-white/10 text-white text-[9px] uppercase tracking-[0.2em] transition-all rounded-lg border border-white/5"
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
            <div className="w-full max-w-sm bg-midnight border border-moonlight/8 p-6 md:p-10 rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.9),0_0_0_1px_rgba(73,15,124,0.15)] relative overflow-hidden">
                <button onClick={resetModal} className="absolute top-4 right-4 md:top-6 md:right-6 text-zinc-600 hover:text-white z-10"><X size={20}/></button>

                {/* PASO 1: Propuesta de valor + Email + Phone + Google OAuth */}
                {authStep === 'email' && (
                    <div className="animate-in fade-in zoom-in duration-300">
                        {/* Hero */}
                        <div className="text-center mb-5">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-eclipse/40 bg-eclipse/15 mb-3">
                                <Sparkles size={10} className="text-eclipse" />
                                <span className="text-[9px] font-black tracking-[0.3em] text-moonlight uppercase">Tu Pase MIDNIGHT</span>
                            </div>
                            <h2 className="text-xl md:text-2xl font-black text-moonlight uppercase tracking-tight leading-tight">Acceso al universo</h2>
                            <p className="text-moonlight/40 text-[10px] mt-1.5 uppercase font-bold tracking-[0.25em]">Una sola cuenta para todos los eventos</p>
                        </div>

                        {/* Beneficios — propuesta de valor */}
                        <ul className="space-y-2 mb-5">
                            <ValueBullet icon={<Sparkles size={11} />}>QR único anti-fraude · no se duplica</ValueBullet>
                            <ValueBullet icon={<Send size={11} />}>Transferí entradas a amigos en 1 tap</ValueBullet>
                            <ValueBullet icon={<TrendingUp size={11} />}>Beneficios que suben con cada evento</ValueBullet>
                        </ul>

                        {/* Google OAuth */}
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            className="w-full h-12 md:h-14 bg-white text-black font-bold text-sm rounded-xl md:rounded-2xl flex items-center justify-center gap-2.5 hover:bg-zinc-100 transition-colors disabled:opacity-50 mb-3"
                        >
                            <GoogleGlyph />
                            <span>Continuar con Google</span>
                        </button>

                        {/* Divider */}
                        <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-moonlight/10" />
                            <span className="text-[9px] font-bold tracking-[0.3em] text-moonlight/30 uppercase">o</span>
                            <div className="flex-1 h-px bg-moonlight/10" />
                        </div>

                        <form onSubmit={handleEmailSubmit} className="space-y-3">
                            <Input
                                autoFocus
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                aria-label="Correo electrónico"
                                placeholder="tu@email.com"
                                value={unifiedEmail}
                                onChange={e => { setUnifiedEmail(e.target.value); setAuthError(''); }}
                                className="h-12 md:h-14 bg-black border-white/10 text-center font-bold text-sm md:text-base"
                            />
                            <div className="relative">
                                <Input
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    aria-label="Celular para WhatsApp (opcional)"
                                    placeholder="WhatsApp (+57)"
                                    value={unifiedPhone}
                                    onChange={e => setUnifiedPhone(e.target.value)}
                                    className="h-12 md:h-14 bg-black border-white/10 text-center font-bold text-sm md:text-base pl-9"
                                />
                                <Smartphone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400/60 pointer-events-none" />
                            </div>
                            {TURNSTILE_ENABLED && (
                                <TurnstileWidget
                                    onToken={setCaptchaToken}
                                    onExpire={() => setCaptchaToken(null)}
                                />
                            )}
                            {authError && (
                                <div className="flex items-center gap-2 justify-center text-red-400 text-[10px] font-bold">
                                    <AlertCircle size={10}/> {authError}
                                </div>
                            )}
                            <Button type="submit" disabled={isLoading || (TURNSTILE_ENABLED && !captchaToken)} fullWidth className="h-12 md:h-14 bg-eclipse hover:bg-eclipse/80 text-moonlight font-black text-sm rounded-xl md:rounded-2xl">
                                {isLoading ? <Loader2 className="animate-spin" /> : 'ENVIAR CÓDIGO'}
                            </Button>
                        </form>

                        <p className="text-[9px] text-moonlight/25 text-center mt-4 leading-relaxed">
                            Al continuar aceptás recibir el ticket y avisos del evento por email/WhatsApp.
                        </p>
                    </div>
                )}

                {/* PASO 2: OTP (igual para todos) */}
                {authStep === 'otp' && (
                    <div className="animate-in slide-in-from-right duration-300">
                        <button onClick={() => { setAuthStep('email'); setAuthError(''); setOtpCode(''); }} className="mb-4 flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white uppercase">
                            <ArrowRight className="rotate-180" size={12}/> Volver
                        </button>
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-eclipse/20 rounded-2xl flex items-center justify-center border border-eclipse/30 relative shadow-[0_0_30px_rgba(73,15,124,0.3)]">
                                <Mail size={20} className="text-moonlight"/>
                                <div className="absolute inset-0 bg-eclipse/20 blur-xl rounded-full"></div>
                            </div>
                        </div>
                        <h2 className="text-lg font-black text-moonlight text-center mb-1 uppercase">Revisa tu Email</h2>
                        <p className="text-moonlight/30 text-[10px] text-center mb-5">Código enviado a <span className="text-moonlight font-bold">{unifiedEmail}</span></p>
                        <div className="space-y-3">
                            <Input
                                autoFocus
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                aria-label="Código de verificación de 6 dígitos"
                                placeholder="000000"
                                maxLength={6}
                                value={otpCode}
                                onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setAuthError(''); }}
                                className="h-14 md:h-16 bg-black border-white/10 text-center font-black text-xl md:text-3xl tracking-[0.5em]"
                            />
                            {authError && (
                                <div className="flex items-center gap-2 justify-center text-red-400 text-[10px] font-bold">
                                    <AlertCircle size={10}/> {authError}
                                </div>
                            )}
                            <Button onClick={handleOtpVerify} disabled={isLoading} fullWidth className="h-12 md:h-16 bg-white text-black font-black text-sm md:text-lg rounded-xl md:rounded-2xl">
                                {isLoading ? <Loader2 className="animate-spin" /> : 'ENTRAR'}
                            </Button>
                            <button
                                type="button"
                                onClick={handleResendOtp}
                                disabled={resendCooldown > 0 || isLoading}
                                className="w-full text-center text-[10px] font-bold uppercase tracking-[0.25em] text-moonlight/40 hover:text-moonlight disabled:text-moonlight/20 disabled:cursor-not-allowed transition-colors pt-2"
                            >
                                {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )}
    </>
  );
};

// ── Subcomponentes del modal ACCESO ─────────────────────────────────────────

const ValueBullet: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <li className="flex items-center gap-2.5 text-[11px] text-moonlight/65 font-medium">
    <span className="w-5 h-5 rounded-full bg-eclipse/15 border border-eclipse/30 flex items-center justify-center text-eclipse flex-shrink-0">
      {icon}
    </span>
    <span>{children}</span>
  </li>
);

const GoogleGlyph: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-11.3 8 12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5Z"/>
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.2 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7Z"/>
    <path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.4-5.2l-6.2-5.2a12 12 0 0 1-7.2 2.4 12 12 0 0 1-11.3-8l-6.5 5A20 20 0 0 0 24 44Z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8a20 20 0 0 0-.4-3.5Z"/>
  </svg>
);