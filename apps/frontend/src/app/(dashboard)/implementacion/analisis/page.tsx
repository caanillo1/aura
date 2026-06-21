'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip as ReTooltip, Cell, LabelList, PieChart, Pie, Legend,
} from 'recharts';
import {
  Sparkles, Search, X, RefreshCw, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Activity, Calendar, Target, Building2,
  BarChart3, CircleAlert, Info, CheckCheck, Ban, Timer, Layers,
  Lightbulb, CalendarCheck, CalendarClock, ChevronRight,
  Zap, ShieldAlert, Clock, Flag, ListChecks, Ticket, ArrowLeftRight,
  ExternalLink, TriangleAlert,
} from 'lucide-react';
import { serviceOrdersApi } from '@/lib/api';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');

// ── Types ─────────────────────────────────────────────────────────────────────

interface OsOption {
  id: string; osNumber: string; product: string;
  client?: { businessName: string } | null; status: string;
}

interface ModuleDetail {
  id: string; name: string; progressPercent: number; phaseCount: number;
  activities: { total: number; done: number; inProgress: number; blocked: number; pending: number; overdue: number };
  health: 'critico' | 'completado' | 'en_progreso' | 'pendiente';
}

interface VisitsDetail {
  total: number; confirmed: number; pending: number; cancelled: number; completed: number; upcoming: number;
}

interface TimelineDetail {
  daysElapsed: number; daysRemaining: number; totalDays: number; timeProgressPercent: number;
}

interface ActivitySummary {
  total: number; done: number; inProgress: number; pending: number; blocked: number; overdue: number;
}

interface Recommendation {
  priority: 'alta' | 'media' | 'baja'; titulo: string; accion: string;
}

interface TicketItem {
  id: string; numero: string; titulo: string; prioridad: string;
  estadoActual: string; ticketRubi: string | null; tipo: string;
}

interface TicketsDetail {
  total: number; entregados: number; devueltos: number; negados: number;
  pendientes: number; altaPrioridad: number; list: TicketItem[];
}

type RiskLevel = 'alto' | 'medio' | 'normal';
type AlertLevel = 'critico' | 'advertencia' | 'info';
interface Alert { level: AlertLevel; tipo: string; titulo: string; detalle: string }

interface Predictions {
  ritmoActividadesSemana: number; actividadesCompletadas: number; actividadesRestantes: number;
  totalActividades: number; fechaEstimadaFin: string | null;
  diasDeRetraso: number | null; probabilidadExito: number | null;
}

interface AnalysisData {
  os: { id: string; osNumber: string; product: string; status: string;
        startDate: string | null; endDate: string | null;
        client?: { businessName: string; nit?: string } | null };
  project: { name: string; status: string; progressPercent: number;
             startDate?: string | null; endDate?: string | null } | null;
  riskLevel: RiskLevel; alerts: Alert[]; predictions: Predictions;
  modules?: ModuleDetail[]; visits?: VisitsDetail; timeline?: TimelineDetail | null;
  activitySummary?: ActivitySummary; recommendations?: Recommendation[];
  tickets?: TicketsDetail;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (s?: string | null) => s ? dayjs(s).format('DD/MM/YYYY') : '—';

const RISK_CFG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  alto:   { label: 'Riesgo Alto',  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  icon: AlertTriangle },
  medio:  { label: 'Riesgo Medio', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: CircleAlert   },
  normal: { label: 'Sin alertas',  color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)',icon: CheckCircle2  },
};

const ALERT_CFG: Record<AlertLevel, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  critico:    { color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.20)',  icon: AlertTriangle },
  advertencia:{ color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.20)', icon: CircleAlert  },
  info:       { color: '#60a5fa', bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.20)', icon: Info         },
};

const healthColor = (h: string) =>
  h === 'critico' ? '#ef4444' : h === 'completado' ? '#10b981' : h === 'en_progreso' ? '#6366f1' : '#94a3b8';

const TICKET_ESTADO_COLOR: Record<string, string> = {
  Elaborado:    '#60a5fa',
  Priorizado:   '#a78bfa',
  Repriorizado: '#fbbf24',
  Devuelto:     '#fb923c',
  Negado:       '#f87171',
  Entregado:    '#34d399',
};

const TICKET_PRIO_COLOR: Record<string, string> = {
  Alta:  '#ef4444',
  Media: '#f59e0b',
  Baja:  '#10b981',
};

const healthLabel = (h: string) =>
  h === 'critico' ? 'En riesgo' : h === 'completado' ? 'Completado'
  : h === 'en_progreso' ? 'En progreso' : 'Pendiente';

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', en_curso: 'En curso', completada: 'Completada',
  cancelada: 'Cancelada', suspendida: 'Suspendida',
};

// ── OS Selector ───────────────────────────────────────────────────────────────

function OsSelector({ value, onChange }: { value: OsOption | null; onChange: (v: OsOption | null) => void }) {
  const { theme }     = useTheme();
  const isLight       = theme === 'light';
  const [search, setSearch]   = useState('');
  const [open, setOpen]       = useState(false);
  const [results, setResults] = useState<OsOption[]>([]);
  const [loading, setLoading] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      setLoading(true);
      serviceOrdersApi.list({ search, limit: 12 } as any)
        .then((r: any) => setResults((r.data ?? r).slice(0, 12)))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 280);
  }, [search, open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const surface = isLight ? '#fff' : 'rgba(10,18,42,0.98)';
  const bdr     = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)';

  return (
    <div ref={ref} className="relative w-full max-w-lg">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input
          value={value ? `${value.osNumber} — ${value.client?.businessName ?? ''} · ${value.product}` : search}
          onChange={e => { setSearch(e.target.value); setOpen(true); if (value) onChange(null); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar por cliente, # OS o producto…"
          className="input-glass rounded-xl pl-10 pr-10 py-2.5 text-sm w-full"
          autoComplete="off"
        />
        {value && (
          <button onClick={() => { onChange(null); setSearch(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && !value && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-2xl"
            style={{ background: surface, border: `1px solid ${bdr}` }}>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
              </div>
            ) : results.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Sin resultados</p>
            ) : results.map(os => (
              <button key={os.id} onClick={() => { onChange(os); setOpen(false); setSearch(''); }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(96,165,250,0.12)' }}>
                  <Building2 className="w-4 h-4" style={{ color: '#60a5fa' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {os.osNumber} — {os.client?.businessName ?? '—'}
                  </p>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {os.product} · {STATUS_LABEL[os.status] ?? os.status}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Section Title ─────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4" style={{ color: '#6366f1' }} />
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</h2>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon, accent = false }: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2"
      style={{
        background: accent ? `${color}10` : 'var(--card-bg)',
        border: `1px solid ${accent ? color + '30' : 'var(--card-border)'}`,
        borderTop: `3px solid ${color}`,
      }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide truncate" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-extrabold leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

// ── Module Tooltip (custom) ───────────────────────────────────────────────────

function ModuleTooltipContent({ active, payload, isLight }: { active?: boolean; payload?: any[]; isLight: boolean }) {
  if (!active || !payload?.length) return null;
  const m = payload[0]?.payload as (ModuleDetail & { progressPercent: number });
  if (!m) return null;
  const bg   = isLight ? '#fff' : '#0f172a';
  const bdr  = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  const text = isLight ? '#1e293b' : '#e2e8f0';
  const muted= isLight ? '#64748b' : '#94a3b8';
  const col  = healthColor(m.health);
  return (
    <div style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 10,
                  padding: '10px 14px', fontSize: 12, color: text, minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
      <p style={{ fontWeight: 700, marginBottom: 8, color: col }}>{m.name}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <p><span style={{ color: muted }}>Avance: </span><strong style={{ color: col }}>{Math.round(m.progressPercent)}%</strong></p>
        <p><span style={{ color: muted }}>Completadas: </span><strong>{m.activities.done}/{m.activities.total}</strong></p>
        <p><span style={{ color: muted }}>En progreso: </span>{m.activities.inProgress}</p>
        <p><span style={{ color: muted }}>Pendientes: </span>{m.activities.pending}</p>
        {m.activities.blocked > 0 && (
          <p style={{ color: '#ef4444', fontWeight: 600 }}>✕ {m.activities.blocked} bloqueada{m.activities.blocked !== 1 ? 's' : ''}</p>
        )}
        {m.activities.overdue > 0 && (
          <p style={{ color: '#f59e0b', fontWeight: 600 }}>⏰ {m.activities.overdue} vencida{m.activities.overdue !== 1 ? 's' : ''}</p>
        )}
        <p style={{ marginTop: 4, color: muted, fontSize: 10 }}>{m.phaseCount} fase{m.phaseCount !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}

// ── Module Progress Chart ─────────────────────────────────────────────────────

function ModuleProgressChart({ modules, isLight }: { modules: ModuleDetail[]; isLight: boolean }) {
  const chartH    = Math.max(200, modules.length * 48 + 40);
  const tickColor = isLight ? '#64748b' : '#94a3b8';
  const data = modules.map(m => ({
    ...m,
    displayName: m.name.length > 22 ? m.name.slice(0, 20) + '…' : m.name,
    progressPercent: Math.round(m.progressPercent),
  }));

  return (
    <ResponsiveContainer width="100%" height={chartH}>
      <BarChart layout="vertical" data={data} margin={{ left: 0, right: 52, top: 4, bottom: 4 }}>
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: tickColor }}
          tickFormatter={(v: number) => `${v}%`} tickCount={6} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="displayName" width={148}
          tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
        <ReTooltip
          content={(props: any) => (
            <ModuleTooltipContent active={props.active} payload={props.payload} isLight={isLight} />
          )}
        />
        <Bar dataKey="progressPercent" radius={[0, 5, 5, 0]} maxBarSize={24}
          background={{ fill: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', radius: 5 } as any}>
          {data.map((entry, i) => (
            <Cell key={i} fill={healthColor(entry.health)} fillOpacity={0.88} />
          ))}
          <LabelList dataKey="progressPercent" position="right"
            style={{ fontSize: 11, fontWeight: 700, fill: tickColor }}
            formatter={(v: any) => `${v}%`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Activity Donut ────────────────────────────────────────────────────────────

function ActivityDonut({ summary, isLight }: { summary: ActivitySummary; isLight: boolean }) {
  const donutData = [
    { name: 'Completadas', value: summary.done,       color: '#10b981' },
    { name: 'En progreso', value: summary.inProgress, color: '#6366f1' },
    { name: 'Pendientes',  value: summary.pending,    color: '#94a3b8' },
    { name: 'Bloqueadas',  value: summary.blocked,    color: '#ef4444' },
  ].filter(d => d.value > 0);

  if (donutData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin actividades registradas</p>
      </div>
    );
  }

  const tooltipSx = {
    background: isLight ? '#fff' : '#0f172a',
    border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 8, fontSize: 12, color: isLight ? '#1e293b' : '#e2e8f0',
  };
  const total = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={donutData} cx="50%" cy="46%" innerRadius={70} outerRadius={98}
            dataKey="value" paddingAngle={2} strokeWidth={0}>
            {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <ReTooltip contentStyle={tooltipSx}
            formatter={(v: any, name: any) => [`${v} (${Math.round((v / total) * 100)}%)`, name]} />
          <Legend iconType="circle" iconSize={8}
            wrapperStyle={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', paddingTop: 4 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ paddingBottom: 32 }}>
        <div className="text-center">
          <div className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{total}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>actividades</div>
        </div>
      </div>
    </div>
  );
}

// ── Timeline Comparison ───────────────────────────────────────────────────────

function TimelineCard({ timeline, progressPercent, isLight }: {
  timeline: TimelineDetail; progressPercent: number; isLight: boolean;
}) {
  const timePct   = timeline.timeProgressPercent;
  const progPct   = Math.round(progressPercent);
  const gap       = timePct - progPct;
  const progColor = gap <= 0 ? '#10b981' : gap <= 20 ? '#f59e0b' : '#ef4444';
  const trackBg   = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <Timer className="w-3 h-3" />Tiempo transcurrido
          </span>
          <span className="font-bold" style={{ color: '#60a5fa' }}>
            {timePct}% · {timeline.daysElapsed}d de {timeline.totalDays}d
          </span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: trackBg }}>
          <div className="h-full rounded-full"
            style={{ width: `${Math.min(timePct, 100)}%`, background: 'linear-gradient(90deg,#3b82f6,#60a5fa)' }} />
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {timeline.daysRemaining > 0
            ? `${timeline.daysRemaining} días restantes · vence ${fmt(dayjs().add(timeline.daysRemaining, 'day').toISOString())}`
            : 'Plazo vencido'}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
            <BarChart3 className="w-3 h-3" />Avance real del proyecto
          </span>
          <span className="font-bold" style={{ color: progColor }}>{progPct}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: trackBg }}>
          <div className="h-full rounded-full"
            style={{ width: `${Math.min(progPct, 100)}%`, background: `linear-gradient(90deg,${progColor}cc,${progColor})` }} />
        </div>
      </div>

      <div className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: gap > 0 ? `${progColor}08` : 'rgba(16,185,129,0.06)',
                 border: `1px solid ${gap > 0 ? progColor + '25' : 'rgba(16,185,129,0.20)'}` }}>
        {gap > 0
          ? <TrendingDown className="w-4 h-4 shrink-0" style={{ color: progColor }} />
          : <TrendingUp   className="w-4 h-4 shrink-0" style={{ color: '#10b981' }} />}
        <p className="text-xs" style={{ color: gap > 0 ? progColor : '#10b981' }}>
          {gap > 0
            ? `El proyecto va ${gap}% por detrás del cronograma esperado — hay que acelerar el ritmo de avance.`
            : `El proyecto va ${Math.abs(gap)}% por delante del cronograma — la implementación está bien encaminada.`}
        </p>
      </div>
    </div>
  );
}

// ── Module Card ───────────────────────────────────────────────────────────────

function ModuleCard({ mod }: { mod: ModuleDetail }) {
  const color = healthColor(mod.health);
  const pct   = Math.round(mod.progressPercent);

  return (
    <div className="rounded-2xl p-4"
      style={{ background: 'var(--card-bg)', border: 'var(--card-border) 1px solid', borderLeft: `3px solid ${color}` }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{mod.name}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {mod.phaseCount} fase{mod.phaseCount !== 1 ? 's' : ''} · {mod.activities.total} actividades
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg"
          style={{ background: `${color}15`, color }}>
          {healthLabel(mod.health)}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span style={{ color: 'var(--text-muted)' }}>Avance</span>
          <span className="font-bold" style={{ color }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Completadas', value: mod.activities.done,       color: '#10b981', icon: CheckCheck },
          { label: 'En progreso', value: mod.activities.inProgress, color: '#6366f1', icon: Activity  },
          { label: 'Pendientes',  value: mod.activities.pending,    color: '#94a3b8', icon: Clock     },
        ].map(({ label, value, color: c, icon: Icon }) => (
          <div key={label} className="rounded-lg px-2 py-1.5 text-center" style={{ background: `${c}10` }}>
            <Icon className="w-3 h-3 mx-auto mb-0.5" style={{ color: c }} />
            <div className="text-sm font-bold" style={{ color: c }}>{value}</div>
            <div className="text-center" style={{ color: 'var(--text-muted)', fontSize: 9 }}>{label}</div>
          </div>
        ))}
      </div>

      {(mod.activities.blocked > 0 || mod.activities.overdue > 0) && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {mod.activities.blocked > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
              style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
              <Ban className="w-3 h-3 inline mr-1" />
              {mod.activities.blocked} bloqueada{mod.activities.blocked !== 1 ? 's' : ''}
            </span>
          )}
          {mod.activities.overdue > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
              style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}>
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              {mod.activities.overdue} vencida{mod.activities.overdue !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recommendation Item ───────────────────────────────────────────────────────

function RecommendationItem({ rec, i }: { rec: Recommendation; i: number }) {
  const cfg = {
    alta:  { color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.20)',  label: 'Alta'  },
    media: { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.20)', label: 'Media' },
    baja:  { color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.20)', label: 'Baja'  },
  }[rec.priority];

  return (
    <div className="flex gap-3 rounded-xl px-4 py-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.color}` }}>
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold"
        style={{ background: `${cfg.color}20`, color: cfg.color }}>{i + 1}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: cfg.color }}>{rec.titulo}</p>
          <span className="text-xs px-1.5 py-0.5 rounded font-bold"
            style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{rec.accion}</p>
      </div>
    </div>
  );
}

// ── Alert Item ────────────────────────────────────────────────────────────────

function AlertItem({ alert }: { alert: Alert }) {
  const cfg  = ALERT_CFG[alert.level];
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.color}` }}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: cfg.color }} />
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: cfg.color }}>{alert.titulo}</p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{alert.detalle}</p>
      </div>
    </div>
  );
}

// ── Probability Gauge ─────────────────────────────────────────────────────────

function ProbabilityGauge({ pct }: { pct: number }) {
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const label = pct >= 70 ? 'Alta probabilidad' : pct >= 40 ? 'Probabilidad media' : 'Probabilidad baja';
  return (
    <div className="flex flex-col gap-2 rounded-2xl p-4"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderTop: `3px solid ${color}` }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Target className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Probabilidad de éxito al ritmo actual
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-extrabold" style={{ color }}>{pct}%</span>
        <span className="text-xs font-semibold pb-1" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
        <div className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg,${color}90,${color})` }} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalisisPage() {
  const { theme } = useTheme();
  const isLight   = theme === 'light';

  const [selectedOs, setSelectedOs] = useState<OsOption | null>(null);
  const [data, setData]             = useState<AnalysisData | null>(null);
  const [loading, setLoading]       = useState(false);

  const load = useCallback(async (osId: string) => {
    setLoading(true);
    setData(null);
    try {
      const result = await serviceOrdersApi.getAlerts(osId);
      setData(result);
    } catch {
      toast.error('Error al cargar el análisis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOs) load(selectedOs.id);
    else setData(null);
  }, [selectedOs, load]);

  const border = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)';

  const risk       = data ? RISK_CFG[data.riskLevel] : null;
  const acts       = data?.activitySummary;
  const visits     = data?.visits;
  const timeline   = data?.timeline;
  const modules    = data?.modules ?? [];
  const recs       = data?.recommendations ?? [];
  const preds      = data?.predictions;
  const tickets    = data?.tickets;
  const critAlerts = data?.alerts.filter(a => a.level === 'critico').length ?? 0;
  const warnAlerts = data?.alerts.filter(a => a.level === 'advertencia').length ?? 0;

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.12)' }}>
            <Sparkles className="w-5 h-5" style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Análisis de implementación
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Alertas · predicciones · avance por módulo · recomendaciones
            </p>
          </div>
        </div>
      </div>

      {/* ── OS Selector ─────────────────────────────────────────────────────── */}
      <div className="px-6 pb-4 shrink-0 flex items-center gap-3">
        <OsSelector value={selectedOs} onChange={setSelectedOs} />
        {selectedOs && (
          <button onClick={() => load(selectedOs.id)} disabled={loading}
            className="p-2 rounded-xl transition-colors hover:bg-white/5 disabled:opacity-50"
            style={{ border: `1px solid ${border}`, color: 'var(--text-muted)' }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">

        {!selectedOs && !loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.08)', border: `1px solid ${border}` }}>
              <Sparkles className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Selecciona una orden de servicio para ver el análisis completo
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#6366f1' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Analizando datos…</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-7 max-w-5xl">

            {/* ── 1. OS Header ──────────────────────────────────────────── */}
            <div className="rounded-2xl p-5"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Building2 className="w-4 h-4" style={{ color: '#60a5fa' }} />
                    <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      {data.os.client?.businessName ?? '—'}
                    </span>
                    {data.os.client?.nit && (
                      <span className="text-xs px-2 py-0.5 rounded-md"
                        style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa' }}>
                        NIT {data.os.client.nit}
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    OS {data.os.osNumber} · {data.os.product}
                  </p>
                  {(data.os.startDate || data.os.endDate) && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Calendar className="w-3 h-3" />
                      {fmt(data.os.startDate)} → {fmt(data.os.endDate)}
                    </p>
                  )}
                  {data.project && (
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Layers className="w-3 h-3" />
                      Proyecto: {data.project.name}
                    </p>
                  )}
                </div>

                {risk && (() => {
                  const Icon = risk.icon;
                  return (
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                        style={{ background: risk.bg, border: `1px solid ${risk.border}` }}>
                        <Icon className="w-5 h-5" style={{ color: risk.color }} />
                        <span className="text-sm font-bold" style={{ color: risk.color }}>{risk.label}</span>
                      </div>
                      {(critAlerts > 0 || warnAlerts > 0) && (
                        <div className="flex gap-2 text-xs">
                          {critAlerts > 0 && (
                            <span className="px-2 py-0.5 rounded-md font-bold"
                              style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                              {critAlerts} crítica{critAlerts !== 1 ? 's' : ''}
                            </span>
                          )}
                          {warnAlerts > 0 && (
                            <span className="px-2 py-0.5 rounded-md font-bold"
                              style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}>
                              {warnAlerts} advertencia{warnAlerts !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {data.project && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                      Avance general del proyecto
                    </span>
                    <span className="text-sm font-bold" style={{ color: '#6366f1' }}>
                      {Number(data.project.progressPercent).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.min(Number(data.project.progressPercent), 100)}%`,
                               background: 'linear-gradient(90deg,#6366f1,#60a5fa)' }} />
                  </div>
                </div>
              )}
            </div>

            {/* ── 2. Probabilidad (si existe) ───────────────────────────── */}
            {preds?.probabilidadExito != null && (
              <ProbabilityGauge pct={preds.probabilidadExito} />
            )}

            {/* ── 3. KPI Grid ───────────────────────────────────────────── */}
            {acts && (
              <div>
                <SectionTitle icon={BarChart3} title="Indicadores clave" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Actividades" value={`${acts.done}/${acts.total}`}
                    sub="completadas del total" color="#6366f1" icon={ListChecks} />
                  <KpiCard label="En progreso" value={acts.inProgress}
                    sub="actividades activas" color="#60a5fa" icon={Activity} />
                  <KpiCard label="Vencidas" value={acts.overdue}
                    sub="fuera de plazo" color={acts.overdue > 0 ? '#f59e0b' : '#10b981'}
                    icon={AlertTriangle} accent={acts.overdue > 0} />
                  <KpiCard label="Bloqueadas" value={acts.blocked}
                    sub="requieren atención" color={acts.blocked > 0 ? '#ef4444' : '#10b981'}
                    icon={Ban} accent={acts.blocked > 0} />
                </div>
                {visits && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <KpiCard label="Visitas total"    value={visits.total}
                      sub={`${visits.completed} realizadas`} color="#8b5cf6" icon={CalendarCheck} />
                    <KpiCard label="Confirmadas"      value={visits.confirmed}
                      sub="por el cliente" color="#06b6d4" icon={CheckCheck} />
                    <KpiCard label="Próximas"         value={visits.upcoming}
                      sub="programadas" color={visits.upcoming > 0 ? '#10b981' : '#94a3b8'} icon={CalendarClock} />
                    <KpiCard label="Canceladas"       value={visits.cancelled}
                      sub="sin reagendar" color={visits.cancelled > 0 ? '#f59e0b' : '#10b981'}
                      icon={AlertTriangle} accent={visits.cancelled > 0} />
                  </div>
                )}
              </div>
            )}

            {/* ── 4. Predicciones ───────────────────────────────────────── */}
            {preds && preds.totalActividades > 0 && (
              <div>
                <SectionTitle icon={TrendingUp} title="Predicciones al ritmo actual" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <KpiCard label="Ritmo semanal"  value={`${preds.ritmoActividadesSemana}/sem`}
                    sub="actividades por semana" color="#6366f1" icon={Zap} />
                  <KpiCard label="Fin estimado"   value={preds.fechaEstimadaFin ? fmt(preds.fechaEstimadaFin) : 'Indefinido'}
                    sub={preds.diasDeRetraso != null
                      ? preds.diasDeRetraso > 0
                        ? `⚠ ${preds.diasDeRetraso}d de retraso`
                        : `✓ ${Math.abs(preds.diasDeRetraso)}d adelantado`
                      : undefined}
                    color={preds.diasDeRetraso != null && preds.diasDeRetraso > 0 ? '#f59e0b' : '#10b981'}
                    icon={Flag} accent={!!(preds.diasDeRetraso != null && preds.diasDeRetraso > 0)} />
                  <KpiCard label="Restantes"      value={preds.actividadesRestantes}
                    sub={`de ${preds.totalActividades} actividades`} color="#60a5fa" icon={Target} />
                </div>
              </div>
            )}

            {/* ── 5. Charts Row ─────────────────────────────────────────── */}
            {(modules.length > 0 || (acts && acts.total > 0)) && (
              <div>
                <SectionTitle icon={Layers} title="Avance por módulo" />
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {modules.length > 0 && (
                    <div className="lg:col-span-3 rounded-2xl p-4"
                      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
                        Progreso por módulo
                      </p>
                      <ModuleProgressChart modules={modules} isLight={isLight} />
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        {[
                          { color: '#10b981', label: 'Completado' },
                          { color: '#6366f1', label: 'En progreso' },
                          { color: '#94a3b8', label: 'Pendiente' },
                          { color: '#ef4444', label: 'En riesgo' },
                        ].map(l => (
                          <div key={l.label} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {acts && acts.total > 0 && (
                    <div className={`rounded-2xl p-4 ${modules.length > 0 ? 'lg:col-span-2' : 'lg:col-span-5'}`}
                      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                        Distribución de actividades
                      </p>
                      <ActivityDonut summary={acts} isLight={isLight} />
                      {acts.overdue > 0 && (
                        <div className="mt-2 rounded-lg px-3 py-2 text-xs font-medium"
                          style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b',
                                   border: '1px solid rgba(245,158,11,0.20)' }}>
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          {acts.overdue} actividad{acts.overdue !== 1 ? 'es' : ''} fuera de plazo
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── 6. Timeline ───────────────────────────────────────────── */}
            {timeline && data.project && (
              <div>
                <SectionTitle icon={Calendar} title="Análisis de cronograma" />
                <div className="rounded-2xl p-5"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                  <TimelineCard
                    timeline={timeline}
                    progressPercent={Number(data.project.progressPercent)}
                    isLight={isLight}
                  />
                </div>
              </div>
            )}

            {/* ── 7. Recommendations ────────────────────────────────────── */}
            {recs.length > 0 && (
              <div>
                <SectionTitle icon={Lightbulb} title="Recomendaciones de acción" />
                <div className="space-y-2">
                  {recs.map((rec, i) => <RecommendationItem key={i} rec={rec} i={i} />)}
                </div>
              </div>
            )}

            {/* ── 8. Alerts ─────────────────────────────────────────────── */}
            <div>
              <SectionTitle icon={ShieldAlert}
                title={data.alerts.length > 0 ? `Alertas activas (${data.alerts.length})` : 'Alertas'} />
              {data.alerts.length > 0 ? (
                <div className="space-y-2">
                  {data.alerts.map((a, i) => <AlertItem key={i} alert={a} />)}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl px-5 py-4"
                  style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.20)' }}>
                  <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: '#10b981' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#10b981' }}>Sin alertas activas</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      La implementación avanza sin problemas detectados en este momento.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── 9. Tickets / Requerimientos ────────────────────────────── */}
            {tickets && tickets.total > 0 && (
              <div>
                <SectionTitle icon={Ticket} title={`Requerimientos / Tickets (${tickets.total})`} />

                {/* KPIs de tickets */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <KpiCard label="Total tickets"  value={tickets.total}
                    sub="asociados a la OS" color="#8b5cf6" icon={Ticket} />
                  <KpiCard label="Pendientes"     value={tickets.pendientes}
                    sub="sin entrega" color={tickets.pendientes > 0 ? '#f59e0b' : '#10b981'}
                    icon={Clock} accent={tickets.pendientes > 0} />
                  <KpiCard label="Entregados"     value={tickets.entregados}
                    sub="resueltos" color="#10b981" icon={CheckCheck} />
                  <KpiCard label="Alta prioridad" value={tickets.altaPrioridad}
                    sub="requieren atención" color={tickets.altaPrioridad > 0 ? '#ef4444' : '#10b981'}
                    icon={TriangleAlert} accent={tickets.altaPrioridad > 0} />
                </div>

                {/* Tabla de tickets */}
                <div className="rounded-2xl overflow-hidden"
                  style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
                  <div className="px-4 py-3 border-b flex items-center justify-between"
                    style={{ borderColor: 'var(--card-border)' }}>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Listado de requerimientos
                    </p>
                    {tickets.devueltos > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-md font-bold"
                        style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c' }}>
                        <ArrowLeftRight className="w-3 h-3 inline mr-1" />
                        {tickets.devueltos} devuelto{tickets.devueltos !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                    {tickets.list.map(t => {
                      const estadoColor = TICKET_ESTADO_COLOR[t.estadoActual] ?? '#94a3b8';
                      const prioColor  = TICKET_PRIO_COLOR[t.prioridad]    ?? '#94a3b8';
                      return (
                        <div key={t.id} className="px-4 py-3 flex items-start gap-3">
                          <div className="shrink-0 pt-0.5">
                            <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: prioColor }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-xs font-mono font-bold" style={{ color: '#60a5fa' }}>
                                #{t.numero}
                              </span>
                              {t.ticketRubi && (
                                <span className="text-xs font-mono" style={{ color: '#a78bfa' }}>
                                  <ExternalLink className="w-3 h-3 inline mr-0.5" />{t.ticketRubi}
                                </span>
                              )}
                              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                {t.tipo}
                              </span>
                            </div>
                            <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{t.titulo}</p>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: `${estadoColor}18`, color: estadoColor }}>
                              {t.estadoActual}
                            </span>
                            <span className="text-xs font-medium" style={{ color: prioColor }}>
                              {t.prioridad}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── 10. Module Detail Cards ─────────────────────────────────── */}
            {modules.length > 0 && (
              <div>
                <SectionTitle icon={Layers} title={`Detalle por módulo (${modules.length})`} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modules.map(m => <ModuleCard key={m.id} mod={m} />)}
                </div>
              </div>
            )}

            {!data.project && (
              <div className="flex items-center gap-3 rounded-2xl px-5 py-4"
                style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.20)' }}>
                <Info className="w-5 h-5 shrink-0" style={{ color: '#60a5fa' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Esta OS no tiene un proyecto vinculado. Los gráficos de módulos y predicciones estarán disponibles una vez creado el proyecto.
                </p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
