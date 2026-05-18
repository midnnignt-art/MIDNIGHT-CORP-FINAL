import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

/**
 * Hook que pide un token QR rotativo al server (edge function `qr-token`)
 * y lo renueva automáticamente antes de que expire.
 *
 * Si el server devuelve 503 (QR_HMAC_SECRET no configurado), retorna `null`
 * y el caller debe caer a un QR estático con el `order_number` (backward compat).
 *
 * El refresh se hace a `expires_at - 5s` para evitar que el escaneo caiga
 * justo en el límite de la ventana de validación.
 */
export function useDynamicQrToken(orderId: string | null | undefined, options?: { paused?: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!orderId || options?.paused) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      return;
    }

    let cancelled = false;

    const fetchToken = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('qr-token', {
          body: { order_id: orderId },
        });

        if (cancelled) return;

        if (error || !data?.token) {
          // 503 si QR_HMAC_SECRET no está configurado → caller usa fallback
          setError(data?.error ?? error?.message ?? 'qr-token unavailable');
          setToken(null);
          return;
        }

        setToken(data.token);
        setError(null);

        const ttlMs = Math.max(10_000, ((data.ttl ?? 60) - 5) * 1000);
        timerRef.current = window.setTimeout(fetchToken, ttlMs);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'network error');
          setToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchToken();

    return () => {
      cancelled = true;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [orderId, options?.paused]);

  return { token, error, loading };
}
