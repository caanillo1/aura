'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  ListOrdered, Plus, Pencil,
  ChevronDown, Clock, Send, X, RefreshCw, AlertCircle,
  FileSpreadsheet, Mail, Download, Filter, Calendar,
  Trash2, CheckSquare, Square, UploadCloud, Eye, Save,
  Settings, Play, ToggleLeft, ToggleRight, UserPlus,
} from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import { requerimientosApi, clientsApi, usersApi, serviceOrdersApi, templatesApi, projectsApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type Prioridad = 'Crítico' | 'Alta' | 'Media' | 'Baja';
type Estado    = 'Elaborado' | 'Priorizado' | 'Devuelto' | 'Negado' | 'Repriorizado' | 'Entregado';

interface Gestion {
  id: string;
  fecha: string;
  estado: Estado;
  observacion: string;
  createdAt?: string;
  changedBy: { firstName: string; lastName: string } | null;
}

interface Req {
  id: string;
  numero: string;
  titulo: string;
  tipo: string;
  prioridad: Prioridad;
  area: string;
  estadoActual: Estado;
  ticketRubi: string | null;
  descripcion: string;
  criteriosAceptacion: string | null;
  client:       { id: string; businessName: string } | null;
  serviceOrder: { osNumber: string; product: string } | null;
  agente:       { id: string; firstName: string; lastName: string } | null;
  templateModule: { id: string; code: string; name: string } | null;
  templatePhase:  { id: string; name: string; color: string } | null;
  gestiones: Gestion[];
  createdAt: string;
}

// ── Paletas ───────────────────────────────────────────────────────────────────
// Computed inside the component using isLight — see getPrioStyle / getEstStyle below.
function getPrioStyle(light: boolean): Record<Prioridad, { color: string; bg: string; icon: string }> {
  return light ? {
    Crítico: { color: '#991B1B', bg: 'rgba(153,27,27,0.09)',   icon: '🔴' },
    Alta:    { color: '#C2410C', bg: 'rgba(194,65,12,0.09)',   icon: '🟠' },
    Media:   { color: '#B45309', bg: 'rgba(180,83,9,0.09)',    icon: '🟡' },
    Baja:    { color: '#047857', bg: 'rgba(4,120,87,0.09)',    icon: '🟢' },
  } : {
    Crítico: { color: '#f87171', bg: 'rgba(248,113,113,0.13)', icon: '🔴' },
    Alta:    { color: '#fb923c', bg: 'rgba(249,115,22,0.13)',  icon: '🟠' },
    Media:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  icon: '🟡' },
    Baja:    { color: '#34d399', bg: 'rgba(34,197,94,0.11)',   icon: '🟢' },
  };
}

function getEstStyle(light: boolean): Record<Estado, { color: string; bg: string; dot: string }> {
  return light ? {
    Elaborado:    { color: '#1D4ED8', bg: 'rgba(29,78,216,0.08)',   dot: '#1D4ED8' },
    Priorizado:   { color: '#6D28D9', bg: 'rgba(109,40,217,0.08)', dot: '#6D28D9' },
    Devuelto:     { color: '#C2410C', bg: 'rgba(194,65,12,0.08)',   dot: '#C2410C' },
    Negado:       { color: '#B91C1C', bg: 'rgba(185,28,28,0.08)',   dot: '#B91C1C' },
    Repriorizado: { color: '#B45309', bg: 'rgba(180,83,9,0.08)',    dot: '#B45309' },
    Entregado:    { color: '#047857', bg: 'rgba(4,120,87,0.08)',    dot: '#047857' },
  } : {
    Elaborado:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   dot: '#60a5fa' },
    Priorizado:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', dot: '#a78bfa' },
    Devuelto:     { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',   dot: '#fb923c' },
    Negado:       { color: '#f87171', bg: 'rgba(248,113,113,0.12)',  dot: '#f87171' },
    Repriorizado: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   dot: '#fbbf24' },
    Entregado:    { color: '#34d399', bg: 'rgba(52,211,153,0.11)',   dot: '#34d399' },
  };
}

const ESTADOS: Estado[] = ['Elaborado','Priorizado','Devuelto','Negado','Repriorizado','Entregado'];
const PRIORIDADES: Prioridad[] = ['Crítico','Alta','Media','Baja'];
const DIAS_SEMANA = [
  { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

// ── Tooltips Recharts ─────────────────────────────────────────────────────────
const BarTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(10,20,40,0.97)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:10, padding:'8px 14px' }}>
      <p style={{ color:'#e2e8f0', fontSize:12, fontWeight:600 }}>{label}</p>
      <p style={{ color:'#60a5fa', fontSize:13, fontWeight:700 }}>{payload[0].value} tickets</p>
    </div>
  );
};

const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.06) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  return (
    <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
      textAnchor="middle" dominantBaseline="central"
      style={{ fontSize:11, fontWeight:700, fill:'#fff', pointerEvents:'none' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function PriorizarPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can } = usePermission();

  // Datos
  const [items,    setItems]    = useState<Req[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [clients,  setClients]  = useState<{ id: string; businessName: string }[]>([]);
  const [agents,   setAgents]   = useState<{ id: string; firstName: string; lastName: string }[]>([]);

  // ── Helpers de fecha ─────────────────────────────────────────────────────
  const isoDate = (d: Date) => d.toISOString().split('T')[0];

  const weekRange = (offset = 0) => {
    const now = new Date();
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // lun=0
    const mon = new Date(now); mon.setDate(now.getDate() - day - offset * 7);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: isoDate(mon), to: isoDate(sun) };
  };

  const monthRange = () => {
    const now = new Date();
    const from = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const to   = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return { from, to };
  };

  const inRange = (dateStr: string, from: string, to: string) => {
    if (!from && !to) return true;
    const d = dateStr.split('T')[0];
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  };

  // Filtros
  const [fCliente,  setFCliente]  = useState('');
  const [fAgente,   setFAgente]   = useState('');
  const [fModulo,   setFModulo]   = useState('');
  const [fArea,     setFArea]     = useState('');
  const [fPrioChip, setFPrioChip] = useState<Prioridad | 'Todos'>('Todos');
  const [fEstado,   setFEstado]   = useState('');
  const [fDesde,    setFDesde]    = useState('');
  const [fHasta,    setFHasta]    = useState('');
  const [fSemana,   setFSemana]   = useState<'esta' | 'anterior' | 'mes' | ''>('');

  // Expand
  const [expanded, setExpanded] = useState<string[]>([]);

  // Modal gestión
  const [modalReq,      setModalReq]      = useState<Req | null>(null);
  const [gestion,       setGestion]       = useState({ estado: 'Priorizado' as Estado, observacion: '', fecha: new Date().toISOString().split('T')[0], devueltoPor: '' as '' | 'cliente' | 'desarrollo', devueltoNota: '' });
  const [savingGestion, setSavingGestion] = useState(false);

  // Modal exportar Excel
  const [showExport, setShowExport] = useState(false);
  const [xCliente,   setXCliente]   = useState('');
  const [xAgente,    setXAgente]    = useState('');
  const [xArea,      setXArea]      = useState('');
  const [xPrioridad, setXPrioridad] = useState('');
  const [xEstado,    setXEstado]    = useState('');
  const [xDesde,     setXDesde]     = useState('');
  const [xHasta,     setXHasta]     = useState('');
  const [xSemana,    setXSemana]    = useState<'esta' | 'anterior' | 'mes' | ''>('');

  // Modal correo
  const [showMail,    setShowMail]    = useState(false);
  const [mCliente,    setMCliente]    = useState('');
  const [mAgente,     setMAgente]     = useState('');
  const [mArea,       setMArea]       = useState('');
  const [mPrioridad,  setMPrioridad]  = useState('');
  const [mEstados,    setMEstados]    = useState<string[]>([]);
  const [mDestinatarios, setMDestinatarios] = useState('');
  const [mAsunto,     setMAsunto]     = useState('');
  const [mMensaje,    setMMensaje]    = useState('');
  const [sendingMail, setSendingMail] = useState(false);

  // Modal automatización
  const [showAuto,     setShowAuto]     = useState(false);
  const [loadingAuto,  setLoadingAuto]  = useState(false);
  const [savingAuto,   setSavingAuto]   = useState(false);
  const [runningNow,   setRunningNow]   = useState(false);
  const [autoNewEmail, setAutoNewEmail] = useState('');
  const [autoConfig, setAutoConfig] = useState<{
    enabled: boolean;
    diasSemana: number[];
    hora: number;
    minuto: number;
    estados: string[];
    destinatarios: string[];
    asunto: string;
    mensaje: string;
  }>({
    enabled: false, diasSemana: [], hora: 8, minuto: 0,
    estados: [], destinatarios: [], asunto: '', mensaje: '',
  });

  const emailInputRef   = useRef<HTMLInputElement>(null);
  const xlsFileRef      = useRef<HTMLInputElement>(null);

  // Ver / editar detalle
  const [viewTarget,    setViewTarget]    = useState<Req | null>(null);
  const [editMode,      setEditMode]      = useState(false);
  const [editForm,      setEditForm]      = useState({
    serviceOrderId: '' as string | null,
    templateModuleId: '' as string | null,
    templatePhaseId: '' as string | null,
    ticketRubi: '' as string,
  });
  const [editServiceOrders,  setEditServiceOrders]  = useState<{ id: string; osNumber: string; product: string }[]>([]);
  const [editModules,        setEditModules]        = useState<{ id: string; code: string; name: string; phases: { id: string; name: string; color: string }[] }[]>([]);
  const [projectPhaseMap,    setProjectPhaseMap]    = useState<Map<string, { id: string; name: string; color: string }[]>>(new Map());
  const [hasProject,         setHasProject]         = useState(false);
  const [savingEdit,         setSavingEdit]         = useState(false);

  // Eliminar ticket
  const [deleteTarget,  setDeleteTarget]  = useState<Req | null>(null);
  const [deleting,      setDeleting]      = useState(false);

  // Selección múltiple
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());

  // Eliminar múltiples
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [deletingBulk,   setDeletingBulk]   = useState(false);

  // Modal gestión masiva (misma gestión a todos los seleccionados)
  const [showBulkG,     setShowBulkG]     = useState(false);
  const [bulkG,         setBulkG]         = useState({ estado: 'Priorizado' as Estado, observacion: '', fecha: new Date().toISOString().split('T')[0] });
  const [applyingBulk,  setApplyingBulk]  = useState(false);

  // Priorizar por Excel
  const [showXlsDown,   setShowXlsDown]   = useState(false); // modal de descarga (elegir agente)
  const [xlsAgenteId,   setXlsAgenteId]   = useState('');    // agente seleccionado para el archivo
  type XlsRow = { id: string; numero: string; titulo: string; cliente: string; agente: string; estadoActual: Estado; nuevoEstado: string; observacion: string; fecha: string; errors: string[]; valid: boolean };
  const [xlsRows,       setXlsRows]       = useState<XlsRow[]>([]);
  const [showXlsPrev,   setShowXlsPrev]   = useState(false);
  const [applyingXls,   setApplyingXls]   = useState(false);
  const [xlsProgress,   setXlsProgress]   = useState(0);
  const [xlsDone,       setXlsDone]       = useState<{ exitosos: number; fallidos: number } | null>(null);

  // ── Estilos ───────────────────────────────────────────────────────────────
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
  const tc = isLight
    ? { p:'#0a1628', s:'#1a3050', m:'#4a6080' }
    : { p:'#e2e8f0', s:'#94a3b8', m:'#7a94b0' };
  const PRIO_STYLE = getPrioStyle(isLight);
  const EST_STYLE  = getEstStyle(isLight);

  // ── Carga de datos ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, clientRes, userRes] = await Promise.all([
        requerimientosApi.list({ limit: 200 }),
        clientsApi.list({ limit: 500 }),
        usersApi.listAgents({ limit: 200 }),
      ]);
      setItems(reqRes.data ?? []);
      setClients(clientRes.data ?? []);
      setAgents(userRes.data ?? []);
    } catch {
      toast.error('Error al cargar los requerimientos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Módulos únicos derivados de los datos ─────────────────────────────────
  const modulos = Array.from(new Set(
    items.filter(r => r.templateModule).map(r => `${r.templateModule!.code} — ${r.templateModule!.name}`)
  )).sort();

  // ── Filtros ───────────────────────────────────────────────────────────────
  const activeFilters = [fCliente, fAgente, fModulo, fArea, fEstado, fDesde, fHasta].filter(Boolean).length
    + (fPrioChip !== 'Todos' ? 1 : 0);

  const clearFilters = () => {
    setFCliente(''); setFAgente(''); setFModulo('');
    setFArea(''); setFEstado(''); setFPrioChip('Todos');
    setFDesde(''); setFHasta(''); setFSemana('');
  };

  // Rango efectivo del dashboard (puede venir de atajo o de inputs manuales)
  const fFrom = fDesde;
  const fTo   = fHasta;

  const visible = items.filter(r => {
    if (fPrioChip !== 'Todos' && r.prioridad !== fPrioChip)         return false;
    if (fCliente && r.client?.id !== fCliente)                       return false;
    if (fAgente  && r.agente?.id !== fAgente)                        return false;
    if (fModulo  && `${r.templateModule?.code} — ${r.templateModule?.name}` !== fModulo) return false;
    if (fArea    && r.area !== fArea)                                return false;
    if (fEstado  && r.estadoActual !== fEstado)                      return false;
    if (!inRange(r.createdAt, fFrom, fTo))                           return false;
    return true;
  });

  // ── Toggle cronología ─────────────────────────────────────────────────────
  const toggleExpand = (id: string) =>
    setExpanded(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  // ── Gestión ───────────────────────────────────────────────────────────────
  const handleAddGestion = async () => {
    if (!gestion.observacion.trim()) { toast.error('La observación es obligatoria'); return; }
    if (gestion.estado === 'Devuelto' && !gestion.devueltoPor) { toast.error('Selecciona quién devuelve el ticket'); return; }
    if (!modalReq) return;
    setSavingGestion(true);
    try {
      await requerimientosApi.addGestion(modalReq.id, {
        fecha: gestion.fecha,
        estado: gestion.estado,
        observacion: gestion.observacion,
        ...(gestion.estado === 'Devuelto' ? { devueltoPor: gestion.devueltoPor, devueltoNota: gestion.devueltoNota || undefined } : {}),
      });
      const nuevoEstado = gestion.estado as Estado;
      const newEntry: Gestion = {
        id: `tmp-${Date.now()}`, fecha: new Date(gestion.fecha).toISOString(),
        estado: nuevoEstado, observacion: gestion.observacion,
        createdAt: new Date().toISOString(), changedBy: null,
      };
      setItems(prev => prev.map(r => r.id === modalReq.id
        ? { ...r, estadoActual: nuevoEstado, gestiones: [...r.gestiones, newEntry] }
        : r
      ));
      toast.success('Gestión registrada');
      setModalReq(null);
      setGestion({ estado: 'Priorizado', observacion: '', fecha: new Date().toISOString().split('T')[0], devueltoPor: '', devueltoNota: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al registrar gestión');
    } finally {
      setSavingGestion(false);
    }
  };

  // ── Exportar Excel ───────────────────────────────────────────────────────
  const xFrom = xDesde;
  const xTo   = xHasta;

  const exportPreview = items.filter(r => {
    if (xCliente   && r.client?.id !== xCliente)   return false;
    if (xAgente    && r.agente?.id !== xAgente)     return false;
    if (xArea      && r.area !== xArea)             return false;
    if (xPrioridad && r.prioridad !== xPrioridad)   return false;
    if (xEstado    && r.estadoActual !== xEstado)   return false;
    if (!inRange(r.createdAt, xFrom, xTo))          return false;
    return true;
  });

  const handleExport = () => {
    if (exportPreview.length === 0) { toast.error('No hay requerimientos con esos filtros'); return; }
    const header = ['N°', 'Número', 'Fecha Registro', 'Título', 'Tipo', 'Cliente', 'N° OS', 'Nombre OS', 'Módulo', 'Fase', 'Agente', 'Área', 'Prioridad', 'Estado', 'Ticket Rubi', 'Última observación'];
    const rows = exportPreview.map((r, i) => {
      const lastGestion = r.gestiones.length > 0 ? r.gestiones[r.gestiones.length - 1] : null;
      return [
        i + 1,
        r.numero,
        r.createdAt.split('T')[0],
        r.titulo,
        r.tipo,
        r.client?.businessName ?? '',
        r.serviceOrder?.osNumber ?? '',
        r.serviceOrder?.product ?? '',
        r.templateModule ? `${r.templateModule.code} — ${r.templateModule.name}` : '',
        r.templatePhase?.name ?? '',
        r.agente ? `${r.agente.firstName} ${r.agente.lastName}` : '',
        r.area,
        r.prioridad,
        r.estadoActual,
        r.ticketRubi ?? '',
        lastGestion?.observacion ?? '',
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = [4, 14, 13, 40, 14, 26, 12, 30, 30, 16, 22, 12, 10, 14, 14, 55].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Requerimientos');
    XLSX.writeFile(wb, `requerimientos_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`${exportPreview.length} requerimientos exportados`);
    setShowExport(false);
  };

  // ── Enviar correo ────────────────────────────────────────────────────────
  const mailPreviewCount = items.filter(r => {
    if (mCliente   && r.client?.id !== mCliente)   return false;
    if (mAgente    && r.agente?.id !== mAgente)     return false;
    if (mArea      && r.area !== mArea)             return false;
    if (mPrioridad && r.prioridad !== mPrioridad)   return false;
    if (mEstados.length > 0 && !mEstados.includes(r.estadoActual)) return false;
    return true;
  }).length;

  const handleSendMail = async () => {
    const destinatarios = mDestinatarios.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean);
    if (destinatarios.length === 0) { toast.error('Agrega al menos un destinatario'); emailInputRef.current?.focus(); return; }
    setSendingMail(true);
    try {
      const res = await requerimientosApi.enviarCorreo({
        destinatarios,
        asunto: mAsunto || undefined,
        mensaje: mMensaje || undefined,
        clientId:     mCliente   || undefined,
        agenteId:     mAgente    || undefined,
        area:         mArea      || undefined,
        prioridad:     mPrioridad || undefined,
        estadosActual: mEstados.length > 0 ? mEstados : undefined,
      });
      toast.success(`Correo enviado a ${res.destinatarios} destinatario${res.destinatarios !== 1 ? 's' : ''} · ${res.enviados} requerimiento${res.enviados !== 1 ? 's' : ''}`);
      setShowMail(false);
      setMDestinatarios(''); setMAsunto(''); setMMensaje('');
      setMCliente(''); setMAgente(''); setMArea(''); setMPrioridad(''); setMEstados([]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al enviar el correo');
    } finally {
      setSendingMail(false);
    }
  };

  // ── Automatización de correo ─────────────────────────────────────────────
  const openAutoModal = async () => {
    setShowAuto(true);
    setLoadingAuto(true);
    try {
      const cfg = await requerimientosApi.getSchedule();
      if (cfg) setAutoConfig({ enabled: cfg.enabled ?? false, diasSemana: cfg.diasSemana ?? [], hora: cfg.hora ?? 8, minuto: cfg.minuto ?? 0, estados: cfg.estados ?? [], destinatarios: cfg.destinatarios ?? [], asunto: cfg.asunto ?? '', mensaje: cfg.mensaje ?? '' });
    } catch { /* sin config previa */ }
    finally { setLoadingAuto(false); }
  };

  const saveAutoConfig = async () => {
    setSavingAuto(true);
    try {
      await requerimientosApi.saveSchedule(autoConfig);
      toast.success(autoConfig.enabled ? `Automatización guardada · ${DIAS_SEMANA.filter(d => autoConfig.diasSemana.includes(d.value)).map(d => d.label).join(', ')} a las ${String(autoConfig.hora).padStart(2,'0')}:${String(autoConfig.minuto).padStart(2,'0')}` : 'Automatización desactivada');
      setShowAuto(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al guardar automatización');
    } finally { setSavingAuto(false); }
  };

  const runAutoNow = async () => {
    setRunningNow(true);
    try {
      const res = await requerimientosApi.runScheduleNow();
      toast.success(`Prueba enviada · ${res.enviados} requerimientos a ${res.destinatarios} destinatario${res.destinatarios !== 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al enviar prueba');
    } finally { setRunningNow(false); }
  };

  const addAutoEmail = () => {
    const email = autoNewEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error('Email inválido'); return; }
    if (autoConfig.destinatarios.includes(email)) { toast.error('Ya está en la lista'); return; }
    setAutoConfig(p => ({ ...p, destinatarios: [...p.destinatarios, email] }));
    setAutoNewEmail('');
  };

  // ── Editar detalle de requerimiento ──────────────────────────────────────
  const openEditMode = async (req: Req) => {
    const soId = (req as any).serviceOrderId ?? null;
    setEditForm({
      serviceOrderId:   soId,
      templateModuleId: req.templateModule?.id ?? null,
      templatePhaseId:  req.templatePhase?.id ?? null,
      ticketRubi:       req.ticketRubi ?? '',
    });
    setHasProject(false);
    setProjectPhaseMap(new Map());
    setEditMode(true);

    try {
      // Load OS + all modules with phases in parallel — 1-2 requests total
      const parallelCalls: [Promise<any>, Promise<any>, Promise<any>?] = [
        serviceOrdersApi.listByClient(req.client?.id ?? '', 200),
        templatesApi.listModulesWithPhases(),
        soId ? projectsApi.modulesByServiceOrder(soId) : Promise.resolve(null),
      ];
      const [osRes, allMods, projData] = await Promise.all(parallelCalls);

      setEditServiceOrders((osRes.data ?? []).map((o: any) => ({ id: o.id, osNumber: o.osNumber, product: o.product })));

      if (projData?.id && projData.modules.length > 0) {
        setHasProject(true);
        const phaseMap = new Map<string, { id: string; name: string; color: string }[]>();
        const projModNames = projData.modules.map((m: any) => m.name.toLowerCase());
        const filteredMods = (allMods as any[]).filter((m: any) => projModNames.includes(m.name.toLowerCase()));

        for (const tMod of filteredMods) {
          const projMod = projData.modules.find((pm: any) => pm.name.toLowerCase() === tMod.name.toLowerCase());
          if (projMod) {
            phaseMap.set(tMod.id, projMod.phases.map((ph: any) => ({
              id: ph.id, name: ph.name, color: ph.color ?? '#60a5fa',
            })));
          }
        }
        setProjectPhaseMap(phaseMap);
        setEditModules(filteredMods.map((m: any) => ({ id: m.id, code: m.code ?? '', name: m.name, phases: m.phases ?? [] })));
      } else {
        setEditModules((allMods as any[]).map((m: any) => ({ id: m.id, code: m.code ?? '', name: m.name, phases: m.phases ?? [] })));
      }
    } catch {
      toast.error('Error al cargar datos de edición');
    }
  };

  const handleSOChange = async (newSoId: string | null) => {
    setEditForm(p => ({ ...p, serviceOrderId: newSoId, templateModuleId: null, templatePhaseId: null }));
    setHasProject(false);
    setProjectPhaseMap(new Map());
    setEditModules([]);

    try {
      const [allMods, projData] = await Promise.all([
        templatesApi.listModulesWithPhases(),
        newSoId ? projectsApi.modulesByServiceOrder(newSoId) : Promise.resolve(null),
      ]);

      if (newSoId && projData?.id && projData.modules.length > 0) {
          setHasProject(true);
          const phaseMap = new Map<string, { id: string; name: string; color: string }[]>();
          const projModNames = projData.modules.map((m: any) => m.name.toLowerCase());
          const filteredMods = (allMods as any[]).filter((m: any) => projModNames.includes(m.name.toLowerCase()));

          for (const tMod of filteredMods) {
            const projMod = projData.modules.find((pm: any) => pm.name.toLowerCase() === tMod.name.toLowerCase());
            if (projMod) {
              phaseMap.set(tMod.id, projMod.phases.map((ph: any) => ({
                id: ph.id, name: ph.name, color: ph.color ?? '#60a5fa',
              })));
            }
          }
          setProjectPhaseMap(phaseMap);
          setEditModules(filteredMods.map((m: any) => ({ id: m.id, code: m.code ?? '', name: m.name, phases: m.phases ?? [] })));
      } else {
        setEditModules((allMods as any[]).map((m: any) => ({ id: m.id, code: m.code ?? '', name: m.name, phases: m.phases ?? [] })));
      }
    } catch {
      toast.error('Error al cargar módulos');
    }
  };

  const handleSaveEdit = async () => {
    if (!viewTarget) return;
    setSavingEdit(true);
    try {
      await requerimientosApi.update(viewTarget.id, {
        serviceOrderId:   editForm.serviceOrderId   || null,
        templateModuleId: editForm.templateModuleId || null,
        templatePhaseId:  editForm.templatePhaseId  || null,
        ticketRubi:       editForm.ticketRubi       || undefined,
      });
      // Update local state — no need to reload everything
      const newSO  = editServiceOrders.find(o => o.id === editForm.serviceOrderId) ?? null;
      const newMod = editModules.find(m => m.id === editForm.templateModuleId) ?? null;
      const newPh  = newMod?.phases.find((p: any) => p.id === editForm.templatePhaseId) ?? null;
      setItems(prev => prev.map(r => r.id === viewTarget.id ? {
        ...r,
        ticketRubi:     editForm.ticketRubi || null,
        serviceOrder:   newSO  ? { osNumber: newSO.osNumber, product: newSO.product } : null,
        templateModule: newMod ? { id: newMod.id, code: newMod.code, name: newMod.name } : null,
        templatePhase:  newPh  ? { id: newPh.id, name: newPh.name, color: (newPh as any).color ?? '#60a5fa' } : null,
      } : r));
      toast.success('Requerimiento actualizado');
      setEditMode(false);
      setViewTarget(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al guardar');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Eliminar ticket ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await requerimientosApi.delete(deleteTarget.id);
      setItems(prev => prev.filter(r => r.id !== deleteTarget.id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteTarget.id); return n; });
      toast.success(`Requerimiento ${deleteTarget.numero} eliminado`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al eliminar');
    } finally { setDeleting(false); }
  };

  // ── Selección ─────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSelectAll = () => {
    if (selectedIds.size === visible.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map(r => r.id)));
  };

  // ── Eliminación masiva ────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    setDeletingBulk(true);
    const ids = Array.from(selectedIds);
    const deletedIds = new Set<string>();
    let fallidos = 0;
    await Promise.all(ids.map(id =>
      requerimientosApi.delete(id)
        .then(() => deletedIds.add(id))
        .catch(() => { fallidos++; })
    ));
    if (deletedIds.size > 0) {
      setItems(prev => prev.filter(r => !deletedIds.has(r.id)));
      setSelectedIds(prev => { const n = new Set(prev); deletedIds.forEach(id => n.delete(id)); return n; });
      toast.success(`${deletedIds.size} ticket${deletedIds.size !== 1 ? 's' : ''} eliminados`);
    }
    if (fallidos > 0) toast.error(`${fallidos} no se pudieron eliminar`);
    setShowBulkDelete(false);
    setDeletingBulk(false);
  };

  // ── Gestión masiva (mismo estado/obs a todos los seleccionados) ───────────
  const handleBulkGestion = async () => {
    if (!bulkG.observacion.trim()) { toast.error('La observación es obligatoria'); return; }
    setApplyingBulk(true);
    try {
      const res = await requerimientosApi.bulkGestion({
        ids: Array.from(selectedIds),
        fecha:       bulkG.fecha,
        estado:      bulkG.estado,
        observacion: bulkG.observacion,
      });
      const successIds = new Set(res.resultados.filter((r: any) => r.success).map((r: any) => r.id));
      const now = new Date().toISOString();
      setItems(prev => prev.map(r => {
        if (!successIds.has(r.id)) return r;
        return { ...r, estadoActual: bulkG.estado, gestiones: [...r.gestiones, {
          id: `tmp-${r.id}`, fecha: new Date(bulkG.fecha).toISOString(),
          estado: bulkG.estado, observacion: bulkG.observacion, createdAt: now, changedBy: null,
        }] };
      }));
      toast.success(`${res.exitosos} ticket${res.exitosos !== 1 ? 's' : ''} actualizados`);
      if (res.fallidos > 0) toast.error(`${res.fallidos} con error`);
      setShowBulkG(false);
      setSelectedIds(new Set());
      setBulkG({ estado: 'Priorizado', observacion: '', fecha: new Date().toISOString().split('T')[0] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al aplicar gestión');
    } finally { setApplyingBulk(false); }
  };

  // ── Descargar Excel para priorizar ────────────────────────────────────────
  const handleDownloadXlsPriorizar = () => {
    const base = xlsAgenteId
      ? items.filter(r => r.agente?.id === xlsAgenteId)
      : items;

    if (base.length === 0) { toast.error('No hay requerimientos para el agente seleccionado'); return; }

    const headers = ['ID (no modificar)', 'N° REQ', 'Título', 'Cliente', 'N° OS', 'Módulo', 'Agente', 'Prioridad', 'Estado Actual', 'Nuevo Estado *', 'Observación *', 'Fecha (AAAA-MM-DD)'];
    const rows = base.map(r => [
      r.id,
      r.numero,
      r.titulo,
      r.client?.businessName ?? '',
      r.serviceOrder?.osNumber ?? '',
      r.templateModule ? `${r.templateModule.code} — ${r.templateModule.name}` : '',
      r.agente ? `${r.agente.firstName} ${r.agente.lastName}` : '',
      r.prioridad,
      r.estadoActual,
      '',   // Nuevo Estado — el usuario llena
      '',   // Observación  — el usuario llena
      new Date().toISOString().split('T')[0],
    ]);

    const instrData = [
      ['INSTRUCCIONES'],
      ['1. No modificar las columnas A–I (ID, número, datos actuales).'],
      ['2. Llenar "Nuevo Estado" y "Observación" solo para los tickets que deseas actualizar.'],
      ['3. Las filas con "Nuevo Estado" vacío serán ignoradas.'],
      ['4. Guardar el archivo y subirlo con el botón "Subir para priorizar".'],
      [],
      ['ESTADOS VÁLIDOS'],
      ...ESTADOS.map(s => [s]),
    ];

    const wb  = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(instrData);
    ws1['!cols'] = [{ wch: 70 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Instrucciones');

    const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws2['!cols'] = [36, 14, 40, 26, 12, 30, 22, 10, 14, 14, 50, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Priorización');

    const agenteName = xlsAgenteId
      ? agents.find(a => a.id === xlsAgenteId)?.firstName ?? 'agente'
      : 'todos';
    XLSX.writeFile(wb, `priorizacion_${agenteName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`${base.length} tickets exportados`);
    setShowXlsDown(false);
  };

  // ── Parsear Excel de priorización ─────────────────────────────────────────
  const handleXlsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target?.result, { type: 'array' });
        const ws   = wb.Sheets['Priorización'] ?? wb.Sheets[wb.SheetNames.find(n => n !== 'Instrucciones') ?? wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
        const today = new Date().toISOString().split('T')[0];

        const parsed: XlsRow[] = raw
          .map((row: any) => {
            const id           = String(row['ID (no modificar)'] ?? '').trim();
            const numero       = String(row['N° REQ'] ?? '').trim();
            const titulo       = String(row['Título'] ?? '').trim();
            const cliente      = String(row['Cliente'] ?? '').trim();
            const agente       = String(row['Agente'] ?? '').trim();
            const estadoActual = String(row['Estado Actual'] ?? '').trim() as Estado;
            const nuevoEstado  = String(row['Nuevo Estado *'] ?? row['Nuevo Estado'] ?? '').trim();
            const observacion  = String(row['Observación *'] ?? row['Observación'] ?? '').trim();
            const fecha        = String(row['Fecha (AAAA-MM-DD)'] ?? row['Fecha'] ?? today).trim() || today;

            if (!nuevoEstado) return null; // fila no modificada — ignorar

            const errors: string[] = [];
            if (!id)           errors.push('ID no encontrado');
            if (!observacion)  errors.push('Observación obligatoria');
            if (!ESTADOS.includes(nuevoEstado as Estado)) errors.push(`Estado inválido: "${nuevoEstado}"`);
            if (!items.find(r => r.id === id)) errors.push('El ticket no existe en la lista actual');

            return { id, numero, titulo, cliente, agente, estadoActual, nuevoEstado, observacion, fecha, errors, valid: errors.length === 0 };
          })
          .filter(Boolean) as XlsRow[];

        if (parsed.length === 0) { toast.error('No se encontraron filas con "Nuevo Estado" completado'); return; }
        setXlsRows(parsed);
        setXlsDone(null);
        setXlsProgress(0);
        setShowXlsPrev(true);
      } catch {
        toast.error('No se pudo leer el archivo. Usa la plantilla descargada.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Aplicar gestiones desde Excel ─────────────────────────────────────────
  const handleApplyXls = async () => {
    const validas = xlsRows.filter(r => r.valid);
    if (validas.length === 0) return;
    setApplyingXls(true);
    setXlsProgress(0);
    const interval = setInterval(() => setXlsProgress(p => Math.min(p + 6, 88)), 180);
    try {
      const payload = validas.map(r => ({ id: r.id, fecha: r.fecha, estado: r.nuevoEstado, observacion: r.observacion }));
      const res = await requerimientosApi.bulkGestionIndividual(payload);
      clearInterval(interval);
      setXlsProgress(100);
      setXlsDone({ exitosos: res.exitosos, fallidos: res.fallidos });
      const successIds = new Set(res.resultados.filter((r: any) => r.success).map((r: any) => r.id));
      const estadoById = new Map(payload.map(r => [r.id, r]));
      const now = new Date().toISOString();
      setItems(prev => prev.map(r => {
        if (!successIds.has(r.id)) return r;
        const p = estadoById.get(r.id)!;
        return { ...r, estadoActual: p.estado as Estado, gestiones: [...r.gestiones, {
          id: `tmp-${r.id}`, fecha: new Date(p.fecha).toISOString(),
          estado: p.estado as Estado, observacion: p.observacion, createdAt: now, changedBy: null,
        }] };
      }));
      if (res.exitosos > 0) toast.success(`${res.exitosos} ticket${res.exitosos !== 1 ? 's' : ''} actualizados`);
      if (res.fallidos > 0) toast.error(`${res.fallidos} con error`);
    } catch (err: any) {
      clearInterval(interval);
      toast.error(err?.response?.data?.message ?? 'Error al aplicar cambios');
    } finally { setApplyingXls(false); }
  };

  // ── Datos para gráficos ───────────────────────────────────────────────────
  const agenteMap: Record<string, number> = {};
  visible.forEach(r => {
    const name = r.agente ? `${r.agente.firstName} ${r.agente.lastName}` : 'Sin asignar';
    agenteMap[name] = (agenteMap[name] ?? 0) + 1;
  });
  const barData = Object.entries(agenteMap).map(([name, value]) => ({ name, value }));

  const prioMap: Record<string, number> = { Crítico: 0, Alta: 0, Media: 0, Baja: 0 };
  visible.forEach(r => { prioMap[r.prioridad] = (prioMap[r.prioridad] ?? 0) + 1; });
  const pieData = Object.entries(prioMap)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, color: PRIO_STYLE[name as Prioridad].color }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-6xl">
      <BackButton href="/requerimientos/nuevo" label="Registrar nuevo" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: tc.p }}>
            <ListOrdered className="w-5 h-5 text-violet-400" /> Priorizar Requerimientos
          </h2>
          <p className="text-sm mt-1" style={{ color: tc.m }}>
            Gestión semanal de prioridades — cada ticket mantiene su cronología de cambios.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="p-2.5 rounded-xl transition-all disabled:opacity-50"
            style={{ border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)'}`, color: tc.m }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {can('tickets.gestionar') && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowMail(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: isLight ? 'rgba(96,165,250,0.12)' : 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.35)', color: '#60a5fa' }}>
              <Mail className="w-4 h-4" /> Enviar correo
            </motion.button>
          )}
          {can('tickets.gestionar') && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={openAutoModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: isLight ? 'rgba(167,139,250,0.12)' : 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa' }}>
              <Settings className="w-4 h-4" /> Automatización
            </motion.button>
          )}
          {can('tickets.buscar') && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowExport(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: isLight ? 'rgba(52,211,153,0.12)' : 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399' }}>
              <FileSpreadsheet className="w-4 h-4" /> Exportar
            </motion.button>
          )}
          {can('tickets.priorizar') && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => { setXlsAgenteId(''); setShowXlsDown(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: isLight ? 'rgba(251,191,36,0.12)' : 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }}>
              <Download className="w-4 h-4" /> Plantilla XLS
            </motion.button>
          )}
          {can('tickets.priorizar') && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => xlsFileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: isLight ? 'rgba(251,146,60,0.12)' : 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.35)', color: '#fb923c' }}>
              <UploadCloud className="w-4 h-4" /> Subir Excel
            </motion.button>
          )}
          <input ref={xlsFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleXlsFileChange} />
          {can('tickets.nuevo') && (
            <Link href="/requerimientos/nuevo">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-medium">
                <Plus className="w-4 h-4" /> Nuevo
              </motion.button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm" style={{ color: tc.m }}>Cargando requerimientos...</span>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* ── Panel de filtros ────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4" style={glass(0.65)}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: tc.m }}>Filtros</span>
                {activeFilters > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                    {activeFilters} activo{activeFilters > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {activeFilters > 0 && (
                <button onClick={clearFilters}
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: '#f87171' }}>
                  <X className="w-3.5 h-3.5" /> Limpiar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: tc.m }}>Cliente</label>
                <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
                  value={fCliente} onChange={e => setFCliente(e.target.value)}>
                  <option value="">Todos</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: tc.m }}>Agente</label>
                <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
                  value={fAgente} onChange={e => setFAgente(e.target.value)}>
                  <option value="">Todos</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: tc.m }}>Módulo</label>
                <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
                  value={fModulo} onChange={e => setFModulo(e.target.value)}>
                  <option value="">Todos</option>
                  {modulos.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: tc.m }}>Área</label>
                <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
                  value={fArea} onChange={e => setFArea(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="Asistencial">🏥 Asistencial</option>
                  <option value="Financiero">💰 Financiero</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: tc.m }}>Estado</label>
                <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
                  value={fEstado} onChange={e => setFEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: tc.m }}>Prioridad</label>
                <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
                  value={fPrioChip === 'Todos' ? '' : fPrioChip}
                  onChange={e => setFPrioChip((e.target.value || 'Todos') as Prioridad | 'Todos')}>
                  <option value="">Todas</option>
                  {PRIORIDADES.map(p => <option key={p} value={p}>{PRIO_STYLE[p].icon} {p}</option>)}
                </select>
              </div>
            </div>

            {/* Sección fecha */}
            <div className="mt-3 pt-3"
              style={{ borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5" style={{ color: tc.m }} />
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: tc.m }}>Fecha de registro</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Atajos */}
                {(['esta', 'anterior', 'mes'] as const).map(s => {
                  const label = s === 'esta' ? 'Esta semana' : s === 'anterior' ? 'Sem. anterior' : 'Este mes';
                  const active = fSemana === s;
                  return (
                    <button key={s} type="button"
                      onClick={() => {
                        const r = s === 'mes' ? monthRange() : weekRange(s === 'anterior' ? 1 : 0);
                        if (active) { setFSemana(''); setFDesde(''); setFHasta(''); }
                        else        { setFSemana(s); setFDesde(r.from); setFHasta(r.to); }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
                        border: `1px solid ${active ? 'rgba(167,139,250,0.50)' : (isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)')}`,
                        color: active ? '#a78bfa' : tc.s,
                      }}>
                      {label}
                    </button>
                  );
                })}
                <span className="text-[10px]" style={{ color: tc.m }}>o rango:</span>
                {/* Inputs manuales */}
                <input type="date" className="input-glass rounded-lg px-2 py-1.5 text-xs"
                  value={fDesde}
                  onChange={e => { setFDesde(e.target.value); setFSemana(''); }}
                  style={{ width: 130 }} />
                <span className="text-xs" style={{ color: tc.m }}>–</span>
                <input type="date" className="input-glass rounded-lg px-2 py-1.5 text-xs"
                  value={fHasta}
                  onChange={e => { setFHasta(e.target.value); setFSemana(''); }}
                  style={{ width: 130 }} />
                {(fDesde || fHasta) && (
                  <button onClick={() => { setFDesde(''); setFHasta(''); setFSemana(''); }}
                    className="p-1 rounded-lg transition-colors" style={{ color: '#f87171' }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 flex items-center justify-between"
              style={{ borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
              <span className="text-xs" style={{ color: tc.m }}>
                Mostrando <strong style={{ color: tc.s }}>{visible.length}</strong> de <strong style={{ color: tc.s }}>{items.length}</strong> requerimientos
                {(fDesde || fHasta) && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
                    {fDesde && fHasta ? `${fDesde} → ${fHasta}` : fDesde ? `desde ${fDesde}` : `hasta ${fHasta}`}
                  </span>
                )}
              </span>
              <span className="text-[10px] italic" style={{ color: tc.m }}>Los gráficos reflejan la selección activa</span>
            </div>
          </motion.div>

          {/* ── Gráficos ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="rounded-2xl p-5" style={glass()}>
              <p className="text-sm font-semibold mb-1" style={{ color: tc.p }}>Tickets por agente</p>
              <p className="text-xs mb-4" style={{ color: tc.m }}>
                {visible.length} ticket{visible.length !== 1 ? 's' : ''} en la selección actual
              </p>
              {barData.length === 0
                ? <div className="h-[170px] flex items-center justify-center text-sm" style={{ color: tc.m }}>Sin datos</div>
                : <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={barData} barCategoryGap="35%">
                      <XAxis dataKey="name" tick={{ fill: tc.m, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: tc.m, fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                      <Tooltip content={<BarTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {barData.map((_, i) => <Cell key={i} fill={['#60a5fa','#a78bfa','#34d399','#fbbf24'][i % 4]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              }
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="rounded-2xl p-5" style={glass()}>
              <p className="text-sm font-semibold mb-1" style={{ color: tc.p }}>Distribución por prioridad</p>
              <p className="text-xs mb-1" style={{ color: tc.m }}>
                {visible.length} ticket{visible.length !== 1 ? 's' : ''} en la selección actual
              </p>
              {pieData.length === 0
                ? <div className="h-[185px] flex items-center justify-center text-sm" style={{ color: tc.m }}>Sin datos</div>
                : <ResponsiveContainer width="100%" height={185}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={68} innerRadius={36}
                        dataKey="value" labelLine={false} label={renderPieLabel}>
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                      </Pie>
                      <Legend iconType="circle" iconSize={8}
                        formatter={(v) => <span style={{ fontSize: 12, color: tc.s }}>{v}</span>} />
                      <Tooltip
                        formatter={(value, name) => [
                          <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{value as number} tickets</span>,
                          <span style={{ color: PRIO_STYLE[name as Prioridad]?.color }}>{name}</span>,
                        ]}
                        contentStyle={{ background: 'rgba(10,20,40,0.97)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
              }
            </motion.div>
          </div>

          {/* ── Chips de prioridad ───────────────────────────────────────────── */}
          <div className="flex gap-2 flex-wrap">
            {(['Todos', ...PRIORIDADES] as (Prioridad | 'Todos')[]).map(f => {
              const ps     = f !== 'Todos' ? PRIO_STYLE[f] : null;
              const count  = f === 'Todos' ? items.length : items.filter(r => r.prioridad === f).length;
              const active = fPrioChip === f;
              const accent = ps?.color ?? '#60a5fa';
              const accentBg = ps?.bg ?? 'rgba(96,165,250,0.15)';
              return (
                <motion.button key={f}
                  whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setFPrioChip(f)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: active ? (isLight ? 'rgba(255,255,255,0.82)' : accentBg) : (isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.06)'),
                    border: `1px solid ${active ? (isLight ? `${accent}60` : `${accent}70`) : (isLight ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.12)')}`,
                    backdropFilter: 'blur(16px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                    boxShadow: active
                      ? (isLight ? `0 4px 16px ${accent}25, inset 0 1px 0 rgba(255,255,255,0.95)` : `0 4px 16px ${accent}30, inset 0 1px 0 rgba(255,255,255,0.12)`)
                      : (isLight ? '0 2px 8px rgba(30,60,120,0.10), inset 0 1px 0 rgba(255,255,255,0.90)' : '0 2px 8px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)'),
                    color: active ? accent : tc.s,
                  }}>
                  {ps ? <span>{ps.icon}</span> : <span style={{ color: '#60a5fa', fontSize: 10 }}>●</span>}
                  <span>{f}</span>
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: active ? (isLight ? `${accent}18` : `${accent}22`) : (isLight ? 'rgba(30,60,120,0.08)' : 'rgba(255,255,255,0.08)'), color: active ? accent : tc.m }}>
                    {count}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* ── Tabla ───────────────────────────────────────────────────────── */}
          {visible.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl p-12 flex flex-col items-center gap-3" style={glass()}>
              <AlertCircle className="w-10 h-10 text-violet-400 opacity-50" />
              <p className="text-sm font-medium" style={{ color: tc.m }}>
                {items.length === 0 ? 'No hay requerimientos registrados' : 'Ningún requerimiento coincide con los filtros'}
              </p>
              {items.length === 0 && can('tickets.nuevo') && (
                <Link href="/requerimientos/nuevo">
                  <button className="btn-primary px-5 py-2 rounded-xl text-sm text-white font-medium mt-1">
                    Registrar el primero
                  </button>
                </Link>
              )}
            </motion.div>
          ) : (
            <div className="rounded-2xl overflow-x-auto" style={glass()}>
              <table className="w-full text-sm" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: rowBorder, background: isLight ? 'rgba(30,60,120,0.05)' : 'rgba(255,255,255,0.03)' }}>
                    <th className="px-3 py-3 w-8">
                      <button onClick={toggleSelectAll}
                        className="flex items-center justify-center transition-colors"
                        style={{ color: selectedIds.size > 0 ? '#a78bfa' : tc.m }}
                        title={selectedIds.size === visible.length ? 'Deseleccionar todos' : 'Seleccionar todos'}>
                        {selectedIds.size === visible.length && visible.length > 0
                          ? <CheckSquare className="w-4 h-4" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    {['', '#', 'Requerimiento', 'Cliente', 'Módulo / Fase', 'Agente', 'Prioridad', 'Estado', ''].map((h, i) => (
                      <th key={i} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: tc.m }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((req, vIdx) => {
                    const ps     = PRIO_STYLE[req.prioridad];
                    const es     = EST_STYLE[req.estadoActual];
                    const isOpen = expanded.includes(req.id);
                    const realIdx = items.findIndex(r => r.id === req.id);

                    return (
                      <AnimatePresence key={req.id} mode="wait">
                        <>
                          {/* Fila principal */}
                          <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ borderBottom: isOpen ? 'none' : rowBorder, background: selectedIds.has(req.id) ? (isLight ? 'rgba(167,139,250,0.07)' : 'rgba(167,139,250,0.07)') : undefined }}
                            className="transition-colors"
                            onMouseEnter={e => { if (!selectedIds.has(req.id)) e.currentTarget.style.background = isLight ? 'rgba(30,60,120,0.03)' : 'rgba(255,255,255,0.03)'; }}
                            onMouseLeave={e => { if (!selectedIds.has(req.id)) e.currentTarget.style.background = 'transparent'; }}>

                            {/* Checkbox */}
                            <td className="px-3 py-3 w-8">
                              <button onClick={() => toggleSelect(req.id)}
                                className="flex items-center justify-center transition-colors"
                                style={{ color: selectedIds.has(req.id) ? '#a78bfa' : tc.m }}>
                                {selectedIds.has(req.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                              </button>
                            </td>

                            {/* Toggle */}
                            <td className="px-3 py-3 w-8">
                              <button onClick={() => toggleExpand(req.id)}
                                className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                                style={{ background: isOpen ? 'rgba(167,139,250,0.15)' : 'transparent', color: isOpen ? '#a78bfa' : tc.m }}>
                                <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </motion.div>
                              </button>
                            </td>

                            {/* Nro */}
                            <td className="px-3 py-3">
                              <span className="text-xs font-mono font-bold" style={{ color: tc.m }}>
                                {String(realIdx + 1).padStart(2, '0')}
                              </span>
                            </td>

                            {/* Título */}
                            <td className="px-3 py-3 max-w-[220px]">
                              <p className="font-medium text-sm leading-tight truncate" style={{ color: tc.p }}>{req.titulo}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--accent-blue)' }}>{req.numero}</span>
                                <span className="text-[10px]" style={{ color: tc.m }}>{req.tipo}</span>
                                {req.ticketRubi && (
                                  <span className="badge-violet text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                                    {req.ticketRubi}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Cliente */}
                            <td className="px-3 py-3 text-xs" style={{ color: tc.s }}>
                              <p className="font-medium">{req.client?.businessName ?? '—'}</p>
                              {req.serviceOrder && (
                                <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--accent-blue)' }}>{req.serviceOrder.osNumber}</p>
                              )}
                            </td>

                            {/* Módulo / Fase */}
                            <td className="px-3 py-3">
                              {req.templateModule ? (
                                <div>
                                  <p className="text-xs font-medium" style={{ color: tc.s }}>{req.templateModule.name}</p>
                                  {req.templatePhase && (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md mt-0.5"
                                      style={{
                                        background: `${req.templatePhase.color}${isLight ? '14' : '18'}`,
                                        color: isLight ? tc.s : req.templatePhase.color,
                                        border: `1px solid ${req.templatePhase.color}${isLight ? '55' : '40'}`,
                                      }}>
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: req.templatePhase.color }} />
                                      {req.templatePhase.name}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: tc.m }}>—</span>
                              )}
                            </td>

                            {/* Agente */}
                            <td className="px-3 py-3 text-xs font-medium" style={{ color: tc.s }}>
                              {req.agente ? `${req.agente.firstName} ${req.agente.lastName}` : '—'}
                            </td>

                            {/* Prioridad */}
                            <td className="px-3 py-3">
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                                style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.color}40` }}>
                                {ps.icon} {req.prioridad}
                              </span>
                            </td>

                            {/* Estado */}
                            <td className="px-3 py-3">
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit"
                                style={{ background: es.bg, color: es.color, border: `1px solid ${es.color}40` }}>
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: es.dot }} />
                                {req.estadoActual}
                              </span>
                            </td>

                            {/* Acciones */}
                            <td className="px-2 py-3" style={{ whiteSpace: 'nowrap' }}>
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => setViewTarget(req)}
                                  className="p-1.5 rounded-lg transition-all hover:bg-slate-500/10"
                                  style={{ color: tc.s }} title="Ver detalle">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {can('tickets.gestionar') && (
                                  <button
                                    onClick={() => { setModalReq(req); setGestion({ estado: 'Priorizado', observacion: '', fecha: new Date().toISOString().split('T')[0], devueltoPor: '', devueltoNota: '' }); }}
                                    className="p-1.5 rounded-lg transition-all hover:bg-violet-500/10"
                                    style={{ color: '#a78bfa' }} title="Registrar gestión">
                                    <Send className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {can('tickets.eliminar') && (
                                  <button onClick={() => setDeleteTarget(req)}
                                    className="p-1.5 rounded-lg transition-all hover:bg-red-500/10"
                                    style={{ color: '#f87171' }} title="Eliminar ticket">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>

                          {/* Cronología expandida */}
                          {isOpen && (
                            <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              style={{ borderBottom: rowBorder }}>
                              <td colSpan={10} className="px-6 pb-5 pt-2">
                                <div className="flex items-center gap-2 mb-3">
                                  <Clock className="w-3.5 h-3.5 text-violet-400" />
                                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: tc.m }}>
                                    Cronología — {req.gestiones.length} gestión{req.gestiones.length !== 1 ? 'es' : ''}
                                  </span>
                                </div>

                                {req.gestiones.length === 0 ? (
                                  <p className="text-sm italic" style={{ color: tc.m }}>Sin gestiones registradas</p>
                                ) : (
                                  <div className="relative pl-5">
                                    <div className="absolute left-[7px] top-2 bottom-2 w-px"
                                      style={{ background: isLight ? 'rgba(30,60,120,0.15)' : 'rgba(255,255,255,0.10)' }} />
                                    <div className="space-y-4">
                                      {[...req.gestiones].reverse().map((g, i) => {
                                        const hs = EST_STYLE[g.estado];
                                        const autor = g.changedBy
                                          ? `${g.changedBy.firstName} ${g.changedBy.lastName}`
                                          : 'Sistema';
                                        return (
                                          <motion.div key={g.id}
                                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.06 }}
                                            className="flex gap-4 relative">
                                            <div className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 z-10"
                                              style={{ background: hs.dot, boxShadow: `0 0 0 3px ${hs.dot}25` }} />
                                            <div className="flex-1 rounded-xl p-3"
                                              style={{ background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isLight ? 'rgba(30,60,120,0.08)' : 'rgba(255,255,255,0.07)'}` }}>
                                              <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                                                  style={{ background: hs.bg, color: hs.color }}>
                                                  {g.estado}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                  <span className="text-xs" style={{ color: tc.m }}>
                                                    {new Date(g.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                  </span>
                                                  <span className="text-xs" style={{ color: tc.m }}>
                                                    por <strong style={{ color: tc.s }}>{autor}</strong>
                                                  </span>
                                                </div>
                                              </div>
                                              <p className="text-sm leading-relaxed" style={{ color: tc.s }}>{g.observacion}</p>
                                            </div>
                                          </motion.div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </motion.tr>
                          )}
                        </>
                      </AnimatePresence>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Barra flotante de selección múltiple ────────────────────────────── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl"
            style={{
              transform: 'translateX(-50%)',
              background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,25,50,0.95)',
              border: '1px solid rgba(167,139,250,0.40)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px rgba(167,139,250,0.15)',
            }}>
            <span className="text-sm font-bold" style={{ color: '#a78bfa' }}>
              {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <span className="w-px h-5" style={{ background: 'rgba(167,139,250,0.30)' }} />
            {can('tickets.gestionar') && (
              <button onClick={() => setShowBulkG(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.35)' }}>
                <Send className="w-3.5 h-3.5" /> Gestionar
              </button>
            )}
            {can('tickets.eliminar') && (
              <button onClick={() => setShowBulkDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.35)' }}>
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
            )}
            <button onClick={() => setSelectedIds(new Set())}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: tc.m }}>
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal gestión ───────────────────────────────────────────────────── */}
      <Modal open={!!modalReq} onClose={() => setModalReq(null)}
        title={`Registrar gestión`} width="max-w-lg">
        {modalReq && (
          <div className="space-y-4">
            {/* Info del ticket */}
            <div className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ background: isLight ? 'rgba(30,60,120,0.05)' : 'rgba(255,255,255,0.05)', border: rowBorder }}>
              <span className="font-mono text-xs font-bold mt-0.5" style={{ color: '#60a5fa' }}>{modalReq.numero}</span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{modalReq.titulo}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Estado actual: <span className="font-semibold" style={{ color: EST_STYLE[modalReq.estadoActual].color }}>{modalReq.estadoActual}</span>
                </p>
              </div>
            </div>

            {/* Fecha + Estado */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fecha</label>
                <input type="date" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                  value={gestion.fecha} onChange={e => setGestion(p => ({ ...p, fecha: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nuevo estado</label>
                <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                  value={gestion.estado} onChange={e => setGestion(p => ({ ...p, estado: e.target.value as Estado }))}>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Preview estado */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
                style={{ background: EST_STYLE[gestion.estado].bg, color: EST_STYLE[gestion.estado].color }}>
                <span className="w-2 h-2 rounded-full" style={{ background: EST_STYLE[gestion.estado].dot }} />
                {gestion.estado}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>— nuevo estado</span>
            </div>

            {/* Devolución: quién devuelve (solo cuando estado = Devuelto) */}
            {gestion.estado === 'Devuelto' && (
              <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.25)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#fb923c' }}>¿Quién devuelve el ticket?</p>
                <div className="flex gap-2">
                  {[{ v: 'cliente' as const, l: 'Cliente' }, { v: 'desarrollo' as const, l: 'Área de Desarrollo' }].map(({ v, l }) => (
                    <button key={v} type="button" onClick={() => setGestion(p => ({ ...p, devueltoPor: v }))}
                      className="flex-1 text-sm py-2 rounded-xl font-semibold border transition-all"
                      style={{
                        background: gestion.devueltoPor === v ? 'rgba(251,146,60,0.18)' : 'transparent',
                        color: gestion.devueltoPor === v ? '#fb923c' : 'var(--text-muted)',
                        borderColor: gestion.devueltoPor === v ? 'rgba(251,146,60,0.50)' : 'var(--border-subtle)',
                      }}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Observación */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Observación <span className="text-red-400 normal-case font-normal">*</span>
              </label>
              <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={4}
                placeholder="Describe la acción tomada, el motivo del cambio de estado..."
                value={gestion.observacion} onChange={e => setGestion(p => ({ ...p, observacion: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalReq(null)}
                className="px-4 py-2.5 rounded-xl text-sm transition-colors"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={handleAddGestion} disabled={savingGestion}
                className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {savingGestion
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Guardando...</>
                  : 'Registrar gestión'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal Exportar Excel ────────────────────────────────────────────── */}
      <Modal open={showExport} onClose={() => setShowExport(false)}
        title="Exportar a Excel" width="max-w-lg">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Selecciona los filtros para la exportación. Deja en blanco para exportar todos.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Cliente</label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={xCliente} onChange={e => setXCliente(e.target.value)}>
                <option value="">Todos</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Agente</label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={xAgente} onChange={e => setXAgente(e.target.value)}>
                <option value="">Todos</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Área</label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={xArea} onChange={e => setXArea(e.target.value)}>
                <option value="">Todas</option>
                <option value="Asistencial">🏥 Asistencial</option>
                <option value="Financiero">💰 Financiero</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Prioridad</label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={xPrioridad} onChange={e => setXPrioridad(e.target.value)}>
                <option value="">Todas</option>
                {PRIORIDADES.map(p => <option key={p} value={p}>{PRIO_STYLE[p].icon} {p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Estado</label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={xEstado} onChange={e => setXEstado(e.target.value)}>
                <option value="">Todos</option>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Fecha de registro */}
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-3.5 h-3.5 text-violet-400" />
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fecha de registro</label>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {(['esta', 'anterior', 'mes'] as const).map(s => {
                const label = s === 'esta' ? 'Esta semana' : s === 'anterior' ? 'Sem. anterior' : 'Este mes';
                const active = xSemana === s;
                return (
                  <button key={s} type="button"
                    onClick={() => {
                      const r = s === 'mes' ? monthRange() : weekRange(s === 'anterior' ? 1 : 0);
                      if (active) { setXSemana(''); setXDesde(''); setXHasta(''); }
                      else        { setXSemana(s); setXDesde(r.from); setXHasta(r.to); }
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
                      border: `1px solid ${active ? 'rgba(167,139,250,0.50)' : 'var(--border-subtle)'}`,
                      color: active ? '#a78bfa' : 'var(--text-secondary)',
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Desde</label>
                <input type="date" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                  value={xDesde} onChange={e => { setXDesde(e.target.value); setXSemana(''); }} />
              </div>
              <span className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>–</span>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Hasta</label>
                <input type="date" className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                  value={xHasta} onChange={e => { setXHasta(e.target.value); setXSemana(''); }} />
              </div>
              {(xDesde || xHasta) && (
                <button onClick={() => { setXDesde(''); setXHasta(''); setXSemana(''); }}
                  className="p-1.5 rounded-lg mt-4 transition-colors" style={{ color: '#f87171' }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Preview contador */}
          <div className="rounded-xl px-4 py-3 flex items-center justify-between"
            style={{ background: exportPreview.length > 0 ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${exportPreview.length > 0 ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}` }}>
            <span className="text-sm font-medium" style={{ color: exportPreview.length > 0 ? '#34d399' : '#f87171' }}>
              {exportPreview.length > 0
                ? `${exportPreview.length} requerimiento${exportPreview.length !== 1 ? 's' : ''} se exportarán`
                : 'Ningún requerimiento coincide con los filtros'}
            </span>
            <Download className="w-4 h-4" style={{ color: exportPreview.length > 0 ? '#34d399' : '#f87171' }} />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowExport(false)}
              className="px-4 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleExport} disabled={exportPreview.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
              style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.40)', color: '#34d399' }}>
              <FileSpreadsheet className="w-4 h-4" />
              Descargar Excel
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Enviar Correo ─────────────────────────────────────────────── */}
      <Modal open={showMail} onClose={() => setShowMail(false)}
        title="Enviar por correo" width="max-w-lg">
        <div className="space-y-4">
          {/* Destinatarios */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Destinatarios <span className="text-red-400 normal-case font-normal">*</span>
            </label>
            <input ref={emailInputRef}
              className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              placeholder="correo@ejemplo.com, otro@ejemplo.com"
              value={mDestinatarios} onChange={e => setMDestinatarios(e.target.value)} />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Separa múltiples correos con coma o punto y coma</p>
          </div>

          {/* Asunto */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Asunto</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              placeholder="Tickets a priorizar semana DD-DD Mes AAAA (se genera automáticamente)"
              value={mAsunto} onChange={e => setMAsunto(e.target.value)} />
          </div>

          {/* Separador */}
          <div className="pt-1 pb-1">
            <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <Filter className="w-3 h-3" /> Filtros de contenido
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Solo se incluirán en el correo los requerimientos que coincidan. Deja en blanco para incluir todos.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Cliente</label>
              <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
                value={mCliente} onChange={e => setMCliente(e.target.value)}>
                <option value="">Todos</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Agente</label>
              <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
                value={mAgente} onChange={e => setMAgente(e.target.value)}>
                <option value="">Todos</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Área</label>
              <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
                value={mArea} onChange={e => setMArea(e.target.value)}>
                <option value="">Todas</option>
                <option value="Asistencial">🏥 Asistencial</option>
                <option value="Financiero">💰 Financiero</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Prioridad</label>
              <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
                value={mPrioridad} onChange={e => setMPrioridad(e.target.value)}>
                <option value="">Todas</option>
                {PRIORIDADES.map(p => <option key={p} value={p}>{PRIO_STYLE[p].icon} {p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Estado {mEstados.length > 0 && <span style={{ color: '#60a5fa' }}>({mEstados.length} seleccionados)</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {/* Chip "Todos" */}
                <button type="button"
                  onClick={() => setMEstados(mEstados.length === ESTADOS.length ? [] : [...ESTADOS])}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={{
                    background: mEstados.length === ESTADOS.length ? 'rgba(96,165,250,0.15)' : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'),
                    color:      mEstados.length === ESTADOS.length ? '#60a5fa' : 'var(--text-muted)',
                    border:     `1px solid ${mEstados.length === ESTADOS.length ? '#60a5fa60' : 'transparent'}`,
                  }}>
                  Todos
                </button>
                {ESTADOS.map(s => {
                  const active = mEstados.includes(s);
                  const ec = EST_STYLE[s as Estado];
                  return (
                    <button key={s} type="button"
                      onClick={() => setMEstados(prev => prev.includes(s) ? prev.filter(e => e !== s) : [...prev, s])}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                      style={{
                        background: active ? ec.bg : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'),
                        color:      active ? ec.color : 'var(--text-muted)',
                        border:     `1px solid ${active ? ec.color + '60' : 'transparent'}`,
                      }}>
                      {s}
                    </button>
                  );
                })}
              </div>
              {mEstados.length > 0 && (
                <button onClick={() => setMEstados([])} className="text-[10px] mt-1.5"
                  style={{ color: 'var(--text-muted)' }}>
                  Limpiar selección
                </button>
              )}
            </div>
          </div>

          {/* Preview contador */}
          <div className="rounded-xl px-4 py-3 flex items-center justify-between"
            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.20)' }}>
            <span className="text-sm font-medium" style={{ color: '#60a5fa' }}>
              {mailPreviewCount} requerimiento{mailPreviewCount !== 1 ? 's' : ''} se incluirán en el correo
            </span>
            <Mail className="w-4 h-4 text-blue-400" />
          </div>

          {/* Mensaje opcional */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Mensaje adicional (opcional)</label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
              placeholder="Ej: Estos son los requerimientos priorizados para la semana 24..."
              value={mMensaje} onChange={e => setMMensaje(e.target.value)} />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowMail(false)}
              className="px-4 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleSendMail} disabled={sendingMail || mailPreviewCount === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
              style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.40)', color: '#60a5fa' }}>
              {sendingMail
                ? <><span className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" /> Enviando...</>
                : <><Mail className="w-4 h-4" /> Enviar correo</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Ver / Editar Detalle ─────────────────────────────────────── */}
      <Modal open={!!viewTarget} onClose={() => { setViewTarget(null); setEditMode(false); }}
        title="Detalle del requerimiento" width="max-w-2xl">
        {viewTarget && (() => {
          const ps   = PRIO_STYLE[viewTarget.prioridad];
          const es   = EST_STYLE[viewTarget.estadoActual];
          const lastG = viewTarget.gestiones.length > 0 ? viewTarget.gestiones[viewTarget.gestiones.length - 1] : null;
          const currentModPhases = editModules.find(m => m.id === editForm.templateModuleId)?.phases ?? [];

          return (
            <div className="space-y-5">
              {/* Encabezado */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{viewTarget.titulo}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>{viewTarget.numero}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md"
                      style={{ background: isLight ? 'rgba(30,60,120,0.06)' : 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{viewTarget.tipo}</span>
                    {viewTarget.ticketRubi && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md font-semibold"
                        style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
                        Rubi: {viewTarget.ticketRubi}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.color}40` }}>
                    {ps.icon} {viewTarget.prioridad}
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: es.bg, color: es.color, border: `1px solid ${es.color}40` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: es.dot }} />
                    {viewTarget.estadoActual}
                  </span>
                </div>
              </div>

              {/* Grid info (solo lectura) */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Cliente',           value: viewTarget.client?.businessName ?? '—' },
                  { label: 'Área',              value: viewTarget.area },
                  { label: 'Agente',            value: viewTarget.agente ? `${viewTarget.agente.firstName} ${viewTarget.agente.lastName}` : '—' },
                  { label: 'Fecha de registro', value: new Date(viewTarget.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl px-3 py-2.5"
                    style={{ background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isLight ? 'rgba(30,60,120,0.08)' : 'rgba(255,255,255,0.07)'}` }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* ── Sección editable ── */}
              <div className="rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${editMode ? 'rgba(96,165,250,0.35)' : (isLight ? 'rgba(30,60,120,0.08)' : 'rgba(255,255,255,0.07)')}` }}>
                {/* Toggle header */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.04)', borderBottom: editMode ? `1px solid rgba(96,165,250,0.20)` : 'none' }}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: editMode ? '#60a5fa' : 'var(--text-muted)' }}>
                      Asignación: OS · Módulo · Fase
                    </p>
                    {editMode && hasProject && (
                      <p className="text-[10px] mt-0.5" style={{ color: '#34d399' }}>
                        ✓ Filtrando módulos del proyecto — la fase seleccionada creará una actividad en el plan de trabajo
                      </p>
                    )}
                    {editMode && editForm.serviceOrderId && !hasProject && (
                      <p className="text-[10px] mt-0.5" style={{ color: '#fbbf24' }}>
                        ⚠ La OS aún no tiene proyecto generado — la fase no creará actividad
                      </p>
                    )}
                  </div>
                  {!editMode && can('tickets.editar') ? (
                    <button onClick={() => openEditMode(viewTarget)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                      style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                  ) : (
                    <button onClick={() => setEditMode(false)}
                      className="text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                      Cancelar
                    </button>
                  )}
                </div>

                {/* Modo lectura */}
                {!editMode && (
                  <div className="grid grid-cols-3 gap-0">
                    {[
                      { label: 'N° OS',       value: viewTarget.serviceOrder?.osNumber ?? '—' },
                      { label: 'Nombre OS',   value: viewTarget.serviceOrder?.product ?? '—' },
                      { label: 'Módulo',      value: viewTarget.templateModule ? `${viewTarget.templateModule.code} — ${viewTarget.templateModule.name}` : '—' },
                      { label: 'Fase',        value: viewTarget.templatePhase?.name ?? '—' },
                      { label: 'Ticket Rubi', value: viewTarget.ticketRubi ?? '—' },
                    ].map(({ label, value }, i) => (
                      <div key={label} className="px-4 py-3"
                        style={{ borderRight: i % 2 === 0 ? `1px solid ${isLight ? 'rgba(30,60,120,0.06)' : 'rgba(255,255,255,0.06)'}` : 'none',
                                 borderTop: i >= 2 ? `1px solid ${isLight ? 'rgba(30,60,120,0.06)' : 'rgba(255,255,255,0.06)'}` : 'none' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
                        <p className="text-sm font-medium truncate font-mono" style={{ color: label === 'Ticket Rubi' && viewTarget.ticketRubi ? '#a78bfa' : 'var(--text-secondary)' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Modo edición */}
                {editMode && (
                  <div className="p-4 space-y-3">
                    {/* Orden de Servicio */}
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                        Orden de Servicio
                      </label>
                      <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                        value={editForm.serviceOrderId ?? ''}
                        onChange={e => handleSOChange(e.target.value || null)}>
                        <option value="">Sin orden de servicio</option>
                        {editServiceOrders.map(os => (
                          <option key={os.id} value={os.id}>{os.osNumber} — {os.product}</option>
                        ))}
                      </select>
                    </div>

                    {/* Módulo */}
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                        Módulo
                      </label>
                      <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                        value={editForm.templateModuleId ?? ''}
                        onChange={e => setEditForm(p => ({ ...p, templateModuleId: e.target.value || null, templatePhaseId: null }))}>
                        <option value="">Sin módulo</option>
                        {editModules.map(m => (
                          <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Fase — solo si hay módulo seleccionado */}
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                        Fase {!editForm.templateModuleId && <span className="normal-case font-normal">(selecciona un módulo primero)</span>}
                      </label>
                      <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                        value={editForm.templatePhaseId ?? ''}
                        disabled={!editForm.templateModuleId || currentModPhases.length === 0}
                        onChange={e => setEditForm(p => ({ ...p, templatePhaseId: e.target.value || null }))}>
                        <option value="">Sin fase</option>
                        {currentModPhases.map(ph => (
                          <option key={ph.id} value={ph.id}>{ph.name}</option>
                        ))}
                      </select>
                      {editForm.templateModuleId && currentModPhases.length === 0 && (
                        <p className="text-[10px] mt-1" style={{ color: '#fbbf24' }}>Este módulo no tiene fases configuradas</p>
                      )}
                    </div>

                    {/* Ticket Rubi */}
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                        Ticket Rubi
                      </label>
                      <input
                        type="text"
                        className="input-glass w-full rounded-xl px-3 py-2.5 text-sm font-mono"
                        placeholder="Ej: RUBI-1234"
                        value={editForm.ticketRubi}
                        onChange={e => setEditForm(p => ({ ...p, ticketRubi: e.target.value }))}
                      />
                    </div>

                    <button onClick={handleSaveEdit} disabled={savingEdit}
                      className="w-full btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 mt-1">
                      {savingEdit
                        ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Guardando...</>
                        : <><Save className="w-4 h-4" /> Guardar cambios</>}
                    </button>
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div className="rounded-xl px-4 py-3"
                style={{ background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isLight ? 'rgba(30,60,120,0.08)' : 'rgba(255,255,255,0.07)'}` }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Descripción</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                  {viewTarget.descripcion || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin descripción</span>}
                </p>
              </div>

              {/* Criterios de aceptación */}
              {viewTarget.criteriosAceptacion && (
                <div className="rounded-xl px-4 py-3"
                  style={{ background: isLight ? 'rgba(34,197,94,0.04)' : 'rgba(34,197,94,0.06)', border: `1px solid ${isLight ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.18)'}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#34d399' }}>Criterios de aceptación</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                    {viewTarget.criteriosAceptacion}
                  </p>
                </div>
              )}

              {/* Última observación */}
              {lastG && (
                <div className="rounded-xl px-4 py-3"
                  style={{ background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isLight ? 'rgba(30,60,120,0.08)' : 'rgba(255,255,255,0.07)'}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Última observación</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{lastG.observacion}</p>
                  <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(lastG.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {lastG.changedBy && ` · ${lastG.changedBy.firstName} ${lastG.changedBy.lastName}`}
                  </p>
                </div>
              )}

              {/* Cronología */}
              {viewTarget.gestiones.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Clock className="w-3 h-3" /> Cronología ({viewTarget.gestiones.length} gestión{viewTarget.gestiones.length !== 1 ? 'es' : ''})
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {[...viewTarget.gestiones].reverse().map((g) => {
                      const hs = EST_STYLE[g.estado];
                      return (
                        <div key={g.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                          style={{ background: isLight ? 'rgba(30,60,120,0.03)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isLight ? 'rgba(30,60,120,0.07)' : 'rgba(255,255,255,0.06)'}` }}>
                          <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: hs.dot }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: hs.bg, color: hs.color }}>{g.estado}</span>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {new Date(g.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {g.changedBy && ` · ${g.changedBy.firstName} ${g.changedBy.lastName}`}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{g.observacion}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setViewTarget(null); setEditMode(false); }}
                  className="px-4 py-2.5 rounded-xl text-sm flex-1 transition-colors"
                  style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  Cerrar
                </button>
                <button
                  onClick={() => { setViewTarget(null); setEditMode(false); setModalReq(viewTarget); setGestion({ estado: 'Priorizado', observacion: '', fecha: new Date().toISOString().split('T')[0], devueltoPor: '', devueltoNota: '' }); }}
                  className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" /> Registrar gestión
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Modal Eliminar múltiples ────────────────────────────────────────── */}
      <Modal open={showBulkDelete} onClose={() => !deletingBulk && setShowBulkDelete(false)}
        title={`Eliminar ${selectedIds.size} ticket${selectedIds.size !== 1 ? 's' : ''}`} width="max-w-md">
        <div className="space-y-4">
          <div className="rounded-xl px-4 py-3"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: '#f87171' }}>Esta acción es irreversible</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Se eliminarán <strong>{selectedIds.size} requerimientos</strong> y toda su cronología de gestiones de forma permanente.
            </p>
          </div>
          <div className="rounded-xl px-3 py-2 max-h-40 overflow-y-auto space-y-1"
            style={{ background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isLight ? 'rgba(30,60,120,0.08)' : 'rgba(255,255,255,0.07)'}` }}>
            {items.filter(r => selectedIds.has(r.id)).map(r => (
              <div key={r.id} className="flex items-center gap-2 py-1">
                <span className="font-mono text-xs font-bold" style={{ color: '#60a5fa' }}>{r.numero}</span>
                <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{r.titulo}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowBulkDelete(false)} disabled={deletingBulk}
              className="px-4 py-2.5 rounded-xl text-sm transition-colors flex-1"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleBulkDelete} disabled={deletingBulk}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.40)', color: '#f87171' }}>
              {deletingBulk
                ? <><span className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" /> Eliminando...</>
                : <><Trash2 className="w-4 h-4" /> Eliminar {selectedIds.size} ticket{selectedIds.size !== 1 ? 's' : ''}</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Eliminar ticket ───────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}
        title="Eliminar requerimiento" width="max-w-md">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="rounded-xl px-4 py-3"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
              <p className="text-sm font-semibold" style={{ color: '#f87171' }}>Esta acción es irreversible</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Se eliminará el requerimiento <span className="font-mono font-bold" style={{ color: '#60a5fa' }}>{deleteTarget.numero}</span>{' '}
                y toda su cronología de gestiones.
              </p>
              <p className="text-sm mt-2 font-medium truncate" style={{ color: 'var(--text-primary)' }}>{deleteTarget.titulo}</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="px-4 py-2.5 rounded-xl text-sm transition-colors flex-1"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
                style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.40)', color: '#f87171' }}>
                {deleting
                  ? <><span className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" /> Eliminando...</>
                  : <><Trash2 className="w-4 h-4" /> Eliminar</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal Gestión masiva ────────────────────────────────────────────── */}
      <Modal open={showBulkG} onClose={() => !applyingBulk && setShowBulkG(false)}
        title={`Gestionar ${selectedIds.size} ticket${selectedIds.size !== 1 ? 's' : ''}`} width="max-w-lg">
        <div className="space-y-4">
          <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
            style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}>
            <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: '#a78bfa' }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Se aplicará el mismo estado y observación a todos los tickets seleccionados.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fecha</label>
              <input type="date" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={bulkG.fecha} onChange={e => setBulkG(p => ({ ...p, fecha: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nuevo estado</label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={bulkG.estado} onChange={e => setBulkG(p => ({ ...p, estado: e.target.value as Estado }))}>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
              style={{ background: EST_STYLE[bulkG.estado].bg, color: EST_STYLE[bulkG.estado].color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: EST_STYLE[bulkG.estado].dot }} />
              {bulkG.estado}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>— nuevo estado para todos</span>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Observación <span className="text-red-400 normal-case font-normal">*</span>
            </label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={4}
              placeholder="Describe la acción tomada..."
              value={bulkG.observacion} onChange={e => setBulkG(p => ({ ...p, observacion: e.target.value }))} />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowBulkG(false)} disabled={applyingBulk}
              className="px-4 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleBulkGestion} disabled={applyingBulk || !bulkG.observacion.trim()}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {applyingBulk
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Aplicando...</>
                : `Aplicar a ${selectedIds.size} ticket${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Descargar plantilla XLS para priorizar ─────────────────────── */}
      <Modal open={showXlsDown} onClose={() => setShowXlsDown(false)}
        title="Descargar plantilla de priorización" width="max-w-md">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Descarga un Excel con los tickets actuales pre-cargados. Llena las columnas <strong>"Nuevo Estado"</strong> y <strong>"Observación"</strong> y súbelo de vuelta.
          </p>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Agente (opcional)
            </label>
            <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={xlsAgenteId} onChange={e => setXlsAgenteId(e.target.value)}>
              <option value="">Todos los agentes</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
            </select>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {xlsAgenteId
                ? `Se incluirán ${items.filter(r => r.agente?.id === xlsAgenteId).length} tickets del agente seleccionado`
                : `Se incluirán todos los ${items.length} tickets`}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowXlsDown(false)}
              className="px-4 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleDownloadXlsPriorizar}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.40)', color: '#fbbf24' }}>
              <Download className="w-4 h-4" /> Descargar plantilla
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Preview/Aplicar XLS priorización ──────────────────────────── */}
      <Modal open={showXlsPrev} onClose={() => !applyingXls && (setShowXlsPrev(false), setXlsDone(null))}
        title="Vista previa — priorización por Excel" width="max-w-2xl">
        <div className="space-y-4">
          {/* Resumen */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl px-4 py-3 flex items-center gap-2"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
              <span className="text-lg font-bold" style={{ color: '#34d399' }}>{xlsRows.filter(r => r.valid).length}</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>válidas</span>
            </div>
            {xlsRows.filter(r => !r.valid).length > 0 && (
              <div className="flex-1 rounded-xl px-4 py-3 flex items-center gap-2"
                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
                <span className="text-lg font-bold" style={{ color: '#f87171' }}>{xlsRows.filter(r => !r.valid).length}</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>con errores (se ignorarán)</span>
              </div>
            )}
          </div>

          {/* Tabla */}
          <div className="overflow-y-auto rounded-xl" style={{ maxHeight: 320, border: rowBorder }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: isLight ? 'rgba(30,60,120,0.05)' : 'rgba(255,255,255,0.05)', borderBottom: rowBorder }}>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: tc.m }}>N° REQ</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: tc.m }}>Título</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: tc.m }}>Agente</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: tc.m }}>Estado actual</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: tc.m }}>Nuevo estado</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: tc.m }}>Observación</th>
                </tr>
              </thead>
              <tbody>
                {xlsRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: rowBorder, opacity: row.valid ? 1 : 0.6,
                    background: row.valid ? undefined : (isLight ? 'rgba(248,113,113,0.05)' : 'rgba(248,113,113,0.06)') }}>
                    <td className="px-3 py-2 font-mono font-bold" style={{ color: '#60a5fa' }}>{row.numero}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate" style={{ color: tc.p }}>{row.titulo}</td>
                    <td className="px-3 py-2" style={{ color: tc.s }}>{row.agente}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: EST_STYLE[row.estadoActual]?.bg, color: EST_STYLE[row.estadoActual]?.color }}>
                        {row.estadoActual}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.valid
                        ? <span className="px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: EST_STYLE[row.nuevoEstado as Estado]?.bg, color: EST_STYLE[row.nuevoEstado as Estado]?.color }}>
                            {row.nuevoEstado}
                          </span>
                        : <span className="text-red-400">{row.errors[0]}</span>}
                    </td>
                    <td className="px-3 py-2 max-w-[180px] truncate" style={{ color: tc.s }}>{row.observacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Barra de progreso */}
          {(applyingXls || xlsDone) && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: tc.s }}>
                  {xlsDone ? (xlsDone.exitosos > 0 ? 'Completado' : 'Sin cambios') : 'Aplicando cambios...'}
                </span>
                <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>{xlsProgress}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: isLight ? 'rgba(30,60,120,0.10)' : 'rgba(255,255,255,0.08)' }}>
                <motion.div className="h-full rounded-full"
                  animate={{ width: `${xlsProgress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.3 }}
                  style={{ background: xlsDone ? (xlsDone.fallidos === 0 ? '#34d399' : '#fbbf24') : '#a78bfa' }} />
              </div>
              {xlsDone && (
                <p className="text-xs mt-1.5" style={{ color: tc.m }}>
                  {xlsDone.exitosos} actualizados · {xlsDone.fallidos} con error
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => { setShowXlsPrev(false); setXlsDone(null); }} disabled={applyingXls}
              className="px-4 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              {xlsDone ? 'Cerrar' : 'Cancelar'}
            </button>
            {!xlsDone && (
              <button onClick={handleApplyXls} disabled={applyingXls || xlsRows.filter(r => r.valid).length === 0}
                className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {applyingXls
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Aplicando...</>
                  : `Aplicar ${xlsRows.filter(r => r.valid).length} cambio${xlsRows.filter(r => r.valid).length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Modal Automatización de correo ──────────────────────────────────── */}
      <Modal open={showAuto} onClose={() => setShowAuto(false)}
        title="Automatización de correo" width="max-w-lg">
        {loadingAuto ? (
          <div className="flex items-center justify-center py-10">
            <span className="w-6 h-6 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">

            {/* Toggle activar/desactivar */}
            <div className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: autoConfig.enabled ? 'rgba(52,211,153,0.08)' : (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'), border: `1px solid ${autoConfig.enabled ? 'rgba(52,211,153,0.25)' : 'var(--border-subtle)'}` }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Envío automático</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {autoConfig.enabled ? 'Activo — el correo se enviará según la programación' : 'Inactivo — no se enviará correo automáticamente'}
                </p>
              </div>
              <button onClick={() => setAutoConfig(p => ({ ...p, enabled: !p.enabled }))}>
                {autoConfig.enabled
                  ? <ToggleRight className="w-9 h-9 text-emerald-400" />
                  : <ToggleLeft className="w-9 h-9" style={{ color: 'var(--text-muted)' }} />}
              </button>
            </div>

            {/* Días de la semana */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Días de envío {autoConfig.diasSemana.length > 0 && <span style={{ color: '#a78bfa' }}>({autoConfig.diasSemana.length} días)</span>}
              </label>
              <div className="flex gap-2">
                {DIAS_SEMANA.map(d => {
                  const active = autoConfig.diasSemana.includes(d.value);
                  return (
                    <button key={d.value} type="button"
                      onClick={() => setAutoConfig(p => ({
                        ...p,
                        diasSemana: p.diasSemana.includes(d.value)
                          ? p.diasSemana.filter(x => x !== d.value)
                          : [...p.diasSemana, d.value],
                      }))}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: active ? 'rgba(167,139,250,0.18)' : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'),
                        color:      active ? '#a78bfa' : 'var(--text-muted)',
                        border:     `1px solid ${active ? '#a78bfa50' : 'transparent'}`,
                      }}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hora */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Hora de envío
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Hora (0–23)</label>
                  <input type="number" min={0} max={23}
                    className="input-glass w-full rounded-xl px-3 py-2 text-sm text-center font-mono"
                    value={autoConfig.hora}
                    onChange={e => setAutoConfig(p => ({ ...p, hora: Math.min(23, Math.max(0, Number(e.target.value))) }))} />
                </div>
                <span className="text-2xl font-bold mt-4" style={{ color: 'var(--text-muted)' }}>:</span>
                <div className="flex-1">
                  <label className="block text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Minuto (0–59)</label>
                  <input type="number" min={0} max={59}
                    className="input-glass w-full rounded-xl px-3 py-2 text-sm text-center font-mono"
                    value={autoConfig.minuto}
                    onChange={e => setAutoConfig(p => ({ ...p, minuto: Math.min(59, Math.max(0, Number(e.target.value))) }))} />
                </div>
                <div className="mt-4 text-sm font-mono px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                  {String(autoConfig.hora).padStart(2,'0')}:{String(autoConfig.minuto).padStart(2,'0')}
                </div>
              </div>
            </div>

            {/* Estados */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Estados a incluir {autoConfig.estados.length > 0 && <span style={{ color: '#60a5fa' }}>({autoConfig.estados.length})</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button type="button"
                  onClick={() => setAutoConfig(p => ({ ...p, estados: p.estados.length === ESTADOS.length ? [] : [...ESTADOS] }))}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={{
                    background: autoConfig.estados.length === ESTADOS.length ? 'rgba(96,165,250,0.15)' : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'),
                    color:      autoConfig.estados.length === ESTADOS.length ? '#60a5fa' : 'var(--text-muted)',
                    border:     `1px solid ${autoConfig.estados.length === ESTADOS.length ? '#60a5fa60' : 'transparent'}`,
                  }}>
                  Todos
                </button>
                {ESTADOS.map(s => {
                  const active = autoConfig.estados.includes(s);
                  const ec = EST_STYLE[s as Estado];
                  return (
                    <button key={s} type="button"
                      onClick={() => setAutoConfig(p => ({ ...p, estados: p.estados.includes(s) ? p.estados.filter(e => e !== s) : [...p.estados, s] }))}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                      style={{
                        background: active ? ec.bg : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'),
                        color:      active ? ec.color : 'var(--text-muted)',
                        border:     `1px solid ${active ? ec.color + '60' : 'transparent'}`,
                      }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Destinatarios */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Destinatarios automáticos
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  className="input-glass flex-1 rounded-xl px-3 py-2 text-sm"
                  placeholder="correo@empresa.com"
                  value={autoNewEmail}
                  onChange={e => setAutoNewEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAutoEmail(); } }}
                />
                <button onClick={addAutoEmail}
                  className="px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5"
                  style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.30)' }}>
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
              {autoConfig.destinatarios.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin destinatarios aún</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {autoConfig.destinatarios.map(email => (
                    <div key={email} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                      style={{ background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)' }}>
                      {email}
                      <button onClick={() => setAutoConfig(p => ({ ...p, destinatarios: p.destinatarios.filter(e => e !== email) }))}
                        className="ml-0.5 opacity-60 hover:opacity-100">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Asunto */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Asunto (opcional)</label>
              <input className="input-glass w-full rounded-xl px-3 py-2 text-sm"
                placeholder="Tickets a priorizar semana DD-DD Mes AAAA (se genera automáticamente)"
                value={autoConfig.asunto}
                onChange={e => setAutoConfig(p => ({ ...p, asunto: e.target.value }))} />
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowAuto(false)}
                className="px-4 py-2.5 rounded-xl text-sm transition-colors"
                style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={runAutoNow} disabled={runningNow || autoConfig.destinatarios.length === 0}
                className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-40"
                style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.30)' }}>
                {runningNow
                  ? <span className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
                  : <Play className="w-4 h-4" />}
                Enviar ahora
              </button>
              <button onClick={saveAutoConfig} disabled={savingAuto}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.40)' }}>
                {savingAuto
                  ? <span className="w-4 h-4 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
                  : <Save className="w-4 h-4" />}
                Guardar automatización
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
