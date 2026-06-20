'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  ChevronLeft, ChevronRight, Plus, X, Clock, User, Building2,
  Calendar, Edit2, Trash2, FileText, CheckCircle2, Loader2,
} from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/es';
import isBetween from 'dayjs/plugin/isBetween';
import { toast } from 'sonner';
import { cronogramaApi, clientsApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

dayjs.extend(isBetween);
dayjs.locale('es');

// ── Types ─────────────────────────────────────────────────────────────────────
interface Bloque {
  id: string; titulo: string; fecha: string;
  horaInicio: string; horaFin: string; color: string; status: string; notas?: string;
  agente: { id: string; firstName: string; lastName: string };
  client?: { id: string; businessName: string } | null;
  serviceOrder?: { id: string; osNumber: string; product: string } | null;
  actaId?: string | null;
}

// ── Hours para la vista semanal ───────────────────────────────────────────────
const HOURS = Array.from({ length: 13 }, (_, i) => `${String(i + 7).padStart(2,'0')}:00`); // 07:00–19:00
const AGENT_COLORS = [
  '#2563EB','#7C3AED','#059669','#D97706','#DC2626','#0891B2','#BE185D','#4338CA',
];

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToFraction(t: string) {
  return (timeToMin(t) - 7 * 60) / (12 * 60); // 07:00–19:00 = 720 min
}

// ── Modal Bloque ──────────────────────────────────────────────────────────────
function BloqueModal({
  open, onClose, initial, agents, clients, onSave, onDelete,
}: {
  open: boolean; onClose: () => void;
  initial?: Partial<Bloque> & { fechaDefault?: string; horaDefault?: string };
  agents: { id: string; firstName: string; lastName: string }[];
  clients: { id: string; businessName: string }[];
  onSave: (data: any) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    titulo: '', fecha: dayjs().format('YYYY-MM-DD'), horaInicio: '08:00', horaFin: '10:00',
    agenteId: '', clientId: '', notas: '', color: '#2563EB',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      titulo:     initial?.titulo     ?? '',
      fecha:      initial?.fecha      ? dayjs(initial.fecha).format('YYYY-MM-DD') : (initial?.fechaDefault ?? dayjs().format('YYYY-MM-DD')),
      horaInicio: initial?.horaInicio ?? initial?.horaDefault ?? '08:00',
      horaFin:    initial?.horaFin    ?? (() => {
        if (initial?.horaDefault) {
          const [h, m] = initial.horaDefault.split(':').map(Number);
          return `${String(h + 2).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        }
        return '10:00';
      })(),
      agenteId: initial?.agente?.id ?? '',
      clientId: initial?.client?.id ?? '',
      notas:    initial?.notas ?? '',
      color:    initial?.color ?? '#2563EB',
    });
  }, [open, initial]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.titulo || !form.agenteId || !form.fecha) return toast.error('Completa los campos requeridos');
    if (timeToMin(form.horaFin) <= timeToMin(form.horaInicio)) return toast.error('La hora fin debe ser mayor a la hora inicio');
    setSaving(true);
    try {
      await onSave({ ...form, clientId: form.clientId || undefined });
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
            className="fixed inset-x-4 top-1/2 z-[601] max-w-lg mx-auto rounded-2xl p-6 flex flex-col gap-4"
            style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
              backdropFilter: 'blur(24px)',
              transform: 'translateY(-50%)',
            }}
            initial={{ opacity: 0, y: '-40%', scale: 0.95 }}
            animate={{ opacity: 1, y: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: '-40%', scale: 0.95 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                {initial?.id ? 'Editar bloque' : 'Nuevo bloque de atención'}
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

            <div className="grid grid-cols-2 gap-3">
              {/* Fecha */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Fecha *</label>
                <input type="date" className="input-glass rounded-xl px-3 py-2.5 text-sm"
                  value={form.fecha} onChange={e => set('fecha', e.target.value)} />
              </div>
              {/* Color */}
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

            {/* Agente */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Agente *</label>
              <select className="input-glass rounded-xl px-3 py-2.5 text-sm"
                value={form.agenteId} onChange={e => set('agenteId', e.target.value)}>
                <option value="">— Seleccionar agente —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
              </select>
            </div>

            {/* Cliente */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Cliente</label>
              <select className="input-glass rounded-xl px-3 py-2.5 text-sm"
                value={form.clientId} onChange={e => set('clientId', e.target.value)}>
                <option value="">— Sin cliente —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
              </select>
            </div>

            {/* Notas */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Notas</label>
              <textarea className="input-glass rounded-xl px-3 py-2.5 text-sm resize-none" rows={2}
                placeholder="Observaciones adicionales..."
                value={form.notas} onChange={e => set('notas', e.target.value)} />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
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
                  {initial?.id ? 'Guardar cambios' : 'Crear bloque'}
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
export default function CronogramaPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { user } = useAuthStore();
  const router = useRouter();

  const [view, setView] = useState<'month' | 'week'>('month');
  const [current, setCurrent] = useState<Dayjs>(dayjs());
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [agents, setAgents] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; businessName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<any>(null);
  const [filterAgente, setFilterAgente] = useState('');

  // Agent color map
  const agentColorMap = Object.fromEntries(
    agents.map((a, i) => [a.id, AGENT_COLORS[i % AGENT_COLORS.length]])
  );

  const load = useCallback(async () => {
    try {
      const desde = view === 'month'
        ? current.startOf('month').subtract(7,'day').format('YYYY-MM-DD')
        : current.startOf('week').format('YYYY-MM-DD');
      const hasta = view === 'month'
        ? current.endOf('month').add(7,'day').format('YYYY-MM-DD')
        : current.endOf('week').format('YYYY-MM-DD');
      const data = await cronogramaApi.list({
        fechaDesde: desde, fechaHasta: hasta,
        ...(filterAgente && { agenteId: filterAgente }),
      });
      setBloques(Array.isArray(data) ? data : data.data ?? []);
    } catch { toast.error('Error al cargar el cronograma'); }
    finally { setLoading(false); }
  }, [current, view, filterAgente]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    clientsApi.list({ limit: 500 }).then((r: any) => setClients(r.data ?? r)).catch(() => {});
    usersApi.listAgents({ limit: 200 }).then((r: any) => setAgents(r.data ?? [])).catch(() => {});
  }, []);

  const openNew = (fecha?: string, hora?: string) =>
    setModalInitial({ fechaDefault: fecha, horaDefault: hora });

  const openEdit = (b: Bloque) => setModalInitial(b);

  useEffect(() => { if (modalInitial !== undefined) setModalOpen(true); }, [modalInitial]);

  const handleSave = async (data: any) => {
    if (modalInitial?.id) {
      const updated = await cronogramaApi.update(modalInitial.id, data);
      setBloques(p => p.map(b => b.id === updated.id ? updated : b));
      toast.success('Bloque actualizado');
    } else {
      const created = await cronogramaApi.create(data);
      setBloques(p => [...p, created]);
      toast.success('Bloque creado');
    }
  };

  const handleDelete = async () => {
    if (!modalInitial?.id) return;
    await cronogramaApi.remove(modalInitial.id);
    setBloques(p => p.filter(b => b.id !== modalInitial.id));
    toast.success('Bloque eliminado');
  };

  const bloquesFiltrados = filterAgente
    ? bloques.filter(b => b.agente.id === filterAgente)
    : bloques;

  const bloquesEnFecha = (d: Dayjs) =>
    bloquesFiltrados.filter(b => dayjs(b.fecha).format('YYYY-MM-DD') === d.format('YYYY-MM-DD'));

  // ── Vista mes ─────────────────────────────────────────────────────────────
  const renderMonth = () => {
    const start = current.startOf('month').startOf('week');
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        days.push(start.add(w * 7 + d, 'day'));
      }
      weeks.push(days);
    }
    const today = dayjs().format('YYYY-MM-DD');

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Cabecera días */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}>{d}</div>
          ))}
        </div>
        {/* Grid días */}
        <div className="flex-1 grid grid-rows-6 overflow-hidden">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border-subtle)', minHeight: 100 }}>
              {week.map((day, di) => {
                const isToday     = day.format('YYYY-MM-DD') === today;
                const isThisMonth = day.month() === current.month();
                const bbs         = bloquesEnFecha(day);
                return (
                  <div key={di}
                    className="p-1.5 border-r overflow-hidden transition-colors cursor-pointer hover:bg-white/[0.02]"
                    style={{ borderColor: 'var(--border-subtle)', opacity: isThisMonth ? 1 : 0.4 }}
                    onClick={() => { setCurrent(day); setView('week'); }}
                  >
                    {/* Número día */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full"
                        style={{
                          background: isToday ? '#2563EB' : 'transparent',
                          color: isToday ? '#fff' : 'var(--text-secondary)',
                        }}
                      >{day.date()}</span>
                      {bbs.length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); openNew(day.format('YYYY-MM-DD')); setModalOpen(true); }}
                          className="w-5 h-5 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
                          style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {/* Bloques del día */}
                    <div className="space-y-0.5">
                      {bbs.slice(0, 3).map(b => (
                        <div key={b.id}
                          onClick={e => { e.stopPropagation(); openEdit(b); }}
                          className="text-[10px] leading-tight px-1.5 py-0.5 rounded-md truncate font-medium cursor-pointer transition-opacity hover:opacity-80"
                          style={{ background: `${b.color}22`, color: b.color, border: `1px solid ${b.color}40` }}
                          title={`${b.horaInicio}–${b.horaFin} · ${b.titulo}`}>
                          {b.horaInicio} {b.titulo}
                        </div>
                      ))}
                      {bbs.length > 3 && (
                        <div className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                          +{bbs.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Vista semana ──────────────────────────────────────────────────────────
  const renderWeek = () => {
    const weekStart = current.startOf('week');
    const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
    const today = dayjs().format('YYYY-MM-DD');
    const SLOT_H = 60; // px per hour slot

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Cabecera días */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <div />
          {days.map((d, i) => {
            const isToday = d.format('YYYY-MM-DD') === today;
            return (
              <div key={i} className="py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {d.format('ddd')}
                </p>
                <span className={`text-sm font-bold w-8 h-8 inline-flex items-center justify-center rounded-full mt-0.5 ${isToday ? 'text-white' : ''}`}
                  style={{ background: isToday ? '#2563EB' : 'transparent', color: isToday ? '#fff' : 'var(--text-primary)' }}>
                  {d.date()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Cuerpo con scroll */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ minHeight: SLOT_H * HOURS.length }}>
            {/* Horas columna */}
            <div className="relative">
              {HOURS.map((h, i) => (
                <div key={h} className="absolute w-full text-right pr-2 text-[10px] font-mono" style={{
                  top: i * SLOT_H - 7,
                  color: 'var(--text-muted)',
                }}>{h}</div>
              ))}
            </div>

            {/* Columnas de días */}
            {days.map((day, di) => {
              const bbs = bloquesEnFecha(day);
              return (
                <div key={di} className="relative border-l" style={{ borderColor: 'var(--border-subtle)', height: SLOT_H * HOURS.length }}>
                  {/* Líneas de hora */}
                  {HOURS.map((h, i) => (
                    <div key={h} className="absolute w-full border-t" style={{
                      top: i * SLOT_H, borderColor: 'var(--border-subtle)',
                    }}>
                      {/* Click en franja = crear nuevo bloque */}
                      <div className="h-[60px] w-full cursor-pointer hover:bg-white/[0.02] transition-colors"
                        onClick={() => { openNew(day.format('YYYY-MM-DD'), h); setModalOpen(true); }} />
                    </div>
                  ))}

                  {/* Bloques */}
                  {bbs.map(b => {
                    const topPct   = minToFraction(b.horaInicio);
                    const bottomPct = minToFraction(b.horaFin);
                    const heightPct = bottomPct - topPct;
                    const totalH   = SLOT_H * HOURS.length;
                    return (
                      <motion.div key={b.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute left-1 right-1 rounded-lg px-2 py-1 overflow-hidden cursor-pointer group"
                        style={{
                          top:    topPct    * totalH,
                          height: Math.max(heightPct * totalH, 28),
                          background:  `${b.color}22`,
                          border:      `1px solid ${b.color}55`,
                          borderLeft:  `3px solid ${b.color}`,
                          zIndex: 10,
                        }}
                        onClick={() => openEdit(b)}
                      >
                        <p className="text-[10px] font-bold leading-tight truncate" style={{ color: b.color }}>
                          {b.horaInicio}–{b.horaFin}
                        </p>
                        <p className="text-[11px] font-semibold leading-tight truncate mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          {b.titulo}
                        </p>
                        {b.client && (
                          <p className="text-[9px] truncate leading-tight" style={{ color: 'var(--text-muted)' }}>
                            {b.client.businessName}
                          </p>
                        )}
                        {/* Acta badge */}
                        {b.actaId && (
                          <span className="absolute top-1 right-1">
                            <CheckCircle2 className="w-3 h-3" style={{ color: '#34d399' }} />
                          </span>
                        )}
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
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-bold min-w-[200px] text-center" style={{ color: 'var(--text-primary)' }}>
            {view === 'month'
              ? current.format('MMMM YYYY')
              : `${current.startOf('week').format('D MMM')} – ${current.endOf('week').format('D MMM YYYY')}`
            }
          </h2>
          <button onClick={() => setCurrent(p => p.add(1, view === 'month' ? 'month' : 'week'))}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrent(dayjs())}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
            style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', border: '1px solid var(--accent-blue-border)' }}>
            Hoy
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro agente */}
          <select className="input-glass rounded-xl px-3 py-1.5 text-xs"
            value={filterAgente} onChange={e => setFilterAgente(e.target.value)}>
            <option value="">Todos los agentes</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
          </select>

          {/* Toggle vista */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {(['month','week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background: view === v ? 'var(--accent-blue)' : 'transparent',
                  color: view === v ? '#fff' : 'var(--text-secondary)',
                }}>
                {v === 'month' ? 'Mes' : 'Semana'}
              </button>
            ))}
          </div>

          {/* Nuevo bloque */}
          <button
            onClick={() => { setModalInitial(null); setModalOpen(true); }}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white">
            <Plus className="w-3.5 h-3.5" />
            Nuevo bloque
          </button>
        </div>
      </div>

      {/* Leyenda agentes */}
      {agents.length > 0 && (
        <div className="flex gap-3 flex-wrap shrink-0">
          {agents.map((a, i) => (
            <div key={a.id} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: AGENT_COLORS[i % AGENT_COLORS.length] }} />
              {a.firstName} {a.lastName}
            </div>
          ))}
        </div>
      )}

      {/* Calendario */}
      <div className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-0"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>
        {loading
          ? <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          : view === 'month' ? renderMonth() : renderWeek()
        }
      </div>

      {/* Modal */}
      <BloqueModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setModalInitial(undefined); }}
        initial={modalInitial}
        agents={agents}
        clients={clients}
        onSave={handleSave}
        onDelete={modalInitial?.id ? handleDelete : undefined}
      />
    </div>
  );
}
