'use client';
import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, PenLine, CheckCircle2, X, Loader2,
  Upload, RotateCcw, AlertCircle, ExternalLink,
} from 'lucide-react';
import { publicActasApi } from '@/lib/api';
import { SignaturePad, type SignaturePadRef } from '@/components/ui/SignaturePad';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  inicio:          'Acta de Inicio',
  visita:          'Acta de Visita',
  cierre:          'Acta de Cierre',
  capacitacion:    'Acta de Capacitación',
  entrega_soporte: 'Entrega a Soporte',
};

const TYPE_COLOR: Record<string, string> = {
  inicio:          '#34d399',
  visita:          '#60a5fa',
  cierre:          '#a78bfa',
  capacitacion:    '#fb923c',
  entrega_soporte: '#f472b6',
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—';

const fmtDateShort = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—';

function actaNombre(acta: any): string {
  if (!acta) return '—';
  switch (acta.type) {
    case 'inicio':          return acta.asunto || 'Acta de Inicio';
    case 'visita':          return `Acta de Visita — ${fmtDateShort(acta.fecha)}`;
    case 'cierre':          return 'Acta de Cierre';
    case 'capacitacion':    return 'Acta de Capacitación';
    case 'entrega_soporte': return 'Entrega a Soporte';
    default:                return TYPE_LABEL[acta.type] ?? 'Acta';
  }
}

// ── Modal de firma ────────────────────────────────────────────────────────────

function SignModal({ firmanteId, nombre, onClose, onSigned }: {
  firmanteId: string; nombre: string;
  onClose: () => void; onSigned: () => void;
}) {
  const padRef  = useRef<SignaturePadRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab,     setTab]     = useState<'draw' | 'upload'>('draw');
  const [preview, setPreview] = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSign = async () => {
    const data = tab === 'draw' ? padRef.current?.getDataUrl() : preview;
    if (!data) return;
    setSaving(true);
    try {
      const res = await publicActasApi.signFirmante(firmanteId, data);
      if (res?.statusCode >= 400) throw new Error(res.message);
      setDone(true);
    } catch { alert('Error al guardar la firma. Por favor intenta de nuevo.'); }
    finally { setSaving(false); }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
        <div className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: '#0f1629', border: '1px solid rgba(52,211,153,0.30)' }}>
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
            style={{ background: 'rgba(52,211,153,0.15)' }}>
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">¡Firma registrada!</h3>
          <p className="text-sm text-slate-400 mb-6">Tu firma ha sido guardada exitosamente.</p>
          <button onClick={onSigned}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.30)' }}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col"
        style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.12)' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-sm font-semibold text-white">Firmar documento</p>
            <p className="text-xs text-slate-400 mt-0.5">{nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex gap-2 px-5 pt-4">
          {[{ k: 'draw', label: 'Dibujar firma', icon: PenLine }, { k: 'upload', label: 'Cargar imagen', icon: Upload }].map(({ k, label, icon: Icon }) => (
            <button key={k} onClick={() => setTab(k as any)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={tab === k
                ? { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.30)' }
                : { background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4">
          {tab === 'draw' ? (
            <div>
              <p className="text-xs text-slate-400 mb-2">Dibuja tu firma con el dedo, lápiz o mouse</p>
              <SignaturePad ref={padRef} height={180} strokeColor="#1e40af" />
              <button onClick={() => padRef.current?.clear()}
                className="flex items-center gap-1 text-xs mt-2 px-2 py-1 rounded"
                style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
                <RotateCcw className="w-3 h-3" /> Limpiar
              </button>
            </div>
          ) : (
            <div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />
              {preview ? (
                <div className="text-center">
                  <div className="bg-white rounded-xl p-3 flex items-center justify-center" style={{ minHeight: 120 }}>
                    <img src={preview} alt="firma" className="mx-auto" style={{ maxHeight: 100 }} />
                  </div>
                  <button onClick={() => setPreview(null)}
                    className="text-xs mt-2 text-slate-400 flex items-center gap-1 mx-auto">
                    <RotateCcw className="w-3 h-3" /> Cambiar imagen
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full py-12 rounded-xl border-2 border-dashed flex flex-col items-center gap-2"
                  style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#94a3b8' }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = ev => setPreview(ev.target?.result as string);
                    r.readAsDataURL(f);
                  }}>
                  <Upload className="w-8 h-8 opacity-40" />
                  <span className="text-sm font-medium">Toca para seleccionar imagen</span>
                  <span className="text-xs opacity-60">PNG, JPG, WEBP</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm" style={{ color: '#94a3b8' }}>
            Cancelar
          </button>
          <button onClick={handleSign} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.30)' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Confirmar firma'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Página principal ──────────────────────────────────────────────────────────

export default function BuscarFirmasPage() {
  const [documento,  setDocumento]  = useState('');
  const [results,    setResults]    = useState<any[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [error,      setError]      = useState('');

  // Modal de firma rápida (sin salir de la página)
  const [signId,     setSignId]     = useState<string | null>(null);
  const [signNombre, setSignNombre] = useState('');

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!documento.trim()) return;
    setSearching(true);
    setError('');
    setResults([]);
    try {
      const data = await publicActasApi.searchByDocumento(documento.trim());
      if (data?.statusCode >= 400) { setError('Error al buscar. Verifica el número de documento.'); return; }
      setResults(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch { setError('No se pudo conectar al servidor. Verifica tu conexión.'); }
    finally { setSearching(false); }
  }, [documento]);

  const openSign = (firmanteId: string, nombre: string) => {
    setSignId(firmanteId);
    setSignNombre(nombre);
  };

  const onSigned = () => {
    setSignId(null);
    // Remover de la lista
    if (signId) setResults(prev => prev.filter(r => r.id !== signId));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Header */}
      <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.25)' }}>
              <PenLine className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-bold text-base text-white">Portal de Firmas</p>
              <p className="text-xs text-slate-400">Sistemas INFOTEC · AURA ERP</p>
            </div>
          </div>
          <Link href="/login"
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1">
            Iniciar sesión →
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-10 space-y-8">

        {/* Hero */}
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-white mb-2">Firma tus documentos pendientes</h1>
          <p className="text-slate-400 text-sm">
            Ingresa tu número de documento para ver los actas que requieren tu firma
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch}
          className="rounded-2xl p-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Número de documento de identidad
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={documento}
                onChange={e => setDocumento(e.target.value)}
                placeholder="Ej. 1234567890"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button type="submit" disabled={searching || !documento.trim()}
              className="px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
              style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.30)' }}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.20)', color: '#f87171' }}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Sin resultados */}
        {searched && results.length === 0 && !error && (
          <div className="text-center py-12 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400 opacity-60" />
            <p className="font-semibold text-white mb-1">Sin documentos pendientes</p>
            <p className="text-sm text-slate-400">
              No encontramos actas pendientes de firma para el documento <strong className="text-white">{documento}</strong>
            </p>
          </div>
        )}

        {/* Tabla de resultados */}
        {results.length > 0 && (
          <div>
            <p className="text-sm text-slate-400 mb-3">
              <span className="font-semibold text-white">{results.length}</span> documento{results.length !== 1 ? 's' : ''} pendiente{results.length !== 1 ? 's' : ''} de firma
            </p>

            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Nombre del acta</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Proyecto / Cliente</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Ver</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">Firmar</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((item, i) => {
                    const acta   = item.acta;
                    const color  = TYPE_COLOR[acta?.type] ?? '#94a3b8';
                    return (
                      <tr key={item.id}
                        className="border-t transition-colors"
                        style={{ borderColor: 'rgba(255,255,255,0.06)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>

                        {/* Nombre */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                              style={{ background: `${color}20`, color }}>
                              {TYPE_LABEL[acta?.type]?.split(' ')[1] ?? '—'}
                            </span>
                            <span className="font-medium text-white truncate max-w-[200px]">
                              {actaNombre(acta)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 pl-0">
                            {item.nombre} {item.cargo ? `· ${item.cargo}` : ''}
                          </p>
                        </td>

                        {/* Fecha */}
                        <td className="px-4 py-4 text-slate-300 whitespace-nowrap">
                          {fmtDate(acta?.fecha)}
                        </td>

                        {/* Proyecto */}
                        <td className="px-4 py-4">
                          <p className="text-white text-xs font-medium">{acta?.project?.name ?? '—'}</p>
                          <p className="text-slate-500 text-xs">{acta?.project?.serviceOrder?.client?.businessName ?? ''}</p>
                        </td>

                        {/* Ver */}
                        <td className="px-4 py-4 text-center">
                          <Link href={`/firmar/${item.id}`} target="_blank"
                            title="Ver y firmar acta"
                            className="p-2 rounded-xl inline-flex items-center justify-center transition-all"
                            style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.20)' }}>
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </td>

                        {/* Firmar */}
                        <td className="px-4 py-4 text-center">
                          <button onClick={() => openSign(item.id, item.nombre)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold mx-auto transition-all"
                            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                            <PenLine className="w-3.5 h-3.5" /> Firmar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {results.map(item => {
                const acta  = item.acta;
                const color = TYPE_COLOR[acta?.type] ?? '#94a3b8';
                return (
                  <div key={item.id} className="rounded-2xl p-4 space-y-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: `${color}20`, color }}>
                          {TYPE_LABEL[acta?.type] ?? ''}
                        </span>
                        <p className="text-sm font-semibold text-white mt-1">{actaNombre(acta)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmtDate(acta?.fecha)}</p>
                        <p className="text-xs text-slate-500">{acta?.project?.name}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/firmar/${item.id}`} target="_blank"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
                        style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.20)' }}>
                        <ExternalLink className="w-3.5 h-3.5" /> Ver acta
                      </Link>
                      <button onClick={() => openSign(item.id, item.nombre)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold"
                        style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                        <PenLine className="w-3.5 h-3.5" /> Firmar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-700 pt-4">
          © 2024 Sistemas INFOTEC · AURA ERP · Portal de Firmas Digitales
        </p>
      </div>

      {/* Modal firma rápida */}
      {signId && (
        <SignModal
          firmanteId={signId}
          nombre={signNombre}
          onClose={() => setSignId(null)}
          onSigned={onSigned}
        />
      )}
    </div>
  );
}
