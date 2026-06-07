'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  ArrowLeft, RefreshCw, CheckCircle2, Circle, Clock, AlertCircle,
  ChevronDown, Layers, Calendar, ClipboardList, Pencil, Check,
  MessageSquare, Send, Trash2, Upload, Plus, User,
} from 'lucide-react';
import Link from 'next/link';
import { projectsApi, templatesApi, usersApi, clientsApi } from '@/lib/api';
import type { TemplateFlow, User as UserType, ClientStaff } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import type { Project, ProjectPhase, ProjectActivity, ActivityStatus, ProjectStatus, ActivityThread } from '@/types';

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

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtShort = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : null;

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
    plannedStartDate: '', plannedEndDate: '',
    actualStartDate: '', actualEndDate: '',
    assignedToId: '', clientStaffId: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      await projectsApi.addActivity(phaseId, {
        name: form.name.trim(),
        description: form.description || undefined,
        priority: form.priority || undefined,
        plannedHours: form.plannedHours ? Number(form.plannedHours) : undefined,
        plannedStartDate: form.plannedStartDate || undefined,
        plannedEndDate: form.plannedEndDate || undefined,
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
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fechas planeadas</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Inicio</label>
              <input type="date" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                value={form.plannedStartDate} onChange={e => set('plannedStartDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Fin</label>
              <input type="date" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                value={form.plannedEndDate} onChange={e => set('plannedEndDate', e.target.value)} />
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fechas reales</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Inicio</label>
              <input type="date" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                value={form.actualStartDate} onChange={e => set('actualStartDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Fin</label>
              <input type="date" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                value={form.actualEndDate} onChange={e => set('actualEndDate', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Responsable (agente)</label>
            <select className="input-glass w-full rounded-xl px-3 py-2 text-sm"
              value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)}>
              <option value="">Sin asignar</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Responsable (cliente)</label>
            <select className="input-glass w-full rounded-xl px-3 py-2 text-sm"
              value={form.clientStaffId} onChange={e => set('clientStaffId', e.target.value)}>
              <option value="">Sin asignar</option>
              {clientStaff.map((s: any) => (
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

  const [threads, setThreads]                 = useState<ActivityThread[]>([]);
  const [loadingThreads, setLoadingThreads]   = useState(false);
  const [newThread, setNewThread]             = useState('');
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

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!activity) return;
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
      const thread = await templatesApi.addThread(activity.id, newThread.trim());
      setThreads(prev => [...prev, thread]);
      setNewThread('');
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
                    <button key={key} onClick={() => set('status', key)}
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

            {/* Fechas planeadas */}
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fechas planeadas</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Inicio</label>
                  <input type="date" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                    value={form.plannedStartDate} onChange={e => set('plannedStartDate', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Fin</label>
                  <input type="date" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                    value={form.plannedEndDate} onChange={e => set('plannedEndDate', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Fechas reales */}
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fechas reales</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Inicio</label>
                  <input type="date" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                    value={form.actualStartDate} onChange={e => set('actualStartDate', e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Fin</label>
                  <input type="date" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                    value={form.actualEndDate} onChange={e => set('actualEndDate', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Fecha ejecución */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fecha de ejecución</label>
              <input type="date" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
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
                  {clientStaff.map(s => (
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
                          <span className="text-xs font-semibold" style={{ color: tc.s }}>
                            {thread.author.firstName} {thread.author.lastName}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px]" style={{ color: tc.m }}>{date}</span>
                            <button onClick={() => handleDeleteThread(thread.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                              style={{ color: '#f87171' }}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: tc.p }}>{thread.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
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
        )}
      </div>
    </Modal>
  );
}

// ── Componente de fase ─────────────────────────────────────────────────────

function PhaseRow({ phase, tc, users, clientStaff, onActivityUpdate, onActivityAdded }: {
  phase: ProjectPhase;
  tc: any;
  users: UserType[];
  clientStaff: ClientStaff[];
  onActivityUpdate: () => void;
  onActivityAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProjectActivity | null>(null);
  const [addModal, setAddModal] = useState(false);
  const cfg = ACTIVITY_STATUS[phase.status as ActivityStatus] ?? ACTIVITY_STATUS.pendiente;
  const pct = Number(phase.progressPercent) || 0;

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
              {phase.activities.length === 0 ? (
                <p className="px-4 py-3 text-sm text-center" style={{ color: tc.m }}>Sin actividades</p>
              ) : (
                phase.activities.map((act, i) => {
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

                      {/* Fila 1: status, code, name, priority, progress, edit */}
                      <div className="flex items-center gap-3">
                        <AIcon className="w-4 h-4 shrink-0" style={{ color: aCfg.color }} />
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: 'rgba(96,165,250,0.08)', color: '#60a5fa' }}>
                          {act.code}
                        </span>
                        <span className="flex-1 text-sm truncate" style={{ color: tc.s }}>{act.name}</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: prio.bg, color: prio.color }}>
                          {act.priority}
                        </span>
                        <div className="w-14 shrink-0">
                          <span className="text-[10px] block text-right mb-0.5" style={{ color: tc.m }}>{actPct.toFixed(0)}%</span>
                          <ProgressBar pct={actPct} color={aCfg.color} height={3} />
                        </div>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={() => setSelected(act)}
                          className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                          style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.20)' }}>
                          <Pencil className="w-3 h-3" /> Editar
                        </motion.button>
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
              <div className="px-4 py-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <button onClick={() => setAddModal(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.20)' }}>
                  <Plus className="w-3.5 h-3.5" /> Agregar actividad
                </button>
              </div>
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

  const [project, setProject]   = useState<Project | null>(null);
  const [loading, setLoading]   = useState(true);
  const [activeModIdx, setActiveModIdx] = useState(0);

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
  const [phaseDates, setPhaseDates]     = useState<Record<string, { startDate: string; endDate: string }>>({});
  const [loadingTpl, setLoadingTpl]     = useState(false);

  // Eliminar proyecto
  const [deleteModal, setDeleteModal]   = useState(false);
  const [deleting, setDeleting]         = useState(false);

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

      // Cargar usuarios y staff del cliente (para dropdowns de responsable)
      const [usersRes, staffRes] = await Promise.all([
        usersApi.list({ limit: 200, userType: 'agent' }),
        data.serviceOrder?.client?.id
          ? clientsApi.getStaff(data.serviceOrder.client.id)
          : Promise.resolve([]),
      ]);
      setUsers(usersRes.data);
      setClientStaff(staffRes as any[]);
    } catch { toast.error('Error al cargar el proyecto'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
        templateFlowId: selTpl,
        phaseDates: phDates.length ? phDates : undefined,
      });
      toast.success('Plantilla cargada correctamente');
      setTplModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al cargar plantilla');
    } finally { setLoadingTpl(false); }
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
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h2 className="font-bold text-xl truncate" style={{ color: tc.p }}>{project.name}</h2>
              <button onClick={() => { setNewStatus(project.status); setStatusModal(true); }}
                className="px-3 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition"
                style={{ background: stCfg.bg, color: stCfg.color }}>
                {stCfg.label} ▾
              </button>
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

          <div className="flex items-center gap-2">
            <div className="text-right mr-2">
              <p className="text-xs" style={{ color: tc.m }}>Progreso global</p>
              <p className="text-2xl font-bold" style={{ color: '#60a5fa' }}>{pct.toFixed(0)}%</p>
            </div>
            <button onClick={openTplModal} title="Cargar/reemplazar plantilla"
              className="p-2 rounded-xl transition-colors"
              style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.20)' }}>
              <Upload className="w-4 h-4" />
            </button>
            <button onClick={() => setDeleteModal(true)} title="Eliminar proyecto"
              className="p-2 rounded-xl transition-colors"
              style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)' }}>
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={load} title="Refrescar" className="p-2 rounded-xl" style={{ color: tc.m }}>
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar pct={pct} color={stCfg.color} height={8} />
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: tc.m }}>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Inicio: {new Date(project.startDate).toLocaleDateString('es-CO')}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Fin: {new Date(project.endDate).toLocaleDateString('es-CO')}</span>
          <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {modules.length} módulo{modules.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

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
        <div className="grid grid-cols-[220px_1fr] gap-4">
          {/* Panel izquierdo — módulos */}
          <div className="space-y-2">
            {modules.map((mod, idx) => {
              const modPct = Number(mod.progressPercent) || 0;
              const isActive = idx === activeModIdx;
              return (
                <motion.button key={mod.id} onClick={() => setActiveModIdx(idx)}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  className="w-full text-left p-3 rounded-xl transition-all"
                  style={{
                    background: isActive
                      ? 'rgba(96,165,250,0.12)'
                      : (isLight ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.04)'),
                    border: `1px solid ${isActive ? 'rgba(96,165,250,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    backdropFilter: 'blur(12px)',
                  }}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold truncate" style={{ color: isActive ? '#60a5fa' : tc.s }}>
                      {mod.name}
                    </span>
                    <span className="text-[10px] font-mono shrink-0" style={{ color: isActive ? '#60a5fa' : tc.m }}>
                      {modPct.toFixed(0)}%
                    </span>
                  </div>
                  <ProgressBar pct={modPct} color={isActive ? '#60a5fa' : '#6b82a0'} height={3} />
                  <p className="text-[10px] mt-1.5" style={{ color: tc.m }}>
                    {mod.phases.length} fase{mod.phases.length !== 1 ? 's' : ''}
                  </p>
                </motion.button>
              );
            })}
          </div>

          {/* Panel derecho — fases y actividades */}
          <div className="space-y-3">
            {activeMod && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base" style={{ color: tc.p }}>{activeMod.name}</h3>
                  <span className="text-sm" style={{ color: tc.m }}>
                    {activeMod.phases.filter(p => p.status === 'completado').length} / {activeMod.phases.length} fases completadas
                  </span>
                </div>
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
                      onActivityUpdate={load}
                      onActivityAdded={load}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}

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
                {tplModules.map((mod, mi) => (
                  <div key={mod.id} className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                    <div className="px-3 py-2 flex items-center gap-2"
                      style={{ background: isLight ? 'rgba(96,165,250,0.10)' : 'rgba(96,165,250,0.08)' }}>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(96,165,250,0.20)', color: '#60a5fa' }}>
                        MOD-{String(mi + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: tc.p }}>{mod.name}</span>
                      <span className="text-xs ml-auto" style={{ color: tc.m }}>
                        {mod.phases.length} fase{mod.phases.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {mod.phases.length === 0 ? (
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
                                <input type="date" className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                  value={phaseDates[ph.id]?.startDate ?? ''}
                                  onChange={e => setPhaseDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], startDate: e.target.value } }))} />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fin</label>
                                <input type="date" className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                  value={phaseDates[ph.id]?.endDate ?? ''}
                                  onChange={e => setPhaseDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], endDate: e.target.value } }))} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
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
                {loadingTpl ? 'Cargando...' : 'Cargar plantilla'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Confirmar eliminación */}
      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Eliminar proyecto" width="max-w-sm">
        <div className="space-y-4">
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
