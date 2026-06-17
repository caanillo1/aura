'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, Search, Upload, Trash2, Edit2, X, Check,
  Loader2, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { municipiosApi } from '@/lib/api';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { Municipio } from '@/types';

const EMPTY_FORM = {
  codigoDepartamento: '',
  nombreDepartamento: '',
  codigoMunicipio: '',
  nombreMunicipio: '',
  codigoPostal: '',
};

type FormData = typeof EMPTY_FORM;

export default function MunicipiosPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [data, setData] = useState<Municipio[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const searchRef = useRef('');

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Municipio | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Municipio | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importProgress, setImportProgress] = useState<{
    total: number; done: boolean; exitosos: number; fallidos: number;
  } | null>(null);

  const tc = isLight ? '#1e293b' : '#f1f5f9';
  const tm = isLight ? '#64748b' : '#94a3b8';

  const glass = {
    background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.11)'}`,
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: isLight
      ? '0 6px 24px rgba(30,60,120,0.13), inset 0 1px 0 rgba(255,255,255,0.97)'
      : '0 6px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.09)',
  };

  const inp = {
    background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.12)'}`,
    color: tc,
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  };

  const load = useCallback(async (p = 1, q = searchRef.current) => {
    setLoading(true);
    try {
      const res = await municipiosApi.list({ page: p, limit: 50, search: q || undefined });
      setData(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
      setPage(p);
    } catch {
      toast.error('Error al cargar municipios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      searchRef.current = search;
      load(1, search);
    }, 350);
    return () => clearTimeout(t);
  }, [search, load]);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(m: Municipio) {
    setEditTarget(m);
    setForm({
      codigoDepartamento: m.codigoDepartamento,
      nombreDepartamento: m.nombreDepartamento,
      codigoMunicipio: m.codigoMunicipio,
      nombreMunicipio: m.nombreMunicipio,
      codigoPostal: m.codigoPostal ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.codigoDepartamento.trim() || !form.nombreDepartamento.trim() ||
        !form.codigoMunicipio.trim() || !form.nombreMunicipio.trim()) {
      toast.error('Los campos código y nombre de departamento y municipio son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        codigoDepartamento: form.codigoDepartamento.trim(),
        nombreDepartamento: form.nombreDepartamento.trim(),
        codigoMunicipio: form.codigoMunicipio.trim(),
        nombreMunicipio: form.nombreMunicipio.trim(),
        codigoPostal: form.codigoPostal.trim() || undefined,
      };
      if (editTarget) {
        await municipiosApi.update(editTarget.id, payload);
        toast.success('Municipio actualizado');
      } else {
        await municipiosApi.create(payload);
        toast.success('Municipio creado');
      }
      setShowModal(false);
      load(page);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await municipiosApi.delete(deleteTarget.id);
      toast.success(`Municipio "${deleteTarget.nombreMunicipio}" eliminado`);
      setDeleteTarget(null);
      load(page);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['codigoDepartamento', 'nombreDepartamento', 'codigoMunicipio', 'nombreMunicipio', 'codigoPostal'],
      ['05', 'ANTIOQUIA', '05001', 'MEDELLÍN', '050010'],
      ['11', 'BOGOTÁ D.C.', '11001', 'BOGOTÁ D.C.', '110010'],
    ]);
    ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 25 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Municipios');
    XLSX.writeFile(wb, 'plantilla_municipios.xlsx');
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    let allRows: Record<string, string>[];
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      allRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
    } catch {
      toast.error('No se pudo leer el archivo Excel');
      return;
    }

    const items = parseItems(allRows);
    const invalidCount = allRows.length - items.length;

    if (items.length === 0) {
      toast.error('No se encontraron filas válidas en el archivo');
      return;
    }

    const capturedInvalid = invalidCount;
    setImportProgress({ total: items.length, done: false, exitosos: 0, fallidos: 0 });

    try {
      const res = await municipiosApi.bulkCreate(items);
      setImportProgress({ total: items.length, done: true, exitosos: res.exitosos, fallidos: res.fallidos });
      await new Promise<void>(r => setTimeout(r, 800));
      setImportProgress(null);

      const dupes = (res.resultados ?? []).filter((r: any) => !r.ok && r.error?.toLowerCase().includes('ya existe')).length;
      const otrosErrores = res.fallidos - dupes;
      const partes: string[] = [];
      if (res.exitosos > 0)    partes.push(`se importaron ${res.exitosos}`);
      if (capturedInvalid > 0) partes.push(`${capturedInvalid} omitido${capturedInvalid !== 1 ? 's' : ''} por datos incompletos`);
      if (dupes > 0)           partes.push(`${dupes} omitido${dupes !== 1 ? 's' : ''} por código ya existente`);
      if (otrosErrores > 0)    partes.push(`${otrosErrores} omitido${otrosErrores !== 1 ? 's' : ''} por error`);

      const msg = partes.join(' · ');
      if (res.exitosos > 0) toast.success(msg.charAt(0).toUpperCase() + msg.slice(1));
      else                  toast.info(msg || 'No se importó ningún municipio');
    } catch (err: any) {
      setImportProgress(null);
      toast.error(err?.response?.data?.message ?? 'Error al importar municipios');
    }

    load(1);
  }

  function parseItems(rows: Record<string, string>[]) {
    return rows
      .map((r) => ({
        codigoDepartamento: String(r['codigoDepartamento'] ?? r['codigo_departamento'] ?? '').trim(),
        nombreDepartamento: String(r['nombreDepartamento'] ?? r['nombre_departamento'] ?? '').trim(),
        codigoMunicipio:    String(r['codigoMunicipio']    ?? r['codigo_municipio']    ?? '').trim(),
        nombreMunicipio:    String(r['nombreMunicipio']    ?? r['nombre_municipio']    ?? '').trim(),
        codigoPostal:       String(r['codigoPostal']       ?? r['codigo_postal']       ?? '').trim() || undefined,
      }))
      .filter((it) => it.codigoDepartamento && it.nombreDepartamento && it.codigoMunicipio && it.nombreMunicipio);
  }

  const rowBg = (i: number) =>
    i % 2 === 0
      ? isLight ? 'rgba(248,250,252,0.6)' : 'rgba(255,255,255,0.02)'
      : 'transparent';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <BackButton href="/configuracion" label="Configuración" />
          <div>
            <h2 className="font-bold text-xl" style={{ color: tc }}>Municipios</h2>
            <p className="text-xs mt-0.5" style={{ color: tm }}>
              {total} municipio(s) registrado(s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{ background: isLight ? 'rgba(248,250,252,0.9)' : 'rgba(255,255,255,0.07)', border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.12)'}`, color: tm }}
          >
            <Upload className="w-3.5 h-3.5" /> Plantilla Excel
          </button>
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all"
            style={{ background: isLight ? 'rgba(248,250,252,0.9)' : 'rgba(255,255,255,0.07)', border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.12)'}`, color: tm }}>
            {importProgress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Importar Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: '#fb923c', color: '#fff' }}
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo municipio
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: tm }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar municipio..."
          style={{ ...inp, paddingLeft: 32 }}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={glass}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}` }}>
              {['Cód. Dpto.', 'Departamento', 'Cód. Mpio.', 'Municipio', 'Cód. Postal', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: tm }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: '#fb923c' }} /></td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="py-16 text-center text-sm" style={{ color: tm }}>No hay municipios registrados</td></tr>
            ) : data.map((m, i) => (
              <tr key={m.id} style={{ background: rowBg(i), borderBottom: `1px solid ${isLight ? '#f1f5f9' : 'rgba(255,255,255,0.04)'}` }}>
                <td className="px-4 py-2.5 font-mono" style={{ color: tc }}>{m.codigoDepartamento}</td>
                <td className="px-4 py-2.5" style={{ color: tc }}>{m.nombreDepartamento}</td>
                <td className="px-4 py-2.5 font-mono" style={{ color: tc }}>{m.codigoMunicipio}</td>
                <td className="px-4 py-2.5 font-medium" style={{ color: tc }}>{m.nombreMunicipio}</td>
                <td className="px-4 py-2.5 font-mono" style={{ color: tm }}>{m.codigoPostal ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg transition-colors hover:bg-blue-500/10" title="Editar">
                      <Edit2 className="w-3.5 h-3.5" style={{ color: '#60a5fa' }} />
                    </button>
                    <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10" title="Eliminar">
                      <Trash2 className="w-3.5 h-3.5" style={{ color: '#f87171' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}` }}>
            <span className="text-xs" style={{ color: tm }}>Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => load(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg disabled:opacity-40" style={{ color: tm }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded-lg disabled:opacity-40" style={{ color: tm }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div className="relative rounded-2xl p-6 w-full max-w-md"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={glass}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" style={{ color: '#fb923c' }} />
                  <h3 className="font-bold text-base" style={{ color: tc }}>
                    {editTarget ? 'Editar municipio' : 'Nuevo municipio'}
                  </h3>
                </div>
                <button onClick={() => setShowModal(false)}><X className="w-4 h-4" style={{ color: tm }} /></button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: tm }}>Cód. Departamento *</label>
                    <input value={form.codigoDepartamento} onChange={(e) => setForm(f => ({ ...f, codigoDepartamento: e.target.value }))}
                      placeholder="05" style={inp} maxLength={10} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: tm }}>Nombre Departamento *</label>
                    <input value={form.nombreDepartamento} onChange={(e) => setForm(f => ({ ...f, nombreDepartamento: e.target.value }))}
                      placeholder="ANTIOQUIA" style={inp} maxLength={100} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: tm }}>Cód. Municipio *</label>
                    <input value={form.codigoMunicipio} onChange={(e) => setForm(f => ({ ...f, codigoMunicipio: e.target.value }))}
                      placeholder="05001" style={inp} maxLength={10} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: tm }}>Nombre Municipio *</label>
                    <input value={form.nombreMunicipio} onChange={(e) => setForm(f => ({ ...f, nombreMunicipio: e.target.value }))}
                      placeholder="MEDELLÍN" style={inp} maxLength={100} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: tm }}>Código Postal</label>
                  <input value={form.codigoPostal} onChange={(e) => setForm(f => ({ ...f, codigoPostal: e.target.value }))}
                    placeholder="050010" style={inp} maxLength={10} />
                </div>
              </div>

              <div className="flex gap-2 mt-5 justify-end">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-xs font-medium" style={{ color: tm, background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: '#fb923c', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {editTarget ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
            <motion.div className="relative rounded-2xl p-6 w-full max-w-sm"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={glass}>
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
                  <AlertTriangle className="w-6 h-6" style={{ color: '#ef4444' }} />
                </div>
                <h3 className="font-bold text-base" style={{ color: tc }}>Eliminar municipio</h3>
                <p className="text-sm" style={{ color: tm }}>
                  ¿Eliminar <strong style={{ color: tc }}>{deleteTarget.nombreMunicipio}</strong>?
                  Los clientes con este municipio asignado perderán la referencia.
                </p>
              </div>
              <div className="flex gap-2 mt-5 justify-center">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-xs font-medium" style={{ color: tm, background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)' }}>
                  Cancelar
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: '#ef4444', color: '#fff', opacity: deleting ? 0.7 : 1 }}>
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress overlay */}
      <AnimatePresence>
        {importProgress && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div className="relative rounded-2xl p-7 w-full max-w-sm flex flex-col gap-4"
              initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
              style={glass}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: importProgress.done ? 'rgba(52,211,153,0.15)' : 'rgba(251,146,60,0.15)' }}>
                  {importProgress.done
                    ? <CheckCircle2 className="w-5 h-5" style={{ color: '#34d399' }} />
                    : <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#fb923c' }} />}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: tc }}>
                    {importProgress.done ? 'Importación completada' : 'Importando municipios...'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: tm }}>
                    {importProgress.done
                      ? `${importProgress.exitosos} importados · ${importProgress.fallidos} omitidos`
                      : `Procesando ${importProgress.total} registros`}
                  </p>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="w-full rounded-full overflow-hidden relative" style={{ height: 8, background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }}>
                {importProgress.done ? (
                  <div className="h-full rounded-full w-full" style={{ background: 'linear-gradient(90deg, #34d399, #10b981)' }} />
                ) : (
                  <div className="h-full rounded-full absolute"
                    style={{
                      width: '40%',
                      background: 'linear-gradient(90deg, #fb923c, #f97316)',
                      animation: 'indeterminate 1.4s ease-in-out infinite',
                    }}
                  />
                )}
              </div>

              {importProgress.done && (
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: '#34d399' }}>✓ {importProgress.exitosos} importados</span>
                  {importProgress.fallidos > 0 && (
                    <span style={{ color: '#f87171' }}>✗ {importProgress.fallidos} omitidos</span>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
