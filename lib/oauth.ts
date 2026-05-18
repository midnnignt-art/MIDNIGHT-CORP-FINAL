import { supabase } from './supabase';

/**
 * Inicia el flow OAuth de Google (redirect-based).
 *
 * Requiere haber habilitado el provider Google en Supabase Dashboard →
 * Authentication → Providers → Google (con OAuth Client ID + Secret de
 * Google Cloud Console). El redirectTo apunta a la app actual.
 */
export async function signInWithGoogle(): Promise<{ error?: string }> {
  const redirectTo = `${window.location.origin}/`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) return { error: error.message };
  return {};
}

/**
 * Inicia el flow OAuth de Apple. Requiere App ID + Services ID + key
 * configurados en Supabase + Apple Developer Program.
 *
 * Deshabilitado por defecto hasta que se complete la inscripción.
 */
export async function signInWithApple(): Promise<{ error?: string }> {
  const redirectTo = `${window.location.origin}/`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo },
  });
  if (error) return { error: error.message };
  return {};
}
