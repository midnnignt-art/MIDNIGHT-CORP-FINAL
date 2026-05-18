import { UserRole } from '../types';

/**
 * Helpers de permisos centralizados.
 *
 * - `isAdminLevel`  → ADMIN o SUPER_ADMIN (acceso total a backoffice)
 * - `isSuperAdmin`  → solo SUPER_ADMIN (puede ver perfiles ocultos + crear otros SUPER_ADMINs)
 * - `canManageStaff`→ puede crear/editar/borrar staff
 *
 * Mantener estos checks en un único helper evita que se rompa el sistema
 * cuando se agregue un nuevo rol o se cambie la jerarquía.
 */

type RoleLike = UserRole | string | null | undefined;

export function isSuperAdmin(role: RoleLike): boolean {
  return role === UserRole.SUPER_ADMIN || role === 'SUPER_ADMIN';
}

export function isAdminLevel(role: RoleLike): boolean {
  return role === UserRole.ADMIN || role === 'ADMIN' || isSuperAdmin(role);
}

export function canManageStaff(role: RoleLike): boolean {
  return isAdminLevel(role);
}
