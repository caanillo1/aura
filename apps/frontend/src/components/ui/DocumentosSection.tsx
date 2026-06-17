'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, Upload, Trash2, Download, Loader2,
  AlertCircle, Check, File, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { documentosApi, tiposDocumentoApi } from '@/lib/api';
import type { Archivo, TipoDocumento } from '@/types';

const MIME_ICON: Record<string, string> = {
  'application/pdf': '📄',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'image/jpeg': '🖼️', 'image/png': '🖼️',
};
const mimeIcon = (m: string) => MIME_ICON[m] ?? '📁';
const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

interface Props {
  clientId?: string;
  serviceOrderId?: string;
  label?: string;
}

export function DocumentosSection({ clientId, serviceOrderId, label = 'Documentos' }: Props) {
  const [archivos, setArchivos]   = useState<Archivo[]>([]);
  const [tipos,    setTipos]      = useState<TipoDocumento[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [confirm,   setConfirm]   = useState<Archivo | null>(null);
  const [form, setForm] = useState({ tipoDocumentoId: '', nombre: '', descripcion: '' });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (clientId)       params.clientId       = clientId;
      if (serviceOrderId) params.serviceOrderId = serviceOrderId;
      const [res, tiposRes] = await Promise.all([
        documentosApi.list(params),
        tiposDocumentoApi.list(),
      ]);
      setArchivos(res.data);
      setTipos(tiposRes.filter(t => t.activo && (t.scope === 'cliente' || t.scope === 'ambos')));
    } catch { toast.error('Error al cargar documentos'); }
    finally { setLoading(false); }
  }, [clientId, serviceOrderId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async () => {
    if (!file) return toast.error('Selecciona un archivo');
    if (!form.tipoDocumentoId) return toast.error('Selecciona un tipo de documento');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tipoDocumentoId', form.tipoDocumentoId);
      if (form.nombre)      fd.append('nombre',      form.nombre);
      if (form.descripcion) fd.append('descripcion', form.descripcion);
      fd.append('esInterno', 'false');
      if (clientId)       fd.append('clientId',       clientId);
      if (serviceOrderId) fd.append('serviceOrderId', serviceOrderId);
      const nuevo = await documentosApi.upload(fd);
      setArchivos(prev => [nuevo, ...prev]);
      toast.success('Archivo subido');
      setShowForm(false);
      setFile(null);
      setForm({ tipoDocumentoId: '', nombre: '', descripcion: '' });
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al subir');
    } finally { setUploading(false); }
  };

  const handleDelete = async (a: Archivo) => {
    setDeleting(a.id);
    try {
      await documentosApi.delete(a.id);
      setArchivos(prev => prev.filter(x => x.id !== a.id));
      toast.success('Archivo eliminado');
      setConfirm(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al eliminar');
    } finally { setDeleting(null); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {archivos.length} documento{archivos.length !== 1 ? 's' : ''} adjunto{archivos.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => setShowForm(p => !p)}
          className="btn-primary flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white">
          <Upload className="w-3.5 h-3.5" /> Subir archivo
        </button>
      </div>

      {/* Formulario de upload */}
      {showForm && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Nuevo documento</span>
            <button onClick={() => { setShowForm(false); setFile(null); }} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <label className="flex items-center gap-3 rounded-xl border-2 border-dashed border-white/20 px-4 py-3 cursor-pointer hover:border-violet-500/50 transition-all">
            <input ref={fileRef} type="file" className="sr-only" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <><span className="text-xl">{mimeIcon(file.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                </div></>
            ) : (
              <><Upload className="w-5 h-5 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-400">Seleccionar archivo (máx. 50 MB)</span></>
            )}
          </label>

          <select value={form.tipoDocumentoId} onChange={e => setForm(p => ({ ...p, tipoDocumentoId: e.target.value }))}
            className="input-glass w-full rounded-xl px-3 py-2.5 text-sm">
            <option value="">Tipo de documento *</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>

          <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
            placeholder={`Nombre (opcional, por defecto: ${file?.name ?? 'nombre del archivo'})`}
            className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" />

          <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
            placeholder="Descripción (opcional)"
            className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" />

          <button onClick={handleUpload} disabled={uploading}
            className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Subiendo...</> : <><Check className="w-4 h-4" />Subir</>}
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
      ) : archivos.length === 0 ? (
        <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin documentos adjuntos</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
          {archivos.map((a, i) => (
            <div key={a.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors ${
              i < archivos.length - 1 ? 'border-b border-white/8' : ''
            }`}>
              <span className="text-xl shrink-0">{mimeIcon(a.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.nombre}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: `${a.tipoDocumento.color}22`, color: a.tipoDocumento.color }}>
                    {a.tipoDocumento.nombre}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatBytes(a.tamanioBytes)}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(a.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    por {a.subidoPor.firstName} {a.subidoPor.lastName}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => documentosApi.download(a.id, a.nombreOriginal)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors" title="Descargar">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirm(a)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="glass-strong rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300">
                ¿Eliminar <strong className="text-white">{confirm.nombre}</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 border border-white/10 hover:border-white/20 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirm)} disabled={!!deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {deleting === confirm.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
