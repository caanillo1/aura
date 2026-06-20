'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Loader2, FileText, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { serviceOrdersApi } from '@/lib/api';
import { InformeDocument } from '@/lib/pdf/InformeDocument';
import { transformForPdf } from '@/lib/pdf/transformForPdf';

// ── Colour helpers ─────────────────────────────────────────────────────────────
const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [30, 58, 95];
};
const getLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const textOn  = (bg: string) => getLuminance(bg) > 0.35 ? '#111827' : '#ffffff';
const alpha   = (hex: string, a: number) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const lighten = (hex: string, amt = 0.92) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(g + (255 - g) * amt)},${Math.round(b + (255 - b) * amt)})`;
};

// ── Date helpers ───────────────────────────────────────────────────────────────
const fmt = (s?: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtLong = (s?: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });
};

// ── Label maps ─────────────────────────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  inicio: 'Acta de Inicio', visita: 'Acta de Visita',
  capacitacion: 'Acta de Capacitación', cierre: 'Acta de Cierre',
  entrega_soporte: 'Entrega a Soporte',
};
const TIPO_SHORT: Record<string, string> = {
  inicio: 'Inicio', visita: 'Visita',
  capacitacion: 'Capacitación', cierre: 'Cierre', entrega_soporte: 'Soporte',
};
const TIPO_ICON: Record<string, string> = {
  inicio: '🚀', visita: '📍', capacitacion: '🎓', cierre: '✅', entrega_soporte: '🤝',
};
const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', en_curso: 'En Curso', suspendida: 'Suspendida',
  completada: 'Completada', cancelada: 'Cancelada', activo: 'Activo',
  completado: 'Completado', borrador: 'Borrador', firmada: 'Firmada',
  en_progreso: 'En Progreso', bloqueado: 'Bloqueado',
};
const STATUS_COLOR: Record<string, string> = {
  activo: '#059669', completada: '#059669', completado: '#059669', firmada: '#059669',
  en_curso: '#2563eb', en_progreso: '#2563eb',
  pendiente: '#d97706', borrador: '#d97706',
  suspendida: '#dc2626', cancelada: '#dc2626', bloqueado: '#dc2626',
};
const ACT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  completado:  { label: 'Completado',  color: '#065f46', bg: '#d1fae5' },
  en_progreso: { label: 'En Progreso', color: '#1e40af', bg: '#dbeafe' },
  bloqueado:   { label: 'Bloqueado',   color: '#991b1b', bg: '#fee2e2' },
  pendiente:   { label: 'Pendiente',   color: '#92400e', bg: '#fef3c7' },
};
const PRIO: Record<string, { label: string; color: string; bg: string }> = {
  critica: { label: 'Crítica', color: '#991b1b', bg: '#fee2e2' },
  alta:    { label: 'Alta',    color: '#92400e', bg: '#fef3c7' },
  media:   { label: 'Media',   color: '#1e40af', bg: '#dbeafe' },
  baja:    { label: 'Baja',    color: '#166534', bg: '#f0fdf4' },
};
const NOTE_LVL: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critica: { label: 'Crítica', color: '#991b1b', bg: '#fff5f5', border: '#fca5a5' },
  alta:    { label: 'Alta',    color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  media:   { label: 'Media',   color: '#1e40af', bg: '#eff6ff', border: '#93c5fd' },
  baja:    { label: 'Baja',    color: '#166534', bg: '#f0fdf4', border: '#86efac' },
};
const NOTE_SUBTYPE: Record<string, string> = {
  proximos_logros: 'Próximos Logros', riesgo_critico: 'Riesgo Crítico',
};
const COMP_ESTADO: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:  { label: 'Pendiente',  color: '#92400e', bg: '#fef3c7' },
  en_proceso: { label: 'En proceso', color: '#1e40af', bg: '#dbeafe' },
  cumplido:   { label: 'Cumplido',   color: '#065f46', bg: '#d1fae5' },
  completado: { label: 'Completado', color: '#065f46', bg: '#d1fae5' },
};

interface CheckItem { label: string; checked: boolean; obs: string; medio?: string }
const MODULOS_DEFAULT: CheckItem[] = [
  'Archivo','Agenda médica','Consulta externa (historias clínicas)','Hospitalización',
  'Inventario / Farmacia','Facturación (todas las modalidades)','Emisión electrónica (FEV / DSA / NE)',
  'Dashboard Power BI','Contabilidad','Cartera y glosas','Tesorería','Nómina',
  'Consentimiento informado','Compras',
].map(l => ({ label: l, checked: false, obs: '' }));
const INFRA_DEFAULT: CheckItem[] = [
  'Certificado SSL instalado','IP pública o VPN activa (autogestión)',
  'Servidor cumple condiciones mínimas','Estaciones cumplen condiciones mínimas','Internet ≥ 5 Mbps estable',
].map(l => ({ label: l, checked: false, obs: '' }));
const DOCS_DEFAULT: CheckItem[] = [
  'Manuales de usuario','Video grabación capacitaciones',
  'Contrato / SLA firmado','Certificados digitales (emisión electrónica)',
].map(l => ({ label: l, checked: false, obs: '', medio: '' }));
const EMISION_DEFAULT: CheckItem[] = [
  'Emisión de FEV, NE, DSA','Generación de XML (UBL 2.1)','Resolución y rangos de facturación',
  'Firma electrónica cargada','Código CUFE / CUNE / CUDS','Representación gráfica estándar',
  'Manejo de anexos en factura','Acceso a portal del proveedor',
  'Consulta y descarga de XML y PDF','Reenvío de facturas por correo',
].map(l => ({ label: l, checked: false, obs: '' }));

const parseChecklist = (json: string | null | undefined, def: CheckItem[]): CheckItem[] => {
  if (!json) return def.map(x => ({ ...x }));
  try { return JSON.parse(json); } catch { return def.map(x => ({ ...x })); }
};

interface Props {
  osId: string;
  onClose: () => void;
  autoEmail?: { destinatarios: string[]; asunto?: string };
}

// ═══════════════════════════════════════════════════════════════════════════════
export function InformeConActas({ osId, onClose, autoEmail }: Props) {
  const [data, setData]               = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [autoSending, setAutoSending] = useState(false);
  const [pdfReady, setPdfReady]       = useState(false);

  const pdfBlobRef    = useRef<Blob | null>(null);
  const pdfPromiseRef = useRef<Promise<Blob> | null>(null);

  useEffect(() => {
    setLoading(true); setError(false);
    serviceOrdersApi.fullReport(osId)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [osId]);

  // Pre-generate PDF in browser as soon as data loads so download is instant
  useEffect(() => {
    if (!data || autoEmail) return;
    setPdfReady(false);
    pdfBlobRef.current = null;
    const pdfData = transformForPdf(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promise = pdf(React.createElement(InformeDocument, { data: pdfData, includeActas: true }) as any).toBlob()
      .then(blob => { pdfBlobRef.current = blob; setPdfReady(true); return blob; })
      .catch(err => { console.error('[PDF pre-gen]', err); throw err; });
    pdfPromiseRef.current = promise;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!data || !autoEmail) return;
    setAutoSending(true);
    serviceOrdersApi.sendReportPdf(osId, {
      destinatarios: autoEmail.destinatarios,
      asunto:        autoEmail.asunto,
      reportType:    'completo',
    })
      .then(() => toast.success(`Informe enviado a ${autoEmail.destinatarios.length} destinatario(s)`))
      .catch(() => toast.error('Error al enviar el informe ejecutivo'))
      .finally(() => onClose());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const osNum = (data?.os?.osNumber ?? 'OS').replace(/[^a-zA-Z0-9-]/g, '_');
      // Use pre-generated blob if ready; else await the pending promise; else generate now
      const blob = pdfBlobRef.current
        ?? await pdfPromiseRef.current
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?? await pdf(React.createElement(InformeDocument, { data: transformForPdf(data), includeActas: true }) as any).toBlob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `Informe_Ejecutivo_${osNum}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el PDF');
    } finally { setDownloading(false); }
  };

  const handlePrint = () => {
    const existing = document.getElementById('__ica-print-style');
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = '__ica-print-style';
    style.textContent = `
      @page { size: A4 portrait; margin-top: 28mm; margin-bottom: 22mm; margin-left: 14mm; margin-right: 14mm; }
      @media print {
        body > * { display: none !important; }
        #ica-modal-root { display: block !important; position: static !important; background: #fff !important; padding: 0 !important; overflow: visible !important; height: auto !important; width: 100% !important; }
        #ica-modal-root > div { display: block !important; padding: 0 !important; margin: 0 !important; }
        #ica-actions-bar, #ica-screen-hdr, .ica-no-print { display: none !important; }
        #ica-paper { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; width: 100% !important; margin: 0 !important; overflow: visible !important; }
        #ica-cover-capture { page-break-after: always; break-after: page; }
        #ica-exec-body { padding: 0 !important; }
        .ica-acta-break { page-break-before: always !important; break-before: page !important; }
        .ica-kpi-row, .ica-info-row { page-break-inside: avoid !important; break-inside: avoid !important; }
        table { border-collapse: collapse !important; }
        thead { display: table-header-group !important; }
        tr    { page-break-inside: avoid !important; break-inside: avoid !important; }
        .ica-sig-block { page-break-inside: avoid !important; break-inside: avoid !important; }
        .ica-sig-img   { max-height: 45px !important; object-fit: contain !important; }
      }
    `;
    document.head.appendChild(style);
    setTimeout(() => { window.print(); document.getElementById('__ica-print-style')?.remove(); }, 400);
  };

  // ── States ───────────────────────────────────────────────────────────────────
  if (autoSending) return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="rounded-2xl p-10 flex flex-col items-center gap-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#4f46e5' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Enviando Informe Ejecutivo…</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Esto puede tomar unos segundos</p>
      </div>
    </div>
  );
  if (loading) return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl p-10 flex flex-col items-center gap-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#60a5fa' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Cargando informe…</p>
      </div>
    </div>
  );
  if (error) return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl p-10 text-center space-y-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Error al cargar el informe</p>
        <button onClick={onClose} className="btn-primary px-5 py-2 rounded-xl text-sm font-semibold text-white">Cerrar</button>
      </div>
    </div>
  );

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { company, os, project, actas: _actas, requerimientos, notes: _notes,
          personalCapacitado, personalEnProceso, personalPendiente, generatedAt } = data;

  // Sort most-recent first
  const actas = [...(_actas ?? [])].sort((a: any, b: any) =>
    new Date(b.fecha ?? b.createdAt ?? 0).getTime() - new Date(a.fecha ?? a.createdAt ?? 0).getTime());
  const notes = [...(_notes ?? [])].sort((a: any, b: any) =>
    new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  const pc  = company?.primaryColor   ?? '#1E3A5F';
  const sc  = company?.secondaryColor ?? pc;
  const nom = company?.commercialName ?? company?.name ?? '';
  const onPc = textOn(pc);

  const allActivities  = (project?.modules ?? []).flatMap((m: any) => (m.phases ?? []).flatMap((p: any) => p.activities ?? []));
  const doneActs       = allActivities.filter((a: any) => a.status === 'completado').length;
  const inProgActs     = allActivities.filter((a: any) => a.status === 'en_progreso').length;
  const blockedActs    = allActivities.filter((a: any) => a.status === 'bloqueado').length;
  const pendActs       = allActivities.filter((a: any) => a.status === 'pendiente').length;
  const totalActs      = allActivities.length;
  // Use the DB-stored value (average-of-averages through module→phase→activity hierarchy)
  // so the preview matches the project view and the downloaded PDF.
  const progressPct    = project?.progressPercent != null
    ? Math.round(Number(project.progressPercent))
    : (totalActs > 0
        ? Math.round(allActivities.reduce((s: number, a: any) => s + Number(a.progressPercent ?? 0), 0) / totalActs)
        : 0);
  const actasByType    = (t: string) => (actas as any[]).filter(a => a.type === t);
  const firmadas       = (actas as any[]).filter(a => a.status === 'firmada').length;

  const activitiesCtx  = (project?.modules ?? []).flatMap((mod: any) =>
    (mod.phases ?? []).flatMap((ph: any) =>
      (ph.activities ?? []).map((act: any) => ({ ...act, moduleName: mod.name, phaseName: ph.name }))));
  const planActivities = activitiesCtx;

  const teamRows = [
    os.clinicalLeader  ? { rol: 'Líder Asistencial',  p: os.clinicalLeader }  : null,
    os.financialLeader ? { rol: 'Líder Financiero',   p: os.financialLeader } : null,
    (os as any).clientLeader ? { rol: 'Líder del Cliente', p: (os as any).clientLeader } : null,
    ...(os.implementers ?? []).map((imp: any) => ({
      rol: `Implementador${imp.role && imp.role !== 'apoyo' ? ` (${imp.role})` : ''}`,
      p: imp.user,
    })),
  ].filter(Boolean) as { rol: string; p: any }[];

  // ── Design tokens ─────────────────────────────────────────────────────────────
  const F   = `'Inter','Segoe UI',Arial,Helvetica,sans-serif`;
  const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontFamily: F, fontSize: 10 };
  const TH = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: pc, color: onPc, padding: '8px 11px', textAlign: 'left',
    fontWeight: 700, fontSize: 8.5, letterSpacing: '0.07em', textTransform: 'uppercase', ...extra,
  });
  const TD = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '8px 11px', borderBottom: '1px solid #f0f0f0',
    verticalAlign: 'top', color: '#374151', fontSize: 10, ...extra,
  });

  // ── Section counter ───────────────────────────────────────────────────────────
  let _sn = 0;
  const sn = () => String(++_sn);
  const snKpi   = sn();
  const snOS    = sn();
  const snTeam  = sn();
  const snNotes = (notes ?? []).length > 0 ? sn() : null;
  const snProj  = project ? sn() : null;
  const snPlan  = planActivities.length > 0 ? sn() : null;
  const snActas = sn();
  const snReqs  = (requerimientos ?? []).length > 0 ? sn() : null;
  const snCap   = sn();

  // ── Shared components ─────────────────────────────────────────────────────────

  const Badge = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20,
      fontSize: 8.5, fontWeight: 700, color, background: bg, fontFamily: F, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );

  const SectionTitle = ({ n, text }: { n: string | null; text: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, paddingBottom: 10,
      borderBottom: `2px solid ${lighten(pc, 0.88)}` }}>
      {n && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: pc, color: onPc,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, fontFamily: F, flexShrink: 0 }}>
          {n}
        </div>
      )}
      <div style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: '#111827', fontFamily: F }}>
        {text}
      </div>
    </div>
  );

  const SubTitle = ({ text }: { text: string }) => (
    <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em',
      color: '#6b7280', marginBottom: 7, marginTop: 16, paddingBottom: 4,
      borderBottom: '1px solid #f3f4f6', fontFamily: F }}>
      {text}
    </div>
  );

  const InfoCard = ({ label, value, sub, accent }: { label: string; value: any; sub?: string; accent?: string }) => (
    <div style={{ flex: '1 1 140px', minWidth: 120, padding: '14px 16px',
      background: '#ffffff', border: '1px solid #e9ecef', borderRadius: 8,
      borderTop: `3px solid ${accent ?? pc}` }}>
      <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.11em',
        color: '#9ca3af', marginBottom: 6, fontFamily: F }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontFamily: F, lineHeight: 1.3 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 4, fontFamily: F }}>{sub}</div>}
    </div>
  );

  const KpiMini = ({ label, value, sub, color, bg }: {
    label: string; value: string; sub?: string; color: string; bg: string;
  }) => (
    <div style={{ flex: '1 1 0', minWidth: 100, padding: '16px 14px',
      background: bg, borderRadius: 8, border: `1px solid ${alpha(color, 0.18)}` }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, fontFamily: F }}>{value}</div>
      <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em',
        color, marginTop: 5, opacity: 0.85, fontFamily: F }}>{label}</div>
      {sub && <div style={{ fontSize: 8, color, opacity: 0.6, marginTop: 3, fontFamily: F }}>{sub}</div>}
    </div>
  );

  const Avatar = ({ name, size = 40 }: { name: string; size?: number }) => {
    const parts    = name.trim().split(' ');
    const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: alpha(pc, 0.12),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.33), fontWeight: 800, color: pc, fontFamily: F, flexShrink: 0 }}>
        {initials.toUpperCase()}
      </div>
    );
  };

  // SVG circular progress ring
  const CircularProgress = ({ pct, color, size = 76 }: { pct: number; color: string; size?: number }) => {
    const r    = (size - 14) / 2;
    const circ = 2 * Math.PI * r;
    const dash = circ - (Math.min(pct, 100) / 100) * circ;
    const c    = size / 2;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flexShrink: 0 }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#e5e7eb" strokeWidth={9} />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeLinecap="round" strokeDasharray={String(circ)} strokeDashoffset={String(dash)}
          transform={`rotate(-90 ${c} ${c})`} />
        <text x={c} y={c} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: Math.round(size * 0.21), fontWeight: 800,
            fontFamily: 'Arial,Helvetica,sans-serif', fill: color }}>
          {pct}%
        </text>
      </svg>
    );
  };

  // ── Acta helpers ──────────────────────────────────────────────────────────────

  const renderFirmantes = (firmantes: any[]) => {
    if (!firmantes?.length) return null;
    return (
      <div className="ica-sig-block" style={{ marginTop: 20, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <SubTitle text="Firmas y Rúbricas" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {firmantes.map((f: any) => (
            <div key={f.id} style={{ flex: '1 1 150px', border: '1px solid #e5e7eb', borderRadius: 8,
              padding: '14px 16px', borderLeft: f.signedAt ? `3px solid #059669` : `3px solid #d1d5db` }}>
              {f.signatureData ? (
                <img src={f.signatureData} alt="Firma" className="ica-sig-img"
                  style={{ height: 45, maxWidth: 130, objectFit: 'contain', display: 'block', marginBottom: 10 }} />
              ) : (
                <div style={{ height: 45, borderBottom: '1px solid #d1d5db', marginBottom: 10 }} />
              )}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', fontFamily: F }}>{f.nombre}</div>
              <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2, fontFamily: F }}>{f.cargo}</div>
              {f.empresa && <div style={{ fontSize: 8.5, color: '#9ca3af', marginTop: 2, fontFamily: F }}>{f.empresa}</div>}
              <div style={{ fontSize: 8, marginTop: 6, fontWeight: 700, fontFamily: F,
                color: f.signedAt ? '#059669' : '#d97706' }}>
                {f.signedAt ? `✓ Firmado: ${fmt(f.signedAt)}` : '◯ Pendiente de firma'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const MetaGrid = ({ acta }: { acta: any }) => {
    const items = [
      ['Número',     acta.numero ?? '—'],
      ['Fecha',      fmt(acta.fecha)],
      ['Ciudad',     acta.municipio?.nombreMunicipio ?? acta.ciudad ?? '—'],
      ['Lugar',      acta.lugar ?? '—'],
      ['Creado por', acta.createdBy ? `${acta.createdBy.firstName} ${acta.createdBy.lastName}` : '—'],
    ].filter(([, v]) => v && v !== '—');
    const isFirmada = acta.status === 'firmada';
    return (
      <div style={{ display: 'flex', gap: 0, marginBottom: 18, flexWrap: 'wrap',
        border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fafbfc' }}>
        {items.map(([lbl, val], i) => (
          <div key={String(lbl)} style={{ flex: '1 1 100px', padding: '10px 14px',
            borderRight: i < items.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
            <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 3, fontFamily: F }}>{lbl}</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#111827', fontFamily: F }}>{val}</div>
          </div>
        ))}
        <div style={{ flex: '1 1 90px', padding: '10px 14px',
          background: isFirmada ? '#f0fdf4' : '#fffbeb' }}>
          <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 3, fontFamily: F }}>Estado</div>
          <Badge
            label={isFirmada ? 'Firmada' : (STATUS_LABEL[acta.status] ?? 'Borrador')}
            color={isFirmada ? '#065f46' : '#92400e'}
            bg={isFirmada ? '#dcfce7' : '#fef9c3'} />
        </div>
      </div>
    );
  };

  const renderAcciones = (acciones: any[]) => (
    <><SubTitle text="Acciones" />
    <table style={tbl}><thead><tr>
      <th style={TH()}>Acción</th>
      <th style={{ ...TH(), width: 130 }}>Responsable</th>
      <th style={{ ...TH(), width: 90 }}>Fecha Límite</th>
    </tr></thead><tbody>
      {acciones.map((a: any, i: number) => (
        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
          <td style={TD()}>{a.accion}</td>
          <td style={TD()}>{a.responsable ?? '—'}</td>
          <td style={TD()}>{a.fechaLimite ? fmt(a.fechaLimite) : '—'}</td>
        </tr>
      ))}
    </tbody></table></>
  );

  const renderCompromisos = (compromisos: any[]) => (
    <><SubTitle text="Compromisos" />
    <table style={tbl}><thead><tr>
      <th style={{ ...TH(), width: 28 }}>#</th>
      <th style={TH()}>Compromiso</th>
      <th style={{ ...TH(), width: 130 }}>Responsable</th>
      <th style={{ ...TH(), width: 90 }}>Estado</th>
    </tr></thead><tbody>
      {compromisos.map((c: any, i: number) => {
        const meta = COMP_ESTADO[c.estado] ?? { label: c.estado ?? '—', color: '#374151', bg: '#f3f4f6' };
        const resp = c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}`
                   : c.clientStaff ? `${c.clientStaff.firstName} ${c.clientStaff.lastName}`
                   : c.responsable ?? '—';
        return (
          <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
            <td style={{ ...TD(), textAlign: 'center', fontWeight: 700 }}>{c.numero ?? i + 1}</td>
            <td style={{ ...TD(), whiteSpace: 'pre-line' }}>{c.compromiso}</td>
            <td style={TD()}>{resp}</td>
            <td style={TD()}><Badge {...meta} /></td>
          </tr>
        );
      })}
    </tbody></table></>
  );

  const renderActaInicio = (acta: any) => (
    <>
      {(acta.implementadorNombre || acta.jefeNombre) && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          {acta.implementadorNombre && (
            <div style={{ flex: '1 1 160px', padding: '10px 14px', background: '#f8fafc',
              borderRadius: 6, borderLeft: `3px solid ${pc}` }}>
              <div style={{ fontSize: 7.5, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.09em', marginBottom: 3, fontFamily: F }}>Implementador</div>
              <div style={{ fontWeight: 600, fontSize: 10.5, fontFamily: F }}>{acta.implementadorNombre}</div>
            </div>
          )}
          {acta.jefeNombre && (
            <div style={{ flex: '1 1 160px', padding: '10px 14px', background: '#f8fafc',
              borderRadius: 6, borderLeft: `3px solid ${sc}` }}>
              <div style={{ fontSize: 7.5, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.09em', marginBottom: 3, fontFamily: F }}>Jefe / Responsable</div>
              <div style={{ fontWeight: 600, fontSize: 10.5, fontFamily: F }}>{acta.jefeNombre}</div>
            </div>
          )}
        </div>
      )}
      {acta.asunto          && (<><SubTitle text="Asunto" /><div style={{ fontSize: 10.5, color: '#1f2937', whiteSpace: 'pre-line', fontFamily: F }}>{acta.asunto}</div></>)}
      {acta.objetivoGeneral && (<><SubTitle text="Objetivo General" /><div style={{ fontSize: 10.5, color: '#1f2937', whiteSpace: 'pre-line', fontFamily: F }}>{acta.objetivoGeneral}</div></>)}
      {acta.alcance         && (<><SubTitle text="Alcance" /><div style={{ fontSize: 10.5, color: '#1f2937', whiteSpace: 'pre-line', fontFamily: F }}>{acta.alcance}</div></>)}
      {(acta.compromisos ?? []).length > 0 && renderCompromisos(acta.compromisos)}
      {(acta.acciones   ?? []).length > 0 && renderAcciones(acta.acciones)}
    </>
  );

  const renderActaVisita = (acta: any) => (
    <>
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        {acta.implementadorNombre && (
          <div style={{ flex: '1 1 160px', padding: '10px 14px', background: '#f8fafc',
            borderRadius: 6, borderLeft: `3px solid ${pc}` }}>
            <div style={{ fontSize: 7.5, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.09em', marginBottom: 3, fontFamily: F }}>Implementador</div>
            <div style={{ fontWeight: 600, fontSize: 10.5, fontFamily: F }}>{acta.implementadorNombre}</div>
          </div>
        )}
        {acta.jefeNombre && (
          <div style={{ flex: '1 1 160px', padding: '10px 14px', background: '#f8fafc',
            borderRadius: 6, borderLeft: `3px solid ${sc}` }}>
            <div style={{ fontSize: 7.5, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.09em', marginBottom: 3, fontFamily: F }}>Jefe / Responsable</div>
            <div style={{ fontWeight: 600, fontSize: 10.5, fontFamily: F }}>{acta.jefeNombre}</div>
          </div>
        )}
      </div>
      {acta.actividadesRealizadas && (<><SubTitle text="Actividades Realizadas" /><div style={{ fontSize: 10.5, color: '#1f2937', whiteSpace: 'pre-line', fontFamily: F }}>{acta.actividadesRealizadas}</div></>)}
      {(acta.fechasVisita ?? []).length > 0 && (
        <><SubTitle text="Fechas de Visita" />
        <table style={tbl}><thead><tr>
          <th style={TH()}>Fecha</th><th style={TH()}>Hora Inicio</th><th style={TH()}>Hora Fin</th>
        </tr></thead><tbody>
          {(acta.fechasVisita as any[]).map((fv: any, i: number) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={TD()}>{fmt(fv.fecha)}</td><td style={TD()}>{fv.horaInicio ?? '—'}</td><td style={TD()}>{fv.horaFin ?? '—'}</td>
            </tr>
          ))}
        </tbody></table></>
      )}
      {(acta.actaActividades ?? []).length > 0 && (
        <><SubTitle text="Actividades del Plan" />
        <table style={tbl}><thead><tr>
          <th style={TH()}>Módulo</th><th style={TH()}>Fase</th>
          <th style={{ ...TH(), width: 70 }}>Código</th><th style={TH()}>Actividad</th>
          <th style={{ ...TH(), width: 90 }}>Estado</th>
        </tr></thead><tbody>
          {(acta.actaActividades as any[]).map((aa: any, i: number) => {
            const act  = aa.activity;
            const meta = ACT_STATUS[act?.status] ?? { label: act?.status ?? '—', color: '#374151', bg: '#f3f4f6' };
            return (
              <tr key={aa.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ ...TD(), fontSize: 9 }}>{act?.phase?.projectModule?.name ?? '—'}</td>
                <td style={{ ...TD(), fontSize: 9 }}>{act?.phase?.name ?? '—'}</td>
                <td style={{ ...TD(), fontWeight: 700 }}>{act?.code ?? '—'}</td>
                <td style={TD()}>{act?.name ?? '—'}</td>
                <td style={TD()}><Badge {...meta} /></td>
              </tr>
            );
          })}
        </tbody></table></>
      )}
      {(acta.compromisos ?? []).length > 0 && renderCompromisos(acta.compromisos)}
      {(acta.acciones   ?? []).length > 0 && renderAcciones(acta.acciones)}
    </>
  );

  const renderActaCapacitacion = (acta: any) => (
    <>
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        {acta.modulo?.name && (
          <div style={{ flex: '1 1 130px', padding: '10px 14px', background: '#f8fafc',
            borderRadius: 6, borderLeft: `3px solid ${pc}` }}>
            <div style={{ fontSize: 7.5, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.09em', marginBottom: 3, fontFamily: F }}>Módulo</div>
            <div style={{ fontWeight: 600, fontSize: 10.5, fontFamily: F }}>{acta.modulo.name}</div>
          </div>
        )}
        {acta.expositor && (
          <div style={{ flex: '1 1 130px', padding: '10px 14px', background: '#f8fafc',
            borderRadius: 6, borderLeft: `3px solid ${sc}` }}>
            <div style={{ fontSize: 7.5, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.09em', marginBottom: 3, fontFamily: F }}>Expositor</div>
            <div style={{ fontWeight: 600, fontSize: 10.5, fontFamily: F }}>{acta.expositor}</div>
          </div>
        )}
        {(acta.horaInicio || acta.horaFin) && (
          <div style={{ flex: '1 1 100px', padding: '10px 14px', background: '#f8fafc',
            borderRadius: 6, borderLeft: '3px solid #6b7280' }}>
            <div style={{ fontSize: 7.5, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.09em', marginBottom: 3, fontFamily: F }}>Horario</div>
            <div style={{ fontWeight: 600, fontSize: 10.5, fontFamily: F }}>{acta.horaInicio ?? '—'} – {acta.horaFin ?? '—'}</div>
          </div>
        )}
      </div>
      {acta.temasCapacitacion && (<><SubTitle text="Temas de Capacitación" /><div style={{ fontSize: 10.5, color: '#1f2937', whiteSpace: 'pre-line', fontFamily: F }}>{acta.temasCapacitacion}</div></>)}
      {(acta.participantes ?? []).length > 0 && (
        <><SubTitle text="Participantes" />
        <table style={tbl}><thead><tr>
          <th style={{ ...TH(), width: 28 }}>#</th><th style={TH()}>Nombre</th><th style={TH()}>Cargo</th>
          <th style={{ ...TH(), width: 100 }}>Documento</th>
          <th style={{ ...TH(), width: 70 }}>Entrada</th><th style={{ ...TH(), width: 70 }}>Salida</th>
        </tr></thead><tbody>
          {(acta.participantes as any[]).map((p: any, i: number) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ ...TD(), textAlign: 'center' }}>{p.numero ?? i + 1}</td>
              <td style={{ ...TD(), fontWeight: 600 }}>{p.nombre}</td>
              <td style={TD()}>{p.cargo ?? '—'}</td>
              <td style={TD()}>{p.documento ?? '—'}</td>
              <td style={TD()}>{p.horaEntrada ?? '—'}</td>
              <td style={TD()}>{p.horaSalida ?? '—'}</td>
            </tr>
          ))}
        </tbody></table></>
      )}
      {(acta.compromisos ?? []).length > 0 && renderCompromisos(acta.compromisos)}
      {(acta.acciones   ?? []).length > 0 && renderAcciones(acta.acciones)}
    </>
  );

  const renderActaCierre = (acta: any) => {
    let modulos: string[] = [];
    try { modulos = JSON.parse(acta.cierreModulosJson ?? '[]'); } catch { /**/ }
    return (
      <>
        {acta.cuerpo && (<><SubTitle text="Descripción" /><div style={{ fontSize: 10.5, color: '#1f2937', whiteSpace: 'pre-line', fontFamily: F }}>{acta.cuerpo}</div></>)}
        {modulos.length > 0 && (
          <><SubTitle text="Módulos Cerrados" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {modulos.map((m: string, i: number) => (
              <span key={i} style={{ padding: '4px 12px', background: alpha(pc, 0.1),
                color: pc, borderRadius: 20, fontSize: 9.5, fontWeight: 600, fontFamily: F }}>{m}</span>
            ))}
          </div></>
        )}
        {(acta.contactos ?? []).length > 0 && (
          <><SubTitle text="Contactos de Soporte" />
          <table style={tbl}><thead><tr>
            <th style={TH()}>Nombre</th><th style={TH()}>Área</th><th style={TH()}>Teléfono</th>
          </tr></thead><tbody>
            {(acta.contactos as any[]).map((c: any, i: number) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ ...TD(), fontWeight: 600 }}>{c.nombre}</td>
                <td style={TD()}>{c.area ?? '—'}</td>
                <td style={TD()}>{c.telefono ?? '—'}</td>
              </tr>
            ))}
          </tbody></table></>
        )}
        {(acta.compromisos ?? []).length > 0 && renderCompromisos(acta.compromisos)}
        {(acta.acciones   ?? []).length > 0 && renderAcciones(acta.acciones)}
      </>
    );
  };

  const renderActaEntregaSoporte = (acta: any) => {
    const modCl   = parseChecklist(acta.modulosChecklist,            MODULOS_DEFAULT);
    const infraCl = parseChecklist(acta.infraestructuraChecklist,    INFRA_DEFAULT);
    const docCl   = parseChecklist(acta.documentacionChecklist,      DOCS_DEFAULT);
    const emCl    = parseChecklist(acta.emisionElectronicaChecklist, EMISION_DEFAULT);
    const rCkl = (title: string, items: CheckItem[], showMedio = false) => (
      <><SubTitle text={title} />
      <table style={tbl}><thead><tr>
        <th style={{ ...TH(), width: 28 }}>✓</th><th style={TH()}>Ítem</th>
        <th style={TH()}>Observación</th>
        {showMedio && <th style={{ ...TH(), width: 90 }}>Medio</th>}
      </tr></thead><tbody>
        {items.map((item, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
            <td style={{ ...TD(), textAlign: 'center', fontWeight: 800, fontSize: 13,
              color: item.checked ? '#059669' : '#d1d5db' }}>{item.checked ? '✓' : '○'}</td>
            <td style={{ ...TD(), fontSize: 9.5 }}>{item.label}</td>
            <td style={{ ...TD(), fontSize: 9.5, color: '#6b7280' }}>{item.obs || '—'}</td>
            {showMedio && <td style={{ ...TD(), fontSize: 9.5 }}>{item.medio || '—'}</td>}
          </tr>
        ))}
      </tbody></table></>
    );
    return (
      <>
        <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          {([
            ['NIT Cliente', acta.nitCliente], ['Sedes', acta.sedes],
            ['Resp. Implementación', acta.responsableImplementador],
            ['Resp. Soporte', acta.responsableSoporte],
            ['Modalidad Capacitación', acta.capacitacionModalidad],
            ['Horas Capacitación', acta.capacitacionHoras],
          ] as [string, string][]).filter(([, v]) => v).map(([lbl, val]) => (
            <div key={lbl} style={{ flex: '1 1 130px', padding: '10px 14px', background: '#f8fafc',
              borderRadius: 6, borderLeft: `3px solid ${pc}` }}>
              <div style={{ fontSize: 7.5, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.09em', marginBottom: 3, fontFamily: F }}>{lbl}</div>
              <div style={{ fontWeight: 600, fontSize: 10.5, fontFamily: F }}>{val}</div>
            </div>
          ))}
        </div>
        {rCkl('Módulos del Sistema', modCl)}
        {rCkl('Infraestructura', infraCl)}
        {rCkl('Documentación', docCl, true)}
        {rCkl('Emisión Electrónica', emCl)}
        {acta.observacionesGenerales && (
          <><SubTitle text="Observaciones Generales" />
          <div style={{ fontSize: 10.5, color: '#1f2937', whiteSpace: 'pre-line', fontFamily: F }}>{acta.observacionesGenerales}</div></>
        )}
        {acta.requerimientosAdicionales && (
          <><SubTitle text="Requerimientos Adicionales" />
          <div style={{ fontSize: 10.5, color: '#1f2937', whiteSpace: 'pre-line', fontFamily: F }}>{acta.requerimientosAdicionales}</div></>
        )}
        {acta.ventanasDistintas && (
          <><SubTitle text="Ventanas / Notas Adicionales" />
          <div style={{ fontSize: 10.5, color: '#1f2937', whiteSpace: 'pre-line', fontFamily: F }}>{acta.ventanasDistintas}</div></>
        )}
        {acta.capacitacionPruebas != null && (
          <><SubTitle text="Pruebas de Capacitación" />
          <div style={{ fontSize: 10.5, fontWeight: 700, fontFamily: F,
            color: acta.capacitacionPruebas ? '#059669' : '#d97706' }}>
            {acta.capacitacionPruebas ? '✓ Pruebas realizadas y aprobadas' : '○ Pruebas pendientes'}
          </div></>
        )}
      </>
    );
  };

  const renderActaBody = (acta: any) => {
    switch (acta.type) {
      case 'inicio':          return renderActaInicio(acta);
      case 'visita':          return renderActaVisita(acta);
      case 'capacitacion':    return renderActaCapacitacion(acta);
      case 'cierre':          return renderActaCierre(acta);
      case 'entrega_soporte': return renderActaEntregaSoporte(acta);
      default: return null;
    }
  };

  const GAP = 28;
  const PX  = '36px';

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div id="ica-modal-root"
      className="fixed inset-0 z-[9999] overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
      <div className="min-h-screen py-6 px-4 flex flex-col items-center">

        {/* ── Actions bar ── */}
        <div id="ica-actions-bar"
          className="w-full flex items-center justify-between mb-4 sticky top-4 z-10"
          style={{
            maxWidth: 940,
            background: 'rgba(15,23,42,0.92)',
            backdropFilter: 'blur(10px)',
            borderRadius: 14,
            padding: '8px 12px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
          }}>
          <h2 className="font-bold text-lg text-white flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: alpha(pc, 0.9) }} />
            Informe Ejecutivo
          </h2>
          <div className="flex gap-2">
            <button onClick={downloadPdf} disabled={downloading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow"
              style={{ background: '#059669', opacity: downloading ? 0.7 : 1 }}>
              {downloading
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Descargando…</>
                : pdfReady
                  ? <><Download className="w-4 h-4" /> Descargar PDF</>
                  : <><RefreshCw className="w-3.5 h-3.5 animate-spin opacity-70" /> Preparando…</>
              }
            </button>
            <button onClick={onClose}
              className="p-2 rounded-xl text-white"
              style={{ background: '#dc2626' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Paper ── */}
        <div id="ica-paper" style={{
          width: '100%', maxWidth: 940, background: '#ffffff',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.50)',
          fontFamily: F,
        }}>

          {/* Screen header (hidden in print) */}
          <div id="ica-screen-hdr" style={{ background: pc, padding: '14px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                {company?.logoData
                  ? <img src={company.logoData} alt={nom}
                      style={{ maxHeight: 34, maxWidth: 80, objectFit: 'contain', display: 'block',
                        filter: onPc === '#ffffff' ? 'brightness(0) invert(1)' : 'none' }} />
                  : null}
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: onPc, fontFamily: F }}>{nom}</div>
                <div style={{ fontSize: 9, color: onPc, opacity: 0.65, marginTop: 2, fontFamily: F }}>
                  {[company?.nit ? `NIT: ${company.nit}` : null, company?.city, company?.phone].filter(Boolean).join('  ·  ')}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: onPc, textTransform: 'uppercase',
                  letterSpacing: '0.06em', fontFamily: F }}>Informe Ejecutivo</div>
                <div style={{ fontSize: 9, color: onPc, opacity: 0.65, marginTop: 3, fontFamily: F }}>
                  OS: {os.osNumber}  ·  {new Date(generatedAt).toLocaleDateString('es-CO')}
                </div>
              </div>
            </div>
          </div>
          <div style={{ height: 4, background: `linear-gradient(90deg, ${pc}, ${sc})` }} />

          {/* ══════════════════════════════════════════════════════════════════
              PORTADA
          ══════════════════════════════════════════════════════════════════ */}
          <div id="ica-cover-capture" style={{
            minHeight: 820, display: 'flex', flexDirection: 'column',
            background: '#ffffff', fontFamily: F,
          }}>
            {/* Main content */}
            <div style={{ flex: 1, padding: '44px 44px 32px', display: 'flex',
              flexDirection: 'column', justifyContent: 'space-between' }}>
              {/* Title */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.2em', color: '#9ca3af', marginBottom: 10, fontFamily: F }}>
                  DOCUMENTO EJECUTIVO CONFIDENCIAL
                </div>
                <div style={{ fontSize: 46, fontWeight: 900, color: '#111827', lineHeight: 1.05,
                  letterSpacing: '-0.02em', fontFamily: F }}>
                  Informe<br />Ejecutivo
                </div>
                <div style={{ display: 'flex', marginTop: 16, gap: 6 }}>
                  <div style={{ width: 64, height: 5, background: pc, borderRadius: 3 }} />
                  <div style={{ width: 28, height: 5, background: sc, borderRadius: 3 }} />
                  <div style={{ width: 14, height: 5, background: '#e5e7eb', borderRadius: 3 }} />
                </div>
              </div>

              {/* Client block */}
              <div style={{ borderLeft: `5px solid ${pc}`, padding: '20px 24px',
                background: lighten(pc, 0.95), borderRadius: '0 10px 10px 0' }}>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.18em', color: '#9ca3af', marginBottom: 8, fontFamily: F }}>
                  PREPARADO PARA
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: pc, lineHeight: 1.15, fontFamily: F }}>
                  {os.client?.businessName}
                </div>
                {os.client?.nit && (
                  <div style={{ fontSize: 10.5, color: '#6b7280', marginTop: 6, fontFamily: F }}>
                    NIT: {os.client.nit}
                  </div>
                )}
              </div>

              {/* Metadata grid */}
              <div style={{ display: 'flex', gap: 0, border: '1px solid #e9ecef', borderRadius: 8, overflow: 'hidden' }}>
                {([
                  { label: 'Orden de Servicio',   value: os.osNumber },
                  { label: 'Producto / Servicio',  value: os.product },
                  { label: 'Estado',               value: STATUS_LABEL[os.status] ?? os.status },
                  { label: 'Fecha Generación',     value: fmtLong(generatedAt) },
                  ...(os.startDate ? [{ label: 'Inicio', value: fmt(os.startDate) }] : []),
                  ...(os.endDate   ? [{ label: 'Fin',    value: fmt(os.endDate) }]   : []),
                ] as { label: string; value: string }[]).map(({ label, value }, i, arr) => (
                  <div key={label} style={{ flex: '1 1 0', padding: '14px 16px',
                    borderRight: i < arr.length - 1 ? '1px solid #f0f0f0' : 'none',
                    background: i % 2 === 0 ? '#fafbfc' : '#fff' }}>
                    <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 5, fontFamily: F }}>{label}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#111827', fontFamily: F }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom bar */}
            <div style={{ display: 'flex', height: 10, flexShrink: 0 }}>
              <div style={{ flex: 3, background: pc }} />
              <div style={{ flex: 1, background: sc }} />
              <div style={{ flex: 0.5, background: '#e5e7eb' }} />
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              CUERPO EJECUTIVO
          ══════════════════════════════════════════════════════════════════ */}
          <div id="ica-exec-body" style={{ padding: `${GAP}px ${PX} 28px`,
            display: 'flex', flexDirection: 'column', gap: GAP, background: '#fff' }}>

            {/* ── KPIs ── */}
            <div>
              <SectionTitle n={snKpi} text="Resumen Ejecutivo del Proyecto" />
              <div className="ica-kpi-row" style={{ display: 'flex', gap: 12, marginBottom: 14,
                alignItems: 'stretch', flexWrap: 'wrap' }}>
                {/* Circular progress */}
                <div style={{ flex: '0 0 auto', padding: '20px 24px',
                  background: '#ffffff', border: `1px solid ${alpha(pc, 0.18)}`,
                  borderRadius: 10, display: 'flex', alignItems: 'center', gap: 20,
                  borderTop: `3px solid ${pc}` }}>
                  <CircularProgress pct={progressPct} color={pc} size={80} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', fontFamily: F }}>Avance Global</div>
                    <div style={{ fontSize: 9.5, color: '#6b7280', marginTop: 4, fontFamily: F }}>
                      {doneActs} de {totalActs} actividades completadas
                    </div>
                    <div style={{ marginTop: 10, height: 5, width: 140, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(progressPct, 100)}%`,
                        background: pc, borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
                <KpiMini label="Actas Registradas" color={sc}
                  value={String(actas.length)} sub={`${firmadas} firmadas`}
                  bg={lighten(sc, 0.93)} />
                <KpiMini label="Personal Capacitado" color="#059669"
                  value={String(personalCapacitado.length)}
                  sub={`${personalEnProceso.length} en proceso`}
                  bg="#f0fdf4" />
                <KpiMini label="Días Duración" color="#6366f1"
                  value={os.durationDays ? String(os.durationDays) : '—'}
                  sub={`${fmt(os.startDate)} → ${fmt(os.endDate)}`}
                  bg="#f5f3ff" />
              </div>
              {/* Status ribbon */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { label: `${doneActs} Completadas`,  color: '#065f46', bg: '#d1fae5' },
                  { label: `${inProgActs} En progreso`, color: '#1e40af', bg: '#dbeafe' },
                  { label: `${blockedActs} Bloqueadas`, color: '#991b1b', bg: '#fee2e2' },
                  { label: `${pendActs} Pendientes`,    color: '#92400e', bg: '#fef3c7' },
                ].map(({ label, color, bg }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7,
                    padding: '6px 14px', borderRadius: 20, background: bg }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 9.5, fontWeight: 700, color, fontFamily: F }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── OS Data ── */}
            <div>
              <SectionTitle n={snOS} text="Datos de la Orden de Servicio" />
              <div className="ica-info-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <InfoCard label="No. Orden"           value={os.osNumber} />
                <InfoCard label="Cliente"             value={os.client?.businessName} sub={`NIT: ${os.client?.nit}`} />
                <InfoCard label="Producto / Servicio" value={os.product} />
                <InfoCard label="Estado" accent={STATUS_COLOR[os.status] ?? pc} value={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%',
                      background: STATUS_COLOR[os.status] ?? '#9ca3af', display: 'inline-block' }} />
                    {STATUS_LABEL[os.status] ?? os.status}
                  </span>
                } />
                <InfoCard label="Fecha Inicio" value={fmt(os.startDate)} />
                <InfoCard label="Fecha Fin"    value={fmt(os.endDate)} />
                {os.durationDays && <InfoCard label="Duración"    value={`${os.durationDays} días`} />}
                {os.ticketRubi   && <InfoCard label="Ticket Rubí" value={os.ticketRubi} />}
              </div>
              {(os.scope || os.observations) && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {os.scope && (
                    <div style={{ flex: 1, minWidth: 220, padding: '16px 18px',
                      background: '#fafbfc', border: '1px solid #e9ecef', borderRadius: 8,
                      borderLeft: `4px solid ${pc}` }}>
                      <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 7, fontFamily: F }}>Alcance</div>
                      <div style={{ fontSize: 10.5, color: '#374151', whiteSpace: 'pre-line', fontFamily: F, lineHeight: 1.6 }}>{os.scope}</div>
                    </div>
                  )}
                  {os.observations && (
                    <div style={{ flex: 1, minWidth: 220, padding: '16px 18px',
                      background: '#fafbfc', border: '1px solid #e9ecef', borderRadius: 8,
                      borderLeft: `4px solid ${sc}` }}>
                      <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 7, fontFamily: F }}>Observaciones</div>
                      <div style={{ fontSize: 10.5, color: '#374151', whiteSpace: 'pre-line', fontFamily: F, lineHeight: 1.6 }}>{os.observations}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Team ── */}
            <div>
              <SectionTitle n={snTeam} text="Equipo del Proyecto" />
              {teamRows.length === 0 ? (
                <div style={{ padding: 24, color: '#9ca3af', textAlign: 'center', fontSize: 10.5,
                  background: '#fafbfc', borderRadius: 8, border: '1px solid #e9ecef', fontFamily: F }}>
                  Sin personal asignado
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {teamRows.map(({ rol, p }, i) => (
                    <div key={i} style={{ flex: '1 1 210px', display: 'flex', gap: 13, alignItems: 'flex-start',
                      padding: '15px 17px', border: '1px solid #e9ecef', borderRadius: 10,
                      background: '#fafbfc', borderTop: `3px solid ${i % 2 === 0 ? pc : sc}` }}>
                      <Avatar name={`${p.firstName} ${p.lastName}`} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#111827', fontFamily: F }}>
                          {p.firstName} {p.lastName}
                        </div>
                        <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.09em', color: pc, marginTop: 3, fontFamily: F }}>{rol}</div>
                        {p.jobTitle && <div style={{ fontSize: 9.5, color: '#6b7280', marginTop: 3, fontFamily: F }}>{p.jobTitle}</div>}
                        {p.email    && <div style={{ fontSize: 8.5, color: '#9ca3af', marginTop: 3, fontFamily: F }}>{p.email}</div>}
                        {p.phone    && <div style={{ fontSize: 8.5, color: '#9ca3af', marginTop: 1, fontFamily: F }}>{p.phone}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Notes ── */}
            {snNotes && (notes as any[]).length > 0 && (
              <div>
                <SectionTitle n={snNotes} text="Notas y Observaciones de la Orden" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(notes as any[]).map((n: any) => {
                    const lm = NOTE_LVL[n.noteLevel] ?? { label: n.noteLevel ?? 'General', color: '#374151', bg: '#f3f4f6', border: '#d1d5db' };
                    return (
                      <div key={n.id} style={{ padding: '14px 18px', borderRadius: 8,
                        background: lm.bg, border: `1px solid ${lm.border}`,
                        borderLeft: `4px solid ${lm.color}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.1em', color: lm.color, fontFamily: F }}>
                            {n.noteType === 'interna' ? 'Nota Interna' : n.noteType === 'general' ? 'Nota General' : n.noteType ?? 'Nota'}
                          </span>
                          <Badge label={lm.label} color={lm.color} bg={alpha(lm.color, 0.12)} />
                          {n.noteSubtype && <Badge label={NOTE_SUBTYPE[n.noteSubtype] ?? n.noteSubtype} color="#374151" bg="#f3f4f6" />}
                          <span style={{ marginLeft: 'auto', fontSize: 8.5, color: '#9ca3af', fontFamily: F }}>
                            {fmt(n.createdAt)} · {n.autorNombre}
                          </span>
                        </div>
                        {n.reason && <div style={{ fontSize: 10.5, color: '#1f2937', whiteSpace: 'pre-line', fontFamily: F, lineHeight: 1.6 }}>{n.reason}</div>}
                        {n.noteMitigation && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${lm.border}` }}>
                            <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: '0.09em', color: '#6b7280', marginBottom: 4, fontFamily: F }}>Mitigación</div>
                            <div style={{ fontSize: 10, color: '#374151', whiteSpace: 'pre-line', fontFamily: F }}>{n.noteMitigation}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Project Progress ── */}
            {snProj && project && (
              <div>
                <SectionTitle n={snProj} text="Avance del Proyecto" />
                <div style={{ padding: '20px 22px', background: '#fafbfc',
                  border: `1px solid ${alpha(pc, 0.15)}`, borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: F }}>{project.name}</div>
                      <div style={{ fontSize: 9.5, color: '#6b7280', marginTop: 3, fontFamily: F }}>
                        {STATUS_LABEL[project.status] ?? project.status}  ·  {fmt(project.startDate)} → {fmt(project.endDate)}
                      </div>
                    </div>
                    <div style={{ fontSize: 38, fontWeight: 900, color: pc, fontFamily: F,
                      letterSpacing: '-0.02em' }}>{progressPct}%</div>
                  </div>
                  <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(progressPct, 100)}%`,
                      background: pc, borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 8.5, color: '#9ca3af', marginTop: 9, fontFamily: F }}>
                    {doneActs} completadas · {inProgActs} en progreso · {blockedActs} bloqueadas · {pendActs} pendientes
                  </div>
                </div>
                {(project.modules ?? []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {(project.modules as any[]).map((mod: any) => {
                      const modActs = (mod.phases ?? []).flatMap((p: any) => p.activities ?? []);
                      const modDone = modActs.filter((a: any) => a.status === 'completado').length;
                      const pct    = mod.progressPercent != null
                        ? Math.round(Number(mod.progressPercent))
                        : (modActs.length > 0
                            ? Math.round(modActs.reduce((s: number, a: any) => s + Number(a.progressPercent ?? 0), 0) / modActs.length)
                            : 0);
                      return (
                        <div key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 190, fontSize: 9.5, fontWeight: 600, color: '#374151',
                            fontFamily: F, flexShrink: 0 }}>{mod.name}</div>
                          <div style={{ flex: 1, height: 7, background: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pc, borderRadius: 4 }} />
                          </div>
                          <div style={{ width: 38, fontSize: 10, fontWeight: 800, color: pc,
                            textAlign: 'right', fontFamily: F }}>{pct}%</div>
                          <div style={{ width: 65, fontSize: 8.5, color: '#9ca3af', fontFamily: F }}>
                            {modDone}/{modActs.length} act.
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Plan Activities ── */}
            {snPlan && planActivities.length > 0 && (
              <div>
                <SectionTitle n={snPlan} text="Actividades del Plan de Trabajo" />
                <table style={tbl}>
                  <thead><tr>
                    <th style={TH()}>Módulo</th>
                    <th style={TH()}>Fase</th>
                    <th style={{ ...TH(), width: 64 }}>Código</th>
                    <th style={TH()}>Actividad</th>
                    <th style={{ ...TH(), width: 86 }}>Estado</th>
                    <th style={{ ...TH(), textAlign: 'center', width: 40 }}>%</th>
                    <th style={{ ...TH(), width: 80 }}>Inicio</th>
                    <th style={{ ...TH(), width: 80 }}>Fin</th>
                    <th style={{ ...TH(), width: 80 }}>Ejecución</th>
                    <th style={TH()}>Responsable</th>
                  </tr></thead>
                  <tbody>
                    {planActivities.map((a: any, i: number) => {
                      const meta     = ACT_STATUS[a.status] ?? { label: a.status, color: '#374151', bg: '#f3f4f6' };
                      const assignee = a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : '—';
                      return (
                        <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ ...TD(), fontSize: 9, fontWeight: 700 }}>{a.moduleName}</td>
                          <td style={{ ...TD(), fontSize: 9 }}>{a.phaseName}</td>
                          <td style={{ ...TD(), fontWeight: 700 }}>{a.code}</td>
                          <td style={TD()}>{a.name}</td>
                          <td style={TD()}><Badge {...meta} /></td>
                          <td style={{ ...TD(), textAlign: 'center', fontWeight: 700, color: meta.color }}>
                            {Number(a.progressPercent).toFixed(0)}%
                          </td>
                          <td style={TD()}>{fmt(a.plannedStartDate)}</td>
                          <td style={TD()}>{fmt(a.plannedEndDate)}</td>
                          <td style={TD()}>{fmt(a.executionDate)}</td>
                          <td style={TD()}>{assignee}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Actas Summary ── */}
            <div>
              <SectionTitle n={snActas} text="Resumen de Actas del Proyecto" />
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {(['inicio','visita','capacitacion','cierre','entrega_soporte'] as const).map(t => {
                  const count = actasByType(t).length;
                  return (
                    <div key={t} style={{ flex: '1 1 90px', textAlign: 'center', padding: '18px 12px',
                      borderRadius: 10,
                      background: count > 0 ? alpha(pc, 0.07) : '#fafbfc',
                      border: `1px solid ${count > 0 ? alpha(pc, 0.2) : '#e9ecef'}`,
                      borderTop: `3px solid ${count > 0 ? pc : '#e9ecef'}` }}>
                      <div style={{ fontSize: 9, marginBottom: 6 }}>{TIPO_ICON[t]}</div>
                      <div style={{ fontSize: 28, fontWeight: 900, color: count > 0 ? pc : '#d1d5db',
                        fontFamily: F, lineHeight: 1 }}>{count}</div>
                      <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: count > 0 ? pc : '#9ca3af',
                        marginTop: 6, fontFamily: F }}>{TIPO_SHORT[t]}</div>
                    </div>
                  );
                })}
              </div>
              {actas.length > 0 && (
                <table style={tbl}>
                  <thead><tr>
                    <th style={{ ...TH(), width: 130 }}>Tipo</th>
                    <th style={{ ...TH(), width: 80 }}>Número</th>
                    <th style={{ ...TH(), width: 80 }}>Fecha</th>
                    <th style={TH()}>Ciudad</th>
                    <th style={TH()}>Módulo</th>
                    <th style={{ ...TH(), width: 74 }}>Estado</th>
                    <th style={{ ...TH(), textAlign: 'center', width: 52 }}>Firmas</th>
                  </tr></thead>
                  <tbody>
                    {(actas as any[]).map((acta, i) => {
                      const signed    = (acta.firmantes ?? []).filter((f: any) => f.signedAt).length;
                      const total     = (acta.firmantes ?? []).length;
                      const isFirmada = acta.status === 'firmada';
                      return (
                        <tr key={acta.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ ...TD(), fontSize: 9.5 }}>{TIPO_LABEL[acta.type] ?? acta.type}</td>
                          <td style={{ ...TD(), fontWeight: 700 }}>{acta.numero ?? '—'}</td>
                          <td style={TD()}>{fmt(acta.fecha)}</td>
                          <td style={TD()}>{acta.municipio?.nombreMunicipio ?? acta.ciudad ?? '—'}</td>
                          <td style={TD()}>{acta.modulo?.name ?? '—'}</td>
                          <td style={TD()}>
                            <Badge label={isFirmada ? 'Firmada' : (STATUS_LABEL[acta.status] ?? 'Borrador')}
                              color={isFirmada ? '#065f46' : '#92400e'}
                              bg={isFirmada ? '#dcfce7' : '#fef9c3'} />
                          </td>
                          <td style={{ ...TD(), textAlign: 'center', fontWeight: 700,
                            color: signed === total && total > 0 ? '#059669' : '#374151' }}>
                            {signed}/{total}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Requirements ── */}
            {snReqs && requerimientos.length > 0 && (
              <div>
                <SectionTitle n={snReqs} text="Requerimientos / Tickets" />
                <table style={tbl}>
                  <thead><tr>
                    <th style={{ ...TH(), width: 90 }}>No.</th>
                    <th style={TH()}>Título</th>
                    <th style={{ ...TH(), width: 82 }}>Tipo</th>
                    <th style={{ ...TH(), width: 74 }}>Prioridad</th>
                    <th style={{ ...TH(), width: 100 }}>Estado</th>
                    <th style={{ ...TH(), width: 90 }}>Área</th>
                  </tr></thead>
                  <tbody>
                    {(requerimientos as any[]).map((r, i) => {
                      const pm = PRIO[r.prioridad] ?? { label: r.prioridad ?? '—', color: '#374151', bg: '#f3f4f6' };
                      return (
                        <tr key={r.id} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                          <td style={{ ...TD(), fontWeight: 700 }}>{r.numero}</td>
                          <td style={TD()}>{r.titulo}</td>
                          <td style={TD()}>{r.tipo ?? '—'}</td>
                          <td style={TD()}><Badge {...pm} /></td>
                          <td style={TD()}>{r.estadoActual ?? '—'}</td>
                          <td style={TD()}>{r.area ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Training ── */}
            <div>
              <SectionTitle n={snCap} text="Estado de Capacitación del Personal" />
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Capacitados', count: personalCapacitado.length, color: '#059669', bg: '#f0fdf4' },
                  { label: 'En proceso',  count: personalEnProceso.length,  color: '#2563eb', bg: '#eff6ff' },
                  { label: 'Pendientes',  count: personalPendiente.length,  color: '#d97706', bg: '#fffbeb' },
                ].map(({ label, count, color, bg }) => (
                  <div key={label} style={{ flex: 1, padding: '18px 16px', borderRadius: 10,
                    background: bg, textAlign: 'center', border: `1px solid ${alpha(color, 0.2)}` }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color, fontFamily: F, lineHeight: 1 }}>{count}</div>
                    <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.09em', color, marginTop: 6, fontFamily: F }}>{label}</div>
                  </div>
                ))}
              </div>
              {(personalCapacitado.length + personalEnProceso.length + personalPendiente.length) > 0 ? (
                <table style={tbl}>
                  <thead><tr>
                    <th style={TH()}>Nombre</th>
                    <th style={TH()}>Cargo</th>
                    <th style={TH()}>Área</th>
                    <th style={{ ...TH(), width: 90 }}>Estado</th>
                  </tr></thead>
                  <tbody>
                    {[
                      ...(personalCapacitado as any[]).map(s => ({ ...s, _e: 'Capacitado', _c: '#065f46', _bg: '#dcfce7' })),
                      ...(personalEnProceso  as any[]).map(s => ({ ...s, _e: 'En proceso',  _c: '#1e40af', _bg: '#dbeafe' })),
                      ...(personalPendiente  as any[]).map(s => ({ ...s, _e: 'Pendiente',   _c: '#92400e', _bg: '#fef9c3' })),
                    ].map((s, i) => (
                      <tr key={`${s.id}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ ...TD(), fontWeight: 700 }}>{s.firstName} {s.lastName}</td>
                        <td style={TD()}>{s.jobTitle ?? '—'}</td>
                        <td style={TD()}>{s.area ?? '—'}</td>
                        <td style={TD()}><Badge label={s._e} color={s._c} bg={s._bg} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 20, color: '#9ca3af', fontSize: 10.5, textAlign: 'center',
                  background: '#fafbfc', borderRadius: 8, border: '1px solid #e9ecef', fontFamily: F }}>
                  No hay personal del cliente registrado para esta orden.
                </div>
              )}
            </div>

            {/* Footer del resumen */}
            <div style={{ paddingTop: 16, borderTop: `2px solid ${pc}`,
              display: 'flex', justifyContent: 'space-between',
              fontSize: 8.5, color: '#9ca3af', fontFamily: F }}>
              <span>{nom}  ·  Informe Ejecutivo  ·  Confidencial</span>
              <span>Generado: {new Date(generatedAt).toLocaleString('es-CO')}</span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              ACTAS
          ══════════════════════════════════════════════════════════════════ */}
          {actas.length > 0 && (
            <div style={{ padding: `0 ${PX} 40px`, background: '#fff' }}>

              {/* Portadilla del anexo */}
              <div className="ica-acta-break" style={{
                pageBreakBefore: 'always', breakBefore: 'page',
                padding: '44px 0 36px', marginBottom: 36,
                borderBottom: `3px solid ${pc}`,
              }}>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.2em', color: '#9ca3af', marginBottom: 10, fontFamily: F }}>
                  ANEXO AL INFORME EJECUTIVO
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: pc, fontFamily: F,
                  letterSpacing: '-0.01em' }}>
                  Actas de Implementación
                </div>
                <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 10, fontFamily: F }}>
                  {os.client?.businessName}  ·  OS: {os.osNumber}  ·{' '}
                  {actas.length} acta{actas.length !== 1 ? 's' : ''} registrada{actas.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Each acta */}
              {(actas as any[]).map((acta, idx) => {
                const typeLabel = TIPO_LABEL[acta.type] ?? acta.type;
                const isFirmada = acta.status === 'firmada';
                return (
                  <div key={acta.id} style={{ marginTop: idx > 0 ? 40 : 0 }}>
                    <div className="ica-acta-capture" style={{ background: '#fff', fontFamily: F }}>

                      {/* Acta header */}
                      <div style={{ background: pc, color: onPc, padding: '16px 22px',
                        borderRadius: '10px 10px 0 0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.15em', opacity: 0.65, marginBottom: 4 }}>
                            ANEXO {idx + 1}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.03em',
                            textTransform: 'uppercase' }}>
                            {typeLabel}
                            {acta.numero && (
                              <span style={{ marginLeft: 12, fontSize: 11, opacity: 0.75, fontWeight: 600 }}>
                                #{acta.numero}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 9.5 }}>
                          <span style={{ opacity: 0.80 }}>{fmt(acta.fecha)}</span>
                          <span style={{ opacity: 0.4 }}>·</span>
                          <span style={{ opacity: 0.80 }}>{acta.municipio?.nombreMunicipio ?? acta.ciudad ?? '—'}</span>
                          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 8, fontWeight: 700,
                            background: isFirmada ? '#dcfce7' : '#fef9c3',
                            color: isFirmada ? '#065f46' : '#92400e' }}>
                            {isFirmada ? '✓ Firmada' : 'Borrador'}
                          </span>
                        </div>
                      </div>

                      {/* Thin accent bar */}
                      <div style={{ height: 3, background: sc }} />

                      {/* Content */}
                      <div style={{ border: '1px solid #e9ecef', borderTop: 'none',
                        borderRadius: '0 0 10px 10px', padding: '18px 22px', background: '#fff' }}>
                        <MetaGrid acta={acta} />
                        {renderActaBody(acta)}
                        {renderFirmantes(acta.firmantes ?? [])}
                      </div>

                      {idx < actas.length - 1 && (
                        <div className="ica-no-print" style={{ height: 1, background: '#f0f0f0', marginTop: 40 }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ height: 32 }} />
        </div>
      </div>
    </div>
  );
}
