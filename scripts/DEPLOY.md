# MIDNIGHT CORP — Deploy a producción

Guía paso a paso para poner en producción todo lo que se cableó.

## TL;DR

Si tenés Supabase CLI con auth:
```bash
supabase login                                     # 1 vez
supabase link --project-ref wlhqltksjbkrcyrksjlz
bash scripts/setup-production.sh
```

Si NO tenés CLI o preferís hacerlo manual: ver sección "Modo Dashboard" abajo.

---

## Modo CLI (recomendado)

### 1. Instalar y autenticar
```bash
brew install supabase/tap/supabase    # macOS
supabase login                         # abre browser
supabase link --project-ref wlhqltksjbkrcyrksjlz
```

### 2. Aplicar migrations
```bash
supabase db push
```

Esto aplica:
- `20260512_solstice_rls_public_catalog.sql` — RLS lectura pública catálogo Solstice
- `20260513_audit_log.sql` — tabla audit_log + RLS
- `20260514_event_metadata.sql` — `dress_code`, `min_age`, `faq` en `events`
- `20260514_company_balance.sql` — tabla singleton para capital social

### 3. Deploy de edge functions
```bash
supabase functions deploy bold-signature
supabase functions deploy create-bold-payment
supabase functions deploy bold-webhook
supabase functions deploy bold-reconcile
supabase functions deploy send-ticket-email
supabase functions deploy wallet-pass
supabase functions deploy qr-token
supabase functions deploy validate-qr
supabase functions deploy system-health
```

O todo en uno: `bash scripts/setup-production.sh`

### 4. Configurar secrets

**Mínimo para producción:**
```bash
supabase secrets set BOLD_SECRET_KEY=<tu_key>
supabase secrets set BOLD_API_KEY=<tu_key>
supabase secrets set BOLD_WEBHOOK_SECRET=<tu_key>
supabase secrets set BOLD_WEBHOOK_REQUIRE_SIGNATURE=true
supabase secrets set RESEND_API_KEY=<re_xxx>
supabase secrets set QR_HMAC_SECRET=$(openssl rand -base64 48)
```

**Opcionales (activan features extra):**
```bash
# Google Wallet (botón Add to Google Wallet en tickets)
supabase secrets set GOOGLE_WALLET_ISSUER_ID=<id>
supabase secrets set GOOGLE_WALLET_CLASS_ID=<class>
supabase secrets set GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=<email>
supabase secrets set GOOGLE_WALLET_PRIVATE_KEY="<pem>"

# Apple Wallet (cert + .pkpass generator pendiente de implementación)
supabase secrets set APPLE_PASS_TYPE_ID=pass.com.midnightcorp.ticket
supabase secrets set APPLE_PASS_TEAM_ID=<10chars>
supabase secrets set APPLE_PASS_CERT_P12_BASE64=<base64>
supabase secrets set APPLE_PASS_CERT_PASSWORD=<password>
```

### 5. Verificar
1. Loguearte como admin en la app
2. Ir a **Sistema → Estado de Features**
3. Verificar que cada card esté en verde

---

## Modo Dashboard (sin CLI)

### 1. Aplicar migrations
1. Supabase Dashboard → **SQL Editor** → **New query**
2. Pegar el contenido de `scripts/apply-all-migrations.sql`
3. Click **Run**

### 2. Deploy edge functions
Supabase no soporta deploy de edge functions vía Dashboard UI. Necesitás el CLI o crear las funciones manualmente desde **Edge Functions → Create new function** pegando el código de cada `supabase/functions/<nombre>/index.ts`.

### 3. Configurar secrets
Supabase Dashboard → **Edge Functions** → **Manage secrets** → **Add new secret**

Mismos valores que en la sección CLI.

---

## Frontend (Vercel)

### Variables de entorno en Vercel Project Settings → Environment Variables:

**Públicas (con prefijo `VITE_`):**
```
VITE_SUPABASE_URL=https://wlhqltksjbkrcyrksjlz.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_VERIFIED_DOMAIN=midnightcorp.click
VITE_APP_URL=https://midnightcorp.click
VITE_TURNSTILE_SITE_KEY=<opcional, para captcha>
```

**Server-side (sin prefijo, para edge middleware + /api/og):**
```
SUPABASE_URL=https://wlhqltksjbkrcyrksjlz.supabase.co
SUPABASE_ANON_KEY=<anon_key>
```

### Cloudflare Turnstile (opcional, recomendado)
1. dash.cloudflare.com → Turnstile → Create site
2. Pegar la **Site Key** en `VITE_TURNSTILE_SITE_KEY`
3. Pegar la **Secret Key** en Supabase Dashboard → Auth → **Captcha protection** (NO en Edge Functions secrets)

### Tras deploy, validá
1. Visitar `https://midnightcorp.click/`
2. Compartir un link `https://midnightcorp.click/event/<event_id>` en WhatsApp → debe mostrar OG card del evento
3. Loguearte como admin → Sistema → Monitoring → verificar últimas órdenes
4. Comprar un ticket de prueba → verificar email + QR rotativo (si activaste `QR_HMAC_SECRET`)
