'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  GripVertical, Plus, Pencil, Trash2, ChevronRight, ExternalLink,
  Layers, Flag, Clock, Settings, Calendar, CheckSquare, Square, Minus,
} from 'lucide-react';
import {
  DragDropContext, Droppable, Draggable, type DropResult,
} from '@hello-pangea/dnd';
import { BackButton } from '@/components/ui/BackButton';
import { Modal } from '@/components/ui/Modal';
import { templatesApi } from '@/lib/api';
import { toast } from 'sonner';
import type { TemplateFlow, TemplateModule } from '@/types';

const PRIORITY_STYLE: Record<string, { color: string; bg: string }> = {
  alta:  { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  media: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  baja:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
};

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' }) : null;

export default function TemplateConstructorPage() {
  const { id } = useParams<{ id: string }>();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [template, setTemplate]     = useState<TemplateFlow | null>(null);
  const [loading, setLoading]       = useState(true);
  const [selModule, setSelModule]   = useState<TemplateModule | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // ── Module modal (edit only) ──
  const [modModal, setModModal]         = useState(false);
  const [editingMod, setEditingMod]     = useState<TemplateModule | null>(null);
  const [modForm, setModForm]           = useState({
    name: '', description: '', estimatedDays: 0, days: 0,
    startDate: '', endDate: '', executionDate: '',
  });
  const [savingMod, setSavingMod]       = useState(false);

  // ── Library picker (assign existing modules — multi-select) ──
  const [libModal, setLibModal]           = useState(false);
  const [libModules, setLibModules]       = useState<TemplateModule[]>([]);
  const [libLoading, setLibLoading]       = useState(false);
  const [libSearch, setLibSearch]         = useState('');
  const [libSelectedIds, setLibSelectedIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning]         = useState(false);
  const [assignProgress, setAssignProgress] = useState<{ done: number; total: number; name: string } | null>(null);

  // ── Template edit modal ──
  const [editModal, setEditModal]       = useState(false);
  const [editForm, setEditForm]         = useState({ name: '', description: '', version: '' });
  const [savingEdit, setSavingEdit]     = useState(false);

  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  const glass = (op = 0.75) => ({
    background: isLight ? `rgba(255,255,255,${op})` : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? '0 8px 32px rgba(30,60,120,0.15), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  });

  const rowBorder = isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await templatesApi.get(id);
      setTemplate(data);
      if (!selModule && data.modules.length > 0) setSelModule(data.modules[0]);
      else if (selModule) {
        const updated = data.modules.find((m: TemplateModule) => m.id === selModule.id);
        setSelModule(updated ?? data.modules[0] ?? null);
      }
    } catch { toast.error('Error al cargar la plantilla'); }
    finally { setLoading(false); }
  }, [id]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  /* ── DnD reorder ── */
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !template) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;
    const reordered = Array.from(template.modules);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);
    const withOrder = reordered.map((m, i) => ({ ...m, order: i + 1 }));
    setTemplate({ ...template, modules: withOrder });
    try {
      await templatesApi.reorderModules(id, withOrder.map(m => ({ id: m.id, order: m.order })));
    } catch { toast.error('Error al reordenar'); load(); }
  };

  /* ── Module CRUD ── */
  const openCreateMod = async () => {
    setLibSelectedIds(new Set());
    setLibSearch('');
    setLibModal(true);
    setLibLoading(true);
    try {
      const res = await templatesApi.listModules({ limit: 100 });
      const assignedIds = new Set(template?.modules?.map(m => m.id) ?? []);
      setLibModules(res.data.filter((m: TemplateModule) => m.isActive && !assignedIds.has(m.id)));
    } catch { toast.error('Error al cargar biblioteca'); }
    finally { setLibLoading(false); }
  };

  const toggleLibSelect = (mod: TemplateModule) =>
    setLibSelectedIds(prev => {
      const n = new Set(prev);
      n.has(mod.id) ? n.delete(mod.id) : n.add(mod.id);
      return n;
    });

  const filteredLibModules = libModules.filter(m =>
    !libSearch ||
    m.name.toLowerCase().includes(libSearch.toLowerCase()) ||
    (m.description ?? '').toLowerCase().includes(libSearch.toLowerCase())
  );
  const allLibFiltered    = filteredLibModules.length > 0 && filteredLibModules.every(m => libSelectedIds.has(m.id));
  const someLibFiltered   = filteredLibModules.some(m => libSelectedIds.has(m.id));

  const toggleSelectAllLib = () => {
    if (allLibFiltered) {
      setLibSelectedIds(prev => { const n = new Set(prev); filteredLibModules.forEach(m => n.delete(m.id)); return n; });
    } else {
      setLibSelectedIds(prev => { const n = new Set(prev); filteredLibModules.forEach(m => n.add(m.id)); return n; });
    }
  };

  const handleAssign = async () => {
    const toAssign = libModules.filter(m => libSelectedIds.has(m.id));
    if (!toAssign.length) return;
    setAssigning(true);
    setAssignProgress({ done: 0, total: toAssign.length, name: toAssign[0].name });
    let ok = 0;
    for (let i = 0; i < toAssign.length; i++) {
      const mod = toAssign[i];
      setAssignProgress({ done: i, total: toAssign.length, name: mod.name });
      try {
        await templatesApi.assignModule(id, mod.id);
        ok++;
      } catch { /* continue with others */ }
      setAssignProgress({ done: i + 1, total: toAssign.length, name: mod.name });
    }
    setAssigning(false);
    setAssignProgress(null);
    if (ok === toAssign.length) {
      toast.success(`${ok} módulo${ok !== 1 ? 's' : ''} asignado${ok !== 1 ? 's' : ''}`);
    } else {
      toast.warning(`${ok} asignado${ok !== 1 ? 's' : ''}, ${toAssign.length - ok} con error`);
    }
    setLibModal(false);
    load();
  };

  const openEditMod = (m: TemplateModule) => {
    setEditingMod(m);
    setModForm({
      name: m.name, description: m.description ?? '',
      estimatedDays: m.estimatedDays, days: m.days ?? 0,
      startDate: m.startDate ? m.startDate.substring(0, 10) : '',
      endDate:   m.endDate   ? m.endDate.substring(0, 10)   : '',
      executionDate: m.executionDate ? m.executionDate.substring(0, 10) : '',
    });
    setModModal(true);
  };

  const handleSaveMod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modForm.name.trim()) { toast.error('Nombre obligatorio'); return; }
    setSavingMod(true);
    try {
      const payload = {
        ...modForm,
        startDate: modForm.startDate || undefined,
        endDate:   modForm.endDate   || undefined,
        executionDate: modForm.executionDate || undefined,
      };
      if (editingMod) await templatesApi.updateModule(id, editingMod.id, payload);
      toast.success('Módulo actualizado');
      setModModal(false);
      load();
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Error'); }
    finally { setSavingMod(false); }
  };

  const handleDeleteMod = async (moduleId: string) => {
    if (!confirm('¿Desvincular este módulo de la plantilla?')) return;
    try {
      await templatesApi.deleteModule(id, moduleId);
      toast.success('Módulo desvinculado');
      if (selModule?.id === moduleId) setSelModule(null);
      load();
    } catch { toast.error('Error al desvincular módulo'); }
  };

  /* ── Activity delete (template-scoped) ── */
  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm('¿Eliminar esta actividad de la plantilla?')) return;
    try {
      await templatesApi.deleteActivity(id, activityId);
      toast.success('Actividad eliminada');
      load();
    } catch { toast.error('Error al eliminar actividad'); }
  };

  /* ── Template edit ── */
  const openEditTemplate = () => {
    if (!template) return;
    setEditForm({ name: template.name, description: template.description ?? '', version: template.version });
    setEditModal(true);
  };
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await templatesApi.update(id, editForm);
      toast.success('Plantilla actualizada');
      setEditModal(false);
      load();
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Error'); }
    finally { setSavingEdit(false); }
  };

  const togglePhase = (phaseId: string) =>
    setExpandedPhases(prev => { const n = new Set(prev); n.has(phaseId) ? n.delete(phaseId) : n.add(phaseId); return n; });

  if (loading) return (
    <div className="space-y-5 max-w-6xl">
      <BackButton href="/implementacion/plantillas" label="Plantillas" />
      <div className="flex gap-5 h-96">
        <div className="w-72 rounded-2xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
        <div className="flex-1 rounded-2xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
      </div>
    </div>
  );
  if (!template) return null;

  const currentMod = selModule ? template.modules.find(m => m.id === selModule.id) ?? null : null;

  return (
    <div className="space-y-4 max-w-6xl">
      <BackButton href="/implementacion/plantillas" label="Plantillas" />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-xl" style={{ color: tc.p }}>{template.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>v{template.version}</span>
          </div>
          {template.description && <p className="text-sm mt-0.5" style={{ color: tc.m }}>{template.description}</p>}
        </div>
        <div className="flex gap-2">
          <a href="/implementacion/modulos"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ border: '1px solid var(--border-subtle)', color: tc.m }}>
            <Layers className="w-3.5 h-3.5" /> Biblioteca de módulos
          </a>
          <button onClick={openEditTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
            style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>
            <Settings className="w-3.5 h-3.5" /> Editar plantilla
          </button>
        </div>
      </div>

      {/* Layout */}
      <div className="flex gap-4 items-start">
        {/* ── Panel izquierdo: módulos ── */}
        <div className="w-72 shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: tc.m }}>
              Módulos ({template.modules.length})
            </p>
            <button onClick={openCreateMod}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium"
              style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
              <Plus className="w-3 h-3" /> Agregar
            </button>
          </div>

          <div className="overflow-y-auto pr-0.5" style={{ maxHeight: 'calc(100vh - 260px)', scrollbarWidth: 'thin' }}>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="modules">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                  {template.modules.map((mod, index) => (
                    <Draggable key={mod.id} draggableId={mod.id} index={index}>
                      {(drag, snapshot) => (
                        <div ref={drag.innerRef} {...drag.draggableProps}
                          onClick={() => setSelModule(mod)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                          style={{
                            ...glass(snapshot.isDragging ? 0.95 : 0.8),
                            border: selModule?.id === mod.id
                              ? '1px solid rgba(96,165,250,0.45)'
                              : '1px solid rgba(255,255,255,0.12)',
                            background: selModule?.id === mod.id
                              ? isLight ? 'rgba(96,165,250,0.10)' : 'rgba(96,165,250,0.08)'
                              : undefined,
                            boxShadow: snapshot.isDragging ? '0 12px 40px rgba(0,0,0,0.3)' : undefined,
                          }}>
                          <div {...drag.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-3.5 h-3.5 shrink-0" style={{ color: tc.m }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: tc.p }}>{mod.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <p className="text-[10px]" style={{ color: tc.m }}>
                                {(mod.phases ?? []).length} fase{(mod.phases ?? []).length !== 1 ? 's' : ''}
                              </p>
                              {(mod.days || mod.estimatedDays) > 0 && (
                                <span className="text-[10px] font-mono" style={{ color: tc.m }}>
                                  {mod.days || mod.estimatedDays}d
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <button onClick={e => { e.stopPropagation(); openEditMod(mod); }}
                              className="p-1 rounded" style={{ color: tc.m }}>
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteMod(mod.id); }}
                              className="p-1 rounded" style={{ color: '#f87171' }}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {template.modules.length === 0 && (
                    <p className="text-xs text-center py-6" style={{ color: tc.m }}>Agrega módulos para comenzar</p>
                  )}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          </div>
        </div>

        {/* ── Panel derecho: vista de fases y actividades (solo lectura) ── */}
        <div className="flex-1 min-w-0">
          {!currentMod ? (
            <div className="rounded-2xl p-12 text-center" style={glass()}>
              <Layers className="w-10 h-10 mx-auto mb-3" style={{ color: tc.m }} />
              <p className="font-semibold" style={{ color: tc.p }}>Selecciona un módulo</p>
              <p className="text-sm mt-1" style={{ color: tc.m }}>
                Las fases y actividades se configuran en la biblioteca de módulos
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={glass()}>
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: rowBorder }}>
                <div>
                  <p className="font-bold" style={{ color: tc.p }}>{currentMod.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs" style={{ color: tc.m }}>
                    <span>{(currentMod.phases ?? []).length} fase{(currentMod.phases ?? []).length !== 1 ? 's' : ''}</span>
                    <span>{(currentMod.phases ?? []).reduce((s, ph) => s + (ph.activities?.length ?? 0), 0)} actividades</span>
                    {currentMod.startDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{fmt(currentMod.startDate)} → {fmt(currentMod.endDate)}
                      </span>
                    )}
                  </div>
                </div>
                <Link href={`/implementacion/modulos/${currentMod.id}`}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium shrink-0 transition-all hover:opacity-80"
                  style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                  <ExternalLink className="w-3.5 h-3.5" /> Configurar módulo
                </Link>
              </div>

              {(currentMod.phases ?? []).length === 0 ? (
                <div className="px-5 py-10 text-center flex-1">
                  <p className="text-sm" style={{ color: tc.m }}>Este módulo no tiene fases</p>
                  <Link href={`/implementacion/modulos/${currentMod.id}`}
                    className="inline-flex items-center gap-1.5 text-xs mt-3 px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa' }}>
                    <ExternalLink className="w-3 h-3" /> Configurar en biblioteca de módulos
                  </Link>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' }}>
                  {(currentMod.phases ?? []).map(phase => {
                    const isExpanded = expandedPhases.has(phase.id);
                    const phaseColor = phase.color ?? '#60a5fa';
                    return (
                      <div key={phase.id}>
                        {/* Fase header — solo lectura */}
                        <div className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                          style={{ background: isLight ? 'rgba(30,60,120,0.03)' : 'rgba(255,255,255,0.03)' }}
                          onClick={() => togglePhase(phase.id)}>
                          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                            <ChevronRight className="w-4 h-4" style={{ color: tc.m }} />
                          </motion.div>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: phaseColor }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: tc.p }}>{phase.name}</p>
                            <div className="flex items-center gap-3 text-[10px] flex-wrap" style={{ color: tc.m }}>
                              <span>{phase.activities.length} act.</span>
                              {phase.estimatedDays > 0 && <span>{phase.estimatedDays}d est.</span>}
                            </div>
                          </div>
                        </div>

                        {/* Actividades */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: 'easeInOut' }}
                              className="overflow-hidden">
                              {phase.activities.length === 0 ? (
                                <p className="text-xs px-12 py-3" style={{ color: tc.m }}>Sin actividades</p>
                              ) : (
                                <div>
                                  {phase.activities.map(act => {
                                    const ps = PRIORITY_STYLE[act.priority] ?? PRIORITY_STYLE.media;
                                    return (
                                      <div key={act.id} className="flex items-start gap-3 px-12 py-2.5"
                                        style={{ borderTop: rowBorder }}>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                                              style={{ background: 'rgba(255,255,255,0.06)', color: tc.m }}>{act.code}</span>
                                            <p className="text-sm font-medium" style={{ color: tc.s }}>{act.name}</p>
                                          </div>
                                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                                            <span className="flex items-center gap-1 text-[10px]" style={{ color: tc.m }}>
                                              <Clock className="w-3 h-3" /> {act.estimatedHours}h
                                            </span>
                                            {act.calculatedDays > 0 && (
                                              <span className="text-[10px] font-mono" style={{ color: tc.m }}>{act.calculatedDays}d</span>
                                            )}
                                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                                              style={{ background: ps.bg, color: ps.color }}>
                                              <Flag className="w-2.5 h-2.5" /> {act.priority}
                                            </span>
                                            {act.defaultRole && (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                                                style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa' }}>
                                                {act.defaultRole}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <button onClick={() => handleDeleteActivity(act.id)}
                                          className="p-1 rounded shrink-0 mt-1 opacity-50 hover:opacity-100 transition-opacity"
                                          title="Eliminar de la plantilla"
                                          style={{ color: '#f87171' }}>
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: módulo (editar) */}
      <Modal open={modModal} onClose={() => setModModal(false)} title="Editar módulo" width="max-w-lg">
        <form onSubmit={handleSaveMod} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Nombre <span className="text-red-400 normal-case">*</span>
              </label>
              <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                placeholder="Ej: Configuración base del sistema"
                value={modForm.name} onChange={e => setModForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Descripción</label>
              <textarea className="input-glass w-full rounded-xl px-3 py-2 text-sm resize-none" rows={2}
                value={modForm.description} onChange={e => setModForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Días estimados</label>
              <input type="number" min={0} className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                value={modForm.estimatedDays} onChange={e => setModForm(p => ({ ...p, estimatedDays: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Días reales</label>
              <input type="number" min={0} className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                value={modForm.days} onChange={e => setModForm(p => ({ ...p, days: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button type="submit" disabled={savingMod}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {savingMod ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: editar plantilla */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Editar plantilla" width="max-w-md">
        <form onSubmit={handleSaveTemplate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nombre</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Versión</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={editForm.version} onChange={e => setEditForm(p => ({ ...p, version: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Descripción</label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2 text-sm resize-none" rows={2}
              value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setEditModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button type="submit" disabled={savingEdit}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {savingEdit ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal — Biblioteca de módulos (multi-select) */}
      <Modal open={libModal} onClose={() => { if (!assigning) setLibModal(false); }}
        title="Agregar módulos desde biblioteca" width="max-w-lg">
        <div className="space-y-3">

          {/* Buscador + select-all */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: tc.m }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input className="input-glass w-full rounded-xl pl-9 pr-4 py-2 text-sm"
                placeholder="Buscar módulo..."
                value={libSearch} onChange={e => setLibSearch(e.target.value)}
                disabled={assigning} />
            </div>
            {filteredLibModules.length > 0 && (
              <button onClick={toggleSelectAllLib} disabled={assigning}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shrink-0 disabled:opacity-40"
                style={{ border: '1px solid rgba(96,165,250,0.30)', color: '#60a5fa', background: 'rgba(96,165,250,0.08)' }}>
                {allLibFiltered
                  ? <><CheckSquare className="w-3.5 h-3.5" /> Todo</>
                  : someLibFiltered
                    ? <><Minus className="w-3.5 h-3.5" /> Todo</>
                    : <><Square className="w-3.5 h-3.5" /> Todo</>}
              </button>
            )}
          </div>

          {/* Contador de seleccionados */}
          {libSelectedIds.size > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs"
              style={{ background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}>
              <span className="font-semibold">{libSelectedIds.size} módulo{libSelectedIds.size !== 1 ? 's' : ''} seleccionado{libSelectedIds.size !== 1 ? 's' : ''}</span>
              <button onClick={() => setLibSelectedIds(new Set())} className="underline opacity-70 hover:opacity-100">
                Limpiar
              </button>
            </div>
          )}

          {/* Lista de módulos */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {libLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
              ))
            ) : filteredLibModules.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: tc.m }}>
                {libModules.length === 0 ? 'No hay módulos activos disponibles en la biblioteca' : 'Sin coincidencias'}
              </p>
            ) : filteredLibModules.map(mod => {
              const isSelected = libSelectedIds.has(mod.id);
              return (
                <motion.button key={mod.id} onClick={() => toggleLibSelect(mod)}
                  disabled={assigning}
                  whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }}
                  className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 disabled:opacity-40"
                  style={{
                    background: isSelected ? 'rgba(96,165,250,0.10)' : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(96,165,250,0.40)' : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)')}`,
                  }}>
                  {/* Checkbox icon */}
                  <span className="shrink-0">
                    {isSelected
                      ? <CheckSquare className="w-4 h-4" style={{ color: '#60a5fa' }} />
                      : <Square className="w-4 h-4" style={{ color: tc.m, opacity: 0.5 }} />}
                  </span>
                  {/* Code badge */}
                  <span className="font-mono text-xs px-2 py-0.5 rounded shrink-0"
                    style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                    {mod.code}
                  </span>
                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: isSelected ? '#60a5fa' : tc.p }}>{mod.name}</p>
                    {mod.description && (
                      <p className="text-xs truncate mt-0.5" style={{ color: tc.m }}>{mod.description}</p>
                    )}
                  </div>
                  {/* Phase count badge */}
                  {(mod as any)._count?.phases != null && (
                    <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa' }}>
                      {(mod as any)._count.phases} fase{(mod as any)._count.phases !== 1 ? 's' : ''}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Barra de progreso (visible mientras asigna) */}
          {assigning && assignProgress && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="truncate">Asignando: <span className="font-semibold" style={{ color: tc.p }}>{assignProgress.name}</span></span>
                <span className="shrink-0 ml-2 font-mono">{assignProgress.done} / {assignProgress.total}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((assignProgress.done / assignProgress.total) * 100)}%`, background: 'linear-gradient(90deg,#3b82f6,#60a5fa)' }} />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1 border-t" style={{ borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
            <button onClick={() => setLibModal(false)} disabled={assigning}
              className="px-4 py-2.5 rounded-xl text-sm disabled:opacity-40"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleAssign} disabled={libSelectedIds.size === 0 || assigning}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {assigning
                ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Asignando...</>
                : libSelectedIds.size === 0
                  ? 'Selecciona al menos un módulo'
                  : <><CheckSquare className="w-4 h-4" /> Agregar {libSelectedIds.size} módulo{libSelectedIds.size !== 1 ? 's' : ''}</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
