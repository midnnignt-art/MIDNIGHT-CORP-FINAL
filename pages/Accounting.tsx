import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2, FileText,
  Calendar, Tag, Plus, Trash2, X,
  AlertTriangle, Award, Percent, ArrowUpRight, ArrowDownRight,
  CreditCard, Building2, Users, Megaphone, Truck, Settings, Globe,
  CheckCircle2, Edit3, Banknote, Send, Loader2, ImagePlus, Eye, ZoomIn
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { AccountingMovement, AccountingMovementType, EventSettlement } from '../types';
import { supabase } from '../lib/supabase';

// ── IMAGE COMPRESSION ─────────────────────────────────────────────────────────
const compressImage = (file: File, maxPx = 1400, quality = 0.75): Promise<Blob> =>
  new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => resolve(b!), 'image/jpeg', quality);
    };
    img.src = url;
  });

const uploadComprobante = async (file: File, eventId: string, promoterId: string): Promise<string> => {
  const compressed = await compressImage(file);
  const path = `${eventId}/${promoterId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('comprobantes').upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('comprobantes').getPublicUrl(path);
  return data.publicUrl;
};

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const UVT_2025 = 49799; // COP

const INCOME_CATEGORIES: { value: string; label: string; hint?: string }[] = [
  { value: 'ticket_sales', label: 'Venta de Boletas' },
  { value: 'sponsorship', label: 'Patrocinio / Sponsorship' },
  { value: 'merchandise', label: 'Merchandising' },
  { value: 'bar_services', label: 'Bar / Servicios F&B' },
  { value: 'venue_rental', label: 'Alquiler de Espacio' },
  { value: 'loan_received', label: '💳 Préstamo Recibido', hint: 'DR Caja · CR Préstamos por Pagar — no cuenta como ingreso operacional' },
  { value: 'other_income', label: 'Otro Ingreso' },
];

const EXPENSE_CATEGORIES: { value: string; label: string; icon: React.ReactNode; hint?: string }[] = [
  { value: 'venue', label: 'Venue / Locación', icon: <Building2 size={12} /> },
  { value: 'production', label: 'Producción', icon: <Settings size={12} /> },
  { value: 'staff', label: 'Personal / Staff', icon: <Users size={12} /> },
  { value: 'marketing', label: 'Marketing / Publicidad', icon: <Megaphone size={12} /> },
  { value: 'artists', label: 'Artistas / Booking', icon: <Award size={12} /> },
  { value: 'logistics', label: 'Logística', icon: <Truck size={12} /> },
  { value: 'administrative', label: 'Administrativo', icon: <FileText size={12} /> },
  { value: 'taxes', label: 'Impuestos / Tasas', icon: <Percent size={12} /> },
  { value: 'asset_purchase', label: '🏗️ Compra de Activo Fijo', icon: <Building2 size={12} />, hint: 'DR Inmovilizado · CR Caja — se agrega al balance como activo fijo, no como gasto operacional' },
  { value: 'loan_payment', label: '💸 Pago de Préstamo', icon: <CreditCard size={12} />, hint: 'DR Préstamos por Pagar · CR Caja — reduce la deuda financiera, no es gasto operacional' },
  { value: 'other_expense', label: 'Otro Gasto', icon: <Globe size={12} /> },
];

const ALL_CATEGORIES = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES.map(c => ({ value: c.value, label: c.label }))
];

const getCategoryLabel = (cat: string) =>
  ALL_CATEGORIES.find(c => c.value === cat)?.label ?? cat;

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
};

// ── TAX CALCULATION (Régimen Simple Colombia 2025) ───────────────────────────
// Actividad: Eventos y Conciertos → tarifa fija 5.9% (Art. 908 E.T.)
const TAX_RATE = 0.059;
const calculateSimpleTax = (annualIncome: number) => {
  const rate = TAX_RATE;
  const uvts = annualIncome / UVT_2025;
  return { tax: annualIncome * rate, rate, uvts };
};

// ── FORM COMPONENT ───────────────────────────────────────────────────────────
const MovementForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { events, addAccountingMovement, currentUser } = useStore();
  const [form, setForm] = useState({
    type: 'income' as AccountingMovementType,
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category: 'ticket_sales',
    event_id: '',
    responsible: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeEvents = events.filter(e => e.status !== 'archived');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return setError('Monto inválido');
    if (!form.description.trim()) return setError('Descripción requerida');
    setLoading(true);
    try {
      await addAccountingMovement({
        date: form.date,
        type: form.type,
        amount: Number(form.amount),
        category: form.category as any,
        event_id: form.event_id || null,
        responsible: form.responsible || null,
        description: form.description.trim(),
        created_by: currentUser?.user_id || null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const cats = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const selectedCat = cats.find(c => c.value === form.category);
  const isBalanceSheetOnly = ['loan_received', 'asset_purchase', 'loan_payment'].includes(form.category);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl overflow-y-auto">
      <div className="w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="font-black text-white text-sm uppercase tracking-widest">Nuevo Movimiento</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type Toggle */}
          <div className="flex rounded-xl overflow-hidden border border-white/10">
            <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category: 'ticket_sales' }))}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${form.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/20 hover:text-white/40'}`}>
              <TrendingUp size={12} /> Ingreso
            </button>
            <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category: 'venue' }))}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${form.type === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-white/20 hover:text-white/40'}`}>
              <TrendingDown size={12} /> Gasto / Salida
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div>
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">Fecha</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs" required />
            </div>
            {/* Amount */}
            <div>
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">Monto (COP)</label>
              <input type="number" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs" required />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">Categoría</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
              {cats.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {/* Double-entry hint */}
            {selectedCat && 'hint' in selectedCat && selectedCat.hint && (
              <div className={`mt-2 px-3 py-2 rounded-lg border text-[9px] font-bold leading-relaxed ${isBalanceSheetOnly ? 'bg-violet-500/10 border-violet-500/20 text-violet-300' : 'bg-white/5 border-white/5 text-white/30'}`}>
                📋 {selectedCat.hint}
              </div>
            )}
          </div>

          {/* Event */}
          <div>
            <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">Evento (opcional)</label>
            <select value={form.event_id} onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
              <option value="">— Sin evento asociado —</option>
              {activeEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
          </div>

          {/* Responsible + Description */}
          <input type="text" placeholder="Responsable (opcional)" value={form.responsible}
            onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))}
            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20" />

          <textarea placeholder="Descripción *" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 resize-none" required />

          {error && <p className="text-red-400 text-[10px] font-bold">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all disabled:opacity-50">
            {loading ? 'Guardando...' : 'Registrar Movimiento'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── SETTLEMENT PAYMENT MODAL ──────────────────────────────────────────────────
const SettlementModal: React.FC<{
  promoter: { user_id: string; name: string; code: string };
  eventId: string;
  eventTitle: string;
  dineroAEnviar: number;
  existingSettlements: EventSettlement[];
  onClose: () => void;
}> = ({ promoter, eventId, eventTitle, dineroAEnviar, existingSettlements, onClose }) => {
  const { addSettlement, deleteSettlement } = useStore();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('transfer');
  const [notes, setNotes] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [previewFull, setPreviewFull] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const totalEnviado = existingSettlements.reduce((s, se) => s + se.amount_sent, 0);
  const deudaActual = dineroAEnviar - totalEnviado;
  const deudaConNuevo = deudaActual - (Number(amount) || 0);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return setError('Ingresa un monto válido');
    setLoading(true);
    setError('');
    try {
      let comprobanteUrl: string | undefined;
      if (imageFile) {
        setUploadProgress('Comprimiendo imagen...');
        const compressed = await compressImage(imageFile);
        setUploadProgress('Subiendo comprobante...');
        const path = `${eventId}/${promoter.user_id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from('comprobantes').upload(path, compressed, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        comprobanteUrl = supabase.storage.from('comprobantes').getPublicUrl(path).data.publicUrl;
      }
      setUploadProgress('Guardando...');
      await addSettlement({
        event_id: eventId,
        promoter_id: promoter.user_id,
        amount_sent: Number(amount),
        payment_method: method,
        comprobante_url: comprobanteUrl,
        notes: notes || undefined,
      });
      // Reset form but keep modal open to show updated list
      setAmount('');
      setNotes('');
      setImageFile(null);
      setImagePreview(null);
      setUploadProgress('');
    } catch (e: any) {
      const raw: string = e.message || e.error_description || JSON.stringify(e);
      let friendly = raw;

      if (raw.includes('row-level security') || raw.includes('42501'))
        friendly = 'Sin permisos para insertar en event_settlements. Ve a Supabase → Authentication → Policies y agrega una política INSERT para event_settlements (o desactiva RLS en esa tabla).';
      else if (raw.includes('foreign key') || raw.includes('23503'))
        friendly = `Error de referencia en la BD: ${raw}`;
      else if (raw.includes('not-null') || raw.includes('23502'))
        friendly = `Un campo requerido está vacío: ${raw}`;
      else if (raw.includes('event_settlements_event_id_promoter_id_key'))
        friendly = '⚠️ La tabla event_settlements tiene una restricción UNIQUE que bloquea múltiples pagos. Abre Supabase → SQL Editor y ejecuta: ALTER TABLE event_settlements DROP CONSTRAINT IF EXISTS event_settlements_event_id_promoter_id_key;';
      else if (raw.includes('unique') || raw.includes('23505'))
        friendly = `Violación de clave única en la BD: ${raw}`;
      else if (raw.includes('storage') || raw.includes('bucket'))
        friendly = `Error al subir la imagen: ${raw}. Verifica que el bucket "comprobantes" existe y tiene política de INSERT.`;
      else if (raw.includes('JWT') || raw.includes('auth') || raw.toLowerCase().includes('unauthorized'))
        friendly = 'Sesión expirada. Recarga la página y vuelve a iniciar sesión.';

      setError(friendly);
      console.error('[SettlementModal] Error:', e);
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const methodLabel = (m: string | null) =>
    m === 'cash' ? '💵 Efectivo' : m === 'transfer' ? '🏦 Transferencia' : '🔀 Mixto';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl overflow-y-auto">
      {/* Full image preview */}
      {previewFull && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/98 cursor-zoom-out" onClick={() => setPreviewFull(null)}>
          <img src={previewFull} alt="comprobante" className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain" />
          <button className="absolute top-4 right-4 text-white/50 hover:text-white"><X size={20} /></button>
        </div>
      )}

      <div className="w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h3 className="font-black text-white text-sm uppercase tracking-widest">Cierre · {promoter.name}</h3>
            <p className="text-[9px] text-white/30 mt-0.5">{eventTitle} · {promoter.code}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={16} /></button>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/5">
          {[
            { label: 'Debe enviar', value: fmt(dineroAEnviar), color: 'text-white' },
            { label: 'Total enviado', value: fmt(totalEnviado), color: 'text-emerald-400' },
            { label: 'Deuda', value: deudaActual <= 0 ? '✓ PAZ Y SALVO' : fmt(deudaActual), color: deudaActual > 0 ? 'text-amber-400' : 'text-emerald-400' },
          ].map(k => (
            <div key={k.label} className="bg-[#0d0d0d] p-3 text-center">
              <p className="text-[8px] text-white/30 uppercase font-black mb-0.5">{k.label}</p>
              <p className={`text-xs font-black ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* ── HISTORIAL DE TRANSACCIONES ── */}
          {existingSettlements.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Pagos registrados ({existingSettlements.length})</p>
              <div className="space-y-2">
                {existingSettlements.map(se => (
                  <div key={se.id} className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-emerald-400">{fmt(se.amount_sent)}</span>
                        <span className="text-[8px] text-white/30">{methodLabel(se.payment_method)}</span>
                        <span className="text-[8px] text-white/20">{se.created_at?.slice(0, 10)}</span>
                      </div>
                      {se.notes && <p className="text-[9px] text-white/30 italic mt-0.5 truncate">{se.notes}</p>}
                    </div>
                    {se.comprobante_url && (
                      <button onClick={() => setPreviewFull(se.comprobante_url!)}
                        className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-white/10 hover:border-violet-500/40 transition-all group relative">
                        <img src={se.comprobante_url} alt="comprobante" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <ZoomIn size={12} className="text-white" />
                        </div>
                      </button>
                    )}
                    <button onClick={() => deleteSettlement(se.id)}
                      className="flex-shrink-0 p-1.5 text-white/20 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── NUEVO PAGO ── */}
          <div className="border-t border-white/5 pt-4">
            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-3">Registrar nuevo pago</p>

            {/* Monto */}
            <div className="mb-3">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">Monto enviado (COP)</label>
              <input type="number" placeholder={deudaActual > 0 ? deudaActual.toString() : '0'} value={amount}
                onChange={e => { setAmount(e.target.value); setError(''); }}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-bold placeholder:text-white/15" />
              {amount && (
                <p className={`text-[9px] mt-1 font-bold ${deudaConNuevo > 0 ? 'text-amber-400' : deudaConNuevo === 0 ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {deudaConNuevo > 0 ? `Quedaría debiendo ${fmt(deudaConNuevo)}` : deudaConNuevo === 0 ? '✓ Quedaría en paz y salvo' : `Crédito a favor: ${fmt(Math.abs(deudaConNuevo))}`}
                </p>
              )}
            </div>

            {/* Método */}
            <div className="mb-3">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">Método de pago</label>
              <div className="flex rounded-xl overflow-hidden border border-white/10">
                {[
                  { v: 'cash', label: 'Efectivo', icon: <Banknote size={11} /> },
                  { v: 'transfer', label: 'Transferencia', icon: <Send size={11} /> },
                  { v: 'mixed', label: 'Mixto', icon: <CreditCard size={11} /> },
                ].map(opt => (
                  <button key={opt.v} type="button" onClick={() => setMethod(opt.v)}
                    className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${method === opt.v ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Imagen comprobante */}
            <div className="mb-3">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1 flex items-center gap-1">
                <ImagePlus size={9} /> Comprobante (imagen · se comprime auto)
              </label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
              {imagePreview ? (
                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-white/10 group">
                  <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-all">
                    <button onClick={() => setPreviewFull(imagePreview)} className="text-white p-2 rounded-lg bg-white/10 hover:bg-white/20"><Eye size={14} /></button>
                    <button onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                      className="text-red-400 p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20"><Trash2 size={14} /></button>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/70 rounded px-2 py-0.5 text-[8px] text-white/50 font-bold">
                    {imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB original` : ''}
                  </div>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-20 border-2 border-dashed border-white/10 rounded-xl text-white/20 hover:text-white/40 hover:border-white/20 transition-all flex flex-col items-center justify-center gap-1.5 text-[9px] font-black uppercase">
                  <ImagePlus size={18} />
                  Seleccionar imagen
                </button>
              )}
            </div>

            {/* Notas */}
            <textarea placeholder="Notas (opcional)" value={notes}
              onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 resize-none mb-3" />

            {error && <p className="text-red-400 text-[10px] font-bold mb-2">{error}</p>}

            <button onClick={handleSave} disabled={loading || !amount}
              className="w-full py-3 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {loading ? (uploadProgress || 'Guardando...') : 'Registrar Pago'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── KPI CARD ─────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  label: string; value: string; sub?: string;
  color?: 'green' | 'red' | 'white' | 'purple';
  icon?: React.ReactNode; trend?: number;
}> = ({ label, value, sub, color = 'white', icon, trend }) => {
  const colorMap = {
    green: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    red: 'text-red-400 border-red-500/20 bg-red-500/5',
    white: 'text-white border-white/10 bg-white/5',
    purple: 'text-violet-400 border-violet-500/20 bg-violet-500/5',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</span>
        {icon && <span className="opacity-40">{icon}</span>}
      </div>
      <p className="text-xl font-black leading-none">{value}</p>
      {sub && <p className="text-[9px] opacity-40 mt-1">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-[9px] font-bold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
};

// ── BALANCE CAPITAL EDITOR (extracted to avoid hooks-in-IIFE violation) ───────
const BalanceCapitalEditor: React.FC<{
  capitalSocial: number;
  primaAcciones: number;
  activosFijos: number;
  onSave: (cap: number, prima: number, fijos: number) => void;
}> = ({ capitalSocial, primaAcciones, activosFijos, onSave }) => {
  const [tmpCap, setTmpCap] = useState(capitalSocial.toString());
  const [tmpPrima, setTmpPrima] = useState(primaAcciones.toString());
  const [tmpFijos, setTmpFijos] = useState(activosFijos.toString());
  return (
    <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-5 space-y-3">
      <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Datos del Patrimonio y Activos Fijos</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Capital Social (COP)', val: tmpCap, set: setTmpCap },
          { label: 'Prima en Acciones / Aportes (COP)', val: tmpPrima, set: setTmpPrima },
          { label: 'Inmovilizado Neto / Activos Fijos (COP)', val: tmpFijos, set: setTmpFijos },
        ].map(f => (
          <div key={f.label}>
            <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">{f.label}</label>
            <input type="number" value={f.val} onChange={e => f.set(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-bold placeholder:text-white/15" />
          </div>
        ))}
      </div>
      <button onClick={() => onSave(Number(tmpCap)||0, Number(tmpPrima)||0, Number(tmpFijos)||0)}
        className="flex items-center gap-2 px-4 py-2 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all">
        <CheckCircle2 size={12} /> Guardar
      </button>
    </div>
  );
};

// ── EVENT COSTS PANEL (extracted to avoid hooks-in-IIFE violation) ────────────
const COST_CATS = [
  { v: 'venue', l: 'Venue / Locación' },
  { v: 'production', l: 'Producción' },
  { v: 'staff', l: 'Personal' },
  { v: 'marketing', l: 'Marketing' },
  { v: 'artists', l: 'Artistas / Booking' },
  { v: 'logistics', l: 'Logística' },
  { v: 'other', l: 'Otro' },
];

const EventCostsPanel: React.FC<{ event: any }> = ({ event }) => {
  const { updateCostActual, addEventCost } = useStore();
  const [addingCost, setAddingCost] = useState(false);
  const [newCost, setNewCost] = useState({ concept: '', category: 'venue', actual_amount: '' });
  const [savingCost, setSavingCost] = useState<string | null>(null);
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({});

  const eventCosts = event.costs || [];
  const totalProyectado = eventCosts.reduce((s: number, c: any) => s + c.amount, 0);
  const totalReal = eventCosts.filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + (c.actual_amount ?? c.amount), 0);
  const totalPendiente = eventCosts.filter((c: any) => c.status === 'pending').reduce((s: number, c: any) => s + c.amount, 0);

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-white/60">Gastos Reales del Evento</h3>
          <p className="text-[9px] text-white/25 mt-0.5">Confirma el monto real pagado · estos valores impactan el Balance General</p>
        </div>
        <button onClick={() => setAddingCost(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase text-white/40 hover:text-white transition-all">
          <Plus size={10} /> Agregar Gasto
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-px bg-white/5">
        {[
          { l: 'Proyectado', v: totalProyectado, c: 'text-white/60' },
          { l: 'Pagado Real', v: totalReal, c: 'text-red-400' },
          { l: 'Pendiente', v: totalPendiente, c: 'text-amber-400' },
        ].map(k => (
          <div key={k.l} className="bg-[#0d0d0d] p-3 text-center">
            <p className="text-[8px] text-white/30 uppercase font-black mb-0.5">{k.l}</p>
            <p className={`text-xs font-black ${k.c}`}>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(k.v)}</p>
          </div>
        ))}
      </div>

      {/* Add cost form */}
      {addingCost && (
        <div className="p-4 border-b border-white/5 bg-white/[0.02] space-y-3">
          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Nuevo Gasto Real</p>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Concepto / Descripción" value={newCost.concept}
              onChange={e => setNewCost(v => ({ ...v, concept: e.target.value }))}
              className="col-span-2 bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20" />
            <select value={newCost.category} onChange={e => setNewCost(v => ({ ...v, category: e.target.value }))}
              className="bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
              {COST_CATS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
            <input type="number" placeholder="Monto real pagado (COP)" value={newCost.actual_amount}
              onChange={e => setNewCost(v => ({ ...v, actual_amount: e.target.value }))}
              className="bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!newCost.concept || !newCost.actual_amount) return;
                setSavingCost('new');
                try {
                  await addEventCost(event.id, {
                    concept: newCost.concept,
                    category: newCost.category as any,
                    amount: Number(newCost.actual_amount),
                    actual_amount: Number(newCost.actual_amount),
                    status: 'paid',
                  });
                  setNewCost({ concept: '', category: 'venue', actual_amount: '' });
                  setAddingCost(false);
                } finally { setSavingCost(null); }
              }}
              disabled={savingCost === 'new'}
              className="flex-1 py-2 bg-white text-black font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
              {savingCost === 'new' ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
              Registrar como Pagado
            </button>
            <button onClick={() => setAddingCost(false)}
              className="px-3 py-2 bg-white/5 text-white/30 font-black text-[9px] uppercase rounded-xl hover:text-white transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Cost rows */}
      {eventCosts.length === 0 ? (
        <div className="p-10 text-center">
          <FileText size={24} className="text-white/10 mx-auto mb-2" />
          <p className="text-white/20 text-[10px] uppercase tracking-widest">Sin gastos registrados</p>
          <p className="text-white/10 text-[9px] mt-1">Usa "Agregar Gasto" para registrar los costos reales</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.03]">
          {eventCosts.map((cost: any) => {
            const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
            const isEditing = editAmounts[cost.id] !== undefined;
            const realAmt = cost.actual_amount ?? cost.amount;
            const diff = cost.actual_amount != null ? cost.actual_amount - cost.amount : 0;
            return (
              <div key={cost.id} className={`p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-all ${cost.status === 'paid' ? 'border-l-2 border-l-emerald-500/40' : 'border-l-2 border-l-amber-500/30'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${cost.status === 'paid' ? 'bg-emerald-500/15' : 'bg-amber-500/10'}`}>
                  {cost.status === 'paid' ? <CheckCircle2 size={12} className="text-emerald-400" /> : <AlertTriangle size={12} className="text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{cost.concept}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-[9px] text-white/30 uppercase">{COST_CATS.find(c => c.v === cost.category)?.l ?? cost.category}</span>
                    <span className="text-[9px] text-white/20">·</span>
                    <span className="text-[9px] text-white/30">Presupuestado: {fmt(cost.amount)}</span>
                    {diff !== 0 && cost.status === 'paid' && (
                      <span className={`text-[9px] font-bold ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {diff > 0 ? `+${fmt(diff)} sobre presupuesto` : `${fmt(Math.abs(diff))} bajo presupuesto`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <input type="number" value={editAmounts[cost.id]}
                        onChange={e => setEditAmounts(v => ({ ...v, [cost.id]: e.target.value }))}
                        className="w-32 bg-black border border-white/20 rounded-lg px-2 py-1.5 text-white text-xs font-bold text-right"
                        placeholder="Monto real" autoFocus />
                      <button
                        onClick={async () => {
                          const amt = Number(editAmounts[cost.id]);
                          if (!amt) return;
                          setSavingCost(cost.id);
                          try {
                            await updateCostActual(cost.id, amt, 'paid');
                            setEditAmounts(v => { const n = { ...v }; delete n[cost.id]; return n; });
                          } finally { setSavingCost(null); }
                        }}
                        disabled={savingCost === cost.id}
                        className="px-2.5 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-[9px] font-black uppercase flex items-center gap-1">
                        {savingCost === cost.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                        Confirmar
                      </button>
                      <button onClick={() => setEditAmounts(v => { const n = { ...v }; delete n[cost.id]; return n; })}
                        className="p-1.5 text-white/20 hover:text-white rounded-lg"><X size={12} /></button>
                    </>
                  ) : (
                    <>
                      <span className={`text-sm font-black ${cost.status === 'paid' ? 'text-emerald-400' : 'text-white/40'}`}>
                        {fmt(cost.status === 'paid' ? realAmt : cost.amount)}
                      </span>
                      <button
                        onClick={() => setEditAmounts(v => ({ ...v, [cost.id]: (cost.actual_amount ?? cost.amount).toString() }))}
                        className={`p-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all ${cost.status === 'paid' ? 'bg-white/5 text-white/30 hover:text-white' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}>
                        <Edit3 size={10} /> {cost.status === 'paid' ? 'Editar' : 'Pagar'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export const Accounting: React.FC = () => {
  const { accountingMovements, orders, events, tiers, promoters, settlements, deleteAccountingMovement, updateCostActual, addEventCost } = useStore();
  const [activeTab, setActiveTab] = useState<'resumen' | 'balance' | 'movimientos' | 'pyl' | 'eventos' | 'impuestos' | 'cierre'>('resumen');
  const [showForm, setShowForm] = useState(false);

  // Cierre state
  const [cierreEventId, setCierreEventId] = useState('');
  const [settlementTarget, setSettlementTarget] = useState<{
    promoter: { user_id: string; name: string; code: string };
    eventId: string; eventTitle: string; dineroAEnviar: number;
    existingSettlements: EventSettlement[];
  } | null>(null);

  // ── BALANCE SHEET MANUAL INPUTS (persisted in localStorage) ─────────────────
  const [capitalSocial, setCapitalSocial] = useState(() => Number(localStorage.getItem('midnight_capitalSocial') || '0'));
  const [primaAcciones, setPrimaAcciones] = useState(() => Number(localStorage.getItem('midnight_primaAcciones') || '0'));
  const [activosFijos, setActivosFijos] = useState(() => Number(localStorage.getItem('midnight_activosFijos') || '0'));
  const [editingBalance, setEditingBalance] = useState(false);

  const saveBalanceInputs = (cap: number, prima: number, fijos: number) => {
    localStorage.setItem('midnight_capitalSocial', cap.toString());
    localStorage.setItem('midnight_primaAcciones', prima.toString());
    localStorage.setItem('midnight_activosFijos', fijos.toString());
    setCapitalSocial(cap); setPrimaAcciones(prima); setActivosFijos(fijos);
    setEditingBalance(false);
  };

  // ── FILTERS (Movimientos Tab) ─────────────────────────────────────────────
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // ── CORE CALCULATIONS ─────────────────────────────────────────────────────
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);

  // Total income from ticket sales (orders)
  const orderIncome = useMemo(() => completedOrders.reduce((s, o) => s + (o.total || 0), 0), [completedOrders]);

  // Balance-sheet-only categories (excluded from P&L)
  const BALANCE_ONLY_CATS = ['loan_received', 'asset_purchase', 'loan_payment'];

  // Operational movements (affect P&L)
  const movIncomes = useMemo(() => accountingMovements.filter(m => m.type === 'income' && !BALANCE_ONLY_CATS.includes(m.category)), [accountingMovements]);
  const movExpenses = useMemo(() => accountingMovements.filter(m => m.type === 'expense' && !BALANCE_ONLY_CATS.includes(m.category)), [accountingMovements]);

  // Balance-sheet movements
  const loanReceived = useMemo(() => accountingMovements.filter(m => m.category === 'loan_received').reduce((s, m) => s + m.amount, 0), [accountingMovements]);
  const loanPayments = useMemo(() => accountingMovements.filter(m => m.category === 'loan_payment').reduce((s, m) => s + m.amount, 0), [accountingMovements]);
  const assetPurchases = useMemo(() => accountingMovements.filter(m => m.category === 'asset_purchase').reduce((s, m) => s + m.amount, 0), [accountingMovements]);
  const deudaFinanciera = Math.max(0, loanReceived - loanPayments);

  const totalMovIncome = useMemo(() => movIncomes.reduce((s, m) => s + m.amount, 0), [movIncomes]);
  const totalMovExpense = useMemo(() => movExpenses.reduce((s, m) => s + m.amount, 0), [movExpenses]);

  // Event costs from event_costs table
  const eventCostsPaid = useMemo(() =>
    events.flatMap(e => e.costs || []).filter(c => c.status === 'paid').reduce((s, c) => s + (c.actual_amount ?? c.amount), 0),
    [events]
  );

  const totalIncome = orderIncome + totalMovIncome;
  const totalExpenses = totalMovExpense + eventCostsPaid;
  const netResult = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? (netResult / totalIncome) * 100 : 0;

  // ── CURRENT MONTH FILTER ──────────────────────────────────────────────────
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyOrders = useMemo(() =>
    completedOrders.filter(o => (o.timestamp || '').startsWith(currentMonth)),
    [completedOrders, currentMonth]
  );
  const monthlyOrderIncome = monthlyOrders.reduce((s, o) => s + o.total, 0);
  const monthlyMovIncome = movIncomes.filter(m => m.date.startsWith(currentMonth)).reduce((s, m) => s + m.amount, 0);
  const monthlyMovExpense = movExpenses.filter(m => m.date.startsWith(currentMonth)).reduce((s, m) => s + m.amount, 0);
  const monthlyIncome = monthlyOrderIncome + monthlyMovIncome;
  const monthlyExpenses = monthlyMovExpense;
  const monthlyNet = monthlyIncome - monthlyExpenses;

  // ── MOVEMENTS FILTERED ────────────────────────────────────────────────────
  const filteredMovements = useMemo(() => {
    return accountingMovements.filter(m => {
      if (filterType !== 'all' && m.type !== filterType) return false;
      if (filterEvent && m.event_id !== filterEvent) return false;
      if (filterMonth && !m.date.startsWith(filterMonth)) return false;
      return true;
    });
  }, [accountingMovements, filterType, filterEvent, filterMonth]);

  // ── P&L BY MONTH ─────────────────────────────────────────────────────────
  const pnlMonths = useMemo(() => {
    const months: Record<string, { income: number; expense: number }> = {};
    completedOrders.forEach(o => {
      const m = (o.timestamp || '').slice(0, 7);
      if (!m) return;
      if (!months[m]) months[m] = { income: 0, expense: 0 };
      months[m].income += o.total;
    });
    accountingMovements.forEach(mv => {
      const m = mv.date.slice(0, 7);
      if (!months[m]) months[m] = { income: 0, expense: 0 };
      if (mv.type === 'income') months[m].income += mv.amount;
      else months[m].expense += mv.amount;
    });
    events.forEach(ev =>
      (ev.costs || []).filter(c => c.status === 'paid').forEach(c => {
        const m = currentMonth;
        if (!months[m]) months[m] = { income: 0, expense: 0 };
        months[m].expense += c.amount;
      })
    );
    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, data]) => ({ month, ...data, net: data.income - data.expense }));
  }, [completedOrders, accountingMovements, events, currentMonth]);

  // ── EVENT ANALYSIS ────────────────────────────────────────────────────────
  const eventAnalysis = useMemo(() =>
    events
      .filter(e => e.status !== 'archived')
      .map(ev => {
        const evOrders = completedOrders.filter(o => o.event_id === ev.id);
        const evOrderIncome = evOrders.reduce((s, o) => s + o.total, 0);
        const evMovIncome = movIncomes.filter(m => m.event_id === ev.id).reduce((s, m) => s + m.amount, 0);
        const evMovExpense = movExpenses.filter(m => m.event_id === ev.id).reduce((s, m) => s + m.amount, 0);
        const evCosts = (ev.costs || []).filter(c => c.status === 'paid').reduce((s, c) => s + (c.actual_amount ?? c.amount), 0);
        const totalEvIncome = evOrderIncome + evMovIncome;
        const totalEvExpense = evMovExpense + evCosts;
        const netEv = totalEvIncome - totalEvExpense;
        const marginEv = totalEvIncome > 0 ? (netEv / totalEvIncome) * 100 : 0;
        return { ev, totalEvIncome, totalEvExpense, netEv, marginEv, tickets: evOrders.length };
      })
      .sort((a, b) => b.netEv - a.netEv),
    [events, completedOrders, movIncomes, movExpenses]
  );

  // ── TAX ──────────────────────────────────────────────────────────────────
  const annualProjected = totalIncome;
  const taxCalc = calculateSimpleTax(annualProjected);

  // ── EXPENSE BREAKDOWN ─────────────────────────────────────────────────────
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    movExpenses.forEach(m => {
      map[m.category] = (map[m.category] || 0) + m.amount;
    });
    events.forEach(ev =>
      (ev.costs || []).filter(c => c.status === 'paid').forEach(c => {
        map[c.category] = (map[c.category] || 0) + c.amount;
      })
    );
    return Object.entries(map)
      .map(([cat, amount]) => ({ cat, amount, label: getCategoryLabel(cat) }))
      .sort((a, b) => b.amount - a.amount);
  }, [movExpenses, events]);

  // ── ACCOUNTS RECEIVABLE (Cuentas por Cobrar) ─────────────────────────────────
  // For each event+promoter, calculate: dineroAEnviar - sum(settlements.amount_sent)
  const cuentasPorCobrar = useMemo(() => {
    // Group orders by event+promoter
    const map = new Map<string, { event: any; promoter: any; dineroAEnviar: number; yaEnviado: number }>();
    completedOrders.forEach(o => {
      if (!o.staff_id) return; // direct sales don't create receivables
      const key = `${o.event_id}_${o.staff_id}`;
      if (!map.has(key)) {
        map.set(key, {
          event: events.find(e => e.id === o.event_id),
          promoter: promoters.find(p => p.user_id === o.staff_id),
          dineroAEnviar: 0,
          yaEnviado: 0,
        });
      }
      const entry = map.get(key)!;
      entry.dineroAEnviar += (o.net_amount || 0);
    });
    // Add settlements
    settlements.forEach(se => {
      const key = `${se.event_id}_${se.promoter_id}`;
      if (map.has(key)) {
        map.get(key)!.yaEnviado += se.amount_sent;
      }
    });
    return Array.from(map.values())
      .filter(r => r.dineroAEnviar > r.yaEnviado)
      .map(r => ({ ...r, deuda: r.dineroAEnviar - r.yaEnviado }));
  }, [completedOrders, settlements, events, promoters]);

  const totalCuentasPorCobrar = useMemo(() =>
    cuentasPorCobrar.reduce((s, r) => s + r.deuda, 0), [cuentasPorCobrar]);

  // ── CASH IN HAND ──────────────────────────────────────────────────────────────
  const efectivoRecibido = useMemo(() => {
    // Direct sales (no promoter, money goes straight to company)
    const directSales = completedOrders
      .filter(o => !o.staff_id)
      .reduce((s, o) => s + (o.total || 0), 0);
    // Settled amounts (promoters physically sent this)
    const settled = settlements.reduce((s, se) => s + se.amount_sent, 0);
    // Operational income movements
    const incomeMovs = movIncomes.reduce((s, m) => s + m.amount, 0);
    // Loan funds received (increase cash)
    const loans = loanReceived;
    // Asset purchases and loan payments reduce cash
    const cashOut = assetPurchases + loanPayments;
    // Operational expenses reduce cash
    const opExpenses = movExpenses.reduce((s, m) => s + m.amount, 0);
    // Net cash = all cash in - all cash out
    return directSales + settled + incomeMovs + loans - cashOut - opExpenses - eventCostsPaid;
  }, [completedOrders, settlements, movIncomes, movExpenses, loanReceived, assetPurchases, loanPayments, eventCostsPaid]);

  // ── PENDING COSTS (Cuentas por Pagar) ─────────────────────────────────────────
  const cuentasPorPagar = useMemo(() =>
    events.flatMap(e => (e.costs || []).filter(c => c.status === 'pending'))
      .reduce((s, c) => s + c.amount, 0),
    [events]
  );

  // ── COMMISSIONS TOTAL ─────────────────────────────────────────────────────────
  const totalComisionesGanadas = useMemo(() =>
    completedOrders.reduce((s, o) => s + (o.commission_amount || 0), 0),
    [completedOrders]
  );

  // ── MONTHLY DETAILED P&L ──────────────────────────────────────────────────────
  const monthlyPnL = useMemo(() => {
    // Group events by month (using event_date)
    const monthMap = new Map<string, {
      month: string;
      events: Array<{
        ev: any;
        ingresosBoletas: number;
        comisiones: number;
        costosEvento: number;
        otrosIngresos: number;
        otrosGastos: number;
        tickets: number;
      }>;
      gastosOperativos: number;
      otrosIngresosMes: number;
    }>();

    // Process events
    events.forEach(ev => {
      const m = (ev.event_date || '').slice(0, 7);
      if (!m) return;
      if (!monthMap.has(m)) monthMap.set(m, { month: m, events: [], gastosOperativos: 0, otrosIngresosMes: 0 });

      const evOrders = completedOrders.filter(o => o.event_id === ev.id);
      const ingresosBoletas = evOrders.reduce((s, o) => s + (o.total || 0), 0);
      const comisiones = evOrders.reduce((s, o) => s + (o.commission_amount || 0), 0);
      const costosEvento = (ev.costs || []).filter(c => c.status === 'paid').reduce((s, c) => s + (c.actual_amount ?? c.amount), 0);
      const otrosIngresos = movIncomes.filter(mv => mv.event_id === ev.id).reduce((s, m) => s + m.amount, 0);
      const otrosGastos = movExpenses.filter(mv => mv.event_id === ev.id).reduce((s, m) => s + m.amount, 0);
      const tickets = evOrders.length;

      if (ingresosBoletas > 0 || comisiones > 0 || costosEvento > 0 || otrosIngresos > 0 || otrosGastos > 0 || tickets > 0) {
        monthMap.get(m)!.events.push({ ev, ingresosBoletas, comisiones, costosEvento, otrosIngresos, otrosGastos, tickets });
      }
    });

    // Process accounting movements not linked to events
    accountingMovements.forEach(mv => {
      if (mv.event_id) return; // already handled via events
      const m = mv.date.slice(0, 7);
      if (!m) return;
      if (!monthMap.has(m)) monthMap.set(m, { month: m, events: [], gastosOperativos: 0, otrosIngresosMes: 0 });
      if (mv.type === 'expense') monthMap.get(m)!.gastosOperativos += mv.amount;
      else monthMap.get(m)!.otrosIngresosMes += mv.amount;
    });

    return Array.from(monthMap.values())
      .sort((a, b) => b.month.localeCompare(a.month))
      .map(row => {
        const totalIngresosBoletas = row.events.reduce((s, e) => s + e.ingresosBoletas, 0);
        const totalOtrosIngresos = row.events.reduce((s, e) => s + e.otrosIngresos, 0) + row.otrosIngresosMes;
        const totalIngresos = totalIngresosBoletas + totalOtrosIngresos;
        const totalComisiones = row.events.reduce((s, e) => s + e.comisiones, 0);
        const totalCostosEvento = row.events.reduce((s, e) => s + e.costosEvento, 0);
        const totalGastosOpe = row.events.reduce((s, e) => s + e.otrosGastos, 0) + row.gastosOperativos;
        const utilidadBruta = totalIngresos - totalComisiones - totalCostosEvento;
        const utilidadOperacional = utilidadBruta - totalGastosOpe;
        const impuesto = utilidadOperacional > 0 ? calculateSimpleTax(utilidadOperacional * 12).tax / 12 : 0; // monthly estimate
        const utilidadNeta = utilidadOperacional - impuesto;
        return {
          ...row,
          totalIngresos, totalIngresosBoletas, totalOtrosIngresos,
          totalComisiones, totalCostosEvento, totalGastosOpe,
          utilidadBruta, utilidadOperacional, impuesto, utilidadNeta,
        };
      });
  }, [events, completedOrders, accountingMovements, movIncomes, movExpenses]);

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'balance', label: 'Balance General' },
    { id: 'pyl', label: 'Estado de Resultados' },
    { id: 'movimientos', label: 'Movimientos' },
    { id: 'eventos', label: 'Eventos' },
    { id: 'impuestos', label: 'Impuestos' },
    { id: 'cierre', label: '⬡ Cierre' },
  ] as const;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
      {showForm && <MovementForm onClose={() => setShowForm(false)} />}
      {settlementTarget && (
        <SettlementModal
          promoter={settlementTarget.promoter}
          eventId={settlementTarget.eventId}
          eventTitle={settlementTarget.eventTitle}
          dineroAEnviar={settlementTarget.dineroAEnviar}
          existingSettlements={settlementTarget.existingSettlements}
          onClose={() => setSettlementTarget(null)}
        />
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl md:text-5xl font-black text-moonlight uppercase tracking-tighter">Contabilidad</h2>
          <p className="text-moonlight/30 text-xs font-light tracking-[0.3em] uppercase mt-1">Centro Financiero · Súper Admin</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all">
          <Plus size={14} /> Movimiento
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-xl border border-white/5 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-fit py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap px-3 ${activeTab === t.id ? 'bg-white text-black' : 'text-white/30 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: RESUMEN ─────────────────────────────────────────────────── */}
      {activeTab === 'resumen' && (
        <div className="space-y-6">
          {/* Company Header */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-white tracking-tighter uppercase">MIDNIGHT EVENTS SAS</h3>
                <p className="text-[10px] text-white/40 font-light tracking-widest uppercase mt-0.5">Centro de Control Financiero · Súper Admin</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-white/30 uppercase tracking-widest font-black">Fecha de corte</p>
                <p className="text-xs text-white/60 font-bold">{new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
          </div>

          {/* 5 KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Ingresos Totales" value={fmtShort(totalIncome)} sub={`${completedOrders.length} órdenes + movimientos`} color="green" icon={<TrendingUp size={14} />} />
            <KpiCard label="Gastos Totales" value={fmtShort(totalExpenses)} sub="Costos + movimientos" color="red" icon={<TrendingDown size={14} />} />
            <KpiCard label="Utilidad Neta" value={fmtShort(netResult)} sub={`Margen: ${margin.toFixed(1)}%`} color={netResult >= 0 ? 'green' : 'red'} icon={<DollarSign size={14} />} />
            <KpiCard label="Cuentas por Cobrar" value={fmtShort(totalCuentasPorCobrar)} sub="Pendiente de promotores" color="white" icon={<Users size={14} />} />
            <KpiCard label="Efectivo Recibido" value={fmtShort(efectivoRecibido)} sub="Caja real + transferencias" color="purple" icon={<Banknote size={14} />} />
          </div>

          {/* Mini Balance */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Resumen de Situación Financiera</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Activos */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-[9px] font-black text-emerald-400/70 uppercase tracking-widest mb-3">ACTIVOS</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-white/60">
                    <span>Efectivo en caja (neto)</span><span className="text-emerald-400 font-bold">{fmt(Math.max(0, efectivoRecibido))}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-white/60">
                    <span>Cuentas por cobrar</span><span className="text-amber-400 font-bold">{fmt(totalCuentasPorCobrar)}</span>
                  </div>
                  <div className="border-t border-emerald-500/20 pt-2 flex justify-between font-black text-white text-xs">
                    <span>TOTAL ACTIVOS</span><span className="text-emerald-400">{fmt(efectivoRecibido + totalCuentasPorCobrar)}</span>
                  </div>
                </div>
              </div>
              {/* Pasivos */}
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                <p className="text-[9px] font-black text-red-400/70 uppercase tracking-widest mb-3">PASIVOS</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-white/60">
                    <span>Costos pendientes</span><span className="text-red-400 font-bold">{fmt(cuentasPorPagar)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-white/60">
                    <span>Impuesto estimado</span><span className="text-amber-400 font-bold">{fmt(taxCalc.tax)}</span>
                  </div>
                  <div className="border-t border-red-500/20 pt-2 flex justify-between font-black text-white text-xs">
                    <span>TOTAL PASIVOS</span><span className="text-red-400">{fmt(cuentasPorPagar + taxCalc.tax)}</span>
                  </div>
                </div>
              </div>
              {/* Patrimonio */}
              <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
                <p className="text-[9px] font-black text-violet-400/70 uppercase tracking-widest mb-3">PATRIMONIO</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-white/60">
                    <span>Resultado del período</span><span className={`font-bold ${netResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(netResult)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-white/60">
                    <span>Utilidad neta est.</span><span className="text-violet-400 font-bold">{fmt(netResult - taxCalc.tax)}</span>
                  </div>
                  <div className="border-t border-violet-500/20 pt-2 flex justify-between font-black text-white text-xs">
                    <span>TOTAL PATRIMONIO</span><span className="text-violet-400">{fmt(netResult)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cuentas por Cobrar Table */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-white/5">
              <Send size={12} className="text-amber-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Cuentas por Cobrar · Deudas de Promotores</h3>
              {totalCuentasPorCobrar > 0 && (
                <span className="ml-auto text-xs font-black text-amber-400">{fmt(totalCuentasPorCobrar)}</span>
              )}
            </div>
            {cuentasPorCobrar.length === 0 ? (
              <div className="p-10 text-center">
                <CheckCircle2 size={28} className="text-emerald-500/30 mx-auto mb-2" />
                <p className="text-white/20 text-[10px] uppercase tracking-widest">Sin deudas pendientes</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-5 gap-2 px-5 py-2.5 border-b border-white/5">
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest col-span-1">Evento</span>
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest col-span-1">Promotor</span>
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest text-right">Debe Enviar</span>
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest text-right">Ya Enviado</span>
                  <span className="text-[9px] font-black text-amber-400/60 uppercase tracking-widest text-right">Deuda</span>
                </div>
                <div className="divide-y divide-white/[0.03]">
                  {cuentasPorCobrar.map((r, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 px-5 py-3 hover:bg-white/[0.02] transition-all border-l-2 border-l-amber-500/40">
                      <span className="text-[11px] text-white/60 truncate col-span-1">{r.event?.title ?? '—'}</span>
                      <span className="text-[11px] text-white font-bold truncate col-span-1">{r.promoter?.name ?? '—'}</span>
                      <span className="text-[11px] text-white/60 text-right">{fmt(r.dineroAEnviar)}</span>
                      <span className="text-[11px] text-emerald-400 text-right">{fmt(r.yaEnviado)}</span>
                      <span className="text-[11px] font-black text-amber-400 text-right">{fmt(r.deuda)}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-2 px-5 py-3 bg-white/5">
                  <span className="text-[10px] font-black text-white uppercase col-span-2">TOTAL</span>
                  <span />
                  <span />
                  <span className="text-[10px] font-black text-amber-400 text-right">{fmt(totalCuentasPorCobrar)}</span>
                </div>
              </>
            )}
          </div>

          {/* GASTOS POR CATEGORÍA */}
          {expenseByCategory.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Gastos por Categoría</h3>
              <div className="space-y-2">
                {expenseByCategory.map(({ cat, amount, label }) => (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-24 text-[9px] text-white/40 uppercase truncate">{label}</div>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500/50 rounded-full" style={{ width: `${Math.min((amount / totalExpenses) * 100, 100)}%` }} />
                    </div>
                    <div className="w-20 text-right text-[10px] font-bold text-white/60">{fmtShort(amount)}</div>
                    <div className="w-10 text-right text-[9px] text-white/30">{((amount / totalExpenses) * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MOVIMIENTOS ─────────────────────────────────────────────── */}
      {activeTab === 'movimientos' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
              <option value="all">Todos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Gastos</option>
            </select>
            <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
              <option value="">Todos los eventos</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs" />
            {(filterType !== 'all' || filterEvent || filterMonth) && (
              <button onClick={() => { setFilterType('all'); setFilterEvent(''); setFilterMonth(''); }}
                className="flex items-center gap-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/40 text-xs hover:text-white transition-all">
                <X size={10} /> Limpiar
              </button>
            )}
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
              <p className="text-[9px] text-emerald-400/60 uppercase font-black">Ingresos filtrados</p>
              <p className="text-sm font-black text-emerald-400">{fmt(filteredMovements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0))}</p>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
              <p className="text-[9px] text-red-400/60 uppercase font-black">Gastos filtrados</p>
              <p className="text-sm font-black text-red-400">{fmt(filteredMovements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0))}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-[9px] text-white/40 uppercase font-black">Registros</p>
              <p className="text-sm font-black text-white">{filteredMovements.length}</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            {filteredMovements.length === 0 ? (
              <div className="p-12 text-center">
                <FileText size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/20 text-xs uppercase tracking-widest">Sin movimientos registrados</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredMovements.map(m => {
                  const ev = events.find(e => e.id === m.event_id);
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-all group">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.type === 'income' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                        {m.type === 'income' ? <ArrowUpRight size={12} className="text-emerald-400" /> : <ArrowDownRight size={12} className="text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-bold truncate">{m.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-white/30">{m.date}</span>
                          <span className="text-[9px] text-white/20">·</span>
                          <span className="text-[9px] text-white/30">{getCategoryLabel(m.category)}</span>
                          {ev && <>
                            <span className="text-[9px] text-white/20">·</span>
                            <span className="text-[9px] text-violet-400/60">{ev.title}</span>
                          </>}
                          {m.responsible && <>
                            <span className="text-[9px] text-white/20">·</span>
                            <span className="text-[9px] text-white/30">{m.responsible}</span>
                          </>}
                        </div>
                      </div>
                      <p className={`text-sm font-black flex-shrink-0 ${m.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {m.type === 'income' ? '+' : '-'}{fmt(m.amount)}
                      </p>
                      <button onClick={() => { if (confirm('¿Eliminar este movimiento?')) deleteAccountingMovement(m.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all ml-1">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: BALANCE GENERAL ──────────────────────────────────────────── */}
      {activeTab === 'balance' && (() => {
        // ── ACTIVOS ──────────────────────────────────────────────────────────────
        // Efectivo: todo el dinero físicamente en caja/banco
        //   = Ventas directas cobradas
        //   + Pagos recibidos de promotores (settlements)
        //   + Ingresos registrados manualmente (movimientos tipo ingreso)
        //   + Préstamos recibidos
        //   − Gastos operativos pagados (movimientos tipo gasto)
        //   − Costos de eventos ya pagados
        //   − Compras de activos fijos (esa plata salió de caja)
        //   − Pagos de préstamos (esa plata también salió)
        const efectivoCaja = Math.max(0, efectivoRecibido);

        // CxC: lo que los promotores todavía te deben
        const cxc = totalCuentasPorCobrar;

        // Activos fijos: bienes físicos de la empresa
        //   = Ingresado manualmente + compras registradas como "Compra de Activo Fijo"
        const inmovilizado = activosFijos + assetPurchases;

        const totalActivoCorriente = efectivoCaja + cxc;
        const totalActivoNoCorriente = inmovilizado;
        const totalActivos = totalActivoCorriente + totalActivoNoCorriente;

        // ── PASIVOS ──────────────────────────────────────────────────────────────
        // CxP: gastos de eventos comprometidos pero aún no pagados
        const totalPasivosCorrientes = cuentasPorPagar + taxCalc.tax;
        // Préstamos: lo que se recibió como préstamo menos lo ya devuelto
        const totalPasivosNoCorrientes = deudaFinanciera;
        const totalPasivos = totalPasivosCorrientes + totalPasivosNoCorrientes;

        // ── PATRIMONIO (RESIDUAL) ─────────────────────────────────────────────────
        // Patrimonio Neto = lo que le pertenece a los dueños = Activos − Pasivos
        // Las "Utilidades del Período" son el número que hace cuadrar el balance:
        //   Utilidades = Patrimonio Neto − Capital Social − Aportes
        // Esto es contablemente correcto y garantiza que el cuadre sea SIEMPRE $0.
        const patrimonioNeto = totalActivos - totalPasivos;
        const utilidadesBalance = patrimonioNeto - capitalSocial - primaAcciones;
        const totalPatrimonio = capitalSocial + primaAcciones + utilidadesBalance; // = patrimonioNeto
        const totalPasivoPatrimonio = totalPasivos + totalPatrimonio;              // = totalActivos

        // ── HELPERS UI ───────────────────────────────────────────────────────────
        const Row = ({ label, value, indent = 0, color = 'white', sub }: {
          label: string; value: number; indent?: number; color?: string; sub?: string;
        }) => (
          <div className="grid grid-cols-3 gap-0 px-5 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.015] transition-all">
            <div className={`col-span-2 ${indent === 1 ? 'pl-6' : indent === 2 ? 'pl-10' : ''}`}>
              <span className={`text-xs font-medium ${
                color === 'emerald' ? 'text-emerald-400' :
                color === 'red' ? 'text-red-400' :
                color === 'violet' ? 'text-violet-400' :
                color === 'amber' ? 'text-amber-400' : 'text-white/75'
              }`}>{label}</span>
              {sub && <p className="text-[9px] text-white/25 mt-0.5 leading-relaxed">{sub}</p>}
            </div>
            <span className={`text-xs text-right font-bold ${
              color === 'emerald' ? 'text-emerald-400' :
              color === 'red' ? 'text-red-400' :
              color === 'violet' ? 'text-violet-400' :
              color === 'amber' ? 'text-amber-400' : 'text-white/60'
            }`}>{fmt(value)}</span>
          </div>
        );

        const Total = ({ label, value, color, size = 'md' }: {
          label: string; value: number; color: string; size?: 'md' | 'lg';
        }) => (
          <div className={`grid grid-cols-3 gap-0 px-5 border-t-2 ${
            color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/30 py-3' :
            color === 'red' ? 'bg-red-500/10 border-red-500/30 py-3' :
            color === 'violet' ? 'bg-violet-500/10 border-violet-500/30 py-3' :
            'bg-white/[0.06] border-white/20 py-4'
          }`}>
            <span className={`font-black uppercase col-span-2 ${size === 'lg' ? 'text-sm' : 'text-[11px]'} ${
              color === 'emerald' ? 'text-emerald-400' :
              color === 'red' ? 'text-red-400' :
              color === 'violet' ? 'text-violet-400' : 'text-white'
            }`}>{label}</span>
            <span className={`font-black text-right ${size === 'lg' ? 'text-sm' : 'text-[11px]'} ${
              color === 'emerald' ? 'text-emerald-400' :
              color === 'red' ? 'text-red-400' :
              color === 'violet' ? 'text-violet-400' : 'text-white'
            }`}>{fmt(value)}</span>
          </div>
        );

        const Section = ({ label, color }: { label: string; color: string }) => (
          <div className={`px-5 py-2 ${
            color === 'emerald' ? 'bg-emerald-500/[0.07]' :
            color === 'red' ? 'bg-red-500/[0.07]' : 'bg-violet-500/[0.07]'
          }`}>
            <span className={`text-sm font-black uppercase tracking-wider ${
              color === 'emerald' ? 'text-emerald-400' :
              color === 'red' ? 'text-red-400' : 'text-violet-400'
            }`}>{label}</span>
          </div>
        );

        const Sub = ({ label, color }: { label: string; color: string }) => (
          <div className="px-5 py-1.5 bg-white/[0.015]">
            <span className={`text-[9px] font-black uppercase tracking-widest ${
              color === 'emerald' ? 'text-emerald-400/50' :
              color === 'red' ? 'text-red-400/50' : 'text-violet-400/50'
            }`}>{label}</span>
          </div>
        );

        return (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">Balance General</h3>
                <p className="text-[10px] text-white/40 mt-0.5">MIDNIGHT EVENTS SAS · Al {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <button onClick={() => setEditingBalance(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase text-white/40 hover:text-white transition-all">
                <Edit3 size={10} /> {editingBalance ? 'Cerrar' : 'Editar Capital'}
              </button>
            </div>

            {editingBalance && (
              <BalanceCapitalEditor
                capitalSocial={capitalSocial}
                primaAcciones={primaAcciones}
                activosFijos={activosFijos}
                onSave={saveBalanceInputs}
              />
            )}

            {/* ── RESUMEN 3 BLOQUES ── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'TOTAL ACTIVOS', value: totalActivos, sub: 'Lo que tiene la empresa', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'TOTAL PASIVOS', value: totalPasivos, sub: 'Lo que debe la empresa', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                { label: 'PATRIMONIO NETO', value: patrimonioNeto, sub: 'Lo que es de los dueños', color: patrimonioNeto >= 0 ? 'text-violet-400' : 'text-red-400', bg: patrimonioNeto >= 0 ? 'bg-violet-500/10 border-violet-500/20' : 'bg-red-500/10 border-red-500/20' },
              ].map(k => (
                <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">{k.label}</p>
                  <p className={`text-lg font-black ${k.color}`}>{fmtShort(k.value)}</p>
                  <p className="text-[9px] text-white/20 mt-1">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* ── TABLA BALANCE ── */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-3 px-5 py-2.5 bg-white/[0.04] border-b border-white/10">
                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest col-span-2">Concepto</span>
                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest text-right">Valor (COP)</span>
              </div>

              {/* ACTIVOS */}
              <div className="border-l-4 border-l-emerald-500/60">
                <Section label="▸ ACTIVO" color="emerald" />
                <Sub label="Activo Corriente — dinero disponible hoy" color="emerald" />
                <Row label="Efectivo en Caja / Banco" value={efectivoCaja} indent={2} color="emerald"
                  sub={`Ventas cobradas + pagos de promotores + ingresos registrados + préstamos − gastos pagados − compras activos − pagos préstamos`} />
                <Row label="Cuentas por Cobrar — Promotores" value={cxc} indent={2} color="amber"
                  sub={cxc > 0 ? `Plata que los promotores todavía te deben · ${cuentasPorCobrar.length} promotor(es)` : 'Todos los promotores están a paz y salvo'} />
                <Total label="Subtotal Activo Corriente" value={totalActivoCorriente} color="emerald" />

                <Sub label="Activo No Corriente — bienes físicos" color="emerald" />
                <Row label="Inmovilizado / Activos Fijos" value={inmovilizado} indent={2} color="emerald"
                  sub={`Manual: ${fmt(activosFijos)} + Compras registradas: ${fmt(assetPurchases)}`} />
                <Total label="Subtotal Activo No Corriente" value={totalActivoNoCorriente} color="emerald" />

                <Total label="▸ TOTAL ACTIVO" value={totalActivos} color="emerald" size="lg" />
              </div>

              {/* PASIVOS */}
              <div className="border-l-4 border-l-red-500/60 mt-2">
                <Section label="▸ PASIVO" color="red" />
                <Sub label="Pasivo Corriente — deudas a corto plazo" color="red" />
                <Row label="Costos de Eventos — Pendientes de Pago" value={cuentasPorPagar} indent={2}
                  color={cuentasPorPagar > 0 ? 'red' : 'white'}
                  sub="Gastos ya comprometidos en eventos pero aún no pagados" />
                <Row label="Impuesto Estimado — Régimen Simple 5.9%" value={taxCalc.tax} indent={2}
                  color={taxCalc.tax > 0 ? 'amber' : 'white'}
                  sub={`Sobre ${fmt(totalIncome)} ingresos operacionales`} />
                <Total label="Subtotal Pasivo Corriente" value={totalPasivosCorrientes} color="red" />

                <Sub label="Pasivo No Corriente — deudas a largo plazo" color="red" />
                <Row label="Préstamos por Pagar" value={deudaFinanciera} indent={2}
                  color={deudaFinanciera > 0 ? 'red' : 'white'}
                  sub={deudaFinanciera > 0 ? `Recibido: ${fmt(loanReceived)} − Devuelto: ${fmt(loanPayments)}` : 'Sin préstamos activos'} />
                <Total label="Subtotal Pasivo No Corriente" value={totalPasivosNoCorrientes} color="red" />

                <Total label="▸ TOTAL PASIVO" value={totalPasivos} color="red" size="lg" />
              </div>

              {/* PATRIMONIO */}
              <div className="border-l-4 border-l-violet-500/60 mt-2">
                <Section label="▸ PATRIMONIO" color="violet" />
                <Sub label="Lo que les pertenece a los dueños = Activos − Pasivos" color="violet" />
                <Row label="Capital Social" value={capitalSocial} indent={2} color="violet"
                  sub={capitalSocial === 0 ? '⚠ Ingresa con el botón Editar Capital' : 'Aportes iniciales de los socios'} />
                <Row label="Prima / Aportes Adicionales" value={primaAcciones} indent={2} color="violet"
                  sub="Aportes de socios distintos al capital mínimo" />
                <Row label="Utilidades del Período" value={utilidadesBalance} indent={2}
                  color={utilidadesBalance >= 0 ? 'emerald' : 'red'}
                  sub={`Activos (${fmt(totalActivos)}) − Pasivos (${fmt(totalPasivos)}) − Capital (${fmt(capitalSocial + primaAcciones)})`} />
                <Total label="▸ TOTAL PATRIMONIO" value={totalPatrimonio} color="violet" size="lg" />
              </div>

              {/* CUADRE */}
              <div className="grid grid-cols-3 gap-0 px-5 py-4 bg-emerald-500/10 border-t-2 border-emerald-500/30 mt-2">
                <div className="col-span-2">
                  <span className="text-sm font-black text-emerald-400 uppercase">✓ BALANCE CUADRADO</span>
                  <p className="text-[9px] text-white/25 mt-0.5">
                    Total Activo ({fmt(totalActivos)}) = Total Pasivo + Patrimonio ({fmt(totalPasivoPatrimonio)})
                  </p>
                </div>
                <span className="text-sm font-black text-emerald-400 text-right">$0</span>
              </div>
            </div>

            {/* ── CUENTAS POR COBRAR DETALLE ── */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 p-5 border-b border-white/5">
                <Send size={12} className="text-amber-400" />
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/60">Cuentas por Cobrar · Detalle de Promotores</h3>
                  <p className="text-[9px] text-white/25 mt-0.5">Estas deudas están registradas como activo en el Balance General</p>
                </div>
                {totalCuentasPorCobrar > 0 && (
                  <span className="ml-auto text-sm font-black text-amber-400">{fmt(totalCuentasPorCobrar)}</span>
                )}
              </div>
              {cuentasPorCobrar.length === 0 ? (
                <div className="p-10 text-center">
                  <CheckCircle2 size={28} className="text-emerald-500/30 mx-auto mb-2" />
                  <p className="text-white/20 text-[10px] uppercase tracking-widest">Sin deudas pendientes · Todos en paz y salvo</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-6 gap-2 px-5 py-2.5 border-b border-white/5 bg-white/[0.02]">
                    {['Promotor', 'Evento', '', 'Debe Enviar', 'Ya Enviado', 'DEUDA'].map((h, i) => (
                      <span key={i} className={`text-[9px] font-black uppercase tracking-widest ${i === 5 ? 'text-amber-400/70' : 'text-white/30'} ${i >= 3 ? 'text-right' : ''}`}>{h}</span>
                    ))}
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {cuentasPorCobrar.map((r, i) => (
                      <div key={i} className="grid grid-cols-6 gap-2 px-5 py-3 hover:bg-white/[0.02] border-l-2 border-l-amber-500/40">
                        <span className="text-[11px] text-white font-bold truncate">{r.promoter?.name ?? '—'}</span>
                        <span className="text-[11px] text-white/50 truncate col-span-2">{r.event?.title ?? '—'}</span>
                        <span className="text-[11px] text-white/50 text-right">{fmt(r.dineroAEnviar)}</span>
                        <span className="text-[11px] text-emerald-400 text-right">{fmt(r.yaEnviado)}</span>
                        <span className="text-[11px] font-black text-amber-400 text-right">{fmt(r.deuda)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-6 gap-2 px-5 py-3 bg-white/5 border-t border-white/10">
                    <span className="text-[10px] font-black text-white uppercase col-span-3">TOTAL</span>
                    <span className="text-[10px] font-black text-white/60 text-right">{fmt(cuentasPorCobrar.reduce((s, r) => s + r.dineroAEnviar, 0))}</span>
                    <span className="text-[10px] font-black text-emerald-400 text-right">{fmt(cuentasPorCobrar.reduce((s, r) => s + r.yaEnviado, 0))}</span>
                    <span className="text-[10px] font-black text-amber-400 text-right">{fmt(totalCuentasPorCobrar)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── TAB: P&L ─────────────────────────────────────────────────────── */}
      {activeTab === 'pyl' && (() => {
        const grandTotalIngresos = monthlyPnL.reduce((s, r) => s + r.totalIngresos, 0);
        const grandTotalComisiones = monthlyPnL.reduce((s, r) => s + r.totalComisiones, 0);
        const grandTotalCostos = monthlyPnL.reduce((s, r) => s + r.totalCostosEvento, 0);
        const grandTotalGastos = monthlyPnL.reduce((s, r) => s + r.totalGastosOpe, 0);
        const grandUtilidadBruta = monthlyPnL.reduce((s, r) => s + r.utilidadBruta, 0);
        const grandUtilidadOpe = monthlyPnL.reduce((s, r) => s + r.utilidadOperacional, 0);
        const grandImpuesto = monthlyPnL.reduce((s, r) => s + r.impuesto, 0);
        const grandUtilidadNeta = monthlyPnL.reduce((s, r) => s + r.utilidadNeta, 0);

        const monthLabel = (m: string) => {
          const [y, mo] = m.split('-');
          const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
          return `${names[parseInt(mo) - 1]} ${y}`;
        };

        // % sobre ingresos totales del período (o acumulado)
        const pct = (val: number, base: number) =>
          base === 0 ? '—' : `${((val / base) * 100).toFixed(1)}%`;

        // Barra proporcional de color según positivo/negativo
        const Bar = ({ val, base, positive = true }: { val: number; base: number; positive?: boolean }) => {
          const w = base === 0 ? 0 : Math.min(Math.abs(val / base) * 100, 100);
          return (
            <div className="w-full h-0.5 bg-white/[0.05] rounded-full mt-1 overflow-hidden">
              <div className={`h-full rounded-full ${positive ? 'bg-emerald-500/50' : 'bg-red-500/40'}`} style={{ width: `${w}%` }} />
            </div>
          );
        };

        return (
          <div className="space-y-6">
            {/* Title */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
              <h3 className="text-base font-black text-white uppercase tracking-tight">ESTADO DE RESULTADOS · MIDNIGHT EVENTS SAS</h3>
              <p className="text-[10px] text-white/40 font-light tracking-widest uppercase mt-1">
                Período acumulado al {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-[9px] text-white/20 mt-1">La columna <span className="text-white/40 font-bold">%</span> indica qué parte de los ingresos totales representa cada concepto</p>
            </div>

            {monthlyPnL.length === 0 ? (
              <div className="p-12 text-center bg-white/[0.02] border border-white/5 rounded-2xl">
                <BarChart2 size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/20 text-xs uppercase tracking-widest">Sin datos de resultados</p>
              </div>
            ) : (
              <>
                {monthlyPnL.map(row => {
                  const base = row.totalIngresos;
                  return (
                  <div key={row.month} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                    {/* Month Header */}
                    <div className="flex items-center justify-between px-5 py-4 bg-white/[0.03] border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <Calendar size={12} className="text-white/30" />
                        <span className="text-sm font-black text-white uppercase tracking-tight">{monthLabel(row.month)}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] text-emerald-400/60 font-bold">{fmtShort(row.totalIngresos)} ingresos</span>
                        <span className={`text-[11px] font-black ${row.utilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {row.utilidadNeta >= 0 ? '+' : ''}{fmtShort(row.utilidadNeta)} neto
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${row.utilidadNeta >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                          {pct(row.utilidadNeta, base)} margen
                        </span>
                      </div>
                    </div>

                    {/* Events in month */}
                    {row.events.length > 0 && (
                      <div className="px-5 py-3 border-b border-white/[0.04] bg-white/[0.01]">
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Eventos del mes ({row.events.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {row.events.map((e, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-1.5">
                              <span className="text-[10px] text-white/60 font-bold">{e.ev.title}</span>
                              <span className="text-[9px] text-white/20">·</span>
                              <span className="text-[9px] text-emerald-400/60">{fmtShort(e.ingresosBoletas)}</span>
                              <span className="text-[9px] text-white/20">·</span>
                              <span className="text-[9px] text-white/30">{e.tickets} bol.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Column headers */}
                    <div className="grid grid-cols-4 px-5 py-1.5 bg-white/[0.02] border-b border-white/[0.04]">
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-widest col-span-2">Concepto</span>
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-widest text-right">Valor</span>
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-widest text-right">% Ingr.</span>
                    </div>

                    {/* P&L Lines */}
                    <div className="divide-y divide-white/[0.03]">
                      {/* INGRESOS */}
                      <div className="grid grid-cols-4 px-5 py-1.5 bg-emerald-500/[0.04]">
                        <span className="text-[9px] font-black text-emerald-400/60 uppercase col-span-4">(+) INGRESOS OPERACIONALES</span>
                      </div>
                      <div className="grid grid-cols-4 px-5 py-2 hover:bg-white/[0.02]">
                        <span className="text-[11px] text-white/60 col-span-2 pl-5">Venta de Boletas</span>
                        <span className="text-[11px] text-emerald-400 text-right font-bold">{fmt(row.totalIngresosBoletas)}</span>
                        <span className="text-[11px] text-white/30 text-right">{pct(row.totalIngresosBoletas, base)}</span>
                      </div>
                      <div className="grid grid-cols-4 px-5 py-2 hover:bg-white/[0.02]">
                        <span className="text-[11px] text-white/60 col-span-2 pl-5">Otros Ingresos Operacionales</span>
                        <span className="text-[11px] text-emerald-400 text-right font-bold">{fmt(row.totalOtrosIngresos)}</span>
                        <span className="text-[11px] text-white/30 text-right">{pct(row.totalOtrosIngresos, base)}</span>
                      </div>
                      <div className="grid grid-cols-4 px-5 py-2.5 bg-emerald-500/[0.06]">
                        <span className="text-[11px] font-black text-emerald-400 uppercase col-span-2 pl-2">= TOTAL INGRESOS</span>
                        <span className="text-[11px] font-black text-emerald-400 text-right">{fmt(row.totalIngresos)}</span>
                        <span className="text-[11px] font-black text-emerald-400/60 text-right">100%</span>
                      </div>

                      {/* COSTOS */}
                      <div className="grid grid-cols-4 px-5 py-1.5 bg-red-500/[0.04]">
                        <span className="text-[9px] font-black text-red-400/60 uppercase col-span-4">(-) COSTOS DEL SERVICIO</span>
                      </div>
                      <div className="grid grid-cols-4 px-5 py-2 hover:bg-white/[0.02]">
                        <div className="col-span-2 pl-5">
                          <span className="text-[11px] text-white/60">Comisiones a Vendedores</span>
                          <Bar val={row.totalComisiones} base={base} positive={false} />
                        </div>
                        <span className="text-[11px] text-red-400/80 text-right font-bold">({fmt(row.totalComisiones)})</span>
                        <span className="text-[11px] text-red-400/50 text-right">{pct(row.totalComisiones, base)}</span>
                      </div>
                      <div className="grid grid-cols-4 px-5 py-2 hover:bg-white/[0.02]">
                        <div className="col-span-2 pl-5">
                          <span className="text-[11px] text-white/60">Costos Directos de Eventos</span>
                          <Bar val={row.totalCostosEvento} base={base} positive={false} />
                        </div>
                        <span className="text-[11px] text-red-400/80 text-right font-bold">({fmt(row.totalCostosEvento)})</span>
                        <span className="text-[11px] text-red-400/50 text-right">{pct(row.totalCostosEvento, base)}</span>
                      </div>
                      <div className="grid grid-cols-4 px-5 py-2.5 bg-red-500/[0.06]">
                        <span className="text-[11px] font-black text-red-400 uppercase col-span-2 pl-2">= TOTAL COSTOS</span>
                        <span className="text-[11px] font-black text-red-400 text-right">({fmt(row.totalComisiones + row.totalCostosEvento)})</span>
                        <span className="text-[11px] font-black text-red-400/60 text-right">{pct(row.totalComisiones + row.totalCostosEvento, base)}</span>
                      </div>

                      {/* UTILIDAD BRUTA */}
                      <div className={`grid grid-cols-4 px-5 py-3 ${row.utilidadBruta >= 0 ? 'bg-emerald-500/10 border-t border-b border-emerald-500/20' : 'bg-red-500/10 border-t border-b border-red-500/20'}`}>
                        <span className={`text-xs font-black uppercase col-span-2 ${row.utilidadBruta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>= UTILIDAD BRUTA</span>
                        <span className={`text-xs font-black text-right ${row.utilidadBruta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(row.utilidadBruta)}</span>
                        <span className={`text-xs font-black text-right ${row.utilidadBruta >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>{pct(row.utilidadBruta, base)}</span>
                      </div>

                      {/* GASTOS OPERATIVOS */}
                      <div className="grid grid-cols-4 px-5 py-2 hover:bg-white/[0.02]">
                        <div className="col-span-2">
                          <span className="text-[11px] text-white/60">(-) Gastos Operativos</span>
                          <Bar val={row.totalGastosOpe} base={base} positive={false} />
                        </div>
                        <span className="text-[11px] text-red-400/70 text-right font-bold">({fmt(row.totalGastosOpe)})</span>
                        <span className="text-[11px] text-red-400/40 text-right">{pct(row.totalGastosOpe, base)}</span>
                      </div>

                      {/* UTILIDAD OPERACIONAL */}
                      <div className={`grid grid-cols-4 px-5 py-2.5 ${row.utilidadOperacional >= 0 ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
                        <span className={`text-[11px] font-black uppercase col-span-2 ${row.utilidadOperacional >= 0 ? 'text-emerald-400/80' : 'text-red-400'}`}>= UTILIDAD OPERACIONAL</span>
                        <span className={`text-[11px] font-black text-right ${row.utilidadOperacional >= 0 ? 'text-emerald-400/80' : 'text-red-400'}`}>{fmt(row.utilidadOperacional)}</span>
                        <span className={`text-[11px] font-black text-right ${row.utilidadOperacional >= 0 ? 'text-emerald-400/50' : 'text-red-400/50'}`}>{pct(row.utilidadOperacional, base)}</span>
                      </div>

                      {/* IMPUESTO */}
                      <div className="grid grid-cols-4 px-5 py-2 hover:bg-white/[0.02]">
                        <span className="text-[11px] text-white/50 col-span-2">(-) Impuesto Régimen Simple (5.9%)</span>
                        <span className="text-[11px] text-amber-400/70 text-right font-bold">({fmt(row.impuesto)})</span>
                        <span className="text-[11px] text-amber-400/40 text-right">{pct(row.impuesto, base)}</span>
                      </div>

                      {/* UTILIDAD NETA */}
                      <div className={`grid grid-cols-4 px-5 py-4 ${row.utilidadNeta >= 0 ? 'bg-emerald-500/10 border-t-2 border-emerald-500/30' : 'bg-red-500/10 border-t-2 border-red-500/30'}`}>
                        <span className={`text-sm font-black uppercase col-span-2 ${row.utilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>= UTILIDAD NETA</span>
                        <span className={`text-sm font-black text-right ${row.utilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(row.utilidadNeta)}</span>
                        <span className={`text-sm font-black text-right ${row.utilidadNeta >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>{pct(row.utilidadNeta, base)}</span>
                      </div>
                    </div>
                  </div>
                  );
                })}

                {/* Grand Total Row */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 bg-white/[0.04] border-b border-white/10">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">TOTALES ACUMULADOS · TODOS LOS PERÍODOS</span>
                  </div>
                  {/* Column headers */}
                  <div className="grid grid-cols-4 px-5 py-1.5 border-b border-white/[0.05]">
                    <span className="text-[8px] font-black text-white/20 uppercase col-span-2">Concepto</span>
                    <span className="text-[8px] font-black text-white/20 uppercase text-right">Valor</span>
                    <span className="text-[8px] font-black text-white/20 uppercase text-right">% Ingr.</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {[
                      { label: 'Total Ingresos', value: grandTotalIngresos, color: 'text-emerald-400', pctBase: grandTotalIngresos, bold: true },
                      { label: 'Comisiones a Vendedores', value: -grandTotalComisiones, color: 'text-red-400/80', pctBase: grandTotalIngresos, bold: false },
                      { label: 'Costos Directos de Eventos', value: -grandTotalCostos, color: 'text-red-400/80', pctBase: grandTotalIngresos, bold: false },
                      { label: 'Utilidad Bruta', value: grandUtilidadBruta, color: grandUtilidadBruta >= 0 ? 'text-emerald-400' : 'text-red-400', pctBase: grandTotalIngresos, bold: true },
                      { label: 'Gastos Operativos', value: -grandTotalGastos, color: 'text-red-400/80', pctBase: grandTotalIngresos, bold: false },
                      { label: 'Utilidad Operacional', value: grandUtilidadOpe, color: grandUtilidadOpe >= 0 ? 'text-emerald-400' : 'text-red-400', pctBase: grandTotalIngresos, bold: true },
                      { label: 'Impuesto Estimado (5.9%)', value: -grandImpuesto, color: 'text-amber-400/70', pctBase: grandTotalIngresos, bold: false },
                    ].map(item => (
                      <div key={item.label} className="grid grid-cols-4 px-5 py-2.5 hover:bg-white/[0.02]">
                        <span className={`text-[11px] col-span-2 ${item.bold ? 'font-black text-white' : 'text-white/60'}`}>{item.label}</span>
                        <span className={`text-[11px] text-right ${item.bold ? 'font-black' : 'font-bold'} ${item.color}`}>
                          {item.value < 0 ? `(${fmt(Math.abs(item.value))})` : fmt(item.value)}
                        </span>
                        <span className={`text-[11px] text-right text-white/30`}>
                          {pct(Math.abs(item.value), item.pctBase)}
                        </span>
                      </div>
                    ))}
                    <div className={`grid grid-cols-4 px-5 py-4 ${grandUtilidadNeta >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      <span className={`text-sm font-black uppercase col-span-2 ${grandUtilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>= UTILIDAD NETA TOTAL</span>
                      <span className={`text-sm font-black text-right ${grandUtilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(grandUtilidadNeta)}</span>
                      <span className={`text-sm font-black text-right ${grandUtilidadNeta >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>{pct(grandUtilidadNeta, grandTotalIngresos)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── TAB: EVENTOS ─────────────────────────────────────────────────── */}
      {activeTab === 'eventos' && (
        <div className="space-y-4">
          {eventAnalysis.length === 0 ? (
            <div className="p-12 text-center bg-white/[0.02] border border-white/5 rounded-2xl">
              <Calendar size={32} className="text-white/10 mx-auto mb-3" />
              <p className="text-white/20 text-xs uppercase tracking-widest">Sin eventos</p>
            </div>
          ) : eventAnalysis.map(({ ev, totalEvIncome, totalEvExpense, netEv, marginEv, tickets }, idx) => (
            <div key={ev.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/30">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-black text-white text-sm">{ev.title}</p>
                    <p className="text-[9px] text-white/30 uppercase">{ev.city} · {ev.event_date?.slice(0, 10)}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-full text-[9px] font-black ${netEv >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {marginEv.toFixed(1)}% margen
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <p className="text-[9px] text-white/30 uppercase font-bold mb-1">Ingresos</p>
                  <p className="text-sm font-black text-emerald-400">{fmtShort(totalEvIncome)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-white/30 uppercase font-bold mb-1">Gastos</p>
                  <p className="text-sm font-black text-red-400">{fmtShort(totalEvExpense)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-white/30 uppercase font-bold mb-1">Utilidad</p>
                  <p className={`text-sm font-black ${netEv >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtShort(netEv)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-white/30 uppercase font-bold mb-1">Boletas</p>
                  <p className="text-sm font-black text-white">{tickets}</p>
                </div>
              </div>
              {/* Margin bar */}
              <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${netEv >= 0 ? 'bg-emerald-500/50' : 'bg-red-500/50'}`}
                  style={{ width: `${Math.min(Math.abs(marginEv), 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: IMPUESTOS ────────────────────────────────────────────────── */}
      {activeTab === 'impuestos' && (
        <div className="space-y-4">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Régimen Simple de Tributación · Colombia 2025</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div>
                <p className="text-[9px] text-white/30 uppercase font-bold mb-1">Actividad CIIU</p>
                <p className="text-sm font-black text-white">Eventos y Conciertos</p>
              </div>
              <div>
                <p className="text-[9px] text-white/30 uppercase font-bold mb-1">Ingresos Gravables</p>
                <p className="text-sm font-black text-amber-400">{fmt(annualProjected)}</p>
              </div>
              <div>
                <p className="text-[9px] text-white/30 uppercase font-bold mb-1">En UVTs</p>
                <p className="text-sm font-black text-white">{taxCalc.uvts.toFixed(0)} UVT</p>
              </div>
              <div>
                <p className="text-[9px] text-white/30 uppercase font-bold mb-1">Tasa Aplicable</p>
                <p className="text-sm font-black text-amber-400">{(taxCalc.rate * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="border-t border-amber-500/20 pt-4 grid grid-cols-2 gap-3">
              <div className="bg-amber-500/10 rounded-xl p-4">
                <p className="text-[9px] text-amber-400/60 uppercase font-black mb-1">Impuesto Estimado</p>
                <p className="text-2xl font-black text-amber-400">{fmt(taxCalc.tax)}</p>
                <p className="text-[9px] text-amber-400/40 mt-1">Sobre {fmt(annualProjected)} ingresos</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-[9px] text-white/40 uppercase font-black mb-1">Utilidad después de impuestos</p>
                <p className={`text-2xl font-black ${(netResult - taxCalc.tax) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(netResult - taxCalc.tax)}</p>
              </div>
            </div>
          </div>

          {/* Tabla de tarifas */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Tarifa Régimen Simple — Eventos y Conciertos (Art. 908 E.T.)</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-black text-amber-400">Tarifa única — todos los rangos de ingresos</p>
                  <p className="text-[9px] text-amber-400/60 mt-0.5">Actividad: Eventos, conciertos y espectáculos públicos</p>
                </div>
                <span className="text-2xl font-black text-amber-400">5.9%</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <p className="text-[9px] text-white/30 uppercase font-black mb-1">Base gravable</p>
                  <p className="text-sm font-bold text-white">{fmt(annualProjected)}</p>
                  <p className="text-[9px] text-white/20">Ingresos operacionales</p>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-3">
                  <p className="text-[9px] text-amber-400/60 uppercase font-black mb-1">Impuesto a pagar</p>
                  <p className="text-sm font-bold text-amber-400">{fmt(taxCalc.tax)}</p>
                  <p className="text-[9px] text-amber-400/40">Consolidado anual</p>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-white/20 mt-3 italic">* Tarifa fija 5.9% para actividades de eventos y conciertos (Decreto 1091/2020). Estimación orientativa — consulta con tu contador.</p>
          </div>
        </div>
      )}

      {/* ── TAB: CIERRE ──────────────────────────────────────────────────── */}
      {activeTab === 'cierre' && (() => {
        const cierreEvent = events.find(e => e.id === cierreEventId);
        const eventTiers = tiers.filter(t => t.event_id === cierreEventId);

        // All promoters who sold in this event
        const eventOrders = cierreEventId
          ? completedOrders.filter(o => o.event_id === cierreEventId)
          : [];

        // Group by promoter (including null = house/MIDNIGHT sales)
        const promoterMap = new Map<string | null, {
          promoterId: string | null;
          name: string;
          code: string;
          tierSales: Record<string, number>; // tierId → qty
          comisionesTotales: number;
          dineroAEnviar: number;
          orders: typeof eventOrders;
        }>();

        eventOrders.forEach(o => {
          const pid = o.staff_id || null;
          if (!promoterMap.has(pid)) {
            const p = pid ? promoters.find(pr => pr.user_id === pid) : null;
            promoterMap.set(pid, {
              promoterId: pid,
              name: p ? p.name : 'MIDNIGHT (Directas)',
              code: p ? p.code : 'HOUSE',
              tierSales: {},
              comisionesTotales: 0,
              dineroAEnviar: 0,
              orders: [],
            });
          }
          const entry = promoterMap.get(pid)!;
          entry.orders.push(o);
          entry.comisionesTotales += o.commission_amount || 0;
          entry.dineroAEnviar += o.net_amount || 0;

          // Count per tier
          (o.items || []).forEach((item: any) => {
            entry.tierSales[item.tier_id] = (entry.tierSales[item.tier_id] || 0) + (item.quantity || 1);
          });
        });

        const rows = Array.from(promoterMap.values()).sort((a, b) => b.dineroAEnviar - a.dineroAEnviar);
        const totalDineroAEnviar = rows.reduce((s, r) => s + r.dineroAEnviar, 0);
        const totalComisiones = rows.reduce((s, r) => s + r.comisionesTotales, 0);
        const totalYaEnviado = rows.reduce((s, r) => {
          if (!r.promoterId) return s;
          const settList = settlements.filter(se => se.event_id === cierreEventId && se.promoter_id === r.promoterId);
          return s + settList.reduce((ss, se) => ss + se.amount_sent, 0);
        }, 0);
        const totalDeuda = totalDineroAEnviar - totalYaEnviado;

        return (
          <div className="space-y-5">
            {/* Event Selector */}
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <select value={cierreEventId} onChange={e => setCierreEventId(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold">
                <option value="">— Selecciona un evento para el cierre —</option>
                {events.filter(e => e.status !== 'archived').map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title} · {ev.city}</option>
                ))}
              </select>
            </div>

            {!cierreEventId && (
              <div className="p-16 text-center bg-white/[0.02] border border-white/5 rounded-2xl">
                <Calendar size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/20 text-xs uppercase tracking-widest">Selecciona un evento para ver el cierre</p>
              </div>
            )}

            {cierreEventId && cierreEvent && (
              <>
                {/* Event Info + Tier Prices */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-black text-white text-sm">{cierreEvent.title}</h3>
                      <p className="text-[9px] text-white/30 uppercase">{cierreEvent.city} · {cierreEvent.event_date?.slice(0, 10)}</p>
                    </div>
                  </div>
                  {/* Tier price table */}
                  {eventTiers.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left pb-2 text-[9px] font-black text-white/30 uppercase tracking-widest">CONCEPTO</th>
                            {eventTiers.map(t => (
                              <th key={t.id} className="text-right pb-2 text-[9px] font-black text-white/30 uppercase tracking-widest px-3">{t.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'PRECIO', getValue: (t: typeof eventTiers[0]) => fmt(t.price) },
                            { label: 'COMISIÓN', getValue: (t: typeof eventTiers[0]) => fmt(t.commission_fixed || 0) },
                            { label: 'NETO', getValue: (t: typeof eventTiers[0]) => fmt(t.price - (t.commission_fixed || 0)) },
                          ].map(row => (
                            <tr key={row.label} className="border-b border-white/[0.03]">
                              <td className="py-1.5 text-[10px] font-black text-white/40">{row.label}</td>
                              {eventTiers.map(t => (
                                <td key={t.id} className="py-1.5 text-right px-3 font-bold text-white/70 text-[10px]">{row.getValue(t)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Summary KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Total Recaudado" value={fmtShort(totalDineroAEnviar + totalComisiones)} color="white" icon={<DollarSign size={14} />} />
                  <KpiCard label="Dinero a Enviar" value={fmtShort(totalDineroAEnviar)} sub="Neto (sin comisiones)" color="purple" icon={<Send size={14} />} />
                  <KpiCard label="Ya Enviado" value={fmtShort(totalYaEnviado)} color="green" icon={<CheckCircle2 size={14} />} />
                  <KpiCard label="Deuda Total" value={fmtShort(totalDeuda)} color={totalDeuda <= 0 ? 'green' : 'red'} icon={<AlertTriangle size={14} />} />
                </div>

                {/* Settlement Table */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                  {/* Header */}
                  <div className={`grid border-b border-white/5 p-4 gap-2`}
                    style={{ gridTemplateColumns: `2fr ${eventTiers.map(() => '1fr').join(' ')} 1.2fr 1.2fr 1.2fr 1.2fr 1fr` }}>
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">NOMBRE</span>
                    {eventTiers.map(t => (
                      <span key={t.id} className="text-[9px] font-black text-white/30 uppercase tracking-widest text-right">{t.name.slice(0, 8)}</span>
                    ))}
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest text-right">COMISIONES</span>
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest text-right">A ENVIAR</span>
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest text-right">ENVIADO</span>
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest text-right">DEUDA</span>
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest text-center">ACCIÓN</span>
                  </div>

                  {rows.length === 0 ? (
                    <div className="p-12 text-center">
                      <Users size={32} className="text-white/10 mx-auto mb-3" />
                      <p className="text-white/20 text-xs uppercase tracking-widest">Sin ventas registradas en este evento</p>
                    </div>
                  ) : rows.map(row => {
                    const settList = row.promoterId
                      ? settlements.filter(se => se.event_id === cierreEventId && se.promoter_id === row.promoterId)
                      : [];
                    const yaEnviado = settList.reduce((s, se) => s + se.amount_sent, 0);
                    const deuda = row.dineroAEnviar - yaEnviado;
                    const isHouse = !row.promoterId;
                    const lastSett = settList[settList.length - 1];

                    return (
                      <div key={row.promoterId || 'house'}
                        className={`grid border-b border-white/[0.03] p-4 gap-2 items-center hover:bg-white/[0.02] transition-all ${deuda > 0 && !isHouse ? 'border-l-2 border-l-amber-500/40' : deuda === 0 && !isHouse ? 'border-l-2 border-l-emerald-500/40' : ''}`}
                        style={{ gridTemplateColumns: `2fr ${eventTiers.map(() => '1fr').join(' ')} 1.2fr 1.2fr 1.2fr 1.2fr 1fr` }}>

                        {/* Name */}
                        <div>
                          <p className="text-xs font-black text-white">{row.name}</p>
                          <p className="text-[9px] text-white/30">{row.code}</p>
                          {settList.length > 0 && (
                            <span className="text-[8px] font-bold text-emerald-400/60">
                              {settList.length} pago{settList.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {lastSett?.comprobante_url && (
                            <a href={lastSett.comprobante_url} target="_blank" rel="noreferrer"
                              className="text-[8px] text-violet-400 hover:underline block">Ver último comprobante →</a>
                          )}
                        </div>

                        {/* Qty per tier */}
                        {eventTiers.map(t => (
                          <span key={t.id} className="text-[11px] font-bold text-white/60 text-right">
                            {row.tierSales[t.id] || 0}
                          </span>
                        ))}

                        {/* Comisiones */}
                        <span className="text-[11px] font-bold text-emerald-400/70 text-right">{fmt(row.comisionesTotales)}</span>

                        {/* Dinero a enviar */}
                        <span className="text-[11px] font-bold text-white text-right">{fmt(row.dineroAEnviar)}</span>

                        {/* Ya enviado */}
                        <span className={`text-[11px] font-bold text-right ${yaEnviado > 0 ? 'text-emerald-400' : 'text-white/20'}`}>
                          {yaEnviado > 0 ? fmt(yaEnviado) : '—'}
                        </span>

                        {/* Deuda */}
                        <span className={`text-[11px] font-black text-right ${
                          isHouse ? 'text-white/20' :
                          deuda > 0 ? 'text-amber-400' :
                          deuda < 0 ? 'text-blue-400' : 'text-emerald-400'
                        }`}>
                          {isHouse ? '—' : deuda > 0 ? fmt(deuda) : deuda === 0 ? '✓ PAZ' : `+${fmt(Math.abs(deuda))}`}
                        </span>

                        {/* Acción */}
                        <div className="flex justify-center">
                          {!isHouse ? (
                            <button
                              onClick={() => setSettlementTarget({
                                promoter: { user_id: row.promoterId!, name: row.name, code: row.code },
                                eventId: cierreEventId,
                                eventTitle: cierreEvent.title,
                                dineroAEnviar: row.dineroAEnviar,
                                existingSettlements: settList,
                              })}
                              className={`p-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 ${settList.length > 0 ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-white/5 text-white/30 hover:text-white hover:bg-white/10'}`}>
                              {settList.length > 0 ? <Edit3 size={11} /> : <Plus size={11} />}
                            </button>
                          ) : (
                            <span className="text-[9px] text-white/20">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Totals Row */}
                  {rows.length > 0 && (
                    <div className={`grid bg-white/5 p-4 gap-2 items-center`}
                      style={{ gridTemplateColumns: `2fr ${eventTiers.map(() => '1fr').join(' ')} 1.2fr 1.2fr 1.2fr 1.2fr 1fr` }}>
                      <span className="text-[10px] font-black text-white uppercase">TOTAL</span>
                      {eventTiers.map(t => (
                        <span key={t.id} className="text-[10px] font-black text-white/60 text-right">
                          {rows.reduce((s, r) => s + (r.tierSales[t.id] || 0), 0)}
                        </span>
                      ))}
                      <span className="text-[10px] font-black text-emerald-400 text-right">{fmt(totalComisiones)}</span>
                      <span className="text-[10px] font-black text-white text-right">{fmt(totalDineroAEnviar)}</span>
                      <span className="text-[10px] font-black text-emerald-400 text-right">{fmt(totalYaEnviado)}</span>
                      <span className={`text-[10px] font-black text-right ${totalDeuda > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{fmt(totalDeuda)}</span>
                      <span />
                    </div>
                  )}
                </div>

                {/* ── GASTOS REALES DEL EVENTO ─────────────────────────────── */}
                <EventCostsPanel event={cierreEvent} />
                
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
};
