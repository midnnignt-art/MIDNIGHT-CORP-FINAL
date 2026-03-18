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

const INCOME_CATEGORIES: { value: string; label: string }[] = [
  { value: 'ticket_sales', label: 'Venta de Boletas' },
  { value: 'sponsorship', label: 'Patrocinio / Sponsorship' },
  { value: 'merchandise', label: 'Merchandising' },
  { value: 'bar_services', label: 'Bar / Servicios F&B' },
  { value: 'venue_rental', label: 'Alquiler de Espacio' },
  { value: 'other_income', label: 'Otro Ingreso' },
];

const EXPENSE_CATEGORIES: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: 'venue', label: 'Venue / Locación', icon: <Building2 size={12} /> },
  { value: 'production', label: 'Producción', icon: <Settings size={12} /> },
  { value: 'staff', label: 'Personal / Staff', icon: <Users size={12} /> },
  { value: 'marketing', label: 'Marketing / Publicidad', icon: <Megaphone size={12} /> },
  { value: 'artists', label: 'Artistas / Booking', icon: <Award size={12} /> },
  { value: 'logistics', label: 'Logística', icon: <Truck size={12} /> },
  { value: 'administrative', label: 'Administrativo', icon: <FileText size={12} /> },
  { value: 'taxes', label: 'Impuestos / Tasas', icon: <Percent size={12} /> },
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
const calculateSimpleTax = (annualIncome: number) => {
  const uvts = annualIncome / UVT_2025;
  let rate = 0;
  // Actividades de entretenimiento, esparcimiento y similares
  if (uvts <= 6000) rate = 0.02;
  else if (uvts <= 15000) rate = 0.028;
  else if (uvts <= 30000) rate = 0.081;
  else rate = 0.116;
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <div className="w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
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
              <TrendingDown size={12} /> Gasto
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
      setError(e.message || 'Error al guardar');
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

  // Extra income movements
  const movIncomes = useMemo(() => accountingMovements.filter(m => m.type === 'income'), [accountingMovements]);
  const movExpenses = useMemo(() => accountingMovements.filter(m => m.type === 'expense'), [accountingMovements]);

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
    // Income movements (registered cash received)
    const incomeMovs = movIncomes.reduce((s, m) => s + m.amount, 0);
    return directSales + settled + incomeMovs;
  }, [completedOrders, settlements, movIncomes]);

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
                    <span>Efectivo recibido</span><span className="text-emerald-400 font-bold">{fmt(efectivoRecibido)}</span>
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
        const totalActivoCorriente = efectivoRecibido + totalCuentasPorCobrar;
        const totalActivoNoCorriente = activosFijos;
        const totalActivos = totalActivoCorriente + totalActivoNoCorriente;
        const totalPasivosCorrientes = cuentasPorPagar + taxCalc.tax;
        const totalPasivos = totalPasivosCorrientes;
        const utilidadesNetas = netResult - taxCalc.tax;
        const reservaLegal = Math.max(0, utilidadesNetas * 0.10);
        const totalPatrimonio = capitalSocial + primaAcciones + utilidadesNetas + reservaLegal;
        const totalPasivoPatrimonio = totalPasivos + totalPatrimonio;
        const cuadre = totalActivos - totalPasivoPatrimonio;

        // Row helper
        const Row = ({ label, value, indent = 0, bold = false, color = 'white', sub }: { label: string; value: number; indent?: number; bold?: boolean; color?: string; sub?: string }) => (
          <div className={`grid grid-cols-3 gap-0 px-5 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-all`}>
            <div className={`col-span-2 ${indent === 1 ? 'pl-6' : indent === 2 ? 'pl-10' : ''}`}>
              <span className={`text-xs ${bold ? 'font-black uppercase' : 'font-medium'} ${color === 'emerald' ? 'text-emerald-400' : color === 'red' ? 'text-red-400' : color === 'violet' ? 'text-violet-400' : color === 'amber' ? 'text-amber-400' : bold ? 'text-white' : 'text-white/70'}`}>{label}</span>
              {sub && <p className="text-[9px] text-white/30 mt-0.5">{sub}</p>}
            </div>
            <span className={`text-xs text-right font-bold ${color === 'emerald' ? 'text-emerald-400' : color === 'red' ? 'text-red-400' : color === 'violet' ? 'text-violet-400' : color === 'amber' ? 'text-amber-400' : bold ? 'text-white' : 'text-white/60'}`}>
              {fmt(value)}
            </span>
          </div>
        );

        const SectionTotal = ({ label, value, color }: { label: string; value: number; color: string }) => (
          <div className={`grid grid-cols-3 gap-0 px-5 py-3 border-b ${
            color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/20' :
            color === 'red' ? 'bg-red-500/10 border-red-500/20' :
            color === 'violet' ? 'bg-violet-500/10 border-violet-500/20' :
            'bg-white/[0.06] border-white/10'
          }`}>
            <span className={`text-[11px] font-black uppercase col-span-2 ${
              color === 'emerald' ? 'text-emerald-400' : color === 'red' ? 'text-red-400' : color === 'violet' ? 'text-violet-400' : 'text-white'
            }`}>{label}</span>
            <span className={`text-[11px] font-black text-right ${
              color === 'emerald' ? 'text-emerald-400' : color === 'red' ? 'text-red-400' : color === 'violet' ? 'text-violet-400' : 'text-white'
            }`}>{fmt(value)}</span>
          </div>
        );

        const SubHeader = ({ label, color }: { label: string; color: string }) => (
          <div className="grid grid-cols-3 gap-0 px-5 py-2 bg-white/[0.015]">
            <span className={`text-[10px] font-black uppercase tracking-wider col-span-3 pl-4 ${
              color === 'emerald' ? 'text-emerald-400/60' : color === 'red' ? 'text-red-400/60' : 'text-violet-400/60'
            }`}>{label}</span>
          </div>
        );

        return (
          <div className="space-y-6">
            {/* Header + Edit button */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">BALANCE DE SITUACIÓN FINANCIERA</h3>
                <p className="text-[10px] text-white/50 font-medium mt-0.5">MIDNIGHT EVENTS SAS · Al {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-[9px] text-white/25 tracking-widest uppercase mt-1">NIT: — · Régimen Simple de Tributación</p>
              </div>
              <button onClick={() => setEditingBalance(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase text-white/40 hover:text-white transition-all">
                <Edit3 size={10} /> {editingBalance ? 'Cerrar' : 'Editar Capital'}
              </button>
            </div>

            {/* Manual inputs panel */}
            {editingBalance && (() => {
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
                  <button onClick={() => saveBalanceInputs(Number(tmpCap)||0, Number(tmpPrima)||0, Number(tmpFijos)||0)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all">
                    <CheckCircle2 size={12} /> Guardar
                  </button>
                </div>
              );
            })()}

            {/* Balance Table */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-3 gap-0 px-5 py-3 border-b border-white/10 bg-white/[0.04]">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest col-span-2">CONCEPTO</span>
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest text-right">VALOR (COP)</span>
              </div>

              {/* ═══════════════ ACTIVO ═══════════════ */}
              <div className="border-l-4 border-l-emerald-500/70">
                <div className="grid grid-cols-3 gap-0 px-5 py-3 bg-emerald-500/[0.07]">
                  <span className="text-sm font-black text-emerald-400 uppercase tracking-wider col-span-3">ACTIVO</span>
                </div>

                <SubHeader label="ACTIVO CORRIENTE" color="emerald" />
                <Row label="Efectivo y Equivalentes de Caja" value={efectivoRecibido} indent={2}
                  sub="Ventas directas + pagos recibidos de promotores" />
                <Row label="Cuentas por Cobrar (Promotores)" value={totalCuentasPorCobrar} indent={2} color="amber"
                  sub="Dinero pendiente de enviar · registrado como activo" />
                <Row label="Inventario de Mercancias" value={0} indent={2} />
                <SectionTotal label="TOTAL ACTIVO CORRIENTE" value={totalActivoCorriente} color="emerald" />

                <SubHeader label="ACTIVO NO CORRIENTE" color="emerald" />
                <Row label="Inmovilizado (Neto)" value={activosFijos} indent={2}
                  sub={activosFijos === 0 ? 'Registra activos fijos con el botón Editar Capital' : undefined} />
                <Row label="Otros Activos No Corrientes" value={0} indent={2} />
                <SectionTotal label="TOTAL ACTIVO NO CORRIENTE" value={totalActivoNoCorriente} color="emerald" />

                <div className="grid grid-cols-3 gap-0 px-5 py-3.5 bg-emerald-500/15 border-t-2 border-emerald-500/40">
                  <span className="text-sm font-black text-emerald-400 uppercase col-span-2">TOTAL ACTIVO</span>
                  <span className="text-sm font-black text-emerald-400 text-right">{fmt(totalActivos)}</span>
                </div>
              </div>

              {/* ═══════════════ PASIVO ═══════════════ */}
              <div className="border-l-4 border-l-red-500/70 mt-3">
                <div className="grid grid-cols-3 gap-0 px-5 py-3 bg-red-500/[0.07]">
                  <span className="text-sm font-black text-red-400 uppercase tracking-wider col-span-3">PASIVO</span>
                </div>

                <SubHeader label="PASIVOS CORRIENTES" color="red" />
                <Row label="Costos de Eventos Pendientes de Pago" value={cuentasPorPagar} indent={2} color={cuentasPorPagar > 0 ? 'red' : 'white'} />
                <Row label="Impuesto por Pagar — Régimen Simple (est.)" value={taxCalc.tax} indent={2} color={taxCalc.tax > 0 ? 'amber' : 'white'} />
                <Row label="Otros Pasivos Corrientes" value={0} indent={2} />
                <SectionTotal label="TOTAL PASIVOS CORRIENTES" value={totalPasivosCorrientes} color="red" />

                <SubHeader label="PASIVOS NO CORRIENTES" color="red" />
                <Row label="Deudas a Largo Plazo" value={0} indent={2} />
                <SectionTotal label="TOTAL PASIVOS NO CORRIENTES" value={0} color="red" />

                <div className="grid grid-cols-3 gap-0 px-5 py-3.5 bg-red-500/15 border-t-2 border-red-500/40">
                  <span className="text-sm font-black text-red-400 uppercase col-span-2">TOTAL PASIVO</span>
                  <span className="text-sm font-black text-red-400 text-right">{fmt(totalPasivos)}</span>
                </div>
              </div>

              {/* ═══════════════ PATRIMONIO ═══════════════ */}
              <div className="border-l-4 border-l-violet-500/70 mt-3">
                <div className="grid grid-cols-3 gap-0 px-5 py-3 bg-violet-500/[0.07]">
                  <span className="text-sm font-black text-violet-400 uppercase tracking-wider col-span-3">PATRIMONIO</span>
                </div>

                <Row label="Capital Social" value={capitalSocial} indent={2} color="violet"
                  sub={capitalSocial === 0 ? 'Edita con el botón Editar Capital' : undefined} />
                <Row label="Prima en Acciones / Aportes de Socios" value={primaAcciones} indent={2} color="violet" />
                <Row label="Utilidades Acumuladas del Período" value={utilidadesNetas} indent={2}
                  color={utilidadesNetas >= 0 ? 'emerald' : 'red'} />
                <Row label="Reserva Legal (10% s/ utilidades)" value={reservaLegal} indent={2} />
                <SectionTotal label="TOTAL PATRIMONIO" value={totalPatrimonio} color="violet" />
              </div>

              {/* ═══════════════ TOTAL PASIVO Y PATRIMONIO ═══════════════ */}
              <div className="grid grid-cols-3 gap-0 px-5 py-4 bg-white/[0.06] border-t-2 border-white/20 mt-3">
                <span className="text-sm font-black text-white uppercase col-span-2">TOTAL PASIVO Y PATRIMONIO</span>
                <span className="text-sm font-black text-white text-right">{fmt(totalPasivoPatrimonio)}</span>
              </div>

              {/* ═══════════════ TOTAL DE CUADRE ═══════════════ */}
              <div className={`grid grid-cols-3 gap-0 px-5 py-3 border-t ${Math.abs(cuadre) < 100 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <div className="col-span-2">
                  <span className={`text-xs font-black uppercase ${Math.abs(cuadre) < 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    TOTAL DE CUADRE {Math.abs(cuadre) < 100 ? '✓' : '⚠'}
                  </span>
                  <p className="text-[9px] text-white/20 mt-0.5">
                    {Math.abs(cuadre) < 100
                      ? 'Activos = Pasivos + Patrimonio'
                      : 'Diferencia: el sistema no rastrea egresos de caja. Registra activos fijos y capital para cuadrar.'}
                  </p>
                </div>
                <span className={`text-xs font-black text-right ${Math.abs(cuadre) < 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{fmt(cuadre)}</span>
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

        return (
          <div className="space-y-6">
            {/* Title */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
              <h3 className="text-base font-black text-white uppercase tracking-tight">ESTADO DE RESULTADOS · MIDNIGHT EVENTS SAS</h3>
              <p className="text-[10px] text-white/40 font-light tracking-widest uppercase mt-1">
                Período acumulado al {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {monthlyPnL.length === 0 ? (
              <div className="p-12 text-center bg-white/[0.02] border border-white/5 rounded-2xl">
                <BarChart2 size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/20 text-xs uppercase tracking-widest">Sin datos de resultados</p>
              </div>
            ) : (
              <>
                {/* Per month blocks */}
                {monthlyPnL.map(row => (
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

                    {/* P&L Lines */}
                    <div className="divide-y divide-white/[0.03]">
                      {/* INGRESOS header */}
                      <div className="grid grid-cols-3 px-5 py-2 bg-emerald-500/[0.04]">
                        <span className="text-[9px] font-black text-emerald-400/60 uppercase col-span-2">(+) INGRESOS OPERACIONALES</span>
                        <span />
                      </div>
                      <div className="grid grid-cols-3 px-5 py-2 hover:bg-white/[0.02]">
                        <span className="text-[11px] text-white/60 col-span-2 pl-5">Venta de Boletas</span>
                        <span className="text-[11px] text-emerald-400 text-right font-bold">{fmt(row.totalIngresosBoletas)}</span>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-2 hover:bg-white/[0.02]">
                        <span className="text-[11px] text-white/60 col-span-2 pl-5">Otros Ingresos Operacionales</span>
                        <span className="text-[11px] text-emerald-400 text-right font-bold">{fmt(row.totalOtrosIngresos)}</span>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-2.5 bg-emerald-500/[0.06]">
                        <span className="text-[11px] font-black text-emerald-400 uppercase col-span-2 pl-2">= TOTAL INGRESOS</span>
                        <span className="text-[11px] font-black text-emerald-400 text-right">{fmt(row.totalIngresos)}</span>
                      </div>

                      {/* COSTOS header */}
                      <div className="grid grid-cols-3 px-5 py-2 bg-red-500/[0.04]">
                        <span className="text-[9px] font-black text-red-400/60 uppercase col-span-2">(-) COSTOS DEL SERVICIO</span>
                        <span />
                      </div>
                      <div className="grid grid-cols-3 px-5 py-2 hover:bg-white/[0.02]">
                        <span className="text-[11px] text-white/60 col-span-2 pl-5">Comisiones a Vendedores</span>
                        <span className="text-[11px] text-red-400/80 text-right font-bold">({fmt(row.totalComisiones)})</span>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-2 hover:bg-white/[0.02]">
                        <span className="text-[11px] text-white/60 col-span-2 pl-5">Costos Directos de Eventos</span>
                        <span className="text-[11px] text-red-400/80 text-right font-bold">({fmt(row.totalCostosEvento)})</span>
                      </div>
                      <div className="grid grid-cols-3 px-5 py-2.5 bg-red-500/[0.06]">
                        <span className="text-[11px] font-black text-red-400 uppercase col-span-2 pl-2">= TOTAL COSTOS</span>
                        <span className="text-[11px] font-black text-red-400 text-right">({fmt(row.totalComisiones + row.totalCostosEvento)})</span>
                      </div>

                      {/* UTILIDAD BRUTA */}
                      <div className={`grid grid-cols-3 px-5 py-3 ${row.utilidadBruta >= 0 ? 'bg-emerald-500/10 border-t border-b border-emerald-500/20' : 'bg-red-500/10 border-t border-b border-red-500/20'}`}>
                        <span className={`text-xs font-black uppercase col-span-2 ${row.utilidadBruta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>= UTILIDAD BRUTA</span>
                        <span className={`text-xs font-black text-right ${row.utilidadBruta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(row.utilidadBruta)}</span>
                      </div>

                      {/* GASTOS OPERATIVOS */}
                      <div className="grid grid-cols-3 px-5 py-2 hover:bg-white/[0.02]">
                        <span className="text-[11px] text-white/60 col-span-2">(-) GASTOS OPERATIVOS</span>
                        <span className="text-[11px] text-red-400/70 text-right font-bold">({fmt(row.totalGastosOpe)})</span>
                      </div>

                      {/* UTILIDAD OPERACIONAL */}
                      <div className={`grid grid-cols-3 px-5 py-2.5 ${row.utilidadOperacional >= 0 ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}>
                        <span className={`text-[11px] font-black uppercase col-span-2 ${row.utilidadOperacional >= 0 ? 'text-emerald-400/80' : 'text-red-400'}`}>= UTILIDAD OPERACIONAL</span>
                        <span className={`text-[11px] font-black text-right ${row.utilidadOperacional >= 0 ? 'text-emerald-400/80' : 'text-red-400'}`}>{fmt(row.utilidadOperacional)}</span>
                      </div>

                      {/* IMPUESTO */}
                      <div className="grid grid-cols-3 px-5 py-2 hover:bg-white/[0.02]">
                        <span className="text-[11px] text-white/50 col-span-2">(-) IMPUESTO RÉGIMEN SIMPLE (est.)</span>
                        <span className="text-[11px] text-amber-400/70 text-right font-bold">({fmt(row.impuesto)})</span>
                      </div>

                      {/* UTILIDAD NETA */}
                      <div className={`grid grid-cols-3 px-5 py-4 ${row.utilidadNeta >= 0 ? 'bg-emerald-500/10 border-t-2 border-emerald-500/30' : 'bg-red-500/10 border-t-2 border-red-500/30'}`}>
                        <span className={`text-sm font-black uppercase col-span-2 ${row.utilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>= UTILIDAD NETA</span>
                        <span className={`text-sm font-black text-right ${row.utilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(row.utilidadNeta)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Grand Total Row */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 bg-white/[0.04] border-b border-white/10">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">TOTALES ACUMULADOS · TODOS LOS PERÍODOS</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    <div className="grid grid-cols-3 px-5 py-2.5">
                      <span className="text-[11px] text-white/60 col-span-2">Total Ingresos</span>
                      <span className="text-[11px] font-black text-emerald-400 text-right">{fmt(grandTotalIngresos)}</span>
                    </div>
                    <div className="grid grid-cols-3 px-5 py-2.5">
                      <span className="text-[11px] text-white/60 col-span-2">Total Comisiones</span>
                      <span className="text-[11px] font-bold text-red-400/80 text-right">({fmt(grandTotalComisiones)})</span>
                    </div>
                    <div className="grid grid-cols-3 px-5 py-2.5">
                      <span className="text-[11px] text-white/60 col-span-2">Total Costos de Eventos</span>
                      <span className="text-[11px] font-bold text-red-400/80 text-right">({fmt(grandTotalCostos)})</span>
                    </div>
                    <div className="grid grid-cols-3 px-5 py-2.5">
                      <span className="text-[11px] text-white/60 col-span-2">Utilidad Bruta</span>
                      <span className={`text-[11px] font-black text-right ${grandUtilidadBruta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(grandUtilidadBruta)}</span>
                    </div>
                    <div className="grid grid-cols-3 px-5 py-2.5">
                      <span className="text-[11px] text-white/60 col-span-2">Total Gastos Operativos</span>
                      <span className="text-[11px] font-bold text-red-400/80 text-right">({fmt(grandTotalGastos)})</span>
                    </div>
                    <div className="grid grid-cols-3 px-5 py-2.5">
                      <span className="text-[11px] text-white/60 col-span-2">Utilidad Operacional</span>
                      <span className={`text-[11px] font-black text-right ${grandUtilidadOpe >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(grandUtilidadOpe)}</span>
                    </div>
                    <div className="grid grid-cols-3 px-5 py-2.5">
                      <span className="text-[11px] text-white/60 col-span-2">Total Impuesto (est.)</span>
                      <span className="text-[11px] font-bold text-amber-400/70 text-right">({fmt(grandImpuesto)})</span>
                    </div>
                    <div className={`grid grid-cols-3 px-5 py-4 ${grandUtilidadNeta >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      <span className={`text-sm font-black uppercase col-span-2 ${grandUtilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>= UTILIDAD NETA TOTAL</span>
                      <span className={`text-sm font-black text-right ${grandUtilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(grandUtilidadNeta)}</span>
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
                <p className="text-[9px] text-white/30 uppercase font-bold mb-1">UVT 2025</p>
                <p className="text-sm font-black text-white">{fmt(UVT_2025)}</p>
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
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Tabla de Tarifas — Entretenimiento</h3>
            <div className="space-y-2">
              {[
                { range: '0 — 6,000 UVT', uvt: '0 — $298.8M', rate: '2.0%', active: taxCalc.uvts <= 6000 },
                { range: '6,001 — 15,000 UVT', uvt: '$298.8M — $747M', rate: '2.8%', active: taxCalc.uvts > 6000 && taxCalc.uvts <= 15000 },
                { range: '15,001 — 30,000 UVT', uvt: '$747M — $1,494M', rate: '8.1%', active: taxCalc.uvts > 15000 && taxCalc.uvts <= 30000 },
                { range: '> 30,000 UVT', uvt: '> $1,494M', rate: '11.6%', active: taxCalc.uvts > 30000 },
              ].map(row => (
                <div key={row.range} className={`flex items-center gap-4 p-3 rounded-lg transition-all ${row.active ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/[0.02]'}`}>
                  {row.active && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                  {!row.active && <div className="w-1.5 h-1.5 rounded-full bg-white/10 flex-shrink-0" />}
                  <span className={`text-xs flex-1 font-bold ${row.active ? 'text-amber-400' : 'text-white/30'}`}>{row.range}</span>
                  <span className={`text-[9px] flex-1 ${row.active ? 'text-amber-400/60' : 'text-white/20'}`}>{row.uvt}</span>
                  <span className={`text-sm font-black ${row.active ? 'text-amber-400' : 'text-white/20'}`}>{row.rate}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-white/20 mt-3 italic">* Estimación orientativa. Consulta con tu contador para la declaración oficial.</p>
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
