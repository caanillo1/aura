'use client';
import { useEffect, useState } from 'react';
import { X, Printer, Loader2, BarChart3, Download, RefreshCw, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { serviceOrdersApi } from '@/lib/api';

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [30, 58, 95];
};

const fmt = (s: string | null | undefined) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const TIPO_LABEL: Record<string, string> = {
  inicio: 'Acta de Inicio',
  visita: 'Acta de Visita',
  capacitacion: 'Acta de Capacitación',
  cierre: 'Acta de Cierre',
  entrega_soporte: 'Entrega a Soporte',
};

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', en_curso: 'En Curso', suspendida: 'Suspendida',
  completada: 'Completada', cancelada: 'Cancelada',
  activo: 'Activo', completado: 'Completado', borrador: 'Borrador',
  firmada: 'Firmada', en_progreso: 'En Progreso', bloqueado: 'Bloqueado',
};

const ACT_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  completado:  { label: 'Completado',  color: '#065f46', bg: '#d1fae5' },
  en_progreso: { label: 'En Progreso', color: '#1e40af', bg: '#dbeafe' },
  bloqueado:   { label: 'Bloqueado',   color: '#991b1b', bg: '#fee2e2' },
};

const PRIO_META: Record<string, { label: string; color: string; bg: string }> = {
  critica: { label: 'Crítica',  color: '#991b1b', bg: '#fee2e2' },
  alta:    { label: 'Alta',     color: '#92400e', bg: '#fef3c7' },
  media:   { label: 'Media',    color: '#1e40af', bg: '#dbeafe' },
  baja:    { label: 'Baja',     color: '#166534', bg: '#f0fdf4' },
};

const NOTE_LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
  critica: { label: 'Crítica', color: '#991b1b', bg: '#fee2e2' },
  alta:    { label: 'Alta',    color: '#92400e', bg: '#fef3c7' },
  media:   { label: 'Media',   color: '#1e40af', bg: '#dbeafe' },
  baja:    { label: 'Baja',    color: '#166534', bg: '#f0fdf4' },
};

const NOTE_SUBTYPE_LABEL: Record<string, string> = {
  proximos_logros: 'Próximos Logros',
  riesgo_critico:  'Riesgo Crítico',
};

interface Props {
  osId: string;
  onClose: () => void;
  autoEmail?: { destinatarios: string[]; asunto?: string };
}

export function InformeEjecutivo({ osId, onClose, autoEmail }: Props) {
  const [data, setData]               = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showEmail, setShowEmail]     = useState(false);
  const [emailTo, setEmailTo]         = useState('');
  const [emailAsunto, setEmailAsunto] = useState('');
  const [sending, setSending]         = useState(false);
  const [autoSending, setAutoSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    serviceOrdersApi.executiveReport(osId)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [osId]);

  useEffect(() => {
    if (!data || !autoEmail) return;
    setAutoSending(true);
    (async () => {
      try {
        const pdf   = await buildPdf();
        const bytes = pdf.output('arraybuffer');
        const b64   = btoa(String.fromCharCode(...Array.from(new Uint8Array(bytes))));
        const osName = (data?.os?.product ?? data?.os?.osNumber ?? 'OS').replace(/[^a-zA-Z0-9-]/g, '_');
        await serviceOrdersApi.sendPdf(osId, {
          destinatarios: autoEmail.destinatarios,
          asunto: autoEmail.asunto,
          pdfBase64: b64,
          filename: `Informe_Ejecutivo_${osName}.pdf`,
        });
        toast.success(`Informe Ejecutivo enviado a ${autoEmail.destinatarios.length} destinatario(s)`);
      } catch {
        toast.error('Error al generar o enviar el Informe Ejecutivo');
      } finally {
        onClose();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const buildPdf = async () => {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF }       = await import('jspdf');

      const paperEl = document.getElementById('ie-paper');
      const theadEl = document.getElementById('ie-thead');
      const sigsEl  = document.getElementById('ie-print-sigs');
      if (!paperEl || !theadEl) throw new Error('No se pudo generar el PDF');

      // ── Spec: A4, márgenes 18/18, área segura 10mm ────────────────────────
      const A4_W = 210, A4_H = 297;  // mm
      const ML   = 18, MR  = 18;     // interior / exterior mm
      const CW   = A4_W - ML - MR;   // 174 mm content width
      // Layout zones (mm from top)
      const HEADER_TOP    = 6;   // top padding
      const LOGO_H        = 10;  // logo height mm
      const FOOTER_LINE_Y = A4_H - 20;          // 277mm — 0.5pt line
      const FOOTER_TEXT_Y = FOOTER_LINE_Y + 8;  // 285mm — footer text baseline
      const CONTENT_BOT   = FOOTER_LINE_Y - 8;  // 269mm — 8mm safety before footer

      // Pre-compute header height so CONTENT_TOP is known before pagination.
      // Must mirror the exact same increments used in drawHeader below.
      const metaLine = [
        company?.nit ? `NIT: ${company.nit}` : null,
        company?.city ?? company?.address ?? null,
        company?.phone ? `Tel: ${company.phone}` : null,
      ].filter(Boolean).join('  ·  ');
      let _y = HEADER_TOP;
      if (company?.logoData) _y += LOGO_H + 3; else _y += 2;
      _y += 6;                    // company name
      if (metaLine) _y += 5;     // NIT / city / phone
      _y += 6;                    // title
      _y += 4;                    // subtitle
      _y += 6;                    // date line (3 text + 3 gap below)
      const HEADER_LINE_Y = _y;   // line sits right after date text
      const CONTENT_TOP   = HEADER_LINE_Y + 12; // 12 mm gap below line
      // Resolution: scale 3 ≈ 288 DPI; quality 0.72 keeps typical doc ≤ 2MB
      const SCALE   = 3;
      const MM_PX96 = 25.4 / 96;  // mm per screen px
      const Q       = 0.72;

      // ── Capture ONLY the body content (thead hidden, sigs shown) ──────────
      const prevSigs = sigsEl?.style.display ?? 'none';
      if (sigsEl) sigsEl.style.display = 'block';
      theadEl.style.display = 'none';
      const cwPx = Math.round(CW / MM_PX96);
      const saved = {
        borderRadius: paperEl.style.borderRadius, boxShadow: paperEl.style.boxShadow,
        maxWidth: paperEl.style.maxWidth, width: paperEl.style.width,
        overflow: paperEl.style.overflow, position: paperEl.style.position,
        top: paperEl.style.top, left: paperEl.style.left,
      };
      Object.assign(paperEl.style, {
        borderRadius: '0', boxShadow: 'none', overflow: 'visible',
        width: `${cwPx}px`, maxWidth: 'none',
        position: 'fixed', top: '-9999px', left: '0',
      });
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const cvs = await html2canvas(paperEl, { scale: SCALE, useCORS: true, backgroundColor: '#ffffff', logging: false });
      Object.assign(paperEl.style, saved);
      theadEl.style.display = '';
      if (sigsEl) sigsEl.style.display = prevSigs;

      // ── Pagination ────────────────────────────────────────────────────────
      const pxPerMm   = cvs.width / CW;
      const pageHpx   = Math.round((CONTENT_BOT - CONTENT_TOP) * pxPerMm);
      const totalPages = Math.ceil(cvs.height / pageHpx);
      const pdf       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const [pr, pg, pb] = hexToRgb(primaryColor);
      const dateStr   = new Date(generatedAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

      // ── drawHeader ────────────────────────────────────────────────────────
      const drawHeader = () => {
        let y = HEADER_TOP;

        // Logo (si existe)
        if (company?.logoData) {
          try {
            const fmt = company.logoData.startsWith('data:image/png') ? 'PNG'
                      : company.logoData.startsWith('data:image/gif') ? 'GIF' : 'JPEG';
            // ancho proporcional estimado: máx 32mm a LOGO_H mm de alto
            pdf.addImage(company.logoData, fmt, ML, y, 32, LOGO_H);
          } catch { /* continuar sin logo si falla */ }
          y += LOGO_H + 3;
        } else {
          y += 2;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12); pdf.setTextColor(17, 24, 39);
        pdf.text(companyName, ML, y + 4); y += 6;

        if (metaLine) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7); pdf.setTextColor(107, 114, 128);
          pdf.text(metaLine, ML, y + 3); y += 5;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11); pdf.setTextColor(31, 41, 55);
        pdf.text('Informe Ejecutivo de Implementación', ML, y + 4); y += 6;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8); pdf.setTextColor(55, 65, 81);
        pdf.text(`${os.client?.businessName}  ·  OS: ${os.osNumber}`, ML, y + 3); y += 4;

        pdf.setFontSize(7); pdf.setTextColor(107, 114, 128);
        pdf.text(`Fecha: ${dateStr}  ·  v1.0  ·  Confidencial`, ML, y + 3);
        y += 6; // avanzar más allá del texto (espeja: _y += 6 en pre-cálculo)

        // Línea separadora 0.5 pt — posición dinámica, siempre bajo el texto de fecha
        pdf.setDrawColor(55, 65, 81); pdf.setLineWidth(0.18);
        pdf.line(ML, y, A4_W - MR, y);
      };

      // ── drawFooter: texto puro, sin imágenes, sin fondos (por spec) ───────
      const drawFooter = (page: number) => {
        pdf.setDrawColor(107, 114, 128); pdf.setLineWidth(0.18);
        pdf.line(ML, FOOTER_LINE_Y, A4_W - MR, FOOTER_LINE_Y);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5); pdf.setTextColor(107, 114, 128);
        pdf.text('Informe Ejecutivo  ·  Confidencial', ML, FOOTER_TEXT_Y);

        pdf.setFontSize(7);
        pdf.text(`Versión 1.0  ·  OS ${os.osNumber}`, A4_W / 2, FOOTER_TEXT_Y, { align: 'center' });

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8); pdf.setTextColor(pr, pg, pb);
        pdf.text(`Página ${page} de ${totalPages}`, A4_W - MR, FOOTER_TEXT_Y, { align: 'right' });
      };

      // ── Render pages ──────────────────────────────────────────────────────
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();
        drawHeader();
        drawFooter(i + 1);

        const curY   = i * pageHpx;
        const sliceH = Math.min(pageHpx, cvs.height - curY);
        if (sliceH > 0) {
          const sc = document.createElement('canvas');
          sc.width = cvs.width; sc.height = sliceH;
          const ctx = sc.getContext('2d')!;
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sc.width, sc.height);
          ctx.drawImage(cvs, 0, curY, cvs.width, sliceH, 0, 0, sc.width, sliceH);
          pdf.addImage(sc.toDataURL('image/jpeg', Q), 'JPEG', ML, CONTENT_TOP, CW, sliceH / pxPerMm);
        }
      }

      return pdf;
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const pdf   = await buildPdf();
      const osName = (data?.os?.product ?? data?.os?.osNumber ?? 'OS').replace(/[^a-zA-Z0-9-]/g, '_');
      pdf.save(`Informe_Ejecutivo_${osName}.pdf`);
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el PDF');
    } finally {
      setDownloading(false);
    }
  };

  const sendByEmail = async () => {
    const dest = emailTo.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
    if (!dest.length) { toast.error('Ingresa al menos un destinatario'); return; }
    setSending(true);
    try {
      const pdf     = await buildPdf();
      const bytes   = pdf.output('arraybuffer');
      const b64     = btoa(String.fromCharCode(...Array.from(new Uint8Array(bytes))));
      const osName  = (data?.os?.product ?? data?.os?.osNumber ?? 'OS').replace(/[^a-zA-Z0-9-]/g, '_');
      await serviceOrdersApi.sendPdf(osId, {
        destinatarios: dest,
        asunto: emailAsunto.trim() || undefined,
        pdfBase64: b64,
        filename: `Informe_Ejecutivo_${osName}.pdf`,
      });
      toast.success(`Informe enviado a ${dest.length} destinatario(s)`);
      setShowEmail(false); setEmailTo(''); setEmailAsunto('');
    } catch (err) {
      console.error(err);
      toast.error('Error al enviar el informe');
    } finally {
      setSending(false);
    }
  };

  const handlePrint = () => {
    const existing = document.getElementById('__ie-print-style');
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = '__ie-print-style';
    /* @page MUST be at top level — Chrome ignores it inside @media print.
       Spec: A4, margins top=0 (header full-bleed), sides=0, bottom=20mm (footer zone).
       @bottom-* boxes provide the footer with 18mm interior/exterior padding. */
    const cn  = data?.company?.commercialName ?? data?.company?.name ?? '';
    const osn = data?.os?.osNumber ?? '';
    const dt  = data?.generatedAt
      ? new Date(data.generatedAt).toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' })
      : '';
    style.textContent = `
      /* @page al nivel raíz — Chrome lo ignora dentro de @media print.
         margin: 0 0 20mm 0 → encabezado full-bleed, 20mm inferior para pie. */
      @page {
        size: A4 portrait;
        margin: 0 0 20mm 0;
        @bottom-left {
          content: "Informe Ejecutivo  ·  Confidencial";
          font-family: Arial, sans-serif; font-size: 7pt; color: #6b7280;
          padding: 5mm 0 0 18mm; border-top: 0.18mm solid #6b7280;
        }
        @bottom-center {
          content: "Versión 1.0  ·  OS ${osn}";
          font-family: Arial, sans-serif; font-size: 7pt; color: #6b7280;
          padding-top: 5mm; border-top: 0.18mm solid #6b7280;
        }
        @bottom-right {
          content: "Página " counter(page) " de " counter(pages);
          font-family: Arial, sans-serif; font-size: 8pt;
          color: ${primaryColor}; font-weight: bold;
          padding: 5mm 18mm 0 0; border-top: 0.18mm solid #6b7280;
        }
      }
      @media print {
        body > * { display: none !important; }
        #ie-modal-root {
          display: block !important; position: static !important;
          background: white !important; padding: 0 !important;
          overflow: visible !important; height: auto !important; width: 100% !important;
        }
        #ie-modal-root > div {
          display: block !important; min-height: 0 !important;
          padding: 0 !important; margin: 0 !important;
        }
        #ie-actions-bar { display: none !important; }
        #ie-print-sigs  { display: block !important; }
        #ie-paper {
          box-shadow: none !important; border-radius: 0 !important;
          max-width: 100% !important; width: 100% !important;
          margin: 0 !important; overflow: visible !important;
        }
        #ie-print-table { width: 100% !important; border-collapse: collapse !important; }
        #ie-thead th    { padding: 0 !important; }
        /* Mostrar encabezado de texto; ocultar banner de pantalla */
        .ie-no-print            { display: none !important; }
        #ie-print-header-text   { display: block !important; }
        /* 12mm gap entre línea separadora y contenido (interior 18mm) */
        #ie-print-table tbody > tr > td {
          padding: 12mm 18mm 8mm 18mm !important;
          vertical-align: top !important;
        }
        .ie-section { page-break-inside: avoid; break-inside: avoid; }
      }
    `;
    document.head.appendChild(style);
    setTimeout(() => {
      window.print();
      document.getElementById('__ie-print-style')?.remove();
    }, 300);
  };

  /* ── Auto-send overlay ── */
  if (autoSending) return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="rounded-2xl p-10 flex flex-col items-center gap-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#4f46e5' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Generando y enviando Informe Ejecutivo…
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Esto puede tomar unos segundos</p>
      </div>
    </div>
  );

  /* ── Pantalla de carga ── */
  if (loading) return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl p-10 flex flex-col items-center gap-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#60a5fa' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Generando informe ejecutivo…
        </p>
      </div>
    </div>
  );

  /* ── Pantalla de error ── */
  if (error) return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl p-10 text-center space-y-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          Error al cargar el informe
        </p>
        <button onClick={onClose}
          className="btn-primary px-5 py-2 rounded-xl text-sm font-semibold text-white">
          Cerrar
        </button>
      </div>
    </div>
  );

  /* ── Datos ── */
  const { company, os, project, actas, requerimientos, notes,
          personalCapacitado, personalEnProceso, personalPendiente, generatedAt } = data;

  const primaryColor  = company?.primaryColor ?? '#1E3A5F';
  const companyName   = company?.commercialName ?? company?.name ?? '';
  const actasByType   = (t: string) => (actas as any[]).filter(a => a.type === t);
  const allActivities = (project?.modules ?? []).flatMap((m: any) =>
    (m.phases ?? []).flatMap((p: any) => p.activities ?? []));
  const doneActivities = allActivities.filter((a: any) => a.status === 'completado').length;

  /* ── Helpers de estilo ── */
  const tbl: React.CSSProperties = {
    width: '100%', borderCollapse: 'collapse',
    fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 11,
  };
  const TH = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: primaryColor, color: '#fff', padding: '6px 10px',
    textAlign: 'left', fontWeight: 700, fontSize: 10, letterSpacing: '0.04em',
    ...extra,
  });
  const TD = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '6px 10px', borderBottom: '1px solid #e5e7eb',
    verticalAlign: 'top', color: '#374151', fontSize: 11,
    ...extra,
  });
  const SecTitle = ({ num, text }: { num: string; text: string }) => (
    <div style={{
      background: primaryColor, color: '#fff', padding: '8px 14px',
      borderRadius: '6px 6px 0 0', fontWeight: 700, fontSize: 11,
      letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      {num}. {text}
    </div>
  );
  const badge = (label: string, color: string, bg: string) => (
    <span style={{ display:'inline-block', padding:'2px 7px', borderRadius:10,
      fontSize:9, fontWeight:700, color, background: bg }}>
      {label}
    </span>
  );

  // Activities from the work plan: completed, in-progress, blocked
  const activitiesWithCtx = (project?.modules ?? []).flatMap((mod: any) =>
    (mod.phases ?? []).flatMap((ph: any) =>
      (ph.activities ?? []).map((act: any) => ({
        ...act,
        moduleName: mod.name,
        phaseName:  ph.name,
      }))
    )
  );
  const planActivities = activitiesWithCtx.filter((a: any) =>
    ['completado', 'en_progreso', 'bloqueado'].includes(a.status)
  );
  const pendienteCount = activitiesWithCtx.filter((a: any) => a.status === 'pendiente').length;

  // Dynamic section numbering
  let _sn = 0;
  const sn = () => String(++_sn);
  const snExec     = sn();
  const snOS       = sn();
  const snNotes    = (notes ?? []).length > 0 ? sn() : null;
  const snTeam     = sn();
  const snProj     = project ? sn() : null;
  const snPlanActs = planActivities.length > 0 ? sn() : null;
  const snActas    = sn();
  const snReqs     = requerimientos.length > 0 ? sn() : null;
  const snCap      = sn();

  // Avance por tipo de módulo
  const _byTipo: Record<string, number[]> = {};
  for (const m of (project?.modules ?? [])) {
    if (!m.tipo) continue;
    (_byTipo[m.tipo] = _byTipo[m.tipo] ?? []).push(Number(m.progressPercent) || 0);
  }
  const tipoAvg = (k: string) => _byTipo[k]?.length
    ? Math.round(_byTipo[k].reduce((s: number, n: number) => s + n, 0) / _byTipo[k].length)
    : null;
  const tipoProgress = {
    asistencial: tipoAvg('asistencial'),
    financiero:  tipoAvg('financiero'),
    mixto:       tipoAvg('mixto'),
  };

  const teamRows = [
    os.clinicalLeader  ? { rol: 'Líder Asistencial',  p: os.clinicalLeader }  : null,
    os.financialLeader ? { rol: 'Líder Financiero',   p: os.financialLeader } : null,
    (os as any).clientLeader ? { rol: 'Líder del Cliente', p: (os as any).clientLeader } : null,
    ...(os.implementers ?? []).map((imp: any) => ({
      rol: `Implementador${imp.role && imp.role !== 'apoyo' ? ` (${imp.role})` : ''}`,
      p: imp.user,
    })),
  ].filter(Boolean) as { rol: string; p: any }[];

  return (
    <div id="ie-modal-root"
      className="fixed inset-0 z-[9999] overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>

      <div className="min-h-screen py-6 px-4 flex flex-col items-center">

        {/* ── Barra de acciones ── */}
        <div id="ie-actions-bar"
          className="w-full flex items-center justify-between mb-4 sticky top-4 z-10"
          style={{ maxWidth: 920 }}>
          <h2 className="font-bold text-lg text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Informe Ejecutivo
          </h2>
          <div className="flex gap-2">
            <button onClick={downloadPdf} disabled={downloading || sending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-lg"
              style={{ background: '#059669', opacity: (downloading || sending) ? 0.7 : 1 }}>
              {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Generando…' : 'Descargar PDF'}
            </button>
            <button onClick={() => setShowEmail(v => !v)} disabled={downloading || sending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-lg"
              style={{ background: showEmail ? '#7c3aed' : '#4f46e5', opacity: (downloading || sending) ? 0.7 : 1 }}>
              <Mail className="w-4 h-4" /> Enviar por correo
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-lg"
              style={{ background: primaryColor }}>
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button onClick={onClose}
              className="p-2 rounded-xl text-white"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.20)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Formulario de correo ── */}
        {showEmail && (
          <div className="w-full mb-4 rounded-2xl p-4 space-y-3"
            style={{ maxWidth: 920, background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.25)' }}>
            <p className="text-sm font-semibold text-white">Enviar informe ejecutivo por correo</p>
            <div>
              <label className="block text-xs font-semibold mb-1 text-indigo-300 uppercase tracking-wide">Destinatarios</label>
              <textarea rows={2} value={emailTo} onChange={e => setEmailTo(e.target.value)}
                placeholder="correo@ejemplo.com, otro@ejemplo.com"
                className="w-full rounded-xl px-3 py-2 text-sm resize-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-indigo-300 uppercase tracking-wide">Asunto (opcional)</label>
              <input value={emailAsunto} onChange={e => setEmailAsunto(e.target.value)}
                placeholder={`Informe Ejecutivo – OS ${data?.os?.osNumber ?? ''}`}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowEmail(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                Cancelar
              </button>
              <button onClick={sendByEmail} disabled={sending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#4f46e5', opacity: sending ? 0.7 : 1 }}>
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {sending ? 'Generando y enviando…' : 'Enviar PDF'}
              </button>
            </div>
          </div>
        )}

        {/* ── Papel del informe ── */}
        <div id="ie-paper" style={{
          width: '100%', maxWidth: 920, background: '#fff',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}>
          {/*
            <table> with <thead> is the ONLY reliable cross-browser way to repeat
            the header on every printed page — the browser handles it natively.
            No position:fixed tricks needed.
          */}
          <table id="ie-print-table" style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
            <thead id="ie-thead">
              <tr>
                <th style={{ padding:0, fontWeight:'normal', textAlign:'left' }}>

                  {/* ── Pantalla: banner de color (oculto en impresión) ── */}
                  <div className="ie-no-print" style={{ background: primaryColor, padding: '22px 30px', color: '#fff' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
                      <div style={{ flex: 1 }}>
                        {company?.logoData && (
                          <img src={company.logoData} alt="Logo"
                            style={{ height: 36, marginBottom: 8, filter: 'brightness(0) invert(1)', objectFit:'contain' }} />
                        )}
                        <div style={{ fontSize:18, fontWeight:800, letterSpacing:'0.04em' }}>{companyName}</div>
                        {company?.nit && <div style={{ fontSize:10, opacity:0.8, marginTop:2 }}>NIT: {company.nit}</div>}
                        {(company?.address || company?.city) && (
                          <div style={{ fontSize:10, opacity:0.7, marginTop:1 }}>
                            {[company.address, company.city].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {(company?.phone || company?.email) && (
                          <div style={{ fontSize:10, opacity:0.7, marginTop:1 }}>
                            {[company.phone ? `Tel: ${company.phone}` : null, company.email].filter(Boolean).join('  ·  ')}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign:'right', minWidth:180 }}>
                        <div style={{ fontSize:15, fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                          Informe Ejecutivo
                        </div>
                        <div style={{ fontSize:12, fontWeight:700, opacity:0.95, marginTop:4 }}>
                          {os.product ?? os.osNumber}
                        </div>
                        <div style={{ fontSize:10, opacity:0.75, marginTop:2 }}>OS: {os.osNumber}</div>
                        <div style={{ fontSize:10, opacity:0.65, marginTop:2 }}>
                          {new Date(generatedAt).toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ie-no-print" style={{ height:4, background:`linear-gradient(90deg, ${primaryColor}, #60a5fa)` }} />

                  {/* ── Impresión: encabezado con logo + texto ── */}
                  <div id="ie-print-header-text" style={{
                    display: 'none',
                    padding: '5mm 18mm 0 18mm',
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    background: '#fff',
                    color: '#111827',
                  }}>
                    {/* Logo */}
                    {company?.logoData && (
                      <img src={company.logoData} alt={companyName}
                        style={{ height: 30, maxWidth: 120, objectFit: 'contain',
                                 display: 'block', marginBottom: 4 }} />
                    )}
                    <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.02em' }}>{companyName}</div>
                    {(company?.nit || company?.city) && (
                      <div style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>
                        {[company?.nit ? `NIT: ${company.nit}` : null, company?.city,
                          company?.phone ? `Tel: ${company.phone}` : null].filter(Boolean).join('  ·  ')}
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', marginTop: 5 }}>
                      Informe Ejecutivo de Implementación
                    </div>
                    <div style={{ fontSize: 9, color: '#374151', marginTop: 3 }}>
                      {os.client?.businessName}  ·  OS: {os.osNumber}  ·  {os.product}
                    </div>
                    <div style={{ fontSize: 7.5, color: '#6b7280', marginTop: 2 }}>
                      Fecha: {new Date(generatedAt).toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' })}
                      {'  ·  Versión 1.0  ·  Confidencial'}
                    </div>
                    {/* Línea separadora 0.5 pt — bajada un poco más */}
                    <div style={{ marginTop: '7mm', borderBottom: '0.5px solid #374151' }} />
                  </div>

                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 0, verticalAlign:'top' }}>

          {/* ── CONTENIDO ── */}
          <div style={{ padding:'26px 30px', display:'flex', flexDirection:'column', gap:24 }}>

            {/* RESUMEN EJECUTIVO */}
            <div className="ie-section">
              <SecTitle num={snExec} text="Resumen Ejecutivo del Proyecto" />
              <div style={{ border:'1px solid #e5e7eb', borderTop:'none', padding:'16px 14px' }}>

                {/* Progreso global + KPIs */}
                <div style={{ display:'flex', gap:12, marginBottom:14 }}>
                  {/* Métrica de progreso */}
                  <div style={{
                    flexShrink:0, padding:'16px 22px',
                    background:`${primaryColor}0d`, borderRadius:8,
                    border:`2px solid ${primaryColor}`,
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    minWidth:120,
                  }}>
                    <div style={{ fontSize:46, fontWeight:900, color:primaryColor, lineHeight:1 }}>
                      {project ? Math.round(Number(project.progressPercent)) : 0}%
                    </div>
                    <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                      letterSpacing:'0.05em', color:'#6b7280', marginTop:6, textAlign:'center' }}>
                      Avance Global
                    </div>
                    <div style={{ marginTop:8, height:6, width:80, background:'#e5e7eb', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:3, background:primaryColor,
                        width:`${Math.min(project ? Number(project.progressPercent) : 0, 100)}%` }} />
                    </div>
                  </div>

                  {/* KPI cards */}
                  <div style={{ flex:1, display:'flex', gap:8 }}>
                    {[
                      {
                        label:'Actividades', value:String(allActivities.length),
                        sub:`${doneActivities} completadas`,
                        color:primaryColor, bg:`${primaryColor}0d`,
                      },
                      {
                        label:'Actas', value:String(actas.length),
                        sub:`${(actas as any[]).filter((a:any) => a.status === 'firmada').length} firmadas`,
                        color:'#059669', bg:'#f0fdf4',
                      },
                      {
                        label:'Capacitados', value:String(personalCapacitado.length),
                        sub:`${personalEnProceso.length} en proceso`,
                        color:'#7c3aed', bg:'#faf5ff',
                      },
                      {
                        label:'Duración', value:os.durationDays ? `${os.durationDays}d` : '—',
                        sub:`${fmt(os.startDate)} – ${fmt(os.endDate)}`,
                        color:'#d97706', bg:'#fffbeb',
                      },
                    ].map(({ label, value, sub, color, bg }) => (
                      <div key={label} style={{
                        flex:1, padding:'12px 10px', background:bg, borderRadius:8,
                        border:`1px solid ${color}33`,
                      }}>
                        <div style={{ fontSize:30, fontWeight:900, color, lineHeight:1 }}>{value}</div>
                        <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                          letterSpacing:'0.05em', color, marginTop:4 }}>{label}</div>
                        <div style={{ fontSize:9, color:'#6b7280', marginTop:3 }}>{sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Estado de actividades */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                  {(() => {
                    const inProg  = activitiesWithCtx.filter((a:any) => ['en_progreso','en_curso','activo'].includes(a.status)).length;
                    const blocked = activitiesWithCtx.filter((a:any) => a.status === 'bloqueado').length;
                    return [
                      { label:`${doneActivities} Completadas`,  color:'#065f46', bg:'#d1fae5' },
                      { label:`${inProg} En Progreso`,          color:'#1e40af', bg:'#dbeafe' },
                      { label:`${blocked} Bloqueadas`,          color:'#991b1b', bg:'#fee2e2' },
                      { label:`${pendienteCount} Pendientes`,   color:'#92400e', bg:'#fef3c7' },
                    ].map(({ label, color, bg }) => (
                      <span key={label} style={{
                        display:'inline-flex', alignItems:'center', gap:5,
                        padding:'4px 10px', borderRadius:12, background:bg,
                        fontSize:9, fontWeight:700, color,
                      }}>
                        <span style={{ width:5, height:5, borderRadius:'50%', background:color, display:'inline-block', flexShrink:0 }} />
                        {label}
                      </span>
                    ));
                  })()}
                </div>

                {/* Avance por tipo de módulo */}
                {(() => {
                  const rows = [
                    { key:'asistencial', label:'Asistencial', color:'#2563eb' },
                    { key:'financiero',  label:'Financiero',  color:'#059669' },
                    { key:'mixto',       label:'Mixto',       color:'#7c3aed' },
                  ].filter(r => tipoProgress[r.key as keyof typeof tipoProgress] != null);
                  if (!rows.length) return null;
                  return (
                    <div style={{ background:'#f9fafb', borderRadius:6, padding:'10px 14px', border:'1px solid #e5e7eb' }}>
                      <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                        letterSpacing:'0.05em', color:'#9ca3af', marginBottom:10 }}>
                        Avance por Tipo de Módulo
                      </div>
                      {rows.map(({ key, label, color }) => {
                        const pct = tipoProgress[key as keyof typeof tipoProgress] ?? 0;
                        return (
                          <div key={key} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                            <span style={{ fontSize:9, fontWeight:700, color, width:72, flexShrink:0 }}>{label}</span>
                            <div style={{ flex:1, height:8, background:'#e5e7eb', borderRadius:4, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${Math.min(pct, 100)}%`, background:color, borderRadius:4 }} />
                            </div>
                            <span style={{ fontSize:10, fontWeight:800, color, width:36, textAlign:'right', flexShrink:0 }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="ie-section">
              <SecTitle num={snOS} text="Datos de la Orden de Servicio" />
              <table style={{ ...tbl, border:'1px solid #e5e7eb', borderTop:'none' }}>
                <tbody>
                  {[
                    ['No. Orden',          os.osNumber],
                    ['Cliente',            `${os.client.businessName}  ·  NIT: ${os.client.nit}`],
                    ['Producto / Servicio', os.product],
                    ['Estado',             STATUS_LABEL[os.status] ?? os.status],
                    ['Fecha Inicio',       fmt(os.startDate)],
                    ['Fecha Fin',          fmt(os.endDate)],
                    ['Duración',           `${os.durationDays} días`],
                    ...(os.ticketRubi ? [['Ticket Rubí', os.ticketRubi]] : []),
                  ].map(([label, value], i) => (
                    <tr key={label} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                      <td style={{ ...TD(), width:190, fontWeight:700, color:'#1f2937', fontSize:10, textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</td>
                      <td style={TD()}>{value}</td>
                    </tr>
                  ))}
                  {os.scope && (
                    <tr style={{ background:'#f9fafb' }}>
                      <td style={{ ...TD(), fontWeight:700, color:'#1f2937', fontSize:10, textTransform:'uppercase', letterSpacing:'0.04em' }}>Alcance</td>
                      <td style={{ ...TD(), whiteSpace:'pre-line' }}>{os.scope}</td>
                    </tr>
                  )}
                  {os.observations && (
                    <tr>
                      <td style={{ ...TD(), fontWeight:700, color:'#1f2937', fontSize:10, textTransform:'uppercase', letterSpacing:'0.04em' }}>Observaciones</td>
                      <td style={{ ...TD(), whiteSpace:'pre-line' }}>{os.observations}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* NOTAS */}
            {snNotes && (notes as any[]).length > 0 && (
              <div className="ie-section">
                <SecTitle num={snNotes} text="Notas de la Orden de Servicio" />
                <table style={{ ...tbl, border:'1px solid #e5e7eb', borderTop:'none' }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH({ background:'#374151' }), width:88 }}>Fecha</th>
                      <th style={{ ...TH({ background:'#374151' }), width:72 }}>Tipo</th>
                      <th style={{ ...TH({ background:'#374151' }), width:70 }}>Nivel</th>
                      <th style={{ ...TH({ background:'#374151' }), width:110 }}>Subtipo</th>
                      <th style={TH({ background:'#374151' })}>Nota</th>
                      <th style={TH({ background:'#374151' })}>Mitigación</th>
                      <th style={{ ...TH({ background:'#374151' }), width:110 }}>Autor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(notes as any[]).map((n: any, i: number) => {
                      const lm = NOTE_LEVEL_META[n.noteLevel] ?? { label: n.noteLevel ?? '—', color:'#374151', bg:'#f3f4f6' };
                      return (
                        <tr key={n.id} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                          <td style={TD()}>{fmt(n.createdAt)}</td>
                          <td style={TD()}>{n.noteType === 'interna' ? 'Interna' : n.noteType === 'general' ? 'General' : n.noteType ?? '—'}</td>
                          <td style={TD()}>{n.noteLevel ? badge(lm.label, lm.color, lm.bg) : '—'}</td>
                          <td style={TD()}>{n.noteSubtype ? (NOTE_SUBTYPE_LABEL[n.noteSubtype] ?? n.noteSubtype) : '—'}</td>
                          <td style={{ ...TD(), whiteSpace:'pre-line' }}>{n.reason ?? '—'}</td>
                          <td style={{ ...TD(), whiteSpace:'pre-line' }}>{n.noteMitigation ?? '—'}</td>
                          <td style={TD()}>{n.autorNombre}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* EQUIPO */}
            <div className="ie-section">
              <SecTitle num={snTeam} text="Equipo del Proyecto" />
              <table style={{ ...tbl, border:'1px solid #e5e7eb', borderTop:'none' }}>
                <thead>
                  <tr>
                    <th style={{ ...TH({ background:'#374151' }), width:160 }}>Rol</th>
                    <th style={TH({ background:'#374151' })}>Nombre</th>
                    <th style={TH({ background:'#374151' })}>Cargo</th>
                    <th style={TH({ background:'#374151' })}>Email</th>
                    <th style={{ ...TH({ background:'#374151' }), width:110 }}>Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRows.map(({ rol, p }, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                      <td style={{ ...TD(), fontWeight:700, fontSize:10 }}>{rol}</td>
                      <td style={{ ...TD(), fontWeight:600 }}>{p.firstName} {p.lastName}</td>
                      <td style={TD()}>{p.jobTitle ?? '—'}</td>
                      <td style={TD()}>{p.email ?? '—'}</td>
                      <td style={TD()}>{p.phone ?? '—'}</td>
                    </tr>
                  ))}
                  {teamRows.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...TD(), color:'#9ca3af', textAlign:'center' }}>Sin personal asignado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* AVANCE DEL PROYECTO */}
            {snProj && project && (
              <div className="ie-section">
                <SecTitle num={snProj} text="Avance del Proyecto" />
                <div style={{ border:'1px solid #e5e7eb', borderTop:'none' }}>
                  {/* Resumen */}
                  <div style={{ padding:'12px 14px', background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                    <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginBottom:10 }}>
                      {[
                        { label:'Proyecto',             value: project.name,                                   bold:true },
                        { label:'Estado',               value: STATUS_LABEL[project.status] ?? project.status, bold:false },
                        { label:'Progreso global',      value: `${Number(project.progressPercent).toFixed(0)}%`, bold:true },
                        { label:'Actividades completas',value: `${doneActivities} / ${allActivities.length}`,  bold:false },
                        { label:'Inicio',               value: fmt(project.startDate),                         bold:false },
                        { label:'Fin',                  value: fmt(project.endDate),                           bold:false },
                      ].map(({ label, value, bold }) => (
                        <div key={label}>
                          <div style={{ fontSize:9, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
                          <div style={{ fontWeight: bold ? 800 : 600, color: bold ? primaryColor : '#1f2937', fontSize: bold ? 14 : 12 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ height:8, background:'#e5e7eb', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:4,
                        width:`${Math.min(Number(project.progressPercent),100)}%`,
                        background:`linear-gradient(90deg, ${primaryColor}, #60a5fa)` }} />
                    </div>
                  </div>

                  {/* Módulos */}
                  {(project.modules ?? []).length > 0 && (
                    <table style={tbl}>
                      <thead>
                        <tr>
                          <th style={TH({ background:'#374151' })}>Módulo</th>
                          <th style={{ ...TH({ background:'#374151' }), width:140 }}>Progreso</th>
                          <th style={{ ...TH({ background:'#374151', textAlign:'center' }), width:60 }}>Fases</th>
                          <th style={{ ...TH({ background:'#374151', textAlign:'center' }), width:80 }}>Actividades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(project.modules as any[]).map((mod, i) => {
                          const modActs  = (mod.phases ?? []).flatMap((p: any) => p.activities ?? []);
                          const modDone  = modActs.filter((a: any) => a.status === 'completado').length;
                          const pct      = Number(mod.progressPercent);
                          return (
                            <tr key={mod.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                              <td style={{ ...TD(), fontWeight:700 }}>{mod.name}</td>
                              <td style={TD()}>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <div style={{ flex:1, height:5, background:'#e5e7eb', borderRadius:3, overflow:'hidden' }}>
                                    <div style={{ height:'100%', width:`${pct}%`, background: primaryColor, borderRadius:3 }} />
                                  </div>
                                  <span style={{ fontSize:10, fontWeight:700, color: primaryColor, minWidth:28 }}>{pct.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td style={{ ...TD(), textAlign:'center' }}>{(mod.phases ?? []).length}</td>
                              <td style={{ ...TD(), textAlign:'center' }}>{modDone}/{modActs.length}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ACTIVIDADES DEL PLAN DE TRABAJO */}
            {snPlanActs && planActivities.length > 0 && (
              <div className="ie-section">
                <SecTitle num={snPlanActs} text="Actividades del Plan de Trabajo" />
                <div style={{ border:'1px solid #e5e7eb', borderTop:'none' }}>
                  {/* Resumen por estado */}
                  <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb' }}>
                    {(['completado','en_progreso','bloqueado'] as const).map(st => {
                      const meta  = ACT_STATUS_META[st];
                      const count = planActivities.filter((a: any) => a.status === st).length;
                      return (
                        <div key={st} style={{ flex:1, padding:'10px 14px', textAlign:'center',
                          background: meta.bg, borderRight:'1px solid #e5e7eb' }}>
                          <div style={{ fontSize:22, fontWeight:800, color: meta.color }}>{count}</div>
                          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                            letterSpacing:'0.05em', color: meta.color, marginTop:2 }}>{meta.label}</div>
                        </div>
                      );
                    })}
                    <div style={{ flex:1, padding:'10px 14px', textAlign:'center',
                      background:'#f3f4f6', borderRight:'1px solid #e5e7eb' }}>
                      <div style={{ fontSize:22, fontWeight:800, color:'#6b7280' }}>{pendienteCount}</div>
                      <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase',
                        letterSpacing:'0.05em', color:'#6b7280', marginTop:2 }}>Pendientes</div>
                    </div>
                  </div>
                  <table style={tbl}>
                    <thead>
                      <tr>
                        <th style={TH({ background:'#374151' })}>Módulo</th>
                        <th style={TH({ background:'#374151' })}>Fase</th>
                        <th style={{ ...TH({ background:'#374151' }), width:72 }}>Código</th>
                        <th style={TH({ background:'#374151' })}>Actividad</th>
                        <th style={{ ...TH({ background:'#374151' }), width:90 }}>Estado</th>
                        <th style={{ ...TH({ background:'#374151', textAlign:'center' }), width:56 }}>%</th>
                        <th style={{ ...TH({ background:'#374151' }), width:90 }}>Inicio Plan</th>
                        <th style={{ ...TH({ background:'#374151' }), width:90 }}>Fin Plan</th>
                        <th style={TH({ background:'#374151' })}>Responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planActivities.map((a: any, i: number) => {
                        const meta = ACT_STATUS_META[a.status] ?? { label: a.status, color:'#374151', bg:'#f3f4f6' };
                        const assignee = a.assignedTo
                          ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}`
                          : '—';
                        return (
                          <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                            <td style={{ ...TD(), fontSize:10, fontWeight:700 }}>{a.moduleName}</td>
                            <td style={{ ...TD(), fontSize:10 }}>{a.phaseName}</td>
                            <td style={{ ...TD(), fontSize:10, fontWeight:700 }}>{a.code}</td>
                            <td style={TD()}>{a.name}</td>
                            <td style={TD()}>{badge(meta.label, meta.color, meta.bg)}</td>
                            <td style={{ ...TD(), textAlign:'center', fontWeight:700, color: meta.color }}>
                              {Number(a.progressPercent).toFixed(0)}%
                            </td>
                            <td style={TD()}>{fmt(a.plannedStartDate)}</td>
                            <td style={TD()}>{fmt(a.plannedEndDate)}</td>
                            <td style={TD()}>{assignee}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ACTAS */}
            <div className="ie-section">
              <SecTitle num={snActas} text="Actas del Proyecto" />
              <div style={{ border:'1px solid #e5e7eb', borderTop:'none' }}>
                {/* Contador por tipo */}
                <div style={{ display:'flex', flexWrap:'wrap', borderBottom:'1px solid #e5e7eb' }}>
                  {(['inicio','visita','capacitacion','cierre','entrega_soporte'] as const).map(type => {
                    const count = actasByType(type).length;
                    return (
                      <div key={type} style={{ padding:'10px 16px', textAlign:'center', flex:'1 1 0', borderRight:'1px solid #e5e7eb' }}>
                        <div style={{ fontSize:20, fontWeight:800, color: count > 0 ? primaryColor : '#d1d5db' }}>{count}</div>
                        <div style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', color:'#9ca3af', marginTop:2 }}>
                          {TIPO_LABEL[type].replace('Acta de ','').replace('Entrega a ','')}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {actas.length === 0 ? (
                  <p style={{ padding:'14px', color:'#9ca3af', fontSize:12, textAlign:'center' }}>
                    No hay actas registradas para este proyecto.
                  </p>
                ) : (
                  <table style={tbl}>
                    <thead>
                      <tr>
                        <th style={{ ...TH({ background:'#374151' }), width:130 }}>Tipo</th>
                        <th style={{ ...TH({ background:'#374151' }), width:90 }}>Número</th>
                        <th style={{ ...TH({ background:'#374151' }), width:88 }}>Fecha</th>
                        <th style={TH({ background:'#374151' })}>Ciudad</th>
                        <th style={TH({ background:'#374151' })}>Módulo</th>
                        <th style={{ ...TH({ background:'#374151' }), width:74 }}>Estado</th>
                        <th style={{ ...TH({ background:'#374151', textAlign:'center' }), width:56 }}>Firmas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(actas as any[]).map((acta, i) => {
                        const signed = (acta.firmantes ?? []).filter((f: any) => f.signedAt).length;
                        const total  = (acta.firmantes ?? []).length;
                        const isFirmada = acta.status === 'firmada';
                        return (
                          <tr key={acta.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                            <td style={{ ...TD(), fontSize:10 }}>{TIPO_LABEL[acta.type] ?? acta.type}</td>
                            <td style={{ ...TD(), fontWeight:700 }}>{acta.numero ?? '—'}</td>
                            <td style={TD()}>{fmt(acta.fecha)}</td>
                            <td style={TD()}>{acta.municipio?.nombreMunicipio ?? acta.ciudad ?? '—'}</td>
                            <td style={TD()}>{acta.modulo?.name ?? '—'}</td>
                            <td style={TD()}>
                              {badge(
                                STATUS_LABEL[acta.status] ?? acta.status ?? 'Borrador',
                                isFirmada ? '#065f46' : '#92400e',
                                isFirmada ? '#d1fae5' : '#fef3c7',
                              )}
                            </td>
                            <td style={{ ...TD(), textAlign:'center', fontWeight:700 }}>
                              {signed}/{total}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* REQUERIMIENTOS */}
            {snReqs && requerimientos.length > 0 && (
              <div className="ie-section">
                <SecTitle num={snReqs} text="Requerimientos / Tickets" />
                <table style={{ ...tbl, border:'1px solid #e5e7eb', borderTop:'none' }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH(), width:100 }}>No.</th>
                      <th style={TH()}>Título</th>
                      <th style={{ ...TH(), width:90 }}>Tipo</th>
                      <th style={{ ...TH(), width:80 }}>Prioridad</th>
                      <th style={{ ...TH(), width:110 }}>Estado</th>
                      <th style={{ ...TH(), width:100 }}>Área</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(requerimientos as any[]).map((r, i) => {
                      const pm = PRIO_META[r.prioridad] ?? { label: r.prioridad ?? '—', color:'#374151', bg:'#f3f4f6' };
                      return (
                        <tr key={r.id} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                          <td style={{ ...TD(), fontWeight:700, fontSize:10 }}>{r.numero}</td>
                          <td style={TD()}>{r.titulo}</td>
                          <td style={TD()}>{r.tipo ?? '—'}</td>
                          <td style={TD()}>{badge(pm.label, pm.color, pm.bg)}</td>
                          <td style={TD()}>{r.estadoActual ?? '—'}</td>
                          <td style={TD()}>{r.area ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ESTADO DE CAPACITACIÓN */}
            <div className="ie-section">
              <SecTitle num={snCap} text="Estado de Capacitación del Personal" />
              <div style={{ border:'1px solid #e5e7eb', borderTop:'none' }}>
                {/* Resumen */}
                <div style={{ display:'flex' }}>
                  {[
                    { label:'Capacitados', count: personalCapacitado.length, color:'#059669', bg:'#d1fae5' },
                    { label:'En proceso',  count: personalEnProceso.length,  color:'#2563eb', bg:'#dbeafe' },
                    { label:'Pendientes',  count: personalPendiente.length,  color:'#d97706', bg:'#fef3c7' },
                  ].map(({ label, count, color, bg }) => (
                    <div key={label} style={{ flex:1, padding:'12px 14px', textAlign:'center', background: bg, borderRight:'1px solid #e5e7eb' }}>
                      <div style={{ fontSize:24, fontWeight:800, color }}>{count}</div>
                      <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color, marginTop:2 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {(personalCapacitado.length + personalEnProceso.length + personalPendiente.length) > 0 && (
                  <table style={tbl}>
                    <thead>
                      <tr>
                        <th style={TH({ background:'#374151' })}>Nombre</th>
                        <th style={TH({ background:'#374151' })}>Cargo</th>
                        <th style={TH({ background:'#374151' })}>Área</th>
                        <th style={{ ...TH({ background:'#374151' }), width:90 }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...(personalCapacitado as any[]).map(s => ({ ...s, _e:'Capacitado', _c:'#059669', _bg:'#d1fae5' })),
                        ...(personalEnProceso  as any[]).map(s => ({ ...s, _e:'En proceso',  _c:'#2563eb', _bg:'#dbeafe' })),
                        ...(personalPendiente  as any[]).map(s => ({ ...s, _e:'Pendiente',   _c:'#d97706', _bg:'#fef3c7' })),
                      ].map((s, i) => (
                        <tr key={`${s.id}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                          <td style={{ ...TD(), fontWeight:700 }}>{s.firstName} {s.lastName}</td>
                          <td style={TD()}>{s.jobTitle ?? '—'}</td>
                          <td style={TD()}>{s.area ?? '—'}</td>
                          <td style={TD()}>{badge(s._e, s._c, s._bg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {(personalCapacitado.length + personalEnProceso.length + personalPendiente.length) === 0 && (
                  <p style={{ padding:'14px', color:'#9ca3af', fontSize:12, textAlign:'center' }}>
                    No hay personal del cliente registrado para esta orden.
                  </p>
                )}
              </div>
            </div>

            {/* PIE */}
            <div style={{ borderTop:'2px solid #e5e7eb', paddingTop:12,
              display:'flex', justifyContent:'space-between',
              fontSize:10, color:'#9ca3af' }}>
              <span>{companyName}  ·  Informe Ejecutivo</span>
              <span>Generado el {new Date(generatedAt).toLocaleString('es-CO')}</span>
            </div>

            {/* FIRMAS — print only */}
            <div id="ie-print-sigs" style={{
              display: 'none', /* shown via @media print CSS */
              pageBreakBefore: 'always',
              paddingTop: 48,
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase',
                letterSpacing:'0.06em', color:'#374151', marginBottom:48 }}>
                Firmas de Aprobación
              </div>
              <div style={{ display:'flex', gap:48 }}>
                {os.clinicalLeader && (
                  <div style={{ flex:1 }}>
                    <div style={{ height:60, borderBottom:'1.5px solid #374151', marginBottom:10 }} />
                    <div style={{ fontWeight:700, fontSize:12, color:'#1f2937' }}>
                      {os.clinicalLeader.firstName} {os.clinicalLeader.lastName}
                    </div>
                    <div style={{ fontSize:10, color:'#6b7280', marginTop:3 }}>
                      {os.clinicalLeader.jobTitle ?? 'Líder Asistencial'}
                    </div>
                    {os.clinicalLeader.email && (
                      <div style={{ fontSize:9, color:'#9ca3af', marginTop:2 }}>{os.clinicalLeader.email}</div>
                    )}
                  </div>
                )}
                {os.financialLeader && (
                  <div style={{ flex:1 }}>
                    <div style={{ height:60, borderBottom:'1.5px solid #374151', marginBottom:10 }} />
                    <div style={{ fontWeight:700, fontSize:12, color:'#1f2937' }}>
                      {os.financialLeader.firstName} {os.financialLeader.lastName}
                    </div>
                    <div style={{ fontSize:10, color:'#6b7280', marginTop:3 }}>
                      {os.financialLeader.jobTitle ?? 'Líder Financiero'}
                    </div>
                    {os.financialLeader.email && (
                      <div style={{ fontSize:9, color:'#9ca3af', marginTop:2 }}>{os.financialLeader.email}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Espacio inferior para scroll */}
        <div style={{ height: 40 }} />
      </div>

    </div>
  );
}
