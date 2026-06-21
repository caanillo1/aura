'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  ArrowLeft, RefreshCw, CheckCircle2, Circle, Clock, AlertCircle,
  ChevronDown, Layers, Calendar, ClipboardList, Pencil, Check,
  MessageSquare, Send, Trash2, Upload, Plus, User, FileText, CheckSquare,
} from 'lucide-react';
import Link from 'next/link';
import { projectsApi, templatesApi, usersApi, clientsApi, actasApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import type { TemplateFlow, User as UserType, ClientStaff } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import type { Project, ProjectPhase, ProjectActivity, ActivityStatus, ProjectStatus, ActivityThread } from '@/types';

const clampDateYear = (val: string): string => {
  if (!val) return val;
  const parts = val.split('-');
  if (parts[0] && parts[0].length > 4) parts[0] = parts[0].slice(0, 4);
  return parts.join('-');
};

// ── Configuraciones de estado ──────────────────────────────────────────────

const ACTIVITY_STATUS: Record<ActivityStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pendiente:   { label: 'Pendiente',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: Circle },
  en_progreso: { label: 'En progreso', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  icon: Clock },
  completado:  { label: 'Completado',  color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: CheckCircle2 },
  bloqueado:   { label: 'Bloqueado',   color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: AlertCircle },
};

const PRIORITY_STYLE: Record<string, { color: string; bg: string }> = {
  critica: { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  alta:    { color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  media:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  baja:    { color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
};

const PROJECT_STATUS: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  activo:     { label: 'Activo',      color: '#34d399', bg: 'rgba(52,211,153,0.12)'   },
  pausado:    { label: 'Pausado',     color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'   },
  completado: { label: 'Completado',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)'  },
  cancelado:  { label: 'Cancelado',   color: '#f87171', bg: 'rgba(248,113,113,0.12)'  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function daysBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

// timeZone:'UTC' porque las fechas llegan como medianoche UTC desde el servidor
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

const fmtShort = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : null;

// ── Sub-componentes ────────────────────────────────────────────────────────

function ProgressBar({ pct, color = '#60a5fa', height = 6 }: { pct: number; color?: string; height?: number }) {
  const p = Math.min(100, Math.max(0, Number(pct) || 0));
  return (
    <div className="rounded-full overflow-hidden" style={{ height, background: 'rgba(255,255,255,0.08)' }}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ duration: 0.6 }}
        className="h-full rounded-full" style={{ background: color }} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = ACTIVITY_STATUS[status as ActivityStatus] ?? ACTIVITY_STATUS.pendiente;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

// ── Modal: Agregar actividad ────────────────────────────────────────────────

interface AddActivityModalProps {
  phaseId: string;
  users: UserType[];
  clientStaff: ClientStaff[];
  tc: any;
  onClose: () => void;
  onAdded: () => void;
}

function AddActivityModal({ phaseId, users, clientStaff, tc, onClose, onAdded }: AddActivityModalProps) {
  const [form, setForm] = useState({
    name: '', description: '', priority: 'media', plannedHours: '',
    actualStartDate: '', actualEndDate: '',
    assignedToId: '', clientStaffId: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: /date/i.test(k) ? clampDateYear(v) : v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      await projectsApi.addActivity(phaseId, {
        name: form.name.trim(),
        description: form.description || undefined,
        priority: form.priority || undefined,
        plannedHours: form.plannedHours ? Number(form.plannedHours) : undefined,
        actualStartDate: form.actualStartDate || undefined,
        actualEndDate: form.actualEndDate || undefined,
        assignedToId: form.assignedToId || undefined,
        clientStaffId: form.clientStaffId || undefined,
      });
      toast.success('Actividad agregada');
      onAdded();
    } catch { toast.error('Error al agregar actividad'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Agregar actividad" width="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Nombre <span className="text-red-400 normal-case font-normal">*</span>
          </label>
          <input type="text" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
            placeholder="Nombre de la actividad"
            value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Descripción</label>
          <textarea rows={2} className="input-glass w-full rounded-xl px-3 py-2 text-sm resize-none"
            placeholder="Descripción opcional"
            value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Prioridad</label>
            <select className="input-glass w-full rounded-xl px-3 py-2 text-sm"
              value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Horas planeadas</label>
            <input type="number" min={0} step={0.5} className="input-glass w-full rounded-xl px-3 py-2 text-sm"
              value={form.plannedHours} onChange={e => set('plannedHours', e.target.value)} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fechas programadas</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Inicio</label>
              <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                value={form.actualStartDate} onChange={e => set('actualStartDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Fin</label>
              <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                value={form.actualEndDate} onChange={e => set('actualEndDate', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Responsable agente</label>
            <select className="input-glass w-full rounded-xl px-3 py-2 text-sm"
              value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)}>
              <option value="">Sin asignar</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Responsable cliente</label>
            <select className="input-glass w-full rounded-xl px-3 py-2 text-sm"
              value={form.clientStaffId} onChange={e => set('clientStaffId', e.target.value)}>
              <option value="">Sin asignar</option>
              {clientStaff.filter((s: any) => s.isProjectLeader).map((s: any) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? 'Guardando...' : <><Plus className="w-4 h-4" /> Agregar</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal de actividad ─────────────────────────────────────────────────────

interface ActivityModalProps {
  activity: ProjectActivity | null;
  users: UserType[];
  clientStaff: ClientStaff[];
  onClose: () => void;
  onSaved: () => void;
  tc: any;
}

function ActivityModal({ activity, users, clientStaff, onClose, onSaved, tc }: ActivityModalProps) {
  const { can } = usePermission();
  const [tab, setTab] = useState<'update' | 'threads'>('update');
  const [form, setForm] = useState({
    status: activity?.status ?? 'pendiente',
    progressPercent: Number(activity?.progressPercent ?? 0),
    actualHours: Number(activity?.actualHours ?? 0),
    observations: activity?.observations ?? '',
    plannedStartDate: activity?.plannedStartDate?.slice(0, 10) ?? '',
    plannedEndDate:   activity?.plannedEndDate?.slice(0, 10) ?? '',
    actualStartDate:  activity?.actualStartDate?.slice(0, 10) ?? '',
    actualEndDate:    activity?.actualEndDate?.slice(0, 10) ?? '',
    executionDate:    activity?.executionDate?.slice(0, 10) ?? '',
    assignedToId:     activity?.assignedToId ?? '',
    clientStaffId:    activity?.clientStaffId ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [blockBy,   setBlockBy]   = useState('');
  const [blockNote, setBlockNote] = useState('');
  const [unlockNote, setUnlockNote] = useState('');

  const [threads, setThreads]                 = useState<ActivityThread[]>([]);
  const [loadingThreads, setLoadingThreads]   = useState(false);
  const [newThread, setNewThread]             = useState('');
  const [newThreadStatus, setNewThreadStatus] = useState('');
  const [postingThread, setPostingThread]     = useState(false);

  useEffect(() => {
    if (activity) {
      setTab('update');
      setForm({
        status: activity.status,
        progressPercent: Number(activity.progressPercent),
        actualHours: Number(activity.actualHours),
        observations: activity.observations ?? '',
        plannedStartDate: activity.plannedStartDate?.slice(0, 10) ?? '',
        plannedEndDate:   activity.plannedEndDate?.slice(0, 10) ?? '',
        actualStartDate:  activity.actualStartDate?.slice(0, 10) ?? '',
        actualEndDate:    activity.actualEndDate?.slice(0, 10) ?? '',
        executionDate:    activity.executionDate?.slice(0, 10) ?? '',
        assignedToId:     activity.assignedToId ?? '',
        clientStaffId:    activity.clientStaffId ?? '',
      });
      setBlockBy('');
      setBlockNote('');
      setUnlockNote('');
      setNewThread('');
    }
  }, [activity]);

  const loadThreads = async () => {
    if (!activity) return;
    setLoadingThreads(true);
    try { setThreads(await templatesApi.getThreads(activity.id)); }
    catch { toast.error('Error al cargar novedades'); }
    finally { setLoadingThreads(false); }
  };

  useEffect(() => {
    if (tab === 'threads' && activity) loadThreads();
  }, [tab, activity?.id]); // eslint-disable-line

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: typeof v === 'string' && /date/i.test(k) ? clampDateYear(v) : v }));

  const handleSave = async () => {
    if (!activity) return;
    if (form.status === 'bloqueado') {
      if (!blockBy) { toast.error('Selecciona quién bloquea la actividad'); return; }
      if (!blockNote.trim()) { toast.error('La nota de bloqueo es obligatoria'); return; }
    }
    setSaving(true);
    try {
      await projectsApi.updateActivity(activity.id, {
        status: form.status,
        progressPercent: form.progressPercent,
        actualHours: form.actualHours,
        observations: form.observations,
        plannedStartDate: form.plannedStartDate || null,
        plannedEndDate:   form.plannedEndDate   || null,
        actualStartDate:  form.actualStartDate  || null,
        actualEndDate:    form.actualEndDate    || null,
        executionDate:    form.executionDate    || null,
        assignedToId:     form.assignedToId     || null,
        clientStaffId:    form.clientStaffId    || null,
        ...(form.status === 'bloqueado' ? { blockedBy: blockBy, blockedNote: blockNote } : {}),
        ...(activity.status === 'bloqueado' && form.status !== 'bloqueado' && unlockNote ? { unlockNote } : {}),
      });
      toast.success('Actividad actualizada');
      onSaved();
      onClose();
    } catch { toast.error('Error al actualizar actividad'); }
    finally { setSaving(false); }
  };

  const handleAddThread = async () => {
    if (!activity || !newThread.trim()) return;
    setPostingThread(true);
    try {
      const payload: { content: string; newStatus?: string } = { content: newThread.trim() };
      if (newThreadStatus) payload.newStatus = newThreadStatus;
      const thread = await templatesApi.addThread(activity.id, payload);
      setThreads(prev => [...prev, thread]);
      setNewThread('');
      setNewThreadStatus('');
    } catch { toast.error('Error al agregar novedad'); }
    finally { setPostingThread(false); }
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      await templatesApi.deleteThread(threadId);
      setThreads(prev => prev.filter(t => t.id !== threadId));
    } catch { toast.error('Error al eliminar novedad'); }
  };

  if (!activity) return null;
  const prio = PRIORITY_STYLE[activity.priority] ?? PRIORITY_STYLE.media;

  return (
    <Modal open={!!activity} onClose={onClose} title="" width="max-w-xl">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="font-mono text-xs px-2 py-1 rounded shrink-0"
            style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
            {activity.code}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: tc.p }}>{activity.name}</p>
            {activity.description && (
              <p className="text-xs mt-0.5 truncate" style={{ color: tc.m }}>{activity.description}</p>
            )}
          </div>
          <span className="px-2 py-0.5 rounded text-xs font-semibold shrink-0"
            style={{ background: prio.bg, color: prio.color }}>
            {activity.priority}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { key: 'update' as const, label: 'Actualizar', icon: Check },
            { key: 'threads' as const, label: 'Novedades', icon: MessageSquare,
              badge: threads.length > 0 ? threads.length : undefined },
          ].map(({ key, label, icon: Icon, badge }) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: tab === key ? 'rgba(96,165,250,0.15)' : 'transparent',
                color: tab === key ? '#60a5fa' : tc.m,
              }}>
              <Icon className="w-3.5 h-3.5" />
              {label}
              {badge !== undefined && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(96,165,250,0.20)', color: '#60a5fa' }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Actualizar */}
        {tab === 'update' && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Estado */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Estado</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(ACTIVITY_STATUS) as [ActivityStatus, any][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const active = form.status === key;
                  return (
                    <button key={key} onClick={() => setForm(prev => {
                      const upd: any = { status: key };
                      if (key === 'completado') upd.progressPercent = 100;
                      else if (key === 'pendiente') upd.progressPercent = 0;
                      else if (key === 'en_progreso' && Number(prev.progressPercent) === 0) upd.progressPercent = 10;
                      return { ...prev, ...upd };
                    })}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border"
                      style={{
                        background: active ? cfg.bg : 'transparent',
                        color: active ? cfg.color : tc.m,
                        borderColor: active ? cfg.color + '60' : 'var(--border-subtle)',
                      }}>
                      <Icon className="w-4 h-4" /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bloqueo: campos obligatorios cuando se selecciona "bloqueado" */}
            {form.status === 'bloqueado' && (
              <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#f87171' }}>Información de bloqueo</p>
                <div>
                  <label className="block text-[10px] mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>¿Quién bloquea? <span className="text-red-400">*</span></label>
                  <div className="flex gap-2">
                    {[{ v: 'cliente', l: 'Cliente' }, { v: 'desarrollo', l: 'Desarrollo' }, { v: 'implementador', l: 'Implementador' }].map(({ v, l }) => (
                      <button key={v} type="button" onClick={() => setBlockBy(v)}
                        className="flex-1 text-xs py-1.5 rounded-lg font-semibold border transition-all"
                        style={{
                          background: blockBy === v ? 'rgba(248,113,113,0.20)' : 'transparent',
                          color: blockBy === v ? '#f87171' : 'var(--text-muted)',
                          borderColor: blockBy === v ? 'rgba(248,113,113,0.50)' : 'var(--border-subtle)',
                        }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Motivo del bloqueo <span className="text-red-400">*</span></label>
                  <textarea rows={3} placeholder="Describe por qué está bloqueada la actividad..."
                    value={blockNote} onChange={e => setBlockNote(e.target.value)}
                    className="input-glass w-full rounded-xl px-3 py-2 text-sm resize-none" />
                </div>
              </div>
            )}

            {/* Desbloqueo: nota opcional al reanudar desde estado bloqueado */}
            {activity?.status === 'bloqueado' && form.status !== 'bloqueado' && (
              <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#34d399' }}>Reanudando actividad bloqueada</p>
                {activity.clientDelayDays ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Días acumulados por cliente: <span className="font-semibold" style={{ color: '#f87171' }}>{activity.clientDelayDays}d</span>
                  </p>
                ) : null}
                <div>
                  <label className="block text-[10px] mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nota de reanudación (opcional)</label>
                  <textarea rows={2} placeholder="Motivo por el que se retoma la actividad..."
                    value={unlockNote} onChange={e => setUnlockNote(e.target.value)}
                    className="input-glass w-full rounded-xl px-3 py-2 text-sm resize-none" />
                </div>
              </div>
            )}

            {/* Progreso */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Progreso</label>
                <span className="text-sm font-bold" style={{ color: '#60a5fa' }}>{form.progressPercent}%</span>
              </div>
              <input type="range" min={0} max={100} step={5}
                value={form.progressPercent}
                onChange={e => set('progressPercent', Number(e.target.value))}
                className="w-full accent-blue-400" />
              <ProgressBar pct={form.progressPercent} />
            </div>

            {/* Horas */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Horas reales <span style={{ color: tc.m, fontWeight: 400 }}>/ Planeadas: {activity.plannedHours}h</span>
              </label>
              <input type="number" min={0} step={0.5}
                value={form.actualHours}
                onChange={e => set('actualHours', Number(e.target.value))}
                className="input-glass w-full rounded-xl px-3 py-2 text-sm" />
            </div>

            {/* Fechas programadas */}
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fechas programadas</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Inicio</label>
                  <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                    value={form.actualStartDate} onChange={e => set('actualStartDate', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Fin</label>
                  <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                    value={form.actualEndDate} onChange={e => set('actualEndDate', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Fecha ejecución */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fecha de ejecución</label>
              <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                value={form.executionDate} onChange={e => set('executionDate', e.target.value)} />
            </div>

            {/* Responsables */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Responsable agente</label>
                <select className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                  value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)}>
                  <option value="">Sin asignar</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Responsable cliente</label>
                <select className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                  value={form.clientStaffId} onChange={e => set('clientStaffId', e.target.value)}>
                  <option value="">Sin asignar</option>
                  {clientStaff.filter(s => s.isProjectLeader).map(s => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Observaciones</label>
              <textarea rows={2}
                value={form.observations}
                onChange={e => set('observations', e.target.value)}
                placeholder="Impedimentos, contexto, notas..."
                className="input-glass w-full rounded-xl px-3 py-2 text-sm resize-none" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? 'Guardando...' : <><Check className="w-4 h-4" /> Guardar</>}
              </button>
            </div>
          </div>
        )}

        {/* Tab: Novedades */}
        {tab === 'threads' && (
          <div className="space-y-3">
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {loadingThreads ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
                ))
              ) : threads.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: tc.m }} />
                  <p className="text-sm" style={{ color: tc.m }}>Sin novedades registradas</p>
                </div>
              ) : (
                threads.map((thread) => {
                  const initials = `${thread.author.firstName[0]}${thread.author.lastName[0]}`.toUpperCase();
                  const date = new Date(thread.createdAt).toLocaleDateString('es-CO', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  });
                  return (
                    <div key={thread.id} className="flex items-start gap-2.5 group">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5"
                        style={{ background: 'rgba(96,165,250,0.20)', color: '#60a5fa' }}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0 rounded-xl px-3 py-2"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold" style={{ color: tc.s }}>
                              {thread.author.firstName} {thread.author.lastName}
                            </span>
                            {thread.newStatus && (() => {
                              const cfg = ACTIVITY_STATUS[thread.newStatus as ActivityStatus] ?? ACTIVITY_STATUS.pendiente;
                              return (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                  style={{ background: cfg.bg, color: cfg.color }}>
                                  → {cfg.label}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px]" style={{ color: tc.m }}>{date}</span>
                            {can('activities.manage') && (
                              <button onClick={() => handleDeleteThread(thread.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                                style={{ color: '#f87171' }}>
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: tc.p }}>{thread.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="pt-1 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              {/* Optional status change */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: tc.m }}>
                  Cambiar estado (opcional):
                </span>
                {['', 'pendiente', 'en_progreso', 'completado', 'bloqueado'].map(s => {
                  if (!s) return (
                    <button key="none" type="button" onClick={() => setNewThreadStatus('')}
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold transition-all"
                      style={{
                        background: newThreadStatus === '' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                        color: newThreadStatus === '' ? tc.p : tc.m,
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}>Sin cambio</button>
                  );
                  const cfg = ACTIVITY_STATUS[s as ActivityStatus] ?? ACTIVITY_STATUS.pendiente;
                  return (
                    <button key={s} type="button" onClick={() => setNewThreadStatus(s)}
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold transition-all"
                      style={{
                        background: newThreadStatus === s ? cfg.bg : 'rgba(255,255,255,0.04)',
                        color: newThreadStatus === s ? cfg.color : '#94a3b8',
                        border: `1px solid ${newThreadStatus === s ? cfg.color + '60' : 'rgba(255,255,255,0.08)'}`,
                      }}>{cfg.label}</button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <textarea rows={2}
                  value={newThread}
                  onChange={e => setNewThread(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddThread(); }}
                  placeholder="Escribe una novedad o comentario... (Ctrl+Enter para enviar)"
                  className="input-glass flex-1 rounded-xl px-3 py-2 text-sm resize-none" />
                <button onClick={handleAddThread} disabled={!newThread.trim() || postingThread}
                  className="self-end px-3 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
                  style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.30)' }}>
                  {postingThread ? '...' : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}


// ── Botón de borrado de actividad (con confirmación inline) ────────────────

function ActivityDeleteButton({ activityId, onDeleted }: { activityId: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (confirm) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={async () => {
          setDeleting(true);
          try { await projectsApi.deleteActivity(activityId); onDeleted(); }
          catch { toast.error('Error al eliminar actividad'); setDeleting(false); setConfirm(false); }
        }} disabled={deleting}
          className="text-[10px] px-2 py-1 rounded-lg font-semibold"
          style={{ background: 'rgba(248,113,113,0.20)', color: '#f87171', border: '1px solid rgba(248,113,113,0.40)' }}>
          {deleting ? '...' : 'Confirmar'}
        </button>
        <button onClick={() => setConfirm(false)}
          className="text-[10px] px-1.5 py-1 rounded-lg"
          style={{ color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)' }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
      onClick={() => setConfirm(true)}
      className="shrink-0 p-1.5 rounded-lg transition-colors"
      style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.15)' }}
      title="Eliminar actividad">
      <Trash2 className="w-3 h-3" />
    </motion.button>
  );
}

// ── Componente de fase ─────────────────────────────────────────────────────

function PhaseRow({ phase, tc, users, clientStaff, filterStatus, onActivityUpdate, onActivityAdded, bulkMode, bulkSelected, onBulkToggle }: {
  phase: ProjectPhase;
  tc: any;
  users: UserType[];
  clientStaff: ClientStaff[];
  filterStatus: ActivityStatus | null;
  onActivityUpdate: () => void;
  onActivityAdded: () => void;
  bulkMode: boolean;
  bulkSelected: Set<string>;
  onBulkToggle: (activityId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProjectActivity | null>(null);
  const [addModal, setAddModal] = useState(false);
  const { can } = usePermission();
  const cfg = ACTIVITY_STATUS[phase.status as ActivityStatus] ?? ACTIVITY_STATUS.pendiente;
  const pct = Number(phase.progressPercent) || 0;
  const visibleActivities = filterStatus
    ? phase.activities.filter(a => a.status === filterStatus)
    : phase.activities;
  // Si el filtro activo no produce ninguna actividad en esta fase, ocultar
  if (filterStatus && visibleActivities.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      {/* Header de fase */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
        style={{ background: open ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
        {phase.color && (
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: phase.color }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: tc.p }}>{phase.name}</span>
            <StatusBadge status={phase.status} />
            <span className="text-xs" style={{ color: tc.m }}>
              {phase.activities.length} actividad{phase.activities.length !== 1 ? 'es' : ''}
            </span>
          </div>
          {/* Fechas de la fase */}
          {(phase.startDate || phase.endDate) && (
            <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: tc.m }}>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Inicio: <strong style={{ color: tc.s }}>{fmtDate(phase.startDate)}</strong>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                Fin: <strong style={{ color: tc.s }}>{fmtDate(phase.endDate)}</strong>
              </span>
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-3">
            <div className="flex-1 max-w-[200px]">
              <ProgressBar pct={pct} color={cfg.color} height={4} />
            </div>
            <span className="text-xs font-mono" style={{ color: cfg.color }}>{pct.toFixed(0)}%</span>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: tc.m }} />
      </button>

      {/* Actividades */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {visibleActivities.length === 0 ? (
                <p className="px-4 py-3 text-sm text-center" style={{ color: tc.m }}>Sin actividades</p>
              ) : (
                visibleActivities.map((act, i) => {
                  const aCfg = ACTIVITY_STATUS[act.status] ?? ACTIVITY_STATUS.pendiente;
                  const AIcon = aCfg.icon;
                  const prio = PRIORITY_STYLE[act.priority] ?? PRIORITY_STYLE.media;
                  const actPct = Number(act.progressPercent) || 0;
                  const scheduledDays = daysBetween(act.actualStartDate, act.actualEndDate);
                  const execDays = daysBetween(act.actualStartDate, act.executionDate);
                  const agentName = act.assignedTo
                    ? `${act.assignedTo.firstName} ${act.assignedTo.lastName}`
                    : null;
                  const clientName = act.clientStaff
                    ? `${act.clientStaff.firstName} ${act.clientStaff.lastName}`
                    : null;

                  return (
                    <motion.div key={act.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="px-4 py-3 border-t transition-colors"
                      style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                      {/* Fila 1: status, code, name, priority, progress, edit, delete */}
                      <div className="flex items-center gap-3">
                        {bulkMode ? (
                          <input type="checkbox" checked={bulkSelected.has(act.id)}
                            onChange={() => onBulkToggle(act.id)}
                            className="w-4 h-4 rounded shrink-0 cursor-pointer accent-blue-400" />
                        ) : (
                          <AIcon className="w-4 h-4 shrink-0" style={{ color: aCfg.color }} />
                        )}
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: 'rgba(96,165,250,0.08)', color: '#60a5fa' }}>
                          {act.code}
                        </span>
                        <span className="flex-1 text-sm truncate" style={{ color: tc.s }}>{act.name}</span>
                        <span className="hidden sm:inline-flex text-[11px] px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: prio.bg, color: prio.color }}>
                          {act.priority}
                        </span>
                        <div className="hidden sm:flex flex-col w-14 shrink-0">
                          <span className="text-[10px] block text-right mb-0.5" style={{ color: tc.m }}>{actPct.toFixed(0)}%</span>
                          <ProgressBar pct={actPct} color={aCfg.color} height={3} />
                        </div>
                        {can('activities.manage') && !bulkMode && (
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => setSelected(act)}
                            className="shrink-0 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                            style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.20)' }}>
                            <Pencil className="w-3 h-3" /> <span className="hidden sm:inline">Editar</span>
                          </motion.button>
                        )}
                        {can('activities.manage') && !bulkMode && (
                          <ActivityDeleteButton activityId={act.id} onDeleted={onActivityUpdate} />
                        )}
                      </div>

                      {/* Fila 2: fechas, días, responsable */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap pl-7"
                        style={{ fontSize: '11px', color: tc.m }}>
                        {fmtShort(act.actualStartDate) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Inicio:</span>
                            <strong style={{ color: tc.s }}>{fmtShort(act.actualStartDate)}</strong>
                          </span>
                        )}
                        {fmtShort(act.actualEndDate) && (
                          <span className="flex items-center gap-1">
                            <span>Fin:</span>
                            <strong style={{ color: tc.s }}>{fmtShort(act.actualEndDate)}</strong>
                          </span>
                        )}
                        {fmtShort(act.executionDate) && (
                          <span className="flex items-center gap-1">
                            <span>Ejec.:</span>
                            <strong style={{ color: '#a78bfa' }}>{fmtShort(act.executionDate)}</strong>
                          </span>
                        )}
                        {scheduledDays !== null && (
                          <span className="flex items-center gap-1">
                            <span>Días prog.:</span>
                            <strong style={{ color: '#60a5fa' }}>{scheduledDays}d</strong>
                          </span>
                        )}
                        {execDays !== null && (
                          <span className="flex items-center gap-1">
                            <span>Días ejec.:</span>
                            <strong style={{ color: execDays > (scheduledDays ?? execDays) ? '#f87171' : '#34d399' }}>
                              {execDays}d
                            </strong>
                          </span>
                        )}
                        {agentName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>Agente:</span>
                            <strong style={{ color: tc.s }}>{agentName}</strong>
                          </span>
                        )}
                        {clientName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>Cliente:</span>
                            <strong style={{ color: tc.s }}>{clientName}</strong>
                          </span>
                        )}
                        {act.status === 'completado' && agentName && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399' }}>
                            <CheckCircle2 className="w-3 h-3" /> Ejecutó: {agentName}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}


              {/* Botón agregar actividad */}
              {can('activities.manage') && (
                <div className="px-4 py-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <button onClick={() => setAddModal(true)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.20)' }}>
                    <Plus className="w-3.5 h-3.5" /> Agregar actividad
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ActivityModal
        activity={selected}
        users={users}
        clientStaff={clientStaff}
        onClose={() => setSelected(null)}
        onSaved={() => { onActivityUpdate(); setSelected(null); }}
        tc={tc}
      />

      {addModal && (
        <AddActivityModal
          phaseId={phase.id}
          users={users}
          clientStaff={clientStaff}
          tc={tc}
          onClose={() => setAddModal(false)}
          onAdded={() => { setAddModal(false); onActivityAdded(); }}
        />
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can } = usePermission();

  const [project, setProject]   = useState<Project | null>(null);
  const [loading, setLoading]   = useState(true);
  const [activeModIdx, setActiveModIdx] = useState(0);
  const [filterStatus, setFilterStatus] = useState<ActivityStatus | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkNote, setBulkNote] = useState('');
  const [now, setNow] = useState(() => new Date());

  // Listas para responsables
  const [users, setUsers]               = useState<UserType[]>([]);
  const [clientStaff, setClientStaff]   = useState<ClientStaff[]>([]);

  // Status modal
  const [statusModal, setStatusModal]       = useState(false);
  const [newStatus, setNewStatus]           = useState<ProjectStatus>('activo');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Cargar plantilla modal (wizard 2 pasos)
  const [tplModal, setTplModal]         = useState(false);
  const [tplStep, setTplStep]           = useState<1 | 2>(1);
  const [tplList, setTplList]           = useState<TemplateFlow[]>([]);
  const [selTpl, setSelTpl]             = useState('');
  const [tplModules, setTplModules]     = useState<{
    id: string; name: string;
    phases: { id: string; name: string; color?: string }[];
  }[]>([]);
  const [phaseDates, setPhaseDates]         = useState<Record<string, { startDate: string; endDate: string }>>({});
  const [tplExcludedIds, setTplExcludedIds] = useState<Set<string>>(new Set());
  const [loadingTpl, setLoadingTpl]         = useState(false);

  // Agregar módulos modal (wizard 2 pasos)
  const [addModModal, setAddModModal]       = useState(false);
  const [addModStep, setAddModStep]         = useState<1 | 2>(1);
  const [addModSelTpl, setAddModSelTpl]     = useState('');
  const [addModules, setAddModules]         = useState<{
    id: string; name: string;
    phases: { id: string; name: string; color?: string }[];
  }[]>([]);
  const [addModSelected, setAddModSelected] = useState<Set<string>>(new Set());
  const [addModPhDates, setAddModPhDates]   = useState<Record<string, {
    startDate: string; endDate: string; agentLeaderId: string; clientLeaderId: string;
  }>>({});
  const [addModAgents, setAddModAgents]         = useState<UserType[]>([]);
  const [addModStaff, setAddModStaff]           = useState<ClientStaff[]>([]);
  const [loadingAddMod, setLoadingAddMod]       = useState(false);

  // Eliminar módulo
  const [deleteModuleId, setDeleteModuleId]     = useState<string | null>(null);
  const [deleteModuleName, setDeleteModuleName] = useState('');
  const [deletingModule, setDeletingModule]     = useState(false);

  // Eliminar proyecto
  const [deleteModal, setDeleteModal]   = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [actaCount, setActaCount]       = useState(0);

  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  const cardStyle = {
    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.10)'}`,
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: isLight ? '0 8px 32px rgba(30,60,120,0.14)' : '0 8px 32px rgba(0,0,0,0.30)',
    borderRadius: '1rem',
    padding: '1.25rem',
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await projectsApi.get(id);
      setProject(data);

      // Cargar usuarios, staff del cliente y conteo de actas en paralelo
      const [usersRes, staffRes, actasRes] = await Promise.all([
        usersApi.listAgents({ limit: 200 }),
        data.serviceOrder?.client?.id
          ? clientsApi.getStaff(data.serviceOrder.client.id)
          : Promise.resolve([]),
        actasApi.list(data.id).catch(() => []),
      ]);
      setUsers(usersRes.data);
      setClientStaff(staffRes as any[]);
      setActaCount(Array.isArray(actasRes) ? actasRes.length : 0);
    } catch { toast.error('Error al cargar el proyecto'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const handleStatusSave = async () => {
    if (!project) return;
    setUpdatingStatus(true);
    try {
      await projectsApi.updateStatus(project.id, newStatus);
      toast.success('Estado actualizado');
      setStatusModal(false);
      load();
    } catch { toast.error('Error al actualizar estado'); }
    finally { setUpdatingStatus(false); }
  };

  const openTplModal = async () => {
    if (!tplList.length) {
      const res = await templatesApi.list({ limit: 100 });
      setTplList(res.data);
    }
    setSelTpl('');
    setTplStep(1);
    setTplModules([]);
    setPhaseDates({});
    setTplExcludedIds(new Set());
    setTplModal(true);
  };

  const handleTplNext = async () => {
    if (!selTpl) { toast.error('Selecciona una plantilla'); return; }
    try {
      const tpl = await templatesApi.get(selTpl);
      const mods = (tpl.modules ?? []).map((m: any) => ({
        id: m.id, name: m.name,
        phases: (m.phases ?? []).map((p: any) => ({ id: p.id, name: p.name, color: p.color })),
      }));
      setTplModules(mods);
      const init: Record<string, { startDate: string; endDate: string }> = {};
      mods.forEach((m: any) => m.phases.forEach((p: any) => { init[p.id] = { startDate: '', endDate: '' }; }));
      setPhaseDates(init);
      setTplStep(2);
    } catch { toast.error('Error al cargar módulos de la plantilla'); }
  };

  const handleLoadTemplate = async () => {
    if (!selTpl || !project) return;
    setLoadingTpl(true);
    try {
      const phDates = Object.entries(phaseDates)
        .filter(([, v]) => v.startDate || v.endDate)
        .map(([templatePhaseId, v]) => ({
          templatePhaseId,
          startDate: v.startDate || undefined,
          endDate: v.endDate || undefined,
        }));
      await projectsApi.loadTemplate(project.id, {
        templateFlowId:    selTpl,
        phaseDates:        phDates.length ? phDates : undefined,
        excludedModuleIds: tplExcludedIds.size ? Array.from(tplExcludedIds) : undefined,
      });
      toast.success('Plantilla cargada correctamente');
      setTplModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al cargar plantilla');
    } finally { setLoadingTpl(false); }
  };

  // ── Wizard: Agregar módulos ───────────────────────────────────────────────
  const openAddModModal = async () => {
    if (!tplList.length) {
      const res = await templatesApi.list({ limit: 100 });
      setTplList(res.data);
    }
    setAddModSelTpl('');
    setAddModStep(1);
    setAddModules([]);
    setAddModSelected(new Set());
    setAddModPhDates({});
    setAddModModal(true);
  };

  const handleAddModNext = async () => {
    if (!addModSelTpl) { toast.error('Selecciona una plantilla'); return; }
    try {
      const [tpl, agentsRes, staffRes] = await Promise.all([
        templatesApi.get(addModSelTpl),
        addModAgents.length ? Promise.resolve({ data: addModAgents }) : usersApi.listAgents({ limit: 200 }),
        project?.serviceOrder?.client?.id && !addModStaff.length
          ? clientsApi.getStaff(project.serviceOrder.client.id)
          : Promise.resolve(addModStaff),
      ]);
      if (!addModAgents.length) setAddModAgents((agentsRes as any).data);
      if (!addModStaff.length) {
        const staffList = Array.isArray(staffRes) ? staffRes : (staffRes as any).data ?? [];
        setAddModStaff(staffList.filter((s: any) => s.isProjectLeader));
      }
      const mods = (tpl.modules ?? []).map((m: any) => ({
        id: m.id, name: m.name,
        phases: (m.phases ?? []).map((p: any) => ({ id: p.id, name: p.name, color: p.color })),
      }));
      setAddModules(mods);
      // Por defecto todos seleccionados
      setAddModSelected(new Set(mods.map((m: any) => m.id)));
      const init: Record<string, { startDate: string; endDate: string; agentLeaderId: string; clientLeaderId: string }> = {};
      mods.forEach((m: any) => m.phases.forEach((p: any) => {
        init[p.id] = { startDate: '', endDate: '', agentLeaderId: '', clientLeaderId: '' };
      }));
      setAddModPhDates(init);
      setAddModStep(2);
    } catch { toast.error('Error al cargar módulos de la plantilla'); }
  };

  const handleAddModules = async () => {
    if (!project || addModSelected.size === 0) { toast.error('Selecciona al menos un módulo'); return; }
    setLoadingAddMod(true);
    try {
      const phDates = Object.entries(addModPhDates).map(([templatePhaseId, v]) => ({
        templatePhaseId,
        startDate:      v.startDate      || undefined,
        endDate:        v.endDate        || undefined,
        agentLeaderId:  v.agentLeaderId  || undefined,
        clientLeaderId: v.clientLeaderId || undefined,
      }));
      await projectsApi.addModules(project.id, {
        templateFlowId:    addModSelTpl,
        selectedModuleIds: Array.from(addModSelected),
        phaseDates:        phDates,
      });
      toast.success('Módulos agregados correctamente');
      setAddModModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al agregar módulos');
    } finally { setLoadingAddMod(false); }
  };

  const handleDeleteModule = async () => {
    if (!deleteModuleId) return;
    setDeletingModule(true);
    try {
      await projectsApi.deleteModule(deleteModuleId);
      toast.success('Módulo eliminado');
      setDeleteModuleId(null);
      setActiveModIdx(0);
      load();
    } catch { toast.error('Error al eliminar el módulo'); }
    finally { setDeletingModule(false); }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await projectsApi.deleteProject(project.id);
      toast.success('Proyecto eliminado');
      router.push('/implementacion/proyectos');
    } catch { toast.error('Error al eliminar el proyecto'); }
    finally { setDeleting(false); }
  };

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#60a5fa' }} />
      </div>
    );
  }

  const modules = project.modules ?? [];
  const activeMod = modules[activeModIdx];
  const pct = Number(project.progressPercent) || 0;
  const stCfg = PROJECT_STATUS[project.status] ?? PROJECT_STATUS.activo;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Back */}
      <button onClick={() => router.push('/implementacion/proyectos')}
        className="flex items-center gap-2 text-sm transition-colors"
        style={{ color: tc.m }}>
        <ArrowLeft className="w-4 h-4" /> Volver a proyectos
      </button>

      {/* Header */}
      <div style={cardStyle}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="font-bold text-xl truncate" style={{ color: tc.p }}>{project.name}</h2>
              {can('projects.editar') ? (
                <button onClick={() => { setNewStatus(project.status); setStatusModal(true); }}
                  className="px-3 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition"
                  style={{ background: stCfg.bg, color: stCfg.color }}>
                  {stCfg.label} ▾
                </button>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: stCfg.bg, color: stCfg.color }}>
                  {stCfg.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap text-sm" style={{ color: tc.m }}>
              <span className="flex items-center gap-1">
                <ClipboardList className="w-3.5 h-3.5" />
                <Link href={`/implementacion/ordenes/${project.serviceOrder.id}`}
                  className="hover:underline" style={{ color: '#60a5fa' }}>
                  {project.serviceOrder.osNumber}
                </Link>
              </span>
              <span>{project.serviceOrder.client.businessName}</span>
              <span>{project.serviceOrder.product}</span>
              {project.templateFlow && (
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> {project.templateFlow.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:flex-shrink-0">
            <div className="mr-2">
              <p className="text-xs" style={{ color: tc.m }}>Progreso global</p>
              <p className="text-2xl font-bold" style={{ color: '#60a5fa' }}>{pct.toFixed(0)}%</p>
            </div>
            <Link href={`/implementacion/proyectos/${project.id}/actas`} title="Actas del proyecto"
              className="p-2 rounded-xl transition-colors flex items-center"
              style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.20)' }}>
              <FileText className="w-4 h-4" />
            </Link>
            {can('projects.editar') && (
              <button onClick={openAddModModal} title="Agregar módulos desde plantilla"
                className="p-2 rounded-xl transition-colors"
                style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.20)' }}>
                <Plus className="w-4 h-4" />
              </button>
            )}
            {can('projects.editar') && (
              <button onClick={openTplModal} title="Cargar/reemplazar plantilla"
                className="p-2 rounded-xl transition-colors"
                style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.20)' }}>
                <Upload className="w-4 h-4" />
              </button>
            )}
            {can('projects.editar') && (
              <button
                onClick={() => setDeleteModal(true)}
                title={actaCount > 0 ? `No se puede eliminar: tiene ${actaCount} acta${actaCount !== 1 ? 's' : ''} asociada${actaCount !== 1 ? 's' : ''}` : 'Eliminar proyecto'}
                disabled={actaCount > 0}
                className="p-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)' }}>
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={load} title="Refrescar" className="p-2 rounded-xl" style={{ color: tc.m }}>
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar pct={pct} color={stCfg.color} height={8} />
        </div>

        {(() => {
          const start      = new Date(project.startDate);
          const end        = new Date(project.endDate);
          const totalDays  = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
          const elapsed    = Math.round((now.getTime() - start.getTime()) / 86400000);
          const remaining  = Math.round((end.getTime() - now.getTime()) / 86400000);
          const notStarted = elapsed < 0;
          const overdue    = remaining < 0;
          const dayPct     = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));

          const remainingColor = overdue ? '#f87171' : remaining <= 7 ? '#fbbf24' : '#34d399';
          const remainingLabel = overdue
            ? `${Math.abs(remaining)} día${Math.abs(remaining) !== 1 ? 's' : ''} de retraso`
            : notStarted
            ? `Inicia en ${Math.abs(elapsed)} día${Math.abs(elapsed) !== 1 ? 's' : ''}`
            : `${remaining} día${remaining !== 1 ? 's' : ''} restantes`;

          return (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: tc.m }}>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Inicio: {start.toLocaleDateString('es-CO', { timeZone: 'UTC' })}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Fin: {end.toLocaleDateString('es-CO', { timeZone: 'UTC' })}
                </span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" /> {modules.length} módulo{modules.length !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  Día {Math.max(0, elapsed)} de {totalDays}
                </span>
                <span className="font-semibold px-2 py-0.5 rounded-full text-[11px]"
                  style={{ background: remainingColor + '18', color: remainingColor, border: `1px solid ${remainingColor}40` }}>
                  {remainingLabel}
                </span>
              </div>
              {/* Barra de tiempo */}
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${dayPct}%`, background: overdue ? '#f87171' : remaining <= 7 ? '#fbbf24' : '#34d399' }} />
                </div>
                <span className="text-[10px] font-mono shrink-0" style={{ color: tc.m }}>{dayPct}%</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Alerta: actas asociadas bloquean eliminación */}
      {actaCount > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)', color: '#fbbf24' }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-sm leading-snug">
            Este proyecto tiene <strong>{actaCount} acta{actaCount !== 1 ? 's' : ''} asociada{actaCount !== 1 ? 's' : ''}</strong> y no puede eliminarse.
            Para habilitarlo, elimina primero todas las actas desde la sección{' '}
            <Link href={`/implementacion/proyectos/${project.id}/actas`}
              className="underline font-semibold hover:opacity-80">
              Actas
            </Link>.
          </p>
        </div>
      )}

      {/* Contenido */}
      {modules.length === 0 ? (
        <div style={cardStyle} className="text-center py-12 space-y-4">
          <Upload className="w-10 h-10 mx-auto mb-2" style={{ color: '#60a5fa', opacity: 0.5 }} />
          <p className="font-semibold" style={{ color: tc.p }}>Este proyecto no tiene módulos aún</p>
          <p className="text-sm" style={{ color: tc.m }}>Carga una plantilla para generar la estructura del proyecto</p>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={openTplModal}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white font-semibold mx-auto">
            <Upload className="w-4 h-4" /> Cargar plantilla
          </motion.button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[220px_1fr]">
          {/* Panel izquierdo — módulos */}
          <div>
            {/* Mobile: tabs horizontales desplazables */}
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
              {modules.map((mod, idx) => {
                const modPct = Number(mod.progressPercent) || 0;
                const isActive = idx === activeModIdx;
                return (
                  <button key={mod.id}
                    onClick={() => setActiveModIdx(idx)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: isActive ? 'rgba(96,165,250,0.15)' : (isLight ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.04)'),
                      border: `1px solid ${isActive ? 'rgba(96,165,250,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      color: isActive ? '#60a5fa' : tc.s,
                    }}>
                    <span className="max-w-[120px] truncate">{mod.name}</span>
                    <span className="font-mono text-[10px] shrink-0" style={{ color: isActive ? '#60a5fa' : tc.m }}>
                      {modPct.toFixed(0)}%
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Desktop: cards verticales */}
            <div className="hidden lg:flex lg:flex-col gap-2">
              {modules.map((mod, idx) => {
                const modPct = Number(mod.progressPercent) || 0;
                const isActive = idx === activeModIdx;
                return (
                  <motion.div key={mod.id}
                    whileHover={{ scale: 1.01 }}
                    className="rounded-xl transition-all cursor-pointer"
                    style={{
                      background: isActive
                        ? 'rgba(96,165,250,0.12)'
                        : (isLight ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.04)'),
                      border: `1px solid ${isActive ? 'rgba(96,165,250,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      backdropFilter: 'blur(12px)',
                    }}
                    onClick={() => setActiveModIdx(idx)}>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-semibold truncate flex-1" style={{ color: isActive ? '#60a5fa' : tc.s }}>
                          {mod.name}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteModuleId(mod.id); setDeleteModuleName(mod.name); }}
                          style={{ color: '#f87171' }}
                          title="Eliminar módulo">
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] font-mono shrink-0" style={{ color: isActive ? '#60a5fa' : tc.m }}>
                          {modPct.toFixed(0)}%
                        </span>
                      </div>
                      <ProgressBar pct={modPct} color={isActive ? '#60a5fa' : '#6b82a0'} height={3} />
                      <p className="text-[10px] mt-1.5" style={{ color: tc.m }}>
                        {mod.phases.length} fase{mod.phases.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Panel derecho — fases y actividades */}
          <div className="space-y-3">
            {activeMod && (
              <>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h3 className="font-bold text-base" style={{ color: tc.p }}>{activeMod.name}</h3>
                  <span className="text-sm" style={{ color: tc.m }}>
                    {activeMod.phases.filter(p => p.status === 'completado').length} / {activeMod.phases.length} fases completadas
                  </span>
                </div>

                {/* Filtro por estado */}
                {(() => {
                  const allActs = activeMod.phases.flatMap(p => p.activities);
                  const counts: Record<string, number> = { pendiente: 0, en_progreso: 0, completado: 0, bloqueado: 0 };
                  allActs.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
                  const filters: { key: ActivityStatus | null; label: string }[] = [
                    { key: null,          label: 'Todas'       },
                    { key: 'pendiente',   label: 'Pendiente'   },
                    { key: 'en_progreso', label: 'En progreso' },
                    { key: 'completado',  label: 'Completado'  },
                    { key: 'bloqueado',   label: 'Bloqueado'   },
                  ];
                  return (
                    <div className="overflow-x-auto pb-0.5" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <div className="flex items-center gap-1.5 min-w-max">
                      {filters.map(({ key, label }) => {
                        const active = filterStatus === key;
                        const cfg = key ? ACTIVITY_STATUS[key] : null;
                        const count = key ? counts[key] : allActs.length;
                        return (
                          <button key={String(key)} onClick={() => setFilterStatus(key)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                            style={{
                              background: active
                                ? (cfg ? cfg.bg : 'rgba(96,165,250,0.15)')
                                : 'rgba(255,255,255,0.05)',
                              color: active
                                ? (cfg ? cfg.color : '#60a5fa')
                                : tc.m,
                              border: `1px solid ${active ? (cfg ? cfg.color + '50' : 'rgba(96,165,250,0.40)') : 'rgba(255,255,255,0.08)'}`,
                            }}>
                            {label}
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                              style={{
                                background: active
                                  ? (cfg ? cfg.color + '30' : 'rgba(96,165,250,0.25)')
                                  : 'rgba(255,255,255,0.08)',
                              }}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    </div>
                  );
                })()}

                {/* Botón selección múltiple */}
                {can('activities.manage') && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setBulkMode(m => !m); setBulkSelected(new Set()); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: bulkMode ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                        color: bulkMode ? '#34d399' : tc.m,
                        border: `1px solid ${bulkMode ? 'rgba(52,211,153,0.40)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      <CheckSquare className="w-3.5 h-3.5" />
                      {bulkMode ? `Seleccionando (${bulkSelected.size})` : 'Selección múltiple'}
                    </button>
                    {bulkMode && bulkSelected.size > 0 && (
                      <span className="text-xs" style={{ color: tc.m }}>{bulkSelected.size} actividad{bulkSelected.size !== 1 ? 'es' : ''} seleccionada{bulkSelected.size !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                )}

                {activeMod.phases.length === 0 ? (
                  <div style={{ ...cardStyle, textAlign: 'center' }}>
                    <p style={{ color: tc.m }}>Sin fases definidas</p>
                  </div>
                ) : (
                  activeMod.phases.map(phase => (
                    <PhaseRow
                      key={phase.id}
                      phase={phase}
                      tc={tc}
                      users={users}
                      clientStaff={clientStaff}
                      filterStatus={filterStatus}
                      onActivityUpdate={load}
                      onActivityAdded={load}
                      bulkMode={bulkMode}
                      bulkSelected={bulkSelected}
                      onBulkToggle={(id) => setBulkSelected(prev => {
                        const n = new Set(prev);
                        n.has(id) ? n.delete(id) : n.add(id);
                        return n;
                      })}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating bulk action bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 px-4 py-3 rounded-2xl shadow-2xl"
          style={{ background: '#0f172a', border: '1px solid rgba(96,165,250,0.35)', backdropFilter: 'blur(12px)', minWidth: 420 }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold shrink-0" style={{ color: '#60a5fa' }}>
              {bulkSelected.size} seleccionada{bulkSelected.size !== 1 ? 's' : ''}
            </span>
            <span className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.30)' }}>→ Cambiar a:</span>
            {([
              { s: 'pendiente',   label: 'Pendiente',   color: '#94a3b8' },
              { s: 'en_progreso', label: 'En progreso', color: '#60a5fa' },
              { s: 'completado',  label: 'Completado',  color: '#34d399' },
            ] as const).map(({ s, label, color }) => (
              <button key={s} disabled={bulkApplying}
                onClick={async () => {
                  setBulkApplying(true);
                  try {
                    await projectsApi.bulkUpdateStatus(Array.from(bulkSelected), s, bulkNote.trim() || undefined);
                    toast.success(`${bulkSelected.size} actividades → ${label}`);
                    setBulkSelected(new Set());
                    setBulkMode(false);
                    setBulkNote('');
                    load();
                  } catch { toast.error('Error al actualizar actividades'); }
                  finally { setBulkApplying(false); }
                }}
                className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all disabled:opacity-50"
                style={{ background: color + '20', color, border: `1px solid ${color}50` }}>
                {bulkApplying ? '...' : label}
              </button>
            ))}
            <button onClick={() => { setBulkSelected(new Set()); setBulkMode(false); setBulkNote(''); }}
              className="ml-auto text-xs px-2 py-1.5 rounded-full"
              style={{ color: 'rgba(255,255,255,0.40)', border: '1px solid rgba(255,255,255,0.10)' }}>
              ✕ Cancelar
            </button>
          </div>
          <textarea
            rows={2}
            placeholder="Nota del cambio (opcional) — se registra individualmente en cada actividad"
            value={bulkNote}
            onChange={e => setBulkNote(e.target.value)}
            className="text-xs rounded-lg px-3 py-2 resize-none w-full"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', outline: 'none' }}
          />
        </div>
      )}

      {/* Modal: Agregar módulos — wizard 2 pasos */}
      <Modal open={addModModal} onClose={() => { setAddModModal(false); setAddModStep(1); }}
        title={addModStep === 1 ? 'Agregar módulos al proyecto' : 'Configurar fechas y responsables'}
        width="max-w-2xl">
        {addModStep === 1 ? (
          <div className="space-y-4">
            {/* Indicador de pasos */}
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="px-2 py-0.5 rounded-full text-white text-[11px] font-bold" style={{ background: 'rgba(52,211,153,0.8)' }}>1</span>
              <span>Seleccionar plantilla</span>
              <span className="flex-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>2</span>
              <span>Fechas y responsables</span>
            </div>
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.20)', color: '#34d399' }}>
              ✦ Los módulos seleccionados se agregarán al proyecto sin afectar los módulos existentes.
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Plantilla <span className="text-red-400 normal-case">*</span>
              </label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={addModSelTpl} onChange={e => setAddModSelTpl(e.target.value)}>
                <option value="">Seleccionar plantilla...</option>
                {tplList.map(t => <option key={t.id} value={t.id}>{t.name} v{t.version}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setAddModModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={handleAddModNext}
                className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold"
                style={{ background: 'rgba(52,211,153,0.8)' }}>
                Siguiente →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Indicador de pasos */}
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>1</span>
              <span>Seleccionar plantilla</span>
              <span className="flex-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
              <span className="px-2 py-0.5 rounded-full text-white text-[11px] font-bold" style={{ background: 'rgba(52,211,153,0.8)' }}>2</span>
              <span>Fechas y responsables</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Selecciona los módulos a agregar y configura las fechas y responsables de cada fase.
            </p>
            {addModules.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: tc.m }}>Esta plantilla no tiene módulos.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {addModules.map((mod, mi) => {
                  const included = addModSelected.has(mod.id);
                  return (
                    <div key={mod.id} className="rounded-xl overflow-hidden transition-all"
                      style={{ border: `1px solid ${included ? 'rgba(52,211,153,0.30)' : 'rgba(255,255,255,0.08)'}`, opacity: included ? 1 : 0.45 }}>
                      {/* Header módulo con toggle */}
                      <div className="px-3 py-2 flex items-center gap-2"
                        style={{ background: included ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)' }}>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                          MOD-{String(mi + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-semibold flex-1" style={{ color: tc.p }}>{mod.name}</span>
                        <span className="text-xs mr-2" style={{ color: tc.m }}>{mod.phases.length} fase{mod.phases.length !== 1 ? 's' : ''}</span>
                        <button
                          onClick={() => setAddModSelected(prev => {
                            const next = new Set(prev);
                            next.has(mod.id) ? next.delete(mod.id) : next.add(mod.id);
                            return next;
                          })}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                          style={{
                            background: included ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.08)',
                            color: included ? '#34d399' : tc.m,
                            border: `1px solid ${included ? 'rgba(52,211,153,0.30)' : 'rgba(255,255,255,0.12)'}`,
                          }}>
                          {included ? '✓ Incluir' : '✗ Excluir'}
                        </button>
                      </div>
                      {/* Fases del módulo */}
                      {included && mod.phases.length > 0 && (
                        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                          {mod.phases.map((ph, pi) => (
                            <div key={ph.id} className="px-3 py-3">
                              <div className="flex items-center gap-2 mb-2.5">
                                {ph.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ph.color }} />}
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                                  FSE-{String(pi + 1).padStart(2, '0')}
                                </span>
                                <span className="text-xs font-medium" style={{ color: tc.s }}>{ph.name}</span>
                              </div>
                              {/* Fechas */}
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                  <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Inicio</label>
                                  <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                    value={addModPhDates[ph.id]?.startDate ?? ''}
                                    onChange={e => setAddModPhDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], startDate: e.target.value } }))} />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fin</label>
                                  <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                    value={addModPhDates[ph.id]?.endDate ?? ''}
                                    onChange={e => setAddModPhDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], endDate: e.target.value } }))} />
                                </div>
                              </div>
                              {/* Responsables */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Responsable agente</label>
                                  <select className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                    value={addModPhDates[ph.id]?.agentLeaderId ?? ''}
                                    onChange={e => setAddModPhDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], agentLeaderId: e.target.value } }))}>
                                    <option value="">Sin asignar</option>
                                    {addModAgents.map(u => (
                                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Responsable cliente</label>
                                  <select className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                    value={addModPhDates[ph.id]?.clientLeaderId ?? ''}
                                    onChange={e => setAddModPhDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], clientLeaderId: e.target.value } }))}>
                                    <option value="">Sin asignar</option>
                                    {addModStaff.map(s => (
                                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setAddModStep(1)}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                ← Atrás
              </button>
              <button onClick={handleAddModules} disabled={loadingAddMod || addModSelected.size === 0}
                className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50"
                style={{ background: 'rgba(52,211,153,0.8)' }}>
                {loadingAddMod ? 'Agregando...' : `Agregar ${addModSelected.size} módulo${addModSelected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Cargar plantilla — wizard 2 pasos */}
      <Modal open={tplModal} onClose={() => { setTplModal(false); setTplStep(1); setPhaseDates({}); }}
        title={tplStep === 1 ? 'Cargar plantilla al proyecto' : 'Asignar fechas por fase'}
        width="max-w-lg">
        {tplStep === 1 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="px-2 py-0.5 rounded-full text-white text-[11px] font-bold" style={{ background: 'rgba(96,165,250,0.8)' }}>1</span>
              <span>Seleccionar plantilla</span>
              <span className="flex-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>2</span>
              <span>Fechas por fase</span>
            </div>
            {modules.length > 0 && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                ⚠ Esta acción reemplazará los {modules.length} módulo(s) actuales y reiniciará el progreso a 0%.
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Plantilla <span className="text-red-400 normal-case">*</span>
              </label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={selTpl} onChange={e => setSelTpl(e.target.value)}>
                <option value="">Seleccionar plantilla...</option>
                {tplList.map(t => <option key={t.id} value={t.id}>{t.name} v{t.version}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setTplModal(false); setTplStep(1); }}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={handleTplNext}
                className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold">
                Siguiente →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>1</span>
              <span>Seleccionar plantilla</span>
              <span className="flex-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
              <span className="px-2 py-0.5 rounded-full text-white text-[11px] font-bold" style={{ background: 'rgba(96,165,250,0.8)' }}>2</span>
              <span>Fechas por fase</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Asigna fechas de inicio y fin a cada fase. Las actividades de esa fase heredarán las mismas fechas.
            </p>
            {tplModules.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: tc.m }}>Esta plantilla no tiene módulos.</p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {tplModules.map((mod, mi) => {
                  const excluded = tplExcludedIds.has(mod.id);
                  return (
                    <div key={mod.id} className="rounded-xl overflow-hidden transition-all"
                      style={{ border: `1px solid ${excluded ? 'rgba(255,255,255,0.07)' : 'rgba(96,165,250,0.25)'}`, opacity: excluded ? 0.45 : 1 }}>
                      <div className="px-3 py-2 flex items-center gap-2"
                        style={{ background: excluded ? 'rgba(255,255,255,0.03)' : (isLight ? 'rgba(96,165,250,0.10)' : 'rgba(96,165,250,0.08)') }}>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(96,165,250,0.20)', color: '#60a5fa' }}>
                          MOD-{String(mi + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-semibold flex-1" style={{ color: tc.p }}>{mod.name}</span>
                        <span className="text-xs mr-2" style={{ color: tc.m }}>
                          {mod.phases.length} fase{mod.phases.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={() => setTplExcludedIds(prev => {
                            const next = new Set(prev);
                            next.has(mod.id) ? next.delete(mod.id) : next.add(mod.id);
                            return next;
                          })}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                          style={{
                            background: excluded ? 'rgba(248,113,113,0.12)' : 'rgba(96,165,250,0.15)',
                            color: excluded ? '#f87171' : '#60a5fa',
                            border: `1px solid ${excluded ? 'rgba(248,113,113,0.30)' : 'rgba(96,165,250,0.30)'}`,
                          }}>
                          {excluded ? '✗ Excluido' : '✓ Incluido'}
                        </button>
                      </div>
                      {!excluded && (mod.phases.length === 0 ? (
                        <p className="px-3 py-2 text-xs" style={{ color: tc.m }}>Sin fases</p>
                      ) : (
                        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                          {mod.phases.map((ph, pi) => (
                            <div key={ph.id} className="px-3 py-2.5">
                              <div className="flex items-center gap-2 mb-2">
                                {ph.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ph.color }} />}
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                                  FSE-{String(pi + 1).padStart(2, '0')}
                                </span>
                                <span className="text-xs font-medium" style={{ color: tc.s }}>{ph.name}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Inicio</label>
                                  <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                    value={phaseDates[ph.id]?.startDate ?? ''}
                                    onChange={e => setPhaseDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], startDate: e.target.value } }))} />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fin</label>
                                  <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                    value={phaseDates[ph.id]?.endDate ?? ''}
                                    onChange={e => setPhaseDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], endDate: e.target.value } }))} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setTplStep(1)}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                ← Atrás
              </button>
              <button onClick={handleLoadTemplate} disabled={loadingTpl}
                className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
                {loadingTpl
                  ? 'Cargando...'
                  : `Cargar ${tplModules.length - tplExcludedIds.size} módulo${tplModules.length - tplExcludedIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Confirmar eliminación de módulo */}
      <Modal open={!!deleteModuleId} onClose={() => setDeleteModuleId(null)} title="Eliminar módulo" width="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: tc.s }}>
            ¿Eliminar el módulo <strong style={{ color: tc.p }}>{deleteModuleName}</strong>?
            Se eliminarán todas sus fases y actividades. Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setDeleteModuleId(null)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleDeleteModule} disabled={deletingModule}
              className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50"
              style={{ background: '#ef4444' }}>
              {deletingModule ? 'Eliminando...' : 'Eliminar módulo'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar eliminación */}
      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Eliminar proyecto" width="max-w-sm">
        <div className="space-y-4">
          {actaCount > 0 ? (
            <>
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)', color: '#fbbf24' }}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-sm leading-snug">
                  No se puede eliminar este proyecto porque tiene <strong>{actaCount} acta{actaCount !== 1 ? 's' : ''} asociada{actaCount !== 1 ? 's' : ''}</strong>.
                  Elimina todas las actas primero desde la sección de actas del proyecto.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setDeleteModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm"
                  style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  Entendido
                </button>
                <Link href={`/implementacion/proyectos/${project.id}/actas`}
                  onClick={() => setDeleteModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold text-center"
                  style={{ background: '#f59e0b' }}>
                  Ver actas
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm" style={{ color: tc.s }}>
                ¿Estás seguro de que deseas eliminar el proyecto <strong style={{ color: tc.p }}>{project?.name}</strong>?
                Esta acción eliminará todos los módulos, fases y actividades del proyecto.
              </p>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setDeleteModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm"
                  style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  Cancelar
                </button>
                <button onClick={handleDeleteProject} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50"
                  style={{ background: '#ef4444' }}>
                  {deleting ? 'Eliminando...' : 'Eliminar proyecto'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal: Cambio de estado */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Cambiar estado del proyecto" width="max-w-sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(PROJECT_STATUS) as [ProjectStatus, any][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setNewStatus(key)}
                className="py-2.5 rounded-xl text-sm font-semibold transition-all border"
                style={{
                  background: newStatus === key ? cfg.bg : 'transparent',
                  color: newStatus === key ? cfg.color : tc.m,
                  borderColor: newStatus === key ? cfg.color + '60' : 'var(--border-subtle)',
                }}>
                {cfg.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStatusModal(false)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleStatusSave} disabled={updatingStatus}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {updatingStatus ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
