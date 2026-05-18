import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';
import { detectWalletPreference, WalletPreference } from '../lib/platform';

interface Props {
  orderId: string;
}

type Platform = 'apple' | 'google';

export const WalletButtons: React.FC<Props> = ({ orderId }) => {
  const [pref, setPref] = useState<WalletPreference>('both');
  const [loading, setLoading] = useState<Platform | null>(null);

  useEffect(() => {
    setPref(detectWalletPreference());
  }, []);

  const handleAdd = async (platform: Platform) => {
    if (loading) return;
    setLoading(platform);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-pass', {
        body: { order_id: orderId, platform },
      });

      if (error) {
        toast.error(`Error: ${error.message ?? 'No pudimos generar el pase'}`);
        return;
      }

      if (platform === 'google' && data?.saveUrl) {
        window.open(data.saveUrl, '_blank', 'noopener');
        return;
      }

      if (platform === 'apple' && data?.passUrl) {
        // El edge devolverá una URL al .pkpass blob cuando esté implementado
        window.location.href = data.passUrl;
        return;
      }

      // Edge function devuelve mensaje informativo si no está configurado
      if (data?.error) {
        const docs = data.docs ? ` Ver: ${data.docs}` : '';
        toast.error(`${data.error}.${docs}`.slice(0, 120));
        console.warn('[wallet-pass]', data);
        return;
      }

      toast.error('Respuesta inesperada del servidor.');
    } catch (err: any) {
      toast.error(`Error de red: ${err?.message ?? 'reintenta'}`);
    } finally {
      setLoading(null);
    }
  };

  const showApple = pref === 'apple' || pref === 'both';
  const showGoogle = pref === 'google' || pref === 'both';

  if (!showApple && !showGoogle) return null;

  return (
    <div className={`w-full grid gap-3 ${showApple && showGoogle ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {showApple && (
        <button
          onClick={() => handleAdd('apple')}
          disabled={loading !== null}
          className="group h-12 rounded-2xl bg-black text-white border border-white/15 hover:border-white/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] font-sans"
        >
          {loading === 'apple' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <AppleGlyph />
              <span className="text-[11px] font-medium tracking-wide leading-tight text-left">
                <span className="block text-[8px] text-white/60 uppercase tracking-[0.2em]">Add to</span>
                <span className="block text-sm font-bold -mt-0.5">Apple Wallet</span>
              </span>
            </>
          )}
        </button>
      )}

      {showGoogle && (
        <button
          onClick={() => handleAdd('google')}
          disabled={loading !== null}
          className="group h-12 rounded-2xl bg-black text-white border border-white/15 hover:border-white/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] font-sans"
        >
          {loading === 'google' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <GoogleGlyph />
              <span className="text-[11px] font-medium tracking-wide leading-tight text-left">
                <span className="block text-[8px] text-white/60 uppercase tracking-[0.2em]">Add to</span>
                <span className="block text-sm font-bold -mt-0.5">Google Wallet</span>
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

const AppleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.05 12.04a4.7 4.7 0 0 1 2.36-3.96 4.94 4.94 0 0 0-3.9-2.1c-1.64-.17-3.21.96-4.05.96-.85 0-2.15-.94-3.54-.92A5.18 5.18 0 0 0 3.5 8.7C1.6 11.96 3.04 16.77 4.85 19.4c.88 1.29 1.92 2.74 3.3 2.69 1.34-.05 1.84-.86 3.45-.86 1.61 0 2.06.86 3.46.83 1.43-.02 2.34-1.32 3.21-2.62a11.42 11.42 0 0 0 1.46-2.99 4.55 4.55 0 0 1-2.68-4.41ZM14.5 4.31a4.66 4.66 0 0 0 1.06-3.32 4.74 4.74 0 0 0-3.07 1.59 4.4 4.4 0 0 0-1.09 3.2 3.92 3.92 0 0 0 3.1-1.47Z" />
  </svg>
);

const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-11.3 8 12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5Z"/>
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.2 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7Z"/>
    <path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.4-5.2l-6.2-5.2a12 12 0 0 1-7.2 2.4 12 12 0 0 1-11.3-8l-6.5 5A20 20 0 0 0 24 44Z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8a20 20 0 0 0-.4-3.5Z"/>
  </svg>
);

export default WalletButtons;
