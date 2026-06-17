'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Search, Plus, LayoutTemplate, RefreshCw, Layers, Calendar, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { templatesApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import type { TemplateFlow } from '@/types';

const EMPTY_CREATE = { name: '', description: '', version: '1.0' };

export default function PlantillasPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const router  = useRouter();
  const { can } = usePermission();

  const [templates, setTemplates] = useState<TemplateFlow[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);

  // Create
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm]   = useState(EMPTY_CREATE);
  const [creating, setCreating]       = useState(false);

  // Edit
  const [editTarget, setEditTarget] = useState<TemplateFlow | null>(null);
  const [editForm, setEditForm]     = useState(EMPTY_CREATE);
  const [editing, setEditing]       = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<TemplateFlow | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  const glass = () => ({
    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? '0 8px 32px rgba(30,60,120,0.15), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await templatesApi.list({ page, limit: 12, search: search || undefined });
      setTemplates(res.data);
      setTotal(res.meta.total);
    } catch { toast.error('Error al cargar plantillas'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setCreating(true);
    try {
      const tmpl = await templatesApi.create({ name: createForm.name, description: createForm.description || undefined, version: createForm.version });
      toast.success(`Plantilla "${tmpl.name}" creada`);
      setCreateModal(false);
      setCreateForm(EMPTY_CREATE);
      router.push(`/implementacion/plantillas/${tmpl.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al crear plantilla');
    } finally { setCreating(false); }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (e: React.MouseEvent, t: TemplateFlow) => {
    e.stopPropagation();
    setEditTarget(t);
    setEditForm({ name: t.name, description: t.description ?? '', version: t.version });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditing(true);
    try {
      await templatesApi.update(editTarget.id, { name: editForm.name, description: editForm.description || undefined, version: editForm.version });
      toast.success('Plantilla actualizada');
      setEditTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al actualizar');
    } finally { setEditing(false); }
  };

  // ── Toggle ────────────────────────────────────────────────────────────────
  const handleToggle = async (e: React.MouseEvent, t: TemplateFlow) => {
    e.stopPropagation();
    try {
      const updated = await templatesApi.toggleTemplateStatus(t.id);
      toast.success(updated.isActive ? 'Plantilla activada' : 'Plantilla desactivada');
      load();
    } catch { toast.error('Error al cambiar estado'); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const openDelete = (e: React.MouseEvent, t: TemplateFlow) => {
    e.stopPropagation();
    setDeleteTarget(t);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await templatesApi.deleteTemplate(deleteTarget.id);
      toast.success('Plantilla eliminada');
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al eliminar');
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: tc.p }}>
            <LayoutTemplate className="w-5 h-5 text-violet-400" /> Plantillas de Implementación
          </h2>
          <p className="text-sm mt-0.5" style={{ color: tc.m }}>{total} plantillas disponibles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2.5 rounded-xl transition-colors" style={{ color: tc.m }}>
            <RefreshCw className="w-4 h-4" />
          </button>
          {can('settings.editar') && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setCreateModal(true)}
              className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-medium">
              <Plus className="w-4 h-4" /> Nueva Plantilla
            </motion.button>
          )}
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: tc.m }} />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nombre..."
          className="input-glass w-full rounded-xl pl-9 pr-4 py-2.5 text-sm" />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}>
            <LayoutTemplate className="w-7 h-7" style={{ color: tc.m }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: tc.p }}>No hay plantillas</p>
          <p className="text-sm mb-4" style={{ color: tc.m }}>Crea una plantilla para comenzar</p>
          {can('settings.editar') && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setCreateModal(true)}
              className="btn-primary px-5 py-2.5 rounded-xl text-sm text-white font-semibold">
              <Plus className="w-4 h-4 inline mr-1.5" /> Nueva Plantilla
            </motion.button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {templates.map((t, i) => (
              <motion.div key={t.id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl p-5 flex flex-col gap-3 relative"
                style={{ ...glass(), opacity: t.isActive ? 1 : 0.65 }}>

                {/* Badge estado */}
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.30)' }}>
                    <LayoutTemplate className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
                      v{t.version}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={t.isActive
                        ? { background: 'rgba(52,211,153,0.12)', color: '#34d399' }
                        : { background: 'rgba(107,114,128,0.12)', color: '#6b7280' }}>
                      {t.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>

                {/* Nombre y descripción */}
                <div>
                  <h3 className="font-semibold text-sm leading-snug" style={{ color: tc.p }}>{t.name}</h3>
                  {t.description && (
                    <p className="text-xs leading-relaxed line-clamp-2 mt-0.5" style={{ color: tc.m }}>{t.description}</p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 flex-wrap pt-2"
                  style={{ borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
                  <span className="flex items-center gap-1 text-xs" style={{ color: tc.m }}>
                    <Layers className="w-3.5 h-3.5" />
                    {(t as any)._count?.modules ?? 0} módulo{(t as any)._count?.modules !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: tc.m }}>
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(t.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 pt-1"
                  style={{ borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
                  {/* Editar */}
                  {can('settings.editar') && (
                    <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                      onClick={ev => openEdit(ev, t)}
                      title="Editar"
                      className="p-1.5 rounded-lg" style={{ color: '#60a5fa' }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                  {/* Toggle */}
                  {can('settings.editar') && (
                    <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                      onClick={ev => handleToggle(ev, t)}
                      title={t.isActive ? 'Desactivar' : 'Activar'}
                      className="p-1.5 rounded-lg" style={{ color: t.isActive ? '#34d399' : '#94a3b8' }}>
                      {t.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </motion.button>
                  )}
                  {/* Eliminar */}
                  {can('settings.editar') && (
                    <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                      onClick={ev => openDelete(ev, t)}
                      title="Eliminar"
                      className="p-1.5 rounded-lg" style={{ color: '#f87171' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                  {/* Abrir constructor */}
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => router.push(`/implementacion/plantillas/${t.id}`)}
                    className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                    Constructor <ChevronRight className="w-3 h-3" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Paginación */}
      {total > 12 && (
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: tc.m }}>Página {page} de {Math.ceil(total / 12)}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>Anterior</button>
            <button disabled={page >= Math.ceil(total / 12)} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>Siguiente</button>
          </div>
        </div>
      )}

      {/* Modal — Crear */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Nueva Plantilla" width="max-w-md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Nombre <span className="text-red-400 normal-case">*</span>
            </label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              placeholder="Ej: Implementación HCE Ambulatorio"
              value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Versión</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={createForm.version} onChange={e => setCreateForm(p => ({ ...p, version: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Descripción</label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
              value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setCreateModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button type="submit" disabled={creating}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {creating ? 'Creando...' : 'Crear y abrir constructor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal — Editar */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Editar · ${editTarget?.name ?? ''}`} width="max-w-md">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Nombre <span className="text-red-400 normal-case">*</span>
            </label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Versión</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={editForm.version} onChange={e => setEditForm(p => ({ ...p, version: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Descripción</label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
              value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setEditTarget(null)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button type="submit" disabled={editing}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {editing ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal — Eliminar */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar plantilla" width="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: tc.s }}>
            ¿Eliminar la plantilla <span className="font-bold" style={{ color: tc.p }}>{deleteTarget?.name}</span>?
            Se eliminarán todos sus módulos, fases y actividades. Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteTarget(null)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Cancelar</button>
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
