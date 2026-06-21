'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import {
  Sparkles, Search, X, RefreshCw, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, TrendingDown,
  Activity, Calendar, Target, Zap, ChevronRight,
  Building2, BarChart3, CircleAlert, Info,
} from 'lucide-react';
import { serviceOrdersApi } from '@/lib/api';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');

// ── Types ─────────────────────────────────────────────────────────────────────

interface OsOption { id: string; osNumber: string; product: string; client?: { businessName: string } | null; status: string }
type RiskLevel = 'alto' | 'medio' | 'normal';
type AlertLevel = 'critico' | 'advertencia' | 'info';

interface Alert { level: AlertLevel; tipo: string; titulo: string; detalle: string }
interface Predictions {
  ritmoActividadesSemana: number;
  actividadesCompletadas: number;
  actividadesRestantes: number;
  totalActividades: number;
  fechaEstimadaFin: string | null;
  diasDeRetraso: number | null;
  probabilidadExito: number | null;
}
interface AnalysisData {
  os: { id: string; osNumber: string; product: string; status: string; startDate: string | null; endDate: string | null; client?: { businessName: string; nit?: string } | null };
  project: { name: string; status: string; progressPercent: number } | null;
  riskLevel: RiskLevel;
  alerts: Alert[];
  predictions: Predictions;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (s?: string | null) => s ? dayjs(s).format('DD/MM/YYYY') : '—';

const RISK_CFG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  alto:   { label: 'Riesgo Alto',   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   icon: AlertTriangle },
  medio:  { label: 'Riesgo Medio',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)',  icon: CircleAlert   },
  normal: { label: 'Sin alertas',   color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)', icon: CheckCircle2  },
};

const ALERT_CFG: Record<AlertLevel, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  critico:    { color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.20)',  icon: AlertTriangle },
  advertencia:{ color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.20)', icon: CircleAlert   },
  info:       { color: '#60a5fa', bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.20)', icon: Info          },
};

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', en_curso: 'En curso', completada: 'Completada',
  cancelada: 'Cancelada', suspendida: 'Suspendida',
  activo: 'Activo', completado: 'Completado',
};

// ── OS Selector ───────────────────────────────────────────────────────────────

function OsSelector({ value, onChange }: { value: OsOption | null; onChange: (v: OsOption | null) => void }) {
  const { theme } = useTheme();
  const isLight   = theme === 'light';
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
  const border  = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)';

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
            style={{ background: surface, border: `1px solid ${border}` }}>
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

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl p-4"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderTop: `3px solid ${color}` }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="text-2xl font-extrabold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

// ── Probability Bar ───────────────────────────────────────────────────────────

function ProbabilityGauge({ pct }: { pct: number }) {
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const label = pct >= 70 ? 'Alta' : pct >= 40 ? 'Media' : 'Baja';
  return (
    <div className="flex flex-col gap-2 rounded-2xl p-4"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderTop: `3px solid ${color}` }}>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Target className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Probabilidad de éxito
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-extrabold" style={{ color }}>{pct}%</span>
        <span className="text-xs font-semibold pb-0.5" style={{ color }}>{label}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
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
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{alert.detalle}</p>
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

  const border  = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.12)' }}>
            <Sparkles className="w-5 h-5" style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Análisis</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Alertas inteligentes y predicciones por orden de servicio
            </p>
          </div>
        </div>
      </div>

      {/* OS Selector */}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {!selectedOs && !loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.08)', border: `1px solid ${border}` }}>
              <Sparkles className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Selecciona una orden de servicio para ver el análisis
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#6366f1' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Analizando…</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-6 max-w-4xl">

            {/* OS Header */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4" style={{ color: '#60a5fa' }} />
                    <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      {data.os.client?.businessName ?? '—'}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    OS {data.os.osNumber} · {data.os.product}
                  </p>
                  {(data.os.startDate || data.os.endDate) && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {fmt(data.os.startDate)} → {fmt(data.os.endDate)}
                    </p>
                  )}
                </div>

                {/* Risk badge */}
                {(() => {
                  const cfg  = RISK_CFG[data.riskLevel];
                  const Icon = cfg.icon;
                  return (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                      <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                      <span className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Progress bar */}
              {data.project && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                      {data.project.name}
                    </span>
                    <span className="text-xs font-bold" style={{ color: '#6366f1' }}>
                      {Number(data.project.progressPercent).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.min(Number(data.project.progressPercent), 100)}%`,
                               background: 'linear-gradient(90deg,#6366f1,#60a5fa)' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Alerts */}
            {data.alerts.length > 0 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide mb-3 flex items-center gap-2"
                  style={{ color: 'var(--text-muted)' }}>
                  <AlertTriangle className="w-4 h-4" />
                  {data.alerts.length} alerta{data.alerts.length !== 1 ? 's' : ''} detectada{data.alerts.length !== 1 ? 's' : ''}
                </h2>
                <div className="space-y-2">
                  {data.alerts.map((a, i) => <AlertItem key={i} alert={a} />)}
                </div>
              </div>
            )}

            {data.alerts.length === 0 && (
              <div className="flex items-center gap-3 rounded-2xl px-5 py-4"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.20)' }}>
                <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: '#10b981' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#10b981' }}>Sin alertas activas</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    La implementación avanza sin problemas detectados.
                  </p>
                </div>
              </div>
            )}

            {/* Predictions */}
            {data.predictions && data.predictions.totalActividades > 0 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide mb-3 flex items-center gap-2"
                  style={{ color: 'var(--text-muted)' }}>
                  <TrendingUp className="w-4 h-4" />
                  Predicciones al ritmo actual
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <KpiCard
                    label="Ritmo"
                    value={`${data.predictions.ritmoActividadesSemana}/sem`}
                    sub="Actividades por semana"
                    color="#6366f1"
                    icon={Activity}
                  />
                  <KpiCard
                    label="Restantes"
                    value={data.predictions.actividadesRestantes}
                    sub={`de ${data.predictions.totalActividades} actividades`}
                    color="#60a5fa"
                    icon={BarChart3}
                  />
                  {data.predictions.fechaEstimadaFin && (
                    <KpiCard
                      label="Fin estimado"
                      value={fmt(data.predictions.fechaEstimadaFin)}
                      sub={data.predictions.diasDeRetraso != null
                        ? data.predictions.diasDeRetraso > 0
                          ? `⚠ ${data.predictions.diasDeRetraso}d de retraso`
                          : `✓ ${Math.abs(data.predictions.diasDeRetraso)}d adelantado`
                        : undefined}
                      color={data.predictions.diasDeRetraso != null && data.predictions.diasDeRetraso > 0 ? '#f59e0b' : '#10b981'}
                      icon={data.predictions.diasDeRetraso != null && data.predictions.diasDeRetraso > 0 ? TrendingDown : TrendingUp}
                    />
                  )}
                  {data.predictions.probabilidadExito != null && (
                    <div className="col-span-2 md:col-span-3">
                      <ProbabilityGauge pct={data.predictions.probabilidadExito} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No project warning */}
            {!data.project && (
              <div className="flex items-center gap-3 rounded-2xl px-5 py-4"
                style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.20)' }}>
                <Info className="w-5 h-5 shrink-0" style={{ color: '#60a5fa' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Esta OS no tiene un proyecto vinculado. Las predicciones estarán disponibles una vez creado el proyecto.
                </p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
