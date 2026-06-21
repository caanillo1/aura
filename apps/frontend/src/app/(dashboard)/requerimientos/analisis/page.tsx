'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip,
  Cell, LabelList, PieChart, Pie, Legend, LineChart, Line, CartesianGrid,
} from 'recharts';
import {
  BarChart3, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  RefreshCw, Filter, X, Info, CircleAlert, Ban, ArrowLeftRight,
  Ticket, Users, Building2, Layers, Target, Clock, Zap, ShieldAlert,
  CheckCheck, ListOrdered,
} from 'lucide-react';
import { requerimientosApi, usersApi, clientsApi } from '@/lib/api';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');

// ── Types ─────────────────────────────────────────────────────────────────────

interface Analytics {
  total: number;
  byEstado: Record<string, number>;
  byPrioridad: Record<string, number>;
  byArea: { area: string; count: number }[];
  byTipo: { tipo: string; count: number }[];
  byModulo: { name: string; count: number }[];
  byCliente: { name: string; count: number; entregados: number; devueltos: number }[];
  byAgente: { name: string; count: number; entregados: number; devueltos: number; negados: number }[];
  byMonth: { month: string; created: number; entregados: number; devueltos: number }[];
  devueltoPorBreakdown: { cliente: number; desarrollo: number; sinAtribuir: number };
  tasas: { entrega: number; devolucion: number; negacion: number; repriorizado: number };
  alerts: { level: 'critico' | 'advertencia' | 'info'; titulo: string; detalle: string }[];
  altaPrioSinEntregar: number;
  elaboradosSinPriorizar: number;
  totalDevueltos: number;
  negados: number;
  entregados: number;
  areas: string[];
  tipos: string[];
}

interface FilterState {
  clientId: string; agenteId: string; area: string; tipo: string;
  dateFrom: string; dateTo: string;
}

// ── Color maps ─────────────────────────────────────────────────────────────────

const ESTADO_COLORS: Record<string, string> = {
  Elaborado: '#60a5fa', Priorizado: '#a78bfa', Repriorizado: '#fbbf24',
  Devuelto: '#fb923c', Negado: '#f87171', Entregado: '#34d399',
};
const PRIO_COLORS: Record<string, string> = { Alta: '#ef4444', Media: '#f59e0b', Baja: '#10b981' };
const ALERT_CFG = {
  critico:     { color: '#ef4444', bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.22)',  icon: AlertTriangle },
  advertencia: { color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.22)', icon: CircleAlert  },
  info:        { color: '#60a5fa', bg: 'rgba(96,165,250,0.07)', border: 'rgba(96,165,250,0.22)', icon: Info         },
};

const CHART_PALETTE = ['#6366f1','#60a5fa','#34d399','#f59e0b','#f87171','#a78bfa','#fb923c','#10b981'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : 0;
const fmtMonth = (m: string) => dayjs(m + '-01').format('MMM YY');

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4" style={{ color: '#6366f1' }} />
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</h2>
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon: Icon, accent = false }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: accent ? `${color}10` : 'var(--card-bg)', border: `1px solid ${accent ? color + '30' : 'var(--card-border)'}`, borderTop: `3px solid ${color}` }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide truncate" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="text-2xl font-extrabold leading-none" style={{ color }}>{value}</div>
      {sub && <div className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

function AlertItem({ a }: { a: Analytics['alerts'][0] }) {
  const cfg = ALERT_CFG[a.level];
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: cfg.color }} />
      <div>
        <p className="text-sm font-semibold" style={{ color: cfg.color }}>{a.titulo}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{a.detalle}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>{title}</p>
      {children}
    </div>
  );
}

// Custom tooltip
function CustomTooltip({ active, payload, label, isLight }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: isLight ? '#fff' : '#0f172a', border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      {label && <p style={{ fontWeight: 700, marginBottom: 4, color: isLight ? '#1e293b' : '#e2e8f0' }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill ?? '#94a3b8' }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RequerimientosAnalisisPage() {
  const { theme } = useTheme();
  const isLight   = theme === 'light';
  const tickColor = isLight ? '#64748b' : '#94a3b8';

  const [data, setData]       = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    clientId: '', agenteId: '', area: '', tipo: '', dateFrom: '', dateTo: '',
  });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ ...filters });

  // Options for filter selects (populated from data)
  const [agents,  setAgents]  = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; businessName: string }[]>([]);

  const load = useCallback(async (f: FilterState) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (f.clientId)  params.clientId  = f.clientId;
      if (f.agenteId)  params.agenteId  = f.agenteId;
      if (f.area)      params.area      = f.area;
      if (f.tipo)      params.tipo      = f.tipo;
      if (f.dateFrom)  params.dateFrom  = f.dateFrom;
      if (f.dateTo)    params.dateTo    = f.dateTo;
      const res = await (requerimientosApi as any).getAnalytics(params);
      setData(res);
    } catch { toast.error('Error al cargar analítica'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load(appliedFilters);
    // Load filter options in parallel
    usersApi.listAgents({ limit: 200 }).then((r: any) => setAgents(r.data ?? [])).catch(() => {});
    clientsApi.list({ limit: 200 }).then((r: any) => setClients(r.data ?? [])).catch(() => {});
  }, [load, appliedFilters]);

  const applyFilters = () => { setAppliedFilters({ ...filters }); setShowFilters(false); };
  const clearFilters = () => {
    const empty: FilterState = { clientId: '', agenteId: '', area: '', tipo: '', dateFrom: '', dateTo: '' };
    setFilters(empty); setAppliedFilters(empty);
  };
  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length;

  if (!data && loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#6366f1' }} />
      </div>
    );
  }

  if (!data) return null;

  // Prepare chart data
  const estadoDonut = Object.entries(data.byEstado).map(([name, value]) => ({ name, value, color: ESTADO_COLORS[name] ?? '#94a3b8' }));
  const prioDonut   = Object.entries(data.byPrioridad).map(([name, value]) => ({ name, value, color: PRIO_COLORS[name] ?? '#94a3b8' }));
  const tooltipSx   = { background: isLight ? '#fff' : '#0f172a', border: `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, fontSize: 12, color: isLight ? '#1e293b' : '#e2e8f0' };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Analítica de Requerimientos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {data.total} requerimiento{data.total !== 1 ? 's' : ''} en el período seleccionado
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
              <X className="w-3 h-3" /> Limpiar filtros ({activeFilterCount})
            </button>
          )}
          <button onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-semibold"
            style={{ background: showFilters ? 'rgba(99,102,241,0.15)' : 'var(--card-bg)', color: showFilters ? '#6366f1' : 'var(--text-secondary)', border: `1px solid ${showFilters ? 'rgba(99,102,241,0.35)' : 'var(--card-border)'}` }}>
            <Filter className="w-3.5 h-3.5" /> Filtros {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <button onClick={() => load(appliedFilters)} disabled={loading}
            className="p-2 rounded-xl disabled:opacity-50"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-2xl p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Cliente</label>
            <select value={filters.clientId} onChange={e => setFilters(f => ({ ...f, clientId: e.target.value }))}
              className="text-xs rounded-xl px-2 py-1.5 w-full"
              style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: '1px solid var(--card-border)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="">Todos</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Agente</label>
            <select value={filters.agenteId} onChange={e => setFilters(f => ({ ...f, agenteId: e.target.value }))}
              className="text-xs rounded-xl px-2 py-1.5 w-full"
              style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: '1px solid var(--card-border)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="">Todos</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Área</label>
            <select value={filters.area} onChange={e => setFilters(f => ({ ...f, area: e.target.value }))}
              className="text-xs rounded-xl px-2 py-1.5 w-full"
              style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: '1px solid var(--card-border)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="">Todas</option>
              {data.areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Tipo</label>
            <select value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}
              className="text-xs rounded-xl px-2 py-1.5 w-full"
              style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: '1px solid var(--card-border)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="">Todos</option>
              {data.tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Desde</label>
            <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
              className="text-xs rounded-xl px-2 py-1.5 w-full"
              style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: '1px solid var(--card-border)', color: 'var(--text-primary)', outline: 'none' }} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Hasta</label>
            <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
              className="text-xs rounded-xl px-2 py-1.5 w-full"
              style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: '1px solid var(--card-border)', color: 'var(--text-primary)', outline: 'none' }} />
          </div>
          <div className="col-span-full flex justify-end">
            <button onClick={applyFilters}
              className="text-xs px-5 py-2 rounded-xl font-semibold"
              style={{ background: '#6366f1', color: '#fff' }}>
              Aplicar filtros
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div>
        <SectionTitle icon={BarChart3} title="Indicadores clave" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total" value={data.total} sub="requerimientos registrados" color="#6366f1" icon={Ticket} />
          <KpiCard label="Entregados" value={`${data.entregados} (${data.tasas.entrega}%)`}
            sub="tasa de entrega" color={data.tasas.entrega >= 50 ? '#10b981' : '#f59e0b'} icon={CheckCheck}
            accent={data.tasas.entrega >= 50} />
          <KpiCard label="Devueltos" value={`${data.totalDevueltos} (${data.tasas.devolucion}%)`}
            sub="tasa de devolución" color={data.tasas.devolucion > 25 ? '#ef4444' : data.tasas.devolucion > 10 ? '#f59e0b' : '#10b981'}
            icon={ArrowLeftRight} accent={data.tasas.devolucion > 10} />
          <KpiCard label="Negados" value={`${data.negados} (${data.tasas.negacion}%)`}
            sub="tasa de negación" color={data.tasas.negacion > 15 ? '#ef4444' : '#94a3b8'}
            icon={Ban} accent={data.tasas.negacion > 15} />
          <KpiCard label="Alta prio. pendientes" value={data.altaPrioSinEntregar}
            sub="sin entregar" color={data.altaPrioSinEntregar > 0 ? '#ef4444' : '#10b981'}
            icon={AlertTriangle} accent={data.altaPrioSinEntregar > 0} />
          <KpiCard label="Sin priorizar" value={data.elaboradosSinPriorizar}
            sub="en estado Elaborado" color={data.elaboradosSinPriorizar > 0 ? '#f59e0b' : '#10b981'}
            icon={Clock} accent={data.elaboradosSinPriorizar > 0} />
          <KpiCard label="Repriorizados" value={`${data.byEstado['Repriorizado'] ?? 0} (${data.tasas.repriorizado}%)`}
            sub="requirieron ajuste de prioridad" color="#fbbf24" icon={ListOrdered} />
          <KpiCard label="Devueltos por cliente" value={data.devueltoPorBreakdown.cliente}
            sub={`${data.devueltoPorBreakdown.desarrollo} por desarrollo`}
            color={data.devueltoPorBreakdown.cliente > 0 ? '#fb923c' : '#10b981'}
            icon={ArrowLeftRight} accent={data.devueltoPorBreakdown.cliente > 0} />
        </div>
      </div>

      {/* Alertas */}
      <div>
        <SectionTitle icon={ShieldAlert} title={`Alertas (${data.alerts.filter(a => a.level !== 'info').length} activas)`} />
        <div className="space-y-2">
          {data.alerts.map((a, i) => <AlertItem key={i} a={a} />)}
        </div>
      </div>

      {/* Row 1: Estado + Prioridad donuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Distribución por estado">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={estadoDonut} cx="50%" cy="46%" innerRadius={60} outerRadius={88}
                dataKey="value" paddingAngle={2} strokeWidth={0}>
                {estadoDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <ReTooltip contentStyle={tooltipSx} formatter={(v: any, name: any) => [`${v} (${pct(v, data.total)}%)`, name]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: tickColor, paddingTop: 4 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por prioridad">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={prioDonut} cx="50%" cy="46%" innerRadius={60} outerRadius={88}
                dataKey="value" paddingAngle={2} strokeWidth={0}>
                {prioDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <ReTooltip contentStyle={tooltipSx} formatter={(v: any, name: any) => [`${v} (${pct(v, data.total)}%)`, name]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: tickColor, paddingTop: 4 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Por área + Por tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Por área funcional">
          {data.byArea.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, data.byArea.length * 36 + 20)}>
              <BarChart layout="vertical" data={data.byArea} margin={{ left: 0, right: 48, top: 2, bottom: 2 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="area" width={130} tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                <ReTooltip content={(p: any) => <CustomTooltip {...p} isLight={isLight} />} />
                <Bar dataKey="count" name="Tickets" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {data.byArea.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                  <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 700, fill: tickColor }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Por tipo de requerimiento">
          {data.byTipo.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, data.byTipo.length * 36 + 20)}>
              <BarChart layout="vertical" data={data.byTipo} margin={{ left: 0, right: 48, top: 2, bottom: 2 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="tipo" width={130} tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                <ReTooltip content={(p: any) => <CustomTooltip {...p} isLight={isLight} />} />
                <Bar dataKey="count" name="Tickets" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {data.byTipo.map((_, i) => <Cell key={i} fill={CHART_PALETTE[(i + 3) % CHART_PALETTE.length]} />)}
                  <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 700, fill: tickColor }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 3: Evolución mensual */}
      {data.byMonth.length > 1 && (
        <ChartCard title="Evolución mensual">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byMonth} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'} />
              <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
              <ReTooltip content={(p: any) => <CustomTooltip {...p} label={p.label ? fmtMonth(p.label) : ''} isLight={isLight} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: tickColor }} />
              <Bar dataKey="created"    name="Registrados" fill="#6366f1" radius={[3,3,0,0]} maxBarSize={32} />
              <Bar dataKey="entregados" name="Entregados"  fill="#34d399" radius={[3,3,0,0]} maxBarSize={32} />
              <Bar dataKey="devueltos"  name="Devueltos"   fill="#fb923c" radius={[3,3,0,0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Row 4: Por cliente + Por agente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.byCliente.length > 0 && (
          <ChartCard title="Requerimientos por cliente">
            <ResponsiveContainer width="100%" height={Math.max(160, data.byCliente.length * 36 + 20)}>
              <BarChart layout="vertical" data={data.byCliente} margin={{ left: 0, right: 48, top: 2, bottom: 2 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + '…' : v} />
                <ReTooltip content={(p: any) => <CustomTooltip {...p} isLight={isLight} />} />
                <Bar dataKey="count" name="Total" fill="#6366f1" radius={[0,4,4,0]} maxBarSize={20}>
                  <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 700, fill: tickColor }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {data.byAgente.length > 0 && (
          <ChartCard title="Carga por agente">
            <ResponsiveContainer width="100%" height={Math.max(160, data.byAgente.length * 36 + 20)}>
              <BarChart layout="vertical" data={data.byAgente} margin={{ left: 0, right: 8, top: 2, bottom: 2 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 14) + '…' : v} />
                <ReTooltip content={(p: any) => <CustomTooltip {...p} isLight={isLight} />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: tickColor }} />
                <Bar dataKey="count"      name="Total"      fill="#6366f1" radius={[0,0,0,0]} maxBarSize={14} stackId="a" />
                <Bar dataKey="entregados" name="Entregados"  fill="#34d399" radius={[0,0,0,0]} maxBarSize={14} stackId="a" />
                <Bar dataKey="devueltos"  name="Devueltos"   fill="#fb923c" radius={[0,4,4,0]} maxBarSize={14} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Row 5: Módulos + Atribución devoluciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.byModulo.length > 0 && (
          <ChartCard title="Por módulo de plantilla">
            <ResponsiveContainer width="100%" height={Math.max(160, data.byModulo.length * 36 + 20)}>
              <BarChart layout="vertical" data={data.byModulo} margin={{ left: 0, right: 48, top: 2, bottom: 2 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + '…' : v} />
                <ReTooltip content={(p: any) => <CustomTooltip {...p} isLight={isLight} />} />
                <Bar dataKey="count" name="Tickets" fill="#a78bfa" radius={[0,4,4,0]} maxBarSize={20}>
                  <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 700, fill: tickColor }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Atribución de devoluciones */}
        <ChartCard title="Atribución de devoluciones">
          {data.totalDevueltos === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin devoluciones registradas</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[
                  { label: 'Por cliente',    value: data.devueltoPorBreakdown.cliente,    color: '#fb923c' },
                  { label: 'Por desarrollo', value: data.devueltoPorBreakdown.desarrollo, color: '#6366f1' },
                  { label: 'Sin atribuir',   value: data.devueltoPorBreakdown.sinAtribuir, color: '#94a3b8' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
                    <div className="text-xl font-bold" style={{ color }}>{value}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
                    <div className="text-xs font-semibold mt-1" style={{ color }}>
                      {pct(value, data.totalDevueltos)}%
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra visual */}
              {data.totalDevueltos > 0 && (
                <div>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    {data.devueltoPorBreakdown.cliente > 0 && (
                      <div style={{ width: `${pct(data.devueltoPorBreakdown.cliente, data.totalDevueltos)}%`, background: '#fb923c' }} />
                    )}
                    {data.devueltoPorBreakdown.desarrollo > 0 && (
                      <div style={{ width: `${pct(data.devueltoPorBreakdown.desarrollo, data.totalDevueltos)}%`, background: '#6366f1' }} />
                    )}
                    {data.devueltoPorBreakdown.sinAtribuir > 0 && (
                      <div style={{ width: `${pct(data.devueltoPorBreakdown.sinAtribuir, data.totalDevueltos)}%`, background: '#475569' }} />
                    )}
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    De {data.totalDevueltos} devoluciones totales
                  </p>
                </div>
              )}

              {data.devueltoPorBreakdown.sinAtribuir > 0 && (
                <div className="flex items-start gap-2 rounded-lg px-3 py-2"
                  style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)' }}>
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#94a3b8' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {data.devueltoPorBreakdown.sinAtribuir} devolución{data.devueltoPorBreakdown.sinAtribuir !== 1 ? 'es' : ''} sin responsable. Al registrar la gestión de devolución, selecciona quién devolvió para mejorar la trazabilidad.
                  </p>
                </div>
              )}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Tabla resumen por agente */}
      {data.byAgente.length > 0 && (
        <div>
          <SectionTitle icon={Users} title="Rendimiento por agente" />
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'rgba(99,102,241,0.04)' }}>
                  {['Agente', 'Total', 'Entregados', 'Devueltos', 'Negados', 'Tasa entrega'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)', fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.byAgente.map((ag, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{ag.name}</td>
                    <td className="px-4 py-2.5" style={{ color: '#6366f1' }}><strong>{ag.count}</strong></td>
                    <td className="px-4 py-2.5" style={{ color: '#34d399' }}>{ag.entregados}</td>
                    <td className="px-4 py-2.5" style={{ color: ag.devueltos > 0 ? '#fb923c' : 'var(--text-muted)' }}>{ag.devueltos}</td>
                    <td className="px-4 py-2.5" style={{ color: ag.negados > 0 ? '#f87171' : 'var(--text-muted)' }}>{ag.negados}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct(ag.entregados, ag.count)}%`, background: pct(ag.entregados, ag.count) >= 50 ? '#34d399' : '#f59e0b' }} />
                        </div>
                        <span className="font-bold" style={{ color: pct(ag.entregados, ag.count) >= 50 ? '#34d399' : '#f59e0b' }}>
                          {pct(ag.entregados, ag.count)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
