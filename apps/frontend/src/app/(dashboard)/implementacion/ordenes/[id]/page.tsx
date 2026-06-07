'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Clock, Users, Info, FolderKanban, Send, Plus, X, Layers, Pencil, Check, Star,
} from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { Modal } from '@/components/ui/Modal';
import { serviceOrdersApi, templatesApi, usersApi, clientsApi } from '@/lib/api';
import { toast } from 'sonner';
import type { ServiceOrder, TemplateFlow, User, ClientStaff } from '@/types';

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pendiente:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   label: 'Pendiente'  },
  en_curso:   { color: '#34d399', bg: 'rgba(52,211,153,0.12)',   label: 'En curso'   },
  suspendida: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   label: 'Suspendida' },
  completada: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'Completada' },
  cancelada:  { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Cancelada'  },
};
const ESTADOS = ['pendiente','en_curso','suspendida','completada','cancelada'];

type Tab = 'info' | 'implementadores' | 'historial' | 'proyecto';

export default function OrdenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [os, setOs]       = useState<ServiceOrder | null>(null);
  const [tab, setTab]     = useState<Tab>('info');
  const [loading, setLoading] = useState(true);

  // Modal cambiar estado
  const [statusModal, setStatusModal]   = useState(false);
  const [newStatus, setNewStatus]       = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  // Editar información
  const [editMode, setEditMode]   = useState(false);
  const [editForm, setEditForm]   = useState<any>({});
  const [saving, setSaving]       = useState(false);
  const [clientStaffLeaders, setClientStaffLeaders] = useState<ClientStaff[]>([]);

  // Modal agregar implementador
  const [implModal, setImplModal]   = useState(false);
  const [agents, setAgents]         = useState<User[]>([]);
  const [selAgent, setSelAgent]     = useState('');
  const [implRole, setImplRole]     = useState('apoyo');
  const [savingImpl, setSavingImpl] = useState(false);

  // Modal generar proyecto (wizard 2 pasos)
  const [projModal, setProjModal]       = useState(false);
  const [projStep, setProjStep]         = useState<1 | 2>(1);
  const [templates, setTemplates]       = useState<TemplateFlow[]>([]);
  const [selTemplate, setSelTemplate]   = useState('');
  const [projName, setProjName]         = useState('');
  const [projModules, setProjModules]   = useState<{
    id: string; name: string;
    phases: { id: string; name: string; color?: string }[];
  }[]>([]);
  const [phaseDates, setPhaseDates]     = useState<Record<string, { startDate: string; endDate: string; agentLeaderId?: string; clientLeaderId?: string }>>({});
  const [excludedModuleIds, setExcludedModuleIds] = useState<Set<string>>(new Set());
  const [generatingProj, setGeneratingProj] = useState(false);

  const glass = (op = 0.75) => ({
    background: isLight ? `rgba(255,255,255,${op})` : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? '0 8px 32px rgba(30,60,120,0.15), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  });

  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  const rowBorder = isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await serviceOrdersApi.get(id);
      setOs(data);
    } catch { toast.error('Error al cargar la orden'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openEdit = async () => {
    if (!os) return;
    // Cargar agentes y personal del cliente si aún no se cargaron
    const [agentsRes, staffRes] = await Promise.all([
      agents.length ? Promise.resolve({ data: agents }) : usersApi.list({ limit: 100, userType: 'agent' }),
      clientStaffLeaders.length
        ? Promise.resolve(clientStaffLeaders)
        : clientsApi.getStaff(os.client.id),
    ]);
    if (!agents.length) setAgents((agentsRes as any).data);
    const staffList = Array.isArray(staffRes) ? staffRes : (staffRes as any).data ?? [];
    // Solo los que son líderes de proyecto
    setClientStaffLeaders(staffList.filter((s: any) => s.isProjectLeader));
    setEditForm({
      product:          os.product,
      scope:            os.scope ?? '',
      observations:     os.observations ?? '',
      startDate:        os.startDate.slice(0, 10),
      endDate:          os.endDate.slice(0, 10),
      durationDays:     os.durationDays,
      clinicalLeaderId: os.clinicalLeader?.id ?? '',
      financialLeaderId:os.financialLeader?.id ?? '',
      clientLeaderId:   (os as any).clientLeader?.id ?? '',
    });
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!os || !editForm.product?.trim()) { toast.error('El producto es obligatorio'); return; }
    setSaving(true);
    try {
      await serviceOrdersApi.update(os.id, {
        product:          editForm.product.trim().toUpperCase(),
        scope:            editForm.scope?.trim().toUpperCase() || undefined,
        observations:     editForm.observations?.trim().toUpperCase() || undefined,
        startDate:        editForm.startDate || undefined,
        endDate:          editForm.endDate || undefined,
        durationDays:     Number(editForm.durationDays) || undefined,
        clinicalLeaderId: editForm.clinicalLeaderId || null,
        financialLeaderId:editForm.financialLeaderId || null,
        clientLeaderId:   editForm.clientLeaderId || null,
      });
      toast.success('Información actualizada');
      setEditMode(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  const setF = (k: string, v: any) => setEditForm((p: any) => ({ ...p, [k]: v }));

  const openStatusModal = () => {
    setNewStatus(os?.status ?? 'pendiente');
    setStatusReason('');
    setStatusModal(true);
  };

  const handleChangeStatus = async () => {
    if (!newStatus) return;
    setSavingStatus(true);
    try {
      await serviceOrdersApi.changeStatus(id, newStatus, statusReason || undefined);
      toast.success('Estado actualizado');
      setStatusModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error');
    } finally { setSavingStatus(false); }
  };

  const openImplModal = async () => {
    if (!agents.length) {
      const res = await usersApi.list({ limit: 100, userType: 'agent' });
      setAgents(res.data);
    }
    setSelAgent('');
    setImplRole('apoyo');
    setImplModal(true);
  };

  const handleAddImpl = async () => {
    if (!selAgent) { toast.error('Selecciona un implementador'); return; }
    setSavingImpl(true);
    try {
      await serviceOrdersApi.addImplementer(id, selAgent, implRole);
      toast.success('Implementador asignado');
      setImplModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error');
    } finally { setSavingImpl(false); }
  };

  const handleRemoveImpl = async (userId: string) => {
    try {
      await serviceOrdersApi.removeImplementer(id, userId);
      toast.success('Implementador removido');
      load();
    } catch { toast.error('Error al remover implementador'); }
  };

  const openProjModal = async () => {
    if (!templates.length) {
      const res = await templatesApi.list({ limit: 100 });
      setTemplates(res.data);
    }
    setSelTemplate('');
    setProjName(os ? `${os.product} — ${new Date().getFullYear()}` : '');
    setProjStep(1);
    setProjModules([]);
    setPhaseDates({});
    setExcludedModuleIds(new Set());
    setProjModal(true);
  };

  const handleNextStep = async () => {
    if (!selTemplate) { toast.error('Selecciona una plantilla'); return; }
    try {
      const [tpl, agentsRes, staffRes] = await Promise.all([
        templatesApi.get(selTemplate),
        agents.length ? Promise.resolve({ data: agents }) : usersApi.list({ limit: 100, userType: 'agent' }),
        os && clientStaffLeaders.length
          ? Promise.resolve(clientStaffLeaders)
          : os ? clientsApi.getStaff(os.client.id) : Promise.resolve([]),
      ]);
      if (!agents.length) setAgents((agentsRes as any).data);
      if (!clientStaffLeaders.length) {
        const staffList = Array.isArray(staffRes) ? staffRes : (staffRes as any).data ?? [];
        setClientStaffLeaders(staffList.filter((s: any) => s.isProjectLeader));
      }
      const mods = (tpl.modules ?? []).map((m: any) => ({
        id: m.id,
        name: m.name,
        phases: (m.phases ?? []).map((p: any) => ({ id: p.id, name: p.name, color: p.color })),
      }));
      setProjModules(mods);
      const init: Record<string, { startDate: string; endDate: string; agentLeaderId?: string; clientLeaderId?: string }> = {};
      mods.forEach((m: any) => m.phases.forEach((p: any) => { init[p.id] = { startDate: '', endDate: '', agentLeaderId: '', clientLeaderId: '' }; }));
      setPhaseDates(init);
      setExcludedModuleIds(new Set());
      setProjStep(2);
    } catch { toast.error('Error al cargar módulos de la plantilla'); }
  };

  const handleGenerateProject = async () => {
    if (!selTemplate) { toast.error('Selecciona una plantilla'); return; }
    const activeModules = projModules.filter(m => !excludedModuleIds.has(m.id));
    if (activeModules.length === 0) { toast.error('Debes incluir al menos un módulo'); return; }
    setGeneratingProj(true);
    try {
      const phDates = Object.entries(phaseDates).map(([templatePhaseId, v]) => ({
        templatePhaseId,
        startDate: v.startDate || undefined,
        endDate: v.endDate || undefined,
        agentLeaderId: v.agentLeaderId || undefined,
        clientLeaderId: v.clientLeaderId || undefined,
      }));
      await serviceOrdersApi.generateProject(id, {
        templateFlowId: selTemplate,
        name: projName || undefined,
        phaseDates: phDates,
        excludedModuleIds: excludedModuleIds.size ? Array.from(excludedModuleIds) : undefined,
      });
      toast.success('Proyecto generado exitosamente');
      setProjModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al generar proyecto');
    } finally { setGeneratingProj(false); }
  };

  if (loading) {
    return (
      <div className="space-y-5 max-w-5xl">
        <BackButton href="/implementacion/ordenes" label="Órdenes de Servicio" />
        <div className="h-10 w-64 rounded-xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
        <div className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
      </div>
    );
  }

  if (!os) return null;

  const ss = STATUS_STYLE[os.status] ?? STATUS_STYLE.pendiente;

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'info',            label: 'Información',    icon: Info      },
    { key: 'implementadores', label: 'Implementadores', icon: Users     },
    { key: 'historial',       label: 'Historial',      icon: Clock     },
    { key: 'proyecto',        label: 'Proyecto',       icon: FolderKanban },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      <BackButton href="/implementacion/ordenes" label="Órdenes de Servicio" />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono font-bold text-lg" style={{ color: '#60a5fa' }}>{os.osNumber}</span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}40` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ss.color }} />
              {ss.label}
            </span>
          </div>
          <h2 className="font-bold text-xl mt-1" style={{ color: tc.p }}>{os.product}</h2>
          <p className="text-sm" style={{ color: tc.m }}>{os.client.businessName} · {os.client.nit}</p>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={openStatusModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.30)', color: '#60a5fa' }}>
          <Send className="w-4 h-4" /> Cambiar estado
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'btn-primary text-white' : ''}`}
            style={tab !== key ? { color: 'var(--text-secondary)' } : {}}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Tab: Información */}
      <AnimatePresence mode="wait">
        {tab === 'info' && (
          <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-5 space-y-4" style={glass()}>

            {/* Header con botón editar */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: tc.m }}>
                Detalles de la orden
              </p>
              {!editMode ? (
                <button onClick={openEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}>
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditMode(false)} disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    Cancelar
                  </button>
                  <button onClick={handleSaveEdit} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white btn-primary disabled:opacity-50">
                    {saving ? '...' : <><Check className="w-3.5 h-3.5" /> Guardar</>}
                  </button>
                </div>
              )}
            </div>

            {/* Vista lectura */}
            {!editMode && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Cliente',              value: os.client.businessName },
                    { label: 'Inicio',               value: new Date(os.startDate).toLocaleDateString('es-CO') },
                    { label: 'Fin',                  value: new Date(os.endDate).toLocaleDateString('es-CO') },
                    { label: 'Duración',             value: `${os.durationDays} días` },
                    { label: 'Líder asistencial',    value: os.clinicalLeader  ? `${os.clinicalLeader.firstName} ${os.clinicalLeader.lastName}`   : '—' },
                    { label: 'Líder financiero',     value: os.financialLeader ? `${os.financialLeader.firstName} ${os.financialLeader.lastName}` : '—' },
                    { label: 'Líder del cliente',    value: (os as any).clientLeader ? `${(os as any).clientLeader.firstName} ${(os as any).clientLeader.lastName}` : '—', highlight: true },
                    { label: 'Creado por',           value: `${os.createdBy.firstName} ${os.createdBy.lastName}` },
                    { label: 'Creado el',            value: new Date(os.createdAt).toLocaleDateString('es-CO') },
                  ].map(({ label, value, highlight }: any) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5 flex items-center gap-1" style={{ color: tc.m }}>
                        {highlight && <Star className="w-3 h-3 text-yellow-400" />}{label}
                      </p>
                      <p className="text-sm font-medium" style={{ color: highlight && value !== '—' ? '#fbbf24' : tc.s }}>{value}</p>
                    </div>
                  ))}
                </div>
                {os.scope && (
                  <div style={{ borderTop: rowBorder, paddingTop: 16 }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: tc.m }}>Alcance</p>
                    <p className="text-sm leading-relaxed" style={{ color: tc.s }}>{os.scope}</p>
                  </div>
                )}
                {os.observations && (
                  <div style={{ borderTop: rowBorder, paddingTop: 16 }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: tc.m }}>Observaciones</p>
                    <p className="text-sm leading-relaxed" style={{ color: tc.s }}>{os.observations}</p>
                  </div>
                )}
              </>
            )}

            {/* Modo edición */}
            {editMode && (
              <div className="space-y-4">
                {/* Producto */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    Producto / Servicio <span className="text-red-400 normal-case font-normal">*</span>
                  </label>
                  <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                    value={editForm.product ?? ''}
                    onChange={e => setF('product', e.target.value.toUpperCase())} />
                </div>

                {/* Fechas y duración */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Inicio</label>
                    <input type="date" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                      value={editForm.startDate ?? ''}
                      onChange={e => setF('startDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fin</label>
                    <input type="date" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                      value={editForm.endDate ?? ''}
                      onChange={e => setF('endDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Días</label>
                    <input type="number" min={0} className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                      value={editForm.durationDays ?? ''}
                      onChange={e => setF('durationDays', e.target.value)} />
                  </div>
                </div>

                {/* Líderes internos */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Líder asistencial</label>
                    <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                      value={editForm.clinicalLeaderId ?? ''}
                      onChange={e => setF('clinicalLeaderId', e.target.value)}>
                      <option value="">Sin asignar</option>
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Líder financiero</label>
                    <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                      value={editForm.financialLeaderId ?? ''}
                      onChange={e => setF('financialLeaderId', e.target.value)}>
                      <option value="">Sin asignar</option>
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Líder del cliente */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Star className="w-3.5 h-3.5 text-yellow-400" /> Líder del cliente
                  </label>
                  {clientStaffLeaders.length === 0 ? (
                    <div className="px-3 py-2.5 rounded-xl text-xs"
                      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.20)', color: '#fbbf24' }}>
                      El cliente no tiene personal marcado como líder de proyecto. Configúralo en la sección Clientes → Personal.
                    </div>
                  ) : (
                    <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                      value={editForm.clientLeaderId ?? ''}
                      onChange={e => setF('clientLeaderId', e.target.value)}>
                      <option value="">Sin asignar</option>
                      {clientStaffLeaders.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.firstName} {s.lastName} — {s.jobTitle ?? 'Funcionario'}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Alcance */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Alcance</label>
                  <textarea rows={3} className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none"
                    placeholder="Descripción del alcance..."
                    value={editForm.scope ?? ''}
                    onChange={e => setF('scope', e.target.value.toUpperCase())} />
                </div>

                {/* Observaciones */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Observaciones</label>
                  <textarea rows={2} className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none"
                    placeholder="Observaciones adicionales..."
                    value={editForm.observations ?? ''}
                    onChange={e => setF('observations', e.target.value.toUpperCase())} />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Implementadores */}
        {tab === 'implementadores' && (
          <motion.div key="impl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-5" style={glass()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: tc.p }}>
                {os.implementers.length} implementador{os.implementers.length !== 1 ? 'es' : ''} asignado{os.implementers.length !== 1 ? 's' : ''}
              </p>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={openImplModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.30)', color: '#60a5fa' }}>
                <Plus className="w-3.5 h-3.5" /> Agregar
              </motion.button>
            </div>
            {os.implementers.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: tc.m }}>No hay implementadores asignados</p>
            ) : (
              <div className="space-y-2">
                {os.implementers.map(impl => (
                  <div key={impl.user.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.04)', border: rowBorder }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: 'linear-gradient(135deg, #1E3A5F, #2D5086)' }}>
                        {impl.user.firstName[0]}{impl.user.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: tc.p }}>
                          {impl.user.firstName} {impl.user.lastName}
                        </p>
                        <p className="text-xs" style={{ color: tc.m }}>{impl.user.jobTitle ?? impl.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>{impl.role}</span>
                      <button onClick={() => handleRemoveImpl(impl.user.id)}
                        className="p-1 rounded-lg transition-colors" style={{ color: '#f87171' }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Historial */}
        {tab === 'historial' && (
          <motion.div key="hist" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-5" style={glass()}>
            <p className="text-sm font-semibold mb-4" style={{ color: tc.p }}>
              {os.history?.length ?? 0} registro{(os.history?.length ?? 0) !== 1 ? 's' : ''} de cambios
            </p>
            {!os.history?.length ? (
              <p className="text-sm text-center py-8" style={{ color: tc.m }}>Sin historial de cambios</p>
            ) : (
              <div className="relative pl-5">
                <div className="absolute left-[7px] top-2 bottom-2 w-px"
                  style={{ background: isLight ? 'rgba(30,60,120,0.15)' : 'rgba(255,255,255,0.10)' }} />
                <div className="space-y-4">
                  {[...os.history].reverse().map((h, i) => {
                    const ss2 = STATUS_STYLE[h.newValue ?? ''] ?? STATUS_STYLE.pendiente;
                    return (
                      <motion.div key={h.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }} className="flex gap-4 relative">
                        <div className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 z-10"
                          style={{ background: ss2.color, boxShadow: `0 0 0 3px ${ss2.color}25` }} />
                        <div className="flex-1 rounded-xl p-3"
                          style={{ background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.04)', border: rowBorder }}>
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                              style={{ background: ss2.bg, color: ss2.color }}>
                              {h.newValue}
                            </span>
                            <span className="text-xs" style={{ color: tc.m }}>
                              {new Date(h.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          {h.reason && <p className="text-sm leading-relaxed" style={{ color: tc.s }}>{h.reason}</p>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: Proyecto */}
        {tab === 'proyecto' && (
          <motion.div key="proj" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-5" style={glass()}>
            {os.project ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.30)' }}>
                    <FolderKanban className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: tc.p }}>{os.project.name}</p>
                    <p className="text-xs" style={{ color: tc.m }}>Estado: {os.project.status} · {Number(os.project.progressPercent).toFixed(0)}% completado</p>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${os.project.progressPercent}%`, background: 'linear-gradient(90deg, #60a5fa, #a78bfa)' }} />
                </div>
                <a href={`/implementacion/proyectos/${os.project.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.30)', color: '#a78bfa' }}>
                  <Layers className="w-4 h-4" /> Ver proyecto completo
                </a>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)' }}>
                  <FolderKanban className="w-7 h-7" style={{ color: tc.m }} />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: tc.p }}>Sin proyecto generado</p>
                  <p className="text-sm" style={{ color: tc.m }}>Genera el proyecto seleccionando una plantilla de implementación</p>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={openProjModal}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white font-semibold mx-auto">
                  <Plus className="w-4 h-4" /> Generar Proyecto
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Cambiar estado */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Cambiar estado de la OS" width="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nuevo estado</label>
            <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              {ESTADOS.map(s => <option key={s} value={s}>{STATUS_STYLE[s]?.label ?? s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Motivo del cambio</label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
              placeholder="Opcional — describe el motivo..."
              value={statusReason} onChange={e => setStatusReason(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setStatusModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleChangeStatus} disabled={savingStatus}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {savingStatus ? 'Guardando...' : 'Cambiar estado'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar implementador */}
      <Modal open={implModal} onClose={() => setImplModal(false)} title="Asignar implementador" width="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Usuario</label>
            <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={selAgent} onChange={e => setSelAgent(e.target.value)}>
              <option value="">Seleccionar...</option>
              {agents.filter(a => !os.implementers.some(imp => imp.user.id === a.id))
                .map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName} — {a.role.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Rol en la OS</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              placeholder="apoyo, analista, configurador..."
              value={implRole} onChange={e => setImplRole(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setImplModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleAddImpl} disabled={savingImpl}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {savingImpl ? 'Asignando...' : 'Asignar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Generar proyecto — wizard 2 pasos */}
      <Modal open={projModal} onClose={() => { setProjModal(false); setProjStep(1); }}
        title={projStep === 1 ? 'Generar proyecto desde plantilla' : 'Asignar fechas por módulo'}
        width="max-w-lg">
        {projStep === 1 ? (
          <div className="space-y-4">
            {/* Indicador de paso */}
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="px-2 py-0.5 rounded-full text-white text-[11px] font-bold"
                style={{ background: 'rgba(96,165,250,0.8)' }}>1</span>
              <span>Seleccionar plantilla</span>
              <span className="flex-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>2</span>
              <span>Fechas por fase</span>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Plantilla <span className="text-red-400 normal-case">*</span>
              </label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={selTemplate} onChange={e => setSelTemplate(e.target.value)}>
                <option value="">Seleccionar plantilla...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name} v{t.version}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nombre del proyecto</label>
              <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                placeholder="Se autogenera si se deja vacío"
                value={projName} onChange={e => setProjName(e.target.value)} />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setProjModal(false); setProjStep(1); }}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={handleNextStep}
                className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold">
                Siguiente →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Indicador de paso */}
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>1</span>
              <span>Seleccionar plantilla</span>
              <span className="flex-1 border-t" style={{ borderColor: 'var(--border-subtle)' }} />
              <span className="px-2 py-0.5 rounded-full text-white text-[11px] font-bold"
                style={{ background: 'rgba(96,165,250,0.8)' }}>2</span>
              <span>Módulos y fechas</span>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Desactiva los módulos que no aplican. En cada fase puedes asignar fechas y líderes.
            </p>

            {projModules.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: tc.m }}>
                Esta plantilla no tiene módulos configurados.
              </p>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {projModules.map((mod, mi) => {
                  const excluded = excludedModuleIds.has(mod.id);
                  const toggleMod = () => setExcludedModuleIds(prev => {
                    const s = new Set(prev);
                    excluded ? s.delete(mod.id) : s.add(mod.id);
                    return s;
                  });
                  return (
                    <div key={mod.id} className="rounded-xl overflow-hidden transition-opacity"
                      style={{ border: `1px solid ${excluded ? 'rgba(248,113,113,0.30)' : 'rgba(255,255,255,0.10)'}`, opacity: excluded ? 0.55 : 1 }}>

                      {/* Cabecera módulo con toggle */}
                      <div className="px-3 py-2 flex items-center gap-2"
                        style={{ background: excluded ? 'rgba(248,113,113,0.06)' : 'rgba(96,165,250,0.08)' }}>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: excluded ? 'rgba(248,113,113,0.18)' : 'rgba(96,165,250,0.20)', color: excluded ? '#f87171' : '#60a5fa' }}>
                          MOD-{String(mi + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: tc.p }}>{mod.name}</span>
                        <span className="text-xs" style={{ color: tc.m }}>
                          {mod.phases.length} fase{mod.phases.length !== 1 ? 's' : ''}
                        </span>
                        <button onClick={toggleMod}
                          title={excluded ? 'Incluir módulo' : 'Excluir módulo'}
                          className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                          style={{
                            background: excluded ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                            border: `1px solid ${excluded ? 'rgba(52,211,153,0.30)' : 'rgba(248,113,113,0.30)'}`,
                            color: excluded ? '#34d399' : '#f87171',
                          }}>
                          {excluded ? <><Check className="w-3 h-3" /> Incluir</> : <><X className="w-3 h-3" /> Excluir</>}
                        </button>
                      </div>

                      {/* Fases — ocultas si módulo excluido */}
                      {!excluded && (
                        mod.phases.length === 0 ? (
                          <p className="px-3 py-2 text-xs" style={{ color: tc.m }}>Sin fases</p>
                        ) : (
                          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            {mod.phases.map((ph, pi) => (
                              <div key={ph.id} className="px-3 py-3 space-y-2">
                                {/* Encabezado fase */}
                                <div className="flex items-center gap-2">
                                  {ph.color && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ph.color }} />}
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                                    FSE-{String(pi + 1).padStart(2, '0')}
                                  </span>
                                  <span className="text-xs font-medium" style={{ color: tc.s }}>{ph.name}</span>
                                </div>

                                {/* Fechas */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Inicio</label>
                                    <input type="date" className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                      value={phaseDates[ph.id]?.startDate ?? ''}
                                      onChange={e => setPhaseDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], startDate: e.target.value } }))} />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fin</label>
                                    <input type="date" className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                      value={phaseDates[ph.id]?.endDate ?? ''}
                                      onChange={e => setPhaseDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], endDate: e.target.value } }))} />
                                  </div>
                                </div>

                                {/* Líderes */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                      Líder agente
                                    </label>
                                    <select className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                      value={phaseDates[ph.id]?.agentLeaderId ?? ''}
                                      onChange={e => setPhaseDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], agentLeaderId: e.target.value } }))}>
                                      <option value="">Sin asignar</option>
                                      {agents.map(a => (
                                        <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                      <Star className="w-2.5 h-2.5 text-yellow-400" /> Líder cliente
                                    </label>
                                    {clientStaffLeaders.length === 0 ? (
                                      <div className="px-2 py-1.5 rounded-lg text-[10px]"
                                        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.20)', color: '#fbbf24' }}>
                                        Sin líderes configurados
                                      </div>
                                    ) : (
                                      <select className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                        value={phaseDates[ph.id]?.clientLeaderId ?? ''}
                                        onChange={e => setPhaseDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], clientLeaderId: e.target.value } }))}>
                                        <option value="">Sin asignar</option>
                                        {clientStaffLeaders.map((s: any) => (
                                          <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Resumen módulos */}
            {projModules.length > 0 && (
              <div className="flex items-center gap-2 text-xs px-2" style={{ color: tc.m }}>
                <span className="font-semibold text-green-400">{projModules.length - excludedModuleIds.size}</span>
                <span>de {projModules.length} módulos incluidos</span>
                {excludedModuleIds.size > 0 && (
                  <span className="ml-auto" style={{ color: '#f87171' }}>
                    {excludedModuleIds.size} excluido{excludedModuleIds.size !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setProjStep(1)}
                className="px-4 py-2.5 rounded-xl text-sm"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                ← Atrás
              </button>
              <button onClick={handleGenerateProject} disabled={generatingProj}
                className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
                {generatingProj ? 'Generando...' : 'Generar proyecto'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
