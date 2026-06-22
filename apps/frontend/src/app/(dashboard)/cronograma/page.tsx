'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  ChevronLeft, ChevronRight, Plus, X, CheckCircle2, Loader2,
  Trash2, FileText, Check, Square, CheckSquare, Printer,
} from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/es';
import updateLocale from 'dayjs/plugin/updateLocale';
import { toast } from 'sonner';
import { cronogramaApi, clientsApi, usersApi, serviceOrdersApi } from '@/lib/api';
import { ClientCombobox } from '@/components/ui/ClientCombobox';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

dayjs.extend(updateLocale);
dayjs.locale('es');
dayjs.updateLocale('es', { weekStart: 1 });

interface Bloque {
  id: string; titulo: string; fecha: string;
  horaInicio: string; horaFin: string; color: string; status: string;
  notas?: string; tipoActa?: string | null; actaId?: string | null;
  agente: { id: string; firstName: string; lastName: string };
  client?: { id: string; businessName: string } | null;
  serviceOrder?: { id: string; osNumber: string; product: string; project?: { id: string } | null } | null;
}

const AGENT_COLORS = [
  '#2563EB','#7C3AED','#059669','#D97706','#DC2626','#0891B2','#BE185D','#4338CA',
];

const TIPO_ACTA_CFG: Record<string, { label: string; color: string }> = {
  inicio:          { label: 'Acta de Inicio',      color: '#34d399' },
  visita:          { label: 'Acta de Visita',       color: '#60a5fa' },
  cierre:          { label: 'Acta de Cierre',       color: '#a78bfa' },
  capacitacion:    { label: 'Acta de Capacitación', color: '#fb923c' },
  entrega_soporte: { label: 'Entrega a Soporte',    color: '#f472b6' },
};

const STATUS_CFG: Record<string, { label: string }> = {
  programado: { label: 'Programado' }, en_curso: { label: 'En curso' },
  completado:  { label: 'Completado' }, cancelado: { label: 'Cancelado' },
};

function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function minToFraction(t: string) { return (timeToMin(t) - 7 * 60) / (12 * 60); }

// ── Modal ─────────────────────────────────────────────────────────────────────
function BloqueModal({ open, onClose, initial, agents, clients, onSave, onDelete, onCrearActa, currentUserId }: {
  open: boolean; onClose: () => void;
  initial?: any;
  agents: { id: string; firstName: string; lastName: string }[];
  clients: { id: string; businessName: string }[];
  onSave: (data: any) => Promise<Bloque>;
  onDelete?: () => Promise<void>;
  onCrearActa: (b: Bloque) => void;
  currentUserId?: string;
}) {
  const [form, setForm] = useState({
    titulo: '', fecha: dayjs().format('YYYY-MM-DD'),
    horaInicio: '08:00', horaFin: '10:00',
    agenteId: '', clientId: '', serviceOrderId: '',
    notas: '', color: '#2563EB', tipoActa: '', status: 'programado',
  });
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [soImplementers, setSoImplementers] = useState<{ id: string; firstName: string; lastName: string; role: string }[]>([]);
  const [loadingSO, setLoadingSO] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState<Bloque | null>(null);
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(dayjs());

  const toggleExtraDate = (d: string) =>
    setExtraDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());

  useEffect(() => {
    if (!open) { setSaved(null); setSoImplementers([]); setExtraDates([]); setPickerOpen(false); return; }
    const horaDefault = initial?.horaDefault ?? '08:00';
    const [hd] = horaDefault.split(':').map(Number);
    setForm({
      titulo:         initial?.titulo             ?? '',
      fecha:          initial?.fecha              ? (initial.fecha as string).substring(0, 10) : (initial?.fechaDefault ?? dayjs().format('YYYY-MM-DD')),
      horaInicio:     initial?.horaInicio         ?? horaDefault,
      horaFin:        initial?.horaFin            ?? `${String(Math.min(hd + 2, 19)).padStart(2,'0')}:00`,
      agenteId:       initial?.agente?.id         ?? currentUserId ?? '',
      clientId:       initial?.client?.id         ?? '',
      serviceOrderId: initial?.serviceOrder?.id   ?? '',
      notas:          initial?.notas              ?? '',
      color:          initial?.color              ?? '#2563EB',
      tipoActa:       initial?.tipoActa           ?? '',
      status:         initial?.status             ?? 'programado',
    });
  }, [open, initial, currentUserId]);

  useEffect(() => {
    if (!form.clientId) { setServiceOrders([]); setSoImplementers([]); return; }
    setLoadingSO(true);
    serviceOrdersApi.list({ clientId: form.clientId, limit: 100 } as any)
      .then((r: any) => setServiceOrders(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingSO(false));
  }, [form.clientId]);

  useEffect(() => {
    if (!form.serviceOrderId) { setSoImplementers([]); return; }
    serviceOrdersApi.get(form.serviceOrderId)
      .then((so: any) => {
        const impls: { id: string; firstName: string; lastName: string; role: string }[] = [];
        if (so.clinicalLeader) impls.push({ ...so.clinicalLeader, role: 'Líder clínico' });
        if (so.financialLeader && so.financialLeader.id !== so.clinicalLeader?.id)
          impls.push({ ...so.financialLeader, role: 'Líder financiero' });
        (so.implementers ?? []).forEach((i: any) => {
          if (!impls.find(x => x.id === i.user.id))
            impls.push({ ...i.user, role: i.role === 'lider_clinico' ? 'Líder clínico' : i.role === 'apoyo' ? 'Apoyo' : i.role });
        });
        setSoImplementers(impls);
      })
      .catch(() => setSoImplementers([]));
  }, [form.serviceOrderId]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.titulo || !form.agenteId) return toast.error('Título y agente son requeridos');
    if (timeToMin(form.horaFin) <= timeToMin(form.horaInicio)) return toast.error('La hora fin debe ser mayor');
    const allDates = [form.fecha, ...extraDates.filter(d => d !== form.fecha)].sort();
    const isMulti = !initial?.id && allDates.length > 1;
    setSaving(true);
    try {
      const payload = {
        ...form,
        clientId:       form.clientId       || undefined,
        serviceOrderId: form.serviceOrderId || undefined,
        tipoActa:       form.tipoActa       || undefined,
      };
      if (isMulti) {
        for (const fecha of allDates) await onSave({ ...payload, fecha });
        toast.success(`${allDates.length} bloques creados`);
        onClose();
      } else {
        const result = await onSave(payload);
        setSaved(result);
        toast.success(initial?.id ? 'Bloque actualizado' : 'Bloque creado');
      }
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
  const isEdit = !!initial?.id;
  const bloqueData: Bloque | null = saved ?? (isEdit ? initial : null);

  return createPortal(
    <AnimatePresence>
      {open && <>
        <motion.div className="fixed inset-0 z-[600]"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} />
        <motion.div
          className="fixed inset-x-4 top-[4%] bottom-[4%] z-[601] max-w-lg mx-auto rounded-2xl p-6 flex flex-col gap-4 overflow-y-auto"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 24px 80px rgba(0,0,0,0.45)', backdropFilter: 'blur(24px)' }}
          initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }} transition={{ duration: 0.22 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between shrink-0">
            <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              {isEdit ? 'Editar bloque' : 'Nuevo bloque de atención'}
            </h3>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 transition-colors" style={{ color: 'var(--text-muted)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Título */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Título *</label>
            <input className="input-glass rounded-xl px-3 py-2.5 text-sm w-full"
              placeholder="Ej: Parametrización módulo contable"
              value={form.titulo} onChange={e => set('titulo', e.target.value)} />
          </div>

          {/* Fecha + Color */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Fecha *</label>
              <input type="date" className="input-glass rounded-xl px-3 py-2.5 text-sm"
                value={form.fecha}
                onChange={e => { set('fecha', e.target.value); setPickerMonth(dayjs(e.target.value)); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Color</label>
              <div className="flex gap-1.5 flex-wrap pt-1">
                {AGENT_COLORS.map(c => (
                  <button key={c} onClick={() => set('color', c)}
                    className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                    style={{ background: c, outline: form.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                ))}
              </div>
            </div>
          </div>

          {/* Multi-date picker — solo en modo creación */}
          {!isEdit && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setPickerOpen(p => !p); setPickerMonth(dayjs(form.fecha)); }}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all self-start"
                style={{
                  background: pickerOpen ? 'rgba(96,165,250,0.12)' : 'var(--surface-2)',
                  color: pickerOpen ? '#60a5fa' : 'var(--text-secondary)',
                  border: `1px solid ${pickerOpen ? 'rgba(96,165,250,0.3)' : 'var(--border-subtle)'}`,
                }}>
                <Plus className="w-3.5 h-3.5" />
                Repetir en más días
                {extraDates.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: '#2563eb', color: '#fff' }}>
                    +{extraDates.length}
                  </span>
                )}
              </button>

              {pickerOpen && (() => {
                const startOfMonth = pickerMonth.startOf('month');
                const startGrid    = startOfMonth.startOf('week');
                const days = Array.from({ length: 42 }, (_, i) => startGrid.add(i, 'day'));
                return (
                  <div className="rounded-2xl p-3 flex flex-col gap-2"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                    {/* Nav mes */}
                    <div className="flex items-center justify-between">
                      <button onClick={() => setPickerMonth(p => p.subtract(1, 'month'))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                        style={{ color: 'var(--text-muted)' }}>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold capitalize" style={{ color: 'var(--text-primary)' }}>
                        {pickerMonth.format('MMMM YYYY')}
                      </span>
                      <button onClick={() => setPickerMonth(p => p.add(1, 'month'))}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                        style={{ color: 'var(--text-muted)' }}>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Cabecera días */}
                    <div className="grid grid-cols-7 text-center">
                      {['L','M','X','J','V','S','D'].map(d => (
                        <span key={d} className="text-[10px] font-bold py-0.5"
                          style={{ color: 'var(--text-muted)' }}>{d}</span>
                      ))}
                    </div>
                    {/* Grilla días */}
                    <div className="grid grid-cols-7 gap-0.5">
                      {days.map((day, i) => {
                        const ds         = day.format('YYYY-MM-DD');
                        const isMain     = ds === form.fecha;
                        const isExtra    = extraDates.includes(ds);
                        const isSelected = isMain || isExtra;
                        const isThisMon  = day.month() === pickerMonth.month();
                        return (
                          <button key={i}
                            onClick={() => { if (!isMain) toggleExtraDate(ds); }}
                            className="h-7 w-full rounded-lg text-xs font-semibold transition-all"
                            style={{
                              background: isMain
                                ? '#2563EB'
                                : isExtra
                                  ? 'rgba(37,99,235,0.25)'
                                  : 'transparent',
                              color: isMain
                                ? '#fff'
                                : isExtra
                                  ? '#60a5fa'
                                  : isThisMon
                                    ? 'var(--text-secondary)'
                                    : 'var(--text-muted)',
                              opacity: isThisMon ? 1 : 0.4,
                              cursor: isMain ? 'default' : 'pointer',
                            }}>
                            {day.date()}
                          </button>
                        );
                      })}
                    </div>
                    {/* Pills de fechas extra */}
                    {extraDates.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        {extraDates.map(d => (
                          <span key={d} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(37,99,235,0.15)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.3)' }}>
                            {dayjs(d).format('D MMM')}
                            <button onClick={() => toggleExtraDate(d)} className="hover:opacity-70 transition-opacity">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                        <button onClick={() => setExtraDates([])}
                          className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
                          style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                          Limpiar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Horas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Hora inicio *</label>
              <input type="time" className="input-glass rounded-xl px-3 py-2.5 text-sm"
                value={form.horaInicio} onChange={e => set('horaInicio', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Hora fin *</label>
              <input type="time" className="input-glass rounded-xl px-3 py-2.5 text-sm"
                value={form.horaFin} onChange={e => set('horaFin', e.target.value)} />
            </div>
          </div>

          {/* Agente + Estado */}
          <div className={`grid gap-3 ${isEdit ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                Agente *
                {soImplementers.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: '#2563eb18', color: '#60a5fa' }}>
                    Implementadores de la OS
                  </span>
                )}
              </label>
              <select className="input-glass rounded-xl px-3 py-2.5 text-sm"
                value={form.agenteId} onChange={e => set('agenteId', e.target.value)}>
                <option value="">— Seleccionar —</option>
                {soImplementers.length > 0
                  ? soImplementers.map(a => (
                    <option key={a.id} value={a.id}>{a.firstName} {a.lastName} ({a.role})</option>
                  ))
                  : agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)
                }
              </select>
              {soImplementers.length > 0 && (
                <button type="button" onClick={() => setSoImplementers([])}
                  className="text-[11px] text-left hover:opacity-70 transition-opacity"
                  style={{ color: '#94a3b8' }}>
                  Ver todos los agentes →
                </button>
              )}
            </div>
            {isEdit && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Estado</label>
                <select className="input-glass rounded-xl px-3 py-2.5 text-sm"
                  value={form.status} onChange={e => set('status', e.target.value)}>
                  {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Cliente */}
          <ClientCombobox
            clients={clients}
            value={form.clientId}
            onChange={id => { set('clientId', id); set('serviceOrderId', ''); }}
            label="Cliente"
            nullLabel="— Sin cliente —"
            placeholder="Buscar cliente…"
          />

          {/* Orden de servicio */}
          {form.clientId && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                Orden de servicio
                {loadingSO && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>cargando...</span>}
              </label>
              <select className="input-glass rounded-xl px-3 py-2.5 text-sm"
                value={form.serviceOrderId} onChange={e => set('serviceOrderId', e.target.value)}>
                <option value="">— Actividad libre (sin OS) —</option>
                {serviceOrders.map((o: any) => (
                  <option key={o.id} value={o.id}>{o.osNumber} — {o.product}</option>
                ))}
              </select>
              {serviceOrders.length === 0 && !loadingSO && (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Sin órdenes de servicio para este cliente</p>
              )}
            </div>
          )}

          {/* Tipo de acta */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Tipo de acta a realizar</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => set('tipoActa', '')}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all"
                style={{
                  background: !form.tipoActa ? 'var(--accent-blue-bg)' : 'var(--surface-2)',
                  color: !form.tipoActa ? 'var(--accent-blue)' : 'var(--text-muted)',
                  border: `1px solid ${!form.tipoActa ? 'var(--accent-blue-border)' : 'var(--border-subtle)'}`,
                }}>
                Sin acta
              </button>
              {Object.entries(TIPO_ACTA_CFG).map(([k, v]) => (
                <button key={k} onClick={() => set('tipoActa', k)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all"
                  style={{
                    background:  form.tipoActa === k ? `${v.color}18` : 'var(--surface-2)',
                    color:       form.tipoActa === k ? v.color : 'var(--text-secondary)',
                    border:      `1px solid ${form.tipoActa === k ? `${v.color}40` : 'var(--border-subtle)'}`,
                  }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Notas</label>
            <textarea className="input-glass rounded-xl px-3 py-2.5 text-sm resize-none" rows={2}
              placeholder="Observaciones adicionales..."
              value={form.notas} onChange={e => set('notas', e.target.value)} />
          </div>

          {/* Banner Crear Acta */}
          {bloqueData?.tipoActa && (() => {
            const cfg = TIPO_ACTA_CFG[bloqueData.tipoActa!];
            return cfg ? (
              <div className="rounded-xl p-3 flex items-center justify-between gap-3"
                style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}30` }}>
                <div>
                  <p className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {bloqueData.actaId
                      ? 'Acta ya creada para este bloque'
                      : bloqueData.serviceOrder
                        ? `OS: ${bloqueData.serviceOrder.osNumber} — afecta módulos del proyecto`
                        : 'Se creará sin orden de servicio asociada'
                    }
                  </p>
                </div>
                {!bloqueData.actaId && (
                  <button onClick={() => { onCrearActa(bloqueData); onClose(); }}
                    className="btn-primary px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shrink-0">
                    <FileText className="w-3.5 h-3.5" /> Crear Acta
                  </button>
                )}
              </div>
            ) : null;
          })()}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 shrink-0">
            {isEdit && onDelete && (
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-500/10 transition-colors"
                style={{ color: '#f87171' }}>
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Eliminar
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {saved ? 'Cerrar' : 'Cancelar'}
              </button>
              {!saved && (
                <button onClick={submit} disabled={saving}
                  className="btn-primary px-5 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {isEdit
                    ? 'Guardar cambios'
                    : extraDates.length > 0
                      ? `Crear ${extraDates.length + 1} bloques`
                      : 'Crear bloque'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </>}
    </AnimatePresence>,
    document.body
  );
}

// ── Day View Modal ────────────────────────────────────────────────────────────
function DayModal({ day, bloques, onClose, onEdit, onNew, selectionMode, selectedIds, onToggle, onEnterSelectionMode }: {
  day: Dayjs; bloques: Bloque[];
  onClose: () => void; onEdit: (b: Bloque) => void; onNew: () => void;
  selectionMode?: boolean; selectedIds?: Set<string>; onToggle?: (id: string, e: React.MouseEvent) => void;
  onEnterSelectionMode?: () => void;
}) {
  if (typeof window === 'undefined') return null;

  // Agrupar por agente manteniendo orden cronológico dentro de cada uno
  type AgentGroup = { agente: Bloque['agente']; color: string; items: Bloque[] };
  const groupMap = new Map<string, AgentGroup>();
  [...bloques]
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    .forEach((b, _, arr) => {
      if (!groupMap.has(b.agente.id)) {
        const idx = Array.from(new Set(arr.map(x => x.agente.id))).indexOf(b.agente.id);
        groupMap.set(b.agente.id, {
          agente: b.agente,
          color: AGENT_COLORS[idx % AGENT_COLORS.length],
          items: [],
        });
      }
      groupMap.get(b.agente.id)!.items.push(b);
    });
  const groups = Array.from(groupMap.values());

  const STATUS_COLOR: Record<string, string> = {
    programado: '#60a5fa', en_curso: '#fb923c', completado: '#34d399', cancelado: '#9ca3af',
  };

  // Ancho del modal según cantidad de agentes
  const modalMaxW = groups.length <= 1 ? '30rem' : groups.length === 2 ? '52rem' : '76rem';

  return createPortal(
    <>
      <motion.div className="fixed inset-0 z-[600]"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} />
      <motion.div
        className="fixed inset-x-4 top-[6%] bottom-[6%] z-[601] mx-auto rounded-2xl flex flex-col overflow-hidden"
        style={{
          maxWidth: modalMaxW,
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(24px)',
        }}
        initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.96 }} transition={{ duration: 0.22 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--card-border)' }}>
          <div>
            <h3 className="font-bold text-base capitalize" style={{ color: 'var(--text-primary)' }}>
              {day.format('dddd D de MMMM YYYY')}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {bloques.length} actividad{bloques.length !== 1 ? 'es' : ''} · {groups.length} agente{groups.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!selectionMode && onEnterSelectionMode && bloques.length > 0 && (
              <button onClick={onEnterSelectionMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                <CheckSquare className="w-3.5 h-3.5" /> Seleccionar
              </button>
            )}
            {selectionMode && (
              <span className="text-xs font-semibold px-2.5 py-1.5 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                Modo selección activo
              </span>
            )}
            <button onClick={() => { onNew(); onClose(); }}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white">
              <Plus className="w-3.5 h-3.5" /> Nuevo bloque
            </button>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body: columnas por agente */}
        {groups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin actividades para este día</p>
            <button onClick={() => { onNew(); onClose(); }}
              className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold text-white">
              Agendar bloque
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <div className="flex gap-3 h-full" style={{ minWidth: `${groups.length * 220}px` }}>
              {groups.map(group => (
                <div key={group.agente.id} className="flex flex-col gap-2 flex-1" style={{ minWidth: 200 }}>
                  {/* Cabecera agente */}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl shrink-0"
                    style={{ background: `${group.color}15`, border: `1px solid ${group.color}30` }}>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0"
                      style={{ background: group.color }}>
                      {group.agente.firstName[0]}{group.agente.lastName[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                        {group.agente.firstName} {group.agente.lastName}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {group.items.length} bloque{group.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Bloques del agente */}
                  <div className="flex flex-col gap-2 overflow-y-auto flex-1">
                    {group.items.map((b: Bloque) => {
                      const tc = b.tipoActa ? TIPO_ACTA_CFG[b.tipoActa] : null;
                      const sc = STATUS_COLOR[b.status] ?? '#60a5fa';
                      const isSel = selectedIds?.has(b.id) ?? false;
                      return (
                        <div key={b.id}
                          onClick={e => selectionMode
                            ? onToggle?.(b.id, e)
                            : (onEdit(b), onClose())}
                          className="rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] relative"
                          style={{
                            background: isSel ? `${b.color}28` : `${b.color}12`,
                            border: isSel ? `2px solid ${b.color}` : `1px solid ${b.color}20`,
                            borderLeft: `3px solid ${b.color}`,
                          }}>
                          {selectionMode && (
                            <div className="absolute top-2 right-2 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                              style={{ background: isSel ? b.color : 'transparent', borderColor: isSel ? b.color : `${b.color}60` }}>
                              {isSel && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                          )}
                          {/* Horario */}
                          <p className="text-[11px] font-mono font-bold" style={{ color: b.color }}>
                            {b.horaInicio} – {b.horaFin}
                          </p>
                          {/* Título */}
                          <p className="text-sm font-semibold mt-0.5 leading-snug" style={{ color: 'var(--text-primary)' }}>
                            {b.titulo}
                          </p>
                          {/* Cliente */}
                          {b.client && (
                            <p className="text-[10px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                              {b.client.businessName}
                            </p>
                          )}
                          {/* Tags */}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={{ background: `${sc}20`, color: sc }}>
                              {STATUS_CFG[b.status]?.label ?? b.status}
                            </span>
                            {tc && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ background: `${tc.color}20`, color: tc.color }}>
                                {tc.label.replace('Acta de ','').replace('Entrega a ','')}
                              </span>
                            )}
                            {!selectionMode && b.actaId && (
                              <span className="flex items-center gap-0.5 text-[9px] font-semibold"
                                style={{ color: '#34d399' }}>
                                <CheckCircle2 className="w-2.5 h-2.5" /> Acta
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </>,
    document.body
  );
}

// ── Print Modal ───────────────────────────────────────────────────────────────
type PrintMode = 'day' | 'week' | 'month' | 'range';

function PrintModal({ open, onClose, currentDate }: { open: boolean; onClose: () => void; currentDate: Dayjs }) {
  const [mode, setMode]         = useState<PrintMode>('week');
  const [day, setDay]           = useState(currentDate.format('YYYY-MM-DD'));
  const [weekStart, setWeekStart] = useState(currentDate.startOf('week').format('YYYY-MM-DD'));
  const [month, setMonth]       = useState(currentDate.format('YYYY-MM'));
  const [rangeFrom, setRangeFrom] = useState(currentDate.startOf('week').format('YYYY-MM-DD'));
  const [rangeTo, setRangeTo]   = useState(currentDate.endOf('week').format('YYYY-MM-DD'));
  const [printing, setPrinting] = useState(false);
  const [printAgente, setPrintAgente] = useState('');
  const [agentes, setAgentes]   = useState<{ id: string; firstName: string; lastName: string }[]>([]);

  useEffect(() => {
    if (open) {
      setDay(currentDate.format('YYYY-MM-DD'));
      setWeekStart(currentDate.startOf('week').format('YYYY-MM-DD'));
      setMonth(currentDate.format('YYYY-MM'));
      setRangeFrom(currentDate.startOf('week').format('YYYY-MM-DD'));
      setRangeTo(currentDate.endOf('week').format('YYYY-MM-DD'));
      setPrintAgente('');
      usersApi.listAgents({ limit: 200 }).then(r => setAgentes(Array.isArray(r) ? r : r.data ?? [])).catch(() => {});
    }
  }, [open, currentDate]);

  const getRange = (): { desde: string; hasta: string; label: string } => {
    if (mode === 'day') {
      return { desde: day, hasta: day, label: dayjs(day).format('dddd D [de] MMMM [de] YYYY') };
    }
    if (mode === 'week') {
      const ws = dayjs(weekStart).startOf('week');
      return { desde: ws.format('YYYY-MM-DD'), hasta: ws.endOf('week').format('YYYY-MM-DD'),
        label: `Semana del ${ws.format('D [de] MMMM')} al ${ws.endOf('week').format('D [de] MMMM [de] YYYY')}` };
    }
    if (mode === 'month') {
      const ms = dayjs(month + '-01');
      return { desde: ms.startOf('month').format('YYYY-MM-DD'), hasta: ms.endOf('month').format('YYYY-MM-DD'),
        label: ms.format('MMMM [de] YYYY') };
    }
    return { desde: rangeFrom, hasta: rangeTo,
      label: `${dayjs(rangeFrom).format('D [de] MMMM')} al ${dayjs(rangeTo).format('D [de] MMMM [de] YYYY')}` };
  };

  const handlePrint = async () => {
    const { desde, hasta, label } = getRange();
    setPrinting(true);
    try {
      const params: Record<string, string> = { fechaDesde: desde, fechaHasta: hasta };
      if (printAgente) params.agenteId = printAgente;
      const data = await cronogramaApi.list(params);
      const agenteSeleccionado = printAgente ? agentes.find(a => a.id === printAgente) : null;
      const agenteLabel = agenteSeleccionado ? `${agenteSeleccionado.firstName} ${agenteSeleccionado.lastName}` : null;
      const bloques: Bloque[] = Array.isArray(data) ? data : data.data ?? [];

      // Agrupar por fecha
      const byDay = new Map<string, Bloque[]>();
      bloques.forEach(b => {
        const fd = (b.fecha as string).substring(0, 10);
        if (!byDay.has(fd)) byDay.set(fd, []);
        byDay.get(fd)!.push(b);
      });
      const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));

      const STATUS_LABEL: Record<string, string> = {
        programado: 'Programado', en_curso: 'En curso', completado: 'Completado', cancelado: 'Cancelado',
      };
      const TIPO_LABEL: Record<string, string> = {
        inicio: 'Acta de Inicio', visita: 'Acta de Visita', cierre: 'Acta de Cierre',
        capacitacion: 'Acta de Capacitación', entrega_soporte: 'Entrega a Soporte',
      };

      const rows = days.map(([fecha, bbs]) => {
        const dj = dayjs(fecha);
        const dayHeader = `<tr><td colspan="6" style="background:#1e3a5f;color:#fff;font-size:13px;font-weight:700;padding:8px 12px;letter-spacing:.04em">${dj.format('dddd D [de] MMMM [de] YYYY').toUpperCase()}</td></tr>`;
        const sorted = [...bbs].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        const items = sorted.map(b => `
          <tr>
            <td style="padding:7px 10px;font-weight:700;white-space:nowrap;color:#1e3a5f">${b.horaInicio} – ${b.horaFin}</td>
            <td style="padding:7px 10px;font-weight:600">${b.titulo}</td>
            <td style="padding:7px 10px;color:#475569">${b.client?.businessName ?? '—'}</td>
            <td style="padding:7px 10px;color:#475569">${b.serviceOrder ? `${b.serviceOrder.osNumber}` : '—'}</td>
            <td style="padding:7px 10px;color:#475569">${b.agente.firstName} ${b.agente.lastName}</td>
            <td style="padding:7px 10px">
              ${b.tipoActa ? `<span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${TIPO_LABEL[b.tipoActa] ?? b.tipoActa}</span>` : `<span style="color:#94a3b8;font-size:12px">${STATUS_LABEL[b.status] ?? b.status}</span>`}
              ${b.actaId ? ' <span style="color:#16a34a;font-size:11px;font-weight:600">✓ Acta</span>' : ''}
            </td>
          </tr>`).join('');
        return dayHeader + items;
      }).join('');

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Cronograma AURA — ${label}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
  .header { background: #0f172a; color: #fff; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 22px; font-weight: 800; letter-spacing: .02em; }
  .header .sub { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  .header .range { text-align: right; }
  .header .range-label { font-size: 15px; font-weight: 700; color: #60a5fa; text-transform: capitalize; }
  .content { padding: 20px 28px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 6px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  td { border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 14px; }
  .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: right; }
  @media print {
    @page { margin: 12mm 10mm; size: A4 landscape; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="h1-wrap"><h1>AURA ERP</h1></div>
    <div class="sub">Cronograma de actividades</div>
  </div>
  <div class="range">
    <div class="range-label">${label}</div>
    ${agenteLabel ? `<div style="color:#60a5fa;font-size:12px;margin-top:3px;font-weight:600">Agente: ${agenteLabel}</div>` : ''}
    <div style="color:#94a3b8;font-size:12px;margin-top:4px">${bloques.length} bloque${bloques.length !== 1 ? 's' : ''} en el período</div>
  </div>
</div>
<div class="content">
  ${days.length === 0
    ? '<div class="empty">No hay bloques en el período seleccionado</div>'
    : `<table>
        <thead>
          <tr>
            <th style="width:110px">Hora</th>
            <th>Actividad</th>
            <th>Cliente</th>
            <th style="width:90px">OS</th>
            <th>Agente</th>
            <th style="width:160px">Tipo / Estado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
  }
  <div class="footer">Generado el ${dayjs().format('D [de] MMMM [de] YYYY HH:mm')} · AURA ERP</div>
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body>
</html>`;

      const win = window.open('', '_blank');
      if (win) { win.document.write(html); win.document.close(); }
      onClose();
    } catch {
      toast.error('Error al generar el reporte');
    } finally {
      setPrinting(false);
    }
  };

  if (!open) return null;

  const inputCls = 'input-glass rounded-xl px-3 py-2 text-sm w-full';
  const labelCls = 'block text-xs font-semibold mb-1.5 uppercase tracking-wide';

  return createPortal(
    <>
      <motion.div className="fixed inset-0 z-[700]"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} />
      <motion.div
        className="fixed z-[701] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 32px 72px rgba(0,0,0,0.5)' }}
        initial={{ opacity: 0, scale: 0.93, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }} transition={{ duration: 0.2, ease: [0.16,1,0.3,1] }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.12)' }}>
              <Printer className="w-4 h-4" style={{ color: '#60a5fa' }} />
            </div>
            <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Imprimir cronograma</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modo */}
        <div>
          <p className={labelCls} style={{ color: 'var(--text-muted)' }}>Período a imprimir</p>
          <div className="grid grid-cols-4 gap-2">
            {([
              { key: 'day'   as PrintMode, label: 'Día' },
              { key: 'week'  as PrintMode, label: 'Semana' },
              { key: 'month' as PrintMode, label: 'Mes' },
              { key: 'range' as PrintMode, label: 'Rango' },
            ]).map(({ key, label }) => (
              <button key={key} onClick={() => setMode(key)}
                className="py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: mode === key ? 'var(--accent-blue)' : 'var(--surface-2)',
                  color: mode === key ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${mode === key ? 'transparent' : 'var(--border-subtle)'}`,
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs según modo */}
        {mode === 'day' && (
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Fecha</label>
            <input type="date" className={inputCls} value={day} onChange={e => setDay(e.target.value)} />
          </div>
        )}
        {mode === 'week' && (
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Cualquier día de la semana</label>
            <input type="date" className={inputCls} value={weekStart} onChange={e => setWeekStart(e.target.value)} />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Semana: {dayjs(weekStart).startOf('week').format('D MMM')} – {dayjs(weekStart).endOf('week').format('D MMM YYYY')}
            </p>
          </div>
        )}
        {mode === 'month' && (
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Mes</label>
            <input type="month" className={inputCls} value={month} onChange={e => setMonth(e.target.value)} />
          </div>
        )}
        {mode === 'range' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Desde</label>
              <input type="date" className={inputCls} value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Hasta</label>
              <input type="date" className={inputCls} value={rangeTo} onChange={e => setRangeTo(e.target.value)} />
            </div>
          </div>
        )}

        {/* Filtro de agente */}
        <div>
          <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Agente</label>
          <select value={printAgente} onChange={e => setPrintAgente(e.target.value)} className={inputCls}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
            <option value="">— Todos los agentes (cronograma general) —</option>
            {agentes.map(a => (
              <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
            ))}
          </select>
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            Cancelar
          </button>
          <button onClick={handlePrint} disabled={printing}
            className="flex-1 btn-primary py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50">
            {printing
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generando...</>
              : <><Printer className="w-4 h-4" /> Imprimir</>}
          </button>
        </div>
      </motion.div>
    </>,
    document.body
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CronogramaPage() {
  useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [current, setCurrent] = useState<Dayjs>(dayjs());
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [agents, setAgents] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; businessName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<any>(null);
  const [filterAgente, setFilterAgente] = useState('');
  const [dayView, setDayView] = useState<Dayjs | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printModal, setPrintModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const desde = view === 'month'
        ? current.startOf('month').subtract(7,'day').format('YYYY-MM-DD')
        : current.startOf('week').format('YYYY-MM-DD');
      const hasta = view === 'month'
        ? current.endOf('month').add(7,'day').format('YYYY-MM-DD')
        : current.endOf('week').format('YYYY-MM-DD');
      const data = await cronogramaApi.list({ fechaDesde: desde, fechaHasta: hasta, ...(filterAgente && { agenteId: filterAgente }) });
      setBloques(Array.isArray(data) ? data : data.data ?? []);
    } catch { toast.error('Error al cargar el cronograma'); }
    finally { setLoading(false); }
  }, [current, view, filterAgente]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    clientsApi.list({ limit: 500 }).then((r: any) => setClients(r.data ?? r)).catch(() => {});
    usersApi.listAgents({ limit: 200 }).then((r: any) => setAgents(r.data ?? [])).catch(() => {});
  }, []);

  const openNew = (fecha?: string, hora?: string) => {
    setModalInitial({ fechaDefault: fecha, horaDefault: hora });
    setModalOpen(true);
  };
  const openEdit = (b: Bloque) => { setModalInitial(b); setModalOpen(true); };

  const handleSave = async (data: any): Promise<Bloque> => {
    if (modalInitial?.id) {
      const u = await cronogramaApi.update(modalInitial.id, data);
      setBloques(p => p.map(b => b.id === u.id ? u : b));
      return u;
    }
    const c = await cronogramaApi.create(data);
    setBloques(p => [...p, c]);
    return c;
  };

  const handleDelete = async () => {
    if (!modalInitial?.id) return;
    await cronogramaApi.remove(modalInitial.id);
    setBloques(p => p.filter(b => b.id !== modalInitial.id));
    toast.success('Bloque eliminado');
  };

  const toggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleDaySelect = (bbs: Bloque[], e: React.MouseEvent) => {
    e.stopPropagation();
    const ids = bbs.map(b => b.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      allSelected ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  };

  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (!confirm(`¿Eliminar ${count} bloque${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => cronogramaApi.remove(id)));
      setBloques(p => p.filter(b => !selectedIds.has(b.id)));
      toast.success(`${count} bloque${count !== 1 ? 's' : ''} eliminado${count !== 1 ? 's' : ''}`);
      exitSelection();
    } catch {
      toast.error('Error al eliminar los bloques');
    }
  };

  const handleCrearActa = (b: Bloque) => {
    if (b.serviceOrder?.project?.id) {
      router.push(`/implementacion/proyectos/${b.serviceOrder.project.id}/actas?tipo=${b.tipoActa}&bloqueId=${b.id}`);
    } else {
      toast.info('Asocia una orden de servicio al bloque para crear el acta en su proyecto');
    }
  };

  const bloquesFiltrados = filterAgente ? bloques.filter(b => b.agente.id === filterAgente) : bloques;
  const bloquesEnFecha = (d: Dayjs) =>
    bloquesFiltrados.filter(b => (b.fecha as string).substring(0, 10) === d.format('YYYY-MM-DD'));

  // ── Mes ───────────────────────────────────────────────────────────────────
  const renderMonth = () => {
    const start = current.startOf('month').startOf('week');
    const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => start.add(w * 7 + d, 'day')));
    const today = dayjs().format('YYYY-MM-DD');
    return (
      <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
        {/* Cabecera días de la semana */}
        <div className="grid grid-cols-7 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}>{d}</div>
          ))}
        </div>
        {/* Cuadrícula de semanas — cada fila ocupa 1/6 del espacio disponible */}
        <div className="flex-1 grid grid-rows-6 overflow-hidden" style={{ minHeight: 0 }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border-subtle)', minHeight: 0 }}>
              {week.map((day, di) => {
                const isToday = day.format('YYYY-MM-DD') === today;
                const isThisMonth = day.month() === current.month();
                const bbs = bloquesEnFecha(day);
                return (() => {
                    const dayAllSelected = bbs.length > 0 && bbs.every(b => selectedIds.has(b.id));
                    return (
                      <div key={di}
                        className="flex flex-col overflow-hidden cursor-pointer group"
                        style={{
                          borderRight: '1px solid var(--border-subtle)',
                          background: selectionMode && dayAllSelected && bbs.length > 0
                            ? 'rgba(37,99,235,0.08)'
                            : !isThisMonth ? 'rgba(0,0,0,0.03)' : 'transparent',
                          minHeight: 0,
                          outline: selectionMode && dayAllSelected && bbs.length > 0
                            ? '2px solid rgba(37,99,235,0.4)' : 'none',
                          outlineOffset: -1,
                        }}
                        onClick={e => selectionMode && bbs.length > 0
                          ? toggleDaySelect(bbs, e)
                          : setDayView(day)}>

                        {/* Número del día */}
                        <div className="flex items-center justify-between px-1.5 py-1 shrink-0">
                          <span className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0"
                            style={{
                              background: isToday ? '#2563EB' : 'transparent',
                              color: isToday ? '#fff' : isThisMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                            }}>
                            {day.date()}
                          </span>
                          {selectionMode
                            ? (bbs.length > 0 && (
                              <div className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                                style={{
                                  background: dayAllSelected ? '#2563EB' : 'transparent',
                                  borderColor: dayAllSelected ? '#2563EB' : 'var(--border-subtle)',
                                }}>
                                {dayAllSelected && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                            ))
                            : (
                              <button
                                onClick={e => { e.stopPropagation(); openNew(day.format('YYYY-MM-DD')); }}
                                className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            )
                          }
                        </div>

                        {/* Puntos de color — uno por actividad */}
                        {bbs.length > 0 && (
                          <div className="flex-1 overflow-hidden flex flex-wrap gap-1 content-start px-2 pt-0.5 pb-1.5"
                            style={{ opacity: isThisMonth ? 1 : 0.35 }}>
                            {bbs.map(b => {
                              const isSel = selectedIds.has(b.id);
                              return (
                                <span
                                  key={b.id}
                                  className="w-2.5 h-2.5 rounded-full shrink-0 transition-all"
                                  style={{
                                    background: b.color,
                                    outline: isSel ? `2px solid #fff` : 'none',
                                    outlineOffset: 1,
                                    transform: isSel ? 'scale(1.35)' : undefined,
                                    boxShadow: isSel ? `0 0 0 3px ${b.color}60` : 'none',
                                  }}
                                  onClick={e => selectionMode ? toggleSelect(b.id, e) : undefined}
                                  title={`${b.horaInicio}–${b.horaFin} · ${b.titulo} · ${b.agente.firstName} ${b.agente.lastName}`}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                })();
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Semana ────────────────────────────────────────────────────────────────
  const renderWeek = () => {
    const weekStart = current.startOf('week');
    const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
    const today = dayjs().format('YYYY-MM-DD');
    const SLOT_H = 60;
    const HOURS = Array.from({ length: 13 }, (_, i) => `${String(i + 7).padStart(2,'0')}:00`);
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <div />
          {days.map((d, i) => {
            const isToday = d.format('YYYY-MM-DD') === today;
            return (
              <div key={i} className="py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{d.format('ddd')}</p>
                <span className="text-sm font-bold w-8 h-8 inline-flex items-center justify-center rounded-full mt-0.5"
                  style={{ background: isToday ? '#2563EB' : 'transparent', color: isToday ? '#fff' : 'var(--text-primary)' }}>
                  {d.date()}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ minHeight: SLOT_H * HOURS.length }}>
            <div className="relative">
              {HOURS.map((h, i) => (
                <div key={h} className="absolute w-full text-right pr-2 text-[10px] font-mono"
                  style={{ top: i * SLOT_H - 7, color: 'var(--text-muted)' }}>{h}</div>
              ))}
            </div>
            {days.map((day, di) => {
              const bbs = bloquesEnFecha(day);
              return (
                <div key={di} className="relative border-l" style={{ borderColor: 'var(--border-subtle)', height: SLOT_H * HOURS.length }}>
                  {HOURS.map((h, i) => (
                    <div key={h} className="absolute w-full border-t" style={{ top: i * SLOT_H, borderColor: 'var(--border-subtle)' }}>
                      <div className="h-[60px] w-full cursor-pointer hover:bg-white/[0.02] transition-colors"
                        onClick={() => openNew(day.format('YYYY-MM-DD'), h)} />
                    </div>
                  ))}
                  {bbs.map(b => {
                    const topPct = minToFraction(b.horaInicio);
                    const htPct  = minToFraction(b.horaFin) - topPct;
                    const tc     = b.tipoActa ? TIPO_ACTA_CFG[b.tipoActa] : null;
                    const isSel  = selectedIds.has(b.id);
                    return (
                      <motion.div key={b.id}
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="absolute left-1 right-1 rounded-lg px-2 py-1 overflow-hidden cursor-pointer"
                        style={{
                          top: topPct * SLOT_H * HOURS.length,
                          height: Math.max(htPct * SLOT_H * HOURS.length, 28),
                          background: isSel ? `${b.color}40` : `${b.color}22`,
                          border: isSel ? `2px solid ${b.color}` : `1px solid ${b.color}55`,
                          borderLeft: `3px solid ${b.color}`,
                          zIndex: 10,
                          outline: isSel ? `2px solid ${b.color}60` : 'none',
                          outlineOffset: 2,
                        }}
                        onClick={e => selectionMode ? toggleSelect(b.id, e) : openEdit(b)}
                      >
                        {selectionMode && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded border-2 flex items-center justify-center"
                            style={{ background: isSel ? b.color : 'transparent', borderColor: isSel ? b.color : `${b.color}80` }}>
                            {isSel && <Check className="w-2 h-2 text-white" />}
                          </div>
                        )}
                        <p className="text-[10px] font-bold truncate" style={{ color: b.color }}>{b.horaInicio}–{b.horaFin}</p>
                        <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{b.titulo}</p>
                        {b.client && <p className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>{b.client.businessName}</p>}
                        {tc && <span className="text-[9px] font-bold px-1 rounded mt-0.5 inline-block" style={{ background: `${tc.color}22`, color: tc.color }}>{tc.label.replace('Acta de ','').replace('Entrega a ','')}</span>}
                        {!selectionMode && b.actaId && <CheckCircle2 className="w-3 h-3 absolute top-1 right-1" style={{ color: '#34d399' }} />}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-140px)] gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(p => p.subtract(1, view === 'month' ? 'month' : 'week'))}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-bold min-w-[220px] text-center capitalize" style={{ color: 'var(--text-primary)' }}>
            {view === 'month'
              ? current.format('MMMM YYYY')
              : `${current.startOf('week').format('D MMM')} – ${current.endOf('week').format('D MMM YYYY')}`}
          </h2>
          <button onClick={() => setCurrent(p => p.add(1, view === 'month' ? 'month' : 'week'))}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => { setCurrent(dayjs()); }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
            style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue-border)' }}>
            Hoy
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input-glass rounded-xl px-3 py-1.5 text-xs"
            value={filterAgente} onChange={e => setFilterAgente(e.target.value)}>
            <option value="">Todos los agentes</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
          </select>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {(['month','week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: view === v ? 'var(--accent-blue)' : 'transparent', color: view === v ? '#fff' : 'var(--text-secondary)' }}>
                {v === 'month' ? 'Mes' : 'Semana'}
              </button>
            ))}
          </div>
          <button
            onClick={() => selectionMode ? exitSelection() : setSelectionMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: selectionMode ? 'rgba(239,68,68,0.1)' : 'var(--surface-2)',
              color: selectionMode ? '#ef4444' : 'var(--text-secondary)',
              border: `1px solid ${selectionMode ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`,
            }}>
            {selectionMode ? <><X className="w-3.5 h-3.5" /> Cancelar</> : <><CheckSquare className="w-3.5 h-3.5" /> Seleccionar</>}
          </button>
          <button onClick={() => setPrintModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </button>
          <button onClick={() => openNew()}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white">
            <Plus className="w-3.5 h-3.5" /> Nuevo bloque
          </button>
        </div>
      </div>

      {/* Leyenda — clic filtra por agente */}
      {agents.length > 0 && (
        <div className="flex gap-2 flex-wrap shrink-0">
          {agents.map((a, i) => (
            <button key={a.id} onClick={() => setFilterAgente(filterAgente === a.id ? '' : a.id)}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
              style={{
                color: 'var(--text-secondary)',
                background: filterAgente === a.id ? `${AGENT_COLORS[i % AGENT_COLORS.length]}18` : 'transparent',
                border: `1px solid ${filterAgente === a.id ? `${AGENT_COLORS[i % AGENT_COLORS.length]}40` : 'transparent'}`,
              }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: AGENT_COLORS[i % AGENT_COLORS.length] }} />
              {a.firstName} {a.lastName}
            </button>
          ))}
        </div>
      )}

      {/* Calendario */}
      <div className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-0"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        {loading
          ? <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
          : view === 'month' ? renderMonth() : renderWeek()
        }
      </div>

      <AnimatePresence>
        {dayView && (
          <DayModal
            key="day-modal"
            day={dayView}
            bloques={bloquesEnFecha(dayView)}
            onClose={() => setDayView(null)}
            onEdit={b => { setDayView(null); openEdit(b); }}
            onNew={() => { openNew(dayView.format('YYYY-MM-DD')); setDayView(null); }}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggle={toggleSelect}
            onEnterSelectionMode={() => setSelectionMode(true)}
          />
        )}
      </AnimatePresence>

      <BloqueModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setModalInitial(null); }}
        initial={modalInitial}
        agents={agents}
        clients={clients}
        onSave={handleSave}
        onDelete={modalInitial?.id ? handleDelete : undefined}
        onCrearActa={handleCrearActa}
        currentUserId={user?.id}
      />

      <AnimatePresence>
        {printModal && (
          <PrintModal key="print-modal" open={printModal} onClose={() => setPrintModal(false)} currentDate={current} />
        )}
      </AnimatePresence>

      {/* Barra flotante de eliminación masiva */}
      <AnimatePresence>
        {selectionMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-6 left-1/2 z-[700] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{
              transform: 'translateX(-50%)',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
            }}>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <div className="w-px h-5 shrink-0" style={{ background: 'var(--border-subtle)' }} />
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-semibold hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-muted)' }}>
              Deseleccionar todos
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ background: '#ef4444' }}>
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
