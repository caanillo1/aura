'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  CheckSquare, RefreshCw, Search, X, ChevronDown, ChevronRight,
  Clock, CheckCircle2, Loader2, Ban, AlertTriangle,
  User, Building2, Layers, GitBranch, Activity,
  List, Kanban, Users, LayoutGrid, PieChart,
  FileDown, Mail,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as ReTooltip, Cell,
} from 'recharts';
import { projectsApi, clientsApi } from '@/lib/api';
import type { GlobalActivity } from '@/types';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import relativeTime from 'dayjs/plugin/relativeTime';
import AutomationModal from './components/AutomationModal';
dayjs.locale('es');
dayjs.extend(relativeTime);

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function getRawDate(a: { threads: { createdAt: string }[]; executionDate: string | null; updatedAt: string }): string {
  return a.threads[0]?.createdAt ?? a.executionDate ?? a.updatedAt;
}

function displayDate(a: { threads: { createdAt: string }[]; executionDate: string | null; updatedAt: string }): string {
  return dayjs(getRawDate(a)).fromNow();
}

function displayDateLabel(a: { threads: { createdAt: string }[]; executionDate: string | null }): string {
  if (a.threads[0]?.createdAt) return 'Hilo';
  return a.executionDate ? 'Ejecución' : 'Actualizado';
}

function resolveImplementor(a: GlobalActivity): string {
  if (a.assignedTo) return `${a.assignedTo.firstName} ${a.assignedTo.lastName}`;
  if (a.threads?.[0]?.author) {
    const au = a.threads[0].author;
    return `${au.firstName} ${au.lastName}`;
  }
  if (a.clientStaff) return `${a.clientStaff.firstName} ${a.clientStaff.lastName}`;
  return 'Sin asignar';
}

type DatePreset = 'all' | 'today' | 'yesterday' | 'last7' | 'month' | 'custom';
type ViewMode = 'lista' | 'kanban' | 'empresa' | 'implementador' | 'tarjetas' | 'resumen';

interface DateRange { from: string; to: string }

function presetToRange(preset: DatePreset, custom: DateRange): DateRange {
  const today = dayjs().format('YYYY-MM-DD');
  if (preset === 'all')       return { from: '', to: '' };
  if (preset === 'today')     return { from: today, to: today };
  if (preset === 'yesterday') { const y = dayjs().subtract(1, 'd').format('YYYY-MM-DD'); return { from: y, to: y }; }
  if (preset === 'last7')     return { from: dayjs().subtract(6, 'd').format('YYYY-MM-DD'), to: today };
  if (preset === 'month')     return { from: dayjs().startOf('month').format('YYYY-MM-DD'), to: today };
  return custom;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  completado:  { label: 'Completado',  color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: CheckCircle2 },
  en_progreso: { label: 'En progreso', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  icon: Activity     },
  bloqueado:   { label: 'Bloqueado',   color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: Ban          },
};

const ALL_STATUSES = ['completado', 'en_progreso', 'bloqueado'];

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'all',       label: 'Todo'           },
  { id: 'today',     label: 'Hoy'            },
  { id: 'yesterday', label: 'Ayer'           },
  { id: 'last7',     label: 'Últimos 7 días' },
  { id: 'month',     label: 'Mes actual'     },
  { id: 'custom',    label: 'Rango libre'    },
];

const VIEWS: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: 'lista',         label: 'Lista',             icon: List       },
  { id: 'kanban',        label: 'Kanban',            icon: Kanban     },
  { id: 'empresa',       label: 'Por empresa',       icon: Building2  },
  { id: 'implementador', label: 'Por implementador', icon: Users      },
  { id: 'tarjetas',      label: 'Tarjetas',          icon: LayoutGrid },
  { id: 'resumen',       label: 'Resumen',           icon: PieChart   },
];

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.completado;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)', minWidth: 60 }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-7 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
    </div>
  );
}

function ActivityCard({ a }: { a: GlobalActivity }) {
  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.completado;
  const so = a.phase.projectModule.project.serviceOrder;
  const implementor = resolveImplementor(a);
  const pct = Math.round(Number(a.progressPercent));
  return (
    <div className="rounded-xl p-4 space-y-3 transition-shadow hover:shadow-md"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-start justify-between gap-2">
        <StatusBadge status={a.status} />
        <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>{so.osNumber}</span>
      </div>
      <div>
        <p className="font-semibold text-sm leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
        <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-secondary)' }}>{so.client.businessName}</p>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Layers className="w-3 h-3 shrink-0" />
          <span className="truncate">{a.phase.projectModule.name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <GitBranch className="w-3 h-3 shrink-0" />
          <span className="truncate">{a.phase.name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">{implementor}</span>
        </div>
      </div>
      <ProgressBar pct={pct} color={cfg.color} />
      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
        <Clock className="w-3 h-3" />
        {displayDate(a)}
      </div>
    </div>
  );
}

// ── View: Lista ───────────────────────────────────────────────────────────────

function ListView({ activities, loading, total, page, onLoadMore }: {
  activities: GlobalActivity[]; loading: boolean; total: number; page: number;
  onLoadMore: () => void;
}) {
  const hasMore = activities.length < total;
  if (loading && activities.length === 0) return <LoadingState />;
  if (activities.length === 0) return <EmptyState />;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)', background: 'var(--card-bg)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
              {['Actividad', 'Empresa / OS', 'Módulo', 'Fase', 'Implementador', 'Estado', 'Progreso', 'Fecha'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap"
                  style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activities.map((a, i) => {
              const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.completado;
              const so = a.phase.projectModule.project.serviceOrder;
              const pct = Math.round(Number(a.progressPercent));
              return (
                <tr key={a.id} className="transition-colors hover:bg-white/[0.03]"
                  style={{ borderBottom: i < activities.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                  <td className="px-4 py-3 max-w-[240px]">
                    <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
                    {a.code && <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{a.code}</p>}
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{so.client.businessName}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{so.osNumber}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      <span className="truncate max-w-[130px] text-xs" style={{ color: 'var(--text-secondary)' }}>{a.phase.projectModule.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      <span className="truncate max-w-[130px] text-xs" style={{ color: 'var(--text-secondary)' }}>{a.phase.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{resolveImplementor(a)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 min-w-[100px]"><ProgressBar pct={pct} color={cfg.color} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{displayDate(a)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMore && <LoadMoreBtn loading={loading} remaining={total - activities.length} onLoad={onLoadMore} />}
    </div>
  );
}

// ── View: Kanban ──────────────────────────────────────────────────────────────

function KanbanView({ activities, loading }: { activities: GlobalActivity[]; loading: boolean }) {
  if (loading && activities.length === 0) return <LoadingState />;
  if (activities.length === 0) return <EmptyState />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      {ALL_STATUSES.map(status => {
        const cfg = STATUS_CONFIG[status];
        const Icon = cfg.icon;
        const items = activities.filter(a => a.status === status);
        return (
          <div key={status} className="rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${cfg.color}25`, background: 'var(--card-bg)' }}>
            {/* Column header */}
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.color}20` }}>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                <span className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${cfg.color}20`, color: cfg.color }}>{items.length}</span>
            </div>
            {/* Cards */}
            <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Sin actividades</p>
              ) : items.map(a => (
                <KanbanCard key={a.id} a={a} cfg={cfg} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ a, cfg }: { a: GlobalActivity; cfg: typeof STATUS_CONFIG[string] }) {
  const so = a.phase.projectModule.project.serviceOrder;
  const pct = Math.round(Number(a.progressPercent));
  return (
    <div className="rounded-xl p-3 space-y-2.5 transition-shadow hover:shadow-md"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
        <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded"
          style={{ background: 'var(--card-bg)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
          {so.osNumber}
        </span>
      </div>
      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{so.client.businessName}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Layers className="w-3 h-3 shrink-0" /><span className="truncate">{a.phase.projectModule.name}</span>
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <User className="w-3 h-3 shrink-0" /><span className="truncate">{resolveImplementor(a)}</span>
        </div>
      </div>
      <ProgressBar pct={pct} color={cfg.color} />
      <p className="text-[11px]" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{displayDate(a)}</p>
    </div>
  );
}

// ── View: Por empresa / Por implementador (genérico) ─────────────────────────

function GroupedView({ activities, loading, groupKey, groupLabel, groupIcon: GroupIcon }: {
  activities: GlobalActivity[];
  loading: boolean;
  groupKey: (a: GlobalActivity) => string;
  groupLabel: (a: GlobalActivity) => string;
  groupIcon: React.ElementType;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: GlobalActivity[] }>();
    activities.forEach(a => {
      const key = groupKey(a);
      const lbl = groupLabel(a);
      if (!map.has(key)) map.set(key, { label: lbl, items: [] });
      map.get(key)!.items.push(a);
    });
    return [...map.entries()].sort((a, b) => b[1].items.length - a[1].items.length);
  }, [activities, groupKey, groupLabel]);

  useEffect(() => {
    if (groups.length > 0) setOpen(new Set([groups[0][0]]));
  }, [groups.length]);

  if (loading && activities.length === 0) return <LoadingState />;
  if (activities.length === 0) return <EmptyState />;

  function toggle(key: string) {
    setOpen(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  return (
    <div className="space-y-3">
      {groups.map(([key, { label, items }]) => {
        const isOpen = open.has(key);
        return (
          <div key={key} className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border-subtle)', background: 'var(--card-bg)' }}>
            <button className="w-full flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.03]"
              onClick={() => toggle(key)}>
              <div className="flex items-center gap-3">
                <GroupIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
                <StatusSummaryPills items={items} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  {items.length}
                </span>
                {isOpen ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                         : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
              </div>
            </button>
            {isOpen && (
              <div className="overflow-x-auto" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {['Actividad', 'OS', 'Módulo', 'Implementador', 'Estado', 'Progreso', 'Fecha'].map(h => (
                        <th key={h} className="px-4 py-2 text-left font-semibold whitespace-nowrap"
                          style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a, i) => {
                      const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.completado;
                      const so = a.phase.projectModule.project.serviceOrder;
                      const pct = Math.round(Number(a.progressPercent));
                      return (
                        <tr key={a.id} className="hover:bg-white/[0.03]"
                          style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                          <td className="px-4 py-2.5 max-w-[220px]">
                            <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{so.osNumber}</td>
                          <td className="px-4 py-2.5 max-w-[140px]">
                            <p className="truncate" style={{ color: 'var(--text-secondary)' }}>{a.phase.projectModule.name}</p>
                            <p className="truncate opacity-70" style={{ color: 'var(--text-muted)' }}>{a.phase.name}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="truncate max-w-[120px] inline-block" style={{ color: 'var(--text-secondary)' }}>{resolveImplementor(a)}</span>
                          </td>
                          <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                          <td className="px-4 py-2.5 min-w-[90px]"><ProgressBar pct={pct} color={cfg.color} /></td>
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{displayDate(a)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusSummaryPills({ items }: { items: GlobalActivity[] }) {
  const counts = ALL_STATUSES.map(s => ({ s, n: items.filter(a => a.status === s).length })).filter(x => x.n > 0);
  return (
    <div className="flex items-center gap-1.5">
      {counts.map(({ s, n }) => {
        const cfg = STATUS_CONFIG[s];
        return (
          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded font-bold"
            style={{ background: cfg.bg, color: cfg.color }}>{n}</span>
        );
      })}
    </div>
  );
}

// ── View: Tarjetas ────────────────────────────────────────────────────────────

function TarjetasView({ activities, loading, total, page, onLoadMore }: {
  activities: GlobalActivity[]; loading: boolean; total: number; page: number; onLoadMore: () => void;
}) {
  const hasMore = activities.length < total;
  if (loading && activities.length === 0) return <LoadingState />;
  if (activities.length === 0) return <EmptyState />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activities.map(a => <ActivityCard key={a.id} a={a} />)}
      </div>
      {hasMore && <LoadMoreBtn loading={loading} remaining={total - activities.length} onLoad={onLoadMore} />}
    </div>
  );
}

// ── View: Resumen ─────────────────────────────────────────────────────────────

function ResumenView({ activities, loading }: { activities: GlobalActivity[]; loading: boolean }) {
  if (loading && activities.length === 0) return <LoadingState />;
  if (activities.length === 0) return <EmptyState />;

  const counts = {
    completado: activities.filter(a => a.status === 'completado').length,
    en_progreso: activities.filter(a => a.status === 'en_progreso').length,
    bloqueado: activities.filter(a => a.status === 'bloqueado').length,
  };

  // Top clients
  const clientMap = new Map<string, number>();
  activities.forEach(a => {
    const name = a.phase.projectModule.project.serviceOrder.client.businessName;
    clientMap.set(name, (clientMap.get(name) ?? 0) + 1);
  });
  const topClients = [...clientMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 22 ? name.slice(0, 22) + '…' : name, count }));

  // Top implementors
  const implMap = new Map<string, number>();
  activities.forEach(a => {
    const name = resolveImplementor(a);
    if (name !== 'Sin asignar') implMap.set(name, (implMap.get(name) ?? 0) + 1);
  });
  const topImpl = [...implMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 22 ? name.slice(0, 22) + '…' : name, count }));

  // Top modules
  const modMap = new Map<string, number>();
  activities.forEach(a => {
    const name = a.phase.projectModule.name;
    modMap.set(name, (modMap.get(name) ?? 0) + 1);
  });
  const topMods = [...modMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 22 ? name.slice(0, 22) + '…' : name, count }));

  const CHART_COLORS = ['#818cf8', '#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c', '#38bdf8'];

  function MiniBar({ data, title }: { data: { name: string; count: number }[]; title: string }) {
    return (
      <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
        <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{title}</p>
        {data.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Sin datos</p>
        ) : (
          <div style={{ height: Math.max(data.length * 36, 120) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <ReTooltip
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [v, 'actividades']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: activities.length, color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
          { label: 'Completadas', value: counts.completado, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
          { label: 'En progreso', value: counts.en_progreso, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
          { label: 'Bloqueadas', value: counts.bloqueado, color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="rounded-2xl p-5 text-center"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-3xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <div className="h-full rounded-full" style={{ width: `${activities.length ? (value / activities.length) * 100 : 0}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniBar data={topClients} title="Por empresa" />
        <MiniBar data={topImpl} title="Por implementador" />
        <MiniBar data={topMods} title="Por módulo" />
      </div>
    </div>
  );
}

// ── Shared states ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24 gap-2" style={{ color: 'var(--text-muted)' }}>
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Cargando actividades…</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <AlertTriangle className="w-8 h-8" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay actividades para los filtros seleccionados</p>
    </div>
  );
}

function LoadMoreBtn({ loading, remaining, onLoad }: { loading: boolean; remaining: number; onLoad: () => void }) {
  return (
    <div className="px-4 py-3 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <button onClick={onLoad} disabled={loading}
        className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? 'Cargando…' : `Cargar más (${remaining} restantes)`}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

async function exportPDF(activities: GlobalActivity[], presetLabel: string, statuses: string[]) {
  if (!activities.length) { return; }
  const { jsPDF } = await import('jspdf') as any;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const STATUS_LABELS: Record<string, string> = { completado: 'Completado', en_progreso: 'En progreso', bloqueado: 'Bloqueado' };
  const pageW = 297;
  const margin = 14;
  let y = 18;

  // Header
  doc.setFillColor(15, 22, 41);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Actividades Realizadas', margin, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Período: ${presetLabel}  ·  Estados: ${statuses.map(s => STATUS_LABELS[s] || s).join(', ')}  ·  Total: ${activities.length}  ·  ${dayjs().format('DD/MM/YYYY HH:mm')}`, margin, 21);

  y = 36;
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

  // Column definitions [label, x, maxChars, align]
  const cols: [string, number, number, 'left'|'right'][] = [
    ['Actividad',      margin, 34, 'left'],
    ['Empresa',        71,     25, 'left'],
    ['OS',             113,    12, 'left'],
    ['Módulo',         135,    20, 'left'],
    ['Implementador',  169,    20, 'left'],
    ['Estado',         203,    12, 'left'],
    ['Fecha',          233,    10, 'left'],
    ['%',              265,     4, 'right'],
  ];

  // Table header bg
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 5, pageW - margin * 2, 8, 'F');
  cols.forEach(([label, x, , align]) => {
    doc.text(label, align === 'right' ? x + 8 : x, y, { align });
  });

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  const STATUS_COLORS_RGB: Record<string, [number,number,number]> = {
    completado:  [52,  211, 153],
    en_progreso: [96,  165, 250],
    bloqueado:   [248, 113, 113],
  };

  activities.forEach((a, i) => {
    if (y > 188) { doc.addPage(); y = 18; }
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 4.5, pageW - margin * 2, 7, 'F');
    }
    doc.setTextColor(30, 41, 59);
    const so = a.phase.projectModule.project.serviceOrder;
    const impl = resolveImplementor(a);
    const pct = Math.round(Number(a.progressPercent));
    const trunc = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + '…' : s;
    const dateStr = dayjs(getRawDate(a)).format('DD/MM/YYYY');

    doc.text(trunc(a.name, 34), margin, y);
    doc.text(trunc(so.client.businessName, 25), 71, y);
    doc.text(so.osNumber, 113, y);
    doc.text(trunc(a.phase.projectModule.name, 20), 135, y);
    doc.text(trunc(impl, 20), 169, y);

    const [r, g, b] = STATUS_COLORS_RGB[a.status] ?? [148, 163, 184];
    doc.setTextColor(r, g, b);
    doc.text(STATUS_LABELS[a.status] ?? a.status, 203, y);
    doc.setTextColor(30, 41, 59);
    doc.text(dateStr, 233, y);
    doc.text(`${pct}%`, 273, y, { align: 'right' });

    y += 7;
  });

  doc.save(`actividades-realizadas-${dayjs().format('YYYY-MM-DD')}.pdf`);
}

export default function ActividadesRealizadasPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [automationOpen, setAutomationOpen] = useState(false);
  const [exportingPDF, setExportingPDF]     = useState(false);

  // Filters
  const [preset, setPreset]             = useState<DatePreset>('today');
  const [customRange, setCustomRange]   = useState<DateRange>({ from: '', to: '' });
  const [statuses, setStatuses]         = useState<string[]>([...ALL_STATUSES]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId]   = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [clientOpen, setClientOpen]     = useState(false);
  const clientRef = useRef<HTMLDivElement>(null);

  // Data
  const [activities, setActivities] = useState<GlobalActivity[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [page, setPage]             = useState(1);
  const LIMIT = 50;

  const dateRange = useMemo(() => presetToRange(preset, customRange), [preset, customRange]);

  // Clients loaded independently from the backend
  const [allClients, setAllClients] = useState<{ id: string; businessName: string }[]>([]);
  useEffect(() => {
    clientsApi.list({ limit: 500 }).then(res => {
      setAllClients(res.data.map((c: any) => ({ id: c.id, businessName: c.businessName })));
    }).catch(() => {});
  }, []);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return allClients;
    const q = normalize(clientSearch);
    return allClients.filter(c => normalize(c.businessName).includes(q));
  }, [allClients, clientSearch]);

  // Fetch
  const fetchData = useCallback(async (p = 1) => {
    if (statuses.length === 0) { setActivities([]); setTotal(0); return; }
    setLoading(true);
    try {
      const params: any = { status: statuses, page: p, limit: LIMIT };
      if (dateRange.from) params.dateFrom = dateRange.from;
      if (dateRange.to)   params.dateTo   = dateRange.to;
      if (selectedClientId) params.clientId = selectedClientId;
      const res = await projectsApi.getGlobalActivities(params);
      if (p === 1) setActivities(res.data);
      else         setActivities(prev => [...prev, ...res.data]);
      setTotal(res.total);
      setPage(p);
    } catch {
      toast.error('Error al cargar actividades');
    } finally {
      setLoading(false);
    }
  }, [statuses, dateRange, selectedClientId]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  // Close dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setClientOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function toggleStatus(s: string) {
    setStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    setPage(1);
  }

  function selectClient(id: string, name: string) {
    setSelectedClientId(id); setSelectedClientName(name); setClientSearch(''); setClientOpen(false);
  }

  function clearClient() {
    setSelectedClientId(null); setSelectedClientName(''); setClientSearch('');
  }

  const commonProps = { activities, loading, total, page, onLoadMore: () => fetchData(page + 1) };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <CheckSquare className="w-5 h-5" style={{ color: '#818cf8' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Actividades Realizadas</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {loading ? 'Cargando…' : `${total} actividad${total !== 1 ? 'es' : ''} encontrada${total !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            {VIEWS.map(v => {
              const Icon = v.icon;
              const active = viewMode === v.id;
              return (
                <button key={v.id} onClick={() => setViewMode(v.id)} title={v.label}
                  className="p-2 rounded-lg transition-colors"
                  style={active
                    ? { background: 'rgba(99,102,241,0.15)', color: '#818cf8' }
                    : { color: 'var(--text-muted)' }}>
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          <button
            onClick={async () => {
              setExportingPDF(true);
              try { await exportPDF(activities, DATE_PRESETS.find(p => p.id === preset)?.label ?? preset, statuses); }
              catch { toast.error('Error al generar el PDF'); }
              finally { setExportingPDF(false); }
            }}
            disabled={exportingPDF || activities.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            PDF
          </button>

          <button onClick={() => setAutomationOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.3)', color: '#818cf8' }}>
            <Mail className="w-4 h-4" />
            Automatización
          </button>

          <button onClick={() => fetchData(1)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-4 space-y-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>

        {/* Date presets */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Período:</span>
          {DATE_PRESETS.map(p => (
            <button key={p.id} onClick={() => { setPreset(p.id); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={preset === p.id
                ? { background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8' }
                : { background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customRange.from}
                onChange={e => setCustomRange(r => ({ ...r, from: e.target.value }))}
                className="rounded-lg px-2 py-1 text-xs"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
              <input type="date" value={customRange.to}
                onChange={e => setCustomRange(r => ({ ...r, to: e.target.value }))}
                className="rounded-lg px-2 py-1 text-xs"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          {/* Status chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Estado:</span>
            {ALL_STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s];
              const active = statuses.includes(s);
              const Icon = cfg.icon;
              return (
                <button key={s} onClick={() => toggleStatus(s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={active
                    ? { background: cfg.bg, border: `1px solid ${cfg.color}40`, color: cfg.color }
                    : { background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', opacity: 0.6 }}>
                  <Icon className="w-3.5 h-3.5" />{cfg.label}
                </button>
              );
            })}
          </div>

          {/* Client combobox */}
          <div className="relative flex-1 min-w-[220px]" ref={clientRef}>
            <span className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Empresa:</span>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-text"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}
              onClick={() => setClientOpen(true)}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              {selectedClientId ? (
                <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{selectedClientName}</span>
              ) : (
                <input
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="Todas las empresas"
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setClientOpen(true); }}
                  onFocus={() => setClientOpen(true)}
                />
              )}
              {selectedClientId ? (
                <button onClick={e => { e.stopPropagation(); clearClient(); }}
                  className="p-0.5 rounded-full hover:bg-white/10 transition-colors">
                  <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              )}
            </div>
            {clientOpen && !selectedClientId && (
              <div className="absolute z-30 mt-1 w-full rounded-xl shadow-xl overflow-hidden"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
                {filteredClients.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>Sin resultados</p>
                ) : (
                  <ul className="max-h-52 overflow-y-auto">
                    {filteredClients.map(c => (
                      <li key={c.id}>
                        <button className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
                          style={{ color: 'var(--text-primary)' }}
                          onClick={() => selectClient(c.id, c.businessName)}>
                          <Building2 className="w-3.5 h-3.5 inline mr-2 opacity-50" />{c.businessName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active view label */}
      <div className="flex items-center gap-2">
        {(() => { const v = VIEWS.find(x => x.id === viewMode)!; const Icon = v.icon;
          return <><Icon className="w-4 h-4" style={{ color: '#818cf8' }} /><span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{v.label}</span></>;
        })()}
      </div>

      {/* View content */}
      {viewMode === 'lista'         && <ListView {...commonProps} />}
      {viewMode === 'kanban'        && <KanbanView activities={activities} loading={loading} />}
      {viewMode === 'empresa'       && (
        <GroupedView activities={activities} loading={loading}
          groupKey={a => a.phase.projectModule.project.serviceOrder.client.id}
          groupLabel={a => a.phase.projectModule.project.serviceOrder.client.businessName}
          groupIcon={Building2} />
      )}
      {viewMode === 'implementador' && (
        <GroupedView activities={activities} loading={loading}
          groupKey={a => resolveImplementor(a)}
          groupLabel={a => resolveImplementor(a)}
          groupIcon={Users} />
      )}
      {viewMode === 'tarjetas'      && <TarjetasView {...commonProps} />}
      {viewMode === 'resumen'       && <ResumenView activities={activities} loading={loading} />}

      <AutomationModal
        open={automationOpen}
        onClose={() => setAutomationOpen(false)}
        activeFilters={{
          status:   statuses,
          clientId: selectedClientId,
          dateFrom: dateRange.from,
          dateTo:   dateRange.to,
        }}
      />
    </div>
  );
}
