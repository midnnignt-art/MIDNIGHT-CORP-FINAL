import React, { useEffect, useRef } from 'react';

/**
 * Widget de Cloudflare Turnstile (captcha invisible/managed) para proteger
 * el request OTP de abuso por bots.
 *
 * Configuración necesaria:
 *   1. Crear un site en https://dash.cloudflare.com/?to=/:account/turnstile
 *   2. Setear `VITE_TURNSTILE_SITE_KEY` en `.env.local`
 *   3. En Supabase Dashboard → Auth → Captcha protection, activar Turnstile
 *      y pegar el SECRET KEY (NO la site key).
 *
 * Si `VITE_TURNSTILE_SITE_KEY` no está configurada (dev), el widget se
 * omite y el flujo OTP funciona sin captcha.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: any) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface Props {
  onToken: (token: string) => void;
  onExpire?: () => void;
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';

export const TurnstileWidget: React.FC<Props> = ({ onToken, onExpire }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || '';

  useEffect(() => {
    if (!siteKey) return;

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        size: 'flexible',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onExpire?.(),
        'error-callback': () => onExpire?.(),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      window.onTurnstileLoad = renderWidget;
      if (!document.querySelector(`script[src^="${SCRIPT_SRC.split('?')[0]}"]`)) {
        const script = document.createElement('script');
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onToken, onExpire]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="flex justify-center" />;
};

export default TurnstileWidget;
