'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  CheckSquare, RefreshCw, Search, X, ChevronDown,
  Clock, CheckCircle2, Loader2, Ban, AlertTriangle,
  User, Building2, Layers, GitBranch, Activity,
} from 'lucide-react';
import { projectsApi } from '@/lib/api';
import type { GlobalActivity } from '@/types';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.locale('es');
dayjs.extend(relativeTime);

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

type DatePreset = 'today' | 'yesterday' | 'last7' | 'month' | 'custom';

interface DateRange { from: string; to: string }

function presetToRange(preset: DatePreset, custom: DateRange): DateRange {
  const today = dayjs().format('YYYY-MM-DD');
  if (preset === 'today')     return { from: today,                             to: today };
  if (preset === 'yesterday') return { from: dayjs().subtract(1, 'd').format('YYYY-MM-DD'), to: dayjs().subtract(1, 'd').format('YYYY-MM-DD') };
  if (preset === 'last7')     return { from: dayjs().subtract(6, 'd').format('YYYY-MM-DD'), to: today };
  if (preset === 'month')     return { from: dayjs().startOf('month').format('YYYY-MM-DD'), to: today };
  return custom;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  completado:   { label: 'Completado',  color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: CheckCircle2  },
  en_progreso:  { label: 'En progreso', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  icon: Activity      },
  bloqueado:    { label: 'Bloqueado',   color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: Ban           },
};

const ALL_STATUSES = ['completado', 'en_progreso', 'bloqueado'];

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today',     label: 'Hoy'           },
  { id: 'yesterday', label: 'Ayer'          },
  { id: 'last7',     label: 'Últimos 7 días' },
  { id: 'month',     label: 'Mes actual'    },
  { id: 'custom',    label: 'Rango libre'   },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ActividadesRealizadasPage() {
  // Filters
  const [preset, setPreset]           = useState<DatePreset>('today');
  const [customRange, setCustomRange] = useState<DateRange>({ from: '', to: '' });
  const [statuses, setStatuses]       = useState<string[]>([...ALL_STATUSES]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [clientOpen, setClientOpen]   = useState(false);
  const clientRef = useRef<HTMLDivElement>(null);

  // Data
  const [activities, setActivities] = useState<GlobalActivity[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [page, setPage]             = useState(1);
  const LIMIT = 50;

  // Derived date range
  const dateRange = useMemo(() => presetToRange(preset, customRange), [preset, customRange]);

  // Distinct clients from loaded data (for combobox)
  const allClients = useMemo(() => {
    const map = new Map<string, string>();
    activities.forEach(a => {
      const c = a.phase.projectModule.project.serviceOrder.client;
      map.set(c.id, c.businessName);
    });
    return [...map.entries()].map(([id, businessName]) => ({ id, businessName }));
  }, [activities]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return allClients;
    const q = normalize(clientSearch);
    return allClients.filter(c => normalize(c.businessName).includes(q));
  }, [allClients, clientSearch]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetch = useCallback(async (p = 1) => {
    if (statuses.length === 0) { setActivities([]); setTotal(0); return; }
    setLoading(true);
    try {
      const params: any = {
        status: statuses,
        page: p,
        limit: LIMIT,
      };
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

  useEffect(() => { fetch(1); }, [fetch]);

  // Close client dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setClientOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toggleStatus(s: string) {
    setStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    setPage(1);
  }

  function selectClient(id: string, name: string) {
    setSelectedClientId(id);
    setSelectedClientName(name);
    setClientSearch('');
    setClientOpen(false);
  }

  function clearClient() {
    setSelectedClientId(null);
    setSelectedClientName('');
    setClientSearch('');
  }

  const hasMore = activities.length < total;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
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
        <button
          onClick={() => fetch(1)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-4 space-y-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>

        {/* Date presets */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Período:</span>
          {DATE_PRESETS.map(p => (
            <button key={p.id}
              onClick={() => { setPreset(p.id); setPage(1); }}
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Estado:</span>
            {ALL_STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s];
              const active = statuses.includes(s);
              const Icon = cfg.icon;
              return (
                <button key={s}
                  onClick={() => toggleStatus(s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={active
                    ? { background: cfg.bg, border: `1px solid ${cfg.color}40`, color: cfg.color }
                    : { background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', opacity: 0.6 }}>
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.label}
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
                  <p className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    {activities.length === 0 ? 'Carga actividades primero' : 'Sin resultados'}
                  </p>
                ) : (
                  <ul className="max-h-52 overflow-y-auto">
                    {filteredClients.map(c => (
                      <li key={c.id}>
                        <button
                          className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
                          style={{ color: 'var(--text-primary)' }}
                          onClick={() => selectClient(c.id, c.businessName)}>
                          <Building2 className="w-3.5 h-3.5 inline mr-2 opacity-50" />
                          {c.businessName}
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

      {/* Table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--border-subtle)', background: 'var(--card-bg)' }}>
        {loading && activities.length === 0 ? (
          <div className="flex items-center justify-center py-20 gap-2" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando actividades…</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertTriangle className="w-8 h-8" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No hay actividades para los filtros seleccionados
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
                    {['Actividad', 'Empresa / OS', 'Módulo', 'Fase', 'Implementador', 'Estado', 'Progreso', 'Actualizado'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a, i) => {
                    const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.completado;
                    const Icon = cfg.icon;
                    const so = a.phase.projectModule.project.serviceOrder;
                    const implementor = a.assignedTo
                      ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}`
                      : '—';
                    return (
                      <tr key={a.id}
                        className="transition-colors hover:bg-white/3"
                        style={{ borderBottom: i < activities.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                        {/* Actividad */}
                        <td className="px-4 py-3 max-w-[260px]">
                          <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
                          {a.code && <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>{a.code}</p>}
                        </td>
                        {/* Empresa / OS */}
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{so.client.businessName}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{so.osNumber}</p>
                        </td>
                        {/* Módulo */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                            <span className="truncate max-w-[140px]" style={{ color: 'var(--text-secondary)' }}>
                              {a.phase.projectModule.name}
                            </span>
                          </div>
                        </td>
                        {/* Fase */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <GitBranch className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                            <span className="truncate max-w-[140px]" style={{ color: 'var(--text-secondary)' }}>
                              {a.phase.name}
                            </span>
                          </div>
                        </td>
                        {/* Implementador */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{implementor}</span>
                          </div>
                        </td>
                        {/* Estado */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                            style={{ background: cfg.bg, color: cfg.color }}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        {/* Progreso */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                              style={{ background: 'var(--surface-2)' }}>
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${a.progressPercent}%`, background: cfg.color }} />
                            </div>
                            <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--text-muted)' }}>
                              {Math.round(Number(a.progressPercent))}%
                            </span>
                          </div>
                        </td>
                        {/* Actualizado */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                            <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                              {dayjs(a.updatedAt).fromNow()}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="px-4 py-3 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => fetch(page + 1)}
                  disabled={loading}
                  className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loading ? 'Cargando…' : `Cargar más (${total - activities.length} restantes)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
