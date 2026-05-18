import React, { useEffect, useMemo, useState } from 'react';
import { motion as _motion } from 'framer-motion';
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, Loader2, ExternalLink,
  CreditCard, ScanLine, Mail, Shield, Wallet, Database, Eye, Clock, Filter
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../context/StoreContext';

const motion = _motion as any;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

type TabKey = 'features' | 'monitoring' | 'audit';

interface SystemHealth {
  ok: boolean;
  timestamp: string;
  features: {
    bold: { secret_key: boolean; api_key: boolean; webhook_secret: boolean; webhook_signature_required: boolean };
    qr_dynamic: { configured: boolean; window_seconds: number };
    resend: { configured: boolean };
    google_wallet: { configured: boolean; issuer_id: boolean; class_id: boolean; service_account: boolean; private_key: boolean };
    apple_wallet: { configured: boolean; pass_type_id: boolean; team_id: boolean; cert_p12: boolean; cert_password: boolean; implementation_pending: boolean };
    supabase: { url: boolean; service_role: boolean };
  };
}

export const SystemConfig: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('features');

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-bold tracking-[0.4em] text-moonlight/40 uppercase mb-2">System</p>
        <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-moonlight uppercase">Configuración y monitoreo</h1>
        <p className="text-moonlight/50 text-sm font-light mt-2 max-w-2xl">
          Estado en tiempo real de cada feature del sistema, monitoreo de pagos y trazabilidad de cambios críticos.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-moonlight/10 -mx-2 px-2 overflow-x-auto">
        <TabButton active={tab === 'features'} onClick={() => setTab('features')} icon={<Activity size={14} />}>
          Estado de Features
        </TabButton>
        <TabButton active={tab === 'monitoring'} onClick={() => setTab('monitoring')} icon={<Eye size={14} />}>
          Monitoring
        </TabButton>
        <TabButton active={tab === 'audit'} onClick={() => setTab('audit')} icon={<Filter size={14} />}>
          Audit Log
        </TabButton>
      </div>

      {tab === 'features' && <FeaturesTab />}
      {tab === 'monitoring' && <MonitoringTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
};

// ── TabButton ──────────────────────────────────────────────────────────────

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }> = ({ active, onClick, icon, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-3 text-[11px] font-black uppercase tracking-[0.25em] flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
      active ? 'text-moonlight border-moonlight' : 'text-moonlight/40 border-transparent hover:text-moonlight/70'
    }`}
  >
    {icon}
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: FEATURES
// ─────────────────────────────────────────────────────────────────────────────

const FeaturesTab: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('system-health');
      if (error || !data?.ok) {
        setError(error?.message ?? 'system-health function no responde');
        return;
      }
      setHealth(data as SystemHealth);
    } catch (err: any) {
      setError(err?.message ?? 'network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHealth(); }, []);

  if (loading && !health) {
    return (
      <div className="flex items-center justify-center py-20 text-moonlight/40">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/5 p-6 text-red-300">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2">Error</p>
        <p className="text-sm">{error}</p>
        <p className="text-xs text-moonlight/40 mt-3">
          La edge function `system-health` puede no estar desplegada todavía. Corré: <code className="text-moonlight/70">supabase functions deploy system-health</code>
        </p>
        <button onClick={fetchHealth} className="mt-4 text-xs uppercase tracking-widest font-bold text-moonlight/70 hover:text-moonlight">
          Reintentar
        </button>
      </div>
    );
  }

  if (!health) return null;
  const f = health.features;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.3em] text-moonlight/40 uppercase">
          Verificado: {new Date(health.timestamp).toLocaleTimeString('es-CO')}
        </p>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="text-[10px] font-bold tracking-[0.3em] uppercase text-moonlight/60 hover:text-moonlight disabled:opacity-40"
        >
          {loading ? 'Verificando...' : 'Verificar de nuevo'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FeatureCard
          icon={<CreditCard size={18} />}
          name="Bold — Pagos"
          status={f.bold.secret_key && f.bold.webhook_secret ? (f.bold.webhook_signature_required ? 'ok' : 'warn') : 'error'}
          summary={
            f.bold.secret_key && f.bold.webhook_secret
              ? (f.bold.webhook_signature_required
                  ? 'Firma de webhook obligatoria — máxima seguridad'
                  : 'Configurado, pero firma webhook en modo "soft warn"')
              : 'Falta config de pagos'
          }
          checks={[
            { label: 'BOLD_SECRET_KEY (integrity hash)', ok: f.bold.secret_key },
            { label: 'BOLD_API_KEY (reconciliación)', ok: f.bold.api_key },
            { label: 'BOLD_WEBHOOK_SECRET (HMAC verify)', ok: f.bold.webhook_secret },
            { label: 'BOLD_WEBHOOK_REQUIRE_SIGNATURE=true', ok: f.bold.webhook_signature_required },
          ]}
          docHint="Supabase Dashboard → Edge Functions → Secrets"
        />

        <FeatureCard
          icon={<ScanLine size={18} />}
          name="QR dinámico anti-reventa"
          status={f.qr_dynamic.configured ? 'ok' : 'warn'}
          summary={
            f.qr_dynamic.configured
              ? `Activo. Ventana: ${f.qr_dynamic.window_seconds}s`
              : 'Inactivo — el ticket usa order_number estático (backward compat)'
          }
          checks={[
            { label: 'QR_HMAC_SECRET (token signing)', ok: f.qr_dynamic.configured },
            { label: `QR_WINDOW_SECONDS=${f.qr_dynamic.window_seconds}`, ok: f.qr_dynamic.window_seconds >= 30 && f.qr_dynamic.window_seconds <= 120 },
          ]}
          actions={[
            { label: 'Generar secret aleatorio', onClick: () => generateAndCopySecret() },
          ]}
          docHint="openssl rand -base64 48 → pegar en Supabase secrets"
        />

        <FeatureCard
          icon={<Mail size={18} />}
          name="Email transaccional (Resend)"
          status={f.resend.configured ? 'ok' : 'error'}
          summary={f.resend.configured ? 'Tickets se envían por email tras compra' : 'No se envían emails de confirmación'}
          checks={[
            { label: 'RESEND_API_KEY', ok: f.resend.configured },
          ]}
          docHint="resend.com → API Keys → crear key con permiso 'sending'"
        />

        <FeatureCard
          icon={<Wallet size={18} />}
          name="Google Wallet"
          status={f.google_wallet.configured ? 'ok' : 'warn'}
          summary={
            f.google_wallet.configured
              ? 'Botón "Add to Google Wallet" activo en tickets'
              : 'Botón oculto en Android — falta config'
          }
          checks={[
            { label: 'GOOGLE_WALLET_ISSUER_ID', ok: f.google_wallet.issuer_id },
            { label: 'GOOGLE_WALLET_CLASS_ID', ok: f.google_wallet.class_id },
            { label: 'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL', ok: f.google_wallet.service_account },
            { label: 'GOOGLE_WALLET_PRIVATE_KEY', ok: f.google_wallet.private_key },
          ]}
          docHint="pay.google.com/business/console → solicitar Issuer ID (24-48h)"
        />

        <FeatureCard
          icon={<Wallet size={18} />}
          name="Apple Wallet"
          status={f.apple_wallet.configured ? 'warn' : 'warn'}
          summary={
            f.apple_wallet.configured
              ? '⚠️ Certs configurados pero falta implementar .pkpass generator'
              : 'Falta cert + falta implementación. Apple Dev Program ($99/año)'
          }
          checks={[
            { label: 'APPLE_PASS_TYPE_ID', ok: f.apple_wallet.pass_type_id },
            { label: 'APPLE_PASS_TEAM_ID', ok: f.apple_wallet.team_id },
            { label: 'APPLE_PASS_CERT_P12_BASE64', ok: f.apple_wallet.cert_p12 },
            { label: 'APPLE_PASS_CERT_PASSWORD', ok: f.apple_wallet.cert_password },
            { label: '.pkpass generator implementado', ok: false },
          ]}
          docHint="developer.apple.com → Identifiers → Pass Type IDs"
        />

        <FeatureCard
          icon={<Shield size={18} />}
          name="Captcha (Cloudflare Turnstile)"
          status={hasViteEnv('VITE_TURNSTILE_SITE_KEY') ? 'ok' : 'warn'}
          summary={
            hasViteEnv('VITE_TURNSTILE_SITE_KEY')
              ? 'Captcha visible en login OTP'
              : 'Sin captcha — bots pueden spam-ear OTPs'
          }
          checks={[
            { label: 'VITE_TURNSTILE_SITE_KEY (frontend)', ok: hasViteEnv('VITE_TURNSTILE_SITE_KEY') },
            { label: 'Turnstile secret en Supabase Auth', ok: undefined /* no podemos verificar desde edge */ },
          ]}
          docHint="dash.cloudflare.com → Turnstile → crear site"
        />

        <FeatureCard
          icon={<Database size={18} />}
          name="Supabase Core"
          status={f.supabase.url && f.supabase.service_role ? 'ok' : 'error'}
          summary={f.supabase.url && f.supabase.service_role ? 'Base de datos conectada' : 'Crítico: falta config core'}
          checks={[
            { label: 'SUPABASE_URL', ok: f.supabase.url },
            { label: 'SUPABASE_SERVICE_ROLE_KEY (auto)', ok: f.supabase.service_role },
          ]}
        />
      </div>

      <div className="rounded-2xl border border-moonlight/10 bg-midnight/30 p-5">
        <p className="text-[10px] font-black tracking-[0.3em] uppercase text-moonlight/60 mb-2">Cómo configurar un secret</p>
        <ol className="text-xs text-moonlight/70 space-y-1.5 list-decimal pl-5">
          <li>Supabase Dashboard → tu proyecto → Edge Functions → Manage Secrets</li>
          <li>"Add new secret" → pegá nombre + valor</li>
          <li>Redeploy de la edge function que lo usa: <code className="text-moonlight">supabase functions deploy {'<name>'}</code></li>
          <li>Volver acá → "Verificar de nuevo"</li>
        </ol>
      </div>
    </div>
  );
};

function hasViteEnv(key: string): boolean {
  return Boolean((import.meta.env as any)[key]);
}

async function generateAndCopySecret() {
  const arr = new Uint8Array(48);
  crypto.getRandomValues(arr);
  const b64 = btoa(String.fromCharCode(...arr));
  try {
    await navigator.clipboard.writeText(b64);
    alert(`Secret generado y copiado al portapapeles. Pegalo en Supabase Dashboard → Edge Functions → Secrets → QR_HMAC_SECRET.\n\nValor:\n${b64.slice(0, 24)}...`);
  } catch {
    alert(`Secret generado (copiá manualmente):\n\n${b64}`);
  }
}

// ── FeatureCard ────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: React.ReactNode;
  name: string;
  status: 'ok' | 'warn' | 'error';
  summary: string;
  checks: { label: string; ok: boolean | undefined }[];
  actions?: { label: string; onClick: () => void }[];
  docHint?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, name, status, summary, checks, actions, docHint }) => {
  const [expanded, setExpanded] = useState(false);

  const statusColor = status === 'ok' ? 'emerald' : status === 'warn' ? 'amber' : 'red';
  const StatusIcon = status === 'ok' ? CheckCircle2 : status === 'warn' ? AlertTriangle : XCircle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className={`rounded-2xl border bg-midnight/30 overflow-hidden transition-colors ${
        status === 'ok' ? 'border-emerald-500/20' :
        status === 'warn' ? 'border-amber-500/25' : 'border-red-500/25'
      }`}
    >
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-5">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
            status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' :
            status === 'warn' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-moonlight uppercase tracking-tight">{name}</h3>
              <StatusIcon size={14} className={`text-${statusColor}-400`} />
            </div>
            <p className="text-xs text-moonlight/60 font-light leading-relaxed mt-1">{summary}</p>
          </div>
          <span className="text-moonlight/30 text-lg leading-none flex-shrink-0">{expanded ? '−' : '+'}</span>
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="overflow-hidden border-t border-moonlight/5"
        >
          <div className="p-5 space-y-3">
            <ul className="space-y-1.5">
              {checks.map((c, i) => (
                <li key={i} className="flex items-center gap-2.5 text-xs">
                  {c.ok === true ? <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" /> :
                   c.ok === false ? <XCircle size={12} className="text-red-400 flex-shrink-0" /> :
                   <AlertTriangle size={12} className="text-moonlight/30 flex-shrink-0" />}
                  <span className={c.ok === true ? 'text-moonlight/80' : c.ok === false ? 'text-moonlight/40' : 'text-moonlight/30 italic'}>
                    {c.label}
                  </span>
                </li>
              ))}
            </ul>

            {docHint && (
              <p className="text-[10px] text-moonlight/40 pt-2 border-t border-moonlight/5">
                💡 {docHint}
              </p>
            )}

            {actions && actions.length > 0 && (
              <div className="flex gap-2 pt-1">
                {actions.map((a, i) => (
                  <button
                    key={i}
                    onClick={a.onClick}
                    className="text-[10px] font-bold uppercase tracking-[0.25em] text-moonlight/60 hover:text-moonlight bg-moonlight/5 hover:bg-moonlight/10 px-3 py-2 rounded-lg transition-colors"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: MONITORING — últimas órdenes Bold + métricas
// ─────────────────────────────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  order_number: string;
  status: 'pending' | 'completed' | 'failed';
  total: number;
  customer_email: string;
  payment_method: string;
  created_at: string;
  used: boolean;
  bold_payment_id?: string | null;
}

const MonitoringTab: React.FC = () => {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');

  const fetchOrders = async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('id, order_number, status, total, customer_email, payment_method, created_at, used, bold_payment_id')
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setOrders((data as OrderRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [filter]);

  const stats = useMemo(() => {
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const recent = orders.filter(o => new Date(o.created_at).getTime() > last24h);
    const completed = recent.filter(o => o.status === 'completed').length;
    const failed = recent.filter(o => o.status === 'failed').length;
    const pending = recent.filter(o => o.status === 'pending').length;
    const total = recent.length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const revenue = recent.filter(o => o.status === 'completed').reduce((s, o) => s + Number(o.total || 0), 0);
    return { total, completed, failed, pending, successRate, revenue };
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MonitoringStat label="Órdenes (24h)" value={stats.total.toString()} />
        <MonitoringStat label="Completed" value={stats.completed.toString()} tone="ok" />
        <MonitoringStat label="Pending" value={stats.pending.toString()} tone="warn" />
        <MonitoringStat label="Failed" value={stats.failed.toString()} tone="error" />
        <MonitoringStat label="Success Rate" value={`${stats.successRate}%`} tone={stats.successRate >= 90 ? 'ok' : stats.successRate >= 70 ? 'warn' : 'error'} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'pending', 'completed', 'failed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] rounded-full border transition-colors ${
              filter === f
                ? 'border-moonlight text-moonlight bg-moonlight/5'
                : 'border-moonlight/10 text-moonlight/40 hover:text-moonlight/70 hover:border-moonlight/25'
            }`}
          >
            {f === 'all' ? 'Todas' : f}
          </button>
        ))}
        <button onClick={fetchOrders} className="ml-auto text-[10px] font-bold tracking-[0.3em] uppercase text-moonlight/50 hover:text-moonlight">
          {loading ? 'Cargando...' : 'Refrescar'}
        </button>
      </div>

      <div className="rounded-2xl border border-moonlight/10 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-midnight/30 border-b border-moonlight/10 text-[9px] font-black tracking-[0.3em] uppercase text-moonlight/40">
          <span className="col-span-3">Order</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-3 hidden md:block">Email</span>
          <span className="col-span-2">Total</span>
          <span className="col-span-2">Hace</span>
        </div>
        {loading && orders.length === 0 ? (
          <div className="py-10 text-center text-moonlight/40 text-sm">
            <Loader2 className="animate-spin mx-auto" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-10 text-center text-moonlight/40 text-sm">Sin órdenes en este filtro</div>
        ) : (
          orders.map(o => <OrderRowItem key={o.id} order={o} />)
        )}
      </div>
    </div>
  );
};

const MonitoringStat: React.FC<{ label: string; value: string; tone?: 'ok' | 'warn' | 'error' }> = ({ label, value, tone }) => (
  <div className={`rounded-xl border p-4 ${
    tone === 'ok' ? 'border-emerald-500/20 bg-emerald-500/5' :
    tone === 'warn' ? 'border-amber-500/20 bg-amber-500/5' :
    tone === 'error' ? 'border-red-500/20 bg-red-500/5' :
    'border-moonlight/10 bg-midnight/30'
  }`}>
    <p className="text-[9px] font-black tracking-[0.3em] uppercase text-moonlight/40 mb-1.5">{label}</p>
    <p className={`text-2xl font-black tabular-nums tracking-tight ${
      tone === 'ok' ? 'text-emerald-400' :
      tone === 'warn' ? 'text-amber-400' :
      tone === 'error' ? 'text-red-400' :
      'text-moonlight'
    }`}>{value}</p>
  </div>
);

const OrderRowItem: React.FC<{ order: OrderRow }> = ({ order }) => {
  const ago = useMemo(() => {
    const diff = Date.now() - new Date(order.created_at).getTime();
    const min = Math.floor(diff / 60_000);
    if (min < 1) return 'ahora';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  }, [order.created_at]);

  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-moonlight/5 last:border-b-0 text-xs items-center hover:bg-moonlight/[0.02] transition-colors">
      <span className="col-span-3 font-mono text-moonlight/80 truncate">{order.order_number}</span>
      <span className="col-span-2">
        <StatusPill status={order.status} used={order.used} />
      </span>
      <span className="col-span-3 hidden md:block text-moonlight/50 truncate">{order.customer_email}</span>
      <span className="col-span-2 text-moonlight font-bold tabular-nums">${Number(order.total || 0).toLocaleString('es-CO')}</span>
      <span className="col-span-2 text-moonlight/40 flex items-center gap-1.5">
        <Clock size={10} /> {ago}
      </span>
    </div>
  );
};

const StatusPill: React.FC<{ status: string; used?: boolean }> = ({ status, used }) => {
  const cls = status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
              status === 'failed' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
              'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return (
    <span className={`text-[9px] font-black tracking-[0.2em] uppercase border rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${cls}`}>
      {status}
      {used && <span className="opacity-60">·used</span>}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  created_at: string;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_label: string | null;
  details: any;
}

const AuditTab: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        if (error.code === '42P01') {
          setError('Tabla audit_log no creada todavía. Aplicá la migration 20260513_audit_log.sql');
        } else {
          setError(error.message);
        }
      } else {
        setEntries((data as AuditEntry[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-moonlight/40">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-amber-200">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2">Migration pendiente</p>
        <p className="text-sm mb-3">{error}</p>
        <p className="text-xs text-moonlight/50">
          Una vez aplicada la migration, las acciones admin críticas (borrar evento, editar tier, etc.) se irán registrando acá. La integración del lado del código (insert al audit_log desde cada mutation) está pendiente de cablear caso por caso.
        </p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-moonlight/10 bg-midnight/30 p-10 text-center">
        <Filter size={32} className="text-moonlight/30 mx-auto mb-4" />
        <h3 className="text-sm font-black text-moonlight/80 uppercase tracking-widest mb-2">Audit log vacío</h3>
        <p className="text-xs text-moonlight/50 max-w-md mx-auto leading-relaxed">
          Aún no se han registrado cambios. Las acciones admin críticas (eliminar evento, editar comisiones, registrar pagos, cambios de capital) aparecerán acá una vez cableadas al frontend.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-moonlight/10 overflow-hidden">
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-midnight/30 border-b border-moonlight/10 text-[9px] font-black tracking-[0.3em] uppercase text-moonlight/40">
        <span className="col-span-3">Cuándo</span>
        <span className="col-span-3">Actor</span>
        <span className="col-span-3">Acción</span>
        <span className="col-span-3">Entidad</span>
      </div>
      {entries.map(e => (
        <div key={e.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-moonlight/5 last:border-b-0 text-xs items-center">
          <span className="col-span-3 text-moonlight/60">{new Date(e.created_at).toLocaleString('es-CO')}</span>
          <span className="col-span-3 text-moonlight font-bold truncate">
            {e.actor_name ?? 'system'}
            {e.actor_role && <span className="ml-2 text-[9px] text-moonlight/40 uppercase tracking-widest">{e.actor_role}</span>}
          </span>
          <span className="col-span-3 font-mono text-moonlight/80">{e.action}</span>
          <span className="col-span-3 text-moonlight/50 truncate">{e.entity_label ?? e.entity_type ?? '—'}</span>
        </div>
      ))}
    </div>
  );
};

export default SystemConfig;
