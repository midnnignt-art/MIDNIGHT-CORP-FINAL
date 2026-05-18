#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# MIDNIGHT CORP — Script de deploy a producción
#
# Uso:
#   1) supabase login            (una sola vez, abre browser)
#   2) supabase link --project-ref wlhqltksjbkrcyrksjlz
#   3) bash scripts/setup-production.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_REF="wlhqltksjbkrcyrksjlz"
EDGE_FUNCTIONS=(
  "bold-signature"
  "create-bold-payment"
  "bold-webhook"
  "bold-reconcile"
  "send-ticket-email"
  "wallet-pass"
  "qr-token"
  "validate-qr"
  "system-health"
)

echo "═══════════════════════════════════════════════════════════════"
echo "  MIDNIGHT CORP — Deploy a Supabase ($PROJECT_REF)"
echo "═══════════════════════════════════════════════════════════════"

# ─── 1. Verificar que estamos linkeados ────────────────────────────────────
if ! supabase status &>/dev/null; then
  echo "❌ Supabase CLI no está linkeado al proyecto."
  echo "   Corré: supabase link --project-ref $PROJECT_REF"
  exit 1
fi

# ─── 2. Aplicar migrations ──────────────────────────────────────────────────
echo ""
echo "──▶ Aplicando migrations…"
supabase db push

echo ""
echo "   Migrations aplicadas. Para verificar, en Dashboard → SQL Editor correr:"
echo "   SELECT column_name FROM information_schema.columns WHERE table_name='events' AND column_name IN ('dress_code','min_age','faq');"

# ─── 3. Deploy de cada edge function ────────────────────────────────────────
echo ""
echo "──▶ Deployando edge functions…"
for fn in "${EDGE_FUNCTIONS[@]}"; do
  echo ""
  echo "   📦 $fn"
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF" || {
    echo "   ⚠️  Falló deploy de $fn (continuando)"
  }
done

# ─── 4. Recordatorio de secrets ────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Deploy terminado"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Verificá que los secrets críticos estén configurados:"
echo "  supabase secrets list --project-ref $PROJECT_REF"
echo ""
echo "Secrets que deberías tener (mínimo para producción):"
echo "  - BOLD_SECRET_KEY                       (firma pagos Bold)"
echo "  - BOLD_API_KEY                          (reconciliación)"
echo "  - BOLD_WEBHOOK_SECRET                   (verify webhook signature)"
echo "  - BOLD_WEBHOOK_REQUIRE_SIGNATURE=true   (rechazar webhooks sin firma)"
echo "  - RESEND_API_KEY                        (email transaccional)"
echo "  - QR_HMAC_SECRET                        (QR rotativo anti-reventa)"
echo ""
echo "Opcionales:"
echo "  - GOOGLE_WALLET_*                       (4 vars, ver .env.example)"
echo "  - APPLE_PASS_*                          (4 vars, ver .env.example)"
echo ""
echo "Setear un secret:"
echo "  supabase secrets set BOLD_SECRET_KEY=xxxxx --project-ref $PROJECT_REF"
echo ""
echo "Una vez seteados, entrá al admin → Sistema → Estado de Features"
echo "y verificá que todo esté en verde."
