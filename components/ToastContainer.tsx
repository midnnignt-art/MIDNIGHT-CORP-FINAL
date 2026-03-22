import React, { useEffect, useState } from 'react';
import { ToastItem, subscribeToToasts } from '../lib/toast';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => subscribeToToasts(setToasts), []);

    if (!toasts.length) return null;

    return (
        <div className="fixed bottom-6 inset-x-0 z-[300] flex flex-col gap-2 items-center pointer-events-none px-4">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-sm font-bold shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4 fade-in duration-300 ${
                        t.type === 'success' ? 'bg-emerald-950/90 border-emerald-800/50 text-emerald-300' :
                        t.type === 'error'   ? 'bg-red-950/90 border-red-800/50 text-red-300' :
                                              'bg-zinc-900/90 border-white/10 text-white'
                    }`}
                >
                    {t.type === 'success' && <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />}
                    {t.type === 'error'   && <XCircle size={16} className="text-red-400 flex-shrink-0" />}
                    {t.type === 'info'    && <Info size={16} className="text-white/60 flex-shrink-0" />}
                    <span className="max-w-xs text-xs">{t.message}</span>
                </div>
            ))}
        </div>
    );
};
