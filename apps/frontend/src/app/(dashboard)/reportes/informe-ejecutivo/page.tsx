'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { ArrowLeft, Printer, RefreshCw, Loader2, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { projectsApi, companyApi } from '@/lib/api';

// ── tipos ─────────────────────────────────────────────────────────────────────
interface FilaInforme {
  id: string;
  clienteNombre: string;
  osNumber: string;
  startDate: string;
  endDate: string;
  status: string;
  progressPercent: number;
  motivoRetraso: string;
  responsableRetraso: string;
  accionRequerida: string;
  nuevaFechaEstimada: string | null;
}

// ── semáforo ──────────────────────────────────────────────────────────────────
function getSemaforo(endDate: string, progress: number, status: string): 'verde' | 'amarillo' | 'rojo' {
  if (status === 'completado') return 'verde';
  const daysPast = Math.floor((Date.now() - new Date(endDate).getTime()) / 86400000);
  if (daysPast > 30 || (daysPast > 0 && progress < 50)) return 'rojo';
  if (daysPast > 0 || (daysPast > -30 && progress < 70)) return 'amarillo';
  return 'verde';
}

const SEMAFORO_COLOR = { verde: '#22c55e', amarillo: '#eab308', rojo: '#ef4444' };
const SEMAFORO_LABEL = { verde: 'En fecha', amarillo: 'Riesgo de retraso', rojo: 'Retraso crítico' };

// ── formato fecha ─────────────────────────────────────────────────────────────
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—';

// ── estado legible ─────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  activo: 'Activo', pausado: 'Pausado', completado: 'Completado',
  cancelado: 'Cancelado', en_riesgo: 'En riesgo',
};

// ── celda editable inline ─────────────────────────────────────────────────────
function EditableCell({
  value, onSave, multiline = false, placeholder = '—',
}: { value: string; onSave: (v: string) => Promise<void>; multiline?: boolean; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [saving,  setSaving]  = useState(false);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    const props = {
      ref, value: draft, onChange: (e: any) => setDraft(e.target.value),
      onKeyDown: (e: any) => { if (e.key === 'Escape') cancel(); if (!multiline && e.key === 'Enter') { e.preventDefault(); save(); } },
      className: 'w-full text-xs rounded px-1.5 py-1 resize-none outline-none focus:ring-1 focus:ring-blue-500',
      style: { background: 'var(--input-bg)', color: 'var(--input-color)', border: '1px solid var(--accent-blue)', minHeight: multiline ? '60px' : undefined },
    };
    return (
      <div className="relative">
        {multiline ? <textarea rows={3} {...props as any} /> : <input {...props as any} />}
        <div className="flex gap-1 mt-1">
          <button onClick={save} disabled={saving}
            className="p-0.5 rounded text-green-500 hover:bg-green-500/10 transition-colors">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </button>
          <button onClick={cancel} className="p-0.5 rounded text-red-400 hover:bg-red-400/10 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-1 cursor-pointer min-h-[24px]" onClick={() => setEditing(true)}>
      <span className="text-xs flex-1" style={{ color: value ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
        {value || placeholder}
      </span>
      <Pencil className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity mt-0.5" style={{ color: 'var(--accent-blue)' }} />
    </div>
  );
}

// ── select editable inline ─────────────────────────────────────────────────────
function EditableSelect({
  value, options, onSave,
}: { value: string; options: { value: string; label: string }[]; onSave: (v: string) => Promise<void> }) {
  const [editing, setSaving2] = useState(false);
  const save = async (v: string) => { setSaving2(true); await onSave(v); setSaving2(false); };
  const label = options.find(o => o.value === value)?.label ?? '—';

  if (editing) {
    return (
      <select autoFocus value={value}
        onChange={e => { save(e.target.value); setSaving2(false); }}
        onBlur={() => setSaving2(false)}
        className="text-xs rounded px-1 py-0.5 outline-none"
        style={{ background: 'var(--input-bg)', color: 'var(--input-color)', border: '1px solid var(--accent-blue)' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <div className="group flex items-center gap-1 cursor-pointer" onClick={() => setSaving2(true)}>
      <span className="text-xs" style={{ color: value ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{label}</span>
      <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--accent-blue)' }} />
    </div>
  );
}

// ── componente principal ──────────────────────────────────────────────────────
export default function InformeEjecutivoPage() {
  const { theme } = useTheme();
  const dark = theme !== 'light';

  const [filas,     setFilas]     = useState<FilaInforme[]>([]);
  const [company,   setCompany]   = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [obs,       setObs]       = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('informe_obs') ?? [
      'Demoras en la entrega de información por parte del cliente.',
      'Falta de disponibilidad de usuarios para capacitación y pruebas.',
      'Pendientes de parametrización.',
      'Ajustes funcionales solicitados durante la implementación.',
    ].join('\n');
  });
  const [recs, setRecs] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('informe_recs') ?? [
      'Definir nuevas fechas de compromiso con aprobación formal del cliente.',
      'Escalar los proyectos con retrasos superiores a 30 días.',
      'Realizar seguimiento semanal a los compromisos pendientes.',
      'Formalizar mediante acta cualquier modificación del alcance o cronograma.',
    ].join('\n');
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, comp] = await Promise.all([
        projectsApi.getInformeEjecutivo(),
        companyApi.get(),
      ]);
      setFilas(data);
      setCompany(comp);
    } catch {
      toast.error('Error al cargar el informe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (id: string, field: string, value: string) => {
    await projectsApi.updateDatosInforme(id, { [field]: value });
    setFilas(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  // Resumen ejecutivo
  const total        = filas.length;
  const enProduccion = filas.filter(f => f.status === 'completado').length;
  const pendientes   = total - enProduccion;
  const porResponsable = filas.reduce((acc, f) => {
    if (!f.responsableRetraso) return acc;
    acc[f.responsableRetraso] = (acc[f.responsableRetraso] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-page { padding: 0 !important; }
          table { font-size: 9px !important; }
          th, td { padding: 4px 6px !important; }
        }
      `}</style>

      <div className="p-4 sm:p-6 print-page">

        {/* Header de navegación */}
        <div className="flex items-center gap-3 mb-6 no-print">
          <Link href="/reportes"
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Informe Ejecutivo General</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={load}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--accent-blue)', color: '#fff' }}>
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-blue)' }} />
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: dark ? '#0b1524' : '#f0f4f8', border: '1px solid var(--card-border)', fontFamily: 'Arial, sans-serif' }}>

            {/* ── Título ── */}
            <div className="text-center py-6 px-4"
              style={{ background: dark ? '#0d1e36' : '#0a2240', color: '#fff' }}>
              <h1 className="text-2xl font-black tracking-wide uppercase">Informe Ejecutivo</h1>
              <h2 className="text-sm font-semibold tracking-widest uppercase mt-1 opacity-80">
                Estado de Proyectos de Implementación — {company?.name ?? ''}
              </h2>
              <p className="text-xs mt-3 opacity-60">Fecha del informe: {today}</p>
            </div>

            {/* ── Objetivo ── */}
            <div className="mx-4 my-4 px-4 py-3 rounded-lg text-sm"
              style={{ background: dark ? 'rgba(255,255,255,0.04)' : '#e8edf3', border: '1px solid rgba(255,255,255,0.08)', color: dark ? '#cbd5e1' : '#334155' }}>
              <span className="font-semibold">Objetivo: </span>
              Presentar el estado actual de los proyectos de implementación, indicando la fecha de inicio, la fecha de entrega comprometida,
              el porcentaje de avance, las causas que han impedido el paso a producción y las acciones requeridas para el cierre de cada proyecto.
            </div>

            {/* ── Tabla ── */}
            <div className="mx-4 mb-4 overflow-x-auto rounded-xl">
              <table className="w-full border-collapse text-xs" style={{ minWidth: '900px' }}>
                <thead>
                  <tr style={{ background: dark ? '#0d1e36' : '#0a2240', color: '#fff' }}>
                    {[
                      'Semáforo', 'Cliente', 'Fecha inicio', 'Fecha compromiso', 'Estado actual',
                      '% Avance', 'Motivo de retraso', 'Responsable', 'Acción requerida', 'Nueva fecha',
                    ].map(h => (
                      <th key={h} className="text-center font-semibold py-2.5 px-3 text-xs" style={{ whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => {
                    const sem   = getSemaforo(f.endDate, f.progressPercent, f.status);
                    const rowBg = i % 2 === 0
                      ? (dark ? 'rgba(255,255,255,0.02)' : '#ffffff')
                      : (dark ? 'rgba(255,255,255,0.04)' : '#f8fafc');
                    const newDateColor = sem === 'rojo' ? '#ef4444' : sem === 'amarillo' ? '#eab308' : '#22c55e';

                    return (
                      <tr key={f.id} style={{ background: rowBg }}>
                        {/* Semáforo */}
                        <td className="text-center py-3 px-3">
                          <div className="flex justify-center">
                            <span className="w-5 h-5 rounded-full inline-block"
                              style={{ background: SEMAFORO_COLOR[sem], boxShadow: `0 0 6px ${SEMAFORO_COLOR[sem]}80` }} />
                          </div>
                        </td>
                        {/* Cliente */}
                        <td className="py-3 px-3 font-semibold" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {f.clienteNombre}
                        </td>
                        {/* Fecha inicio */}
                        <td className="py-3 px-3 text-center" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {fmt(f.startDate)}
                        </td>
                        {/* Fecha compromiso */}
                        <td className="py-3 px-3 text-center" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {fmt(f.endDate)}
                        </td>
                        {/* Estado */}
                        <td className="py-3 px-3 text-center" style={{ color: 'var(--text-secondary)' }}>
                          {STATUS_LABEL[f.status] ?? f.status}
                        </td>
                        {/* % Avance */}
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-sm" style={{ color: SEMAFORO_COLOR[sem] }}>
                            {f.progressPercent}%
                          </span>
                        </td>
                        {/* Motivo (editable) */}
                        <td className="py-3 px-3" style={{ minWidth: '160px', maxWidth: '200px' }}>
                          <EditableCell
                            value={f.motivoRetraso}
                            placeholder="Haz clic para editar..."
                            multiline
                            onSave={v => save(f.id, 'motivoRetraso', v)}
                          />
                        </td>
                        {/* Responsable (editable) */}
                        <td className="py-3 px-3 text-center">
                          <EditableSelect
                            value={f.responsableRetraso}
                            options={[
                              { value: '', label: '—' },
                              { value: 'Cliente', label: 'Cliente' },
                              { value: 'IHCE', label: company?.name?.split(' ')[0] ?? 'IHCE' },
                              { value: 'Compartido', label: 'Compartido' },
                            ]}
                            onSave={v => save(f.id, 'responsableRetraso', v)}
                          />
                        </td>
                        {/* Acción requerida (editable) */}
                        <td className="py-3 px-3" style={{ minWidth: '160px', maxWidth: '200px' }}>
                          <EditableCell
                            value={f.accionRequerida}
                            placeholder="Haz clic para editar..."
                            multiline
                            onSave={v => save(f.id, 'accionRequerida', v)}
                          />
                        </td>
                        {/* Nueva fecha (editable) */}
                        <td className="py-3 px-3 text-center" style={{ minWidth: '100px' }}>
                          <EditableCell
                            value={f.nuevaFechaEstimada ? fmt(f.nuevaFechaEstimada) : ''}
                            placeholder="DD/MM/AAAA"
                            onSave={async v => {
                              // parse dd/mm/yyyy → yyyy-mm-dd
                              const parts = v.split('/');
                              if (parts.length === 3) {
                                const iso = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                                await save(f.id, 'nuevaFechaEstimada', iso);
                              }
                            }}
                          />
                          {f.nuevaFechaEstimada && (
                            <span className="text-xs font-bold" style={{ color: newDateColor }}>
                              {fmt(f.nuevaFechaEstimada)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Sección inferior ── */}
            <div className="mx-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">

              {/* Leyenda */}
              <div className="rounded-xl p-4" style={{ background: dark ? 'rgba(255,255,255,0.04)' : '#e8edf3', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Leyenda Semáforo</p>
                {(['verde','amarillo','rojo'] as const).map(s => (
                  <div key={s} className="flex items-center gap-2 mb-2">
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ background: SEMAFORO_COLOR[s] }} />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{SEMAFORO_LABEL[s]}</span>
                  </div>
                ))}
              </div>

              {/* Resumen Ejecutivo */}
              <div className="rounded-xl p-4" style={{ background: dark ? 'rgba(255,255,255,0.04)' : '#e8edf3', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Resumen Ejecutivo</p>
                {[
                  { label: 'Total proyectos activos', val: total },
                  { label: 'En producción', val: enProduccion },
                  { label: 'Pendientes de salida', val: pendientes },
                  { label: 'Retrasos — Cliente', val: porResponsable['Cliente'] ?? 0 },
                  { label: 'Retrasos — Implementador', val: porResponsable['IHCE'] ?? 0 },
                  { label: 'Retrasos — Compartidos', val: porResponsable['Compartido'] ?? 0 },
                ].map(r => (
                  <div key={r.label} className="flex justify-between items-center mb-1.5">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.label}:</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{r.val}</span>
                  </div>
                ))}
              </div>

              {/* Observaciones */}
              <div className="rounded-xl p-4" style={{ background: dark ? 'rgba(255,255,255,0.04)' : '#e8edf3', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Observaciones</p>
                <textarea
                  value={obs}
                  onChange={e => { setObs(e.target.value); localStorage.setItem('informe_obs', e.target.value); }}
                  rows={7}
                  className="w-full text-xs resize-none outline-none rounded p-1"
                  style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none' }}
                  placeholder="Escribe las observaciones generales..."
                />
              </div>

              {/* Recomendaciones */}
              <div className="rounded-xl p-4" style={{ background: dark ? 'rgba(255,255,255,0.04)' : '#e8edf3', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Recomendaciones</p>
                <textarea
                  value={recs}
                  onChange={e => { setRecs(e.target.value); localStorage.setItem('informe_recs', e.target.value); }}
                  rows={7}
                  className="w-full text-xs resize-none outline-none rounded p-1"
                  style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none' }}
                  placeholder="Escribe las recomendaciones..."
                />
              </div>
            </div>

            {/* Nota al pie */}
            <div className="mx-4 mb-4 px-4 py-2 rounded-lg text-xs text-center"
              style={{ background: dark ? 'rgba(96,165,250,0.08)' : 'rgba(37,99,235,0.06)', color: 'var(--text-muted)' }}>
              <span className="font-semibold">Nota:</span> Las nuevas fechas estimadas están sujetas a la validación y cumplimiento de los compromisos por parte del cliente.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
