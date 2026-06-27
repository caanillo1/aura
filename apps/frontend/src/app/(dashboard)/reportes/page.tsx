'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  BarChart3, Download, Loader2, Search, RefreshCw,
  FileText, Layers, GraduationCap, ClipboardList,
  Building2, CalendarDays, ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { reportesApi, clientsApi, serviceOrdersApi, companyApi } from '@/lib/api';
import type { Client, ServiceOrder, Company } from '@/types';
import { ClientCombobox } from '@/components/ui/ClientCombobox';

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—';

const diasDesde = (d: string) =>
  Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

const OS_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:  { label: 'Pendiente',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  en_curso:   { label: 'En curso',   color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  suspendida: { label: 'Suspendida', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  completada: { label: 'Completada', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  cancelada:  { label: 'Cancelada',  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const PROJ_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  activo:     { label: 'Activo',     color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  pausado:    { label: 'Pausado',    color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  completado: { label: 'Completado', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  cancelado:  { label: 'Cancelado',  color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  en_riesgo:  { label: 'En riesgo',  color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
};

const PRIORIDAD: Record<string, { color: string; bg: string }> = {
  'Crítico': { color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  'Alta':    { color: '#fb923c', bg: 'rgba(251,146,60,0.15)'  },
  'Media':   { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  },
  'Baja':    { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)'  },
};

function StatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, background: bg, border: `1px solid ${color}40` }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {label}
    </span>
  );
}

function exportExcel(rows: Record<string, any>[], sheetName: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ── Componente principal ───────────────────────────────────────────────────────

type Tab = 'ordenes' | 'proyectos' | 'capacitaciones' | 'requerimientos';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'ordenes',        label: 'Órdenes de Servicio',    icon: FileText      },
  { key: 'proyectos',      label: 'Proyectos',              icon: Layers        },
  { key: 'capacitaciones', label: 'Capacitaciones',         icon: GraduationCap },
  { key: 'requerimientos', label: 'Requerimientos',         icon: ClipboardList },
];

export default function ReportesPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const tc = {
    text:   isLight ? '#1e3a5f' : '#e2e8f0',
    muted:  isLight ? '#64748b' : '#94a3b8',
    card:   isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.04)',
    border: isLight ? 'rgba(30,60,120,0.12)'   : 'rgba(255,255,255,0.08)',
    th:     isLight ? 'rgba(30,60,120,0.06)'   : 'rgba(255,255,255,0.05)',
  };

  const [tab, setTab] = useState<Tab>('ordenes');

  // Catálogos compartidos
  const [clients,     setClients]     = useState<Client[]>([]);
  const [osList,      setOsList]      = useState<ServiceOrder[]>([]);
  const [company,     setCompany]     = useState<Company | null>(null);
  const [loadingCats, setLoadingCats] = useState(true);

  // ── Estado por tab ──────────────────────────────────────────────────────────
  const [ordenesData,     setOrdenesData]     = useState<any[]>([]);
  const [ordenesLoading,  setOrdenesLoading]  = useState(false);
  const [ordenesFilter,   setOrdenesFilter]   = useState({ estado: '', clientId: '', fechaDesde: '', fechaHasta: '' });

  const [proyectosData,    setProyectosData]    = useState<any[]>([]);
  const [proyectosLoading, setProyectosLoading] = useState(false);
  const [proyectosFilter,  setProyectosFilter]  = useState({ status: '', clientId: '' });

  const [capData,    setCapData]    = useState<any[]>([]);
  const [capLoading, setCapLoading] = useState(false);
  const [capFilter,  setCapFilter]  = useState({ clientId: '', serviceOrderId: '' });

  const [reqData,    setReqData]    = useState<any[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqFilter,  setReqFilter]  = useState({ estadoActual: '', prioridad: '', area: '', clientId: '', fechaDesde: '', fechaHasta: '' });

  // ── Catálogos ───────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      clientsApi.list({ limit: 300 }),
      serviceOrdersApi.list({ limit: 300 }),
      companyApi.get(),
    ]).then(([c, o, comp]) => {
      setClients(c.data ?? c);
      setOsList(o.data ?? o);
      setCompany(comp);
    }).catch(() => {}).finally(() => setLoadingCats(false));
  }, []);

  // ── Loaders ─────────────────────────────────────────────────────────────────
  const loadOrdenes = useCallback(async () => {
    setOrdenesLoading(true);
    try {
      const p: any = {};
      if (ordenesFilter.estado)    p.estado    = ordenesFilter.estado;
      if (ordenesFilter.clientId)  p.clientId  = ordenesFilter.clientId;
      if (ordenesFilter.fechaDesde) p.fechaDesde = ordenesFilter.fechaDesde;
      if (ordenesFilter.fechaHasta) p.fechaHasta = ordenesFilter.fechaHasta;
      setOrdenesData(await reportesApi.ordenes(p));
    } catch { toast.error('Error al cargar reporte de órdenes'); }
    finally { setOrdenesLoading(false); }
  }, [ordenesFilter]);

  const loadProyectos = useCallback(async () => {
    setProyectosLoading(true);
    try {
      const p: any = {};
      if (proyectosFilter.status)   p.status   = proyectosFilter.status;
      if (proyectosFilter.clientId) p.clientId = proyectosFilter.clientId;
      setProyectosData(await reportesApi.proyectos(p));
    } catch { toast.error('Error al cargar reporte de proyectos'); }
    finally { setProyectosLoading(false); }
  }, [proyectosFilter]);

  const loadCap = useCallback(async () => {
    setCapLoading(true);
    try {
      const p: any = {};
      if (capFilter.clientId)      p.clientId      = capFilter.clientId;
      if (capFilter.serviceOrderId) p.serviceOrderId = capFilter.serviceOrderId;
      setCapData(await reportesApi.capacitaciones(p));
    } catch { toast.error('Error al cargar reporte de capacitaciones'); }
    finally { setCapLoading(false); }
  }, [capFilter]);

  const loadReq = useCallback(async () => {
    setReqLoading(true);
    try {
      const p: any = {};
      if (reqFilter.estadoActual) p.estadoActual = reqFilter.estadoActual;
      if (reqFilter.prioridad)    p.prioridad    = reqFilter.prioridad;
      if (reqFilter.area)         p.area         = reqFilter.area;
      if (reqFilter.clientId)     p.clientId     = reqFilter.clientId;
      if (reqFilter.fechaDesde)   p.fechaDesde   = reqFilter.fechaDesde;
      if (reqFilter.fechaHasta)   p.fechaHasta   = reqFilter.fechaHasta;
      setReqData(await reportesApi.requerimientos(p));
    } catch { toast.error('Error al cargar reporte de requerimientos'); }
    finally { setReqLoading(false); }
  }, [reqFilter]);

  // Cargar datos cuando cambian filtros
  useEffect(() => { if (tab === 'ordenes')        loadOrdenes();        }, [tab, loadOrdenes]);
  useEffect(() => { if (tab === 'proyectos')      loadProyectos();      }, [tab, loadProyectos]);
  useEffect(() => { if (tab === 'capacitaciones') loadCap();            }, [tab, loadCap]);
  useEffect(() => { if (tab === 'requerimientos') loadReq();            }, [tab, loadReq]);

  // ── PDF helper ───────────────────────────────────────────────────────────────
  const generateReportePDF = async (config: {
    title: string;
    columns: Array<{ header: string; width: number }>;
    rows: string[][];
    filterLabels: string[];
    filename: string;
  }) => {
    const { default: jsPDF } = await import('jspdf');
    const primary = company?.primaryColor ?? '#6d28d9';
    const hex2rgb = (h: string): [number, number, number] => {
      const c = h.replace('#', '');
      return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
    };
    const [pr, pg, pb] = hex2rgb(primary);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - 2 * margin;

    const totalW = config.columns.reduce((s, c) => s + c.width, 0);
    const colWidths = config.columns.map(c => (c.width / totalW) * contentW);
    const rowH = 6.5;
    const hdrH = 8;

    // Líneas de datos de empresa para encabezado dinámico
    const companyInfoLines: string[] = [`NIT: ${company?.nit ?? ''}`];
    const addrParts = [company?.address, company?.city].filter(Boolean) as string[];
    if (addrParts.length) companyInfoLines.push(addrParts.join(' · '));
    const contactParts = [
      company?.phone ? `Tel: ${company.phone}` : null,
      company?.email ?? null,
    ].filter((v): v is string => Boolean(v));
    if (contactParts.length) companyInfoLines.push(contactParts.join('  ·  '));

    const dividerY = 18 + (companyInfoLines.length - 1) * 4.5 + 5;
    const tableTop = Math.ceil(dividerY) + 8;
    let page = 1;

    const drawPageShell = () => {
      // Barra superior con color empresa
      doc.setFillColor(pr, pg, pb);
      doc.rect(0, 0, pageW, 5.5, 'F');

      // Logo
      let nameX = margin;
      if (company?.logoData) {
        try { doc.addImage(company.logoData, 'PNG', margin, 7, 18, 14, undefined, 'FAST'); nameX = margin + 22; } catch {}
      }

      // Nombre empresa
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(pr, pg, pb);
      doc.text(company?.name ?? '', nameX, 13);

      // Datos de la empresa: NIT, dirección, teléfono/email
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
      companyInfoLines.forEach((line, i) => {
        doc.text(line, nameX, 18 + i * 4.5);
      });

      // Título + fecha + filtros (derecha)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 41, 59);
      doc.text(config.title, pageW - margin, 13, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
      const dateStr = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });
      doc.text(`Generado: ${dateStr}`, pageW - margin, 18, { align: 'right' });
      if (config.filterLabels.length) {
        doc.text(config.filterLabels.join(' · '), pageW - margin, 22.5, { align: 'right' });
      }

      // Línea divisora debajo del bloque de empresa
      doc.setDrawColor(pr, pg, pb); doc.setLineWidth(0.4);
      doc.line(margin, dividerY, pageW - margin, dividerY);

      // Pie de página
      doc.setFontSize(7); doc.setTextColor(148, 163, 184);
      doc.text(`${config.title} — Página ${page}`, margin, pageH - 4);
      doc.text(`${config.rows.length} registro${config.rows.length !== 1 ? 's' : ''}`, pageW - margin, pageH - 4, { align: 'right' });
    };

    const drawTableHeader = (y: number) => {
      const lr = Math.min(255, Math.round(pr * 0.08 + 240));
      const lg = Math.min(255, Math.round(pg * 0.08 + 240));
      const lb = Math.min(255, Math.round(pb * 0.08 + 240));
      doc.setFillColor(lr, lg, lb);
      doc.rect(margin, y, contentW, hdrH, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(pr, pg, pb);
      let x = margin;
      config.columns.forEach((col, i) => {
        doc.text(col.header, x + 2, y + 5.5, { maxWidth: colWidths[i] - 4 });
        x += colWidths[i];
      });
      doc.setDrawColor(pr, pg, pb); doc.setLineWidth(0.3);
      doc.line(margin, y + hdrH, margin + contentW, y + hdrH);
      return y + hdrH;
    };

    drawPageShell();
    let y = drawTableHeader(tableTop);

    config.rows.forEach((row, ri) => {
      if (y + rowH > pageH - 12) {
        doc.addPage(); page++; drawPageShell(); y = drawTableHeader(tableTop);
      }
      if (ri % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(margin, y, contentW, rowH, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(51, 65, 85);
      let x = margin;
      row.forEach((cell, ci) => {
        doc.text(String(cell ?? '—'), x + 2, y + 4.5, { maxWidth: colWidths[ci] - 4 });
        x += colWidths[ci];
      });
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.1);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);
      y += rowH;
    });

    doc.save(config.filename);
  };

  // ── PDF Exports ──────────────────────────────────────────────────────────────
  const exportOrdenesPDF = () => {
    const fl: string[] = [];
    if (ordenesFilter.estado)    fl.push(`Estado: ${OS_STATUS[ordenesFilter.estado]?.label ?? ordenesFilter.estado}`);
    if (ordenesFilter.clientId)  fl.push(`Cliente: ${clients.find(c => c.id === ordenesFilter.clientId)?.businessName ?? ''}`);
    if (ordenesFilter.fechaDesde) fl.push(`Desde: ${fmt(ordenesFilter.fechaDesde)}`);
    if (ordenesFilter.fechaHasta) fl.push(`Hasta: ${fmt(ordenesFilter.fechaHasta)}`);
    return generateReportePDF({
      title: 'Órdenes de Servicio',
      columns: [
        { header: '# OS', width: 18 }, { header: 'Cliente', width: 38 }, { header: 'Producto', width: 46 },
        { header: 'Estado', width: 20 }, { header: 'Inicio', width: 20 }, { header: 'Fin', width: 20 },
        { header: 'Días', width: 12 }, { header: 'Avance', width: 14 },
        { header: 'Líder Asist.', width: 30 }, { header: 'Líder Fin.', width: 30 }, { header: 'Implementadores', width: 42 },
      ],
      rows: ordenesData.map(o => [
        o.osNumber, o.client?.businessName ?? '—', o.product,
        OS_STATUS[o.status]?.label ?? o.status, fmt(o.startDate), fmt(o.endDate),
        String(o.durationDays ?? '—'), o.project ? `${Number(o.project.progressPercent).toFixed(0)}%` : '—',
        o.clinicalLeader  ? `${o.clinicalLeader.firstName} ${o.clinicalLeader.lastName}` : '—',
        o.financialLeader ? `${o.financialLeader.firstName} ${o.financialLeader.lastName}` : '—',
        (o.implementers ?? []).map((i: any) => `${i.user.firstName} ${i.user.lastName}`).join(', ') || '—',
      ]),
      filterLabels: fl,
      filename: `reporte_ordenes_${new Date().toISOString().slice(0,10)}.pdf`,
    });
  };

  const exportProyectosPDF = () => {
    const fl: string[] = [];
    if (proyectosFilter.status)   fl.push(`Estado: ${PROJ_STATUS[proyectosFilter.status]?.label ?? proyectosFilter.status}`);
    if (proyectosFilter.clientId) fl.push(`Cliente: ${clients.find(c => c.id === proyectosFilter.clientId)?.businessName ?? ''}`);
    return generateReportePDF({
      title: 'Proyectos de Implementación',
      columns: [
        { header: '# OS', width: 20 }, { header: 'Cliente', width: 42 }, { header: 'Proyecto', width: 58 },
        { header: 'Estado', width: 22 }, { header: 'Avance', width: 16 }, { header: 'Módulos', width: 16 },
        { header: 'Actividades', width: 22 }, { header: 'Inicio', width: 22 }, { header: 'Fin', width: 22 },
      ],
      rows: proyectosData.map(p => {
        const totalActs = (p.modules ?? []).reduce((s: number, m: any) =>
          s + (m.phases ?? []).reduce((s2: number, ph: any) => s2 + (ph.activities ?? []).length, 0), 0);
        const doneActs = (p.modules ?? []).reduce((s: number, m: any) =>
          s + (m.phases ?? []).reduce((s2: number, ph: any) =>
            s2 + (ph.activities ?? []).filter((a: any) => a.status === 'completada').length, 0), 0);
        return [
          p.serviceOrder?.osNumber ?? '—', p.serviceOrder?.client?.businessName ?? '—', p.name,
          PROJ_STATUS[p.status]?.label ?? p.status, `${Number(p.progressPercent).toFixed(0)}%`,
          String((p.modules ?? []).length), `${doneActs}/${totalActs}`,
          fmt(p.serviceOrder?.startDate), fmt(p.serviceOrder?.endDate),
        ];
      }),
      filterLabels: fl,
      filename: `reporte_proyectos_${new Date().toISOString().slice(0,10)}.pdf`,
    });
  };

  const exportCapPDF = () => {
    const fl: string[] = [];
    if (capFilter.clientId)       fl.push(`Cliente: ${clients.find(c => c.id === capFilter.clientId)?.businessName ?? ''}`);
    if (capFilter.serviceOrderId) fl.push(`OS: ${osList.find(o => o.id === capFilter.serviceOrderId)?.osNumber ?? ''}`);
    const rows: string[][] = [];
    capData.forEach(acta => {
      (acta.firmantes ?? []).forEach((f: any) => {
        rows.push([
          acta.project?.serviceOrder?.osNumber ?? '—',
          acta.project?.serviceOrder?.client?.businessName ?? '—',
          acta.modulo?.name ?? '—', acta.numero ?? '—', fmt(acta.fecha),
          f.nombre ?? '—', f.cargo ?? '—', f.firmado ? 'Firmado' : 'Pendiente',
        ]);
      });
      if (!(acta.firmantes ?? []).length) {
        rows.push([
          acta.project?.serviceOrder?.osNumber ?? '—',
          acta.project?.serviceOrder?.client?.businessName ?? '—',
          acta.modulo?.name ?? '—', acta.numero ?? '—', fmt(acta.fecha),
          '—', '—', 'Sin firmantes',
        ]);
      }
    });
    return generateReportePDF({
      title: 'Reporte de Capacitaciones',
      columns: [
        { header: '# OS', width: 20 }, { header: 'Cliente', width: 40 }, { header: 'Módulo', width: 35 },
        { header: '# Acta', width: 20 }, { header: 'Fecha', width: 22 }, { header: 'Participante', width: 44 },
        { header: 'Cargo', width: 35 }, { header: 'Estado', width: 20 },
      ],
      rows,
      filterLabels: fl,
      filename: `reporte_capacitaciones_${new Date().toISOString().slice(0,10)}.pdf`,
    });
  };

  const exportReqPDF = () => {
    const fl: string[] = [];
    if (reqFilter.estadoActual) fl.push(`Estado: ${reqFilter.estadoActual}`);
    if (reqFilter.prioridad)    fl.push(`Prioridad: ${reqFilter.prioridad}`);
    if (reqFilter.area)         fl.push(`Área: ${reqFilter.area}`);
    if (reqFilter.clientId)     fl.push(`Cliente: ${clients.find(c => c.id === reqFilter.clientId)?.businessName ?? ''}`);
    if (reqFilter.fechaDesde)   fl.push(`Desde: ${fmt(reqFilter.fechaDesde)}`);
    if (reqFilter.fechaHasta)   fl.push(`Hasta: ${fmt(reqFilter.fechaHasta)}`);
    return generateReportePDF({
      title: 'Reporte de Requerimientos',
      columns: [
        { header: '#', width: 18 }, { header: 'Título', width: 55 }, { header: 'Cliente', width: 34 },
        { header: 'OS', width: 16 }, { header: 'Módulo', width: 28 }, { header: 'Área', width: 18 },
        { header: 'Prioridad', width: 16 }, { header: 'Estado', width: 20 }, { header: 'Agente', width: 28 },
        { header: 'Fecha', width: 20 }, { header: 'Días', width: 10 }, { header: 'Gest.', width: 10 },
      ],
      rows: reqData.map(r => [
        r.numero ?? '—', r.titulo, r.client?.businessName ?? '—',
        r.serviceOrder?.osNumber ?? '—', r.templateModule?.name ?? '—', r.area ?? '—',
        r.prioridad ?? '—', r.estadoActual ?? '—',
        r.agente ? `${r.agente.firstName} ${r.agente.lastName}` : '—',
        fmt(r.createdAt), String(diasDesde(r.createdAt)), String(r._count?.gestiones ?? 0),
      ]),
      filterLabels: fl,
      filename: `reporte_requerimientos_${new Date().toISOString().slice(0,10)}.pdf`,
    });
  };

  // ── Exports ─────────────────────────────────────────────────────────────────
  const exportOrdenes = () => {
    const rows = ordenesData.map(o => ({
      '# OS':              o.osNumber,
      'Cliente':           o.client?.businessName ?? '—',
      'NIT':               o.client?.nit ?? '—',
      'Producto':          o.product,
      'Estado':            OS_STATUS[o.status]?.label ?? o.status,
      'Inicio':            fmt(o.startDate),
      'Fin':               fmt(o.endDate),
      'Días':              o.durationDays ?? '—',
      'Progreso %':        o.project ? `${Number(o.project.progressPercent).toFixed(1)}%` : '—',
      'Líder Asistencial': o.clinicalLeader  ? `${o.clinicalLeader.firstName} ${o.clinicalLeader.lastName}` : '—',
      'Líder Financiero':  o.financialLeader ? `${o.financialLeader.firstName} ${o.financialLeader.lastName}` : '—',
      'Implementadores':   (o.implementers ?? []).map((i: any) => `${i.user.firstName} ${i.user.lastName}`).join(', ') || '—',
    }));
    exportExcel(rows, 'Órdenes de Servicio', `reporte_ordenes_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportProyectos = () => {
    const rows = proyectosData.map(p => {
      const totalActs = (p.modules ?? []).reduce((s: number, m: any) =>
        s + (m.phases ?? []).reduce((s2: number, ph: any) => s2 + (ph.activities ?? []).length, 0), 0);
      const doneActs = (p.modules ?? []).reduce((s: number, m: any) =>
        s + (m.phases ?? []).reduce((s2: number, ph: any) =>
          s2 + (ph.activities ?? []).filter((a: any) => a.status === 'completada').length, 0), 0);
      return {
        '# OS':           p.serviceOrder?.osNumber ?? '—',
        'Cliente':        p.serviceOrder?.client?.businessName ?? '—',
        'Proyecto':       p.name,
        'Estado':         PROJ_STATUS[p.status]?.label ?? p.status,
        'Progreso %':     `${Number(p.progressPercent).toFixed(1)}%`,
        'Módulos':        (p.modules ?? []).length,
        'Actividades':    `${doneActs}/${totalActs}`,
        'Inicio':         fmt(p.serviceOrder?.startDate),
        'Fin':            fmt(p.serviceOrder?.endDate),
      };
    });
    exportExcel(rows, 'Proyectos', `reporte_proyectos_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportCap = () => {
    const rows: any[] = [];
    capData.forEach(acta => {
      (acta.firmantes ?? []).forEach((f: any) => {
        rows.push({
          '# OS':       acta.project?.serviceOrder?.osNumber ?? '—',
          'Cliente':    acta.project?.serviceOrder?.client?.businessName ?? '—',
          'Módulo':     acta.modulo?.name ?? '—',
          '# Acta':     acta.numero ?? '—',
          'Fecha':      fmt(acta.fecha),
          'Participante': f.nombre ?? '—',
          'Cargo':      f.cargo ?? '—',
          'Estado':     f.firmado ? 'Firmado' : 'Pendiente',
          'Fecha firma':f.firmaFecha ? fmt(f.firmaFecha) : '—',
        });
      });
    });
    if (!rows.length) return toast.error('Sin datos para exportar');
    exportExcel(rows, 'Capacitaciones', `reporte_capacitaciones_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportReq = () => {
    const rows = reqData.map(r => ({
      '#':           r.numero ?? '—',
      'Título':      r.titulo,
      'Cliente':     r.client?.businessName ?? '—',
      'OS':          r.serviceOrder?.osNumber ?? '—',
      'Módulo':      r.templateModule?.name ?? '—',
      'Fase':        r.templatePhase?.name ?? '—',
      'Área':        r.area ?? '—',
      'Prioridad':   r.prioridad ?? '—',
      'Estado':      r.estadoActual ?? '—',
      'Agente':      r.agente ? `${r.agente.firstName} ${r.agente.lastName}` : '—',
      'Fecha':       fmt(r.createdAt),
      'Días abierto': diasDesde(r.createdAt),
      '# Gestiones': r._count?.gestiones ?? 0,
    }));
    exportExcel(rows, 'Requerimientos', `reporte_requerimientos_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // ── Shared UI helpers ────────────────────────────────────────────────────────
  const SelectFilter = ({ value, onChange, placeholder, children }: {
    value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode;
  }) => (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="input-glass rounded-xl pl-3 pr-8 py-2 text-sm appearance-none min-w-36"
        style={{ color: value ? tc.text : tc.muted }}>
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: tc.muted }} />
    </div>
  );

  const ClientSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <ClientCombobox
      clients={clients.map(c => ({ id: c.id, businessName: c.businessName }))}
      value={value}
      onChange={onChange}
      nullLabel="Todos los clientes"
      placeholder="Buscar cliente…"
      className="min-w-[180px]"
    />
  );

  const TableWrap = ({ loading, empty, children }: { loading: boolean; empty: boolean; children: React.ReactNode }) => {
    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-violet-400" /></div>;
    if (empty)   return (
      <div className="text-center py-16" style={{ color: tc.muted }}>
        <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-25" />
        <p className="text-sm">Sin registros para los filtros seleccionados</p>
      </div>
    );
    return <>{children}</>;
  };

  const tableStyle = { borderColor: tc.border };
  const thStyle = { background: tc.th, color: tc.muted };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tc.text }}>Reportes</h1>
          <p className="text-sm mt-0.5" style={{ color: tc.muted }}>Consulta y exporta información operativa en Excel</p>
        </div>
        <a href="/reportes/informe-ejecutivo"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: 'rgba(14,165,233,0.12)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.25)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.20)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.12)'; }}>
          <BarChart3 className="w-4 h-4" /> Informe Ejecutivo General
        </a>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl w-fit" style={{ background: tc.card, border: `1px solid ${tc.border}` }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'btn-primary text-white' : ''}`}
            style={tab !== key ? { color: tc.muted } : {}}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── TAB: ÓRDENES DE SERVICIO ──────────────────────────────────────────── */}
      {tab === 'ordenes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SelectFilter value={ordenesFilter.estado} onChange={v => setOrdenesFilter(p => ({ ...p, estado: v }))} placeholder="Todos los estados">
              {Object.entries(OS_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </SelectFilter>
            <ClientSelect value={ordenesFilter.clientId} onChange={v => setOrdenesFilter(p => ({ ...p, clientId: v }))} />
            <div className="flex items-center gap-2 input-glass rounded-xl px-3 py-2">
              <CalendarDays className="w-4 h-4 shrink-0" style={{ color: tc.muted }} />
              <input type="date" value={ordenesFilter.fechaDesde} onChange={e => setOrdenesFilter(p => ({ ...p, fechaDesde: e.target.value }))}
                className="bg-transparent text-sm outline-none w-28" style={{ color: tc.text, colorScheme: 'dark' }} title="Desde" />
              <span className="text-xs" style={{ color: tc.muted }}>—</span>
              <input type="date" value={ordenesFilter.fechaHasta} onChange={e => setOrdenesFilter(p => ({ ...p, fechaHasta: e.target.value }))}
                className="bg-transparent text-sm outline-none w-28" style={{ color: tc.text, colorScheme: 'dark' }} title="Hasta" />
            </div>
            <button onClick={loadOrdenes} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors" title="Actualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm" style={{ color: tc.muted }}>{ordenesData.length} registro{ordenesData.length !== 1 ? 's' : ''}</span>
              <button onClick={exportOrdenesPDF} disabled={!ordenesData.length}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}>
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button onClick={exportOrdenes} disabled={!ordenesData.length}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-primary disabled:opacity-40">
                <Download className="w-4 h-4" /> Excel
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${tc.border}`, background: tc.card }}>
            <div className="overflow-x-auto">
              <TableWrap loading={ordenesLoading} empty={!ordenesData.length}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={thStyle}>
                      {['# OS','Cliente','Producto','Estado','Inicio','Fin','Días','Avance','Líder Asistencial','Líder Financiero','Implementadores'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ordenesData.map((o, i) => {
                      const ss = OS_STATUS[o.status] ?? OS_STATUS.pendiente;
                      return (
                        <tr key={o.id} className="border-t hover:bg-white/4 transition-colors" style={tableStyle}>
                          <td className="px-4 py-3 font-mono font-bold text-xs" style={{ color: '#60a5fa' }}>{o.osNumber}</td>
                          <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: tc.text }}>{o.client?.businessName ?? '—'}</td>
                          <td className="px-4 py-3 max-w-48 truncate" style={{ color: tc.text }}>{o.product}</td>
                          <td className="px-4 py-3"><StatusBadge {...ss} /></td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>{fmt(o.startDate)}</td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>{fmt(o.endDate)}</td>
                          <td className="px-4 py-3 text-center" style={{ color: tc.muted }}>{o.durationDays ?? '—'}</td>
                          <td className="px-4 py-3">
                            {o.project ? (
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${Number(o.project.progressPercent)}%`, background: '#a78bfa' }} />
                                </div>
                                <span className="text-xs" style={{ color: tc.muted }}>{Number(o.project.progressPercent).toFixed(0)}%</span>
                              </div>
                            ) : <span style={{ color: tc.muted }}>—</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>
                            {o.clinicalLeader ? `${o.clinicalLeader.firstName} ${o.clinicalLeader.lastName}` : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>
                            {o.financialLeader ? `${o.financialLeader.firstName} ${o.financialLeader.lastName}` : '—'}
                          </td>
                          <td className="px-4 py-3" style={{ color: tc.muted }}>
                            {(o.implementers ?? []).length > 0
                              ? (o.implementers as any[]).map((imp: any) => `${imp.user.firstName} ${imp.user.lastName}`).join(', ')
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: PROYECTOS ────────────────────────────────────────────────────── */}
      {tab === 'proyectos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SelectFilter value={proyectosFilter.status} onChange={v => setProyectosFilter(p => ({ ...p, status: v }))} placeholder="Todos los estados">
              {Object.entries(PROJ_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </SelectFilter>
            <ClientSelect value={proyectosFilter.clientId} onChange={v => setProyectosFilter(p => ({ ...p, clientId: v }))} />
            <button onClick={loadProyectos} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors" title="Actualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm" style={{ color: tc.muted }}>{proyectosData.length} registro{proyectosData.length !== 1 ? 's' : ''}</span>
              <button onClick={exportProyectosPDF} disabled={!proyectosData.length}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}>
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button onClick={exportProyectos} disabled={!proyectosData.length}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-primary disabled:opacity-40">
                <Download className="w-4 h-4" /> Excel
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${tc.border}`, background: tc.card }}>
            <div className="overflow-x-auto">
              <TableWrap loading={proyectosLoading} empty={!proyectosData.length}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={thStyle}>
                      {['# OS','Cliente','Proyecto','Estado','Avance','Módulos','Actividades','Inicio','Fin'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {proyectosData.map(p => {
                      const totalActs = (p.modules ?? []).reduce((s: number, m: any) =>
                        s + (m.phases ?? []).reduce((s2: number, ph: any) => s2 + (ph.activities ?? []).length, 0), 0);
                      const doneActs = (p.modules ?? []).reduce((s: number, m: any) =>
                        s + (m.phases ?? []).reduce((s2: number, ph: any) =>
                          s2 + (ph.activities ?? []).filter((a: any) => a.status === 'completada').length, 0), 0);
                      const ps = PROJ_STATUS[p.status] ?? PROJ_STATUS.activo;
                      return (
                        <tr key={p.id} className="border-t hover:bg-white/4 transition-colors" style={tableStyle}>
                          <td className="px-4 py-3 font-mono font-bold text-xs" style={{ color: '#60a5fa' }}>{p.serviceOrder?.osNumber ?? '—'}</td>
                          <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: tc.text }}>{p.serviceOrder?.client?.businessName ?? '—'}</td>
                          <td className="px-4 py-3 max-w-52 truncate" style={{ color: tc.text }}>{p.name}</td>
                          <td className="px-4 py-3"><StatusBadge {...ps} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Number(p.progressPercent)}%`, background: '#a78bfa' }} />
                              </div>
                              <span className="text-xs" style={{ color: tc.muted }}>{Number(p.progressPercent).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center" style={{ color: tc.muted }}>{(p.modules ?? []).length}</td>
                          <td className="px-4 py-3 text-center" style={{ color: tc.muted }}>{doneActs}/{totalActs}</td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>{fmt(p.serviceOrder?.startDate)}</td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>{fmt(p.serviceOrder?.endDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CAPACITACIONES ───────────────────────────────────────────────── */}
      {tab === 'capacitaciones' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ClientSelect value={capFilter.clientId} onChange={v => setCapFilter(p => ({ ...p, clientId: v }))} />
            <SelectFilter value={capFilter.serviceOrderId} onChange={v => setCapFilter(p => ({ ...p, serviceOrderId: v }))} placeholder="Todas las OS">
              {osList.map(o => <option key={o.id} value={o.id}>{o.osNumber} — {o.client?.businessName ?? ''}</option>)}
            </SelectFilter>
            <button onClick={loadCap} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors" title="Actualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="ml-auto flex items-center gap-3">
              {(() => {
                const total = capData.reduce((s, a) => s + (a.firmantes ?? []).length, 0);
                const firmados = capData.reduce((s, a) => s + (a.firmantes ?? []).filter((f: any) => f.firmado).length, 0);
                return <span className="text-sm" style={{ color: tc.muted }}>{capData.length} acta{capData.length !== 1 ? 's' : ''} · {firmados}/{total} firmados</span>;
              })()}
              <button onClick={exportCapPDF} disabled={!capData.length}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}>
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button onClick={exportCap} disabled={!capData.length}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-primary disabled:opacity-40">
                <Download className="w-4 h-4" /> Excel
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${tc.border}`, background: tc.card }}>
            <div className="overflow-x-auto">
              <TableWrap loading={capLoading} empty={!capData.length}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={thStyle}>
                      {['# OS','Cliente','Módulo','# Acta','Fecha','Participante','Cargo','Estado'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {capData.flatMap(acta =>
                      (acta.firmantes ?? []).length > 0
                        ? (acta.firmantes as any[]).map((f: any, fi: number) => (
                          <tr key={`${acta.id}-${fi}`} className="border-t hover:bg-white/4 transition-colors" style={tableStyle}>
                            <td className="px-4 py-3 font-mono font-bold text-xs" style={{ color: '#60a5fa' }}>{acta.project?.serviceOrder?.osNumber ?? '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: tc.text }}>{acta.project?.serviceOrder?.client?.businessName ?? '—'}</td>
                            <td className="px-4 py-3" style={{ color: tc.muted }}>{acta.modulo?.name ?? '—'}</td>
                            <td className="px-4 py-3" style={{ color: tc.muted }}>{acta.numero ?? '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>{fmt(acta.fecha)}</td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: tc.text }}>{f.nombre ?? '—'}</td>
                            <td className="px-4 py-3" style={{ color: tc.muted }}>{f.cargo ?? '—'}</td>
                            <td className="px-4 py-3">
                              {f.firmado
                                ? <StatusBadge label="Firmado"  color="#34d399" bg="rgba(52,211,153,0.12)"  />
                                : <StatusBadge label="Pendiente" color="#fbbf24" bg="rgba(251,191,36,0.12)" />}
                            </td>
                          </tr>
                        ))
                        : [(
                          <tr key={acta.id} className="border-t hover:bg-white/4 transition-colors" style={tableStyle}>
                            <td className="px-4 py-3 font-mono font-bold text-xs" style={{ color: '#60a5fa' }}>{acta.project?.serviceOrder?.osNumber ?? '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: tc.text }}>{acta.project?.serviceOrder?.client?.businessName ?? '—'}</td>
                            <td className="px-4 py-3" style={{ color: tc.muted }}>{acta.modulo?.name ?? '—'}</td>
                            <td className="px-4 py-3" style={{ color: tc.muted }}>{acta.numero ?? '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>{fmt(acta.fecha)}</td>
                            <td colSpan={3} className="px-4 py-3 text-xs italic" style={{ color: tc.muted }}>Sin firmantes registrados</td>
                          </tr>
                        )]
                    )}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: REQUERIMIENTOS ───────────────────────────────────────────────── */}
      {tab === 'requerimientos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SelectFilter value={reqFilter.estadoActual} onChange={v => setReqFilter(p => ({ ...p, estadoActual: v }))} placeholder="Todos los estados">
              {['Elaborado','Priorizado','Devuelto','Negado','Repriorizado','Entregado'].map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </SelectFilter>
            <SelectFilter value={reqFilter.prioridad} onChange={v => setReqFilter(p => ({ ...p, prioridad: v }))} placeholder="Todas las prioridades">
              {['Crítico','Alta','Media','Baja'].map(p => <option key={p} value={p}>{p}</option>)}
            </SelectFilter>
            <SelectFilter value={reqFilter.area} onChange={v => setReqFilter(p => ({ ...p, area: v }))} placeholder="Todas las áreas">
              <option value="Asistencial">Asistencial</option>
              <option value="Financiero">Financiero</option>
            </SelectFilter>
            <ClientSelect value={reqFilter.clientId} onChange={v => setReqFilter(p => ({ ...p, clientId: v }))} />
            <div className="flex items-center gap-2 input-glass rounded-xl px-3 py-2">
              <CalendarDays className="w-4 h-4 shrink-0" style={{ color: tc.muted }} />
              <input type="date" value={reqFilter.fechaDesde} onChange={e => setReqFilter(p => ({ ...p, fechaDesde: e.target.value }))}
                className="bg-transparent text-sm outline-none w-28" style={{ color: tc.text, colorScheme: 'dark' }} title="Desde" />
              <span className="text-xs" style={{ color: tc.muted }}>—</span>
              <input type="date" value={reqFilter.fechaHasta} onChange={e => setReqFilter(p => ({ ...p, fechaHasta: e.target.value }))}
                className="bg-transparent text-sm outline-none w-28" style={{ color: tc.text, colorScheme: 'dark' }} title="Hasta" />
            </div>
            <button onClick={loadReq} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors" title="Actualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm" style={{ color: tc.muted }}>{reqData.length} registro{reqData.length !== 1 ? 's' : ''}</span>
              <button onClick={exportReqPDF} disabled={!reqData.length}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}>
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button onClick={exportReq} disabled={!reqData.length}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white btn-primary disabled:opacity-40">
                <Download className="w-4 h-4" /> Excel
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${tc.border}`, background: tc.card }}>
            <div className="overflow-x-auto">
              <TableWrap loading={reqLoading} empty={!reqData.length}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={thStyle}>
                      {['#','Título','Cliente','OS','Módulo','Área','Prioridad','Estado','Agente','Fecha','Días','Gestiones'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reqData.map(r => {
                      const prio = PRIORIDAD[r.prioridad ?? ''];
                      return (
                        <tr key={r.id} className="border-t hover:bg-white/4 transition-colors" style={tableStyle}>
                          <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: '#60a5fa' }}>{r.numero ?? '—'}</td>
                          <td className="px-4 py-3 max-w-56 truncate font-medium" style={{ color: tc.text }}>{r.titulo}</td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.text }}>{r.client?.businessName ?? '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: tc.muted }}>{r.serviceOrder?.osNumber ?? '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>{r.templateModule?.name ?? '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>{r.area ?? '—'}</td>
                          <td className="px-4 py-3">
                            {prio
                              ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: prio.color, background: prio.bg }}>{r.prioridad}</span>
                              : <span style={{ color: tc.muted }}>—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {r.estadoActual
                              ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', color: tc.text }}>{r.estadoActual}</span>
                              : <span style={{ color: tc.muted }}>—</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>
                            {r.agente ? `${r.agente.firstName} ${r.agente.lastName}` : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: tc.muted }}>{fmt(r.createdAt)}</td>
                          <td className="px-4 py-3 text-center" style={{ color: tc.muted }}>{diasDesde(r.createdAt)}</td>
                          <td className="px-4 py-3 text-center" style={{ color: tc.muted }}>{r._count?.gestiones ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
