'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { SignaturePad, type SignaturePadRef } from '@/components/ui/SignaturePad';
import { publicActasApi } from '@/lib/api';
import { ActaDocumento } from '@/components/actas/ActaDocumento';
import {
  PenLine, Upload, RotateCcw, CheckCircle2, AlertCircle,
  Loader2, Download, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  inicio:          'Acta de Inicio',
  visita:          'Acta de Visita',
  cierre:          'Acta de Cierre',
  capacitacion:    'Acta de Capacitacion',
  entrega_soporte: 'Entrega a Soporte',
};

// ─── Wrapper que escala ActaDocumento (794 px de diseño) al ancho disponible ─
// En desktop permanece en 794 px centrado; en tablet/móvil se reduce
// proporcionalmente para que no haya desbordamiento ni scroll horizontal.
const DOC_W = 794;

function ScaledDocWrapper({
  children, contentKey,
}: { children: React.ReactNode; contentKey?: unknown }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [wrapH, setWrapH] = useState(900); // placeholder = minHeight de ActaDocumento

  useEffect(() => {
    const recalc = () => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const s = Math.min(1, outer.clientWidth / DOC_W);
      // scrollHeight devuelve altura de layout, no se ve afectado por transform
      const h = inner.scrollHeight;
      setScale(s);
      setWrapH(h * s);
    };

    // Esperar a que el contenido se pinte antes de medir
    const t = setTimeout(recalc, 80);
    const ro = new ResizeObserver(recalc);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => { clearTimeout(t); ro.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey]); // Re-mide cuando cambia el contenido (firma guardada, etc.)

  return (
    // Centro horizontal: en pantallas anchas el doc queda centrado a 794 px
    <div ref={outerRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
      {/* Caja que toma el espacio visual del doc ya escalado */}
      <div style={{ width: DOC_W * scale, height: wrapH, position: 'relative', flexShrink: 0 }}>
        {/* Contenido a ancho fijo 794 px, escalado desde la esquina superior-izquierda */}
        <div
          ref={innerRef}
          style={{
            width: DOC_W,
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function PublicSignPage() {
  const { firmanteId } = useParams<{ firmanteId: string }>();
  const padRef  = useRef<SignaturePadRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [firmante,    setFirmante]    = useState<any>(null);
  const [actaFull,    setActaFull]    = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [tab,         setTab]         = useState<'draw' | 'upload'>('draw');
  const [preview,     setPreview]     = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [done,        setDone]        = useState(false);
  const [showDoc,     setShowDoc]     = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [comprendio,  setComprendio]  = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([
      publicActasApi.getFirmante(firmanteId),
      publicActasApi.getActaFull(firmanteId),
    ]).then(([f, acta]) => {
      if (f?.statusCode >= 400) { setError('Enlace no valido o expirado.'); return; }
      setFirmante(f);
      setActaFull(acta);
      if (f.signedAt) setDone(true);
    }).catch(() => setError('No se pudo cargar la informacion. Verifica tu conexion.'))
      .finally(() => setLoading(false));
  }, [firmanteId]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const isParticipante = firmante?.signerType === 'participante';
  const needsComprendio = isParticipante && actaFull?.type === 'capacitacion';

  const handleSign = async () => {
    const data = tab === 'draw' ? padRef.current?.getDataUrl() : preview;
    if (!data) {
      alert(tab === 'draw'
        ? 'Por favor dibuja tu firma antes de continuar.'
        : 'Por favor carga una imagen de tu firma.');
      return;
    }
    if (needsComprendio && comprendio === null) {
      alert('Por favor indica si comprendiste el contenido de la capacitación.');
      return;
    }
    setSaving(true);
    try {
      const res = await publicActasApi.signFirmante(
        firmanteId, data,
        needsComprendio ? (comprendio ?? undefined) : undefined,
      );
      if (res?.statusCode >= 400) throw new Error(res.message);
      setDone(true);
      const updated = await publicActasApi.getActaFull(firmanteId);
      setActaFull(updated);
    } catch {
      alert('Error al guardar la firma. Por favor intenta de nuevo.');
    } finally { setSaving(false); }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const company = actaFull?.project?.serviceOrder?.company;
      const res = await fetch('/api/generate-acta-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acta: actaFull, company }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `acta-${actaFull?.type ?? 'doc'}-${actaFull?.numero ?? 'doc'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[download-acta-pdf]', e);
    } finally {
      setDownloading(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Enlace no valido</h2>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // ── Ya firmado ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Header */}
        <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(52,211,153,0.15)' }}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="font-semibold text-sm">Firma Completada</p>
            </div>
            <button onClick={handleDownload} disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa',
                border: '1px solid rgba(96,165,250,0.25)', cursor: 'pointer' }}>
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Descargar PDF
            </button>
          </div>
        </div>

        {/* Confirmacion */}
        <div className="max-w-2xl mx-auto px-5 pt-6 pb-4">
          <div className="rounded-2xl p-5 flex items-start gap-4"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.20)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(52,211,153,0.15)' }}>
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-white">¡Firma registrada exitosamente!</p>
              <p className="text-sm text-slate-400 mt-1">Tu firma ha sido guardada en el sistema AURA ERP.</p>
              <div className="mt-3 space-y-0.5 text-sm">
                <p className="text-white font-medium">{firmante?.nombre}</p>
                {firmante?.cargo && <p className="text-slate-400">{firmante.cargo}</p>}
                {firmante?.empresa && <p className="text-slate-400">{firmante.empresa}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Documento escalado al ancho disponible */}
        {actaFull && (
          <div className="px-4 pb-8">
            <ScaledDocWrapper contentKey={actaFull.id}>
              <ActaDocumento
                acta={actaFull}
                company={actaFull?.project?.serviceOrder?.company}
                currentFirmanteId={firmante?.id}
              />
            </ScaledDocWrapper>
          </div>
        )}
      </div>
    );
  }

  // ── Formulario de firma ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(96,165,250,0.15)' }}>
              <PenLine className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">Firma Digital</p>
              <p className="text-xs text-slate-400">
                {TYPE_LABEL[actaFull?.type ?? ''] ?? 'Documento'} · No. {actaFull?.numero ?? '—'}
              </p>
            </div>
          </div>
          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa',
              border: '1px solid rgba(96,165,250,0.22)', cursor: 'pointer' }}>
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Descargar PDF
          </button>
        </div>
      </div>

      {/* Toggle documento */}
      <div className="max-w-2xl mx-auto px-4 pt-5">
        <button
          onClick={() => setShowDoc(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0' }}>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Ver documento completo
          </div>
          {showDoc
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
      </div>

      {/* Documento escalado al ancho disponible */}
      {showDoc && actaFull && (
        <div className="px-4 py-4">
          <ScaledDocWrapper contentKey={actaFull.id}>
            <ActaDocumento
              acta={actaFull}
              company={actaFull?.project?.serviceOrder?.company}
              currentFirmanteId={firmante?.id}
            />
          </ScaledDocWrapper>
        </div>
      )}

      {/* UI de firma */}
      <div className="max-w-2xl mx-auto px-4 pb-5 space-y-5 mt-5">

        {/* Quien firma */}
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.20)' }}>
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-2">Firmante</p>
          <p className="font-semibold text-base">{firmante?.nombre}</p>
          {firmante?.cargo && <p className="text-sm text-slate-400 mt-0.5">{firmante.cargo}</p>}
          {firmante?.empresa && <p className="text-sm text-slate-400">{firmante.empresa}</p>}
        </div>

        {/* Tabs firma */}
        <div className="flex gap-2">
          {[{ k: 'draw', label: 'Dibujar firma', icon: PenLine }, { k: 'upload', label: 'Cargar imagen', icon: Upload }]
            .map(({ k, label, icon: Icon }) => (
              <button key={k} onClick={() => setTab(k as any)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={tab === k
                  ? { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.30)' }
                  : { background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
        </div>

        {/* Pad / Upload */}
        {tab === 'draw' ? (
          <div>
            <p className="text-xs text-slate-400 mb-3 text-center">
              Usa tu dedo, lapiz stylus o mouse para dibujar tu firma
            </p>
            <SignaturePad ref={padRef} height={200} strokeColor="#1e40af" />
            <button onClick={() => padRef.current?.clear()}
              className="flex items-center gap-1.5 text-xs mt-3 mx-auto px-3 py-1.5 rounded-lg"
              style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.10)' }}>
              <RotateCcw className="w-3.5 h-3.5" /> Limpiar y volver a intentar
            </button>
          </div>
        ) : (
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
              className="hidden" onChange={handleFile} />
            {preview ? (
              <div className="text-center">
                <div className="bg-white rounded-2xl p-4 flex items-center justify-center" style={{ minHeight: 130 }}>
                  <img src={preview} alt="firma" style={{ maxHeight: 110 }} className="mx-auto" />
                </div>
                <button onClick={() => setPreview(null)}
                  className="flex items-center gap-1.5 text-sm mt-3 mx-auto text-slate-400">
                  <RotateCcw className="w-3.5 h-3.5" /> Cambiar imagen
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                className="w-full py-14 rounded-2xl flex flex-col items-center justify-center gap-3"
                style={{ border: '2px dashed rgba(255,255,255,0.12)', color: '#94a3b8' }}>
                <Upload className="w-10 h-10 opacity-50" />
                <span className="font-medium text-sm">Toca para seleccionar imagen</span>
                <span className="text-xs opacity-60">PNG, JPG o WEBP · Firma sobre fondo blanco</span>
              </button>
            )}
          </div>
        )}

        {/* ¿Comprendió? — solo para participantes de capacitación */}
        {needsComprendio && (
          <div className="rounded-2xl p-5"
            style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.20)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#fb923c' }}>
              Confirmación de comprensión
            </p>
            <p className="text-sm text-slate-300 mb-4">
              ¿Comprendiste el contenido de la capacitación impartida?
            </p>
            <div className="flex gap-3">
              {([{ v: true, label: 'Sí, comprendí' }, { v: false, label: 'No comprendí' }] as const).map(({ v, label }) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setComprendio(v)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={comprendio === v
                    ? { background: v ? 'rgba(52,211,153,0.20)' : 'rgba(248,113,113,0.20)',
                        color: v ? '#34d399' : '#f87171',
                        border: `1px solid ${v ? 'rgba(52,211,153,0.40)' : 'rgba(248,113,113,0.40)'}` }
                    : { background: 'rgba(255,255,255,0.04)', color: '#94a3b8',
                        border: '1px solid rgba(255,255,255,0.08)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Boton firmar */}
        <button onClick={handleSign} disabled={saving}
          className="w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-3 active:scale-95"
          style={{
            background: saving ? 'rgba(52,211,153,0.10)' : 'rgba(52,211,153,0.20)',
            color: '#34d399', border: '1px solid rgba(52,211,153,0.35)',
          }}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {saving ? 'Guardando firma...' : 'Confirmar y firmar'}
        </button>

        <p className="text-center text-xs text-slate-600 pb-6">
          Al firmar confirmas la conformidad con el documento indicado.<br />
          Tu firma se guardara de forma segura en el sistema AURA ERP.
        </p>
      </div>
    </div>
  );
}
