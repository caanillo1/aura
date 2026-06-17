'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Search, RefreshCw, Building2, Users, ChevronRight,
  CheckCircle2, XCircle, Plus, UploadCloud, Download, X, AlertCircle,
  Trash2, CheckSquare, Square, Loader2,
} from 'lucide-react';
import { clientsApi, municipiosApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { Modal } from '@/components/ui/Modal';
import { MunicipioSearch } from '@/components/ui/MunicipioSearch';
import { toast } from 'sonner';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import type { Client, Municipio } from '@/types';

// ── Columnas de la plantilla ────────────────────────────────────────────────
const COLS = [
  { key: 'nit',              header: 'NIT *',               req: true,  example: '900123456-7',              desc: 'NIT de la empresa. Obligatorio. Debe ser único.' },
  { key: 'businessName',     header: 'Razón Social *',       req: true,  example: 'Hospital San Jorge S.A.S', desc: 'Nombre legal de la empresa. Obligatorio.' },
  { key: 'commercialName',   header: 'Nombre Comercial',     req: false, example: 'Hospital San Jorge',       desc: 'Nombre comercial o marca. Opcional.' },
  { key: 'address',          header: 'Dirección',            req: false, example: 'Cra 15 #23-45',            desc: 'Dirección física de la empresa. Opcional.' },
  { key: 'city',             header: 'Ciudad',               req: false, example: 'Bogotá',                   desc: 'Ciudad donde opera. Opcional.' },
  { key: 'department',       header: 'Departamento',         req: false, example: 'Cundinamarca',             desc: 'Departamento o estado. Opcional.' },
  { key: 'email',            header: 'Correo',               req: false, example: 'info@hospital.com',        desc: 'Correo de contacto de la empresa. Opcional.' },
  { key: 'phone',            header: 'Teléfono',             req: false, example: '3101234567',               desc: 'Número de teléfono. Opcional.' },
  { key: 'economicActivity', header: 'Actividad Económica',  req: false, example: 'Servicios de salud',       desc: 'Actividad económica principal. Opcional.' },
];

const EMPTY_FORM = { nit: '', businessName: '', commercialName: '', address: '', city: '', department: '', municipioId: '', email: '', phone: '', economicActivity: '' };

type ImportRow = {
  fila: number;
  nit: string;
  businessName: string;
  commercialName?: string;
  address?: string;
  city?: string;
  department?: string;
  email?: string;
  phone?: string;
  economicActivity?: string;
  errors: string[];
  valid: boolean;
};

export default function ClientesPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const fileRef = useRef<HTMLInputElement>(null);
  const { can } = usePermission();

  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);

  const [showCreate,  setShowCreate]  = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);

  // Import modal
  const [showImport,  setShowImport]  = useState(false);
  const [importRows,  setImportRows]  = useState<ImportRow[]>([]);
  const [importProgress, setImportProgress] = useState<{
    total: number; done: boolean; exitosos: number; fallidos: number;
  } | null>(null);

  const [municipios, setMunicipios] = useState<Municipio[]>([]);

  // Selección y eliminación
  const [selectMode,   setSelectMode]   = useState(false);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [deleting,     setDeleting]     = useState(false);

  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  const glassCard = {
    background: isLight ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? '0 6px 24px rgba(30,60,120,0.15), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 6px 24px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  };

  const dividerStyle = { borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)'}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientsApi.list({ page, limit: 12, search: search || undefined });
      setClients(res.data);
      setTotal(res.meta.total);
    } catch { toast.warning('No se pudo cargar el listado de clientes'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    municipiosApi.listAll().then(setMunicipios).catch(() => {});
  }, []);

  // ── Crear cliente ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.nit.trim() || !form.businessName.trim()) {
      toast.error('NIT y razón social son obligatorios');
      return;
    }
    setSaving(true);
    try {
      await clientsApi.create({ ...form, municipioId: form.municipioId || undefined });
      toast.success('Cliente creado exitosamente');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al crear cliente');
    } finally { setSaving(false); }
  };

  // ── Descargar plantilla Excel ──────────────────────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // ── Hoja 1: Datos ──────────────────────────────────────────────────────
    const headers = COLS.map(c => c.header);
    const example = COLS.map(c => c.example);
    const dataWs  = XLSX.utils.aoa_to_sheet([headers, example]);

    // Ancho de columnas
    dataWs['!cols'] = COLS.map(() => ({ wch: 28 }));

    XLSX.utils.book_append_sheet(wb, dataWs, 'Clientes');

    // ── Hoja 2: Instructivo ───────────────────────────────────────────────
    const instrRows: (string | number)[][] = [
      ['INSTRUCTIVO DE CARGUE MASIVO DE CLIENTES'],
      [''],
      ['REGLAS GENERALES'],
      ['• La primera fila de la hoja "Clientes" contiene los encabezados — NO la elimines ni modifiques.'],
      ['• La segunda fila es un ejemplo — puedes reemplazarla con tus datos o eliminarla.'],
      ['• Los campos marcados con * son OBLIGATORIOS. Los demás son opcionales.'],
      ['• No dejes filas completamente vacías entre los datos.'],
      ['• El NIT debe ser único; si ya existe en el sistema, esa fila será ignorada.'],
      [''],
      ['DESCRIPCIÓN DE CAMPOS'],
      ['Campo', 'Obligatorio', 'Descripción', 'Ejemplo'],
      ...COLS.map(c => [c.header.replace(' *', ''), c.req ? 'SÍ' : 'No', c.desc, c.example]),
      [''],
      ['PROCESO DE IMPORTACIÓN'],
      ['1. Completa la hoja "Clientes" con los datos de tus clientes (a partir de la fila 2).'],
      ['2. Guarda el archivo en formato Excel (.xlsx).'],
      ['3. En AURA → Clientes, haz clic en "Importar clientes".'],
      ['4. Selecciona el archivo. AURA mostrará una vista previa con validaciones.'],
      ['5. Revisa los errores (filas en rojo) y corrígelos si es necesario.'],
      ['6. Haz clic en "Importar X clientes" para confirmar.'],
      [''],
      ['ERRORES COMUNES'],
      ['• "NIT ya existe": ese cliente ya está registrado — omite la fila o actualízalo manualmente.'],
      ['• "NIT requerido" / "Razón Social requerida": asegúrate de llenar los campos obligatorios.'],
    ];

    const instrWs = XLSX.utils.aoa_to_sheet(instrRows);
    instrWs['!cols'] = [{ wch: 55 }, { wch: 14 }, { wch: 55 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'Instructivo');

    XLSX.writeFile(wb, 'Plantilla_Clientes_AURA.xlsx');
    toast.success('Plantilla descargada');
  };

  // ── Parsear archivo Excel ──────────────────────────────────────────────────
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        const rows: ImportRow[] = raw.map((r, i) => {
          const nit            = String(r['NIT *'] ?? r['NIT'] ?? '').trim();
          const businessName   = String(r['Razón Social *'] ?? r['Razón Social'] ?? '').trim();
          const commercialName = String(r['Nombre Comercial'] ?? '').trim() || undefined;
          const address        = String(r['Dirección'] ?? '').trim() || undefined;
          const city           = String(r['Ciudad'] ?? '').trim() || undefined;
          const department     = String(r['Departamento'] ?? '').trim() || undefined;
          const email          = String(r['Correo'] ?? '').trim() || undefined;
          const phone          = String(r['Teléfono'] ?? '').trim() || undefined;
          const economicActivity = String(r['Actividad Económica'] ?? '').trim() || undefined;

          const errors: string[] = [];
          if (!nit)          errors.push('NIT requerido');
          if (!businessName) errors.push('Razón Social requerida');
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Correo inválido');

          return { fila: i + 2, nit, businessName, commercialName, address, city, department, email, phone, economicActivity, errors, valid: errors.length === 0 };
        }).filter(r => r.nit || r.businessName); // omitir filas completamente vacías

        if (rows.length === 0) { toast.error('El archivo no contiene datos'); return; }
        setImportRows(rows);
        setShowImport(true);
      } catch {
        toast.error('Error al leer el archivo. Asegúrate de usar la plantilla descargada.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── Enviar al backend ──────────────────────────────────────────────────────
  const handleImport = async () => {
    const valid = importRows.filter(r => r.valid);
    if (valid.length === 0) { toast.error('No hay filas válidas para importar'); return; }

    const items = valid.map(({ errors: _e, valid: _v, fila: _f, ...data }) => data);
    const capturedInvalid = invalidCount; // capturar antes de limpiar el estado

    setShowImport(false);
    setImportRows([]);
    setImportProgress({ total: items.length, done: false, exitosos: 0, fallidos: 0 });

    try {
      const res = await clientsApi.bulkCreate(items);

      // Mostrar 100% antes de ocultar
      setImportProgress({ total: items.length, done: true, exitosos: res.exitosos, fallidos: res.fallidos });
      await new Promise<void>(r => setTimeout(r, 800));
      setImportProgress(null);

      const duplicados   = (res.resultados ?? []).filter((r: any) => !r.ok && r.error?.includes('ya existe')).length;
      const otrosErrores = res.fallidos - duplicados;
      const partes: string[] = [];
      if (res.exitosos > 0)   partes.push(`se importaron ${res.exitosos}`);
      if (capturedInvalid > 0) partes.push(`${capturedInvalid} omitido${capturedInvalid !== 1 ? 's' : ''} por datos inválidos`);
      if (duplicados > 0)     partes.push(`${duplicados} omitido${duplicados !== 1 ? 's' : ''} por NIT ya existente`);
      if (otrosErrores > 0)   partes.push(`${otrosErrores} omitido${otrosErrores !== 1 ? 's' : ''} por error`);

      const msg = partes.join(' · ');
      if (res.exitosos > 0) toast.success(msg.charAt(0).toUpperCase() + msg.slice(1));
      else                  toast.info(msg || 'No se importó ningún registro');
    } catch (e: any) {
      setImportProgress(null);
      toast.error(e?.response?.data?.message ?? 'Error al importar clientes');
    }

    load().catch(() => {});
  };

  const validCount   = importRows.filter(r => r.valid).length;
  const invalidCount = importRows.filter(r => !r.valid).length;

  // ── Selección ──────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected(prev => prev.size === clients.length ? new Set() : new Set(clients.map(c => c.id)));

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (selected.size === 1) {
        const [id] = Array.from(selected);
        const res = await clientsApi.delete(id);
        toast.success(res.message ?? 'Cliente eliminado');
      } else {
        const res = await clientsApi.bulkDelete(Array.from(selected));
        const msg = `${res.eliminados} cliente${res.eliminados !== 1 ? 's' : ''} eliminado${res.eliminados !== 1 ? 's' : ''}`;
        if (res.fallidos > 0) toast.warning(`${msg} · ${res.fallidos} no se pudieron eliminar (tienen registros asociados)`);
        else toast.success(msg);
      }
      setShowConfirm(false);
      exitSelectMode();
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al eliminar');
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-xl" style={{ color: tc.p }}>Clientes</h2>
          <p className="text-sm mt-0.5" style={{ color: tc.m }}>{total} empresas registradas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectMode ? (
            <>
              <span className="text-sm font-medium px-3 py-2" style={{ color: tc.m }}>
                {selected.size} seleccionado{selected.size !== 1 ? 's' : ''}
              </span>
              <button onClick={toggleAll}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)', color: tc.s }}>
                {selected.size === clients.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {selected.size === clients.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
              <button onClick={() => { if (selected.size > 0) setShowConfirm(true); }}
                disabled={selected.size === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171' }}>
                <Trash2 className="w-4 h-4" /> Eliminar {selected.size > 0 ? selected.size : ''}
              </button>
              <button onClick={exitSelectMode}
                className="p-2.5 rounded-xl transition-colors" style={{ color: tc.m }}>
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {can('clients.importar') && (
                <button onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: isLight ? 'rgba(52,211,153,0.12)' : 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399' }}>
                  <Download className="w-4 h-4" /> Plantilla Excel
                </button>
              )}
              {can('clients.importar') && (
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: isLight ? 'rgba(167,139,250,0.12)' : 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa' }}>
                  <UploadCloud className="w-4 h-4" /> Importar clientes
                </button>
              )}
              {can('clients.eliminar') && (
                <button onClick={() => setSelectMode(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)', color: '#f87171' }}>
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              )}
              {can('clients.nuevo') && (
                <button onClick={() => setShowCreate(true)}
                  className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-medium">
                  <Plus className="w-4 h-4" /> Nuevo cliente
                </button>
              )}
            </>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>
      </div>

      {/* Buscador */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: tc.m }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, NIT, ciudad..."
            className="input-glass w-full rounded-xl pl-9 pr-4 py-2.5 text-sm" />
        </div>
        <button onClick={load} className="p-2.5 rounded-xl transition-colors" style={{ color: tc.m }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Grid de clientes */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: 'var(--border-subtle)' }} />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="py-20 text-center">
          <Building2 className="w-12 h-12 mx-auto mb-3" style={{ color: tc.m }} />
          <p className="text-sm" style={{ color: tc.m }}>No se encontraron clientes</p>
          {can('clients.nuevo') && (
            <button onClick={() => setShowCreate(true)}
              className="btn-primary mt-4 px-5 py-2.5 rounded-xl text-sm text-white font-medium">
              Crear primer cliente
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client, i) => {
            const isChecked = selected.has(client.id);
            const cardContent = (
              <motion.div
                whileHover={{ y: selectMode ? 0 : -3, boxShadow: isLight
                  ? '0 12px 32px rgba(30,60,120,0.22), inset 0 1px 0 rgba(255,255,255,0.98)'
                  : '0 12px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.15)'
                }}
                onClick={selectMode ? () => toggleSelect(client.id) : undefined}
                className="rounded-2xl p-5 transition-all"
                style={{
                  ...glassCard,
                  cursor: selectMode ? 'pointer' : undefined,
                  outline: isChecked ? '2px solid #f87171' : 'none',
                  outlineOffset: '2px',
                }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #1E3A5F, #2D5086)' }}>
                    {client.businessName[0]}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectMode ? (
                      <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                        style={{
                          background: isChecked ? '#f87171' : 'transparent',
                          borderColor: isChecked ? '#f87171' : 'var(--border-strong)',
                        }}>
                        {isChecked && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                    ) : (
                      <>
                        {client.isActive
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          : <XCircle className="w-4 h-4 text-red-400" />}
                        <ChevronRight className="w-4 h-4 transition-colors" style={{ color: tc.m }} />
                      </>
                    )}
                  </div>
                </div>
                <h3 className="font-semibold text-sm leading-tight mb-0.5 line-clamp-1" style={{ color: tc.p }}>
                  {client.businessName}
                </h3>
                {client.commercialName && (
                  <p className="text-xs mb-2" style={{ color: tc.s }}>{client.commercialName}</p>
                )}
                <p className="text-xs font-mono" style={{ color: tc.s }}>NIT: {client.nit}</p>
                {client.city && (
                  <p className="text-xs mt-0.5" style={{ color: tc.s }}>
                    {client.city}{client.department ? `, ${client.department}` : ''}
                  </p>
                )}
                {client._count && (
                  <div className="flex items-center gap-4 mt-4 pt-3" style={dividerStyle}>
                    <span className="flex items-center gap-1 text-xs" style={{ color: tc.s }}>
                      <Users className="w-3.5 h-3.5" /> {client._count.staff} funcionarios
                    </span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: tc.s }}>
                      <Building2 className="w-3.5 h-3.5" /> {client._count.serviceOrders} OS
                    </span>
                  </div>
                )}
              </motion.div>
            );

            return (
              <motion.div key={client.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                {selectMode ? cardContent : <Link href={`/clientes/${client.id}`}>{cardContent}</Link>}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Paginación */}
      {total > 12 && (
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: tc.m }}>Página {page} de {Math.ceil(total / 12)}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Anterior
            </button>
            <button disabled={page >= Math.ceil(total / 12)} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ── Modal crear cliente ─────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setForm(EMPTY_FORM); }} title="Nuevo cliente" width="max-w-xl">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>NIT <span className="text-red-400">*</span></label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="900123456-7"
              value={form.nit} onChange={e => setForm(p => ({ ...p, nit: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Razón social <span className="text-red-400">*</span></label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Hospital San Jorge S.A.S"
              value={form.businessName} onChange={e => setForm(p => ({ ...p, businessName: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nombre comercial</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Hospital San Jorge"
              value={form.commercialName} onChange={e => setForm(p => ({ ...p, commercialName: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <MunicipioSearch
              municipios={municipios}
              value={form.city ? `${form.city}${form.department ? `, ${form.department}` : ''}` : ''}
              onSelect={m => setForm(p => ({
                ...p,
                municipioId: m?.id ?? '',
                city:        m?.nombreMunicipio ?? '',
                department:  m?.nombreDepartamento ?? '',
              }))}
              label="Municipio"
              placeholder="Buscar municipio o departamento..."
              inputClassName="input-glass rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Dirección</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Cra 15 #23-45"
              value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Correo empresa</label>
            <input type="email" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="info@empresa.com"
              value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Teléfono</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="3101234567"
              value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Actividad económica</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Ej: Servicios de salud"
              value={form.economicActivity} onChange={e => setForm(p => ({ ...p, economicActivity: e.target.value }))} />
          </div>
          <div className="col-span-2 flex gap-3 pt-2">
            <button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}
              className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50">
              {saving ? 'Creando...' : 'Crear cliente'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal confirmar eliminación ────────────────────────────────────── */}
      <Modal open={showConfirm} onClose={() => { if (!deleting) setShowConfirm(false); }}
        title="Confirmar eliminación" width="max-w-md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#f87171' }}>
                ¿Eliminar {selected.size} cliente{selected.size !== 1 ? 's' : ''}?
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Esta acción no se puede deshacer. Los clientes con órdenes de servicio, requerimientos o usuarios de portal <strong>no podrán eliminarse</strong> y se mostrará un aviso.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowConfirm(false)} disabled={deleting}
              className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.40)' }}>
              {deleting
                ? <><span className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" /> Eliminando...</>
                : <><Trash2 className="w-4 h-4" /> Confirmar eliminación</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal importar clientes ─────────────────────────────────────────── */}
      <Modal open={showImport} onClose={() => { setShowImport(false); setImportRows([]); }}
        title="Importar clientes desde Excel" width="max-w-4xl">
        <div className="space-y-4">

          {/* Resumen de validación */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> {validCount} válido{validCount !== 1 ? 's' : ''}
            </div>
            {invalidCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                <XCircle className="w-3.5 h-3.5" /> {invalidCount} con error{invalidCount !== 1 ? 'es' : ''}
              </div>
            )}
            <span className="text-xs" style={{ color: tc.m }}>{importRows.length} fila{importRows.length !== 1 ? 's' : ''} detectada{importRows.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Tabla de previsualización */}
          <div className="rounded-xl overflow-auto max-h-80 border" style={{ borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }}>
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr style={{ background: isLight ? '#1e293b' : '#0f172a' }}>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-400 w-12">Fila</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-400">NIT</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-400">Razón Social</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-400">Ciudad</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-400">Correo</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody>
                {importRows.map((row, i) => (
                  <tr key={i}
                    style={{
                      background: row.valid
                        ? (i % 2 === 0 ? (isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)') : 'transparent')
                        : (isLight ? 'rgba(248,113,113,0.05)' : 'rgba(248,113,113,0.06)'),
                      borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
                    }}>
                    <td className="px-3 py-2 font-mono font-bold text-center" style={{ color: tc.m }}>{row.fila}</td>
                    <td className="px-3 py-2 font-mono" style={{ color: tc.s }}>{row.nit || <span className="opacity-40">—</span>}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate" style={{ color: tc.p }}>{row.businessName || <span className="opacity-40">—</span>}</td>
                    <td className="px-3 py-2" style={{ color: tc.s }}>{row.city || '—'}</td>
                    <td className="px-3 py-2" style={{ color: tc.s }}>{row.email || '—'}</td>
                    <td className="px-3 py-2">
                      {row.valid ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> OK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[120px]" title={row.errors.join(', ')}>{row.errors[0]}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invalidCount > 0 && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: '#fbbf24' }}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Las filas con error serán omitidas. Solo se importarán las {validCount} filas válidas.
            </p>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-1">
            <button onClick={() => { setShowImport(false); setImportRows([]); }}
              className="px-4 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleImport} disabled={validCount === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
              style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.40)' }}>
              <UploadCloud className="w-4 h-4" /> Importar {validCount} cliente{validCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Overlay de progreso de importación ─────────────────────────────── */}
      {importProgress && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative rounded-2xl p-7 w-full max-w-sm flex flex-col gap-4"
            style={{
              background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.95)',
              border: `1px solid ${isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.12)'}`,
              backdropFilter: 'blur(20px)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
            }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(167,139,250,0.15)' }}>
                {importProgress.done
                  ? <CheckCircle2 className="w-5 h-5" style={{ color: '#34d399' }} />
                  : <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#a78bfa' }} />}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: isLight ? '#1e293b' : '#f1f5f9' }}>
                  {importProgress.done ? 'Importación completada' : 'Importando clientes...'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                  {importProgress.done
                    ? `${importProgress.exitosos} creados · ${importProgress.fallidos} omitidos`
                    : `Procesando ${importProgress.total} registro${importProgress.total !== 1 ? 's' : ''}...`}
                </p>
              </div>
            </div>

            {/* Barra: indeterminada mientras procesa, llena al terminar */}
            <div className="w-full rounded-full overflow-hidden"
              style={{ height: 8, background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }}>
              {importProgress.done ? (
                <div className="h-full w-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #34d399, #10b981)' }} />
              ) : (
                <div className="h-full rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]"
                  style={{ background: 'linear-gradient(90deg, #a78bfa, #7c3aed)', width: '40%' }} />
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
          </div>
        </div>
      )}
    </div>
  );
}
