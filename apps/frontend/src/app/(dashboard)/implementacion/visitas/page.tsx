'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  MapPin, Plus, RefreshCw, Search, X, ChevronDown,
  CheckCircle2, Clock, FileText, PenLine, Trash2, Calendar,
  User, Building2, Lock, Mail, RotateCcw, Filter,
} from 'lucide-react';
import { actasApi, projectsApi, type CreateActaPayload } from '@/lib/api';
import { SignaturePad, type SignaturePadRef } from '@/components/ui/SignaturePad';
import { MunicipioSearch } from '@/components/ui/MunicipioSearch';
import { toast } from 'sonner';
import type { Project, Municipio } from '@/types';

// ── Tipos locales ──────────────────────────────────────────────────────────────

interface Firmante {
  id?: string;
  nombre: string;
  cargo: string;
  empresa: string;
  email?: string;
  orden: number;
  signatureData?: string;
  signedAt?: string;
  signerType?: string;
}
interface FechaVisita { fecha: string; horaInicio: string; horaFin: string; }
interface Compromiso  { numero: number; compromiso: string; responsable: string; estado: string; }
interface ActaVisita  {
  id: string;
  numero?: string;
  fecha: string;
  lugar?: string;
  ciudad?: string;
  status: string;
  implementadorNombre?: string;
  jefeNombre?: string;
  actividadesRealizadas?: string;
  fechasVisita?: FechaVisita[];
  compromisos?: any[];
  firmantes?: Firmante[];
  municipio?: Municipio | null;
  municipioId?: string | null;
  project?: { id: string; name: string; serviceOrder?: { client?: { businessName: string } } } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

function emptyForm(projectId?: string) {
  return {
    projectId: projectId ?? '',
    fecha: localToday(),
    municipioId: undefined as string | undefined,
    municipio: undefined as Municipio | undefined,
    ciudad: '',
    lugar: '',
    implementadorNombre: '',
    jefeNombre: '',
    actividadesRealizadas: '',
    fechasVisita: [{ fecha: localToday(), horaInicio: '08:00', horaFin: '17:00' }] as FechaVisita[],
    compromisos: [] as Compromiso[],
    firmantes: [
      { nombre: '', cargo: '', empresa: '', email: '', orden: 0, signerType: 'agent' },
      { nombre: '', cargo: '', empresa: '', email: '', orden: 1, signerType: 'client' },
    ] as Firmante[],
  };
}

type ModalTab = 'general' | 'fechas' | 'compromisos' | 'firmantes';

// ── Panel de firmas ────────────────────────────────────────────────────────────

function FirmantesPanel({ acta, onRefresh }: { acta: ActaVisita; onRefresh: () => void }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [firmantes, setFirmantes] = useState<Firmante[]>(acta.firmantes ?? []);
  const [signing, setSigning]     = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const sigRef = useRef<SignaturePadRef>(null);

  useEffect(() => {
    actasApi.get(acta.id)
      .then((f: any) => setFirmantes(f?.firmantes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [acta.id]);

  async function handleSign(f: Firmante) {
    if (!f.id) return;
    const sig = sigRef.current?.toDataURL();
    if (!sig || sigRef.current?.isEmpty()) { toast.error('Dibuja tu firma antes de guardar'); return; }
    try {
      await actasApi.signFirmante(f.id, sig);
      toast.success('Firma guardada');
      const fresh: any = await actasApi.get(acta.id);
      setFirmantes(fresh?.firmantes ?? []);
      setSigning(null);
      onRefresh();
    } catch { toast.error('Error al guardar firma'); }
  }

  async function handleResend(actaId: string, firmanteId: string) {
    setResending(firmanteId);
    try {
      await actasApi.resendEmail(actaId, firmanteId);
      toast.success('Correo reenviado');
    } catch { toast.error('Error al reenviar correo'); }
    finally { setResending(null); }
  }

  const surface = isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)';
  const border  = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : firmantes.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>Sin firmantes configurados</p>
      ) : firmantes.map(f => (
        <div key={f.id ?? f.orden} className="rounded-xl p-3" style={{ background: surface, border: `1px solid ${border}` }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{f.nombre || '—'}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.cargo} · {f.empresa}</p>
              {f.email && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.email}</p>}
            </div>
            <div className="shrink-0">
              {f.signedAt
                ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>Firmado</span>
                : <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}>Pendiente</span>
              }
            </div>
          </div>

          {!f.signedAt && f.id && (
            <div className="mt-2 flex gap-2 flex-wrap">
              <button onClick={() => setSigning(signing === f.id ? null : f.id!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                <PenLine className="w-3 h-3" /> Firmar aquí
              </button>
              {f.email && (
                <button disabled={resending === f.id} onClick={() => handleResend(acta.id, f.id!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
                  {resending === f.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  Reenviar correo
                </button>
              )}
            </div>
          )}

          <AnimatePresence>
            {signing === f.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: border }}>
                  <SignaturePad ref={sigRef} width={400} height={150} />
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleSign(f)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ background: 'linear-gradient(135deg,#2563EB,#6366F1)' }}>
                    Guardar firma
                  </button>
                  <button onClick={() => sigRef.current?.clear()}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: surface, color: 'var(--text-muted)' }}>
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <button onClick={() => setSigning(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: surface, color: 'var(--text-muted)' }}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {f.signedAt && f.signatureData && (
            <div className="mt-2 rounded-lg overflow-hidden border" style={{ borderColor: border }}>
              <img src={f.signatureData} alt="firma" className="w-full h-16 object-contain"
                style={{ background: isLight ? '#fff' : '#0f172a' }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Selector de proyecto (opcional) ───────────────────────────────────────────

function ProjectPicker({ value, onChange }: { value: Project | null; onChange: (p: Project | null) => void }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(false);
  const [results, setResults] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const border  = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)';
  const surface = isLight ? '#FFFFFF' : 'rgba(10,18,42,0.98)';
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      setLoading(true);
      projectsApi.list({ search, limit: 10 })
        .then(r => setResults(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
  }, [search, open]);

  const inputStyle = {
    background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${border}`,
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 12px 8px 36px',
    width: '100%',
    fontSize: 13,
    outline: 'none',
  };

  return (
    <div className="relative">
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        <input
          value={value ? `${value.name} — ${value.serviceOrder?.client?.businessName ?? ''}` : search}
          onChange={e => { setSearch(e.target.value); setOpen(true); if (value) onChange(null); }}
          onFocus={() => setOpen(true)}
          placeholder="Asociar a proyecto (opcional)"
          style={inputStyle}
        />
        {value && (
          <button onClick={() => { onChange(null); setSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && !value && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
              style={{ background: surface, border: `1px solid ${border}`, boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }}>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : results.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Sin resultados</p>
              ) : results.map(p => (
                <button key={p.id} onClick={() => { onChange(p); setOpen(false); setSearch(''); }}
                  className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(96,165,250,0.12)' }}>
                    <Building2 className="w-3.5 h-3.5" style={{ color: '#60a5fa' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.serviceOrder?.client?.businessName ?? '—'}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Modal principal ────────────────────────────────────────────────────────────

function ActaModal({ acta, onClose, onSaved }: { acta: ActaVisita | null; onClose: () => void; onSaved: () => void }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [tab, setTab]         = useState<ModalTab>('general');
  const [saving, setSaving]   = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showSignPanel, setShowSignPanel] = useState(false);
  const [linkedProject, setLinkedProject] = useState<Project | null>(
    acta?.project ? (acta.project as unknown as Project) : null
  );
  const [form, setForm] = useState(() => {
    if (acta) {
      return {
        projectId: acta.project?.id ?? '',
        fecha: acta.fecha?.slice(0, 10) ?? localToday(),
        ciudad: acta.ciudad ?? '',
        municipioId: acta.municipioId ?? undefined as string | undefined,
        municipio: acta.municipio ?? undefined as Municipio | undefined,
        lugar: acta.lugar ?? '',
        implementadorNombre: acta.implementadorNombre ?? '',
        jefeNombre: acta.jefeNombre ?? '',
        actividadesRealizadas: acta.actividadesRealizadas ?? '',
        fechasVisita: (acta.fechasVisita ?? [{ fecha: localToday(), horaInicio: '08:00', horaFin: '17:00' }]) as FechaVisita[],
        compromisos: (acta.compromisos ?? []) as Compromiso[],
        firmantes: (acta.firmantes ?? []) as Firmante[],
      };
    }
    return emptyForm();
  });

  const surface  = isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.03)';
  const surface2 = isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)';
  const border   = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
  const inputStyle = {
    background: surface2, border: `1px solid ${border}`, color: 'var(--text-primary)',
    borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 13, outline: 'none',
  };

  function setField(key: string, value: any) { setForm(f => ({ ...f, [key]: value })); }

  function addFechaVisita() {
    setForm(f => ({ ...f, fechasVisita: [...f.fechasVisita, { fecha: localToday(), horaInicio: '08:00', horaFin: '17:00' }] }));
  }
  function removeFechaVisita(i: number) {
    setForm(f => ({ ...f, fechasVisita: f.fechasVisita.filter((_, j) => j !== i) }));
  }
  function updateFechaVisita(i: number, key: keyof FechaVisita, value: string) {
    setForm(f => ({ ...f, fechasVisita: f.fechasVisita.map((fv, j) => j === i ? { ...fv, [key]: value } : fv) }));
  }
  function addCompromiso() {
    setForm(f => ({ ...f, compromisos: [...f.compromisos, { numero: f.compromisos.length + 1, compromiso: '', responsable: '', estado: 'pendiente' }] }));
  }
  function removeCompromiso(i: number) {
    setForm(f => ({ ...f, compromisos: f.compromisos.filter((_, j) => j !== i) }));
  }
  function updateCompromiso(i: number, key: keyof Compromiso, value: string | number) {
    setForm(f => ({ ...f, compromisos: f.compromisos.map((c, j) => j === i ? { ...c, [key]: value } : c) }));
  }
  function addFirmante() {
    setForm(f => ({ ...f, firmantes: [...f.firmantes, { nombre: '', cargo: '', empresa: '', email: '', orden: f.firmantes.length, signerType: 'client' }] }));
  }
  function removeFirmante(i: number) {
    setForm(f => ({ ...f, firmantes: f.firmantes.filter((_, j) => j !== i) }));
  }
  function updateFirmante(i: number, key: keyof Firmante, value: string) {
    setForm(f => ({ ...f, firmantes: f.firmantes.map((fi, j) => j === i ? { ...fi, [key]: value } : fi) }));
  }

  async function handleSave() {
    if (!form.fecha) { toast.error('La fecha es obligatoria'); return; }
    setSaving(true);
    try {
      const pid = linkedProject?.id || form.projectId || undefined;
      const payload: CreateActaPayload = {
        ...(pid ? { projectId: pid } : {}),
        type: 'visita',
        fecha: form.fecha,
        ciudad: form.ciudad || undefined,
        municipioId: form.municipioId || undefined,
        lugar: form.lugar || undefined,
        implementadorNombre: form.implementadorNombre || undefined,
        jefeNombre: form.jefeNombre || undefined,
        actividadesRealizadas: form.actividadesRealizadas || undefined,
        fechasVisita: form.fechasVisita,
        compromisos: form.compromisos.map((c, i) => ({ ...c, numero: i + 1 })),
        firmantes: form.firmantes.map((f, i) => ({ ...f, orden: i })),
      } as any;
      if (acta?.id) {
        await actasApi.update(acta.id, payload);
        toast.success('Acta actualizada');
      } else {
        await actasApi.create(payload);
        toast.success('Acta de visita creada');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar el acta');
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    if (!acta?.id) return;
    setFinalizing(true);
    try {
      await actasApi.finalize(acta.id);
      toast.success('Acta finalizada');
      onSaved();
      onClose();
    } catch { toast.error('Error al finalizar'); }
    finally { setFinalizing(false); }
  }

  const TABS: { key: ModalTab; label: string; icon: React.ElementType }[] = [
    { key: 'general',     label: 'General',     icon: FileText    },
    { key: 'fechas',      label: 'Fechas',      icon: Calendar    },
    { key: 'compromisos', label: 'Compromisos', icon: CheckCircle2 },
    { key: 'firmantes',   label: 'Firmantes',   icon: PenLine     },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: isLight ? '#FFFFFF' : 'rgba(10,16,38,0.98)', border: `1px solid ${border}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.40)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.15)' }}>
              <MapPin className="w-4 h-4" style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {acta ? `Acta de Visita ${acta.numero ? '#' + acta.numero : ''}` : 'Nueva Acta de Visita'}
              </h2>
              {acta && (
                <span className="text-xs px-2 py-0.5 rounded-full mt-0.5 inline-block font-medium"
                  style={{ background: acta.status === 'finalizado' ? 'rgba(52,211,153,0.15)' : 'rgba(148,163,184,0.15)',
                    color: acta.status === 'finalizado' ? '#34d399' : '#94a3b8' }}>
                  {acta.status === 'finalizado' ? 'Finalizado' : 'Borrador'}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: `1px solid ${border}` }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors relative"
                style={{ color: active ? '#60a5fa' : 'var(--text-muted)' }}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {active && <motion.div layoutId="visitas-tab-line" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: '#60a5fa' }} />}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'general' && (
            <div className="space-y-3">
              {/* Proyecto opcional */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  Proyecto asociado <span className="font-normal">(opcional)</span>
                </label>
                <ProjectPicker value={linkedProject} onChange={setLinkedProject} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Fecha *</label>
                  <input type="date" value={form.fecha} onChange={e => setField('fecha', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Lugar</label>
                  <input type="text" placeholder="Ej. Sede principal" value={form.lugar}
                    onChange={e => setField('lugar', e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Ciudad / Municipio</label>
                <MunicipioSearch
                  value={form.municipio ?? null}
                  onChange={m => setForm(f => ({ ...f, municipio: m ?? undefined, municipioId: m?.id, ciudad: m ? `${m.nombreMunicipio}, ${m.nombreDepartamento}` : f.ciudad }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Implementador</label>
                  <input type="text" placeholder="Nombre del implementador" value={form.implementadorNombre}
                    onChange={e => setField('implementadorNombre', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Jefe de Proyecto</label>
                  <input type="text" placeholder="Nombre del jefe" value={form.jefeNombre}
                    onChange={e => setField('jefeNombre', e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Actividades Realizadas</label>
                <textarea rows={5} placeholder="Describe las actividades realizadas durante la visita..."
                  value={form.actividadesRealizadas} onChange={e => setField('actividadesRealizadas', e.target.value)}
                  style={{ ...inputStyle, resize: 'none' }} />
              </div>
            </div>
          )}

          {tab === 'fechas' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Fechas de Visita</p>
                <button onClick={addFechaVisita} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                  <Plus className="w-3 h-3" /> Agregar fecha
                </button>
              </div>
              {form.fechasVisita.map((fv, i) => (
                <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: surface, border: `1px solid ${border}` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Fecha {i + 1}</span>
                    {form.fechasVisita.length > 1 && (
                      <button onClick={() => removeFechaVisita(i)} className="p-1 rounded hover:bg-red-500/10" style={{ color: '#f87171' }}>
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Fecha</label>
                      <input type="date" value={fv.fecha} onChange={e => updateFechaVisita(i, 'fecha', e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Hora inicio</label>
                      <input type="time" value={fv.horaInicio} onChange={e => updateFechaVisita(i, 'horaInicio', e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Hora fin</label>
                      <input type="time" value={fv.horaFin} onChange={e => updateFechaVisita(i, 'horaFin', e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'compromisos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Compromisos</p>
                <button onClick={addCompromiso} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              </div>
              {form.compromisos.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Sin compromisos. Haz clic en "Agregar".</p>
              )}
              {form.compromisos.map((c, i) => (
                <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: surface, border: `1px solid ${border}` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>#{i + 1}</span>
                    <button onClick={() => removeCompromiso(i)} className="p-1 rounded hover:bg-red-500/10" style={{ color: '#f87171' }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <textarea rows={2} placeholder="Descripción del compromiso" value={c.compromiso}
                    onChange={e => updateCompromiso(i, 'compromiso', e.target.value)}
                    style={{ ...inputStyle, resize: 'none' }} />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Responsable" value={c.responsable}
                      onChange={e => updateCompromiso(i, 'responsable', e.target.value)} style={inputStyle} />
                    <select value={c.estado} onChange={e => updateCompromiso(i, 'estado', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="pendiente">Pendiente</option>
                      <option value="en_proceso">En proceso</option>
                      <option value="cumplido">Cumplido</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'firmantes' && (
            <div className="space-y-3">
              {acta?.id && acta.status !== 'finalizado' && (
                <button onClick={() => setShowSignPanel(s => !s)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium"
                  style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}>
                  <PenLine className="w-3.5 h-3.5" />
                  {showSignPanel ? 'Ocultar panel de firmas' : 'Panel de firmas digitales'}
                </button>
              )}
              {acta?.id && showSignPanel ? (
                <FirmantesPanel acta={acta} onRefresh={onSaved} />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Firmantes</p>
                    <button onClick={addFirmante} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                      <Plus className="w-3 h-3" /> Agregar
                    </button>
                  </div>
                  {form.firmantes.map((f, i) => (
                    <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: surface, border: `1px solid ${border}` }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Firmante {i + 1}</span>
                        {form.firmantes.length > 1 && (
                          <button onClick={() => removeFirmante(i)} className="p-1 rounded hover:bg-red-500/10" style={{ color: '#f87171' }}>
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Nombre completo" value={f.nombre} onChange={e => updateFirmante(i, 'nombre', e.target.value)} style={inputStyle} />
                        <input placeholder="Cargo" value={f.cargo} onChange={e => updateFirmante(i, 'cargo', e.target.value)} style={inputStyle} />
                        <input placeholder="Empresa" value={f.empresa} onChange={e => updateFirmante(i, 'empresa', e.target.value)} style={inputStyle} />
                        <input placeholder="Correo" value={f.email ?? ''} onChange={e => updateFirmante(i, 'email', e.target.value)} style={inputStyle} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tipo:</span>
                        {(['agent', 'client'] as const).map(t => (
                          <button key={t} onClick={() => updateFirmante(i, 'signerType', t)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                            style={{
                              background: f.signerType === t ? 'rgba(96,165,250,0.2)' : surface2,
                              color: f.signerType === t ? '#60a5fa' : 'var(--text-muted)',
                              border: `1px solid ${f.signerType === t ? 'rgba(96,165,250,0.4)' : border}`,
                            }}>
                            {t === 'agent' ? 'Agente' : 'Cliente'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderTop: `1px solid ${border}` }}>
          <div>
            {acta?.id && acta.status !== 'finalizado' && (
              <button onClick={handleFinalize} disabled={finalizing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                {finalizing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                Finalizar acta
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: surface2, color: 'var(--text-muted)' }}>
              Cancelar
            </button>
            {acta?.status !== 'finalizado' && (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#2563EB,#6366F1)' }}>
                {saving && <RefreshCw className="w-3 h-3 animate-spin" />}
                {acta ? 'Guardar cambios' : 'Crear acta'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Card de acta ───────────────────────────────────────────────────────────────

function ActaCard({ acta, onEdit, onDelete }: { acta: ActaVisita; onEdit: () => void; onDelete: () => void }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const border   = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
  const surface  = isLight ? '#FFFFFF' : 'rgba(255,255,255,0.03)';
  const isFinalizado  = acta.status === 'finalizado';
  const firmados      = (acta.firmantes ?? []).filter(f => f.signedAt).length;
  const totalFirmantes = (acta.firmantes ?? []).length;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 transition-all"
      style={{ background: surface, border: `1px solid ${border}`, boxShadow: isLight ? '0 2px 12px rgba(0,0,0,0.04)' : 'none' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(96,165,250,0.12)' }}>
            <MapPin className="w-4 h-4" style={{ color: '#60a5fa' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Acta de Visita {acta.numero ? `#${acta.numero}` : ''}
              </p>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: isFinalizado ? 'rgba(52,211,153,0.12)' : 'rgba(148,163,184,0.12)',
                  color: isFinalizado ? '#34d399' : '#94a3b8' }}>
                {isFinalizado ? 'Finalizado' : 'Borrador'}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <Calendar className="w-3 h-3" /> {fmtDate(acta.fecha)}
              </span>
              {acta.lugar && (
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <MapPin className="w-3 h-3" /> {acta.lugar}
                </span>
              )}
              {acta.implementadorNombre && (
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <User className="w-3 h-3" /> {acta.implementadorNombre}
                </span>
              )}
              {acta.project && (
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Building2 className="w-3 h-3" /> {acta.project.serviceOrder?.client?.businessName ?? acta.project.name}
                </span>
              )}
            </div>
            {totalFirmantes > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(firmados / totalFirmantes) * 100}%`, background: '#34d399' }} />
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{firmados}/{totalFirmantes} firmas</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg transition-colors hover:bg-blue-500/10" style={{ color: '#60a5fa' }}>
            <FileText className="w-3.5 h-3.5" />
          </button>
          {!isFinalizado && (
            <button onClick={onDelete} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10" style={{ color: '#f87171' }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function VisitasPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [actas, setActas]       = useState<ActaVisita[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'borrador' | 'finalizado'>('all');
  const [modal, setModal]       = useState<{ open: boolean; acta: ActaVisita | null }>({ open: false, acta: null });

  const border  = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)';
  const surface = isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.02)';

  const loadActas = useCallback(async () => {
    setLoading(true);
    try {
      const all: any[] = await actasApi.list({ type: 'visita' } as any);
      setActas(all);
    } catch { toast.error('Error al cargar actas'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadActas(); }, [loadActas]);

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta acta de visita?')) return;
    try {
      await actasApi.remove(id);
      toast.success('Acta eliminada');
      loadActas();
    } catch { toast.error('Error al eliminar'); }
  }

  const filtered = actas.filter(a => {
    const matchStatus = filterStatus === 'all' || (filterStatus === 'borrador' ? a.status !== 'finalizado' : a.status === 'finalizado');
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (a.numero ?? '').toLowerCase().includes(q) ||
      (a.lugar ?? '').toLowerCase().includes(q) ||
      (a.implementadorNombre ?? '').toLowerCase().includes(q) ||
      (a.project?.name ?? '').toLowerCase().includes(q) ||
      (a.project?.serviceOrder?.client?.businessName ?? '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.12)' }}>
              <MapPin className="w-5 h-5" style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Visitas</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {loading ? 'Cargando...' : `${filtered.length} acta${filtered.length !== 1 ? 's' : ''} de visita`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadActas} className="p-2 rounded-xl transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setModal({ open: true, acta: null })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-white"
              style={{ background: 'linear-gradient(135deg,#2563EB,#6366F1)' }}>
              <Plus className="w-3.5 h-3.5" /> Nueva Acta de Visita
            </button>
          </div>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="px-6 pb-4 shrink-0 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por lugar, implementador, proyecto o cliente..."
            style={{
              background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${border}`,
              color: 'var(--text-primary)',
              borderRadius: 12,
              padding: '9px 14px 9px 36px',
              width: '100%',
              fontSize: 13,
              outline: 'none',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: surface, border: `1px solid ${border}` }}>
          {([['all', 'Todas'], ['borrador', 'Borrador'], ['finalizado', 'Finalizado']] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: filterStatus === val ? (isLight ? 'rgba(37,99,235,0.1)' : 'rgba(96,165,250,0.12)') : 'transparent',
                color: filterStatus === val ? (isLight ? '#2563EB' : '#60a5fa') : 'var(--text-muted)',
              }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: surface, border: `1px solid ${border}` }}>
              <FileText className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {search ? 'Sin resultados para la búsqueda' : 'No hay actas de visita aún'}
            </p>
            {!search && (
              <button onClick={() => setModal({ open: true, acta: null })}
                className="text-xs px-3 py-1.5 rounded-xl font-medium text-white"
                style={{ background: 'linear-gradient(135deg,#2563EB,#6366F1)' }}>
                Crear primera acta
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(a => (
              <ActaCard key={a.id} acta={a}
                onEdit={() => setModal({ open: true, acta: a })}
                onDelete={() => handleDelete(a.id)}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modal.open && (
          <ActaModal
            acta={modal.acta}
            onClose={() => setModal({ open: false, acta: null })}
            onSaved={loadActas}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
