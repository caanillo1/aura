'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Search, RefreshCw, FolderKanban, User, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { projectsApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';
import type { Project } from '@/types';

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  activo:     { color: '#34d399', bg: 'rgba(52,211,153,0.12)',   label: 'Activo'     },
  pausado:    { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   label: 'Pausado'    },
  completado: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'Completado' },
  cancelado:  { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Cancelado'  },
};

export default function ProyectosPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { user } = useAuthStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [fStatus, setFStatus]   = useState('');
  const [agentId, setAgentId]   = useState<string>(() => useAuthStore.getState().user?.id ?? '');
  const [agents, setAgents]     = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [loading, setLoading]   = useState(true);

  const router = useRouter();

  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  const tableStyle = {
    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.10)'}`,
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: isLight
      ? '0 8px 32px rgba(30,60,120,0.18), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  };

  const rowBorder = isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)';
  const headBg    = isLight ? 'rgba(30,60,120,0.06)' : 'rgba(255,255,255,0.03)';

  // Cargar agentes y defaultear al usuario logueado
  useEffect(() => {
    usersApi.listAgents({ limit: 200 }).then(r => {
      setAgents(r.data);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectsApi.list({
        page, limit: 15,
        search:  search  || undefined,
        status:  fStatus || undefined,
        agentId: agentId || undefined,
      });
      setProjects(res.data);
      setTotal(res.meta.total);
    } catch { toast.error('Error al cargar proyectos'); }
    finally { setLoading(false); }
  }, [page, search, fStatus, agentId]);

  useEffect(() => { load(); }, [load]);

  // Determina el rol del agente filtrado en cada proyecto
  const leaderRole = (p: any): 'clinico' | 'financiero' | 'ambos' | null => {
    if (!agentId) return null;
    const so = p.serviceOrder;
    const isClinical   = so?.clinicalLeaderId   === agentId;
    const isFinancial  = so?.financialLeaderId  === agentId;
    if (isClinical && isFinancial) return 'ambos';
    if (isClinical)  return 'clinico';
    if (isFinancial) return 'financiero';
    return null;
  };

  const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    clinico:    { label: 'Líder clínico',    color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
    financiero: { label: 'Líder financiero', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
    ambos:      { label: 'Ambos líderes',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  };

  const currentAgentLabel = (() => {
    if (!agentId) return 'Todos los agentes';
    if (agentId === user?.id) return 'Mis proyectos';
    const a = agents.find(a => a.id === agentId);
    return a ? `${a.firstName} ${a.lastName}` : 'Agente seleccionado';
  })();

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: tc.p }}>
            <FolderKanban className="w-5 h-5 text-violet-400" /> Proyectos
          </h2>
          <p className="text-sm mt-0.5" style={{ color: tc.m }}>{total} proyecto{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: tc.m }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, cliente, OS..."
            className="input-glass w-full rounded-xl pl-9 pr-4 py-2.5 text-sm" />
        </div>

        <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }}
          className="input-glass rounded-xl px-4 py-2.5 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Filtro por agente */}
        <div className="relative flex items-center gap-1">
          <div className="flex items-center gap-2 input-glass rounded-xl px-3 py-2 text-sm"
            style={{ border: agentId === user?.id ? '1px solid rgba(167,139,250,0.40)' : undefined }}>
            <User className="w-3.5 h-3.5 shrink-0" style={{ color: agentId ? '#a78bfa' : tc.m }} />
            <select
              value={agentId}
              onChange={e => { setAgentId(e.target.value); setPage(1); }}
              className="bg-transparent outline-none text-sm pr-1"
              style={{ color: agentId ? '#a78bfa' : tc.s, minWidth: 130 }}
            >
              <option value="">Todos los agentes</option>
              {user?.id && (
                <option value={user.id}>
                  Mis proyectos
                </option>
              )}
              {agents.filter(a => a.id !== user?.id).map(a => (
                <option key={a.id} value={a.id}>
                  {a.firstName} {a.lastName}
                </option>
              ))}
            </select>
          </div>
          {agentId && agentId !== user?.id && (
            <button onClick={() => { setAgentId(user?.id ?? ''); setPage(1); }}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
              title="Volver a mis proyectos"
              style={{ color: tc.m }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button onClick={load} className="p-2.5 rounded-xl transition-colors" style={{ color: tc.m }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Badge de contexto */}
      {agentId && (
        <div className="flex items-center gap-2 text-xs" style={{ color: tc.m }}>
          <span className="px-2.5 py-1 rounded-full font-medium"
            style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.22)' }}>
            {currentAgentLabel}
          </span>
          {agentId === user?.id && (
            <span style={{ color: tc.m }}>— Proyectos donde eres líder clínico o financiero</span>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-2xl overflow-hidden" style={tableStyle}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr style={{ borderBottom: rowBorder, background: headBg }}>
              {['Proyecto', 'Cliente', 'OS Vinculada', 'Rol', 'Estado', 'Progreso', 'Fechas', ''].map(h => (
                <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: tc.m }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: rowBorder }}>
                    <td colSpan={8} className="px-4 py-3.5">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />
                    </td>
                  </tr>
                ))
              : projects.map((p, i) => {
                  const ss   = STATUS_STYLE[p.status] ?? STATUS_STYLE.activo;
                  const pct  = Number(p.progressPercent ?? 0);
                  const role = leaderRole(p);
                  const rb   = role ? ROLE_BADGE[role] : null;
                  return (
                    <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      style={{ borderBottom: rowBorder }}
                      className="transition-colors cursor-pointer"
                      onClick={() => router.push(`/implementacion/proyectos/${p.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = isLight ? 'rgba(30,60,120,0.03)' : 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-sm" style={{ color: tc.p }}>{p.name}</p>
                        {(p as any).description && (
                          <p className="text-xs truncate max-w-[160px]" style={{ color: tc.m }}>{(p as any).description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm" style={{ color: tc.s }}>{p.serviceOrder?.client?.businessName ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs" style={{ color: '#60a5fa' }}>
                          {p.serviceOrder?.osNumber ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {rb ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                            style={{ background: rb.bg, color: rb.color, border: `1px solid ${rb.color}35` }}>
                            {rb.label}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: tc.m }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit"
                          style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}40` }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ss.color }} />
                          {ss.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #60a5fa, #a78bfa)' }} />
                          </div>
                          <span className="text-xs font-medium shrink-0" style={{ color: tc.m }}>{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs" style={{ color: tc.m }}>
                          {new Date(p.startDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' })}
                        </p>
                        <p className="text-xs" style={{ color: tc.m }}>
                          → {new Date(p.endDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                        </p>
                      </td>
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <Link href={`/implementacion/proyectos/${p.id}`}>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                            Ver
                          </motion.button>
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })
            }
          </tbody>
        </table>
        </div>
        {!loading && projects.length === 0 && (
          <div className="py-16 text-center text-sm" style={{ color: tc.m }}>
            {agentId
              ? 'No se encontraron proyectos para este agente'
              : 'No se encontraron proyectos — genera uno desde una Orden de Servicio'}
          </div>
        )}
      </div>

      {/* Paginación */}
      {total > 15 && (
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: tc.m }}>Página {page} de {Math.ceil(total / 15)}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>Anterior</button>
            <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}
