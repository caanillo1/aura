'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Plus, X, Search, Filter, ChevronDown, Loader2, Trash2,
  FileText, Send, CheckCircle2, XCircle, MessageSquare, Edit2, Eye,
  Package, Hash, Calendar, User, Building2, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { comercialApi, clientsApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';

// ── Types ─────────────────────────────────────────────────────────────────────
type CotStatus = 'borrador' | 'enviada' | 'en_negociacion' | 'aceptada' | 'rechazada';

interface CotItem {
  id?: string; descripcion: string; cantidad: number; valorUnitario: number; descuento: number;
}
interface Cotizacion {
  id: string; numero: string; titulo: string; status: CotStatus;
  valor?: number; validHasta?: string; createdAt: string;
  client?: { id: string; businessName: string } | null;
  prospecto?: string | null; contacto?: string | null; email?: string | null;
  descripcion?: string | null; notas?: string | null;
  createdBy: { firstName: string; lastName: string };
  items?: CotItem[];
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<CotStatus, { label: string; color: string; bg: string; icon: any }> = {
  borrador:       { label: 'Borrador',       color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: FileText },
  enviada:        { label: 'Enviada',        color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  icon: Send },
  en_negociacion: { label: 'En negociación', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  icon: MessageSquare },
  aceptada:       { label: 'Aceptada',       color: '#34D399', bg: 'rgba(52,211,153,0.12)',  icon: CheckCircle2 },
  rechazada:      { label: 'Rechazada',      color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: XCircle },
};

const STATUS_ORDER: CotStatus[] = ['borrador','enviada','en_negociacion','aceptada','rechazada'];

function StatusBadge({ status }: { status: CotStatus }) {
  const cfg = STATUS_CFG[status];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function fmt(n?: number) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

// ── Item row for modal ─────────────────────────────────────────────────────────
function ItemRow({ item, onChange, onRemove }: {
  item: CotItem;
  onChange: (f: Partial<CotItem>) => void;
  onRemove: () => void;
}) {
  const subtotal = item.cantidad * item.valorUnitario * (1 - (item.descuento || 0) / 100);
  return (
    <tr>
      <td className="pr-2 py-1.5">
        <input className="input-glass rounded-lg px-2 py-1.5 text-xs w-full"
          placeholder="Descripción del ítem"
          value={item.descripcion} onChange={e => onChange({ descripcion: e.target.value })} />
      </td>
      <td className="px-1 py-1.5 w-16">
        <input type="number" min={0} className="input-glass rounded-lg px-2 py-1.5 text-xs w-full text-right"
          value={item.cantidad} onChange={e => onChange({ cantidad: Number(e.target.value) })} />
      </td>
      <td className="px-1 py-1.5 w-28">
        <input type="number" min={0} className="input-glass rounded-lg px-2 py-1.5 text-xs w-full text-right"
          value={item.valorUnitario} onChange={e => onChange({ valorUnitario: Number(e.target.value) })} />
      </td>
      <td className="px-1 py-1.5 w-16">
        <input type="number" min={0} max={100} className="input-glass rounded-lg px-2 py-1.5 text-xs w-full text-right"
          value={item.descuento} onChange={e => onChange({ descuento: Number(e.target.value) })} />
      </td>
      <td className="px-1 py-1.5 w-24 text-right text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
        {fmt(subtotal)}
      </td>
      <td className="pl-1 py-1.5 w-8">
        <button onClick={onRemove} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
          style={{ color: '#f87171' }}>
          <X className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function CotModal({
  open, onClose, initial, clients,
  onSave, onDelete,
}: {
  open: boolean; onClose: () => void;
  initial?: Partial<Cotizacion>;
  clients: { id: string; businessName: string }[];
  onSave: (data: any) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    titulo: '', clientId: '', prospecto: '', contacto: '', email: '',
    descripcion: '', validHasta: '', notas: '',
    status: 'borrador' as CotStatus,
  });
  const [items, setItems] = useState<CotItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<'general' | 'items'>('general');

  useEffect(() => {
    if (!open) return;
    setTab('general');
    setForm({
      titulo:      initial?.titulo      ?? '',
      clientId:    initial?.client?.id  ?? '',
      prospecto:   initial?.prospecto   ?? '',
      contacto:    initial?.contacto    ?? '',
      email:       initial?.email       ?? '',
      descripcion: initial?.descripcion ?? '',
      validHasta:  initial?.validHasta  ? dayjs(initial.validHasta).format('YYYY-MM-DD') : '',
      notas:       initial?.notas       ?? '',
      status:      initial?.status      ?? 'borrador',
    });
    setItems(initial?.items?.map(i => ({ ...i })) ?? []);
  }, [open, initial]);

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const total = items.reduce((s, i) => s + i.cantidad * i.valorUnitario * (1 - (i.descuento || 0) / 100), 0);

  const addItem = () => setItems(p => [...p, { descripcion: '', cantidad: 1, valorUnitario: 0, descuento: 0 }]);
  const updateItem = (i: number, f: Partial<CotItem>) => setItems(p => p.map((it, idx) => idx === i ? { ...it, ...f } : it));
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!form.titulo) return toast.error('El título es requerido');
    setSaving(true);
    try {
      await onSave({
        ...form,
        clientId:  form.clientId || undefined,
        validHasta: form.validHasta || undefined,
        items: items.map(({ id: _id, ...rest }) => rest),
      });
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try { await onDelete(); onClose(); }
    catch { toast.error('Error al eliminar'); }
    finally { setDeleting(false); }
  };

  if (!open || typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[600]" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />
          <motion.div
            className="fixed inset-4 top-[5%] bottom-[5%] z-[601] max-w-2xl mx-auto rounded-2xl flex flex-col"
            style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
              backdropFilter: 'blur(24px)',
            }}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  {initial?.id ? `Cotización ${initial.numero}` : 'Nueva cotización'}
                </h3>
                {initial?.id && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{initial.titulo}</p>}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 transition-colors" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex px-6 pt-3 shrink-0 gap-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {(['general','items'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="px-4 py-2 text-sm font-semibold transition-colors"
                  style={{
                    color: tab === t ? 'var(--accent-blue)' : 'var(--text-muted)',
                    borderBottom: tab === t ? '2px solid var(--accent-blue)' : '2px solid transparent',
                    marginBottom: -1,
                  }}>
                  {t === 'general' ? 'General' : `Ítems ${items.length > 0 ? `(${items.length})` : ''}`}
                </button>
              ))}
              {total > 0 && (
                <div className="ml-auto flex items-center pb-2 text-sm font-bold" style={{ color: '#34D399' }}>
                  Total: {fmt(total)}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {tab === 'general' ? (
                <div className="flex flex-col gap-4">
                  {/* Título + Status */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Título *</label>
                      <input className="input-glass rounded-xl px-3 py-2.5 text-sm"
                        placeholder="Propuesta de implementación..."
                        value={form.titulo} onChange={e => setF('titulo', e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Estado</label>
                      <select className="input-glass rounded-xl px-3 py-2.5 text-sm"
                        value={form.status} onChange={e => setF('status', e.target.value)}>
                        {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Cliente o Prospecto */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Cliente existente</label>
                      <select className="input-glass rounded-xl px-3 py-2.5 text-sm"
                        value={form.clientId} onChange={e => setF('clientId', e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Prospecto (si no tiene cuenta)</label>
                      <input className="input-glass rounded-xl px-3 py-2.5 text-sm"
                        placeholder="Nombre de la empresa..."
                        value={form.prospecto} onChange={e => setF('prospecto', e.target.value)} />
                    </div>
                  </div>

                  {/* Contacto */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Contacto</label>
                      <input className="input-glass rounded-xl px-3 py-2.5 text-sm"
                        placeholder="Nombre del contacto"
                        value={form.contacto} onChange={e => setF('contacto', e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Email</label>
                      <input type="email" className="input-glass rounded-xl px-3 py-2.5 text-sm"
                        placeholder="correo@empresa.com"
                        value={form.email} onChange={e => setF('email', e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Válida hasta</label>
                      <input type="date" className="input-glass rounded-xl px-3 py-2.5 text-sm"
                        value={form.validHasta} onChange={e => setF('validHasta', e.target.value)} />
                    </div>
                  </div>

                  {/* Descripción */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Descripción</label>
                    <textarea className="input-glass rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
                      placeholder="Resumen de la propuesta comercial..."
                      value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} />
                  </div>

                  {/* Notas */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Notas internas</label>
                    <textarea className="input-glass rounded-xl px-3 py-2.5 text-sm resize-none" rows={2}
                      placeholder="Notas privadas del equipo comercial..."
                      value={form.notas} onChange={e => setF('notas', e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          {['Descripción','Cant.','Valor unit.','Desc. %','Subtotal',''].map(h => (
                            <th key={h} className="text-left pb-2 text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: 'var(--text-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => (
                          <ItemRow key={i} item={item}
                            onChange={f => updateItem(i, f)}
                            onRemove={() => removeItem(i)} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {items.length === 0 && (
                    <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      Sin ítems — agrega líneas de producto o servicio
                    </div>
                  )}
                  <button onClick={addItem}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold self-start transition-colors hover:bg-white/5"
                    style={{ color: 'var(--accent-blue)', border: '1px dashed var(--accent-blue-border)' }}>
                    <Plus className="w-3.5 h-3.5" /> Agregar ítem
                  </button>
                  {total > 0 && (
                    <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="text-right">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total cotización</p>
                        <p className="text-xl font-bold mt-0.5" style={{ color: '#34D399' }}>{fmt(total)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
              {initial?.id && onDelete && (
                <button onClick={handleDelete} disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-red-500/10"
                  style={{ color: '#f87171' }}>
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Eliminar
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  Cancelar
                </button>
                <button onClick={submit} disabled={saving}
                  className="btn-primary px-5 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {initial?.id ? 'Guardar cambios' : 'Crear cotización'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CotizacionesPage() {
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [clients, setClients] = useState<{ id: string; businessName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<CotStatus | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<Partial<Cotizacion> | undefined>();
  const [viewKanban, setViewKanban] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;
      const data = await comercialApi.list(params);
      setCotizaciones(Array.isArray(data) ? data : data.data ?? []);
    } catch { toast.error('Error al cargar cotizaciones'); }
    finally { setLoading(false); }
  }, [filterStatus, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    clientsApi.list({ limit: 500 }).then((r: any) => setClients(r.data ?? r)).catch(() => {});
  }, []);

  const openNew = () => { setModalInitial(undefined); setModalOpen(true); };
  const openEdit = async (cot: Cotizacion) => {
    try {
      const detail = await comercialApi.get(cot.id);
      setModalInitial(detail);
    } catch { setModalInitial(cot); }
    setModalOpen(true);
  };

  const handleSave = async (data: any) => {
    if (modalInitial?.id) {
      const updated = await comercialApi.update(modalInitial.id, data);
      setCotizaciones(p => p.map(c => c.id === updated.id ? updated : c));
      toast.success('Cotización actualizada');
    } else {
      const created = await comercialApi.create(data);
      setCotizaciones(p => [created, ...p]);
      toast.success(`Cotización ${created.numero} creada`);
    }
  };

  const handleDelete = async () => {
    if (!modalInitial?.id) return;
    await comercialApi.remove(modalInitial.id);
    setCotizaciones(p => p.filter(c => c.id !== modalInitial.id));
    toast.success('Cotización eliminada');
  };

  // KPIs
  const totalActivo = cotizaciones.filter(c => !['rechazada'].includes(c.status))
    .reduce((s, c) => s + (c.valor ?? 0), 0);
  const countAceptadas = cotizaciones.filter(c => c.status === 'aceptada').length;
  const countPendientes = cotizaciones.filter(c => ['enviada','en_negociacion'].includes(c.status)).length;

  const filtered = cotizaciones.filter(c => {
    const q = search.toLowerCase();
    return (!q || c.titulo.toLowerCase().includes(q) ||
      c.numero.toLowerCase().includes(q) ||
      c.client?.businessName.toLowerCase().includes(q) ||
      c.prospecto?.toLowerCase().includes(q)
    );
  });

  const kpiCard = (label: string, value: string, sub: string, color: string) => (
    <div className="rounded-2xl px-5 py-4 flex flex-col gap-1" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 min-h-0">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {kpiCard('Pipeline activo', fmt(totalActivo), 'excl. rechazadas', '#60A5FA')}
        {kpiCard('Aceptadas', String(countAceptadas), 'cotizaciones ganadas', '#34D399')}
        {kpiCard('En proceso', String(countPendientes), 'enviadas + negociación', '#FBBF24')}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <input className="input-glass rounded-xl pl-8 pr-3 py-2 text-sm w-56"
              placeholder="Buscar cotización..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* Status filter */}
          <select className="input-glass rounded-xl px-3 py-2 text-sm"
            value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="">Todos los estados</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle vista */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {[false, true].map(k => (
              <button key={String(k)} onClick={() => setViewKanban(k)}
                className="px-3 py-2 text-xs font-semibold transition-colors"
                style={{
                  background: viewKanban === k ? 'var(--accent-blue)' : 'transparent',
                  color: viewKanban === k ? '#fff' : 'var(--text-secondary)',
                }}>
                {k ? 'Kanban' : 'Lista'}
              </button>
            ))}
          </div>
          <button onClick={openNew}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white">
            <Plus className="w-3.5 h-3.5" /> Nueva cotización
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : viewKanban ? (
        /* Kanban */
        <div className="grid grid-cols-5 gap-3 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
          {STATUS_ORDER.map(status => {
            const cfg = STATUS_CFG[status];
            const cols = filtered.filter(c => c.status === status);
            return (
              <div key={status} className="flex flex-col gap-2 min-w-[200px]">
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${cfg.color}22`, color: cfg.color }}>{cols.length}</span>
                </div>
                {/* Cards */}
                {cols.map(c => (
                  <motion.div key={c.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl p-3 cursor-pointer transition-all hover:shadow-lg"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                    onClick={() => openEdit(c)}>
                    <p className="text-[10px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>{c.numero}</p>
                    <p className="text-xs font-semibold leading-snug mb-2" style={{ color: 'var(--text-primary)' }}>{c.titulo}</p>
                    {(c.client?.businessName || c.prospecto) && (
                      <p className="text-[10px] flex items-center gap-1 mb-1" style={{ color: 'var(--text-muted)' }}>
                        <Building2 className="w-2.5 h-2.5" />
                        {c.client?.businessName ?? c.prospecto}
                      </p>
                    )}
                    {c.valor != null && (
                      <p className="text-xs font-bold mt-2" style={{ color: '#34D399' }}>{fmt(c.valor)}</p>
                    )}
                    {c.validHasta && (
                      <p className="text-[10px] mt-1" style={{ color: dayjs(c.validHasta).isBefore(dayjs()) ? '#f87171' : 'var(--text-muted)' }}>
                        Vence {dayjs(c.validHasta).format('D MMM YYYY')}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        /* Lista */
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
          {filtered.length === 0 ? (
            <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay cotizaciones</p>
              <p className="text-xs mt-1">Crea la primera con el botón "Nueva cotización"</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <tr>
                  {['#','Título','Cliente / Prospecto','Valor','Estado','Válida hasta','Creada',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <motion.tr key={c.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b group cursor-pointer transition-colors hover:bg-white/[0.02]"
                    style={{ borderColor: 'var(--border-subtle)' }}
                    onClick={() => openEdit(c)}>
                    <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: 'var(--accent-blue)' }}>{c.numero}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{c.titulo}</p>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {c.client?.businessName ?? c.prospecto ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: c.valor ? '#34D399' : 'var(--text-muted)' }}>
                      {fmt(c.valor)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-xs" style={{ color: c.validHasta && dayjs(c.validHasta).isBefore(dayjs()) ? '#f87171' : 'var(--text-muted)' }}>
                      {c.validHasta ? dayjs(c.validHasta).format('D MMM YYYY') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {dayjs(c.createdAt).format('D MMM YYYY')}
                    </td>
                    <td className="px-4 py-3">
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={e => { e.stopPropagation(); openEdit(c); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal */}
      <CotModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setModalInitial(undefined); }}
        initial={modalInitial}
        clients={clients}
        onSave={handleSave}
        onDelete={modalInitial?.id ? handleDelete : undefined}
      />
    </div>
  );
}
