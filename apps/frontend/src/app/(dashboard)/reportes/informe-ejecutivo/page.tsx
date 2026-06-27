'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import {
  ArrowLeft, Printer, RefreshCw, Loader2, Pencil, Check, X,
  Save, History, ChevronDown, Trash2, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectsApi, companyApi, informesApi } from '@/lib/api';
import type { SnapshotMeta } from '@/lib/api';

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
const STATUS_LABEL: Record<string, string> = {
  activo: 'Activo', pausado: 'Pausado', completado: 'Completado',
  cancelado: 'Cancelado', en_riesgo: 'En riesgo',
};

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—';

// ── celda editable ────────────────────────────────────────────────────────────
function EditableCell({ value, onSave, multiline = false, placeholder = '—', readOnly = false }: {
  value: string; onSave: (v: string) => Promise<void>;
  multiline?: boolean; placeholder?: string; readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [saving,  setSaving]  = useState(false);
  const ref = useRef<any>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = async () => { setSaving(true); await onSave(draft); setSaving(false); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (readOnly) return (
    <span className="text-xs" style={{ color: value ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
      {value || placeholder}
    </span>
  );

  if (editing) {
    const shared = {
      ref, value: draft, onChange: (e: any) => setDraft(e.target.value),
      onKeyDown: (e: any) => { if (e.key === 'Escape') cancel(); if (!multiline && e.key === 'Enter') { e.preventDefault(); save(); } },
      className: 'w-full text-xs rounded px-1.5 py-1 resize-none outline-none',
      style: { background: 'var(--input-bg)', color: 'var(--input-color)', border: '1px solid var(--accent-blue)', minHeight: multiline ? '56px' : undefined },
    };
    return (
      <div>
        {multiline ? <textarea rows={3} {...shared} /> : <input {...shared} />}
        <div className="flex gap-1 mt-1">
          <button onClick={save} disabled={saving} className="p-0.5 rounded text-green-500 hover:bg-green-500/10">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </button>
          <button onClick={cancel} className="p-0.5 rounded text-red-400 hover:bg-red-400/10"><X className="w-3 h-3" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-1 cursor-pointer min-h-[20px]" onClick={() => setEditing(true)}>
      <span className="text-xs flex-1" style={{ color: value ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{value || placeholder}</span>
      <Pencil className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-60 mt-0.5" style={{ color: 'var(--accent-blue)' }} />
    </div>
  );
}

function EditableSelect({ value, options, onSave, readOnly = false }: {
  value: string; options: { value: string; label: string }[];
  onSave: (v: string) => Promise<void>; readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = options.find(o => o.value === value)?.label ?? '—';

  if (readOnly) return <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>;

  if (open) return (
    <select autoFocus value={value}
      onChange={e => { onSave(e.target.value); setOpen(false); }}
      onBlur={() => setOpen(false)}
      className="text-xs rounded px-1 py-0.5 outline-none"
      style={{ background: 'var(--input-bg)', color: 'var(--input-color)', border: '1px solid var(--accent-blue)' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="group flex items-center gap-1 cursor-pointer" onClick={() => setOpen(true)}>
      <span className="text-xs" style={{ color: value ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{label}</span>
      <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60" style={{ color: 'var(--accent-blue)' }} />
    </div>
  );
}

// ── modal guardar snapshot ─────────────────────────────────────────────────────
function GuardarModal({ filas, obs, recs, onClose, onSaved }: {
  filas: FilaInforme[]; obs: string; recs: string;
  onClose: () => void; onSaved: (snap: SnapshotMeta) => void;
}) {
  const now = new Date();
  const defaultTitulo = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .replace(/^\w/, c => c.toUpperCase());
  const [titulo, setTitulo] = useState(defaultTitulo);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!titulo.trim()) { toast.error('Escribe un título'); return; }
    setSaving(true);
    try {
      const result = await informesApi.createSnapshot({
        titulo: titulo.trim(),
        fechaCorte: now.toISOString().split('T')[0],
        datos: filas,
        observaciones: obs,
        recomendaciones: recs,
      });
      toast.success(`Informe "${titulo}" guardado`);
      onSaved({ id: result.id, titulo: result.titulo, fechaCorte: now.toISOString(), createdAt: result.createdAt, creadoPor: '' });
      onClose();
    } catch {
      toast.error('Error al guardar el informe');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Guardar versión del informe</h3>
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Título del informe</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-color)' }} />
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Se guardará una foto de los {filas.length} proyectos tal como están hoy. Podrás consultarla en cualquier momento.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm"
            style={{ border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--accent-blue)', color: '#fff' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── componente principal ──────────────────────────────────────────────────────
export default function InformeEjecutivoPage() {
  const { theme } = useTheme();
  const dark = theme !== 'light';

  const [filas,       setFilas]       = useState<FilaInforme[]>([]);
  const [company,     setCompany]     = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [snapshots,   setSnapshots]   = useState<SnapshotMeta[]>([]);
  const [snapId,      setSnapId]      = useState<string>('actual');
  const [snapOpen,    setSnapOpen]    = useState(false);
  const [showSave,    setShowSave]    = useState(false);
  const [readOnly,    setReadOnly]    = useState(false);
  const snapRef = useRef<HTMLDivElement>(null);

  const [obs,  setObs]  = useState(() => typeof window !== 'undefined' ? localStorage.getItem('informe_obs')  ?? '' : '');
  const [recs, setRecs] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('informe_recs') ?? '' : '');

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const h = (e: MouseEvent) => { if (snapRef.current && !snapRef.current.contains(e.target as Node)) setSnapOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const loadActual = useCallback(async () => {
    setLoading(true);
    setReadOnly(false);
    try {
      const [data, comp, snaps] = await Promise.all([
        projectsApi.getInformeEjecutivo(),
        companyApi.get(),
        informesApi.listSnapshots(),
      ]);
      setFilas(data);
      setCompany(comp);
      setSnapshots(snaps);
    } catch { toast.error('Error al cargar el informe'); }
    finally { setLoading(false); }
  }, []);

  const loadSnapshot = useCallback(async (id: string) => {
    setLoading(true);
    setReadOnly(true);
    try {
      const snap = await informesApi.getSnapshot(id);
      setFilas(snap.datos);
      setObs(snap.observaciones);
      setRecs(snap.recomendaciones);
    } catch { toast.error('Error al cargar la versión'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (snapId === 'actual') loadActual();
    else loadSnapshot(snapId);
  }, [snapId, loadActual, loadSnapshot]);

  const save = async (id: string, field: string, value: string) => {
    await projectsApi.updateDatosInforme(id, { [field]: value });
    setFilas(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleDelete = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar la versión "${titulo}"?`)) return;
    await informesApi.deleteSnapshot(id);
    setSnapshots(prev => prev.filter(s => s.id !== id));
    if (snapId === id) { setSnapId('actual'); }
    toast.success('Versión eliminada');
  };

  // Resumen
  const total       = filas.length;
  const enCurso     = filas.filter(f => f.status === 'activo').length;
  const completados = filas.filter(f => f.status === 'completado').length;
  const pausados    = filas.filter(f => f.status === 'pausado').length;
  const porResponsable = filas.reduce((acc, f) => {
    if (!f.responsableRetraso) return acc;
    acc[f.responsableRetraso] = (acc[f.responsableRetraso] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const snapActual = snapshots.find(s => s.id === snapId);
  const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  const reportDate = snapActual
    ? new Date(snapActual.fechaCorte).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : today;

  return (
    <>
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          table { font-size: 9px !important; }
          th, td { padding: 4px 6px !important; }
        }
      `}</style>

      <div className="p-4 sm:p-6">

        {/* Barra superior */}
        <div className="flex flex-wrap items-center gap-3 mb-6 no-print">
          <Link href="/reportes" className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Informe Ejecutivo General</h1>
            {readOnly && snapActual && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--accent-amber)' }}>
                Versión guardada — solo lectura
              </p>
            )}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">

            {/* Selector de versiones */}
            <div ref={snapRef} className="relative">
              <button onClick={() => setSnapOpen(p => !p)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                <History className="w-4 h-4" />
                {snapId === 'actual' ? 'Actual (en vivo)' : (snapActual?.titulo ?? 'Versión guardada')}
                <ChevronDown className="w-4 h-4" style={{ transform: snapOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
              </button>

              {snapOpen && (
                <div className="absolute right-0 mt-1 w-64 z-50 rounded-xl overflow-hidden"
                  style={{ background: dark ? '#101c2e' : '#fff', border: '1px solid var(--card-border)', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }}>
                  {/* Actual */}
                  <button className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors"
                    style={{ fontWeight: snapId === 'actual' ? 600 : 400, color: snapId === 'actual' ? 'var(--accent-blue)' : 'var(--text-primary)', background: snapId === 'actual' ? 'rgba(96,165,250,0.1)' : 'transparent' }}
                    onClick={() => { setSnapId('actual'); setSnapOpen(false); }}>
                    <Plus className="w-3.5 h-3.5" /> Actual (en vivo)
                  </button>

                  {snapshots.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <p className="px-4 py-1.5 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Versiones guardadas</p>
                      {snapshots.map(s => (
                        <div key={s.id} className="flex items-center group">
                          <button className="flex-1 text-left px-4 py-2 text-sm transition-colors"
                            style={{ fontWeight: snapId === s.id ? 600 : 400, color: snapId === s.id ? 'var(--accent-blue)' : 'var(--text-secondary)', background: snapId === s.id ? 'rgba(96,165,250,0.1)' : 'transparent' }}
                            onClick={() => { setSnapId(s.id); setSnapOpen(false); }}>
                            {s.titulo}
                            <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{s.creadoPor}</span>
                          </button>
                          <button onClick={() => { setSnapOpen(false); handleDelete(s.id, s.titulo); }}
                            className="px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--accent-red)' }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Guardar versión (solo en actual) */}
            {!readOnly && (
              <button onClick={() => setShowSave(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                <Save className="w-4 h-4" /> Guardar versión
              </button>
            )}

            <button onClick={() => snapId === 'actual' ? loadActual() : loadSnapshot(snapId)}
              className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
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

            {/* Título */}
            <div className="text-center py-6 px-4" style={{ background: dark ? '#0d1e36' : '#0a2240', color: '#fff' }}>
              <h1 className="text-2xl font-black tracking-wide uppercase">Informe Ejecutivo</h1>
              <h2 className="text-sm font-semibold tracking-widest uppercase mt-1 opacity-80">
                Estado de Proyectos de Implementación — {company?.name ?? ''}
              </h2>
              <p className="text-xs mt-3 opacity-60">Fecha del informe: {reportDate}</p>
              {readOnly && (
                <span className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }}>
                  Versión histórica — {snapActual?.titulo}
                </span>
              )}
            </div>

            {/* Objetivo */}
            <div className="mx-4 my-4 px-4 py-3 rounded-lg text-sm"
              style={{ background: dark ? 'rgba(255,255,255,0.04)' : '#e8edf3', border: '1px solid rgba(255,255,255,0.08)', color: dark ? '#cbd5e1' : '#334155' }}>
              <span className="font-semibold">Objetivo: </span>
              Presentar el estado actual de los proyectos de implementación, indicando la fecha de inicio, la fecha de entrega comprometida,
              el porcentaje de avance, las causas que han impedido el paso a producción y las acciones requeridas para el cierre de cada proyecto.
            </div>

            {/* Tabla */}
            <div className="mx-4 mb-4 overflow-x-auto rounded-xl">
              <table className="w-full border-collapse text-xs" style={{ minWidth: '900px' }}>
                <thead>
                  <tr style={{ background: dark ? '#0d1e36' : '#0a2240', color: '#fff' }}>
                    {['Semáforo','Cliente','Fecha inicio','Fecha compromiso','Estado actual','% Avance','Motivo de retraso','Responsable','Acción requerida','Nueva fecha'].map(h => (
                      <th key={h} className="text-center font-semibold py-2.5 px-3 text-xs" style={{ whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => {
                    const sem = getSemaforo(f.endDate, f.progressPercent, f.status);
                    const rowBg = i % 2 === 0 ? (dark ? 'rgba(255,255,255,0.02)' : '#ffffff') : (dark ? 'rgba(255,255,255,0.04)' : '#f8fafc');
                    const newDateColor = sem === 'rojo' ? '#ef4444' : sem === 'amarillo' ? '#eab308' : '#22c55e';

                    return (
                      <tr key={f.id} style={{ background: rowBg }}>
                        <td className="text-center py-3 px-3">
                          <div className="flex justify-center">
                            <span className="w-5 h-5 rounded-full inline-block"
                              style={{ background: SEMAFORO_COLOR[sem], boxShadow: `0 0 6px ${SEMAFORO_COLOR[sem]}80` }} />
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{f.clienteNombre}</td>
                        <td className="py-3 px-3 text-center" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt(f.startDate)}</td>
                        <td className="py-3 px-3 text-center" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmt(f.endDate)}</td>
                        <td className="py-3 px-3 text-center" style={{ color: 'var(--text-secondary)' }}>{STATUS_LABEL[f.status] ?? f.status}</td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-sm" style={{ color: SEMAFORO_COLOR[sem] }}>{f.progressPercent}%</span>
                        </td>
                        <td className="py-3 px-3" style={{ minWidth: '160px', maxWidth: '200px' }}>
                          <EditableCell value={f.motivoRetraso} placeholder="Haz clic para editar..." multiline readOnly={readOnly}
                            onSave={v => save(f.id, 'motivoRetraso', v)} />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <EditableSelect value={f.responsableRetraso} readOnly={readOnly}
                            options={[
                              { value: '', label: '—' },
                              { value: 'Cliente', label: 'Cliente' },
                              { value: 'IHCE', label: company?.name?.split(' ')[0] ?? 'Implementador' },
                              { value: 'Compartido', label: 'Compartido' },
                            ]}
                            onSave={v => save(f.id, 'responsableRetraso', v)} />
                        </td>
                        <td className="py-3 px-3" style={{ minWidth: '160px', maxWidth: '200px' }}>
                          <EditableCell value={f.accionRequerida} placeholder="Haz clic para editar..." multiline readOnly={readOnly}
                            onSave={v => save(f.id, 'accionRequerida', v)} />
                        </td>
                        <td className="py-3 px-3 text-center" style={{ minWidth: '100px' }}>
                          {f.nuevaFechaEstimada ? (
                            <span className="text-xs font-bold" style={{ color: newDateColor }}>{fmt(f.nuevaFechaEstimada)}</span>
                          ) : (
                            !readOnly && (
                              <EditableCell value="" placeholder="DD/MM/AAAA" readOnly={false}
                                onSave={async v => {
                                  const parts = v.split('/');
                                  if (parts.length === 3) {
                                    const iso = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                                    await save(f.id, 'nuevaFechaEstimada', iso);
                                  }
                                }} />
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sección inferior */}
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
                  { label: 'Total proyectos',          val: total },
                  { label: 'En curso',                  val: enCurso },
                  { label: 'Completados',                val: completados },
                  { label: 'Pausados',                   val: pausados },
                  { label: 'Retrasos — Cliente',         val: porResponsable['Cliente'] ?? 0 },
                  { label: 'Retrasos — Implementador',   val: porResponsable['IHCE'] ?? 0 },
                  { label: 'Retrasos — Compartidos',     val: porResponsable['Compartido'] ?? 0 },
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
                <textarea value={obs} readOnly={readOnly} rows={7}
                  onChange={e => { setObs(e.target.value); localStorage.setItem('informe_obs', e.target.value); }}
                  className="w-full text-xs resize-none outline-none rounded p-1"
                  style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: readOnly ? 'default' : undefined }}
                  placeholder="Escribe las observaciones generales..." />
              </div>

              {/* Recomendaciones */}
              <div className="rounded-xl p-4" style={{ background: dark ? 'rgba(255,255,255,0.04)' : '#e8edf3', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Recomendaciones</p>
                <textarea value={recs} readOnly={readOnly} rows={7}
                  onChange={e => { setRecs(e.target.value); localStorage.setItem('informe_recs', e.target.value); }}
                  className="w-full text-xs resize-none outline-none rounded p-1"
                  style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: readOnly ? 'default' : undefined }}
                  placeholder="Escribe las recomendaciones..." />
              </div>
            </div>

            <div className="mx-4 mb-4 px-4 py-2 rounded-lg text-xs text-center"
              style={{ background: dark ? 'rgba(96,165,250,0.08)' : 'rgba(37,99,235,0.06)', color: 'var(--text-muted)' }}>
              <span className="font-semibold">Nota:</span> Las nuevas fechas estimadas están sujetas a la validación y cumplimiento de los compromisos por parte del cliente.
            </div>
          </div>
        )}
      </div>

      {showSave && (
        <GuardarModal filas={filas} obs={obs} recs={recs}
          onClose={() => setShowSave(false)}
          onSaved={snap => { setSnapshots(prev => [snap, ...prev]); }} />
      )}
    </>
  );
}
