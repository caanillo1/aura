'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, ArrowLeft, Calendar, MapPin, Monitor, BookOpen, Loader2,
  Trash2, ChevronDown, ChevronUp, Copy, Send, FileText, RefreshCw,
  UserPlus, X, CheckSquare, Square, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { sesionesApi, projectsApi, clientsApi, companyApi, usersApi, type CreateSesionPayload, type SesionInvitadoPayload } from '@/lib/api';

// ── CustomSelect — reemplaza <select> nativo para soporte dark/light ──────────

interface SelectOption { value: string; label: string }

function CustomSelect({ value, onChange, options, placeholder = '— Seleccionar —' }: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors"
        style={{
          background: 'var(--input-bg)',
          border: `1px solid ${open ? 'var(--accent-blue)' : 'var(--input-border)'}`,
          color: selected ? 'var(--input-color)' : 'var(--text-muted)',
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="w-4 h-4 shrink-0 ml-2 transition-transform" style={{
          color: 'var(--text-muted)',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-xl"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--card-shadow)',
            maxHeight: '220px',
            overflowY: 'auto',
          }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={{
                color: opt.value === value ? 'var(--accent-blue)' : 'var(--text-primary)',
                background: opt.value === value ? 'var(--accent-blue-bg)' : 'transparent',
                fontWeight: opt.value === value ? 600 : 400,
              }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── tipos ─────────────────────────────────────────────────────────────────────

interface Invitado {
  id: string;
  nombre: string;
  email: string;
  cargo?: string;
  respuesta: 'pendiente' | 'confirmado' | 'cancelado';
  confirmadoAt?: string;
  entroSalaAt?: string;
}

interface Sesion {
  id: string;
  titulo: string;
  fecha: string;
  lugar?: string;
  temas?: string;
  teamsLink?: string;
  expositor?: string;
  estado: string;
  salaToken: string;
  actaId?: string;
  modulo?: { name: string };
  invitados: Invitado[];
}

interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  jobTitle?: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  programada: { label: 'Programada', color: 'var(--accent-blue)',   bg: 'var(--accent-blue-bg)' },
  en_curso:   { label: 'En curso',   color: 'var(--accent-amber)',  bg: 'var(--accent-amber-bg)' },
  completada: { label: 'Completada', color: 'var(--accent-green)',  bg: 'var(--accent-green-bg)' },
  cancelada:  { label: 'Cancelada',  color: 'var(--accent-red)',    bg: 'var(--accent-red-bg)' },
};

const RSVP_COLOR: Record<string, string> = {
  pendiente:  'var(--text-muted)',
  confirmado: 'var(--accent-green)',
  cancelado:  'var(--accent-red)',
};

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  });
}

// ── Estilos base reutilizables ────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  boxShadow: 'var(--card-shadow)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  color: 'var(--input-color)',
};

const mutedText: React.CSSProperties = { color: 'var(--text-muted)' };
const secondaryText: React.CSSProperties = { color: 'var(--text-secondary)' };
const primaryText: React.CSSProperties = { color: 'var(--text-primary)' };

// ── Componente principal ──────────────────────────────────────────────────────

export default function SesionesPage() {
  const { id: projectId } = useParams() as { id: string };

  const [sesiones,  setSesiones]  = useState<Sesion[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [project,   setProject]   = useState<any>(null);
  const [company,   setCompany]   = useState<any>(null);
  const [staff,     setStaff]     = useState<Staff[]>([]);
  const [expandId,  setExpandId]  = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sesionesList, proj, comp] = await Promise.all([
        sesionesApi.list(projectId),
        projectsApi.get(projectId),
        companyApi.get(),
      ]);
      setSesiones(sesionesList);
      setProject(proj);
      setCompany(comp);
      const clientId = proj?.serviceOrder?.client?.id;
      if (clientId) {
        const s = await clientsApi.getStaff(clientId).catch(() => []);
        setStaff(s.filter((m: any) => m.isActive !== false));
      }
    } catch {
      toast.error('Error al cargar las sesiones');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta sesión?')) return;
    await sesionesApi.remove(id).catch(() => null);
    setSesiones(prev => prev.filter(s => s.id !== id));
    toast.success('Sesión eliminada');
  };

  const handleGenerarActa = async (id: string) => {
    try {
      await sesionesApi.generarActa(id);
      toast.success('Acta generada correctamente');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al generar el acta');
    }
  };

  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="p-4 sm:p-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/implementacion/proyectos/${projectId}`}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-xs" style={mutedText}>{project?.name ?? '...'}</p>
          <h1 className="text-xl font-bold flex items-center gap-2" style={primaryText}>
            <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-blue)' }} />
            Sesiones de Capacitación
          </h1>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={load}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: 'var(--accent-blue)', color: '#fff' }}>
            <Plus className="w-4 h-4" /> Nueva sesión
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-blue)' }} />
        </div>
      ) : sesiones.length === 0 ? (
        <div className="text-center py-20" style={mutedText}>
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold mb-1" style={primaryText}>Sin sesiones programadas</p>
          <p className="text-sm">Crea la primera sesión para enviar invitaciones al cliente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sesiones.map(sesion => {
            const cfg         = ESTADO_CFG[sesion.estado] ?? ESTADO_CFG.programada;
            const confirmados = sesion.invitados.filter(i => i.respuesta === 'confirmado').length;
            const enSala      = sesion.invitados.filter(i => i.entroSalaAt).length;
            const isExpanded  = expandId === sesion.id;

            return (
              <div key={sesion.id} className="rounded-xl overflow-hidden" style={cardStyle}>

                {/* Cabecera */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                      {sesion.modulo && (
                        <span className="text-xs" style={mutedText}>{sesion.modulo.name}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-base truncate" style={primaryText}>{sesion.titulo}</h3>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs" style={mutedText}>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{fmtFecha(sesion.fecha)}
                      </span>
                      {sesion.lugar && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{sesion.lugar}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    {[
                      { val: sesion.invitados.length, label: 'Invitados',  color: 'var(--accent-blue)' },
                      { val: confirmados,              label: 'Confirmados',color: 'var(--accent-green)' },
                      { val: enSala,                   label: 'En sala',    color: 'var(--accent-amber)' },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <div className="font-bold" style={{ color: s.color }}>{s.val}</div>
                        <div className="text-xs" style={mutedText}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {sesion.teamsLink && (
                      <a href={sesion.teamsLink} target="_blank" rel="noreferrer"
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: '#818cf8' }} title="Abrir reunión Teams"
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <Monitor className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => navigator.clipboard.writeText(`${frontendUrl}/sala/${sesion.salaToken}`).then(() => toast.success('Link de sala copiado'))}
                      className="p-2 rounded-lg transition-colors" style={mutedText} title="Copiar link de sala"
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <Copy className="w-4 h-4" />
                    </button>
                    {!sesion.actaId && enSala > 0 && (
                      <button
                        onClick={() => handleGenerarActa(sesion.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ background: 'var(--accent-green-bg)', color: 'var(--accent-green)' }}>
                        <FileText className="w-3.5 h-3.5" /> Generar acta
                      </button>
                    )}
                    {sesion.actaId && (
                      <Link href={`/implementacion/proyectos/${projectId}/actas`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ background: 'var(--accent-violet-bg)', color: 'var(--accent-violet)' }}>
                        <FileText className="w-3.5 h-3.5" /> Ver acta
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(sesion.id)}
                      className="p-2 rounded-lg transition-colors" style={mutedText}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-red-bg)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-red)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandId(isExpanded ? null : sesion.id)}
                      className="p-2 rounded-lg transition-colors" style={mutedText}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Detalle expandible */}
                {isExpanded && (
                  <div className="p-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <SesionDetalle
                      sesion={sesion}
                      staff={staff}
                      frontendUrl={frontendUrl}
                      onRefresh={load}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nueva sesión */}
      {showModal && company && (
        <NuevaSesionModal
          projectId={projectId}
          companyId={company.id}
          modules={project?.modules ?? []}
          staff={staff}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Detalle de sesión ─────────────────────────────────────────────────────────

function SesionDetalle({
  sesion, staff, frontendUrl, onRefresh,
}: { sesion: Sesion; staff: Staff[]; frontendUrl: string; onRefresh: () => void }) {
  const [addEmail,  setAddEmail]  = useState('');
  const [addNombre, setAddNombre] = useState('');
  const [addCargo,  setAddCargo]  = useState('');
  const [sending,   setSending]   = useState(false);

  const handleAdd = async () => {
    if (!addEmail.trim() || !addNombre.trim()) { toast.error('Nombre y correo son obligatorios'); return; }
    setSending(true);
    await sesionesApi.addInvitado(sesion.id, {
      nombre: addNombre.trim(), email: addEmail.trim(), cargo: addCargo.trim() || undefined,
    }).catch(e => toast.error(e?.response?.data?.message ?? 'Error'));
    setSending(false);
    setAddEmail(''); setAddNombre(''); setAddCargo('');
    onRefresh();
    toast.success('Invitado agregado y notificación enviada');
  };

  const handleAddFromStaff = async (s: Staff) => {
    if (!s.email) { toast.error('Este funcionario no tiene correo registrado'); return; }
    await sesionesApi.addInvitado(sesion.id, {
      nombre: `${s.firstName} ${s.lastName}`, email: s.email,
      cargo: s.jobTitle ?? undefined, clientStaffId: s.id,
    }).catch(e => toast.error(e?.response?.data?.message ?? 'Error'));
    onRefresh();
    toast.success('Invitado agregado y notificación enviada');
  };

  const handleRemove = async (invId: string) => {
    await sesionesApi.removeInvitado(sesion.id, invId).catch(() => null);
    onRefresh();
  };

  const invitadoEmails = new Set(sesion.invitados.map(i => i.email.toLowerCase()));
  const staffNoInvitado = staff.filter(s => s.email && !invitadoEmails.has(s.email.toLowerCase()));

  return (
    <div className="space-y-5">
      {(sesion.temas || sesion.expositor) && (
        <div className="text-sm space-y-1" style={secondaryText}>
          {sesion.expositor && <p><span style={mutedText}>Expositor: </span>{sesion.expositor}</p>}
          {sesion.temas     && <p><span style={mutedText}>Temas: </span>{sesion.temas}</p>}
        </div>
      )}

      {/* Link sala */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
        <span className="text-xs shrink-0" style={mutedText}>Link sala:</span>
        <span className="text-xs truncate flex-1" style={{ color: 'var(--accent-blue)' }}>
          {frontendUrl}/sala/{sesion.salaToken}
        </span>
        <button onClick={() => navigator.clipboard.writeText(`${frontendUrl}/sala/${sesion.salaToken}`).then(() => toast.success('Copiado'))}
          style={mutedText} className="shrink-0 hover:opacity-70 transition-opacity">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lista invitados */}
      <div>
        <p className="text-xs uppercase tracking-wider mb-2" style={mutedText}>
          Invitados ({sesion.invitados.length})
        </p>
        {sesion.invitados.length === 0 ? (
          <p className="text-sm" style={mutedText}>Sin invitados aún.</p>
        ) : (
          <div className="space-y-1.5">
            {sesion.invitados.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface-2)' }}>
                <div className="flex-1 min-w-0">
                  <span className="font-medium" style={primaryText}>{inv.nombre}</span>
                  {inv.cargo && <span className="text-xs ml-2" style={mutedText}>{inv.cargo}</span>}
                  <span className="text-xs ml-2" style={mutedText}>{inv.email}</span>
                </div>
                <span className="text-xs font-semibold shrink-0" style={{ color: RSVP_COLOR[inv.respuesta] }}>
                  {inv.respuesta === 'pendiente' ? 'Pendiente' : inv.respuesta === 'confirmado' ? '✓ Confirmado' : '✗ Cancelado'}
                  {inv.entroSalaAt && ' · En sala'}
                </span>
                <button onClick={() => handleRemove(inv.id)}
                  className="shrink-0 hover:opacity-70 transition-opacity" style={mutedText}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agregar desde staff */}
      {staffNoInvitado.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider mb-2" style={mutedText}>
            Agregar funcionarios del cliente
          </p>
          <div className="flex flex-wrap gap-2">
            {staffNoInvitado.map(s => (
              <button key={s.id} onClick={() => handleAddFromStaff(s)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors"
                style={{ border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <UserPlus className="w-3 h-3" />
                {s.firstName} {s.lastName}
                {!s.email && <span style={{ color: 'var(--accent-red)' }} className="ml-1">(sin correo)</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agregar manualmente */}
      <div>
        <p className="text-xs uppercase tracking-wider mb-2" style={mutedText}>Agregar invitado manualmente</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { val: addNombre, set: setAddNombre, ph: 'Nombre *' },
            { val: addEmail,  set: setAddEmail,  ph: 'Correo *' },
            { val: addCargo,  set: setAddCargo,  ph: 'Cargo' },
          ].map(f => (
            <input key={f.ph} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
              className="rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:ring-1"
              style={{ ...inputStyle, '--tw-ring-color': 'var(--accent-blue)' } as any} />
          ))}
        </div>
        <button onClick={handleAdd} disabled={sending}
          className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
          style={{ background: 'var(--accent-blue)', color: '#fff' }}>
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Agregar y enviar invitación
        </button>
      </div>
    </div>
  );
}

// ── Modal nueva sesión ────────────────────────────────────────────────────────

function NuevaSesionModal({
  projectId, companyId, modules, staff, onClose, onCreated,
}: {
  projectId: string;
  companyId: string;
  modules: Array<{ id: string; name: string }>;
  staff: Staff[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [titulo,      setTitulo]      = useState('');
  const [fecha,       setFecha]       = useState('');
  const [lugar,       setLugar]       = useState('');
  const [teamsLink,   setTeamsLink]   = useState('');
  const [expositorId, setExpositorId] = useState('');
  const [temas,       setTemas]       = useState('');
  const [moduloId,    setModuloId]    = useState('');
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [saving,      setSaving]      = useState(false);
  const [agents,      setAgents]      = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [cargoFilter, setCargoFilter] = useState('');

  useEffect(() => {
    usersApi.listAgents({ limit: 200 })
      .then(r => setAgents(r.data ?? []))
      .catch(() => {});
  }, []);

  // Cargos únicos del personal
  const cargosUnicos = Array.from(new Set(staff.map(s => s.jobTitle).filter(Boolean))) as string[];

  // Staff filtrado por búsqueda y cargo
  const staffFiltrado = staff.filter(s => {
    const nombre = `${s.firstName} ${s.lastName}`.toLowerCase();
    const matchSearch = !staffSearch || nombre.includes(staffSearch.toLowerCase());
    const matchCargo  = !cargoFilter || s.jobTitle === cargoFilter;
    return matchSearch && matchCargo;
  });

  const staffConEmailFiltrado = staffFiltrado.filter(s => s.email);
  const staffConEmail         = staff.filter(s => s.email);
  const allSelected           = staffConEmail.length > 0 && staffConEmail.every(s => selected.has(s.id));
  const allVisibleSelected    = staffConEmailFiltrado.length > 0 && staffConEmailFiltrado.every(s => selected.has(s.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(staffConEmail.map(s => s.id)));
    }
  };

  const toggleVisible = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        staffConEmailFiltrado.forEach(s => next.delete(s.id));
      } else {
        staffConEmailFiltrado.forEach(s => next.add(s.id));
      }
      return next;
    });
  };

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleCreate = async () => {
    if (!titulo.trim() || !fecha) { toast.error('Título y fecha son obligatorios'); return; }
    setSaving(true);
    try {
      const agente      = agents.find(a => a.id === expositorId);
      const expositorNm = agente ? `${agente.firstName} ${agente.lastName}` : undefined;
      const invitados: SesionInvitadoPayload[] = staff
        .filter(s => selected.has(s.id) && s.email)
        .map(s => ({ nombre: `${s.firstName} ${s.lastName}`, email: s.email!, cargo: s.jobTitle ?? undefined, clientStaffId: s.id }));

      await sesionesApi.create({
        projectId, companyId, titulo: titulo.trim(),
        fecha:     new Date(fecha).toISOString(),
        moduloId:  moduloId      || undefined,
        expositor: expositorNm   || undefined,
        temas:     temas.trim()  || undefined,
        lugar:     lugar.trim()  || undefined,
        teamsLink: teamsLink.trim() || undefined,
        invitados: invitados.length ? invitados : undefined,
      });
      toast.success('Sesión creada' + (invitados.length ? ` · ${invitados.length} invitaciones enviadas` : ''));
      onCreated();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al crear la sesión');
    } finally {
      setSaving(false);
    }
  };

  const mInput: React.CSSProperties = {
    ...inputStyle,
    borderRadius: '0.5rem',
    padding: '0.625rem 0.75rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full sm:max-w-2xl max-h-screen sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-lg font-bold" style={primaryText}>Nueva sesión de capacitación</h2>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          <div>
            <label className="block text-xs mb-1.5" style={mutedText}>Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Capacitación módulo facturación" style={mInput} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={mutedText}>Fecha y hora *</label>
              <input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)}
                style={{ ...mInput, colorScheme: 'dark light' }} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={mutedText}>Módulo</label>
              <CustomSelect
                value={moduloId}
                onChange={setModuloId}
                placeholder="— Sin módulo —"
                options={[
                  { value: '', label: '— Sin módulo —' },
                  ...modules.map(m => ({ value: m.id, label: m.name })),
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1.5" style={mutedText}>Lugar</label>
              <input value={lugar} onChange={e => setLugar(e.target.value)}
                placeholder="Sala de reuniones / Virtual" style={mInput} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={mutedText}>Expositor</label>
              <CustomSelect
                value={expositorId}
                onChange={setExpositorId}
                placeholder="— Sin expositor —"
                options={[
                  { value: '', label: '— Sin expositor —' },
                  ...agents.map(a => ({ value: a.id, label: `${a.firstName} ${a.lastName}` })),
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1.5 flex items-center gap-1.5" style={mutedText}>
              <Monitor className="w-3.5 h-3.5" /> Link de reunión Teams
            </label>
            <input value={teamsLink} onChange={e => setTeamsLink(e.target.value)}
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              style={mInput} />
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={mutedText}>Temas a tratar</label>
            <textarea value={temas} onChange={e => setTemas(e.target.value)} rows={2}
              placeholder="Describe los temas que se cubrirán..."
              style={{ ...mInput, resize: 'none' }} />
          </div>

          {/* Selección de invitados */}
          {staff.length > 0 && (
            <div>
              {/* Encabezado + seleccionar todo */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wider font-medium" style={mutedText}>
                  Invitar funcionarios del cliente
                </p>
                <div className="flex items-center gap-2">
                  {staffConEmailFiltrado.length > 0 && staffConEmailFiltrado.length < staffConEmail.length && (
                    <button onClick={toggleVisible}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                      style={{ color: 'var(--accent-blue)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {allVisibleSelected
                        ? <><Square className="w-3 h-3" /> Quitar visibles</>
                        : <><CheckSquare className="w-3 h-3" /> Sel. visibles</>}
                    </button>
                  )}
                  {staffConEmail.length > 0 && (
                    <button onClick={toggleAll}
                      className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                      style={{ color: allSelected ? 'var(--accent-red)' : 'var(--accent-green)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {allSelected
                        ? <><Square className="w-3.5 h-3.5" /> Deseleccionar todo</>
                        : <><CheckSquare className="w-3.5 h-3.5" /> Seleccionar todo</>}
                    </button>
                  )}
                </div>
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={mutedText} />
                  <input
                    value={staffSearch}
                    onChange={e => setStaffSearch(e.target.value)}
                    placeholder="Buscar por nombre..."
                    style={{ ...mInput, paddingLeft: '2rem', fontSize: '0.8rem' }}
                  />
                </div>
                <CustomSelect
                  value={cargoFilter}
                  onChange={setCargoFilter}
                  placeholder="Todos los cargos"
                  options={[
                    { value: '', label: 'Todos los cargos' },
                    ...cargosUnicos.map(c => ({ value: c, label: c })),
                  ]}
                />
              </div>

              {/* Lista filtrada */}
              <div className="space-y-0.5 max-h-52 overflow-y-auto rounded-lg p-1"
                style={{ background: 'var(--surface-2)' }}>
                {staffFiltrado.length === 0 ? (
                  <p className="text-xs text-center py-4" style={mutedText}>Sin resultados</p>
                ) : staffFiltrado.map(s => (
                  <label key={s.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                    style={{ opacity: s.email ? 1 : 0.45 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <input type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => s.email && toggle(s.id)}
                      disabled={!s.email}
                      className="w-4 h-4 rounded shrink-0"
                      style={{ accentColor: 'var(--accent-blue)' }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium" style={primaryText}>
                        {s.firstName} {s.lastName}
                      </span>
                      {s.jobTitle && (
                        <span className="text-xs ml-2" style={mutedText}>{s.jobTitle}</span>
                      )}
                    </div>
                    {s.email
                      ? <span className="text-xs truncate max-w-[160px]" style={mutedText}>{s.email}</span>
                      : <span className="text-xs shrink-0" style={{ color: 'var(--accent-red)' }}>sin correo</span>
                    }
                  </label>
                ))}
              </div>

              {selected.size > 0 && (
                <p className="text-xs mt-2" style={{ color: 'var(--accent-blue)' }}>
                  {selected.size} {selected.size === 1 ? 'funcionario seleccionado' : 'funcionarios seleccionados'} — se enviará invitación al crear.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 shrink-0 flex gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Cancelar
          </button>
          <button onClick={handleCreate} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: 'var(--accent-blue)', color: '#fff' }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</> : 'Crear sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
