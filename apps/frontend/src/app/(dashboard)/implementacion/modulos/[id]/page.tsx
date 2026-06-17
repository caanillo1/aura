'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  GripVertical, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Flag, Clock, Layers, CheckCircle2,
} from 'lucide-react';
import {
  DragDropContext, Droppable, Draggable, type DropResult,
} from '@hello-pangea/dnd';
import { BackButton } from '@/components/ui/BackButton';
import { Modal } from '@/components/ui/Modal';
import { templatesApi } from '@/lib/api';
import { toast } from 'sonner';
import type { TemplateModule, TemplatePhase, TemplateActivity } from '@/types';

const PRIORITY: Record<string, { color: string; bg: string; label: string }> = {
  alta:  { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Alta'  },
  media: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  label: 'Media' },
  baja:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  label: 'Baja'  },
};

const PHASE_COLORS = ['#60a5fa','#a78bfa','#34d399','#fbbf24','#f87171','#fb923c','#e879f9'];

const EMPTY_PHASE = { name: '', slug: '', color: '#60a5fa', estimatedDays: 0 };
const EMPTY_ACT   = { name: '', description: '', estimatedHours: 0, calculatedDays: 0, priority: 'media', defaultRole: '' };

export default function ModuleDetailPage() {
  const { id: moduleId } = useParams<{ id: string }>();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [mod, setMod]       = useState<TemplateModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Phase modals
  const [phaseModal, setPhaseModal]     = useState(false);
  const [editPhase, setEditPhase]       = useState<TemplatePhase | null>(null);
  const [phaseForm, setPhaseForm]       = useState(EMPTY_PHASE);
  const [savingPhase, setSavingPhase]   = useState(false);

  // Activity modals
  const [actModal, setActModal]         = useState(false);
  const [actPhaseId, setActPhaseId]     = useState('');
  const [editAct, setEditAct]           = useState<TemplateActivity | null>(null);
  const [actForm, setActForm]           = useState<typeof EMPTY_ACT>(EMPTY_ACT);
  const [savingAct, setSavingAct]       = useState(false);

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

  const sep = isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.07)';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await templatesApi.getModuleDetail(moduleId);
      setMod(data);
      if (data.phases?.length && expanded.size === 0) {
        setExpanded(new Set([data.phases[0].id]));
      }
    } catch { toast.error('Error al cargar el módulo'); }
    finally { setLoading(false); }
  }, [moduleId]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (phaseId: string) =>
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(phaseId) ? s.delete(phaseId) : s.add(phaseId);
      return s;
    });

  // ── Phase DnD ────────────────────────────────────────────────────────────
  const onDragEndPhases = async (result: DropResult) => {
    if (!result.destination || !mod) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;
    const phases = Array.from(mod.phases ?? []);
    const [moved] = phases.splice(source.index, 1);
    phases.splice(destination.index, 0, moved);
    const reordered = phases.map((p, i) => ({ ...p, order: i }));
    setMod({ ...mod, phases: reordered });
    try {
      await templatesApi.reorderPhasesInModule(moduleId, reordered.map(p => ({ id: p.id, order: p.order })));
    } catch { toast.error('Error al reordenar'); load(); }
  };

  // ── Activity DnD ─────────────────────────────────────────────────────────
  const onDragEndActivities = async (result: DropResult, phaseId: string) => {
    if (!result.destination || !mod) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;
    const phases = (mod.phases ?? []).map(p => {
      if (p.id !== phaseId) return p;
      const acts = Array.from(p.activities ?? []);
      const [moved] = acts.splice(source.index, 1);
      acts.splice(destination.index, 0, moved);
      return { ...p, activities: acts.map((a, i) => ({ ...a, order: i })) };
    });
    setMod({ ...mod, phases });
    const phase = phases.find(p => p.id === phaseId);
    try {
      await templatesApi.reorderActivitiesInModule(
        moduleId, phaseId,
        (phase?.activities ?? []).map(a => ({ id: a.id, order: a.order })),
      );
    } catch { toast.error('Error al reordenar'); load(); }
  };

  // ── Phase CRUD ───────────────────────────────────────────────────────────
  const openAddPhase = () => {
    setEditPhase(null);
    setPhaseForm({ ...EMPTY_PHASE, color: PHASE_COLORS[(mod?.phases?.length ?? 0) % PHASE_COLORS.length] });
    setPhaseModal(true);
  };
  const openEditPhase = (p: TemplatePhase) => {
    setEditPhase(p);
    setPhaseForm({ name: p.name, slug: (p as any).slug ?? '', color: (p as any).color ?? '#60a5fa', estimatedDays: (p as any).estimatedDays ?? 0 });
    setPhaseModal(true);
  };
  const handleSavePhase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phaseForm.name.trim()) { toast.error('Nombre obligatorio'); return; }
    setSavingPhase(true);
    try {
      const slug = phaseForm.slug.trim() || phaseForm.name.toLowerCase().replace(/\s+/g, '_');
      const payload = { ...phaseForm, slug };
      if (editPhase) {
        await templatesApi.updatePhaseInModule(moduleId, editPhase.id, payload);
        toast.success('Fase actualizada');
      } else {
        await templatesApi.addPhaseToModule(moduleId, payload);
        toast.success('Fase agregada');
      }
      setPhaseModal(false);
      load();
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Error'); }
    finally { setSavingPhase(false); }
  };
  const handleDeletePhase = async (phaseId: string, phaseName: string) => {
    if (!confirm(`¿Eliminar la fase "${phaseName}" y todas sus actividades?`)) return;
    try {
      await templatesApi.deletePhaseFromModule(moduleId, phaseId);
      toast.success('Fase eliminada');
      load();
    } catch { toast.error('Error al eliminar fase'); }
  };

  // ── Activity CRUD ─────────────────────────────────────────────────────────
  const openAddActivity = (phaseId: string) => {
    setActPhaseId(phaseId);
    setEditAct(null);
    setActForm(EMPTY_ACT);
    setActModal(true);
  };
  const openEditActivity = (phaseId: string, act: TemplateActivity) => {
    setActPhaseId(phaseId);
    setEditAct(act);
    setActForm({
      name: act.name, description: act.description ?? '',
      estimatedHours: act.estimatedHours, calculatedDays: act.calculatedDays,
      priority: act.priority, defaultRole: act.defaultRole ?? '',
    });
    setActModal(true);
  };
  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actForm.name.trim()) { toast.error('Nombre obligatorio'); return; }
    setSavingAct(true);
    try {
      if (editAct) {
        await templatesApi.updateActivityInModule(moduleId, editAct.id, actForm);
        toast.success('Actividad actualizada');
      } else {
        await templatesApi.addActivityToModulePhase(moduleId, actPhaseId, actForm);
        toast.success('Actividad agregada');
      }
      setActModal(false);
      load();
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Error'); }
    finally { setSavingAct(false); }
  };
  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm('¿Eliminar esta actividad?')) return;
    try {
      await templatesApi.deleteActivityFromModule(moduleId, activityId);
      toast.success('Actividad eliminada');
      load();
    } catch { toast.error('Error al eliminar actividad'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
    </div>
  );
  if (!mod) return <div className="text-center py-20" style={{ color: tc.m }}>Módulo no encontrado</div>;

  const phases: TemplatePhase[] = (mod.phases ?? []) as TemplatePhase[];
  const totalActs = phases.reduce((s, p) => s + (p.activities?.length ?? 0), 0);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <BackButton href="/implementacion/modulos" label="Módulos" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
              style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.30)' }}>
              {(mod as any).code}
            </span>
            <h2 className="font-bold text-xl" style={{ color: tc.p }}>{mod.name}</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={mod.isActive
                ? { background: 'rgba(52,211,153,0.12)', color: '#34d399' }
                : { background: 'rgba(107,114,128,0.12)', color: '#6b7280' }}>
              {mod.isActive ? 'Activo' : 'Inactivo'}
            </span>
            {(mod as any).templateFlow && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                Plantilla: {(mod as any).templateFlow.name}
              </span>
            )}
          </div>
          {mod.description && (
            <p className="text-sm mt-1" style={{ color: tc.m }}>{mod.description}</p>
          )}
        </div>
        {/* Stats */}
        <div className="flex items-center gap-4 text-xs" style={{ color: tc.m }}>
          <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" />{phases.length} fase{phases.length !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{totalActs} actividad{totalActs !== 1 ? 'es' : ''}</span>
        </div>
      </div>

      {/* Phases section */}
      <div className="rounded-2xl overflow-hidden" style={glass()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: sep }}>
          <h3 className="font-semibold text-sm" style={{ color: tc.p }}>Fases y Actividades</h3>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={openAddPhase}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white btn-primary">
            <Plus className="w-3.5 h-3.5" /> Agregar fase
          </motion.button>
        </div>

        {phases.length === 0 ? (
          <div className="text-center py-16">
            <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: tc.m }} />
            <p className="text-sm mb-1 font-medium" style={{ color: tc.p }}>Sin fases</p>
            <p className="text-xs mb-4" style={{ color: tc.m }}>Agrega fases para estructurar las actividades de este módulo</p>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={openAddPhase}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-primary">
              <Plus className="w-4 h-4" /> Primera fase
            </motion.button>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEndPhases}>
            <Droppable droppableId="phases">
              {(droppable) => (
                <div ref={droppable.innerRef} {...droppable.droppableProps}>
                  {phases.map((phase, pi) => {
                    const isOpen = expanded.has(phase.id);
                    const phaseColor = (phase as any).color ?? '#60a5fa';
                    const acts: TemplateActivity[] = (phase.activities ?? []) as TemplateActivity[];
                    return (
                      <Draggable key={phase.id} draggableId={phase.id} index={pi}>
                        {(draggable) => (
                          <div ref={draggable.innerRef} {...draggable.draggableProps}
                            style={{ borderBottom: sep, ...draggable.draggableProps.style }}>
                            {/* Phase header */}
                            <div className="flex items-center gap-2 px-4 py-3">
                              <span {...draggable.dragHandleProps} className="cursor-grab p-1 rounded" style={{ color: tc.m }}>
                                <GripVertical className="w-4 h-4" />
                              </span>
                              {/* color dot */}
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: phaseColor }} />
                              <button className="flex-1 flex items-center gap-2 text-left"
                                onClick={() => toggleExpand(phase.id)}>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                                  style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                                  FSE-{String(pi + 1).padStart(2, '0')}
                                </span>
                                <span className="font-semibold text-sm" style={{ color: tc.p }}>{phase.name}</span>
                                <span className="text-xs" style={{ color: tc.m }}>
                                  {acts.length} act.
                                </span>
                                {isOpen
                                  ? <ChevronDown className="w-3.5 h-3.5 ml-auto" style={{ color: tc.m }} />
                                  : <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: tc.m }} />}
                              </button>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                onClick={() => openEditPhase(phase)}
                                className="p-1.5 rounded-lg" style={{ color: '#60a5fa' }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                onClick={() => handleDeletePhase(phase.id, phase.name)}
                                className="p-1.5 rounded-lg" style={{ color: '#f87171' }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </motion.button>
                            </div>

                            {/* Activities */}
                            <AnimatePresence>
                              {isOpen && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                                  style={{ overflow: 'hidden' }}>
                                  <DragDropContext onDragEnd={r => onDragEndActivities(r, phase.id)}>
                                    <Droppable droppableId={`acts-${phase.id}`}>
                                      {(dp2) => (
                                        <div ref={dp2.innerRef} {...dp2.droppableProps}
                                          className="pb-2"
                                          style={{ background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.12)' }}>
                                          {acts.map((act, ai) => {
                                            const prio = PRIORITY[act.priority] ?? PRIORITY.media;
                                            return (
                                              <Draggable key={act.id} draggableId={act.id} index={ai}>
                                                {(dp3) => (
                                                  <div ref={dp3.innerRef} {...dp3.draggableProps}
                                                    className="flex items-center gap-2 mx-3 my-1 px-3 py-2.5 rounded-xl"
                                                    style={{ background: isLight ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.05)', ...dp3.draggableProps.style }}>
                                                    <span {...dp3.dragHandleProps} className="cursor-grab shrink-0" style={{ color: tc.m }}>
                                                      <GripVertical className="w-3.5 h-3.5" />
                                                    </span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                                                      style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                                                      {act.code}
                                                    </span>
                                                    <span className="text-xs font-medium flex-1 truncate" style={{ color: tc.p }}>{act.name}</span>
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                                                      style={{ background: prio.bg, color: prio.color }}>
                                                      <Flag className="w-2.5 h-2.5 inline mr-0.5" />{prio.label}
                                                    </span>
                                                    <span className="flex items-center gap-0.5 text-[10px] shrink-0" style={{ color: tc.m }}>
                                                      <Clock className="w-3 h-3" />{act.estimatedHours}h
                                                    </span>
                                                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                                      onClick={() => openEditActivity(phase.id, act)}
                                                      className="p-1 rounded shrink-0" style={{ color: '#60a5fa' }}>
                                                      <Pencil className="w-3 h-3" />
                                                    </motion.button>
                                                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                                      onClick={() => handleDeleteActivity(act.id)}
                                                      className="p-1 rounded shrink-0" style={{ color: '#f87171' }}>
                                                      <Trash2 className="w-3 h-3" />
                                                    </motion.button>
                                                  </div>
                                                )}
                                              </Draggable>
                                            );
                                          })}
                                          {dp2.placeholder}
                                          <button onClick={() => openAddActivity(phase.id)}
                                            className="flex items-center gap-1.5 mx-3 mt-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                                            style={{ color: '#a78bfa', border: '1px dashed rgba(167,139,250,0.40)', width: 'calc(100% - 1.5rem)' }}>
                                            <Plus className="w-3.5 h-3.5" /> Agregar actividad
                                          </button>
                                        </div>
                                      )}
                                    </Droppable>
                                  </DragDropContext>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {droppable.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {/* Modal — Phase */}
      <Modal open={phaseModal} onClose={() => setPhaseModal(false)}
        title={editPhase ? `Editar fase · ${editPhase.name}` : 'Nueva fase'} width="max-w-md">
        <form onSubmit={handleSavePhase} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Nombre <span className="text-red-400 normal-case">*</span>
              </label>
              <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                placeholder="Ej: Análisis y Diseño"
                value={phaseForm.name} onChange={e => setPhaseForm(p => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Días estimados
              </label>
              <input type="number" min={0} className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={phaseForm.estimatedDays} onChange={e => setPhaseForm(p => ({ ...p, estimatedDays: +e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Color
              </label>
              <div className="flex items-center gap-2">
                <input type="color" className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                  value={phaseForm.color} onChange={e => setPhaseForm(p => ({ ...p, color: e.target.value }))} />
                <div className="flex gap-1 flex-wrap">
                  {PHASE_COLORS.map(c => (
                    <button key={c} type="button"
                      onClick={() => setPhaseForm(p => ({ ...p, color: c }))}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                      style={{ background: c, outline: phaseForm.color === c ? '2px solid white' : 'none', outlineOffset: '1px' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setPhaseModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button type="submit" disabled={savingPhase}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {savingPhase ? 'Guardando...' : editPhase ? 'Guardar cambios' : 'Agregar fase'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal — Activity */}
      <Modal open={actModal} onClose={() => setActModal(false)}
        title={editAct ? `Editar · ${editAct.name}` : 'Nueva actividad'} width="max-w-lg">
        <form onSubmit={handleSaveActivity} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {editAct && (
              <div className="col-span-2 flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                  {editAct.code}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Código asignado automáticamente</span>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Nombre <span className="text-red-400 normal-case">*</span>
              </label>
              <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                placeholder="Nombre de la actividad"
                value={actForm.name} onChange={e => setActForm(p => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Prioridad
              </label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={actForm.priority} onChange={e => setActForm(p => ({ ...p, priority: e.target.value }))}>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Horas estimadas
              </label>
              <input type="number" min={0} step={0.5} className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={actForm.estimatedHours} onChange={e => setActForm(p => ({ ...p, estimatedHours: +e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Días calculados
              </label>
              <input type="number" min={0} className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={actForm.calculatedDays} onChange={e => setActForm(p => ({ ...p, calculatedDays: +e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Descripción
              </label>
              <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={2}
                placeholder="Descripción opcional..."
                value={actForm.description} onChange={e => setActForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Rol responsable
              </label>
              <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                placeholder="Ej: Analista Funcional"
                value={actForm.defaultRole} onChange={e => setActForm(p => ({ ...p, defaultRole: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setActModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button type="submit" disabled={savingAct}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {savingAct ? 'Guardando...' : editAct ? 'Guardar cambios' : 'Agregar actividad'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
