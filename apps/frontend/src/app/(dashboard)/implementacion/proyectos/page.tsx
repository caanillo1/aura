'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Search, RefreshCw, FolderKanban } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { projectsApi } from '@/lib/api';
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

  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [fStatus, setFStatus]   = useState('');
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectsApi.list({ page, limit: 15, search: search || undefined, status: fStatus || undefined });
      setProjects(res.data);
      setTotal(res.meta.total);
    } catch { toast.error('Error al cargar proyectos'); }
    finally { setLoading(false); }
  }, [page, search, fStatus]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: tc.p }}>
            <FolderKanban className="w-5 h-5 text-violet-400" /> Proyectos
          </h2>
          <p className="text-sm mt-0.5" style={{ color: tc.m }}>{total} proyecto{total !== 1 ? 's' : ''} activo{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
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
        <button onClick={load} className="p-2.5 rounded-xl transition-colors" style={{ color: tc.m }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl overflow-hidden" style={tableStyle}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr style={{ borderBottom: rowBorder, background: headBg }}>
              {['Proyecto', 'Cliente', 'OS Vinculada', 'Estado', 'Progreso', 'Fechas', ''].map(h => (
                <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: tc.m }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: rowBorder }}>
                    <td colSpan={7} className="px-4 py-3.5">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />
                    </td>
                  </tr>
                ))
              : projects.map((p, i) => {
                  const ss = STATUS_STYLE[p.status] ?? STATUS_STYLE.activo;
                  const pct = Number(p.progressPercent ?? 0);
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
                        {p.description && <p className="text-xs truncate max-w-[160px]" style={{ color: tc.m }}>{p.description}</p>}
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
            No se encontraron proyectos — genera uno desde una Orden de Servicio
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
