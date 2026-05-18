/**
 * Validadores minimalistas para inputs críticos.
 *
 * No usamos Zod / Yup para no inflar el bundle por 5 funciones.
 * Si en algún momento se necesita schema-based validation a gran escala,
 * migrar a Zod (≈10 KB gzip).
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;
const OTP_REGEX = /^[0-9]{6}$/;

export const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
};

export const isValidOtp = (otp: string): boolean => {
  return OTP_REGEX.test(otp.trim());
};

export const isValidPhone = (phone: string): boolean => {
  if (!phone || phone.trim().length === 0) return false;
  return PHONE_REGEX.test(phone.trim());
};

export const isValidName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 120;
};

/**
 * Verifica que un monto en pesos (COP) sea válido para pagar:
 * entero positivo, no excede el techo (10M COP), no es NaN.
 */
export const isValidAmount = (amount: number, max: number = 10_000_000): boolean => {
  if (!Number.isFinite(amount)) return false;
  if (amount <= 0) return false;
  if (amount > max) return false;
  if (!Number.isInteger(amount)) return false;
  return true;
};

/**
 * Normaliza un email para uso consistente (lowercase + trim).
 */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
