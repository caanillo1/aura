'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePermission } from '@/hooks/usePermission';
import { useTheme } from 'next-themes';
import { Search, RefreshCw, Layers, ChevronRight, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Download, Upload, FileSpreadsheet, AlertCircle, CheckSquare, Square, Minus } from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { templatesApi } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import type { TemplateModule } from '@/types';

// ── Plantilla Excel ────────────────────────────────────────────────────────

const IMPORT_COLS = ['Modulo', 'Modulo_Descripcion', 'Fase', 'Fase_Color', 'Actividad', 'Actividad_Descripcion', 'Actividad_Horas', 'Actividad_Dias', 'Actividad_Rol', 'Actividad_Prioridad'];

function downloadImportTemplate() {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Instructivo
  const instr = [
    ['PLANTILLA DE IMPORTACIÓN MASIVA — MÓDULOS, FASES Y ACTIVIDADES'],
    [''],
    ['INSTRUCCIONES'],
    [''],
    ['1. Diligencie los datos en la hoja "Datos" (segunda pestaña).'],
    ['2. NO modifique los encabezados de la hoja "Datos".'],
    ['3. Cada fila representa UNA actividad. Las filas con el mismo Modulo y Fase se agrupan automáticamente.'],
    ['4. Si un módulo tiene múltiples fases, repita el nombre del módulo en cada fila.'],
    ['5. Campos obligatorios: Modulo, Fase, Actividad.'],
    ['6. Los valores que excedan la longitud máxima serán rechazados — respete los límites indicados.'],
    ['7. Actividad_Prioridad solo acepta los valores exactos: alta, media, baja (en minúsculas).'],
    ['8. Fase_Color debe ser un código hexadecimal válido de exactamente 7 caracteres (ej. #3B82F6).'],
    [''],
    ['DESCRIPCIÓN DE COLUMNAS'],
    [''],
    ['Columna', 'Descripción', 'Obligatorio', 'Long. máx.', 'Tipo', 'Ejemplo'],
    ['Modulo',               'Nombre del módulo. Las filas con el mismo nombre se agrupan en un solo módulo.',                                     'SÍ',  '200 caracteres',  'Texto',          'Historia Clínica Electrónica'],
    ['Modulo_Descripcion',   'Descripción del módulo. Solo es necesaria en la primera fila del módulo.',                                           'NO',  '500 caracteres',  'Texto',          'Gestión de historias clínicas del paciente'],
    ['Fase',                 'Nombre de la fase dentro del módulo. Las filas con el mismo Modulo+Fase pertenecen a la misma fase.',                'SÍ',  '200 caracteres',  'Texto',          'Análisis y Configuración'],
    ['Fase_Color',           'Color de identificación de la fase en formato hexadecimal. Debe iniciar con # y tener exactamente 7 caracteres.',    'NO',  '7 caracteres',    'Hex color',      '#3B82F6'],
    ['Actividad',            'Nombre de la actividad dentro de la fase.',                                                                          'SÍ',  '300 caracteres',  'Texto',          'Levantamiento de requerimientos'],
    ['Actividad_Descripcion','Descripción detallada de la actividad.',                                                                             'NO',  'Sin límite',      'Texto',          'Reunión inicial con el cliente para definir alcance'],
    ['Actividad_Horas',      'Horas estimadas para completar la actividad. Use punto como separador decimal (ej. 1.5).',                           'NO',  '9999.99 máx.',    'Número decimal', '8'],
    ['Actividad_Dias',       'Días calendario estimados para completar la actividad. Debe ser un número entero positivo.',                         'NO',  'Entero positivo', 'Número entero',  '1'],
    ['Actividad_Rol',        'Rol o perfil responsable de la actividad por defecto.',                                                              'NO',  '50 caracteres',   'Texto',          'Implementador clínico'],
    ['Actividad_Prioridad',  'Nivel de prioridad de la actividad. Valores aceptados: alta, media, baja.',                                         'NO',  '—',               'Lista: alta/media/baja', 'alta'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(instr);
  ws1['!cols'] = [{ wch: 22 }, { wch: 68 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Instructivo');

  // Hoja 2: Datos (con ejemplos)
  const datos = [
    IMPORT_COLS,
    ['IHCE', 'Historia Clínica Electrónica', 'Análisis y Configuración', '#3B82F6', 'Levantamiento de requerimientos', 'Reunión inicial con el cliente', 8, 1, 'Implementador clínico', 'alta'],
    ['IHCE', '', 'Análisis y Configuración', '#3B82F6', 'Configuración del sistema', '', 4, 1, 'Implementador clínico', 'media'],
    ['IHCE', '', 'Capacitación', '#10B981', 'Capacitación usuarios médicos', '', 16, 2, 'Implementador clínico', 'alta'],
    ['IHCE', '', 'Capacitación', '#10B981', 'Capacitación personal administrativo', '', 8, 1, 'Implementador clínico', 'media'],
    ['Facturación', 'Módulo de facturación electrónica', 'Configuración', '#F59E0B', 'Parametrización tarifaria', '', 6, 1, 'Implementador financiero', 'alta'],
    ['Facturación', '', 'Configuración', '#F59E0B', 'Configuración de impuestos', '', 4, 1, 'Implementador financiero', 'media'],
    ['Facturación', '', 'Pruebas', '#8B5CF6', 'Pruebas de facturación', '', 8, 1, 'Implementador financiero', 'alta'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(datos);
  ws2['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 35 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 25 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Datos');

  XLSX.writeFile(wb, 'plantilla_importacion_modulos.xlsx');
}

interface RowError { row: number; field: string; message: string; }
interface ParseResult { modules: object[]; errors: RowError[]; }

const HEX_COLOR_RE   = /^#[0-9A-Fa-f]{6}$/;
const VALID_PRIORITIES = new Set(['alta', 'media', 'baja']);

function parseModulesExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames.find(n => n === 'Datos') ?? wb.SheetNames[0];
        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });

        const errors: RowError[] = [];

        // ── Validate each raw row before grouping ─────────────────────────
        for (let i = 0; i < rows.length; i++) {
          const r      = rows[i];
          const rowNum = i + 2; // Excel row (header = 1, data starts at 2)

          const modulo          = String(r['Modulo']               ?? '').trim();
          const moduloDesc      = String(r['Modulo_Descripcion']   ?? '').trim();
          const fase            = String(r['Fase']                 ?? '').trim();
          const faseColor       = String(r['Fase_Color']           ?? '').trim();
          const actividad       = String(r['Actividad']            ?? '').trim();
          const actividadRol    = String(r['Actividad_Rol']        ?? '').trim();
          const actPriority     = String(r['Actividad_Prioridad']  ?? '').trim().toLowerCase();
          const actHorasStr     = String(r['Actividad_Horas']      ?? '').trim();
          const actDiasStr      = String(r['Actividad_Dias']       ?? '').trim();

          // Skip completely blank rows
          if (!modulo && !moduloDesc && !fase && !faseColor && !actividad && !actividadRol && !actPriority && !actHorasStr && !actDiasStr) continue;

          // Required fields
          if (!modulo)   errors.push({ row: rowNum, field: 'Modulo',    message: 'Campo obligatorio' });
          if (!fase)     errors.push({ row: rowNum, field: 'Fase',      message: 'Campo obligatorio' });
          if (!actividad) errors.push({ row: rowNum, field: 'Actividad', message: 'Campo obligatorio' });

          // Length limits
          if (modulo.length     > 200) errors.push({ row: rowNum, field: 'Modulo',             message: `Máximo 200 caracteres (tiene ${modulo.length})` });
          if (moduloDesc.length > 500) errors.push({ row: rowNum, field: 'Modulo_Descripcion', message: `Máximo 500 caracteres (tiene ${moduloDesc.length})` });
          if (fase.length       > 200) errors.push({ row: rowNum, field: 'Fase',               message: `Máximo 200 caracteres (tiene ${fase.length})` });
          if (actividad.length  > 300) errors.push({ row: rowNum, field: 'Actividad',          message: `Máximo 300 caracteres (tiene ${actividad.length})` });
          if (actividadRol.length > 50) errors.push({ row: rowNum, field: 'Actividad_Rol',     message: `Máximo 50 caracteres (tiene ${actividadRol.length})` });

          // Hex color format (#RRGGBB, exactly 7 chars)
          if (faseColor) {
            if (faseColor.length > 7)         errors.push({ row: rowNum, field: 'Fase_Color', message: `Máximo 7 caracteres (tiene ${faseColor.length})` });
            else if (!HEX_COLOR_RE.test(faseColor)) errors.push({ row: rowNum, field: 'Fase_Color', message: `Debe ser #RRGGBB (6 dígitos hex). Valor: "${faseColor}"` });
          }

          // Numeric — hours (Decimal 6,2)
          if (actHorasStr !== '') {
            const hrs = parseFloat(actHorasStr);
            if (isNaN(hrs))    errors.push({ row: rowNum, field: 'Actividad_Horas', message: `Debe ser un número (ej: 8 o 1.5). Valor: "${actHorasStr}"` });
            else if (hrs < 0)  errors.push({ row: rowNum, field: 'Actividad_Horas', message: 'Debe ser ≥ 0' });
            else if (hrs > 9999.99) errors.push({ row: rowNum, field: 'Actividad_Horas', message: 'Valor máximo: 9999.99' });
          }

          // Numeric — days (Integer ≥ 0)
          if (actDiasStr !== '') {
            const dias = Number(actDiasStr);
            if (!Number.isInteger(dias) || isNaN(dias)) errors.push({ row: rowNum, field: 'Actividad_Dias', message: `Debe ser un entero (ej: 1, 5). Valor: "${actDiasStr}"` });
            else if (dias < 0) errors.push({ row: rowNum, field: 'Actividad_Dias', message: 'Debe ser ≥ 0' });
          }

          // Priority enum
          if (actPriority && !VALID_PRIORITIES.has(actPriority))
            errors.push({ row: rowNum, field: 'Actividad_Prioridad', message: `Valor inválido "${actPriority}" — use: alta, media o baja` });
        }

        // ── Group: module → phase → activities ────────────────────────────
        const moduleMap = new Map<string, { name: string; description: string; phases: Map<string, { name: string; color?: string; activities: object[] }> }>();

        for (const r of rows) {
          const modName   = String(r['Modulo'] ?? '').trim();
          const phaseName = String(r['Fase']    ?? '').trim();
          const actName   = String(r['Actividad'] ?? '').trim();
          if (!modName || !phaseName || !actName) continue;

          if (!moduleMap.has(modName))
            moduleMap.set(modName, { name: modName, description: String(r['Modulo_Descripcion'] ?? '').trim(), phases: new Map() });
          const mod = moduleMap.get(modName)!;

          if (!mod.phases.has(phaseName)) {
            const rawColor = String(r['Fase_Color'] ?? '').trim();
            mod.phases.set(phaseName, { name: phaseName, color: rawColor || undefined, activities: [] });
          }
          const phase = mod.phases.get(phaseName)!;

          const hrs  = parseFloat(String(r['Actividad_Horas'] ?? ''));
          const days = parseInt(String(r['Actividad_Dias']    ?? ''), 10);
          phase.activities.push({
            name:           actName,
            description:    String(r['Actividad_Descripcion'] ?? '').trim() || undefined,
            estimatedHours: isNaN(hrs)  ? undefined : hrs,
            calculatedDays: isNaN(days) ? undefined : days,
            defaultRole:    String(r['Actividad_Rol']       ?? '').trim() || undefined,
            priority:       String(r['Actividad_Prioridad'] ?? '').trim().toLowerCase() || undefined,
          });
        }

        if (moduleMap.size === 0) {
          reject(new Error('No se encontraron filas válidas (Modulo, Fase y Actividad son obligatorios)'));
          return;
        }

        const modules = Array.from(moduleMap.values()).map(m => ({
          name:        m.name,
          description: m.description || undefined,
          phases:      Array.from(m.phases.values()),
        }));

        resolve({ modules, errors });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

const EMPTY_FORM = { name: '', description: '' };

export default function ModulosPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can } = usePermission();

  const [modules, setModules]   = useState<TemplateModule[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);

  // Create modal
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm]   = useState(EMPTY_FORM);
  const [creating, setCreating]       = useState(false);

  // Edit modal
  const [editModal, setEditModal]   = useState(false);
  const [editTarget, setEditTarget] = useState<TemplateModule | null>(null);
  const [editForm, setEditForm]     = useState(EMPTY_FORM);
  const [editing, setEditing]       = useState(false);

  // Delete confirm (single)
  const [deleteTarget, setDeleteTarget] = useState<TemplateModule | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // Bulk select + delete
  const [selectedIds, setSelectedIds]             = useState<Set<string>>(new Set());
  const [bulkDeleteModal, setBulkDeleteModal]     = useState(false);
  const [bulkDeleting, setBulkDeleting]           = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ done: number; total: number } | null>(null);

  // Bulk import
  const fileInputRef                         = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows]          = useState<any[]>([]);
  const [importErrors, setImportErrors]      = useState<RowError[]>([]);
  const [importModal, setImportModal]        = useState(false);
  const [importing, setImporting]            = useState(false);
  const [importProgress, setImportProgress]  = useState<{ done: number; total: number; current: string } | null>(null);
  const [importModuleErrors, setImportModuleErrors] = useState<string[]>([]);

  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  const tableStyle = {
    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.10)'}`,
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: isLight
      ? '0 8px 32px rgba(30,60,120,0.18), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  };

  const rowBorder = isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)';
  const headBg    = isLight ? 'rgba(30,60,120,0.06)' : 'rgba(255,255,255,0.03)';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await templatesApi.listModules({ page, limit: 20, search: search || undefined });
      setModules(res.data);
      setTotal(res.meta.total);
    } catch { toast.error('Error al cargar módulos'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Clear selections when page or search changes
  useEffect(() => { setSelectedIds(new Set()); }, [page, search]);

  // ── Bulk select helpers ───────────────────────────────────────────────────
  const visibleSelected  = modules.filter(m => selectedIds.has(m.id));
  const allOnPageSelected = modules.length > 0 && modules.every(m => selectedIds.has(m.id));
  const someOnPageSelected = modules.some(m => selectedIds.has(m.id));

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(prev => { const n = new Set(prev); modules.forEach(m => n.delete(m.id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); modules.forEach(m => n.add(m.id)); return n; });
    }
  };

  const handleBulkDelete = async () => {
    const toDelete = visibleSelected;
    if (!toDelete.length) return;
    setBulkDeleting(true);
    setBulkDeleteProgress({ done: 0, total: toDelete.length });
    let ok = 0;
    for (let i = 0; i < toDelete.length; i++) {
      try { await templatesApi.deleteModuleById(toDelete[i].id); ok++; } catch { /* continue */ }
      setBulkDeleteProgress({ done: i + 1, total: toDelete.length });
    }
    setBulkDeleting(false);
    setBulkDeleteProgress(null);
    setBulkDeleteModal(false);
    setSelectedIds(new Set());
    toast.success(`${ok} módulo${ok !== 1 ? 's' : ''} eliminado${ok !== 1 ? 's' : ''}`);
    load();
  };

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setCreating(true);
    try {
      const created = await templatesApi.createModule({
        name: createForm.name,
        description: createForm.description || undefined,
      });
      toast.success(`Módulo ${created.code} creado`);
      setCreateModal(false);
      setCreateForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al crear módulo');
    } finally { setCreating(false); }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (mod: TemplateModule) => {
    setEditTarget(mod);
    setEditForm({ name: mod.name, description: mod.description ?? '' });
    setEditModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editForm.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setEditing(true);
    try {
      await templatesApi.updateModuleById(editTarget.id, {
        name: editForm.name,
        description: editForm.description || undefined,
      });
      toast.success('Módulo actualizado');
      setEditModal(false);
      setEditTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al actualizar módulo');
    } finally { setEditing(false); }
  };

  // ── Toggle status ─────────────────────────────────────────────────────────
  const handleToggle = async (mod: TemplateModule) => {
    try {
      const updated = await templatesApi.toggleModuleStatus(mod.id);
      toast.success(updated.isActive ? 'Módulo activado' : 'Módulo desactivado');
      load();
    } catch { toast.error('Error al cambiar estado'); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await templatesApi.deleteModuleById(deleteTarget.id);
      toast.success('Módulo eliminado');
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al eliminar módulo');
    } finally { setDeleting(false); }
  };

  // ── Bulk import ──────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const { modules, errors } = await parseModulesExcel(file);
      setImportRows(modules as any[]);
      setImportErrors(errors);
      setImportModal(true);
    } catch (err: any) { toast.error(err.message ?? 'Error al procesar el archivo'); }
  };

  const handleImport = async () => {
    if (!importRows.length) return;
    setImporting(true);
    setImportModuleErrors([]);
    setImportProgress({ done: 0, total: importRows.length, current: 'Procesando...' });

    try {
      const res: any = await templatesApi.bulkImportModules(importRows);
      setImportProgress({ done: importRows.length, total: importRows.length, current: 'Completado' });

      const createdCount = res.count   ?? 0;
      const skippedCount = res.skipped ?? 0;

      if (createdCount === 0 && skippedCount > 0) {
        toast.info('Todos los módulos ya existen — no se importó ninguno nuevo');
      } else if (skippedCount > 0) {
        toast.success(`${createdCount} importado${createdCount !== 1 ? 's' : ''}, ${skippedCount} ya exist${skippedCount !== 1 ? 'ían' : 'ía'}`);
      } else {
        toast.success(`${createdCount} módulo${createdCount !== 1 ? 's' : ''} importado${createdCount !== 1 ? 's' : ''} correctamente`);
      }
      setImportModal(false);
      setImportRows([]);
      setImportErrors([]);
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Error al importar los módulos';
      setImportModuleErrors([msg]);
      toast.error(msg);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: tc.p }}>
            <Layers className="w-5 h-5 text-blue-400" /> Biblioteca de Módulos
          </h2>
          <p className="text-sm mt-0.5" style={{ color: tc.m }}>
            {total} módulo{total !== 1 ? 's' : ''} · referencia global para informes, proyectos y dashboard
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={load} className="p-2.5 rounded-xl transition-colors" style={{ color: tc.m }}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={downloadImportTemplate}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
            <Download className="w-4 h-4" /> Descargar plantilla
          </button>
          {can('settings.editar') && (
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
              <FileSpreadsheet className="w-4 h-4" /> Subir archivo
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
          {can('settings.editar') && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => { setCreateForm(EMPTY_FORM); setCreateModal(true); }}
              className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-medium">
              <Plus className="w-4 h-4" /> Nuevo módulo
            </motion.button>
          )}
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: tc.m }} />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nombre o descripción..."
          className="input-glass w-full rounded-xl pl-9 pr-4 py-2.5 text-sm" />
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <span className="text-sm font-semibold" style={{ color: '#f87171' }}>
            {selectedIds.size} módulo{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-xs px-2.5 py-1 rounded-lg"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            Deseleccionar
          </button>
          <div className="ml-auto">
            {can('settings.editar') && (
              <button onClick={() => setBulkDeleteModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.35)' }}>
                <Trash2 className="w-4 h-4" />
                Eliminar {selectedIds.size} módulo{selectedIds.size !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-2xl overflow-hidden" style={tableStyle}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: rowBorder, background: headBg }}>
              {/* Checkbox select-all */}
              <th className="px-4 py-3.5 w-10">
                <button onClick={toggleSelectAll} className="flex items-center justify-center w-full"
                  title={allOnPageSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}>
                  {allOnPageSelected
                    ? <CheckSquare className="w-4 h-4" style={{ color: '#f87171' }} />
                    : someOnPageSelected
                      ? <Minus className="w-4 h-4" style={{ color: '#f87171' }} />
                      : <Square className="w-4 h-4" style={{ color: tc.m }} />}
                </button>
              </th>
              {['Código', 'Módulo', 'Plantilla', 'Estado', 'Fases', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: tc.m }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: rowBorder }}>
                    <td colSpan={7} className="px-4 py-3.5">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />
                    </td>
                  </tr>
                ))
              : modules.map((mod, i) => {
                  const isSelected = selectedIds.has(mod.id);
                  return (
                  <motion.tr key={mod.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    style={{ borderBottom: rowBorder, background: isSelected ? (isLight ? 'rgba(248,113,113,0.04)' : 'rgba(248,113,113,0.06)') : 'transparent' }}
                    className="transition-colors"
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isLight ? 'rgba(30,60,120,0.03)' : 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? (isLight ? 'rgba(248,113,113,0.04)' : 'rgba(248,113,113,0.06)') : 'transparent'; }}>

                    {/* Checkbox */}
                    <td className="px-4 py-3.5 w-10">
                      <button onClick={() => toggleSelect(mod.id)} className="flex items-center justify-center w-full">
                        {isSelected
                          ? <CheckSquare className="w-4 h-4" style={{ color: '#f87171' }} />
                          : <Square className="w-4 h-4" style={{ color: tc.m, opacity: 0.5 }} />}
                      </button>
                    </td>

                    {/* Código */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-xs px-2 py-1 rounded"
                        style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                        {mod.code}
                      </span>
                    </td>

                    {/* Nombre + descripción */}
                    <td className="px-4 py-3.5">
                      <p className="font-medium" style={{ color: tc.p }}>{mod.name}</p>
                      {mod.description && (
                        <p className="text-xs truncate max-w-[200px] mt-0.5" style={{ color: tc.m }}>{mod.description}</p>
                      )}
                    </td>

                    {/* Plantilla */}
                    <td className="px-4 py-3.5">
                      {mod.templateFlow ? (
                        <div>
                          <p className="text-sm" style={{ color: tc.s }}>{mod.templateFlow.name}</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
                            v{mod.templateFlow.version}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs italic" style={{ color: tc.m }}>Independiente</span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        mod.isActive
                          ? 'bg-green-400/15 text-green-400'
                          : 'bg-gray-400/15 text-gray-400'
                      }`}>
                        {mod.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Fases */}
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1 text-xs" style={{ color: tc.m }}>
                        <Layers className="w-3 h-3" />
                        {mod._count?.phases ?? 0}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {/* Editar */}
                        {can('settings.editar') && (
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            onClick={() => openEdit(mod)}
                            title="Editar"
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#60a5fa' }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </motion.button>
                        )}

                        {/* Activar / Desactivar */}
                        {can('settings.editar') && (
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            onClick={() => handleToggle(mod)}
                            title={mod.isActive ? 'Desactivar' : 'Activar'}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: mod.isActive ? '#34d399' : '#94a3b8' }}>
                            {mod.isActive
                              ? <ToggleRight className="w-4 h-4" />
                              : <ToggleLeft  className="w-4 h-4" />}
                          </motion.button>
                        )}

                        {/* Eliminar */}
                        {can('settings.editar') && (
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            onClick={() => setDeleteTarget(mod)}
                            title="Eliminar"
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#f87171' }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </motion.button>
                        )}

                        {/* Configurar fases/actividades */}
                        <Link href={`/implementacion/modulos/${mod.id}`}>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ml-1"
                            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                            Configurar <ChevronRight className="w-3 h-3" />
                          </motion.button>
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                  );
                })
            }
          </tbody>
        </table>
        {!loading && modules.length === 0 && (
          <div className="py-16 text-center text-sm" style={{ color: tc.m }}>
            No hay módulos — crea uno con el botón "Nuevo módulo"
          </div>
        )}
      </div>

      {/* Paginación */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: tc.m }}>Página {page} de {Math.ceil(total / 20)}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>Anterior</button>
            <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: tc.s }}>Siguiente</button>
          </div>
        </div>
      )}

      {/* Modal — Crear */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Nuevo módulo" width="max-w-md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.20)' }}>
            <span className="text-xs font-mono font-bold" style={{ color: '#60a5fa' }}>Código</span>
            <span className="text-xs" style={{ color: tc.m }}>auto-generado al guardar (MOD-001, MOD-002…)</span>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Nombre <span className="text-red-400 normal-case">*</span>
            </label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              placeholder="Ej: Módulo de Facturación"
              value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
              autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Detalle</label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2 text-sm resize-none" rows={3}
              placeholder="Descripción opcional..."
              value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setCreateModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={creating}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {creating ? 'Creando...' : 'Crear módulo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal — Editar */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={`Editar · ${editTarget?.code ?? ''}`} width="max-w-md">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Nombre <span className="text-red-400 normal-case">*</span>
            </label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
              autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Detalle</label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2 text-sm resize-none" rows={3}
              value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setEditModal(false)}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={editing}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {editing ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal — Importar módulos */}
      <Modal open={importModal} onClose={() => { setImportModal(false); setImportRows([]); setImportErrors([]); }}
        title="Previsualizar importación" width="max-w-3xl">
        <div className="space-y-4">

          {/* ── Banner: errores de validación ─────────────────────────────── */}
          {importErrors.length > 0 ? (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(248,113,113,0.35)' }}>
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'rgba(248,113,113,0.12)', borderBottom: '1px solid rgba(248,113,113,0.20)' }}>
                <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#f87171' }} />
                <span className="text-xs font-semibold" style={{ color: '#f87171' }}>
                  {importErrors.length} error{importErrors.length !== 1 ? 'es' : ''} encontrado{importErrors.length !== 1 ? 's' : ''} — corrija el archivo y vuelva a subirlo
                </span>
              </div>
              <div className="max-h-44 overflow-y-auto">
                {importErrors.map((err, i) => (
                  <div key={i} className="grid text-xs px-3 py-1.5"
                    style={{ gridTemplateColumns: '52px 160px 1fr', gap: '0.5rem', borderBottom: '1px solid rgba(248,113,113,0.08)', alignItems: 'start' }}>
                    <span className="font-mono" style={{ color: 'rgba(248,113,113,0.65)' }}>Fila {err.row}</span>
                    <span className="font-semibold truncate" style={{ color: '#f87171' }}>{err.field}</span>
                    <span style={{ color: '#fca5a5' }}>{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
              style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.20)', color: '#a78bfa' }}>
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              {importRows.length} módulo{importRows.length !== 1 ? 's' : ''} detectado{importRows.length !== 1 ? 's' : ''} — sin errores · Revisa antes de importar.
            </div>
          )}

          {/* ── Vista previa jerárquica ────────────────────────────────────── */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {(importRows as any[]).map((mod: any, mi: number) => (
              <div key={mi} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-sm" style={{ color: tc.p }}>{mod.name}</span>
                  {mod.description && <span className="text-xs" style={{ color: tc.m }}>— {mod.description}</span>}
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                    {mod.phases?.length ?? 0} fase{(mod.phases?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                {(mod.phases ?? []).map((ph: any, pi: number) => (
                  <div key={pi} className="ml-3 mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      {ph.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ph.color }} />}
                      <span className="text-xs font-semibold" style={{ color: tc.s }}>{ph.name}</span>
                      <span className="text-[10px]" style={{ color: tc.m }}>{ph.activities?.length ?? 0} actividad{(ph.activities?.length ?? 0) !== 1 ? 'es' : ''}</span>
                    </div>
                    <div className="ml-4 space-y-0.5">
                      {(ph.activities ?? []).map((act: any, ai: number) => (
                        <div key={ai} className="flex items-center gap-2 text-xs" style={{ color: tc.m }}>
                          <span className="w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--text-muted)' }} />
                          <span style={{ color: tc.s }}>{act.name}</span>
                          {act.estimatedHours && <span className="text-[10px]">· {act.estimatedHours}h</span>}
                          {act.priority && <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: act.priority === 'alta' ? 'rgba(248,113,113,0.10)' : act.priority === 'media' ? 'rgba(251,191,36,0.10)' : 'rgba(148,163,184,0.10)',
                              color: act.priority === 'alta' ? '#f87171' : act.priority === 'media' ? '#fbbf24' : '#94a3b8' }}>
                            {act.priority}
                          </span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* ── Errores por módulo (después de intentar importar) ──────────── */}
          {importModuleErrors.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(251,191,36,0.35)' }}>
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'rgba(251,191,36,0.10)', borderBottom: '1px solid rgba(251,191,36,0.20)' }}>
                <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#fbbf24' }} />
                <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>
                  {importModuleErrors.length} módulo{importModuleErrors.length !== 1 ? 's' : ''} no se pudo importar
                </span>
              </div>
              <div className="max-h-28 overflow-y-auto">
                {importModuleErrors.map((msg, i) => (
                  <div key={i} className="px-3 py-1.5 text-xs" style={{ color: '#fcd34d', borderBottom: '1px solid rgba(251,191,36,0.08)' }}>{msg}</div>
                ))}
              </div>
            </div>
          )}

          {/* ── Barra de progreso ─────────────────────────────────────────── */}
          {importing && importProgress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="truncate max-w-xs">
                  Importando: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{importProgress.current}</span>
                </span>
                <span className="shrink-0 ml-2 font-mono">{importProgress.done} / {importProgress.total}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((importProgress.done / importProgress.total) * 100)}%`, background: 'linear-gradient(90deg,#4f46e5,#7c3aed)' }} />
              </div>
              <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                {Math.round((importProgress.done / importProgress.total) * 100)}% completado
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => { setImportModal(false); setImportRows([]); setImportErrors([]); setImportModuleErrors([]); setImportProgress(null); }}
              disabled={importing}
              className="px-4 py-2.5 rounded-xl text-sm disabled:opacity-40"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleImport} disabled={importing || importErrors.length > 0}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {importing
                ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Importando...</>
                : importErrors.length > 0
                  ? <><AlertCircle className="w-4 h-4" /> Corrija los errores para continuar</>
                  : <><Upload className="w-4 h-4" /> Importar {importRows.length} módulo{importRows.length !== 1 ? 's' : ''}</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal — Confirmar eliminar */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar módulo" width="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: tc.s }}>
            ¿Eliminar el módulo <span className="font-bold" style={{ color: tc.p }}>{deleteTarget?.name}</span>
            {' '}(<span className="font-mono text-xs" style={{ color: '#60a5fa' }}>{deleteTarget?.code}</span>)?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteTarget(null)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50"
              style={{ background: '#ef4444' }}>
              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal — Eliminar seleccionados */}
      <Modal open={bulkDeleteModal} onClose={() => { if (!bulkDeleting) setBulkDeleteModal(false); }}
        title={`Eliminar ${selectedIds.size} módulo${selectedIds.size !== 1 ? 's' : ''}`} width="max-w-md">
        <div className="space-y-4">
          {!bulkDeleting ? (
            <>
              <p className="text-sm" style={{ color: tc.s }}>
                Se eliminarán permanentemente los siguientes módulos junto con todas sus fases y actividades. Esta acción no se puede deshacer.
              </p>
              <div className="rounded-xl max-h-48 overflow-y-auto space-y-1 p-3"
                style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.20)' }}>
                {visibleSelected.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>{m.code}</span>
                    <span style={{ color: tc.p }}>{m.name}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setBulkDeleteModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm"
                  style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  Cancelar
                </button>
                <button onClick={handleBulkDelete}
                  className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold"
                  style={{ background: '#ef4444' }}>
                  Sí, eliminar {selectedIds.size}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3 py-2">
              <p className="text-sm text-center" style={{ color: tc.s }}>Eliminando módulos…</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>Progreso</span>
                  <span className="font-mono">{bulkDeleteProgress?.done ?? 0} / {bulkDeleteProgress?.total ?? 0}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${bulkDeleteProgress ? Math.round((bulkDeleteProgress.done / bulkDeleteProgress.total) * 100) : 0}%`,
                      background: 'linear-gradient(90deg,#ef4444,#f87171)',
                    }} />
                </div>
                <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                  {bulkDeleteProgress ? Math.round((bulkDeleteProgress.done / bulkDeleteProgress.total) * 100) : 0}% completado
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
