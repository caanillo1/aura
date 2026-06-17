'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Mail, Phone, MapPin, Users, Hash, Briefcase, CheckCircle2, XCircle,
  UserCircle2, Plus, Upload, Download, Pencil, Trash2, Star, X, FileSpreadsheet, FolderOpen,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BackButton } from '@/components/ui/BackButton';
import { Modal } from '@/components/ui/Modal';
import { clientsApi, municipiosApi } from '@/lib/api';
import { DocumentosSection } from '@/components/ui/DocumentosSection';
import { usePermission } from '@/hooks/usePermission';
import { toast } from 'sonner';
import type { Client, ClientStaff, Municipio } from '@/types';

type Tab = 'staff' | 'users' | 'documentos';

// ── Helpers ────────────────────────────────────────────────────────────────

const STAFF_COLS = ['Documento', 'Nombres', 'Apellidos', 'Cargo', 'Correo', 'Telefono', 'Lider_Proyecto'];

function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Instructivo
  const instructions = [
    ['PLANTILLA DE CARGA MASIVA — PERSONAL DEL CLIENTE'],
    [''],
    ['INSTRUCCIONES DE DILIGENCIAMIENTO'],
    [''],
    ['1. Diligencie la información en la Hoja "Personal" (segunda pestaña).'],
    ['2. NO modifique los encabezados de la segunda hoja.'],
    ['3. La primera fila de datos debe ir a partir de la fila 2 (debajo de los encabezados).'],
    ['4. Campos obligatorios: Documento, Nombres, Apellidos.'],
    ['5. En el campo "Lider_Proyecto" escriba SI para marcar como líder, NO o déjelo vacío si no lo es.'],
    ['6. Puede haber múltiples líderes de proyecto del lado del cliente.'],
    ['7. El correo debe tener formato válido (ejemplo@dominio.com).'],
    ['8. No incluya filas vacías entre los datos.'],
    [''],
    ['DESCRIPCIÓN DE COLUMNAS'],
    [''],
    ['Columna', 'Descripción', 'Obligatorio', 'Ejemplo'],
    ['Documento', 'Número de cédula o identificación', 'SÍ', '1234567890'],
    ['Nombres', 'Nombres del funcionario', 'SÍ', 'Juan Carlos'],
    ['Apellidos', 'Apellidos del funcionario', 'SÍ', 'Pérez Gómez'],
    ['Cargo', 'Cargo o posición que ocupa', 'NO', 'Analista de Sistemas'],
    ['Correo', 'Correo electrónico institucional', 'NO', 'juan.perez@empresa.com'],
    ['Telefono', 'Número de teléfono o celular', 'NO', '3001234567'],
    ['Lider_Proyecto', 'SI si es líder del proyecto, NO si no lo es', 'NO', 'SI'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(instructions);
  ws1['!cols'] = [{ wch: 20 }, { wch: 45 }, { wch: 15 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Instructivo');

  // Hoja 2: Personal (plantilla con ejemplo)
  const data = [
    STAFF_COLS,
    ['1234567890', 'Juan Carlos', 'Pérez Gómez', 'Analista', 'juan.perez@empresa.com', '3001234567', 'SI'],
    ['9876543210', 'María', 'López', 'Coordinadora', 'maria.lopez@empresa.com', '3109876543', 'NO'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(data);
  ws2['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Personal');

  XLSX.writeFile(wb, 'plantilla_personal_cliente.xlsx');
}

function parseStaffExcel(file: File): Promise<object[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        // Buscar la hoja "Personal" (segunda hoja o la que se llame "Personal")
        const sheetName = wb.SheetNames.find(n => n === 'Personal') ?? wb.SheetNames[1] ?? wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });

        const items = rows
          .filter((r: any) =>
            String(r['Documento'] ?? '').trim() &&
            String(r['Nombres'] ?? '').trim() &&
            String(r['Apellidos'] ?? '').trim()
          )
          .map((r: any) => ({
            document:        String(r['Documento']).trim(),
            firstName:       String(r['Nombres']).trim(),
            lastName:        String(r['Apellidos']).trim(),
            jobTitle:        String(r['Cargo'] ?? '').trim() || undefined,
            email:           String(r['Correo'] ?? '').trim() || undefined,
            phone:           String(r['Telefono'] ?? '').trim() || undefined,
            isProjectLeader: String(r['Lider_Proyecto'] ?? '').trim().toUpperCase() === 'SI',
          }));

        if (items.length === 0) reject(new Error('No se encontraron filas válidas en el archivo'));
        else resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

// ── Modal: Agregar / Editar funcionario ────────────────────────────────────

interface StaffForm {
  document: string; firstName: string; lastName: string;
  jobTitle: string; email: string; phone: string; isProjectLeader: boolean;
}

const EMPTY_FORM: StaffForm = {
  document: '', firstName: '', lastName: '',
  jobTitle: '', email: '', phone: '', isProjectLeader: false,
};

interface StaffModalProps {
  mode: 'add' | 'edit';
  initial?: ClientStaff | null;
  clientId: string;
  onClose: () => void;
  onSaved: (s: ClientStaff) => void;
}

function StaffModal({ mode, initial, clientId, onClose, onSaved }: StaffModalProps) {
  const [form, setForm] = useState<StaffForm>(() =>
    initial
      ? {
          document: initial.document,
          firstName: initial.firstName,
          lastName: initial.lastName,
          jobTitle: initial.jobTitle ?? '',
          email: initial.email ?? '',
          phone: initial.phone ?? '',
          isProjectLeader: initial.isProjectLeader,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof StaffForm, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.document.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Documento, nombres y apellidos son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        document: form.document.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        jobTitle: form.jobTitle.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        isProjectLeader: form.isProjectLeader,
      };
      const result = mode === 'add'
        ? await clientsApi.createStaff(clientId, payload)
        : await clientsApi.updateStaff(clientId, initial!.id, payload);
      toast.success(mode === 'add' ? 'Funcionario agregado' : 'Funcionario actualizado');
      onSaved(result);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  const inputClass = 'input-glass w-full rounded-xl px-3 py-2.5 text-sm';
  const labelClass = 'block text-xs font-semibold mb-1.5 uppercase tracking-wide';

  return (
    <Modal open onClose={onClose}
      title={mode === 'add' ? 'Agregar funcionario' : 'Editar funcionario'}
      width="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
            Documento <span className="text-red-400 normal-case font-normal">*</span>
          </label>
          <input type="text" className={inputClass} placeholder="Ej: 1234567890"
            value={form.document} onChange={e => set('document', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
              Nombres <span className="text-red-400 normal-case font-normal">*</span>
            </label>
            <input type="text" className={inputClass} placeholder="Nombres"
              value={form.firstName} onChange={e => set('firstName', e.target.value)} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--text-muted)' }}>
              Apellidos <span className="text-red-400 normal-case font-normal">*</span>
            </label>
            <input type="text" className={inputClass} placeholder="Apellidos"
              value={form.lastName} onChange={e => set('lastName', e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass} style={{ color: 'var(--text-muted)' }}>Cargo</label>
          <input type="text" className={inputClass} placeholder="Ej: Analista de Sistemas"
            value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--text-muted)' }}>Correo electrónico</label>
            <input type="email" className={inputClass} placeholder="correo@empresa.com"
              value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--text-muted)' }}>Teléfono</label>
            <input type="tel" className={inputClass} placeholder="Ej: 3001234567"
              value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
        </div>

        {/* Checkbox líder de proyecto */}
        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl transition-colors"
          style={{ background: form.isProjectLeader ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${form.isProjectLeader ? 'rgba(251,191,36,0.30)' : 'rgba(255,255,255,0.08)'}` }}>
          <div className="relative mt-0.5 shrink-0">
            <input type="checkbox" className="sr-only"
              checked={form.isProjectLeader}
              onChange={e => set('isProjectLeader', e.target.checked)} />
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${form.isProjectLeader ? 'border-yellow-400' : 'border-gray-500'}`}
              style={{ background: form.isProjectLeader ? 'rgba(251,191,36,0.20)' : 'transparent' }}>
              {form.isProjectLeader && <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400" />}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: form.isProjectLeader ? '#fbbf24' : 'var(--text-primary)' }}>
              <Star className="w-3.5 h-3.5" /> Líder de proyecto
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Este funcionario actuará como líder del proyecto por parte del cliente. Puede haber múltiples líderes.
            </p>
          </div>
        </label>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? 'Guardando...' : <><Plus className="w-4 h-4" /> {mode === 'add' ? 'Agregar' : 'Guardar cambios'}</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can } = usePermission();

  const [client, setClient]   = useState<(Client & { staff: ClientStaff[] }) | null>(null);
  const [users, setUsers]     = useState<any[]>([]);
  const [tab, setTab]         = useState<Tab>('staff');
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [editClientModal, setEditClientModal] = useState(false);
  const [editForm, setEditForm] = useState({ address: '', municipioId: '', email: '', phone: '', economicActivity: '' });
  const [savingClient, setSavingClient] = useState(false);
  const [munQuery, setMunQuery] = useState('');
  const [munOpen, setMunOpen] = useState(false);
  const munRef = useRef<HTMLDivElement>(null);

  // Staff CRUD state
  const [addModal, setAddModal]       = useState(false);
  const [editTarget, setEditTarget]   = useState<ClientStaff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientStaff | null>(null);
  const [deleting, setDeleting]       = useState(false);

  // Bulk upload state
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]     = useState(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewModal, setPreviewModal] = useState(false);

  const glassTable = {
    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.10)'}`,
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: isLight
      ? '0 8px 32px rgba(30,60,120,0.18), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  };
  const rowBorder = isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)';

  const loadClient = () => {
    clientsApi.get(id)
      .then(setClient)
      .catch(() => toast.error('Error al cargar el cliente'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadClient(); }, [id]); // eslint-disable-line
  useEffect(() => { municipiosApi.listAll().then(setMunicipios).catch(() => {}); }, []);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (munRef.current && !munRef.current.contains(e.target as Node)) setMunOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (tab === 'users' && users.length === 0) {
      setLoadingUsers(true);
      clientsApi.getUsers(id)
        .then(setUsers)
        .catch(() => toast.error('Error al cargar usuarios'))
        .finally(() => setLoadingUsers(false));
    }
  }, [tab, id, users.length]);

  const handleStaffSaved = (saved: ClientStaff) => {
    setClient(prev => {
      if (!prev) return prev;
      const existing = prev.staff.find(s => s.id === saved.id);
      const staff = existing
        ? prev.staff.map(s => s.id === saved.id ? saved : s)
        : [...prev.staff, saved];
      return { ...prev, staff };
    });
    setAddModal(false);
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await clientsApi.deleteStaff(id, deleteTarget.id);
      toast.success('Funcionario eliminado');
      setClient(prev => prev ? { ...prev, staff: prev.staff.filter(s => s.id !== deleteTarget.id) } : prev);
      setDeleteTarget(null);
    } catch { toast.error('Error al eliminar funcionario'); }
    finally { setDeleting(false); }
  };

  const openEditClient = () => {
    if (!client) return;
    setEditForm({
      address: client.address ?? '',
      municipioId: client.municipioId ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      economicActivity: client.economicActivity ?? '',
    });
    const mun = municipios.find(m => m.id === (client.municipioId ?? ''));
    setMunQuery(mun ? `${mun.nombreMunicipio} — ${mun.nombreDepartamento}` : '');
    setMunOpen(false);
    setEditClientModal(true);
  };

  const handleSaveClient = async () => {
    if (!client) return;
    setSavingClient(true);
    try {
      const updated = await clientsApi.update(client.id, {
        address: editForm.address || undefined,
        municipioId: editForm.municipioId || null,
        email: editForm.email || undefined,
        phone: editForm.phone || undefined,
        economicActivity: editForm.economicActivity || undefined,
      });
      setClient(prev => prev ? { ...prev, ...updated } : prev);
      toast.success('Datos actualizados');
      setEditClientModal(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar');
    } finally { setSavingClient(false); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const items = await parseStaffExcel(file);
      setPreviewRows(items as any[]);
      setPreviewModal(true);
    } catch (err: any) {
      toast.error(err.message ?? 'Error al procesar el archivo');
    }
  };

  const handleBulkUpload = async () => {
    if (!previewRows.length) return;
    setUploading(true);
    try {
      const result: any = await clientsApi.bulkCreateStaff(id, previewRows);
      toast.success(result.message ?? `${result.count} funcionario(s) importado(s)`);
      setPreviewModal(false);
      setPreviewRows([]);
      loadClient();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al importar funcionarios');
    } finally { setUploading(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl animate-pulse">
        <div className="h-8 w-48 rounded-xl" style={{ background: 'var(--border-subtle)' }} />
        <div className="h-40 rounded-2xl" style={{ background: 'var(--border-subtle)' }} />
        <div className="h-64 rounded-2xl" style={{ background: 'var(--border-subtle)' }} />
      </div>
    );
  }

  if (!client) return <p style={{ color: 'var(--text-muted)' }}>Cliente no encontrado.</p>;

  const staff = client.staff ?? [];

  return (
    <div className="space-y-5 max-w-4xl">
      <BackButton href="/clientes" label="Volver a clientes" />

      {/* Card empresa */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 card">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #1E3A5F, #2D5086)' }}>
            {client.businessName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>{client.businessName}</h2>
              {client.isActive
                ? <span className="flex items-center gap-1 text-emerald-500 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Activo</span>
                : <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3.5 h-3.5" />Inactivo</span>
              }
              {can('clients.editar') && (
                <button onClick={openEditClient}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ml-auto"
                  style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                  <Pencil className="w-3 h-3" /> Editar datos
                </button>
              )}
            </div>
            {client.commercialName && <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{client.commercialName}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              {[
                { icon: Hash,      value: client.nit,              mono: true },
                { icon: MapPin,    value: client.municipio ? `${client.municipio.nombreMunicipio}, ${client.municipio.nombreDepartamento}` : (client.city && `${client.city}${client.department ? `, ${client.department}` : ''}`) },
                { icon: Mail,      value: client.email },
                { icon: Phone,     value: client.phone },
                { icon: Briefcase, value: client.economicActivity },
              ].filter(i => i.value).map(({ icon: Icon, value, mono }) => (
                <div key={String(value)} className="flex items-center gap-2 text-sm">
                  <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <span className={`text-xs ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text-secondary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        {([
          { key: 'staff', label: 'Personal', icon: Users, count: staff.length },
          { key: 'users', label: 'Usuarios portal', icon: UserCircle2, count: users.length },
          { key: 'documentos', label: 'Documentos', icon: FolderOpen, count: null },
        ] as const).map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'btn-primary text-white' : ''}`}
            style={tab !== key ? { color: 'var(--text-secondary)' } : {}}>
            <Icon className="w-4 h-4" />
            {label}
            {count !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-white/20' : ''}`}
                style={tab !== key ? { background: 'var(--border-subtle)', color: 'var(--text-muted)' } : {}}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Personal */}
      {tab === 'staff' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {/* Barra de acciones */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {staff.length} funcionario{staff.length !== 1 ? 's' : ''} registrado{staff.length !== 1 ? 's' : ''}
              {staff.filter(s => s.isProjectLeader).length > 0 && (
                <span className="ml-2 text-yellow-400">
                  · {staff.filter(s => s.isProjectLeader).length} líder{staff.filter(s => s.isProjectLeader).length !== 1 ? 'es' : ''} de proyecto
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {can('clients.importar') && (
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                  <Download className="w-3.5 h-3.5" /> Descargar plantilla
                </button>
              )}
              {can('clients.importar') && (
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Subir archivo
                </button>
              )}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={handleFileSelect} />
              {can('clients.staff') && (
                <button onClick={() => setAddModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white btn-primary transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Agregar funcionario
                </button>
              )}
            </div>
          </div>

          {/* Tabla */}
          <div className="rounded-2xl overflow-hidden" style={glassTable}>
            {staff.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Users className="w-10 h-10 mx-auto opacity-20" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No hay funcionarios registrados</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Agrega funcionarios uno a uno o carga masivamente con un archivo Excel
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: rowBorder, background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.03)' }}>
                    {['Funcionario', 'Cargo', 'Correo', 'Teléfono', 'Rol', 'Acciones'].map((h) => (
                      <th key={h}
                        className={`text-left font-medium px-4 py-3 text-xs uppercase tracking-wide ${['Correo', 'Teléfono'].includes(h) ? 'hidden md:table-cell' : ''}`}
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id} className="group transition-colors"
                      style={{ borderBottom: rowBorder }}
                      onMouseEnter={e => (e.currentTarget.style.background = isLight ? 'rgba(30,60,120,0.02)' : 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: s.isProjectLeader ? 'rgba(251,191,36,0.15)' : 'rgba(96,165,250,0.12)', color: s.isProjectLeader ? '#fbbf24' : '#60a5fa' }}>
                            {s.firstName[0]}{s.lastName[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                {s.firstName} {s.lastName}
                              </p>
                              {s.isProjectLeader && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                                  <Star className="w-2.5 h-2.5" /> Líder
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{s.document}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{s.jobTitle ?? '—'}</td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-xs" style={{ color: 'var(--text-secondary)' }}>{s.email ?? '—'}</td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-xs" style={{ color: 'var(--text-secondary)' }}>{s.phone ?? '—'}</td>
                      <td className="px-4 py-3.5">
                        {s.isProjectLeader ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold"
                            style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                            <Star className="w-3 h-3" /> Líder proyecto
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Funcionario</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {can('clients.staff') && (
                            <button onClick={() => setEditTarget(s)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa' }}
                              title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {can('clients.staff') && (
                            <button onClick={() => setDeleteTarget(s)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171' }}
                              title="Eliminar">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}

      {/* Tab: Usuarios del portal */}
      {tab === 'users' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl overflow-hidden" style={glassTable}>
          {loadingUsers ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Cargando usuarios...</div>
          ) : !users.length ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Este cliente no tiene usuarios de portal registrados
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: rowBorder, background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.03)' }}>
                  {['Usuario', 'Rol', 'Último acceso', 'Estado'].map((h) => (
                    <th key={h} className={`text-left font-medium px-5 py-3 text-xs uppercase tracking-wide ${['Último acceso'].includes(h) ? 'hidden md:table-cell' : ''}`}
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: rowBorder }}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.firstName} {u.lastName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{u.role?.name}</td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-xs" style={{ color: 'var(--text-muted)' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('es-CO') : 'Nunca'}
                    </td>
                    <td className="px-4 py-3.5">
                      {u.isActive
                        ? <span className="flex items-center gap-1 text-emerald-500 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Activo</span>
                        : <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3.5 h-3.5" />Inactivo</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      )}

      {/* Tab: Documentos */}
      {tab === 'documentos' && (
        <DocumentosSection clientId={id} />
      )}

      {/* Modal: Agregar funcionario */}
      {addModal && (
        <StaffModal mode="add" clientId={id} onClose={() => setAddModal(false)} onSaved={handleStaffSaved} />
      )}

      {/* Modal: Editar funcionario */}
      {editTarget && (
        <StaffModal mode="edit" initial={editTarget} clientId={id}
          onClose={() => setEditTarget(null)} onSaved={handleStaffSaved} />
      )}

      {/* Modal: Confirmar eliminación */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar funcionario" width="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            ¿Estás seguro de que deseas eliminar a{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {deleteTarget?.firstName} {deleteTarget?.lastName}
            </strong>?
            Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setDeleteTarget(null)} disabled={deleting}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50"
              style={{ background: '#ef4444' }}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Editar datos del cliente */}
      <Modal open={editClientModal} onClose={() => { setEditClientModal(false); setMunOpen(false); }} title="Editar datos del cliente" width="max-w-xl">
        <div className="grid grid-cols-2 gap-3">
          {/* Municipio — autocomplete */}
          <div className="col-span-2" ref={munRef} style={{ position: 'relative' }}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Municipio</label>
            <div style={{ position: 'relative' }}>
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                className="input-glass w-full rounded-xl py-2.5 text-sm"
                style={{ paddingLeft: 32, paddingRight: editForm.municipioId ? 32 : 12 }}
                placeholder="Buscar municipio..."
                value={munQuery}
                onChange={e => {
                  setMunQuery(e.target.value);
                  setEditForm(p => ({ ...p, municipioId: '' }));
                  setMunOpen(true);
                }}
                onFocus={() => setMunOpen(true)}
              />
              {editForm.municipioId && (
                <button
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => { setEditForm(p => ({ ...p, municipioId: '' })); setMunQuery(''); setMunOpen(false); }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {munOpen && (
              <div className="absolute left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden overflow-y-auto"
                style={{
                  top: '100%', maxHeight: 220,
                  background: isLight ? '#fff' : '#0d1a2e',
                  border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.12)'}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                }}>
                {(() => {
                  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
                  const q = norm(munQuery.trim());
                  const filtered = q
                    ? municipios.filter(m =>
                        norm(m.nombreMunicipio).includes(q) ||
                        norm(m.nombreDepartamento).includes(q)
                      )
                    : municipios;
                  if (filtered.length === 0) return (
                    <p className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>Sin resultados</p>
                  );
                  return filtered.slice(0, 50).map(m => (
                    <button key={m.id}
                      className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = isLight ? '#f1f5f9' : 'rgba(255,255,255,0.07)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onMouseDown={e => {
                        e.preventDefault();
                        setEditForm(p => ({ ...p, municipioId: m.id }));
                        setMunQuery(`${m.nombreMunicipio} — ${m.nombreDepartamento}`);
                        setMunOpen(false);
                      }}>
                      <span className="font-medium">{m.nombreMunicipio}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{m.nombreDepartamento}</span>
                    </button>
                  ));
                })()}
              </div>
            )}
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Dirección</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Cra 15 #23-45"
              value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Correo empresa</label>
            <input type="email" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="info@empresa.com"
              value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Teléfono</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="3101234567"
              value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Actividad económica</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Servicios de salud"
              value={editForm.economicActivity} onChange={e => setEditForm(p => ({ ...p, economicActivity: e.target.value }))} />
          </div>
          <div className="col-span-2 flex gap-3 pt-2">
            <button onClick={() => { setEditClientModal(false); setMunOpen(false); }}
              className="flex-1 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleSaveClient} disabled={savingClient}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50">
              {savingClient ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Vista previa carga masiva */}
      <Modal open={previewModal} onClose={() => { setPreviewModal(false); setPreviewRows([]); }}
        title="Previsualizar carga masiva" width="max-w-2xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.20)', color: '#60a5fa' }}>
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            {previewRows.length} funcionario{previewRows.length !== 1 ? 's' : ''} detectado{previewRows.length !== 1 ? 's' : ''} en el archivo.
            Revisa la información antes de importar.
          </div>

          <div className="rounded-xl overflow-hidden max-h-80 overflow-y-auto"
            style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0"
                style={{ background: isLight ? 'rgba(30,60,120,0.06)' : 'rgba(255,255,255,0.06)' }}>
                <tr>
                  {['Documento', 'Nombres', 'Apellidos', 'Cargo', 'Correo', 'Teléfono', 'Líder'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)', borderBottom: rowBorder }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row: any, i) => (
                  <tr key={i} style={{ borderBottom: rowBorder }}>
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{row.document}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{row.firstName}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{row.lastName}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{row.jobTitle ?? '—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{row.email ?? '—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{row.phone ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row.isProjectLeader
                        ? <span className="flex items-center gap-1 text-yellow-400 font-semibold"><Star className="w-3 h-3" /> Sí</span>
                        : <span style={{ color: 'var(--text-muted)' }}>No</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => { setPreviewModal(false); setPreviewRows([]); }}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleBulkUpload} disabled={uploading}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {uploading ? 'Importando...' : <><Upload className="w-4 h-4" /> Importar {previewRows.length} funcionario{previewRows.length !== 1 ? 's' : ''}</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
