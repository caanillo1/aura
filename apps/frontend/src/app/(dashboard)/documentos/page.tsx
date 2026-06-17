'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, Upload, Trash2, Download, Plus, Pencil,
  X, FileText, Search, Tag, Building2, Briefcase,
  Globe, Loader2, AlertCircle, Check, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight, File, CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { documentosApi, tiposDocumentoApi, clientsApi, serviceOrdersApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import type { TipoDocumento, Archivo, Client, ServiceOrder } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const MIME_ICON: Record<string, string> = {
  'application/pdf': '📄',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/vnd.ms-powerpoint': '📋',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📋',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/gif': '🖼️',
  'text/plain': '📃',
  'application/zip': '🗜️',
};

function mimeIcon(mime: string) {
  return MIME_ICON[mime] ?? '📁';
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Modal genérico ────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children, width = 'max-w-lg' }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.18 }}
        className={`glass-strong rounded-2xl w-full ${width} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </motion.div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

type Tab = 'repositorio' | 'tipos';

export default function DocumentosPage() {
  const { theme } = useTheme();
  const isLight    = theme === 'light';
  const { canAny } = usePermission();
  const canManage  = canAny('admin', 'coordinator');

  const tc = {
    card:  isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.04)',
    border: isLight ? 'rgba(30,60,120,0.12)'  : 'rgba(255,255,255,0.08)',
    text:  isLight ? '#1e3a5f'                 : '#e2e8f0',
    muted: isLight ? '#64748b'                 : '#94a3b8',
  };

  const [tab, setTab] = useState<Tab>('repositorio');

  // ── Estado repositorio ─────────────────────────────────────────────────────
  const [archivos,    setArchivos]    = useState<Archivo[]>([]);
  const [tipos,       setTipos]       = useState<TipoDocumento[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search,      setSearch]      = useState('');
  const [filtroTipo,  setFiltroTipo]  = useState('');
  const [filtroScope, setFiltroScope] = useState<'todos' | 'interno' | 'cliente' | 'os'>('todos');
  const [filtroClienteId,     setFiltroClienteId]     = useState('');
  const [filtroClienteSearch, setFiltroClienteSearch] = useState('');
  const [filtroClientes,      setFiltroClientes]      = useState<Client[]>([]);
  const [filtroOsId,          setFiltroOsId]          = useState('');
  const [filtroOsSearch,      setFiltroOsSearch]      = useState('');
  const [filtroOsList,        setFiltroOsList]        = useState<ServiceOrder[]>([]);
  const [fechaDesde,          setFechaDesde]          = useState('');
  const [fechaHasta,          setFechaHasta]          = useState('');
  const [page,        setPage]        = useState(1);
  const [meta,        setMeta]        = useState({ total: 0, totalPages: 1 });

  // ── Estado modal upload ────────────────────────────────────────────────────
  const [showUpload,    setShowUpload]    = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [uploadFile,    setUploadFile]    = useState<File | null>(null);
  const [uploadForm,    setUploadForm]    = useState({
    tipoDocumentoId: '', nombre: '', descripcion: '',
    scope: 'interno' as 'interno' | 'cliente' | 'os',
    clientId: '', serviceOrderId: '',
  });
  const [clientSearch,  setClientSearch]  = useState('');
  const [clients,       setClients]       = useState<Client[]>([]);
  const [osSearch,      setOsSearch]      = useState('');
  const [osList,        setOsList]        = useState<ServiceOrder[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Estado tipos ───────────────────────────────────────────────────────────
  const [tipoForm,    setTipoForm]    = useState({ nombre: '', descripcion: '', color: '#60a5fa', scope: 'ambos' as 'interno' | 'cliente' | 'ambos' });
  const [editTipo,    setEditTipo]    = useState<TipoDocumento | null>(null);
  const [savingTipo,  setSavingTipo]  = useState(false);
  const [deletingTipo, setDeletingTipo] = useState<TipoDocumento | null>(null);

  // ── Estado eliminar archivo ────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Archivo | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── Carga ──────────────────────────────────────────────────────────────────
  const loadTipos = useCallback(async () => {
    const data = await tiposDocumentoApi.list();
    setTipos(data);
  }, []);

  const loadArchivos = useCallback(async () => {
    setLoadingList(true);
    try {
      const params: any = { page, limit: 20 };
      if (search)          params.search          = search;
      if (filtroTipo)      params.tipoDocumentoId = filtroTipo;
      if (filtroClienteId) params.clientId        = filtroClienteId;
      if (filtroOsId)      params.serviceOrderId  = filtroOsId;
      if (filtroScope === 'interno') params.esInterno = true;
      if (filtroScope === 'cliente' || filtroScope === 'os') params.esInterno = false;
      if (fechaDesde) params.fechaDesde = fechaDesde;
      if (fechaHasta) params.fechaHasta = fechaHasta;
      const res = await documentosApi.list(params);
      setArchivos(res.data);
      setMeta({ total: res.meta.total, totalPages: res.meta.totalPages });
    } catch { toast.error('Error al cargar archivos'); }
    finally { setLoadingList(false); }
  }, [page, search, filtroTipo, filtroScope, filtroClienteId, filtroOsId, fechaDesde, fechaHasta]);

  useEffect(() => { loadTipos(); }, [loadTipos]);
  useEffect(() => { loadArchivos(); }, [loadArchivos]);

  // ── Búsqueda de clientes para upload ───────────────────────────────────────
  useEffect(() => {
    if (uploadForm.scope !== 'cliente' || clientSearch.length < 2) { setClients([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await clientsApi.list({ search: clientSearch, limit: 8 });
        setClients(res.data ?? res);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch, uploadForm.scope]);

  useEffect(() => {
    if (uploadForm.scope !== 'os' || osSearch.length < 2) { setOsList([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await serviceOrdersApi.list({ search: osSearch, limit: 8 });
        setOsList(res.data ?? res);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [osSearch, uploadForm.scope]);

  // ── Búsqueda de clientes/OS para filtros del repositorio ──────────────────
  useEffect(() => {
    if (filtroClienteSearch.length < 2 || filtroClienteId) { setFiltroClientes([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await clientsApi.list({ search: filtroClienteSearch, limit: 6 });
        setFiltroClientes(res.data ?? res);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [filtroClienteSearch, filtroClienteId]);

  useEffect(() => {
    if (filtroOsSearch.length < 2 || filtroOsId) { setFiltroOsList([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await serviceOrdersApi.list({ search: filtroOsSearch, limit: 6 });
        setFiltroOsList(res.data ?? res);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [filtroOsSearch, filtroOsId]);

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile) return toast.error('Selecciona un archivo');
    if (!uploadForm.tipoDocumentoId) return toast.error('Selecciona un tipo de documento');
    if (uploadForm.scope === 'cliente' && !uploadForm.clientId) return toast.error('Selecciona un cliente');
    if (uploadForm.scope === 'os'      && !uploadForm.serviceOrderId) return toast.error('Selecciona una Orden de Servicio');

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file',            uploadFile);
      fd.append('tipoDocumentoId', uploadForm.tipoDocumentoId);
      if (uploadForm.nombre)      fd.append('nombre',      uploadForm.nombre);
      if (uploadForm.descripcion) fd.append('descripcion', uploadForm.descripcion);
      fd.append('esInterno', uploadForm.scope === 'interno' ? 'true' : 'false');
      if (uploadForm.scope === 'cliente') fd.append('clientId',       uploadForm.clientId);
      if (uploadForm.scope === 'os')      fd.append('serviceOrderId', uploadForm.serviceOrderId);

      const nuevo = await documentosApi.upload(fd);
      setArchivos(prev => [nuevo, ...prev]);
      setMeta(prev => ({ ...prev, total: prev.total + 1 }));
      toast.success('Archivo subido correctamente');
      setShowUpload(false);
      setUploadFile(null);
      setUploadForm({ tipoDocumentoId: '', nombre: '', descripcion: '', scope: 'interno', clientId: '', serviceOrderId: '' });
      setClientSearch(''); setOsSearch('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al subir el archivo');
    } finally { setUploading(false); }
  };

  // ── Eliminar archivo ────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await documentosApi.delete(deleteTarget.id);
      setArchivos(prev => prev.filter(a => a.id !== deleteTarget.id));
      setMeta(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      toast.success('Archivo eliminado');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al eliminar');
    } finally { setDeleting(false); }
  };

  // ── Tipos CRUD ──────────────────────────────────────────────────────────────
  const openEditTipo = (t: TipoDocumento) => {
    setEditTipo(t);
    setTipoForm({ nombre: t.nombre, descripcion: t.descripcion ?? '', color: t.color, scope: t.scope ?? 'ambos' });
  };

  const handleSaveTipo = async () => {
    if (!tipoForm.nombre.trim()) return toast.error('El nombre es obligatorio');
    setSavingTipo(true);
    try {
      if (editTipo) {
        const updated = await tiposDocumentoApi.update(editTipo.id, tipoForm);
        setTipos(prev => prev.map(t => t.id === editTipo.id ? { ...t, ...updated } : t));
        toast.success('Tipo actualizado');
      } else {
        const nuevo = await tiposDocumentoApi.create(tipoForm);
        setTipos(prev => [...prev, nuevo]);
        toast.success('Tipo creado');
      }
      setEditTipo(null);
      setTipoForm({ nombre: '', descripcion: '', color: '#60a5fa', scope: 'ambos' });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al guardar');
    } finally { setSavingTipo(false); }
  };

  const handleToggleTipo = async (t: TipoDocumento) => {
    try {
      const updated = await tiposDocumentoApi.update(t.id, { activo: !t.activo });
      setTipos(prev => prev.map(x => x.id === t.id ? { ...x, ...updated } : x));
    } catch (err: any) { toast.error(err?.response?.data?.message ?? 'Error'); }
  };

  const handleDeleteTipo = async () => {
    if (!deletingTipo) return;
    try {
      await tiposDocumentoApi.delete(deletingTipo.id);
      setTipos(prev => prev.filter(t => t.id !== deletingTipo.id));
      toast.success('Tipo eliminado');
      setDeletingTipo(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'No se puede eliminar');
      setDeletingTipo(null);
    }
  };

  // ── Filtros helpers ──────────────────────────────────────────────────────────
  const hasActiveFilters = !!(search || filtroTipo || filtroScope !== 'todos' || filtroClienteId || filtroOsId || fechaDesde || fechaHasta);
  const clearFilters = () => {
    setSearch(''); setFiltroTipo(''); setFiltroScope('todos');
    setFiltroClienteId(''); setFiltroClienteSearch(''); setFiltroClientes([]);
    setFiltroOsId(''); setFiltroOsSearch(''); setFiltroOsList([]);
    setFechaDesde(''); setFechaHasta('');
    setPage(1);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tc.text }}>Repositorio de Documentos</h1>
          <p className="text-sm mt-0.5" style={{ color: tc.muted }}>{meta.total} archivo{meta.total !== 1 ? 's' : ''} en total</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
        >
          <Upload className="w-4 h-4" /> Subir archivo
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: tc.card, border: `1px solid ${tc.border}` }}>
        {([['repositorio', 'Repositorio', FolderOpen], ['tipos', 'Tipos de Documento', Tag]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── TAB REPOSITORIO ──────────────────────────────────────────────────── */}
      {tab === 'repositorio' && (
        <div className="space-y-4">
          {/* Filtros — fila 1 */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text" value={search} placeholder="Buscar por nombre de archivo..."
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="input-glass w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
              />
            </div>
            <select
              value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPage(1); }}
              className="input-glass rounded-xl px-3 py-2.5 text-sm min-w-40"
            >
              <option value="">Todos los tipos</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: tc.card, border: `1px solid ${tc.border}` }}>
              {([
                ['todos', 'Todos', Globe],
                ['interno', 'Internos', Briefcase],
                ['cliente', 'Por cliente', Building2],
              ] as const).map(([key, label, Icon]) => (
                <button key={key} onClick={() => { setFiltroScope(key as any); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filtroScope === key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros — fila 2 */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Filtro cliente */}
            <div className="relative">
              {filtroClienteId ? (
                <div className="flex items-center gap-2 input-glass rounded-xl px-3 py-2.5 text-sm min-w-52">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="flex-1 truncate max-w-44" style={{ color: tc.text }}>{filtroClienteSearch}</span>
                  <button onClick={() => { setFiltroClienteId(''); setFiltroClienteSearch(''); setPage(1); }}
                    className="text-slate-400 hover:text-white shrink-0 ml-1"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <>
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input type="text" value={filtroClienteSearch}
                    placeholder="Filtrar por cliente..."
                    onChange={e => setFiltroClienteSearch(e.target.value)}
                    className="input-glass rounded-xl pl-9 pr-4 py-2.5 text-sm min-w-52" />
                  {filtroClientes.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl overflow-hidden shadow-2xl"
                      style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.12)' }}>
                      {filtroClientes.map(c => (
                        <button key={c.id} type="button"
                          onMouseDown={() => { setFiltroClienteId(c.id); setFiltroClienteSearch(c.businessName); setFiltroClientes([]); setPage(1); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/8 transition-colors text-slate-300">
                          {c.businessName}
                          <span className="text-slate-500 text-xs ml-2">{c.nit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Filtro OS */}
            <div className="relative">
              {filtroOsId ? (
                <div className="flex items-center gap-2 input-glass rounded-xl px-3 py-2.5 text-sm min-w-56">
                  <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="flex-1 truncate max-w-48" style={{ color: tc.text }}>{filtroOsSearch}</span>
                  <button onClick={() => { setFiltroOsId(''); setFiltroOsSearch(''); setPage(1); }}
                    className="text-slate-400 hover:text-white shrink-0 ml-1"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <>
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input type="text" value={filtroOsSearch}
                    placeholder="Filtrar por OS..."
                    onChange={e => setFiltroOsSearch(e.target.value)}
                    className="input-glass rounded-xl pl-9 pr-4 py-2.5 text-sm min-w-56" />
                  {filtroOsList.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl overflow-hidden shadow-2xl"
                      style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.12)' }}>
                      {filtroOsList.map(o => (
                        <button key={o.id} type="button"
                          onMouseDown={() => { setFiltroOsId(o.id); setFiltroOsSearch(`${o.osNumber} · ${o.client?.businessName ?? ''}`); setFiltroOsList([]); setPage(1); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/8 transition-colors text-slate-300">
                          <span className="font-mono text-violet-300">{o.osNumber}</span>
                          {o.client?.businessName && <span className="text-slate-500 text-xs ml-2">· {o.client.businessName}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Rango de fechas */}
            <div className="flex items-center gap-2 input-glass rounded-xl px-3 py-2" style={{ minWidth: 260 }}>
              <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
              <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(1); }}
                className="bg-transparent text-sm outline-none w-32"
                style={{ color: fechaDesde ? tc.text : '#64748b', colorScheme: 'dark' }}
                title="Desde" />
              <span className="text-slate-500 text-xs shrink-0">—</span>
              <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(1); }}
                className="bg-transparent text-sm outline-none w-32"
                style={{ color: fechaHasta ? tc.text : '#64748b', colorScheme: 'dark' }}
                title="Hasta" />
            </div>

            {/* Limpiar filtros */}
            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors"
                style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.08)' }}>
                <X className="w-3.5 h-3.5" /> Limpiar filtros
              </button>
            )}
          </div>

          {/* Lista */}
          {loadingList ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            </div>
          ) : archivos.length === 0 ? (
            <div className="text-center py-16" style={{ color: tc.muted }}>
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay archivos{search ? ` para "${search}"` : ''}</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${tc.border}`, background: tc.card }}>
              {archivos.map((a, i) => (
                <div key={a.id} className={`flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/5 ${
                  i < archivos.length - 1 ? 'border-b' : ''
                }`} style={{ borderColor: tc.border }}>
                  <span className="text-2xl shrink-0">{mimeIcon(a.mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: tc.text }}>{a.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${a.tipoDocumento.color}22`, color: a.tipoDocumento.color }}>
                        {a.tipoDocumento.nombre}
                      </span>
                      {a.esInterno && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                          Infotec interno
                        </span>
                      )}
                      {a.client && (
                        <span className="text-xs" style={{ color: tc.muted }}><Building2 className="w-3 h-3 inline mr-0.5" />{a.client.businessName}</span>
                      )}
                      {a.serviceOrder && (
                        <span className="text-xs" style={{ color: tc.muted }}>
                          <FileText className="w-3 h-3 inline mr-0.5" />
                          OS {a.serviceOrder.osNumber}
                          {a.serviceOrder.client?.businessName && ` · ${a.serviceOrder.client.businessName}`}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: tc.muted }}>{formatBytes(a.tamanioBytes)}</span>
                      <span className="text-xs" style={{ color: tc.muted }}>
                        {new Date(a.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => documentosApi.download(a.id, a.nombreOriginal)}
                      className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors" title="Descargar">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(a)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginación */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-2 rounded-lg disabled:opacity-40 text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm" style={{ color: tc.muted }}>Página {page} de {meta.totalPages}</span>
              <button disabled={page === meta.totalPages} onClick={() => setPage(p => p + 1)}
                className="p-2 rounded-lg disabled:opacity-40 text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB TIPOS ────────────────────────────────────────────────────────── */}
      {tab === 'tipos' && (
        <div className="space-y-4">
          {canManage && (
            <div className="glass-strong rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: tc.text }}>
                {editTipo ? `Editando: ${editTipo.nombre}` : 'Nuevo tipo de documento'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: tc.muted }}>Nombre <span className="text-red-400">*</span></label>
                  <input value={tipoForm.nombre} onChange={e => setTipoForm(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Contrato, Manual técnico..."
                    className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: tc.muted }}>Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={tipoForm.color} onChange={e => setTipoForm(p => ({ ...p, color: e.target.value }))}
                      className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent" />
                    <span className="text-sm font-mono" style={{ color: tc.muted }}>{tipoForm.color}</span>
                    <span className="text-xs px-2 py-1 rounded-full font-medium ml-1"
                      style={{ background: `${tipoForm.color}22`, color: tipoForm.color }}>
                      Vista previa
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: tc.muted }}>Aplica para</label>
                <div className="flex gap-2">
                  {([
                    ['interno', 'Interno Infotec', '#a78bfa'],
                    ['cliente', 'Cliente / OS',    '#34d399'],
                    ['ambos',   'Ambos',           '#60a5fa'],
                  ] as const).map(([key, label, color]) => (
                    <button key={key} type="button"
                      onClick={() => setTipoForm(p => ({ ...p, scope: key }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        tipoForm.scope === key ? 'text-white' : 'text-slate-400 border-white/10 hover:border-white/20'
                      }`}
                      style={tipoForm.scope === key ? { background: `${color}22`, border: `1px solid ${color}60`, color } : {}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: tc.muted }}>Descripción</label>
                <input value={tipoForm.descripcion} onChange={e => setTipoForm(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Descripción opcional..."
                  className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveTipo} disabled={savingTipo}
                  className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50">
                  {savingTipo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editTipo ? 'Guardar cambios' : 'Crear tipo'}
                </button>
                {editTipo && (
                  <button onClick={() => { setEditTipo(null); setTipoForm({ nombre: '', descripcion: '', color: '#60a5fa', scope: 'ambos' }); }}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${tc.border}`, background: tc.card }}>
            {tipos.length === 0 ? (
              <div className="text-center py-12" style={{ color: tc.muted }}>
                <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay tipos configurados</p>
              </div>
            ) : tipos.map((t, i) => (
              <div key={t.id} className={`flex items-center gap-4 px-5 py-3.5 ${i < tipos.length - 1 ? 'border-b' : ''}`}
                style={{ borderColor: tc.border }}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: t.activo ? tc.text : tc.muted }}>{t.nombre}</span>
                    {(() => {
                      const scopeMap = { interno: ['Interno', '#a78bfa'], cliente: ['Cliente / OS', '#34d399'], ambos: ['Ambos', '#60a5fa'] } as const;
                      const [label, color] = scopeMap[t.scope ?? 'ambos'];
                      return <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: `${color}20`, color }}>{label}</span>;
                    })()}
                    {!t.activo && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>inactivo</span>
                    )}
                    {(t._count?.archivos ?? 0) > 0 && (
                      <span className="text-xs" style={{ color: tc.muted }}>{t._count!.archivos} archivo{t._count!.archivos !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {t.descripcion && <p className="text-xs mt-0.5 truncate" style={{ color: tc.muted }}>{t.descripcion}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleToggleTipo(t)} title={t.activo ? 'Desactivar' : 'Activar'}
                      className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                      {t.activo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEditTipo(t)}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeletingTipo(t)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL UPLOAD ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showUpload && (
          <Modal open title="Subir archivo" onClose={() => { setShowUpload(false); setUploadFile(null); }} width="max-w-xl">
            <div className="space-y-4">
              {/* Zona de archivo */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-slate-400">Archivo <span className="text-red-400">*</span></label>
                <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/20 py-8 cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/5 transition-all">
                  <input ref={fileInputRef} type="file" className="sr-only"
                    onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
                  {uploadFile ? (
                    <>
                      <span className="text-3xl">{mimeIcon(uploadFile.type)}</span>
                      <span className="text-sm text-white font-medium truncate max-w-xs">{uploadFile.name}</span>
                      <span className="text-xs text-slate-400">{formatBytes(uploadFile.size)}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400" />
                      <span className="text-sm text-slate-400">Haz clic para seleccionar un archivo</span>
                      <span className="text-xs text-slate-500">Máximo 50 MB</span>
                    </>
                  )}
                </label>
              </div>

              {/* Tipo de documento */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-slate-400">Tipo de documento <span className="text-red-400">*</span></label>
                <select value={uploadForm.tipoDocumentoId}
                  onChange={e => setUploadForm(p => ({ ...p, tipoDocumentoId: e.target.value }))}
                  className="input-glass w-full rounded-xl px-3 py-2.5 text-sm">
                  <option value="">Seleccionar tipo...</option>
                  {tipos.filter(t => {
                    if (!t.activo) return false;
                    if (uploadForm.scope === 'interno') return t.scope === 'interno' || t.scope === 'ambos';
                    return t.scope === 'cliente' || t.scope === 'ambos';
                  }).map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Nombre personalizado */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-slate-400">Nombre (opcional)</label>
                <input value={uploadForm.nombre}
                  onChange={e => setUploadForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder={uploadFile?.name ?? 'Nombre del documento...'}
                  className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-slate-400">Descripción (opcional)</label>
                <input value={uploadForm.descripcion}
                  onChange={e => setUploadForm(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Descripción breve del documento..."
                  className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" />
              </div>

              {/* Vinculación */}
              <div>
                <label className="block text-xs font-medium mb-2 text-slate-400">Vincular a</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['interno', 'Interno Infotec', Briefcase],
                    ['cliente', 'Cliente', Building2],
                    ['os', 'Orden de Servicio', FileText],
                  ] as const).map(([key, label, Icon]) => (
                    <button key={key} type="button"
                      onClick={() => setUploadForm(p => ({ ...p, scope: key, clientId: '', serviceOrderId: '', tipoDocumentoId: '' }))}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                        uploadForm.scope === key
                          ? 'border-violet-500/60 bg-violet-500/10 text-violet-300'
                          : 'border-white/10 text-slate-400 hover:border-white/20'
                      }`}>
                      <Icon className="w-4 h-4" />{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Búsqueda cliente */}
              {uploadForm.scope === 'cliente' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-slate-400">Cliente <span className="text-red-400">*</span></label>
                  <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); setUploadForm(p => ({ ...p, clientId: '' })); }}
                    placeholder="Buscar cliente por nombre o NIT..."
                    className="input-glass w-full rounded-xl px-3 py-2.5 text-sm mb-2" />
                  {clients.length > 0 && !uploadForm.clientId && (
                    <div className="rounded-xl overflow-hidden border border-white/10">
                      {clients.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setUploadForm(p => ({ ...p, clientId: c.id })); setClientSearch(c.businessName); setClients([]); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/8 transition-colors text-slate-300">
                          {c.businessName} <span className="text-slate-500 text-xs ml-2">{c.nit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {uploadForm.clientId && (
                    <p className="text-xs text-emerald-400"><Check className="w-3 h-3 inline mr-1" />Cliente seleccionado: {clientSearch}</p>
                  )}
                </div>
              )}

              {/* Búsqueda OS */}
              {uploadForm.scope === 'os' && (
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-slate-400">Orden de Servicio <span className="text-red-400">*</span></label>
                  <input value={osSearch} onChange={e => { setOsSearch(e.target.value); setUploadForm(p => ({ ...p, serviceOrderId: '' })); }}
                    placeholder="Buscar OS por número o producto..."
                    className="input-glass w-full rounded-xl px-3 py-2.5 text-sm mb-2" />
                  {osList.length > 0 && !uploadForm.serviceOrderId && (
                    <div className="rounded-xl overflow-hidden border border-white/10">
                      {osList.map(o => (
                        <button key={o.id} type="button"
                          onClick={() => { setUploadForm(p => ({ ...p, serviceOrderId: o.id })); setOsSearch(`${o.osNumber} — ${o.product}`); setOsList([]); }}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/8 transition-colors text-slate-300">
                          <span className="font-mono text-violet-300">{o.osNumber}</span>
                          {' — '}{o.product}
                          {o.client?.businessName && <span className="text-slate-500 text-xs ml-2">· {o.client.businessName}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {uploadForm.serviceOrderId && (
                    <p className="text-xs text-emerald-400"><Check className="w-3 h-3 inline mr-1" />OS seleccionada: {osSearch}</p>
                  )}
                </div>
              )}

              <button onClick={handleUpload} disabled={uploading}
                className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50">
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" />Subiendo...</> : <><Upload className="w-4 h-4" />Subir archivo</>}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── MODAL CONFIRMAR ELIMINAR ARCHIVO ─────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <Modal open title="Eliminar archivo" onClose={() => setDeleteTarget(null)} width="max-w-md">
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-300">
                  Se eliminará permanentemente el archivo <strong className="text-white">{deleteTarget.nombre}</strong> del repositorio y del servidor. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:border-white/20 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Eliminar
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── MODAL CONFIRMAR ELIMINAR TIPO ────────────────────────────────────── */}
      <AnimatePresence>
        {deletingTipo && (
          <Modal open title="Eliminar tipo" onClose={() => setDeletingTipo(null)} width="max-w-md">
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                ¿Eliminar el tipo <strong className="text-white">{deletingTipo.nombre}</strong>?
                {(deletingTipo._count?.archivos ?? 0) > 0 && (
                  <span className="text-red-400"> Tiene {deletingTipo._count!.archivos} archivo(s) asociado(s) y no podrá eliminarse.</span>
                )}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingTipo(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:border-white/20 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleDeleteTipo}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center gap-2">
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
