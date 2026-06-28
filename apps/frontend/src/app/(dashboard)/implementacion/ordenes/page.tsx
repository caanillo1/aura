'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Search, RefreshCw, Plus, ClipboardList, Trash2, X, CheckSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { serviceOrdersApi, clientsApi, usersApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { toast } from 'sonner';
import type { ServiceOrder, Client, User } from '@/types';
import { Modal } from '@/components/ui/Modal';

const STATUS_STYLE: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  pendiente:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   dot: '#60a5fa', label: 'Pendiente'   },
  en_curso:    { color: '#34d399', bg: 'rgba(52,211,153,0.12)',   dot: '#34d399', label: 'En curso'    },
  suspendida:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   dot: '#fbbf24', label: 'Suspendida'  },
  completada:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', dot: '#a78bfa', label: 'Completada'  },
  cancelada:   { color: '#f87171', bg: 'rgba(248,113,113,0.12)', dot: '#f87171', label: 'Cancelada'   },
};

export default function OrdenesPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can } = usePermission();
  const router = useRouter();

  const [orders, setOrders]   = useState<ServiceOrder[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fClient, setFClient] = useState('');
  const [fAgent, setFAgent]   = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Eliminación individual
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; osNumber: string; client: string } | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // Selección múltiple
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting]        = useState(false);

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
  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await serviceOrdersApi.list({
        page, limit: 15, search: search || undefined,
        status: fStatus || undefined, clientId: fClient || undefined,
        agentId: fAgent || undefined,
      });
      setOrders(res.data);
      setTotal(res.meta.total);
    } catch { toast.error('Error al cargar órdenes'); }
    finally { setLoading(false); }
  }, [page, search, fStatus, fClient, fAgent]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    clientsApi.list({ limit: 100 }).then(r => setClients(r.data)).catch(() => {});
    usersApi.listAgents({ limit: 200 }).then(r => setAgents(r.data)).catch(() => {});
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await serviceOrdersApi.delete(deleteTarget.id);
      toast.success(`OS ${deleteTarget.osNumber} eliminada`);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al eliminar la orden de servicio');
    } finally { setDeleting(false); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map(o => o.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selected);
      const res = await serviceOrdersApi.bulkDelete(ids);
      if (res.eliminadas > 0) toast.success(`${res.eliminadas} OS eliminada(s)`);
      if (res.fallidas > 0)   toast.error(`${res.fallidas} OS no se pudieron eliminar`);
      setShowBulkConfirm(false);
      exitSelectMode();
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al eliminar órdenes');
    } finally { setBulkDeleting(false); }
  };

  const allSelected = orders.length > 0 && selected.size === orders.length;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: tc.p }}>
            <ClipboardList className="w-5 h-5 text-blue-400" /> Órdenes de Servicio
          </h2>
          <p className="text-sm mt-0.5" style={{ color: tc.m }}>{total} órdenes registradas</p>
        </div>
        {selectMode ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: tc.s }}>
              {selected.size} seleccionada(s)
            </span>
            <button onClick={toggleAll}
              className="text-xs px-3 py-2 rounded-xl transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>
              {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            {selected.size > 0 && (
              <button onClick={() => setShowBulkConfirm(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-medium transition-colors"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                <Trash2 className="w-3.5 h-3.5" /> Eliminar {selected.size}
              </button>
            )}
            <button onClick={exitSelectMode}
              className="p-2 rounded-xl transition-colors"
              style={{ color: tc.m }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {can('orders.eliminar') && (
              <button onClick={() => setSelectMode(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm transition-colors"
                style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>
                <CheckSquare className="w-4 h-4" /> Seleccionar
              </button>
            )}
            {can('orders.nuevo') && (
              <Link href="/implementacion/ordenes/nueva">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-medium">
                  <Plus className="w-4 h-4" /> Nueva OS
                </motion.button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: tc.m }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por OS#, producto, cliente..."
            className="input-glass w-full rounded-xl pl-9 pr-4 py-2.5 text-sm" />
        </div>
        <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }}
          className="input-glass rounded-xl px-4 py-2.5 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={fClient} onChange={e => { setFClient(e.target.value); setPage(1); }}
          className="input-glass rounded-xl px-4 py-2.5 text-sm">
          <option value="">Todos los clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
        </select>
        <select value={fAgent} onChange={e => { setFAgent(e.target.value); setPage(1); }}
          className="input-glass rounded-xl px-4 py-2.5 text-sm">
          <option value="">Todos los agentes</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
          ))}
        </select>
        <button onClick={load} className="p-2.5 rounded-xl transition-colors" style={{ color: tc.m }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl overflow-hidden" style={tableStyle}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr style={{ borderBottom: rowBorder, background: headBg }}>
              {selectMode && (
                <th className="pl-4 pr-2 py-3.5 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-500" />
                </th>
              )}
              {['OS# / Ticket Rubi', 'Cliente', 'Producto', 'Líderes', 'Estado', 'Fechas', ''].map(h => (
                <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: tc.m }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: rowBorder }}>
                    <td colSpan={selectMode ? 8 : 7} className="px-4 py-3.5">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />
                    </td>
                  </tr>
                ))
              : orders.map((os, i) => {
                  const ss = STATUS_STYLE[os.status] ?? STATUS_STYLE.pendiente;
                  const isSelected = selected.has(os.id);
                  return (
                    <motion.tr key={os.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      style={{
                        borderBottom: rowBorder,
                        background: isSelected
                          ? (isLight ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.08)')
                          : 'transparent',
                        outline: isSelected ? `1px solid rgba(239,68,68,0.25)` : 'none',
                      }}
                      className="transition-colors cursor-pointer"
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isLight ? 'rgba(30,60,120,0.03)' : 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => {
                        if (selectMode) toggleSelect(os.id);
                        else router.push(`/implementacion/ordenes/${os.id}`);
                      }}>
                      {selectMode && (
                        <td className="pl-4 pr-2 py-3.5 w-8" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(os.id)}
                            className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-500" />
                        </td>
                      )}
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-xs" style={{ color: '#60a5fa' }}>{os.osNumber}</span>
                        {os.ticketRubi && (
                          <p className="text-xs mt-0.5 font-mono" style={{ color: '#dc2626' }}>{os.ticketRubi}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium" style={{ color: tc.p }}>{os.client.businessName}</p>
                        <p className="text-xs" style={{ color: tc.m }}>{os.client.nit}</p>
                      </td>
                      <td className="px-4 py-3.5 max-w-[200px]">
                        <p className="text-sm truncate" style={{ color: tc.s }}>{os.product}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          {os.clinicalLeader && (
                            <p className="text-xs" style={{ color: tc.m }}>
                              <span style={{ color: '#60a5fa' }}>Clínico:</span> {os.clinicalLeader.firstName} {os.clinicalLeader.lastName}
                            </p>
                          )}
                          {os.financialLeader && (
                            <p className="text-xs" style={{ color: tc.m }}>
                              <span style={{ color: '#34d399' }}>Financiero:</span> {os.financialLeader.firstName} {os.financialLeader.lastName}
                            </p>
                          )}
                          {!os.clinicalLeader && !os.financialLeader && (
                            <span className="text-xs italic" style={{ color: tc.m }}>Sin líderes</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit"
                          style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}40` }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ss.dot }} />
                          {ss.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs" style={{ color: tc.m }}>
                          {new Date(os.startDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                        </p>
                        <p className="text-xs" style={{ color: tc.m }}>
                          → {new Date(os.endDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                        </p>
                      </td>
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Link href={`/implementacion/ordenes/${os.id}`}>
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                              style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                              Ver
                            </motion.button>
                          </Link>
                          {!selectMode && can('orders.eliminar') && (
                            <motion.button
                              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                              onClick={() => setDeleteTarget({ id: os.id, osNumber: os.osNumber, client: os.client.businessName })}
                              className="p-1.5 rounded-lg transition-all"
                              title="Eliminar OS"
                              style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.20)' }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </motion.button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
            }
          </tbody>
        </table>
        </div>
        {!loading && orders.length === 0 && (
          <div className="py-16 text-center text-sm" style={{ color: tc.m }}>
            No se encontraron órdenes de servicio
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

      {/* Modal: Confirmar eliminación individual */}
      <Modal open={!!deleteTarget} onClose={() => { if (!deleting) setDeleteTarget(null); }}
        title="Eliminar orden de servicio" width="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: tc.s }}>
            ¿Eliminar la orden{' '}
            <strong style={{ color: '#60a5fa' }}>{deleteTarget?.osNumber}</strong> de{' '}
            <strong style={{ color: tc.p }}>{deleteTarget?.client}</strong>?
          </p>
          <p className="text-xs" style={{ color: tc.m }}>
            Esta acción no se puede deshacer. Si la OS tiene un proyecto o requerimientos asociados, primero deberás eliminarlos.
          </p>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setDeleteTarget(null)} disabled={deleting}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm disabled:opacity-40"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#ef4444' }}>
              {deleting
                ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Eliminando...</>
                : <><Trash2 className="w-4 h-4" /> Eliminar OS</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar eliminación múltiple */}
      <Modal open={showBulkConfirm} onClose={() => { if (!bulkDeleting) setShowBulkConfirm(false); }}
        title="Eliminar órdenes seleccionadas" width="max-w-sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl"
            style={{ background: isLight ? 'rgba(220,38,38,0.08)' : 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <Trash2 className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#ef4444' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: isLight ? '#991b1b' : '#fca5a5' }}>
                ¿Eliminar {selected.size} orden{selected.size !== 1 ? 'es' : ''} de servicio?
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Las OS que tengan proyectos o requerimientos asociados no se eliminarán y se reportarán como fallidas.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowBulkConfirm(false)} disabled={bulkDeleting}
              className="flex-1 py-2.5 rounded-xl text-sm disabled:opacity-40"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
              {bulkDeleting
                ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Eliminando...</>
                : <><Trash2 className="w-4 h-4" /> Confirmar eliminación</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
