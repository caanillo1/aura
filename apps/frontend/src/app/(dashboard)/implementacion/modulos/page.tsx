'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Search, RefreshCw, Layers, Calendar, ChevronRight, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import Link from 'next/link';
import { templatesApi } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import type { TemplateModule } from '@/types';

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const EMPTY_FORM = { name: '', description: '' };

export default function ModulosPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [modules, setModules]   = useState<TemplateModule[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);

  // Create modal
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm]   = useState(EMPTY_FORM);
  const [creating, setCreating]       = useState(false);

  // Edit modal
  const [editModal, setEditModal]   = useState(false);
  const [editTarget, setEditTarget] = useState<TemplateModule | null>(null);
  const [editForm, setEditForm]     = useState(EMPTY_FORM);
  const [editing, setEditing]       = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<TemplateModule | null>(null);
  const [deleting, setDeleting]         = useState(false);

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
      const res = await templatesApi.listModules({ page, limit: 20, search: search || undefined });
      setModules(res.data);
      setTotal(res.meta.total);
    } catch { toast.error('Error al cargar módulos'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setCreating(true);
    try {
      const created = await templatesApi.createModule({
        name: createForm.name,
        description: createForm.description || undefined,
      });
      toast.success(`Módulo ${created.code} creado`);
      setCreateModal(false);
      setCreateForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al crear módulo');
    } finally { setCreating(false); }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (mod: TemplateModule) => {
    setEditTarget(mod);
    setEditForm({ name: mod.name, description: mod.description ?? '' });
    setEditModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editForm.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setEditing(true);
    try {
      await templatesApi.updateModuleById(editTarget.id, {
        name: editForm.name,
        description: editForm.description || undefined,
      });
      toast.success('Módulo actualizado');
      setEditModal(false);
      setEditTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al actualizar módulo');
    } finally { setEditing(false); }
  };

  // ── Toggle status ─────────────────────────────────────────────────────────
  const handleToggle = async (mod: TemplateModule) => {
    try {
      const updated = await templatesApi.toggleModuleStatus(mod.id);
      toast.success(updated.isActive ? 'Módulo activado' : 'Módulo desactivado');
      load();
    } catch { toast.error('Error al cambiar estado'); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await templatesApi.deleteModuleById(deleteTarget.id);
      toast.success('Módulo eliminado');
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al eliminar módulo');
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: tc.p }}>
            <Layers className="w-5 h-5 text-blue-400" /> Biblioteca de Módulos
          </h2>
          <p className="text-sm mt-0.5" style={{ color: tc.m }}>
            {total} módulo{total !== 1 ? 's' : ''} · referencia global para informes, proyectos y dashboard
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2.5 rounded-xl transition-colors" style={{ color: tc.m }}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => { setCreateForm(EMPTY_FORM); setCreateModal(true); }}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-medium">
            <Plus className="w-4 h-4" /> Nuevo módulo
          </motion.button>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: tc.m }} />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nombre o descripción..."
          className="input-glass w-full rounded-xl pl-9 pr-4 py-2.5 text-sm" />
      </div>

      {/* Tabla */}
      <div className="rounded-2xl overflow-hidden" style={tableStyle}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: rowBorder, background: headBg }}>
              {['Código', 'Módulo', 'Plantilla', 'Estado', 'Fases', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: tc.m }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: rowBorder }}>
                    <td colSpan={6} className="px-4 py-3.5">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />
                    </td>
                  </tr>
                ))
              : modules.map((mod, i) => (
                  <motion.tr key={mod.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    style={{ borderBottom: rowBorder }}
                    className="transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = isLight ? 'rgba(30,60,120,0.03)' : 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    {/* Código */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-xs px-2 py-1 rounded"
                        style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                        {mod.code}
                      </span>
                    </td>

                    {/* Nombre + descripción */}
                    <td className="px-4 py-3.5">
                      <p className="font-medium" style={{ color: tc.p }}>{mod.name}</p>
                      {mod.description && (
                        <p className="text-xs truncate max-w-[200px] mt-0.5" style={{ color: tc.m }}>{mod.description}</p>
                      )}
                    </td>

                    {/* Plantilla */}
                    <td className="px-4 py-3.5">
                      {mod.templateFlow ? (
                        <div>
                          <p className="text-sm" style={{ color: tc.s }}>{mod.templateFlow.name}</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
                            v{mod.templateFlow.version}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs italic" style={{ color: tc.m }}>Independiente</span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        mod.isActive
                          ? 'bg-green-400/15 text-green-400'
                          : 'bg-gray-400/15 text-gray-400'
                      }`}>
                        {mod.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Fases */}
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1 text-xs" style={{ color: tc.m }}>
                        <Layers className="w-3 h-3" />
                        {mod._count?.phases ?? 0}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {/* Editar */}
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                          onClick={() => openEdit(mod)}
                          title="Editar"
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#60a5fa' }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </motion.button>

                        {/* Activar / Desactivar */}
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                          onClick={() => handleToggle(mod)}
                          title={mod.isActive ? 'Desactivar' : 'Activar'}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: mod.isActive ? '#34d399' : '#94a3b8' }}>
                          {mod.isActive
                            ? <ToggleRight className="w-4 h-4" />
                            : <ToggleLeft  className="w-4 h-4" />}
                        </motion.button>

                        {/* Eliminar */}
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                          onClick={() => setDeleteTarget(mod)}
                          title="Eliminar"
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#f87171' }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>

                        {/* Configurar fases/actividades */}
                        <Link href={`/implementacion/modulos/${mod.id}`}>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ml-1"
                            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                            Configurar <ChevronRight className="w-3 h-3" />
                          </motion.button>
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))
            }
          </tbody>
        </table>
        {!loading && modules.length === 0 && (
          <div className="py-16 text-center text-sm" style={{ color: tc.m }}>
            No hay módulos — crea uno con el botón "Nuevo módulo"
          </div>
        )}
      </div>

      {/* Paginación */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: tc.m }}>Página {page} de {Math.ceil(total / 20)}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>Anterior</button>
            <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>Siguiente</button>
          </div>
        </div>
      )}

      {/* Modal — Crear */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Nuevo módulo" width="max-w-md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.20)' }}>
            <span className="text-xs font-mono font-bold" style={{ color: '#60a5fa' }}>Código</span>
            <span className="text-xs" style={{ color: tc.m }}>auto-generado al guardar (MOD-001, MOD-002…)</span>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Nombre <span className="text-red-400 normal-case">*</span>
            </label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              placeholder="Ej: Módulo de Facturación"
              value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
              autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Detalle</label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2 text-sm resize-none" rows={3}
              placeholder="Descripción opcional..."
              value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setCreateModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={creating}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {creating ? 'Creando...' : 'Crear módulo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal — Editar */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={`Editar · ${editTarget?.code ?? ''}`} width="max-w-md">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Nombre <span className="text-red-400 normal-case">*</span>
            </label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
              autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Detalle</label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2 text-sm resize-none" rows={3}
              value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setEditModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={editing}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {editing ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal — Confirmar eliminar */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar módulo" width="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: tc.s }}>
            ¿Eliminar el módulo <span className="font-bold" style={{ color: tc.p }}>{deleteTarget?.name}</span>
            {' '}(<span className="font-mono text-xs" style={{ color: '#60a5fa' }}>{deleteTarget?.code}</span>)?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteTarget(null)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50"
              style={{ background: '#ef4444' }}>
              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
