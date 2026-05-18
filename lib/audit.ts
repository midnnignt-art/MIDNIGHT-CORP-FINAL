import { supabase } from './supabase';

/**
 * Helper fire-and-forget para registrar acciones admin críticas en `audit_log`.
 *
 * Diseño:
 * - NO bloquea la mutation original. Si falla, solo console.warn.
 * - El caller pasa el `actor` (currentUser de StoreContext) explícitamente
 *   para evitar depender de un context global desde lib/.
 * - Si `actor` es null, registra como "system" — útil para flujos
 *   automatizados (cron jobs, webhooks).
 *
 * Convención de `action`:
 *   <entity>.<verb>
 *   - event.create | event.update | event.archive | event.publish | event.delete
 *   - tier.create | tier.update | tier.delete
 *   - staff.create | staff.delete | staff.role_change | staff.team_change
 *   - settlement.create | settlement.delete
 *   - accounting.movement_create | accounting.movement_delete | accounting.capital_update
 *   - campaign.delete
 *   - team.create | team.delete | team.assign
 */

export interface AuditActor {
  user_id?: string | null;
  name?: string | null;
  role?: string | null;
}

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string | null;
  entityLabel?: string | null;
  details?: Record<string, any>;
  actor?: AuditActor | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await supabase.from('audit_log').insert({
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      entity_label: entry.entityLabel ?? null,
      details: entry.details ?? null,
      actor_id: entry.actor?.user_id ?? null,
      actor_name: entry.actor?.name ?? null,
      actor_role: entry.actor?.role ?? null,
    });
    if (error) {
      // Si la tabla aún no existe (42P01), no spamear consola con errores —
      // es un estado esperado mientras la migration no se aplica.
      if (error.code !== '42P01') {
        console.warn('[audit_log] insert failed:', error.message);
      }
    }
  } catch (err: any) {
    console.warn('[audit_log] error:', err?.message ?? err);
  }
}
