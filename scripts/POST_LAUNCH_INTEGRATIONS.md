# MIDNIGHT CORP — Integraciones post-launch

Guía operativa para activar las features que requieren cuentas/credenciales externas. Todo el código ya está cableado — solo tenés que configurar las cuentas y pegar las keys en Supabase.

---

## 1. Google Sign-In (OAuth)

**Por qué importa:** reduce fricción del primer login de 30s (esperar email + pegar OTP) a 1 tap. Conversión típica +30-50%.

### Pasos

1. **Google Cloud Console** → https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 Client ID → tipo "Web application"
   - **Authorized redirect URIs**: pegar tu callback de Supabase
     - Lo encontrás en Supabase Dashboard → Authentication → Providers → Google → "Redirect URL"
     - Formato: `https://wlhqltksjbkrcyrksjlz.supabase.co/auth/v1/callback`
   - Copiar el **Client ID** y **Client Secret**

2. **Supabase Dashboard** → Authentication → Providers → Google
   - Toggle ON
   - Pegar Client ID + Client Secret
   - Save

3. **Verificar:** abrí la app → ACCESO → "Continuar con Google" debería funcionar.

---

## 2. WhatsApp (Twilio)

**Por qué importa:** en LATAM, WhatsApp tiene ~95% open rate vs ~20% del email. Es el canal #1 para recordatorios pre-evento y campaign drip.

### Pasos

1. **Crear cuenta Twilio** → https://www.twilio.com/try-twilio
   - Plan "pay as you go" (~$0.005 por mensaje WhatsApp)

2. **Activar WhatsApp Sandbox** (para testing) o **registrar Business Profile** (para producción):
   - Sandbox: Console → Messaging → Try WhatsApp → seguir instrucciones (5 min)
   - Producción: requiere verificación de negocio (24-72h)

3. **Conseguir credenciales** del Console → Account → API keys & tokens:
   - `Account SID`
   - `Auth Token`
   - `WhatsApp From number` (formato `whatsapp:+14155238886` en sandbox)

4. **Configurar en Supabase:**
   ```bash
   supabase secrets set TWILIO_ACCOUNT_SID=ACxxx
   supabase secrets set TWILIO_AUTH_TOKEN=xxx
   supabase secrets set TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"
   ```

5. **Refinar templates en `supabase/functions/drip-campaigns/index.ts`** — agregar lógica de envío Twilio paralelo al email Resend.

---

## 3. Apple Wallet (.pkpass)

**Estado actual:** scaffold completo, falta solo la generación del binario `.pkpass`.

**Por qué es complejo:** Apple requiere:
- Apple Developer Program ($99/año)
- Pass Type ID + signing certificate
- Generación local del ZIP firmado con PKCS#7

### Pasos

1. **Apple Developer Program** → https://developer.apple.com/programs/ ($99/año)

2. **developer.apple.com → Identifiers → Pass Type IDs** → New
   - Identifier: `pass.com.midnightcorp.ticket`
   - Description: "Midnight Corp Event Ticket"

3. **Generar Certificate Signing Request (CSR)** desde Keychain Access en macOS
   - Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
   - Email: el tuyo
   - Common Name: "Midnight Pass"
   - Save to disk

4. **Subir el CSR al Pass Type ID** en developer.apple.com → descargar el `.cer`

5. **Importar el .cer en Keychain** → exportar como `.p12` con password

6. **Codificar el .p12 en base64:**
   ```bash
   base64 -i MidnightPass.p12 -o MidnightPass.b64
   cat MidnightPass.b64 | pbcopy
   ```

7. **Configurar secrets:**
   ```bash
   supabase secrets set APPLE_PASS_TYPE_ID=pass.com.midnightcorp.ticket
   supabase secrets set APPLE_PASS_TEAM_ID=XXXXXXXXXX
   supabase secrets set APPLE_PASS_CERT_P12_BASE64="<contenido del .b64>"
   supabase secrets set APPLE_PASS_CERT_PASSWORD="<password del .p12>"
   ```

8. **Implementar generación del .pkpass** en `supabase/functions/wallet-pass/index.ts` (sección `handleAppleWallet`):
   - Parsear PKCS#12 con `npm:node-forge`
   - Generar `pass.json` con datos del ticket
   - Calcular SHA1 de cada asset (logo, icon, strip)
   - Crear `manifest.json` con los hashes
   - Firmar el manifest con PKCS#7 detached signature usando el cert
   - Empaquetar todo en ZIP y devolver

   **Estimación:** 1-2 días de desarrollo. Pedirme implementación cuando tengas los certs.

---

## 4. Google Wallet (JWT save link)

**Estado actual:** scaffold completo y FUNCIONANDO. Solo falta configurar credenciales.

### Pasos

1. **Google Wallet Business Console** → https://pay.google.com/business/console
   - Solicitar Issuer ID (24-48h de aprobación)

2. **Google Cloud Console** → APIs & Services
   - Habilitar **Wallet API**
   - Crear **Service Account** con scope `https://www.googleapis.com/auth/wallet_object.issuer`
   - Descargar JSON del service account

3. **Crear una EventTicketClass** vía REST API:
   ```bash
   # Usar el JWT del service account para POST a:
   # https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass
   # Body: { id: "<issuerID>.midnight-default", eventName: {...}, ... }
   ```

4. **Configurar secrets:**
   ```bash
   supabase secrets set GOOGLE_WALLET_ISSUER_ID=<issuerID>
   supabase secrets set GOOGLE_WALLET_CLASS_ID=midnight-default
   supabase secrets set GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=<email>@<project>.iam.gserviceaccount.com
   supabase secrets set GOOGLE_WALLET_PRIVATE_KEY="<private_key_del_json>"
   ```

5. **Verificar:** entrar a Sistema → Estado de Features → Google Wallet debería estar verde. Probar el botón "Add to Google Wallet" en un ticket.

---

## 5. Drip Campaigns automatizadas

**Estado actual:** edge function `drip-campaigns` deployada, lista para correr.

**Para activar:**

1. **Configurar pg_cron en Supabase** → Dashboard → Database → Cron:
   ```sql
   SELECT cron.schedule(
     'drip-campaigns-hourly',
     '0 * * * *',  -- cada hora
     $$ SELECT net.http_post(
       url := 'https://wlhqltksjbkrcyrksjlz.supabase.co/functions/v1/drip-campaigns',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
       )
     ); $$
   );
   ```

   O alternativa: Vercel Cron → `vercel.json`:
   ```json
   "crons": [{"path": "/api/cron/drip", "schedule": "0 * * * *"}]
   ```

2. **Crear tabla de log** para evitar duplicados:
   ```sql
   CREATE TABLE drip_campaign_log (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     order_id uuid NOT NULL,
     template text NOT NULL,
     sent_at timestamptz DEFAULT now(),
     UNIQUE (order_id, template)
   );
   ```

3. **Refinar templates** en `supabase/functions/drip-campaigns/index.ts` con copy + diseño final.

---

## Roadmap recomendado

**Semana 1 (post-launch):**
- ✅ Google Sign-In activado
- ✅ Drip campaigns con templates básicos + pg_cron

**Semana 2-3:**
- ✅ WhatsApp Twilio (sandbox primero, luego producción)
- ✅ Google Wallet pass

**Mes 2:**
- ✅ Apple Wallet (cuando tengas certs)
- ✅ NPS dashboard de respuestas

**Mes 3+:**
- A/B testing de templates de drip
- Segmentación por Pase MIDNIGHT (Silver+ recibe ofertas distintas)
