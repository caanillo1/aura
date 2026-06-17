'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { usePermission } from '@/hooks/usePermission';
import { useTheme } from 'next-themes';
import {
  ClipboardPlus, Search, X, Building2, ChevronDown,
  CheckCircle2, AlertCircle, User, Loader2,
  FileSpreadsheet, Upload, Download, TriangleAlert,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BackButton } from '@/components/ui/BackButton';
import { clientsApi, serviceOrdersApi, usersApi, requerimientosApi, templatesApi, projectsApi } from '@/lib/api';
import { toast } from 'sonner';
import type { Client, User as UserType, ServiceOrder } from '@/types';

// ── Constantes ─────────────────────────────────────────────────────────────

const TIPOS = ['Funcional','No funcional','Mejora','Corrección','Integración','Otro'];

const PRIORIDADES = [
  { label: 'Crítico', color: '#dc2626', bg: 'rgba(220,38,38,0.14)', ring: 'rgba(220,38,38,0.40)' },
  { label: 'Alta',    color: '#f97316', bg: 'rgba(249,115,22,0.13)', ring: 'rgba(249,115,22,0.35)' },
  { label: 'Media',   color: '#eab308', bg: 'rgba(234,179,8,0.13)',  ring: 'rgba(234,179,8,0.35)'  },
  { label: 'Baja',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  ring: 'rgba(34,197,94,0.30)'  },
];

const AREAS = ['Asistencial', 'Financiero'];

const OS_STATUS_LABEL: Record<string, string> = {
  pendiente:  'Pendiente',
  en_curso:   'En curso',
  suspendida: 'Suspendida',
  cancelada:  'Cancelada',
};

const OS_STATUS_COLOR: Record<string, string> = {
  pendiente:  '#60a5fa',
  en_curso:   '#34d399',
  suspendida: '#fbbf24',
  cancelada:  '#f87171',
};

const EMPTY = {
  titulo: '', tipo: 'Funcional', prioridad: 'Media',
  descripcion: '', criteriosAceptacion: '',
  templateModuleId: '', templatePhaseId: '',
  area: '', ticketRubi: '',
  clientId: '', serviceOrderId: '', agenteId: '',
};

// ── Combobox genérico de búsqueda ──────────────────────────────────────────

interface ComboboxProps {
  placeholder: string;
  value: string;
  displayValue: string;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  icon?: React.ElementType;
  tc: { p: string; s: string; m: string };
  isLight: boolean;
  disabled?: boolean;
}

function Combobox({
  placeholder, value, displayValue, onSearch, onSelect: _onSelect,
  onClear, open, onOpenChange, children, icon: Icon = Search, tc, isLight, disabled,
}: ComboboxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOpenChange]);

  const borderColor = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  const dropBg      = isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,25,50,0.97)';

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center input-glass rounded-xl overflow-hidden"
        style={{
          border: `1px solid ${open ? '#60a5fa60' : borderColor}`,
          transition: 'border-color 0.15s',
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}>
        <span className="pl-3 shrink-0">
          <Icon className="w-4 h-4" style={{ color: value ? '#60a5fa' : tc.m }} />
        </span>

        {value && !open ? (
          <button type="button" onClick={() => { if (!disabled) onOpenChange(true); }}
            className="flex-1 text-left px-3 py-2.5 text-sm truncate"
            style={{ color: tc.p }}>
            {displayValue}
          </button>
        ) : (
          <input
            className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
            style={{ color: tc.p }}
            placeholder={value ? displayValue : placeholder}
            value={query}
            disabled={disabled}
            onChange={e => { setQuery(e.target.value); onSearch(e.target.value); onOpenChange(true); }}
            onFocus={() => { if (!disabled) { onSearch(''); onOpenChange(true); } }}
          />
        )}

        {value ? (
          <button type="button" onClick={onClear} className="pr-3 pl-1 shrink-0 hover:opacity-70">
            <X className="w-4 h-4" style={{ color: tc.m }} />
          </button>
        ) : (
          <button type="button" onClick={() => onOpenChange(!open)} className="pr-3 pl-1 shrink-0 hover:opacity-70">
            <ChevronDown className="w-4 h-4" style={{ color: tc.m, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60,
              borderRadius: '0.75rem', overflow: 'hidden', background: dropBg,
              border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
              boxShadow: isLight ? '0 12px 40px rgba(30,60,120,0.18)' : '0 12px 40px rgba(0,0,0,0.50)',
              transformOrigin: 'top',
            }}>
            <div className="max-h-60 overflow-y-auto">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function RegistrarRequerimientoPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can } = usePermission();

  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState<{ numero: string } | null>(null);

  // Datos
  const [clients, setClients]     = useState<Client[]>([]);
  const [agents, setAgents]       = useState<UserType[]>([]);
  const [orders, setOrders]       = useState<ServiceOrder[]>([]);
  const [modules, setModules]     = useState<any[]>([]);
  const [phases, setPhases]       = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders]   = useState(false);
  const [loadingPhases, setLoadingPhases]   = useState(false);
  const [hasProject, setHasProject]         = useState(false);
  const [projectModuleNames, setProjectModuleNames] = useState<Set<string> | null>(null);

  // Combobox state
  const [clientOpen, setClientOpen]   = useState(false);
  const [clientQ, setClientQ]         = useState('');
  const [agentOpen, setAgentOpen]     = useState(false);
  const [agentQ, setAgentQ]           = useState('');
  const [moduleOpen, setModuleOpen]   = useState(false);
  const [moduleQ, setModuleQ]         = useState('');

  // Validación Ticket Rubi
  const [rubiChecking, setRubiChecking] = useState(false);
  const [rubiError,    setRubiError]    = useState<string | null>(null);
  const [rubiOk,       setRubiOk]       = useState(false);

  // Cargue masivo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkRows,      setBulkRows]      = useState<BulkRow[]>([]);
  const [showBulk,      setShowBulk]      = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress,  setBulkProgress]  = useState(0);
  const [bulkDone,      setBulkDone]      = useState<{ exitosos: number; fallidos: number } | null>(null);

  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  const glass = {
    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? '0 8px 32px rgba(30,60,120,0.15), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  };

  useEffect(() => {
    clientsApi.list({ limit: 500 }).then(r => setClients(r.data)).catch(() => {});
    usersApi.listAgents({ limit: 200 }).then(r => setAgents(r.data)).catch(() => {});
    templatesApi.listModules({ limit: 500 }).then((r: any) => setModules(r.data ?? [])).catch(() => {});
  }, []);

  // Debounce validación ticketRubi
  useEffect(() => {
    const val = form.ticketRubi.trim();
    if (!val) { setRubiError(null); setRubiOk(false); return; }

    setRubiChecking(true);
    setRubiError(null);
    setRubiOk(false);

    const t = setTimeout(async () => {
      try {
        const res = await requerimientosApi.list({ search: val, limit: 10 });
        const dup = (res.data ?? []).find((r: any) => r.ticketRubi === val);
        if (dup) {
          setRubiError(`Ya existe en ${dup.numero} — ${dup.titulo}`);
        } else {
          setRubiOk(true);
        }
      } catch {
        // si falla la consulta no bloquear el formulario
      } finally {
        setRubiChecking(false);
      }
    }, 500);

    return () => clearTimeout(t);
  }, [form.ticketRubi]);

  // Cargar OS cuando cambia el cliente
  const loadOrders = useCallback(async (clientId: string) => {
    if (!clientId) { setOrders([]); return; }
    setLoadingOrders(true);
    try {
      const res = await serviceOrdersApi.listByClient(clientId, 200);
      // Excluir completadas
      setOrders((res.data as ServiceOrder[]).filter((o: ServiceOrder) => o.status !== 'completada'));
    } catch { setOrders([]); }
    finally { setLoadingOrders(false); }
  }, []);

  // Cargar fases cuando cambia el módulo
  const loadPhases = useCallback(async (moduleId: string) => {
    if (!moduleId) { setPhases([]); return; }
    setLoadingPhases(true);
    try {
      const detail: any = await templatesApi.getModuleDetail(moduleId);
      const phasesArr = detail?.phases ?? [];
      setPhases(phasesArr);
      // Auto-seleccionar la primera fase (pendiente por defecto)
      if (phasesArr.length > 0) {
        setForm(p => ({ ...p, templatePhaseId: phasesArr[0].id }));
      }
    } catch { setPhases([]); }
    finally { setLoadingPhases(false); }
  }, []);

  const set = (k: keyof typeof EMPTY, v: string) => setForm(p => ({ ...p, [k]: v }));

  const selectedClient = clients.find(c => c.id === form.clientId) ?? null;
  const selectedAgent  = agents.find(a => a.id === form.agenteId)  ?? null;
  const selectedOrder  = orders.find(o => o.id === form.serviceOrderId) ?? null;
  const selectedModule = modules.find((m: any) => m.id === form.templateModuleId) ?? null;
  const selectedPhase  = phases.find((p: any) => p.id === form.templatePhaseId) ?? null;

  const filteredClients = clientQ.trim()
    ? clients.filter(c =>
        c.businessName.toLowerCase().includes(clientQ.toLowerCase()) ||
        (c.nit ?? '').includes(clientQ))
    : clients;

  const filteredAgents = agentQ.trim()
    ? agents.filter(a =>
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(agentQ.toLowerCase()))
    : agents;

  const filteredModules = (() => {
    let list: any[] = modules;
    if (projectModuleNames !== null) {
      list = list.filter((m: any) => projectModuleNames.has(m.name.toLowerCase()));
    }
    if (moduleQ.trim()) {
      list = list.filter((m: any) =>
        m.name.toLowerCase().includes(moduleQ.toLowerCase()) ||
        m.code.toLowerCase().includes(moduleQ.toLowerCase()));
    }
    return list;
  })();

  const handleSelectOrder = async (osId: string) => {
    setForm(p => ({ ...p, serviceOrderId: osId, templateModuleId: '', templatePhaseId: '' }));
    setPhases([]);
    setHasProject(false);
    setProjectModuleNames(null);

    if (!osId) return;

    try {
      const projData = await projectsApi.modulesByServiceOrder(osId);
      if (projData.id && projData.modules.length > 0) {
        setHasProject(true);
        const names = new Set<string>(projData.modules.map((m: any) => m.name.toLowerCase() as string));
        setProjectModuleNames(names);
      }
    } catch {
      // silently fail — show all modules
    }
  };

  const handleSelectClient = (id: string) => {
    setForm(p => ({ ...p, clientId: id, serviceOrderId: '' }));
    setClientOpen(false);
    setHasProject(false);
    setProjectModuleNames(null);
    loadOrders(id);
  };

  const handleClearClient = () => {
    setForm(p => ({ ...p, clientId: '', serviceOrderId: '' }));
    setOrders([]);
    setClientOpen(true);
    setHasProject(false);
    setProjectModuleNames(null);
  };

  const handleSelectModule = (id: string) => {
    setForm(p => ({ ...p, templateModuleId: id, templatePhaseId: '' }));
    setModuleOpen(false);
    loadPhases(id);
  };

  const handleClearModule = () => {
    setForm(p => ({ ...p, templateModuleId: '', templatePhaseId: '' }));
    setPhases([]);
    setModuleOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId)    { toast.error('Selecciona un cliente'); return; }
    if (!form.agenteId)    { toast.error('Selecciona un agente'); return; }
    if (!form.area)        { toast.error('Selecciona el área'); return; }
    if (!form.titulo.trim()) { toast.error('El título es obligatorio'); return; }
    if (!form.descripcion.trim()) { toast.error('La descripción es obligatoria'); return; }
    if (rubiError)         { toast.error('Corrige el Ticket Rubi antes de guardar'); return; }
    if (rubiChecking)      { toast.error('Espera, verificando el Ticket Rubi...'); return; }

    setSaving(true);
    try {
      const req = await requerimientosApi.create({
        titulo:              form.titulo,
        tipo:                form.tipo,
        prioridad:           form.prioridad,
        descripcion:         form.descripcion,
        criteriosAceptacion: form.criteriosAceptacion || undefined,
        templateModuleId:   form.templateModuleId || undefined,
        templatePhaseId:    form.templatePhaseId  || undefined,
        area:                form.area,
        ticketRubi:          form.ticketRubi || undefined,
        clientId:            form.clientId,
        serviceOrderId:      form.serviceOrderId || undefined,
        agenteId:            form.agenteId,
      });
      setDone({ numero: req.numero });
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al registrar el requerimiento');
    } finally { setSaving(false); }
  };

  // ── Tipos cargue masivo ──────────────────────────────────────────────────
  type BulkRow = {
    fila: number;
    titulo: string; descripcion: string;
    nitCliente: string; areaSel: string; agenteNombre: string;
    tipo: string; prioridad: string; ticketRubi: string;
    criterios: string; codigoModulo: string;
    // resueltos
    clientId?: string; agenteId?: string; templateModuleId?: string;
    errors: string[]; valid: boolean;
  };

  // ── Descargar plantilla ──────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Hoja 1: Instructivo
    const instr: any[][] = [
      ['PLANTILLA DE CARGUE MASIVO — REQUERIMIENTOS'],
      [],
      ['CAMPO', 'OBLIGATORIO', 'DESCRIPCIÓN / VALORES VÁLIDOS'],
      ['Título',                   'Sí',  'Texto libre. Ej: Módulo de facturación electrónica'],
      ['Descripción',              'Sí',  'Descripción detallada del requerimiento'],
      ['NIT Cliente',              'Sí',  'NIT exacto del cliente (ver tabla abajo)'],
      ['Área',                     'Sí',  'Asistencial / Financiero'],
      ['Agente',                   'Sí',  'Nombre completo del agente (ver tabla abajo)'],
      ['Tipo',                     'No',  'Funcional / No funcional / Mejora / Corrección / Integración / Otro (default: Funcional)'],
      ['Prioridad',                'No',  'Crítico / Alta / Media / Baja (default: Media)'],
      ['Ticket Rubi',              'No',  'Número único de ticket. Ej: RUB-2026-001'],
      ['Criterios de Aceptación',  'No',  'Condiciones que debe cumplir el requerimiento'],
      ['Código Módulo',            'No',  'Código del módulo de la biblioteca (ver tabla abajo)'],
      [],
      ['── CLIENTES DISPONIBLES ──'],
      ['NIT', 'Nombre'],
      ...clients.map(c => [c.nit ?? '(sin NIT)', c.businessName]),
      [],
      ['── AGENTES DISPONIBLES ──'],
      ['Nombre completo'],
      ...agents.map((a: any) => [`${a.firstName} ${a.lastName}`]),
      [],
      ['── MÓDULOS DISPONIBLES ──'],
      ['Código', 'Nombre'],
      ...modules.map((m: any) => [m.code, m.name]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(instr);
    ws1['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Instructivo');

    // Hoja 2: Datos
    const headers = [
      'Título *', 'Descripción *', 'NIT Cliente *', 'Área *', 'Agente *',
      'Tipo', 'Prioridad', 'Ticket Rubi', 'Criterios de Aceptación', 'Código Módulo',
    ];
    const example = [
      'Módulo de facturación electrónica',
      'Implementar el módulo para generación de facturas en formato DIAN.',
      clients[0]?.nit ?? '900123456',
      'Asistencial',
      agents[0] ? `${(agents[0] as any).firstName} ${(agents[0] as any).lastName}` : 'Juan Pérez',
      'Funcional', 'Alta', 'RUB-2026-001', 'El módulo debe validar el CUFE.', modules[0]?.code ?? '',
    ];
    const ws2 = XLSX.utils.aoa_to_sheet([headers, example]);
    ws2['!cols'] = [40, 50, 14, 13, 24, 14, 10, 14, 40, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Requerimientos');

    XLSX.writeFile(wb, 'plantilla_requerimientos_masivo.xlsx');
    toast.success('Plantilla descargada');
  };

  // ── Parsear y validar archivo ────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb    = XLSX.read(ev.target?.result, { type: 'array' });
        const sheetName = wb.SheetNames.find(n => n === 'Requerimientos') ?? wb.SheetNames[0];
        const ws    = wb.Sheets[sheetName];
        const raw   = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });

        const TIPOS_VALIDOS    = ['Funcional','No funcional','Mejora','Corrección','Integración','Otro'];
        const PRIOS_VALIDAS    = ['Crítico','Alta','Media','Baja'];
        const AREAS_VALIDAS    = ['Asistencial','Financiero'];

        const parsed: BulkRow[] = raw.map((row: any, idx: number) => {
          const get = (col: string) => String(row[col] ?? '').trim();
          const titulo        = get('Título *')                || get('Título');
          const descripcion   = get('Descripción *')           || get('Descripción');
          const nitCliente    = get('NIT Cliente *')           || get('NIT Cliente');
          const areaSel       = get('Área *')                  || get('Área');
          const agenteNombre  = get('Agente *')                || get('Agente');
          const tipo          = get('Tipo')          || 'Funcional';
          const prioridad     = get('Prioridad')     || 'Media';
          const ticketRubi    = get('Ticket Rubi');
          const criterios     = get('Criterios de Aceptación');
          const codigoModulo  = get('Código Módulo');

          const errors: string[] = [];

          if (!titulo)       errors.push('Título obligatorio');
          if (!descripcion)  errors.push('Descripción obligatoria');
          if (!nitCliente)   errors.push('NIT Cliente obligatorio');
          if (!areaSel)      errors.push('Área obligatoria');
          if (!agenteNombre) errors.push('Agente obligatorio');

          if (areaSel    && !AREAS_VALIDAS.includes(areaSel))  errors.push(`Área inválida: "${areaSel}"`);
          if (tipo       && !TIPOS_VALIDOS.includes(tipo))     errors.push(`Tipo inválido: "${tipo}"`);
          if (prioridad  && !PRIOS_VALIDAS.includes(prioridad)) errors.push(`Prioridad inválida: "${prioridad}"`);

          // Resolver IDs
          const clientMatch = clients.find(c => c.nit === nitCliente);
          if (nitCliente && !clientMatch) errors.push(`Cliente NIT "${nitCliente}" no encontrado`);

          const agentMatch = agents.find((a: any) =>
            `${a.firstName} ${a.lastName}`.toLowerCase() === agenteNombre.toLowerCase()
          );
          if (agenteNombre && !agentMatch) errors.push(`Agente "${agenteNombre}" no encontrado`);

          const moduleMatch = codigoModulo
            ? modules.find((m: any) => m.code.toLowerCase() === codigoModulo.toLowerCase())
            : undefined;
          if (codigoModulo && !moduleMatch) errors.push(`Módulo código "${codigoModulo}" no encontrado`);

          return {
            fila: idx + 2, titulo, descripcion, nitCliente, areaSel, agenteNombre,
            tipo, prioridad, ticketRubi, criterios, codigoModulo,
            clientId:        clientMatch?.id,
            agenteId:        (agentMatch as any)?.id,
            templateModuleId: moduleMatch?.id,
            errors,
            valid: errors.length === 0,
          };
        });

        setBulkRows(parsed);
        setBulkDone(null);
        setShowBulk(true);
      } catch {
        toast.error('No se pudo leer el archivo. Usa la plantilla descargada.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ── Importar filas válidas ───────────────────────────────────────────────
  const handleBulkImport = async () => {
    const validas = bulkRows.filter(r => r.valid);
    if (validas.length === 0) return;
    setBulkImporting(true);
    setBulkProgress(0);

    const payload = validas.map(r => ({
      titulo:              r.titulo,
      descripcion:         r.descripcion,
      tipo:                r.tipo || 'Funcional',
      prioridad:           r.prioridad || 'Media',
      area:                r.areaSel,
      ticketRubi:          r.ticketRubi || undefined,
      criteriosAceptacion: r.criterios  || undefined,
      clientId:            r.clientId!,
      agenteId:            r.agenteId!,
      templateModuleId:    r.templateModuleId || undefined,
    }));

    try {
      // Simular progreso mientras se procesa
      const interval = setInterval(() => {
        setBulkProgress(p => Math.min(p + 8, 88));
      }, 150);

      const res = await requerimientosApi.createBulk({ requerimientos: payload });
      clearInterval(interval);
      setBulkProgress(100);
      setBulkDone({ exitosos: res.exitosos, fallidos: res.fallidos });

      // Actualizar estado de las filas con resultado
      setBulkRows(prev => prev.map(row => {
        if (!row.valid) return row;
        const resultado = res.resultados.find((r: any) => r.titulo === row.titulo);
        if (resultado?.error) return { ...row, valid: false, errors: [resultado.error] };
        return row;
      }));

      if (res.exitosos > 0) toast.success(`${res.exitosos} requerimiento${res.exitosos !== 1 ? 's' : ''} importado${res.exitosos !== 1 ? 's' : ''}`);
      if (res.fallidos > 0) toast.error(`${res.fallidos} fila${res.fallidos !== 1 ? 's' : ''} con error — revisa los detalles`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error en el cargue masivo');
    } finally {
      setBulkImporting(false);
    }
  };

  const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: tc.m }}>
      {children}{required && <span className="text-red-400 normal-case ml-1">*</span>}
    </label>
  );

  const dropItem = (label: string, sub?: string, active?: boolean, onClick?: () => void) => (
    <button type="button" onClick={onClick}
      className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors"
      style={{ background: active ? 'rgba(96,165,250,0.12)' : 'transparent' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = isLight ? 'rgba(30,60,120,0.05)' : 'rgba(255,255,255,0.05)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: active ? '#60a5fa' : tc.p }}>{label}</p>
        {sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: tc.m }}>{sub}</p>}
      </div>
      {active && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
        style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>✓</span>}
    </button>
  );

  // ── Pantalla de éxito ────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <CheckCircle2 className="w-16 h-16 text-emerald-500" />
        </motion.div>
        <h3 className="text-xl font-bold" style={{ color: tc.p }}>¡Requerimiento registrado!</h3>
        <p className="text-sm font-mono" style={{ color: '#60a5fa' }}>{done.numero}</p>
        <div className="flex gap-3 mt-2">
          <button onClick={() => { setForm(EMPTY); setOrders([]); setDone(null); }}
            className="btn-primary px-5 py-2.5 rounded-xl text-sm text-white font-medium">
            Registrar otro
          </button>
          <button onClick={() => router.push('/requerimientos/priorizar')}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>
            Ver priorización
          </button>
        </div>
      </div>
    );
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-3xl">
      <BackButton href="/requerimientos/priorizar" label="Priorizar Requerimientos" />

      <div>
        <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: tc.p }}>
          <ClipboardPlus className="w-5 h-5 text-blue-400" /> Registrar Requerimiento
        </h2>
        <p className="text-sm mt-0.5" style={{ color: tc.m }}>
          El número REQ se genera automáticamente al guardar.
        </p>
      </div>

      {/* ── Cargue masivo ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{
          background: isLight ? 'rgba(167,139,250,0.07)' : 'rgba(167,139,250,0.08)',
          border: '1px solid rgba(167,139,250,0.25)',
        }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>
            <FileSpreadsheet className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Cargue masivo por Excel
          </p>
          <p className="text-xs mt-0.5" style={{ color: tc.m }}>
            Descarga la plantilla, llénala y súbela para registrar múltiples requerimientos a la vez.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.30)', color: '#a78bfa' }}>
            <Download className="w-3.5 h-3.5" /> Descargar plantilla
          </button>
          {can('tickets.nuevo') && (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.30)', color: '#34d399' }}>
              <Upload className="w-3.5 h-3.5" /> Subir plantilla
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={handleFileChange} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Bloque 1: Cliente + OS ─────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 space-y-4" style={{ ...glass, position: 'relative', zIndex: 30 }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tc.m }}>Origen del requerimiento</p>

          {/* Cliente */}
          <div>
            <Label required>Cliente</Label>
            <Combobox
              placeholder="Buscar cliente por nombre o NIT..."
              value={form.clientId}
              displayValue={selectedClient?.businessName ?? ''}
              onSearch={setClientQ}
              onSelect={() => {}}
              onClear={handleClearClient}
              open={clientOpen}
              onOpenChange={setClientOpen}
              icon={Building2}
              tc={tc} isLight={isLight}>
              {filteredClients.length === 0
                ? <div className="px-4 py-6 text-center text-sm" style={{ color: tc.m }}>Sin coincidencias</div>
                : filteredClients.map(c => dropItem(
                    c.businessName, `NIT: ${c.nit ?? '—'}`, c.id === form.clientId,
                    () => handleSelectClient(c.id),
                  ))
              }
            </Combobox>
          </div>

          {/* Orden de servicio — aparece solo cuando hay cliente */}
          <AnimatePresence>
            {form.clientId && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <Label>Orden de servicio asociada</Label>
                {loadingOrders ? (
                  <div className="input-glass rounded-xl px-4 py-3 text-sm flex items-center gap-2" style={{ color: tc.m }}>
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Cargando órdenes...
                  </div>
                ) : orders.length === 0 ? (
                  <div className="input-glass rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                    style={{ color: tc.m, opacity: 0.7 }}>
                    <AlertCircle className="w-4 h-4" />
                    Este cliente no tiene órdenes de servicio activas
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Opción ninguna */}
                    <button type="button"
                      onClick={() => handleSelectOrder('')}
                      className="w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all border"
                      style={{
                        background: !form.serviceOrderId ? 'rgba(96,165,250,0.08)' : 'transparent',
                        borderColor: !form.serviceOrderId ? 'rgba(96,165,250,0.35)' : (isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)'),
                        color: !form.serviceOrderId ? '#60a5fa' : tc.m,
                      }}>
                      Sin OS específica
                    </button>
                    {orders.map(os => {
                      const active = os.id === form.serviceOrderId;
                      const sc = OS_STATUS_COLOR[os.status] ?? '#94a3b8';
                      return (
                        <button key={os.id} type="button"
                          onClick={() => handleSelectOrder(os.id)}
                          className="w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all border"
                          style={{
                            background: active ? 'rgba(96,165,250,0.10)' : 'transparent',
                            borderColor: active ? 'rgba(96,165,250,0.40)' : (isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)'),
                          }}>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold shrink-0" style={{ color: '#60a5fa' }}>{os.osNumber}</span>
                            <span className="flex-1 truncate text-sm" style={{ color: active ? '#60a5fa' : tc.p }}>{os.product}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                              style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}40` }}>
                              {OS_STATUS_LABEL[os.status] ?? os.status}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Bloque 2: Agente + Área + Ticket Rubi ─────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="rounded-2xl p-5 space-y-4" style={{ ...glass, position: 'relative', zIndex: 20 }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tc.m }}>Asignación</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Agente */}
            <div>
              <Label required>Agente responsable</Label>
              <Combobox
                placeholder="Buscar agente..."
                value={form.agenteId}
                displayValue={selectedAgent ? `${selectedAgent.firstName} ${selectedAgent.lastName}` : ''}
                onSearch={setAgentQ}
                onSelect={() => {}}
                onClear={() => { set('agenteId', ''); setAgentOpen(true); }}
                open={agentOpen}
                onOpenChange={setAgentOpen}
                icon={User}
                tc={tc} isLight={isLight}>
                {filteredAgents.length === 0
                  ? <div className="px-4 py-6 text-center text-sm" style={{ color: tc.m }}>Sin coincidencias</div>
                  : filteredAgents.map(a => dropItem(
                      `${a.firstName} ${a.lastName}`,
                      (a as any).jobTitle,
                      a.id === form.agenteId,
                      () => { set('agenteId', a.id); setAgentOpen(false); },
                    ))
                }
              </Combobox>
            </div>

            {/* Ticket Rubi */}
            <div>
              <Label>Ticket Rubi</Label>
              <div className="relative">
                <input
                  className="input-glass w-full rounded-xl px-3 py-2.5 text-sm pr-9"
                  placeholder="Ej: RUB-2026-0042"
                  value={form.ticketRubi}
                  onChange={e => set('ticketRubi', e.target.value)}
                  style={{
                    borderColor: rubiError ? 'rgba(248,113,113,0.60)' : rubiOk ? 'rgba(52,211,153,0.60)' : undefined,
                    boxShadow:   rubiError ? '0 0 0 2px rgba(248,113,113,0.15)' : rubiOk ? '0 0 0 2px rgba(52,211,153,0.12)' : undefined,
                  }} />
                {/* Indicador de estado */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {rubiChecking && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#94a3b8' }} />}
                  {!rubiChecking && rubiOk    && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#34d399' }} />}
                  {!rubiChecking && rubiError  && <AlertCircle  className="w-3.5 h-3.5" style={{ color: '#f87171' }} />}
                </div>
              </div>
              {/* Mensaje de error */}
              {rubiError && (
                <p className="text-xs mt-1.5 flex items-start gap-1.5" style={{ color: '#f87171' }}>
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  {rubiError}
                </p>
              )}
            </div>
          </div>

          {/* Área */}
          <div>
            <Label required>Área</Label>
            <div className="grid grid-cols-2 gap-3">
              {AREAS.map(area => {
                const active = form.area === area;
                const color  = area === 'Asistencial' ? '#34d399' : '#60a5fa';
                const bg     = area === 'Asistencial' ? 'rgba(52,211,153,0.12)' : 'rgba(96,165,250,0.12)';
                const ring   = area === 'Asistencial' ? 'rgba(52,211,153,0.35)' : 'rgba(96,165,250,0.35)';
                return (
                  <button key={area} type="button" onClick={() => set('area', area)}
                    className="py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                    style={{
                      background: active ? bg : 'transparent',
                      border: `1px solid ${active ? color : 'var(--border-subtle)'}`,
                      color: active ? color : tc.m,
                      boxShadow: active ? `0 0 0 3px ${ring}` : 'none',
                    }}>
                    {area === 'Asistencial' ? '🏥' : '💰'} {area}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* ── Bloque 3: Detalle del requerimiento ───────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="rounded-2xl p-5 space-y-4" style={{ ...glass, position: 'relative', zIndex: 10 }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tc.m }}>Detalle</p>

          {/* Título */}
          <div>
            <Label required>Título</Label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              placeholder="Ej: Módulo de facturación electrónica"
              value={form.titulo} onChange={e => set('titulo', e.target.value)} />
          </div>

          {/* Tipo + Prioridad */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Prioridad</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {PRIORIDADES.map(p => (
                  <button key={p.label} type="button" onClick={() => set('prioridad', p.label)}
                    className="py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: form.prioridad === p.label ? p.bg : 'transparent',
                      border: `1px solid ${form.prioridad === p.label ? p.color : 'var(--border-subtle)'}`,
                      color: form.prioridad === p.label ? p.color : tc.m,
                      boxShadow: form.prioridad === p.label ? `0 0 0 2px ${p.ring}` : 'none',
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Módulo — combobox de biblioteca */}
          <div>
            <Label>Módulo</Label>
            {hasProject && (
              <p className="text-[11px] mb-1.5" style={{ color: '#34d399' }}>
                ✓ Filtrando módulos del proyecto — la fase seleccionada creará una actividad en el plan de trabajo
              </p>
            )}
            <Combobox
              placeholder="Buscar módulo por código o nombre..."
              value={form.templateModuleId}
              displayValue={selectedModule ? `${selectedModule.code} — ${selectedModule.name}` : ''}
              onSearch={setModuleQ}
              onSelect={() => {}}
              onClear={handleClearModule}
              open={moduleOpen}
              onOpenChange={setModuleOpen}
              icon={Search}
              tc={tc} isLight={isLight}>
              {filteredModules.length === 0
                ? <div className="px-4 py-6 text-center text-sm" style={{ color: tc.m }}>
                    {modules.length === 0 ? 'No hay módulos en la biblioteca' : 'Sin coincidencias'}
                  </div>
                : filteredModules.map((m: any) => (
                    <button key={m.id} type="button"
                      onClick={() => handleSelectModule(m.id)}
                      className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors"
                      style={{ background: m.id === form.templateModuleId ? 'rgba(96,165,250,0.12)' : 'transparent' }}
                      onMouseEnter={e => { if (m.id !== form.templateModuleId) (e.currentTarget as HTMLElement).style.background = isLight ? 'rgba(30,60,120,0.05)' : 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { if (m.id !== form.templateModuleId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <span className="font-mono text-xs px-2 py-0.5 rounded shrink-0"
                        style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                        {m.code}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate"
                          style={{ color: m.id === form.templateModuleId ? '#60a5fa' : tc.p }}>
                          {m.name}
                        </p>
                        {m._count?.phases != null && (
                          <p className="text-[11px] mt-0.5" style={{ color: tc.m }}>
                            {m._count.phases} fase{m._count.phases !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      {m.id === form.templateModuleId && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>✓</span>
                      )}
                    </button>
                  ))
              }
            </Combobox>
          </div>

          {/* Fases del módulo — aparece al seleccionar módulo */}
          <AnimatePresence>
            {form.templateModuleId && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <Label>Fase</Label>
                {loadingPhases ? (
                  <div className="input-glass rounded-xl px-4 py-3 text-sm flex items-center gap-2" style={{ color: tc.m }}>
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Cargando fases...
                  </div>
                ) : phases.length === 0 ? (
                  <div className="input-glass rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                    style={{ color: tc.m, opacity: 0.7 }}>
                    <AlertCircle className="w-4 h-4" />
                    Este módulo no tiene fases configuradas
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {phases.map((ph: any, idx: number) => {
                      const active  = ph.id === form.templatePhaseId;
                      const color   = ph.color ?? '#60a5fa';
                      const isFirst = idx === 0;
                      return (
                        <button key={ph.id} type="button"
                          onClick={() => set('templatePhaseId', ph.id)}
                          className="relative px-3 py-2.5 rounded-xl text-left transition-all"
                          style={{
                            background: active ? `${color}18` : 'transparent',
                            border: `1px solid ${active ? `${color}60` : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)')}`,
                            boxShadow: active ? `0 0 0 2px ${color}30` : 'none',
                          }}>
                          {/* Dot de color de fase */}
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: color }} />
                            <span className="text-xs font-bold truncate"
                              style={{ color: active ? color : tc.p }}>
                              {ph.name}
                            </span>
                          </div>
                          {isFirst && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide"
                              style={{ color: active ? color : tc.m, opacity: 0.8 }}>
                              predeterminado
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Descripción */}
          <div>
            <Label required>Descripción</Label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={4}
              placeholder="Describe el requerimiento en detalle: contexto, objetivo, impacto esperado..."
              value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
          </div>

          {/* Criterios de aceptación */}
          <div>
            <Label>Criterios de aceptación</Label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
              placeholder="¿Cómo se valida que el requerimiento está cumplido?"
              value={form.criteriosAceptacion} onChange={e => set('criteriosAceptacion', e.target.value)} />
          </div>
        </motion.div>

        {/* Nota informativa */}
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
          style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.20)' }}>
          <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs" style={{ color: tc.s }}>
            Los requerimientos quedan en estado <strong>Elaborado</strong>. Desde{' '}
            <button type="button" onClick={() => router.push('/requerimientos/priorizar')}
              className="text-blue-400 underline">Priorizar Requerimientos</button>{' '}
            puedes gestionarlos y cambiar su estado.
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-3 justify-end">
          <button type="button"
            onClick={() => { setForm(EMPTY); setOrders([]); setPhases([]); }}
            className="px-5 py-2.5 rounded-xl text-sm transition-colors"
            style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>
            Limpiar
          </button>
          {can('tickets.nuevo') && (
            <motion.button type="submit" disabled={saving || !!rubiError || rubiChecking}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50"
              title={rubiError ? 'Corrige el Ticket Rubi antes de guardar' : rubiChecking ? 'Verificando Ticket Rubi...' : undefined}>
              {saving
                ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Registrando...</>
                : rubiChecking
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                  : <><ClipboardPlus className="w-4 h-4" /> Registrar requerimiento</>}
            </motion.button>
          )}
        </div>
      </form>

      {/* ── Modal cargue masivo ─────────────────────────────────────────────── */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: isLight ? '#fff' : '#0f172a',
              border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.12)'}`,
              boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
              <div>
                <h3 className="font-bold text-base flex items-center gap-2" style={{ color: tc.p }}>
                  <FileSpreadsheet className="w-4 h-4 text-violet-400" />
                  Vista previa — Cargue masivo
                </h3>
                <p className="text-xs mt-0.5" style={{ color: tc.m }}>
                  {bulkRows.filter(r => r.valid).length} fila{bulkRows.filter(r => r.valid).length !== 1 ? 's' : ''} válida{bulkRows.filter(r => r.valid).length !== 1 ? 's' : ''} ·{' '}
                  {bulkRows.filter(r => !r.valid).length} con error · {bulkRows.length} total
                </p>
              </div>
              <button onClick={() => { setShowBulk(false); setBulkRows([]); setBulkDone(null); setBulkProgress(0); }}
                className="p-2 rounded-lg transition-colors" style={{ color: tc.m }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resultado final */}
            {bulkDone && (
              <div className="px-6 py-3 flex items-center gap-4 border-b"
                style={{ borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', background: 'rgba(52,211,153,0.06)' }}>
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-sm font-medium" style={{ color: tc.p }}>
                  Importación completada —{' '}
                  <span style={{ color: '#34d399' }}>{bulkDone.exitosos} exitoso{bulkDone.exitosos !== 1 ? 's' : ''}</span>
                  {bulkDone.fallidos > 0 && <>, <span style={{ color: '#f87171' }}>{bulkDone.fallidos} fallido{bulkDone.fallidos !== 1 ? 's' : ''}</span></>}
                </p>
              </div>
            )}

            {/* Barra de progreso */}
            {bulkImporting && (
              <div className="px-6 py-3 border-b"
                style={{ borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: tc.m }}>Importando...</span>
                  <span className="text-xs font-mono" style={{ color: '#a78bfa' }}>{bulkProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
                  <motion.div className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', width: `${bulkProgress}%` }}
                    transition={{ duration: 0.2 }} />
                </div>
              </div>
            )}

            {/* Tabla de filas */}
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)'}` }}>
                    {['Fila', 'Estado', 'Título', 'Cliente', 'Área', 'Agente', 'Prioridad', 'Ticket Rubi'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: tc.m }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map(row => (
                    <tr key={row.fila}
                      style={{ borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}` }}>
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: tc.m }}>{row.fila}</td>
                      <td className="px-3 py-2.5">
                        {row.valid
                          ? <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#34d399' }}><CheckCircle2 className="w-3.5 h-3.5" /> Válida</span>
                          : (
                            <div>
                              <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#f87171' }}><TriangleAlert className="w-3.5 h-3.5" /> Error</span>
                              {row.errors.map((e, i) => (
                                <p key={i} className="text-[10px] mt-0.5 leading-tight" style={{ color: '#f87171' }}>· {e}</p>
                              ))}
                            </div>
                          )}
                      </td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <p className="text-xs font-medium truncate" style={{ color: tc.p }}>{row.titulo || '—'}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: tc.s }}>{row.nitCliente || '—'}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: tc.s }}>{row.areaSel || '—'}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: tc.s }}>{row.agenteNombre || '—'}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: tc.s }}>{row.prioridad || '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: '#a78bfa' }}>{row.ticketRubi || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t"
              style={{ borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-colors"
                style={{ border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`, color: tc.s }}>
                <Upload className="w-3.5 h-3.5" /> Cargar otro archivo
              </button>
              {!bulkDone && (
                <button onClick={handleBulkImport}
                  disabled={bulkImporting || bulkRows.filter(r => r.valid).length === 0}
                  className="btn-primary flex items-center gap-2 px-5 py-2 rounded-xl text-sm text-white font-semibold disabled:opacity-40">
                  {bulkImporting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                    : <><CheckCircle2 className="w-4 h-4" /> Importar {bulkRows.filter(r => r.valid).length} requerimiento{bulkRows.filter(r => r.valid).length !== 1 ? 's' : ''}</>}
                </button>
              )}
              {bulkDone && (
                <button onClick={() => router.push('/requerimientos/priorizar')}
                  className="btn-primary flex items-center gap-2 px-5 py-2 rounded-xl text-sm text-white font-semibold">
                  Ver en priorización →
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
