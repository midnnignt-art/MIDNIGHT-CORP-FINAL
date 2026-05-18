/**
 * Detección de plataforma para mostrar el botón de Wallet correcto.
 *
 * Reglas:
 * - iOS Safari → Apple Wallet (Google Wallet no funciona offline en iOS)
 * - Android → Google Wallet
 * - Desktop → ambos botones (el usuario puede elegir según su teléfono)
 */

export type WalletPreference = 'apple' | 'google' | 'both';

const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';

export function detectWalletPreference(): WalletPreference {
  if (!isBrowser) return 'both';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  if (isIOS) return 'apple';
  const isAndroid = /Android/i.test(ua);
  if (isAndroid) return 'google';
  return 'both';
}

export function isIOS(): boolean {
  if (!isBrowser) return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function isAndroid(): boolean {
  if (!isBrowser) return false;
  return /Android/i.test(navigator.userAgent);
}
