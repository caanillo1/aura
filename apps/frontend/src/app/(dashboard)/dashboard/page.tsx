'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Building2, FolderKanban, ClipboardList, Ticket, FileSignature,
  AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronRight,
  RefreshCw, Send, Mail, ShieldAlert, Filter, X, ChevronDown,
  ClipboardPlus, ListOrdered, Sparkles, Loader2, RotateCcw,
  CircleCheck, CircleAlert, OctagonAlert,
} from 'lucide-react';
import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { io } from 'socket.io-client';
import { companyApi, clientsApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────
interface KpiItem { value: number; delta: number; deltaLabel: string; }
interface DashboardData {
  kpis: {
    activeClients:     KpiItem;
    activeProjects:    KpiItem;
    pendingActivities: KpiItem;
    openTickets:       KpiItem;
    pendingActas:      KpiItem;
    overdueActivities: KpiItem;
  };
  projectsByStatus:       { status: string; count: number }[];
  activitiesByStatus:     { status: string; count: number }[];
  clientProgress:         { client: string; progress: number }[];
  implementerWorkload:    { name: string; count: number }[];
  pendingActasSignature:  {
    id: string; client: string; type: string; numero: string | null;
    fecha: string; daysPending: number; totalFirmantes: number; signedFirmantes: number;
  }[];
  upcomingActivities:     { id: string; name: string; date: string | null; client: string }[];
  ticketsByStatus:        { status: string; count: number }[];
  projectRisks:           { osNumber: string; client: string; risk: 'critico' | 'alto'; reason: string; createdAt: string }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PROJECT_STATUS_LABEL: Record<string, string> = {
  activo: 'En Ejecución', completado: 'Completados', pausado: 'Suspendidos',
  cancelado: 'Cancelados', pendiente: 'Pendientes de Inicio',
};
const PROJECT_STATUS_COLOR: Record<string, string> = {
  activo: '#34d399', completado: '#60a5fa', pausado: '#fbbf24',
  cancelado: '#f87171', pendiente: '#a78bfa',
};
const ACTIVITY_STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendientes', en_proceso: 'En Proceso', completado: 'Finalizadas',
  cancelado: 'Canceladas', vencida: 'Vencidas',
};
const ACTIVITY_STATUS_COLOR: Record<string, string> = {
  pendiente: '#60a5fa', en_proceso: '#fbbf24', completado: '#34d399',
  cancelado: '#6b7280', vencida: '#f87171',
};
const TICKET_STATUS_COLOR: Record<string, string> = {
  Elaborado: '#f87171', 'En revisión': '#fbbf24', Aprobado: '#a78bfa',
  'En desarrollo': '#60a5fa', Resuelto: '#34d399', Cancelado: '#6b7280',
};
const ACTA_TYPE_LABEL: Record<string, string> = {
  inicio: 'Inicio', visita: 'Visita', capacitacion: 'Capacitación',
  parametrizacion: 'Param.', cierre: 'Cierre', entrega_soporte: 'Soporte',
};
const RISK_META: Record<string, { label: string; color: string; bg: string }> = {
  critico: { label: 'Crítico', color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  alto:    { label: 'Alto',    color: '#f97316', bg: 'rgba(249,115,22,0.10)' },
};

const QUICK_ACCESS = [
  { label: 'Nueva Orden',   href: '/implementacion/ordenes/nueva',  icon: ClipboardPlus, color: '#3B82F6' },
  { label: 'Ver Proyectos', href: '/implementacion/proyectos',      icon: FolderKanban,  color: '#8B5CF6' },
  { label: 'Nuevo Ticket',  href: '/requerimientos/nuevo',          icon: Ticket,        color: '#F59E0B' },
  { label: 'Priorizar',     href: '/requerimientos/priorizar',      icon: ListOrdered,   color: '#22C55E' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function fmtDay(d: string | null) {
  if (!d) return { day: '—', month: '' };
  const dt = new Date(d);
  return {
    day:   dt.getUTCDate(),
    month: dt.toLocaleString('es-CO', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
  };
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'hace <1h';
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

// ── ClientSearchFilter ────────────────────────────────────────────────────────
function ClientSearchFilter({ clients, value, onChange }: {
  clients: { id: string; businessName: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) { setQuery(''); return; }
    const found = clients.find(c => c.id === value);
    if (found) setQuery(found.businessName);
  }, [value, clients]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = query.trim() ? clients.filter(c => normalize(c.businessName).includes(normalize(query))) : clients;
  const clear = () => { onChange(''); setQuery(''); setOpen(false); };

  return (
    <div ref={ref} className="relative flex flex-col gap-1 min-w-[200px]">
      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Cliente</label>
      <div className="relative flex items-center">
        <input
          type="text"
          className="input-glass rounded-xl px-3 py-2 text-sm w-full pr-8"
          placeholder="Buscar cliente…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        <span className="absolute right-2.5 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
          {value
            ? <button className="pointer-events-auto p-0.5 rounded hover:bg-white/10" onClick={clear}><X className="w-3.5 h-3.5" /></button>
            : <ChevronDown className="w-3.5 h-3.5" />
          }
        </span>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-2xl z-50"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(20px)' }}>
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            <button className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
              onClick={clear}>Todos los clientes</button>
            {filtered.length === 0
              ? <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Sin resultados</p>
              : filtered.map(c => (
                <button key={c.id}
                  className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
                  style={{
                    color: c.id === value ? '#a78bfa' : 'var(--text-primary)',
                    background: c.id === value ? 'rgba(167,139,250,0.10)' : 'transparent',
                  }}
                  onClick={() => { onChange(c.id); setQuery(c.businessName); setOpen(false); }}>
                  {c.businessName}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI Card — Stripe style ───────────────────────────────────────────────────
function KpiCard({ label, value, delta, deltaLabel, icon: Icon, color, delay = 0 }: {
  label: string; value: number; delta: number; deltaLabel: string;
  icon: React.ElementType; color: string; delay?: number;
}) {
  const positive  = delta > 0;
  const neutral   = delta === 0;
  const DeltaIcon = neutral ? Minus : positive ? TrendingUp : TrendingDown;
  const deltaColor = neutral ? 'var(--text-muted)' : positive ? '#34d399' : '#f87171';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="rounded-[20px] flex items-center gap-4 px-5 shine-on-hover"
      style={{
        height: 92,
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}28` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-2xl font-bold leading-tight tracking-tight mt-0.5" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <DeltaIcon className="w-3 h-3 shrink-0" style={{ color: deltaColor }} />
          <span className="text-[10px] font-medium" style={{ color: deltaColor }}>
            {positive ? '+' : ''}{delta} {deltaLabel}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ title, href, children, delay = 0 }: {
  title: string; href?: string; children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="rounded-[20px] p-5 flex flex-col gap-4"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{title}</p>
        {href && (
          <Link href={href}
            className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--accent-blue)' }}>
            Ver todos <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function Empty({ msg = 'Sin datos' }) {
  return <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>{msg}</p>;
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ data, colorMap, labelMap }: {
  data: { status: string; count: number }[];
  colorMap: Record<string, string>;
  labelMap: Record<string, string>;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="flex gap-4 items-center">
      <ResponsiveContainer width={130} height={130}>
        <PieChart>
          <Pie data={data} dataKey="count" innerRadius={38} outerRadius={60} paddingAngle={3} startAngle={90} endAngle={450}>
            {data.map((d, i) => <Cell key={i} fill={colorMap[d.status] ?? '#6b7280'} strokeWidth={0} />)}
          </Pie>
          <Tooltip
            formatter={(v, _, p: any) => [v, labelMap[p.payload.status] ?? p.payload.status] as [typeof v, string]}
            contentStyle={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 12,
              fontSize: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.20)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {data.map(d => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <div key={d.status} className="flex items-center gap-2 text-xs">
              <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: colorMap[d.status] ?? '#6b7280' }} />
              <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                {labelMap[d.status] ?? d.status}
              </span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{d.count}</span>
              <span className="tabular-nums w-8 text-right" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Horizontal Bar Chart ──────────────────────────────────────────────────────
function HBarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs w-32 truncate flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="h-full rounded-full" style={{ background: color }}
            />
          </div>
          <span className="text-xs font-semibold w-8 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {d.value}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── AI Insight Card ───────────────────────────────────────────────────────────
type AiInsight = { resumen: string; alertas: string[]; recomendacion: string; estado: 'verde' | 'amarillo' | 'rojo'; generadoEn: string };

const ESTADO_META = {
  verde:    { icon: CircleCheck,  color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.25)',  label: 'Operaciones normales' },
  amarillo: { icon: CircleAlert,  color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)',  label: 'Atención requerida' },
  rojo:     { icon: OctagonAlert, color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', label: 'Alerta crítica' },
};

function AiInsightCard({ filters }: { filters: { clientId?: string; agentId?: string; dateFrom?: string; dateTo?: string } }) {
  const [insight, setInsight]   = useState<AiInsight | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [expanded, setExpanded] = useState(true);
  const didFetch = useRef(false);

  const fetch = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await companyApi.getAiInsight(filters);
      setInsight(data);
    } catch {
      setError('No se pudo generar el análisis. Intenta de nuevo.');
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    fetch();
  }, [fetch]);

  const meta = insight ? ESTADO_META[insight.estado] : null;
  const StatusIcon = meta?.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-[20px] overflow-hidden"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none"
        onClick={() => setExpanded(p => !p)}
        style={{ borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Briefing Ejecutivo IA
          </span>
          {meta && StatusIcon && (
            <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
              <StatusIcon className="w-3 h-3" />
              {meta.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {insight && (
            <span className="text-[10px] hidden sm:block" style={{ color: 'var(--text-muted)' }}>
              {new Date(insight.generadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); fetch(); }}
            disabled={loading}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/8"
            title="Regenerar análisis"
            style={{ color: 'var(--text-muted)' }}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-5">
              {loading && (
                <div className="flex items-center gap-3 py-3">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: '#a78bfa' }} />
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Analizando operaciones con IA…
                  </span>
                </div>
              )}

              {error && !loading && (
                <div className="flex items-center gap-2 text-sm py-1" style={{ color: '#f87171' }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {insight && !loading && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Resumen */}
                  <div className="lg:col-span-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                      Resumen
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {insight.resumen}
                    </p>
                  </div>

                  {/* Alertas */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                      Puntos clave
                    </p>
                    <ul className="space-y-1.5">
                      {insight.alertas.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#a78bfa' }} />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recomendación */}
                  <div className="rounded-2xl px-4 py-3.5"
                    style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.2)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#a78bfa' }}>
                      Recomendación
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {insight.recomendacion}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { accessToken } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filters, setFilters] = useState({ clientId: '', agentId: '', dateFrom: '', dateTo: '' });
  const [clients, setClients] = useState<{ id: string; businessName: string }[]>([]);
  const [agents, setAgents]   = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useEffect(() => {
    clientsApi.list({ limit: 200 }).then((r: any) => setClients(r.data ?? r)).catch(() => {});
    usersApi.listAgents({ limit: 100 }).then((r: any) => setAgents(r.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const params = {
        clientId: filters.clientId || undefined,
        agentId:  filters.agentId  || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo:   filters.dateTo   || undefined,
      };
      setData(await companyApi.getDashboard(params));
    } catch { /* silently fail */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [filters]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => { const i = setInterval(() => loadRef.current(true), 30000); return () => clearInterval(i); }, []);

  useEffect(() => {
    if (!accessToken) return;
    const WS_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3001';
    const socket = io(`${WS_URL}/ws`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 2000,
    });
    socket.on('dashboard:update', () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => loadRef.current(true), 600);
    });
    socket.on('notification:new', (n: { type?: string }) => {
      const types = ['ticket', 'acta', 'proyecto', 'orden_servicio'];
      if (n?.type && types.includes(n.type)) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => loadRef.current(true), 1200);
      }
    });
    return () => { socket.disconnect(); if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  /* ── Loading skeleton ── */
  if (loading) return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton rounded-[20px]" style={{ height: 92 }} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton rounded-[20px]" style={{ height: 200 }} />
        ))}
      </div>
    </div>
  );

  if (!data) return null;

  const { kpis, projectsByStatus, activitiesByStatus, clientProgress, implementerWorkload,
          pendingActasSignature, upcomingActivities, ticketsByStatus, projectRisks } = data;

  const kpiDefs = [
    { key: 'activeClients',     label: 'Clientes Activos',       icon: Building2,     color: '#34d399', data: kpis.activeClients     },
    { key: 'activeProjects',    label: 'Proyectos Activos',      icon: FolderKanban,  color: '#60a5fa', data: kpis.activeProjects     },
    { key: 'pendingActivities', label: 'Actividades Pendientes', icon: ClipboardList, color: '#f59e0b', data: kpis.pendingActivities  },
    { key: 'openTickets',       label: 'Tickets Abiertos',       icon: Ticket,        color: '#f87171', data: kpis.openTickets        },
    { key: 'pendingActas',      label: 'Actas Pendientes',       icon: FileSignature, color: '#a78bfa', data: kpis.pendingActas       },
    { key: 'overdueActivities', label: 'Actividades Vencidas',   icon: AlertTriangle, color: '#ef4444', data: kpis.overdueActivities  },
  ] as const;

  const hasFilters = filters.clientId || filters.agentId || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-5 max-w-[1400px]">

      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Dashboard Ejecutivo
          </h2>
          <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ boxShadow: '0 0 4px #34d399' }} />
            Se actualiza en tiempo real
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all shine-on-hover"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            boxShadow: 'var(--card-shadow)',
            color: 'var(--text-secondary)',
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* ── Quick Access ── */}
      <div className="flex gap-3 flex-wrap">
        {QUICK_ACCESS.map((qa, i) => {
          const QaIcon = qa.icon;
          return (
            <Link key={qa.href} href={qa.href}>
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.04 }}
                whileHover={{ y: -3, transition: { duration: 0.18 } }}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl cursor-pointer shine-on-hover"
                style={{
                  width: 140,
                  height: 60,
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <QaIcon className="w-4 h-4" style={{ color: qa.color }} />
                <span className="text-[11px] font-medium leading-none" style={{ color: 'var(--text-secondary)' }}>
                  {qa.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>

      {/* ── Filtros ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="rounded-[20px] p-4 flex flex-wrap items-end gap-3"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex items-center gap-2 mr-1">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>Filtros</span>
        </div>

        <ClientSearchFilter clients={clients} value={filters.clientId}
          onChange={id => setFilters(f => ({ ...f, clientId: id }))} />

        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Agente</label>
          <select
            className="input-glass rounded-xl px-3 py-2 text-sm"
            value={filters.agentId}
            onChange={e => setFilters(f => ({ ...f, agentId: e.target.value }))}
          >
            <option value="">Todos los agentes</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Desde</label>
          <input type="date" className="input-glass rounded-xl px-3 py-2 text-sm"
            value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Hasta</label>
          <input type="date" className="input-glass rounded-xl px-3 py-2 text-sm"
            value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
        </div>

        {hasFilters && (
          <button
            onClick={() => setFilters({ clientId: '', agentId: '', dateFrom: '', dateTo: '' })}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-white/5"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            Limpiar
          </button>
        )}
        {hasFilters && (
          <span className="text-[11px] px-2.5 py-1 rounded-full font-medium"
            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.20)' }}>
            Filtros activos
          </span>
        )}
      </motion.div>

      {/* ── AI Insight ── */}
      <AiInsightCard filters={{
        clientId: filters.clientId || undefined,
        agentId:  filters.agentId  || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo:   filters.dateTo   || undefined,
      }} />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiDefs.map((k, i) => (
          <KpiCard key={k.key} label={k.label} value={k.data.value} delta={k.data.delta}
            deltaLabel={k.data.deltaLabel} icon={k.icon} color={k.color} delay={i * 0.05} />
        ))}
      </div>

      {/* ── Próximas Actividades | Alertas de Riesgo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Próximas Actividades" delay={0.10}>
          {upcomingActivities.length === 0
            ? <Empty msg="Sin actividades pendientes" />
            : (
              <div className="space-y-2">
                {upcomingActivities.map(a => {
                  const { day, month } = fmtDay(a.date);
                  return (
                    <div key={a.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-[14px] transition-colors"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex-shrink-0 w-10 text-center">
                        {day === '—'
                          ? <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>Sin<br/>fecha</p>
                          : <>
                              <p className="text-lg font-bold leading-none tabular-nums" style={{ color: 'var(--accent-blue)' }}>{day}</p>
                              {month && <p className="text-[9px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>{month}</p>}
                            </>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.client}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </SectionCard>

        <SectionCard title="Alertas de Riesgo" delay={0.14}>
          {projectRisks.length === 0
            ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.20)' }}>
                  <ShieldAlert className="w-5 h-5" style={{ color: '#34d399' }} />
                </div>
                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Sin notas críticas o de alto riesgo
                </p>
              </div>
            )
            : (
              <div className="space-y-1">
                <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 px-1 pb-2"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['OS', 'Cliente', 'Nivel', 'Detalle'].map(h => (
                    <span key={h} className="text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--text-muted)' }}>{h}</span>
                  ))}
                </div>
                {projectRisks.map((r, i) => {
                  const rm = RISK_META[r.risk] ?? RISK_META.alto;
                  return (
                    <div key={i}
                      className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 items-center px-1 py-2 rounded-xl transition-colors hover:bg-white/5">
                      <span className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                        {r.osNumber}
                      </span>
                      <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{r.client}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                        style={{ background: rm.bg, color: rm.color }}>
                        {rm.label}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{r.reason}</span>
                        <span className="text-[10px] shrink-0 opacity-60" style={{ color: 'var(--text-muted)' }}>
                          {timeAgo(r.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </SectionCard>
      </div>

      {/* ── Row 2: Avance | Proyectos | Actividades ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Avance por Cliente" href="/implementacion/ordenes" delay={0.12}>
          {clientProgress.length === 0
            ? <Empty msg="Sin proyectos en curso" />
            : <HBarChart data={clientProgress.map(c => ({ label: c.client, value: Math.round(c.progress) }))} color="#34d399" />
          }
        </SectionCard>

        <SectionCard title="Estado de Proyectos" href="/implementacion/proyectos" delay={0.16}>
          {projectsByStatus.length === 0
            ? <Empty msg="Sin proyectos" />
            : <DonutChart data={projectsByStatus} colorMap={PROJECT_STATUS_COLOR} labelMap={PROJECT_STATUS_LABEL} />
          }
        </SectionCard>

        <SectionCard title="Actividades por Estado" delay={0.20}>
          {activitiesByStatus.length === 0
            ? <Empty msg="Sin actividades" />
            : <DonutChart data={activitiesByStatus} colorMap={ACTIVITY_STATUS_COLOR} labelMap={ACTIVITY_STATUS_LABEL} />
          }
        </SectionCard>
      </div>

      {/* ── Row 3: Carga | Actas | Tickets ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Carga por Implementador" delay={0.22}>
          {implementerWorkload.length === 0
            ? <Empty />
            : (
              <div className="space-y-2.5">
                {implementerWorkload.map((iw, i) => {
                  const max      = implementerWorkload[0]?.count ?? 1;
                  const initials = iw.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ background: 'linear-gradient(135deg,#2563EB,#6366F1)' }}>
                        {initials}
                      </div>
                      <span className="text-xs w-28 truncate shrink-0" style={{ color: 'var(--text-secondary)' }}>{iw.name}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(iw.count / max) * 100}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          className="h-full rounded-full" style={{ background: '#60a5fa' }} />
                      </div>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{iw.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
        </SectionCard>

        <SectionCard title="Actas Pendientes de Firma" href="/implementacion/proyectos" delay={0.26}>
          {pendingActasSignature.length === 0
            ? <Empty msg="Sin actas pendientes" />
            : (
              <div className="space-y-1">
                {/* Cabecera tabla */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-2 px-1 pb-2"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Cliente', 'Tipo', 'Firmas', 'Días', ''].map(h => (
                    <span key={h} className="text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'var(--text-muted)' }}>{h}</span>
                  ))}
                </div>
                {pendingActasSignature.slice(0, 5).map(a => (
                  <div key={a.id}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-2 items-center px-1 py-2 rounded-xl transition-colors hover:bg-white/5">
                    <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{a.client}</span>
                    <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {ACTA_TYPE_LABEL[a.type] ?? a.type}
                    </span>
                    <span className="text-xs text-center tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {a.signedFirmantes}/{a.totalFirmantes}
                    </span>
                    <span className="text-xs font-semibold text-right tabular-nums"
                      style={{ color: a.daysPending > 5 ? '#ef4444' : a.daysPending > 2 ? '#f97316' : '#34d399' }}>
                      {a.daysPending}d
                    </span>
                    <div className="flex gap-1">
                      <button className="p-1 rounded-lg hover:bg-green-500/10 transition-colors" title="WhatsApp">
                        <Send className="w-3 h-3" style={{ color: '#34d399' }} />
                      </button>
                      <button className="p-1 rounded-lg hover:bg-blue-500/10 transition-colors" title="Email">
                        <Mail className="w-3 h-3" style={{ color: '#60a5fa' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>

        <SectionCard title="Tickets" href="/requerimientos/priorizar" delay={0.30}>
          {ticketsByStatus.length === 0
            ? <Empty msg="Sin tickets" />
            : <DonutChart
                data={ticketsByStatus.map(t => ({ status: t.status, count: t.count }))}
                colorMap={TICKET_STATUS_COLOR}
                labelMap={{}} />
          }
        </SectionCard>
      </div>

    </div>
  );
}
