'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Clock, Users, Info, FolderKanban, Send, Plus, X, Layers, Pencil, Check, Star,
  GraduationCap, CheckCircle2, AlertCircle, Loader2, FolderOpen, BarChart3, MessageSquare,
  Lock, Globe, Target, ShieldAlert, Mail, CalendarClock, RefreshCw, ToggleLeft, ToggleRight,
  FileText, Trash2, ChevronDown, ClipboardList,
} from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { DocumentosSection } from '@/components/ui/DocumentosSection';
import { Modal } from '@/components/ui/Modal';
import { InformeEjecutivo } from '@/components/ui/InformeEjecutivo';
import { InformeConActas } from '@/components/ui/InformeConActas';
import { serviceOrdersApi, templatesApi, usersApi, clientsApi, actasApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { toast } from 'sonner';
import type { ServiceOrder, TemplateFlow, User, ClientStaff } from '@/types';

const clampDateYear = (val: string): string => {
  if (!val) return val;
  const parts = val.split('-');
  if (parts[0] && parts[0].length > 4) parts[0] = parts[0].slice(0, 4);
  return parts.join('-');
};

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pendiente:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   label: 'Pendiente'  },
  en_curso:   { color: '#34d399', bg: 'rgba(52,211,153,0.12)',   label: 'En curso'   },
  suspendida: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   label: 'Suspendida' },
  completada: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'Completada' },
  cancelada:  { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Cancelada'  },
};
const ESTADOS = ['pendiente','en_curso','suspendida','completada','cancelada'];

type Tab = 'info' | 'implementadores' | 'historial' | 'proyecto' | 'capacitaciones' | 'documentos' | 'correos';

export default function OrdenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can } = usePermission();

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

  // Informes
  const [showInforme, setShowInforme]           = useState(false);
  const [showInformeActas, setShowInformeActas] = useState(false);
  const [conActasAutoEmail, setConActasAutoEmail]       = useState<{ destinatarios: string[]; asunto?: string } | null>(null);
  const [ejecutivoAutoEmail, setEjecutivoAutoEmail]     = useState<{ destinatarios: string[]; asunto?: string } | null>(null);
  const [showReportMenu, setShowReportMenu]     = useState(false);
  const [reportMenuPos, setReportMenuPos]       = useState({ top: 0, right: 0 });
  const reportBtnRef = useRef<HTMLButtonElement>(null);
  const [downloadingPlan, setDownloadingPlan]   = useState(false);

  // Email manual del informe
  const [emailModal, setEmailModal]         = useState(false);
  const [emailTo, setEmailTo]               = useState('');
  const [emailSubject, setEmailSubject]     = useState('');
  const [emailReportType, setEmailReportType] = useState<'ejecutivo' | 'completo'>('ejecutivo');
  const [sendingEmail]                      = useState(false);

  // Automatización de correos
  const [autoModal, setAutoModal]           = useState(false);
  const [autoTab, setAutoTab]               = useState<'weekly'|'bimensual'>('weekly');
  // Weekly
  const [wEnabled, setWEnabled]             = useState(false);
  const [wDia, setWDia]                     = useState(1);     // Lunes
  const [wHora, setWHora]                   = useState(8);
  const [wMinuto, setWMinuto]               = useState(0);
  const [wTo, setWTo]                       = useState('');
  const [wAsunto, setWAsunto]               = useState('');
  const [wReportType, setWReportType]       = useState<'ejecutivo'|'completo'>('ejecutivo');
  const [wLast, setWLast]                   = useState<string|null>(null);
  // Bi-monthly
  const [bEnabled, setBEnabled]             = useState(false);
  const [bHora, setBHora]                   = useState(8);
  const [bMinuto, setBMinuto]               = useState(0);
  const [bTo, setBTo]                       = useState('');
  const [bAsunto, setBAsunto]               = useState('');
  const [bLast, setBLast]                   = useState<string|null>(null);
  // Loading states
  const [loadingAuto, setLoadingAuto]       = useState(false);
  const [savingAuto, setSavingAuto]         = useState(false);
  const [runningW, setRunningW]             = useState(false);
  const [runningB, setRunningB]             = useState<'quincenal'|'mensual'|null>(null);

  // ── Tab: Correos ──────────────────────────────────────────────────────────
  interface ContactOption { id: string; name: string; email: string; role: string; group: 'cliente' | 'aura'; }
  const [correosList, setCorreosList]       = useState<string[]>([]);
  const [correoInput, setCorreoInput]       = useState('');
  const [correosLoaded, setCorreosLoaded]   = useState(false);
  const [savingCorreos, setSavingCorreos]   = useState(false);
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [correosSearch, setCorreosSearch]   = useState('');

  const loadCorreos = useCallback(async () => {
    if (!os) return;
    try {
      const [w, b, clientData, agentsData] = await Promise.all([
        serviceOrdersApi.getWeeklySchedule(os.id),
        serviceOrdersApi.getBimensualSchedule(os.id),
        clientsApi.get((os as any).clientId ?? os.client.id),
        usersApi.listAgents({ limit: 200 }),
      ]);
      // Merge existing recipients from both schedules
      const merged = Array.from(new Set([
        ...(w?.destinatarios ?? []),
        ...(b?.destinatarios ?? []),
      ]));
      setCorreosList(merged);

      // Build contact options — client staff + AURA team members
      const opts: ContactOption[] = [];
      // Client staff (only with email)
      (clientData?.staff ?? []).forEach((s: ClientStaff) => {
        if (s.email && s.isActive) opts.push({
          id: s.id, name: `${s.firstName} ${s.lastName}`,
          email: s.email.trim().toLowerCase(),
          role: s.jobTitle ?? (s.isProjectLeader ? 'Líder de Proyecto' : 'Personal cliente'),
          group: 'cliente',
        });
      });
      // AURA agents (all active)
      (agentsData?.data ?? []).forEach((u: any) => {
        if (u.email) opts.push({
          id: u.id, name: `${u.firstName} ${u.lastName}`,
          email: u.email.trim().toLowerCase(),
          role: u.jobTitle ?? 'Agente',
          group: 'aura',
        });
      });
      // Deduplicate by email
      const seen = new Set<string>();
      setContactOptions(opts.filter(o => { if (seen.has(o.email)) return false; seen.add(o.email); return true; }));
    } catch { /* start empty */ }
    setCorreosLoaded(true);
  }, [os]);

  const toggleCorreo = (email: string) => {
    setCorreosList(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email],
    );
  };

  const addManualCorreo = () => {
    const trimmed = correoInput.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Correo inválido'); return;
    }
    if (correosList.includes(trimmed)) { toast.info('Ya está en la lista'); return; }
    setCorreosList(prev => [...prev, trimmed]);
    setCorreoInput('');
  };

  const removeCorreo = (email: string) => setCorreosList(prev => prev.filter(e => e !== email));

  const saveCorreos = async () => {
    if (!os) return;
    if (correosList.length === 0) { toast.error('Agrega al menos un correo'); return; }
    setSavingCorreos(true);
    try {
      const [w, b] = await Promise.all([
        serviceOrdersApi.getWeeklySchedule(os.id),
        serviceOrdersApi.getBimensualSchedule(os.id),
      ]);
      await Promise.all([
        serviceOrdersApi.saveWeeklySchedule(os.id, {
          ...(w ?? {}), enabled: w?.enabled ?? false,
          destinatarios: correosList,
        }),
        serviceOrdersApi.saveBimensualSchedule(os.id, {
          ...(b ?? {}), enabled: b?.enabled ?? false,
          destinatarios: correosList,
        }),
      ]);
      toast.success('Destinatarios guardados');
    } catch { toast.error('Error al guardar destinatarios'); }
    finally { setSavingCorreos(false); }
  };

  const openAutoModal = async () => {
    setAutoModal(true);
    setLoadingAuto(true);
    try {
      const [w, b] = await Promise.all([
        serviceOrdersApi.getWeeklySchedule(os!.id),
        serviceOrdersApi.getBimensualSchedule(os!.id),
      ]);
      if (w) {
        setWEnabled(w.enabled ?? false); setWDia(w.diaSemana ?? 1);
        setWHora(w.hora ?? 8); setWMinuto(w.minuto ?? 0);
        setWAsunto(w.asunto ?? '');
        setWReportType(w.reportType ?? 'ejecutivo');
        setWLast(w.lastSentAt ?? null);
      }
      if (b) {
        setBEnabled(b.enabled ?? false); setBHora(b.hora ?? 8); setBMinuto(b.minuto ?? 0);
        setBAsunto(b.asunto ?? '');
        setBLast(b.lastSentAt ?? null);
      }
      // Load recipients into correosList if not already loaded from the Correos tab
      if (!correosLoaded) {
        const merged = Array.from(new Set([
          ...(w?.destinatarios ?? []),
          ...(b?.destinatarios ?? []),
        ]));
        if (merged.length) setCorreosList(merged);
      }
    } catch { /* no hay config guardada */ } finally { setLoadingAuto(false); }
  };

  const saveWeekly = async () => {
    if (wEnabled && !correosList.length) { toast.error('Agrega destinatarios en la pestaña Correos'); return; }
    setSavingAuto(true);
    try {
      await serviceOrdersApi.saveWeeklySchedule(os!.id, {
        enabled: wEnabled, diaSemana: wDia, hora: wHora, minuto: wMinuto,
        destinatarios: correosList, asunto: wAsunto.trim() || undefined,
        reportType: wReportType,
      });
      toast.success(wEnabled ? 'Automatización semanal activada' : 'Desactivada');
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Error al guardar'); }
    finally { setSavingAuto(false); }
  };

  const saveBimensual = async () => {
    if (bEnabled && !correosList.length) { toast.error('Agrega destinatarios en la pestaña Correos'); return; }
    setSavingAuto(true);
    try {
      await serviceOrdersApi.saveBimensualSchedule(os!.id, {
        enabled: bEnabled, hora: bHora, minuto: bMinuto,
        destinatarios: correosList, asunto: bAsunto.trim() || undefined,
      });
      toast.success(bEnabled ? 'Automatización bimensual activada' : 'Desactivada');
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Error al guardar'); }
    finally { setSavingAuto(false); }
  };

  const sendManualEmail = () => {
    const dest = emailTo.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
    if (!dest.length) { toast.error('Ingresa al menos un destinatario'); return; }
    const asunto = emailSubject.trim() || undefined;
    setEmailModal(false);
    if (emailReportType === 'completo') {
      setConActasAutoEmail({ destinatarios: dest, asunto });
      setShowInformeActas(true);
    } else {
      setEjecutivoAutoEmail({ destinatarios: dest, asunto });
      setShowInforme(true);
    }
  };

  // Modal nota historial
  const [noteModal, setNoteModal]         = useState(false);
  const [noteText, setNoteText]           = useState('');
  const [noteType, setNoteType]           = useState<'interna' | 'general'>('general');
  const [noteLevel, setNoteLevel]         = useState<'baja' | 'media' | 'alta' | 'critica'>('media');
  const [noteSubtype, setNoteSubtype]     = useState<'proximos_logros' | 'riesgo_critico' | ''>('');
  const [noteMitigation, setNoteMitigation] = useState('');
  const [savingNote, setSavingNote]       = useState(false);
  const [noteNotifyClient, setNoteNotifyClient] = useState(false);

  // Tab capacitaciones
  const [capStaff,    setCapStaff]    = useState<ClientStaff[]>([]);
  const [capActas,    setCapActas]    = useState<any[]>([]);
  const [capLoading,  setCapLoading]  = useState(false);
  const [capSubTab,   setCapSubTab]   = useState<'pendiente' | 'en_proceso' | 'capacitados'>('pendiente');
  const [capLoaded,   setCapLoaded]   = useState(false);

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
      agents.length ? Promise.resolve({ data: agents }) : usersApi.listAgents({ limit: 100 }),
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

  const setF = (k: string, v: any) => setEditForm((p: any) => ({ ...p, [k]: typeof v === 'string' && /date/i.test(k) ? clampDateYear(v) : v }));

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
      const res = await usersApi.listAgents({ limit: 100 });
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

  const handleAddNote = async () => {
    if (!noteText.trim()) { toast.error('Escribe un comentario'); return; }
    if (noteSubtype === 'riesgo_critico' && !noteMitigation.trim()) {
      toast.error('Describe la mitigación del riesgo');
      return;
    }
    setSavingNote(true);
    try {
      const trimmedNote = noteText.trim();
      const trimmedMit  = noteSubtype === 'riesgo_critico' ? noteMitigation.trim() : undefined;
      await serviceOrdersApi.addNote(
        id, trimmedNote, noteType, noteLevel,
        noteSubtype || undefined, trimmedMit,
      );
      // Always notify agents; optionally also notify client contacts
      try {
        const result = await serviceOrdersApi.notifyNote(id, {
          noteText: trimmedNote, noteType, noteLevel,
          noteSubtype: noteSubtype || undefined,
          noteMitigation: trimmedMit,
          notifyClient: noteNotifyClient,
        });
        const sent = result?.sent ?? 0;
        if (sent > 0) {
          toast.success(`Nota guardada · Notificación enviada a ${sent} destinatario${sent > 1 ? 's' : ''}`);
        } else {
          toast.success('Nota guardada (configura destinatarios en la pestaña Correos)');
        }
      } catch {
        toast.success('Nota guardada');
        toast.error('No se pudo enviar la notificación por correo');
      }
      setNoteModal(false);
      setNoteText('');
      setNoteType('general');
      setNoteLevel('media');
      setNoteSubtype('');
      setNoteMitigation('');
      load();
    } catch { toast.error('Error al agregar la nota'); }
    finally { setSavingNote(false); }
  };

  const handleDeleteHistory = async (historyId: string) => {
    if (!confirm('¿Eliminar esta entrada del historial? Esta acción no se puede deshacer.')) return;
    try {
      await serviceOrdersApi.deleteHistoryEntry(id, historyId);
      toast.success('Entrada eliminada');
      load();
    } catch { toast.error('Error al eliminar la entrada'); }
  };

  const loadCapacitaciones = async () => {
    if (!os) return;
    setCapLoading(true);
    try {
      const [staffRes, actasRes] = await Promise.all([
        clientsApi.getStaff(os.client.id),
        os.project?.id ? actasApi.list(os.project.id) : Promise.resolve([]),
      ]);
      const staff = Array.isArray(staffRes) ? staffRes : (staffRes as any).data ?? [];
      const actas = (Array.isArray(actasRes) ? actasRes : []).filter((a: any) => a.type === 'capacitacion');
      setCapStaff(staff);
      setCapActas(actas);
      setCapLoaded(true);
    } catch { toast.error('Error al cargar capacitaciones'); }
    finally { setCapLoading(false); }
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
        agents.length ? Promise.resolve({ data: agents }) : usersApi.listAgents({ limit: 100 }),
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

  const handleDownloadPlan = async () => {
    if (!os) return;
    setDownloadingPlan(true);
    setShowReportMenu(false);
    try {
      // Fetch the same executive-report data (includes project.modules hierarchy)
      const raw = await serviceOrdersApi.executiveReport(os.id);
      const project = raw.project;
      // Flatten activities into projectTasks (same shape as backend transformPdfData)
      const projectTasks = (project?.modules ?? []).flatMap((mod: any) =>
        (mod.phases ?? []).flatMap((phase: any) =>
          (phase.activities ?? []).map((act: any) => ({
            id:                   act.id,
            module:               mod.name,
            phase:                phase.name,
            code:                 act.code,
            taskName:             act.name,
            status:               act.status,
            completionPercentage: Number(act.progressPercent ?? 0),
            assignedUser:         act.assignedTo ?? null,
            plannedStartDate:     act.plannedStartDate ?? phase.startDate ?? mod.startDate ?? null,
            plannedEndDate:       act.plannedEndDate   ?? phase.endDate   ?? mod.endDate   ?? null,
            executionDate:        act.executionDate    ?? null,
            actualEndDate:        act.actualEndDate    ?? null,
          }))
        )
      );
      const data = {
        company:     raw.company,
        os:          { ...raw.os, client: raw.os?.client ?? os.client, projectTasks },
        project,
        generatedAt: new Date().toISOString(),
      };
      const res = await fetch('/api/generate-plan-trabajo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) throw new Error('Error generando PDF');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `plan-trabajo-${os.osNumber ?? 'doc'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al generar el Plan de Trabajo');
    } finally {
      setDownloadingPlan(false);
    }
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
    { key: 'info',             label: 'Información',    icon: Info           },
    { key: 'implementadores',  label: 'Implementadores', icon: Users         },
    { key: 'historial',        label: 'Historial',      icon: Clock          },
    { key: 'proyecto',         label: 'Proyecto',       icon: FolderKanban   },
    { key: 'capacitaciones',   label: 'Capacitaciones', icon: GraduationCap  },
    { key: 'documentos',       label: 'Documentos',     icon: FolderOpen     },
    { key: 'correos',          label: 'Correos',        icon: Mail           },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      <BackButton href="/implementacion/ordenes" label="Órdenes de Servicio" />

      {/* Header */}
      <div className="rounded-2xl p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', backdropFilter: 'blur(20px) saturate(160%)' }}>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono font-bold text-lg" style={{ color: 'var(--accent-blue)' }}>{os.osNumber}</span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.color}40` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ss.color }} />
              {ss.label}
            </span>
          </div>
          <h2 className="font-bold text-xl mt-1" style={{ color: tc.p }}>{os.product}</h2>
          <p className="text-sm" style={{ color: tc.m }}>{os.client.businessName} · {os.client.nit}</p>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">

          {/* Dropdown Ver Informe */}
          <div ref={reportBtnRef} className="relative inline-block">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => {
                const el = reportBtnRef.current;
                if (el) {
                  const r = el.getBoundingClientRect();
                  setReportMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
                }
                setShowReportMenu(v => !v);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'var(--accent-violet-bg)', border: '1px solid var(--accent-violet-border)', color: 'var(--accent-violet)' }}>
              <BarChart3 className="w-4 h-4" />
              Ver Informe
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showReportMenu ? 'rotate-180' : ''}`} />
            </motion.button>
          </div>

          {/* Portal: menú fuera de cualquier stacking context */}
          {showReportMenu && typeof window !== 'undefined' && createPortal(
            <>
              <div className="fixed inset-0 z-[500]" onClick={() => setShowReportMenu(false)} />
              <div
                className="fixed z-[501] w-60 rounded-2xl overflow-hidden"
                style={{
                  top: reportMenuPos.top,
                  right: reportMenuPos.right,
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-strong)',
                  backdropFilter: 'blur(24px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.40), 0 4px 16px rgba(0,0,0,0.25)',
                }}
              >
                <button onClick={() => { setShowInforme(true); setShowReportMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors hover:bg-white/5">
                  <BarChart3 className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-violet)' }} />
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Informe Ejecutivo</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Resumen de avance y equipo</p>
                  </div>
                </button>
                <button onClick={() => { setShowInformeActas(true); setShowReportMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors hover:bg-white/5"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-violet)' }} />
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Informe con Actas</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Incluye todas las actas</p>
                  </div>
                </button>
                <button onClick={handleDownloadPlan} disabled={downloadingPlan}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm transition-colors hover:bg-white/5 disabled:opacity-50"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {downloadingPlan
                    ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--accent-blue)' }} />
                    : <ClipboardList className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-blue)' }} />}
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {downloadingPlan ? 'Generando…' : 'Plan de Trabajo'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>PDF con todas las actividades</p>
                  </div>
                </button>
              </div>
            </>,
            document.body
          )}

          {/* Enviar por correo */}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => { setEmailTo(''); setEmailSubject(''); setEmailReportType('ejecutivo'); setEmailModal(true); }}
            className="flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'var(--accent-violet-bg)', border: '1px solid var(--accent-violet-border)', color: 'var(--accent-violet)' }}
            title="Enviar informe por correo">
            <Mail className="w-4 h-4" />
          </motion.button>

          {/* Automatización */}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={openAutoModal}
            className="flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'var(--accent-violet-bg)', border: '1px solid var(--accent-violet-border)', color: 'var(--accent-violet)' }}
            title="Automatización de correos">
            <CalendarClock className="w-4 h-4" />
          </motion.button>

          {/* Cambiar estado */}
          {can('orders.editar') && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={openStatusModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue-border)', color: 'var(--accent-blue)' }}>
              <Send className="w-4 h-4" /> Cambiar estado
            </motion.button>
          )}
        </div>
      </div>

      {/* Tabs — scroll horizontal en móvil */}
      <div className="overflow-x-auto pb-0.5" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-1 p-1 rounded-xl w-fit min-w-max" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => {
              setTab(key);
              if (key === 'capacitaciones' && !capLoaded) loadCapacitaciones();
              if (key === 'correos' && !correosLoaded) loadCorreos();
            }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0 ${tab === key ? 'btn-primary text-white' : ''}`}
              style={tab !== key ? { color: 'var(--text-secondary)' } : {}}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
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
              {!editMode && can('orders.editar') ? (
                <button onClick={openEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--accent-blue-bg)', border: '1px solid var(--accent-blue-border)', color: 'var(--accent-blue)' }}>
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
                    { label: 'Inicio',               value: new Date(os.startDate).toLocaleDateString('es-CO', { timeZone: 'UTC' }) },
                    { label: 'Fin',                  value: new Date(os.endDate).toLocaleDateString('es-CO', { timeZone: 'UTC' }) },
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
                    <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                      value={editForm.startDate ?? ''}
                      onChange={e => setF('startDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fin</label>
                    <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
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
              {can('orders.asignar') && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={openImplModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.30)', color: '#60a5fa' }}>
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </motion.button>
              )}
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
                      {can('orders.asignar') && (
                        <button onClick={() => handleRemoveImpl(impl.user.id)}
                          className="p-1 rounded-lg transition-colors" style={{ color: '#f87171' }}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
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
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: tc.p }}>
                {os.history?.length ?? 0} registro{(os.history?.length ?? 0) !== 1 ? 's' : ''} de cambios
              </p>
              {can('orders.editar') && (
                <button onClick={() => { setNoteText(''); setNoteModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}>
                  <MessageSquare className="w-3.5 h-3.5" /> Agregar nota
                </button>
              )}
            </div>
            {!os.history?.length ? (
              <p className="text-sm text-center py-8" style={{ color: tc.m }}>Sin historial de cambios</p>
            ) : (
              <div className="relative pl-5">
                <div className="absolute left-[7px] top-2 bottom-2 w-px"
                  style={{ background: isLight ? 'rgba(30,60,120,0.15)' : 'rgba(255,255,255,0.10)' }} />
                <div className="space-y-4">
                  {os.history.map((h, i) => {
                    const isNota    = (h as any).fieldName === 'nota';
                    const nType     = (h as any).noteType     as string | null;
                    const nLevel    = (h as any).noteLevel    as string | null;
                    const nSubtype  = (h as any).noteSubtype  as string | null;
                    const nMitigation = (h as any).noteMitigation as string | null;
                    const ss2       = isNota ? null : (STATUS_STYLE[h.newValue ?? ''] ?? STATUS_STYLE.pendiente);

                    const LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
                      critica: { label: 'Crítica', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
                      alta:    { label: 'Alta',    color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
                      media:   { label: 'Media',   color: '#eab308', bg: 'rgba(234,179,8,0.12)'  },
                      baja:    { label: 'Baja',    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
                    };
                    const SUBTYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
                      proximos_logros: { label: 'Próximos logros', color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)'  },
                      riesgo_critico:  { label: 'Riesgo crítico',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)'   },
                    };
                    const lm  = nLevel   ? LEVEL_META[nLevel]     : null;
                    const sm  = nSubtype ? SUBTYPE_META[nSubtype]  : null;
                    const dotColor = isNota
                      ? (nSubtype === 'riesgo_critico' ? '#ef4444' : nType === 'interna' ? '#a78bfa' : '#34d399')
                      : ss2!.color;

                    return (
                      <motion.div key={h.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }} className="flex gap-4 relative group">
                        <div className="w-3.5 h-3.5 rounded-full shrink-0 mt-1 z-10"
                          style={{ background: dotColor, boxShadow: `0 0 0 3px ${dotColor}25` }} />
                        <div className="flex-1 rounded-xl p-3"
                          style={{ background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.04)', border: rowBorder }}>

                          {/* Header: badges + fecha + eliminar */}
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isNota ? (
                                <>
                                  {/* Tipo */}
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                    style={nType === 'interna'
                                      ? { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.30)' }
                                      : { background: 'rgba(52,211,153,0.12)',  color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                                    {nType === 'interna'
                                      ? <><Lock className="w-2.5 h-2.5" /> Interna</>
                                      : <><Globe className="w-2.5 h-2.5" /> General</>}
                                  </span>
                                  {/* Nivel */}
                                  {lm && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                      style={{ background: lm.bg, color: lm.color }}>
                                      {lm.label}
                                    </span>
                                  )}
                                  {/* Subtipo */}
                                  {sm && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                      style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
                                      {nSubtype === 'riesgo_critico'
                                        ? <><ShieldAlert className="w-2.5 h-2.5" /> {sm.label}</>
                                        : <><Target className="w-2.5 h-2.5" /> {sm.label}</>}
                                    </span>
                                  )}
                                  {/* Etiqueta Nota */}
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                    style={{ background: 'rgba(255,255,255,0.06)', color: tc.m }}>
                                    <MessageSquare className="w-2.5 h-2.5" /> Nota
                                  </span>
                                </>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                                  style={{ background: ss2!.bg, color: ss2!.color }}>
                                  {h.newValue}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs" style={{ color: tc.m }}>
                                {new Date(h.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              {can('orders.editar') && (
                                <button
                                  onClick={() => handleDeleteHistory((h as any).id)}
                                  className="p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                                  title="Eliminar entrada"
                                >
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Comentario */}
                          {h.reason && (
                            <p className="text-sm leading-relaxed" style={{ color: tc.s }}>{h.reason}</p>
                          )}

                          {/* Mitigación del riesgo */}
                          {nMitigation && (
                            <div className="mt-2 rounded-lg px-3 py-2"
                              style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.20)' }}>
                              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide mb-1"
                                style={{ color: '#ef4444' }}>
                                <ShieldAlert className="w-3 h-3" /> Mitigación del riesgo
                              </p>
                              <p className="text-xs leading-relaxed" style={{ color: tc.s }}>{nMitigation}</p>
                            </div>
                          )}
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
                {can('orders.editar') && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={openProjModal}
                    className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white font-semibold mx-auto">
                    <Plus className="w-4 h-4" /> Generar Proyecto
                  </motion.button>
                )}
              </div>
            )}
          </motion.div>
        )}
        {/* Tab: Capacitaciones */}
        {tab === 'capacitaciones' && (
          <motion.div key="cap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-4">

            {capLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
              </div>
            ) : !os.project?.id ? (
              <div className="rounded-2xl p-8 text-center" style={glass()}>
                <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
                <p className="font-semibold" style={{ color: tc.p }}>Sin proyecto generado</p>
                <p className="text-sm mt-1" style={{ color: tc.m }}>Genera un proyecto para esta orden y crea actas de capacitación.</p>
              </div>
            ) : (() => {
              // ── Derivar listas desde actas ──────────────────────────────────
              const docToStaff = new Map<string, ClientStaff>(
                capStaff.map(s => [s.document, s])
              );

              // documentos que participaron en AL MENOS una acta capacitación
              const allParticipantDocs = new Set<string>(
                capActas.flatMap(a =>
                  (a.participantes ?? []).map((p: any) => p.documento).filter(Boolean)
                )
              );

              // documentos que YA firmaron alguna acta capacitación
              const signedDocs = new Set<string>(
                capActas.flatMap(a =>
                  (a.firmantes ?? [])
                    .filter((f: any) => f.signerType === 'participante' && f.signedAt)
                    .map((f: any) => f.documento)
                    .filter(Boolean)
                )
              );

              // Mapa doc → actas donde participó
              const docToActas = new Map<string, { numero: string; type: string; signedAt?: string; moduloName?: string }[]>();
              capActas.forEach(a => {
                (a.participantes ?? []).forEach((p: any) => {
                  if (!p.documento) return;
                  const existing = docToActas.get(p.documento) ?? [];
                  const firmante = (a.firmantes ?? []).find(
                    (f: any) => f.documento === p.documento && f.signerType === 'participante'
                  );
                  existing.push({
                    numero: a.numero ?? '—',
                    type: a.type,
                    signedAt: firmante?.signedAt,
                    moduloName: a.modulo?.name,
                  });
                  docToActas.set(p.documento, existing);
                });
              });

              const capacitados = Array.from(signedDocs)
                .map(doc => docToStaff.get(doc))
                .filter(Boolean) as ClientStaff[];

              // En proceso: asignados a un acta pero sin firmar
              const enProceso = Array.from(allParticipantDocs)
                .filter(doc => !signedDocs.has(doc))
                .map(doc => docToStaff.get(doc))
                .filter(Boolean) as ClientStaff[];

              // Pendiente: personal del cliente que NO aparece en ninguna acta
              const pendientes = capStaff.filter(
                s => !allParticipantDocs.has(s.document) && !signedDocs.has(s.document)
              );

              const displayList =
                capSubTab === 'capacitados' ? capacitados :
                capSubTab === 'en_proceso'  ? enProceso   :
                pendientes;

              const StaffRow = ({ s }: { s: ClientStaff }) => {
                const actasList = docToActas.get(s.document) ?? [];
                const modulosCapacitados = Array.from(
                  new Set(actasList.filter(a => a.signedAt && a.moduloName).map(a => a.moduloName!))
                );
                const avatarBg =
                  capSubTab === 'capacitados' ? 'rgba(52,211,153,0.15)' :
                  capSubTab === 'en_proceso'  ? 'rgba(96,165,250,0.15)' : 'rgba(251,191,36,0.15)';
                const avatarColor =
                  capSubTab === 'capacitados' ? '#34d399' :
                  capSubTab === 'en_proceso'  ? '#60a5fa' : '#fbbf24';
                return (
                  <div className="p-4 rounded-xl" style={glass(0.6)}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                          style={{ background: avatarBg, color: avatarColor }}>
                          {s.firstName[0]}{s.lastName[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: tc.p }}>
                            {s.firstName} {s.lastName}
                          </p>
                          <p className="text-xs" style={{ color: tc.m }}>{s.jobTitle || '—'}</p>
                        </div>
                      </div>
                      {capSubTab === 'capacitados' ? (
                        <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                          <CheckCircle2 className="w-3 h-3" /> Capacitado
                        </span>
                      ) : capSubTab === 'en_proceso' ? (
                        <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                          <GraduationCap className="w-3 h-3" /> En proceso
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(251,191,36,0.10)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                          <AlertCircle className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {[
                        { label: 'Correo',    value: s.email   || '—' },
                        { label: 'Teléfono',  value: s.phone   || '—' },
                        { label: 'Área / Rol',value: s.area    || '—' },
                        { label: 'Documento', value: s.document || '—' },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="font-semibold uppercase tracking-wide text-[10px] mb-0.5" style={{ color: tc.m }}>{label}</p>
                          <p style={{ color: tc.s }}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Módulos capacitados */}
                    {modulosCapacitados.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: tc.m }}>Módulos capacitados</p>
                        <div className="flex flex-wrap gap-1.5">
                          {modulosCapacitados.map((mod, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                              ✓ {mod}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actas asignadas */}
                    {actasList.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {actasList.map((a, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: a.signedAt ? 'rgba(52,211,153,0.08)' : 'rgba(148,163,184,0.10)',
                              color: a.signedAt ? '#34d399' : '#94a3b8',
                              border: `1px solid ${a.signedAt ? 'rgba(52,211,153,0.20)' : 'rgba(255,255,255,0.08)'}` }}>
                            {a.signedAt ? '✓' : '○'} Acta No. {a.numero}
                            {a.moduloName && ` · ${a.moduloName}`}
                            {a.signedAt && ` · ${new Date(a.signedAt).toLocaleDateString('es-CO')}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <>
                  {/* Resumen */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Actas de capacitación', value: capActas.length,    color: '#60a5fa', bg: 'rgba(96,165,250,0.10)'  },
                      { label: 'Personal del cliente',  value: capStaff.length,    color: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
                      { label: 'Capacitados',           value: capacitados.length, color: '#34d399', bg: 'rgba(52,211,153,0.10)'  },
                      { label: 'En proceso',            value: enProceso.length,   color: '#60a5fa', bg: 'rgba(96,165,250,0.10)'  },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${color}30` }}>
                        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                        <p className="text-xs mt-0.5" style={{ color: tc.m }}>{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Sub-tabs */}
                  <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
                    {([
                      { key: 'pendiente',   label: `Pendiente (${pendientes.length})`,    icon: AlertCircle  },
                      { key: 'en_proceso',  label: `En proceso (${enProceso.length})`,    icon: GraduationCap },
                      { key: 'capacitados', label: `Capacitados (${capacitados.length})`, icon: CheckCircle2 },
                    ] as const).map(({ key, label, icon: Icon }) => (
                      <button key={key} onClick={() => setCapSubTab(key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${capSubTab === key ? 'btn-primary text-white' : ''}`}
                        style={capSubTab !== key ? { color: 'var(--text-secondary)' } : {}}>
                        <Icon className="w-4 h-4" /> {label}
                      </button>
                    ))}
                  </div>

                  {/* Lista */}
                  {displayList.length === 0 ? (
                    <div className="rounded-2xl p-8 text-center" style={glass()}>
                      <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-sm" style={{ color: tc.m }}>
                        {capSubTab === 'capacitados'
                          ? 'Ningún participante ha completado la firma aún.'
                          : capSubTab === 'en_proceso'
                          ? 'No hay participantes con acta asignada pendientes de firma.'
                          : capStaff.length === 0
                          ? 'No se encontró personal registrado para este cliente.'
                          : 'Todo el personal tiene acta de capacitación asignada.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayList.map(s => <StaffRow key={s.id} s={s} />)}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button onClick={loadCapacitaciones}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                      <Loader2 className="w-3.5 h-3.5" /> Actualizar
                    </button>
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}

        {/* Tab: Documentos */}
        {tab === 'documentos' && (
          <motion.div key="documentos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <DocumentosSection serviceOrderId={os.id} label="Documentos adjuntos a esta orden de servicio" />
          </motion.div>
        )}

        {/* Tab: Correos */}
        {tab === 'correos' && (
          <motion.div key="correos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-5 space-y-5" style={glass()}>

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: tc.m }}>
                  Destinatarios de informes automáticos
                </p>
                <p className="text-xs" style={{ color: tc.m }}>
                  Selecciona del listado o agrega un correo manual. Se aplicará a todos los envíos automáticos.
                </p>
              </div>
              {correosList.length > 0 && (
                <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                  {correosList.length} seleccionado{correosList.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* ── Layout de dos columnas ── */}
            <div className="grid grid-cols-[1fr_300px] gap-4">

              {/* Columna izquierda: lista de contactos ── */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                {/* Buscador */}
                <div className="px-3 py-2.5" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <input
                    type="text"
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: 'var(--text-primary)' }}
                    placeholder="Buscar por nombre, correo o cargo…"
                    value={correosSearch}
                    onChange={e => setCorreosSearch(e.target.value)}
                  />
                </div>

                {!correosLoaded ? (
                  <div className="flex items-center justify-center gap-2 py-10" style={{ color: tc.m }}>
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando contactos…
                  </div>
                ) : (() => {
                  const q = correosSearch.toLowerCase();
                  const filtered = contactOptions.filter(o =>
                    !q || o.name.toLowerCase().includes(q) || o.email.includes(q) || o.role.toLowerCase().includes(q),
                  );
                  const clienteGroup = filtered.filter(o => o.group === 'cliente');
                  const auraGroup    = filtered.filter(o => o.group === 'aura');

                  if (filtered.length === 0) return (
                    <div className="flex flex-col items-center gap-1.5 py-10" style={{ color: tc.m }}>
                      <Users className="w-7 h-7" style={{ opacity: 0.3 }} />
                      <p className="text-sm">Sin resultados</p>
                    </div>
                  );

                  const renderGroup = (items: typeof filtered, label: string, color: string) => items.length === 0 ? null : (
                    <div key={label}>
                      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
                        style={{ background: 'var(--surface-2)', color: tc.m, borderBottom: '1px solid var(--border-subtle)' }}>
                        {label} ({items.length})
                      </div>
                      {items.map(opt => {
                        const checked = correosList.includes(opt.email);
                        const ini = ((opt.name.split(' ')[0]?.[0] ?? '') + (opt.name.split(' ')[2]?.[0] ?? opt.name.split(' ')[1]?.[0] ?? '')).toUpperCase();
                        return (
                          <button key={opt.id} onClick={() => toggleCorreo(opt.email)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                            style={{
                              background: checked ? `${color}0d` : 'transparent',
                              borderBottom: '1px solid var(--border-subtle)',
                            }}>
                            {/* Avatar */}
                            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ background: checked ? color : 'var(--text-muted)', opacity: checked ? 1 : 0.5 }}>
                              {ini}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: checked ? 'var(--text-primary)' : tc.m }}>{opt.name}</p>
                              <p className="text-xs truncate" style={{ color: tc.m }}>{opt.role} · {opt.email}</p>
                            </div>
                            {/* Checkbox */}
                            <div className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all"
                              style={{
                                background: checked ? color : 'transparent',
                                border: `2px solid ${checked ? color : 'var(--border-subtle)'}`,
                              }}>
                              {checked && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );

                  return (
                    <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
                      {renderGroup(clienteGroup, 'Personal del Cliente', '#34d399')}
                      {renderGroup(auraGroup,    'Agentes AURA',         '#a78bfa')}
                    </div>
                  );
                })()}
              </div>

              {/* Columna derecha: seleccionados + manual ── */}
              <div className="flex flex-col gap-3">

                {/* Seleccionados */}
                <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                    style={{ background: 'var(--surface-2)', color: tc.m, borderBottom: '1px solid var(--border-subtle)' }}>
                    Destinatarios seleccionados
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
                    {correosList.length === 0 ? (
                      <div className="flex flex-col items-center gap-1.5 py-8" style={{ color: tc.m }}>
                        <Mail className="w-6 h-6" style={{ opacity: 0.3 }} />
                        <p className="text-xs text-center px-3">Selecciona contactos del listado</p>
                      </div>
                    ) : (
                      correosList.map(email => {
                        const contact = contactOptions.find(o => o.email === email);
                        return (
                          <div key={email} className="flex items-center gap-2 px-3 py-2"
                            style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <div className="flex-1 min-w-0">
                              {contact && <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{contact.name}</p>}
                              <p className="text-xs truncate font-mono" style={{ color: tc.m }}>{email}</p>
                            </div>
                            <button onClick={() => removeCorreo(email)}
                              className="flex-shrink-0 p-1 rounded-md transition-colors hover:bg-red-500/10" title="Quitar">
                              <X className="w-3 h-3" style={{ color: '#f87171' }} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Input manual */}
                <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: tc.m }}>
                    Otro correo
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-xs"
                      style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      placeholder="correo@empresa.com"
                      value={correoInput}
                      onChange={e => setCorreoInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualCorreo(); } }}
                    />
                    <button onClick={addManualCorreo}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium"
                      style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.30)', color: '#a78bfa' }}>
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Guardar */}
                <button onClick={saveCorreos} disabled={savingCorreos || correosList.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(167,139,250,0.18)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.35)' }}>
                  {savingCorreos ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {savingCorreos ? 'Guardando…' : 'Guardar destinatarios'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Informe ejecutivo */}
      {showInforme && (
        <InformeEjecutivo
          osId={os.id}
          onClose={() => { setShowInforme(false); setEjecutivoAutoEmail(null); }}
          autoEmail={ejecutivoAutoEmail ?? undefined}
        />
      )}

      {/* Informe ejecutivo con actas */}
      {showInformeActas && (
        <InformeConActas
          osId={os.id}
          onClose={() => { setShowInformeActas(false); setConActasAutoEmail(null); }}
          autoEmail={conActasAutoEmail ?? undefined}
        />
      )}

      {/* Modal: Enviar informe por correo */}
      <Modal open={emailModal} onClose={() => setEmailModal(false)} title="Enviar informe por correo" width="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Tipo de informe
            </label>
            <div className="flex gap-2">
              {([
                { value: 'ejecutivo', label: 'Informe Ejecutivo',    desc: 'Resumen de avance, equipo y actas' },
                { value: 'completo',  label: 'Informe con Actas',    desc: 'Incluye todas las actas diligenciadas' },
              ] as const).map(opt => (
                <button key={opt.value} onClick={() => setEmailReportType(opt.value)}
                  className="flex-1 p-3 rounded-xl text-left transition-all"
                  style={{
                    background: emailReportType === opt.value ? 'rgba(167,139,250,0.12)' : 'var(--surface-2)',
                    border: `1px solid ${emailReportType === opt.value ? 'rgba(167,139,250,0.5)' : 'var(--border-subtle)'}`,
                  }}>
                  <p className="text-xs font-semibold" style={{ color: emailReportType === opt.value ? '#a78bfa' : 'var(--text-primary)' }}>{opt.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Destinatarios
            </label>
            <textarea
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', minHeight: 80 }}
              placeholder="correo@ejemplo.com&#10;otro@ejemplo.com"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Un correo por línea o separados por coma/punto y coma.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Asunto (opcional)
            </label>
            <input
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              placeholder={emailReportType === 'completo' ? 'Informe con Actas – OS #...' : 'Informe Ejecutivo – OS #...'}
              value={emailSubject}
              onChange={e => setEmailSubject(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEmailModal(false)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              Cancelar
            </button>
            <button
              onClick={sendManualEmail}
              disabled={sendingEmail}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(167,139,250,0.18)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.35)' }}>
              {sendingEmail ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {sendingEmail ? 'Generando y enviando…' : 'Enviar PDF'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Automatización de correos del informe */}
      <Modal open={autoModal} onClose={() => setAutoModal(false)} title="Automatización de correos" width="max-w-2xl">
        {loadingAuto ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#a78bfa' }} /></div>
        ) : (
          <div className="space-y-5">
            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              {([
                { key: 'weekly',    label: 'Semanal',   desc: 'PDF ejecutivo o con actas' },
                { key: 'bimensual', label: 'Bimensual', desc: 'Día 15 quincenal · Fin mes con actas' },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setAutoTab(tab.key)}
                  className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: autoTab === tab.key ? 'rgba(167,139,250,0.18)' : 'transparent',
                    color: autoTab === tab.key ? '#a78bfa' : 'var(--text-muted)',
                    border: autoTab === tab.key ? '1px solid rgba(167,139,250,0.35)' : '1px solid transparent',
                  }}>
                  {tab.label}
                  <span className="block text-xs font-normal opacity-70">{tab.desc}</span>
                </button>
              ))}
            </div>

            {/* Tab: Semanal */}
            {autoTab === 'weekly' && (
              <div className="space-y-4">
                {/* Activar */}
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Envío automático semanal</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>PDF adjunto con el informe de la semana</p>
                  </div>
                  <button onClick={() => setWEnabled(v => !v)}>
                    {wEnabled ? <ToggleRight className="w-8 h-8" style={{ color: '#a78bfa' }} /> : <ToggleLeft className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Día</label>
                    <select value={wDia} onChange={e => setWDia(+e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                      {['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((d,i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Hora</label>
                    <input type="number" min={0} max={23} value={wHora} onChange={e => setWHora(+e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Minuto</label>
                    <input type="number" min={0} max={59} value={wMinuto} onChange={e => setWMinuto(+e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Tipo de PDF</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'ejecutivo', label: 'Informe Ejecutivo', desc: 'Resumen de avance y actas' },
                      { value: 'completo',  label: 'Informe con Actas', desc: 'Incluye actas completas como anexo' },
                    ] as const).map(opt => (
                      <button key={opt.value} onClick={() => setWReportType(opt.value)}
                        className="flex-1 p-3 rounded-xl text-left transition-all"
                        style={{
                          background: wReportType === opt.value ? 'rgba(167,139,250,0.12)' : 'var(--surface-2)',
                          border: `1px solid ${wReportType === opt.value ? 'rgba(167,139,250,0.5)' : 'var(--border-subtle)'}`,
                        }}>
                        <p className="text-xs font-semibold" style={{ color: wReportType === opt.value ? '#a78bfa' : 'var(--text-primary)' }}>{opt.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Destinatarios {correosList.length > 0 && `(${correosList.length})`}
                    </label>
                    <button onClick={() => { setAutoModal(false); setTab('correos'); if (!correosLoaded) loadCorreos(); }}
                      className="text-xs font-medium underline underline-offset-2" style={{ color: '#a78bfa' }}>
                      Gestionar en pestaña Correos →
                    </button>
                  </div>
                  {correosList.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      Sin destinatarios — ve a la pestaña Correos para agregarlos.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                      {correosList.map(e => (
                        <span key={e} className="px-2 py-0.5 rounded-full text-xs font-mono"
                          style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.20)' }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Asunto (opcional)</label>
                  <input className="w-full rounded-xl px-3 py-2.5 text-sm"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                    placeholder="Avance semanal – OS #..." value={wAsunto} onChange={e => setWAsunto(e.target.value)} />
                </div>
                {wLast && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Último envío: {new Date(wLast).toLocaleString('es-CO')}</p>}
                <div className="flex justify-between items-center pt-1">
                  <button onClick={async () => {
                    setRunningW(true);
                    try { await serviceOrdersApi.runWeeklyNow(os!.id); toast.success('Correo semanal enviado'); }
                    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Error'); }
                    finally { setRunningW(false); }
                  }} disabled={runningW} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                    {runningW ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Probar ahora
                  </button>
                  <button onClick={saveWeekly} disabled={savingAuto} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(167,139,250,0.18)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.35)' }}>
                    {savingAuto ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Guardar
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Bimensual */}
            {autoTab === 'bimensual' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Envío automático bimensual</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Día 15: avance quincenal de actividades · Fin de mes: Informe con Actas completo</p>
                  </div>
                  <button onClick={() => setBEnabled(v => !v)}>
                    {bEnabled ? <ToggleRight className="w-8 h-8" style={{ color: '#a78bfa' }} /> : <ToggleLeft className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Hora</label>
                    <input type="number" min={0} max={23} value={bHora} onChange={e => setBHora(+e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Minuto</label>
                    <input type="number" min={0} max={59} value={bMinuto} onChange={e => setBMinuto(+e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Destinatarios {correosList.length > 0 && `(${correosList.length})`}
                    </label>
                    <button onClick={() => { setAutoModal(false); setTab('correos'); if (!correosLoaded) loadCorreos(); }}
                      className="text-xs font-medium underline underline-offset-2" style={{ color: '#a78bfa' }}>
                      Gestionar en pestaña Correos →
                    </button>
                  </div>
                  {correosList.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      Sin destinatarios — ve a la pestaña Correos para agregarlos.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                      {correosList.map(e => (
                        <span key={e} className="px-2 py-0.5 rounded-full text-xs font-mono"
                          style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.20)' }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Asunto (opcional)</label>
                  <input className="w-full rounded-xl px-3 py-2.5 text-sm"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                    placeholder="Informe bimensual – OS #..." value={bAsunto} onChange={e => setBAsunto(e.target.value)} />
                </div>
                {bLast && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Último envío: {new Date(bLast).toLocaleString('es-CO')}</p>}
                <div className="flex justify-between items-center pt-1">
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      setRunningB('quincenal');
                      try { await serviceOrdersApi.runBimensualNow(os!.id, 'quincenal'); toast.success('PDF quincenal enviado'); }
                      catch (e: any) { toast.error(e?.response?.data?.message ?? 'Error'); }
                      finally { setRunningB(null); }
                    }} disabled={!!runningB} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                      {runningB === 'quincenal' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      Quincenal ahora
                    </button>
                    <button onClick={async () => {
                      setRunningB('mensual');
                      try { await serviceOrdersApi.runBimensualNow(os!.id, 'mensual'); toast.success('PDF mensual enviado'); }
                      catch (e: any) { toast.error(e?.response?.data?.message ?? 'Error'); }
                      finally { setRunningB(null); }
                    }} disabled={!!runningB} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                      {runningB === 'mensual' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      Mensual ahora
                    </button>
                  </div>
                  <button onClick={saveBimensual} disabled={savingAuto} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(167,139,250,0.18)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.35)' }}>
                    {savingAuto ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: Agregar nota al historial */}
      <Modal open={noteModal} onClose={() => setNoteModal(false)} title="Agregar nota al historial" width="max-w-lg">
        <div className="space-y-4">

          {/* Tipo + Nivel */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Tipo de nota
              </label>
              <div className="flex gap-2">
                {([
                  { val: 'general', Icon: Globe, label: 'General',  desc: 'Visible para todos',    c: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.35)'  },
                  { val: 'interna', Icon: Lock,  label: 'Interna',  desc: 'Solo agentes internos', c: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
                ] as const).map(({ val, Icon, label, desc, c, bg, border }) => (
                  <button key={val} onClick={() => setNoteType(val)}
                    className="flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: noteType === val ? bg : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${noteType === val ? border : 'var(--border-subtle)'}`,
                      color: noteType === val ? c : 'var(--text-secondary)',
                    }}>
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                    <span className="text-[9px] font-normal opacity-70">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Nivel / Prioridad
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { val: 'baja',    label: 'Baja',    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.35)'  },
                  { val: 'media',   label: 'Media',   color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.35)'   },
                  { val: 'alta',    label: 'Alta',    color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)'  },
                  { val: 'critica', label: 'Crítica', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)'   },
                ] as const).map(({ val, label, color, bg, border }) => (
                  <button key={val} onClick={() => setNoteLevel(val)}
                    className="py-2 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: noteLevel === val ? bg : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${noteLevel === val ? border : 'var(--border-subtle)'}`,
                      color: noteLevel === val ? color : 'var(--text-secondary)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subtipo */}
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Subtipo <span className="normal-case font-normal opacity-60">(opcional)</span>
            </label>
            <div className="flex gap-2">
              {([
                { val: '',               Icon: MessageSquare, label: 'Sin subtipo',     desc: 'Nota general',           c: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.04)', border: 'var(--border-subtle)'          },
                { val: 'proximos_logros',Icon: Target,        label: 'Próximos logros', desc: 'Hitos y avances futuros', c: '#34d399',               bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.35)'         },
                { val: 'riesgo_critico', Icon: ShieldAlert,   label: 'Riesgo crítico',  desc: 'Requiere mitigación',    c: '#ef4444',               bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)'          },
              ] as const).map(({ val, Icon, label, desc, c, bg, border }) => (
                <button key={val} onClick={() => { setNoteSubtype(val); if (val !== 'riesgo_critico') setNoteMitigation(''); }}
                  className="flex-1 flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: noteSubtype === val ? bg : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${noteSubtype === val ? border : 'var(--border-subtle)'}`,
                    color: noteSubtype === val ? c : 'var(--text-secondary)',
                  }}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-center leading-tight">{label}</span>
                  <span className="text-[9px] font-normal opacity-70 text-center leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Texto del comentario */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Comentario
            </label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
              placeholder="Describe el avance, novedad o comentario que deseas registrar…"
              value={noteText} onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote(); }} />
          </div>

          {/* Mitigación del riesgo — solo para riesgo_critico */}
          {noteSubtype === 'riesgo_critico' && (
            <div className="rounded-xl p-3 space-y-2"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#ef4444' }}>
                <ShieldAlert className="w-3.5 h-3.5" /> Mitigación del riesgo <span className="text-red-400">*</span>
              </label>
              <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
                placeholder="Describe las acciones que se tomarán para mitigar este riesgo…"
                value={noteMitigation} onChange={e => setNoteMitigation(e.target.value)} />
            </div>
          )}

          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Ctrl+Enter para guardar rápido
          </p>

          {/* Notificación por correo */}
          <div className="space-y-2">
            {/* Fila siempre visible: agentes siempre reciben */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.20)' }}>
              <div className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center"
                style={{ background: '#60a5fa', border: '2px solid #60a5fa' }}>
                <Check className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium" style={{ color: '#60a5fa' }}>Notificar a agentes</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Los agentes AURA configurados en la pestaña Correos siempre recibirán esta nota.
                </p>
              </div>
              <Mail className="w-4 h-4 flex-shrink-0" style={{ color: '#60a5fa' }} />
            </div>

            {/* Toggle: incluir también al cliente (solo para notas generales) */}
            {noteType === 'general' && (
              <button onClick={() => setNoteNotifyClient(v => !v)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                style={{
                  background: noteNotifyClient ? 'rgba(52,211,153,0.06)' : 'var(--surface-2)',
                  border: `1px solid ${noteNotifyClient ? 'rgba(52,211,153,0.25)' : 'var(--border-subtle)'}`,
                }}>
                <div className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all"
                  style={{
                    background: noteNotifyClient ? '#34d399' : 'transparent',
                    border: `2px solid ${noteNotifyClient ? '#34d399' : 'var(--border-subtle)'}`,
                  }}>
                  {noteNotifyClient && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium" style={{ color: noteNotifyClient ? '#34d399' : 'var(--text-secondary)' }}>
                    Notificar también al cliente
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Los contactos del cliente configurados en la pestaña Correos también recibirán esta nota.
                  </p>
                </div>
                <Mail className="w-4 h-4 flex-shrink-0" style={{ color: noteNotifyClient ? '#34d399' : 'var(--text-muted)' }} />
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setNoteModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleAddNote} disabled={savingNote || !noteText.trim()}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {savingNote ? 'Guardando y notificando…' : 'Guardar y notificar'}
            </button>
          </div>
        </div>
      </Modal>

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
                                    <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
                                      value={phaseDates[ph.id]?.startDate ?? ''}
                                      onChange={e => setPhaseDates(prev => ({ ...prev, [ph.id]: { ...prev[ph.id], startDate: e.target.value } }))} />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fin</label>
                                    <input type="date" max="2099-12-31" min="2000-01-01" className="input-glass w-full rounded-lg px-2 py-1.5 text-xs"
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
