'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, ArrowLeft, Calendar, MapPin, Monitor, Users, CheckCircle2, XCircle,
  Clock, BookOpen, Loader2, Trash2, ChevronDown, ChevronUp, Copy,
  Send, FileText, RefreshCw, UserPlus, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { sesionesApi, projectsApi, clientsApi, companyApi, type CreateSesionPayload, type SesionInvitadoPayload } from '@/lib/api';

// ── tipos ────────────────────────────────────────────────────────────────────

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

// ── helpers ──────────────────────────────────────────────────────────────────

const ESTADO_COLOR: Record<string, string> = {
  programada: 'bg-blue-500/20 text-blue-300',
  en_curso:   'bg-yellow-500/20 text-yellow-300',
  completada: 'bg-green-500/20 text-green-300',
  cancelada:  'bg-red-500/20 text-red-300',
};
const ESTADO_LABEL: Record<string, string> = {
  programada: 'Programada', en_curso: 'En curso', completada: 'Completada', cancelada: 'Cancelada',
};
const RSVP_COLOR: Record<string, string> = {
  pendiente:  'text-slate-400',
  confirmado: 'text-green-400',
  cancelado:  'text-red-400',
};

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  });
}

function fmtFechaInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
      // Cargar staff del cliente
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

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => toast.success('Link copiado'));
  };

  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/implementacion/proyectos/${projectId}`}
          className="p-2 rounded-lg hover:bg-white/5 transition">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <p className="text-slate-400 text-xs">{project?.name ?? '...'}</p>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" /> Sesiones de Capacitación
          </h1>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 transition text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 transition text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> Nueva sesión
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      ) : sesiones.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold mb-1">Sin sesiones programadas</p>
          <p className="text-sm">Crea la primera sesión para enviar invitaciones al cliente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sesiones.map(sesion => {
            const confirmados = sesion.invitados.filter(i => i.respuesta === 'confirmado').length;
            const enSala      = sesion.invitados.filter(i => i.entroSalaAt).length;
            const isExpanded  = expandId === sesion.id;

            return (
              <div key={sesion.id}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                {/* Cabecera de la tarjeta */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLOR[sesion.estado] ?? 'bg-slate-500/20 text-slate-300'}`}>
                        {ESTADO_LABEL[sesion.estado] ?? sesion.estado}
                      </span>
                      {sesion.modulo && (
                        <span className="text-xs text-slate-400">{sesion.modulo.name}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-base truncate">{sesion.titulo}</h3>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
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
                    <div className="text-center">
                      <div className="font-bold text-blue-300">{sesion.invitados.length}</div>
                      <div className="text-slate-400 text-xs">Invitados</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-green-300">{confirmados}</div>
                      <div className="text-slate-400 text-xs">Confirmados</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-yellow-300">{enSala}</div>
                      <div className="text-slate-400 text-xs">En sala</div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 shrink-0">
                    {sesion.teamsLink && (
                      <a href={sesion.teamsLink} target="_blank" rel="noreferrer"
                        className="p-2 rounded-lg hover:bg-white/10 transition text-indigo-400" title="Abrir Teams">
                        <Monitor className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => copyLink(`${frontendUrl}/sala/${sesion.salaToken}`)}
                      className="p-2 rounded-lg hover:bg-white/10 transition text-slate-400" title="Copiar link de sala">
                      <Copy className="w-4 h-4" />
                    </button>
                    {!sesion.actaId && enSala > 0 && (
                      <button
                        onClick={() => handleGenerarActa(sesion.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-semibold transition"
                        title="Generar acta de capacitación">
                        <FileText className="w-3.5 h-3.5" /> Generar acta
                      </button>
                    )}
                    {sesion.actaId && (
                      <Link href={`/implementacion/proyectos/${projectId}/actas`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold transition">
                        <FileText className="w-3.5 h-3.5" /> Ver acta
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(sesion.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition text-slate-400 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandId(isExpanded ? null : sesion.id)}
                      className="p-2 rounded-lg hover:bg-white/10 transition text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Detalle expandible */}
                {isExpanded && (
                  <div className="border-t border-white/10 p-4">
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

// ── Detalle de sesión (invitados + acciones) ──────────────────────────────────

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
      nombre: addNombre.trim(),
      email:  addEmail.trim(),
      cargo:  addCargo.trim() || undefined,
    }).catch(e => toast.error(e?.response?.data?.message ?? 'Error'));
    setSending(false);
    setAddEmail(''); setAddNombre(''); setAddCargo('');
    onRefresh();
    toast.success('Invitado agregado y notificación enviada');
  };

  const handleAddFromStaff = async (s: Staff) => {
    if (!s.email) { toast.error('Este funcionario no tiene correo registrado'); return; }
    await sesionesApi.addInvitado(sesion.id, {
      nombre:       `${s.firstName} ${s.lastName}`,
      email:        s.email,
      cargo:        s.jobTitle ?? undefined,
      clientStaffId: s.id,
    }).catch(e => toast.error(e?.response?.data?.message ?? 'Error'));
    onRefresh();
    toast.success('Invitado agregado');
  };

  const handleRemove = async (invId: string) => {
    await sesionesApi.removeInvitado(sesion.id, invId).catch(() => null);
    onRefresh();
  };

  const copyRsvp = (token: string) => {
    navigator.clipboard.writeText(`${frontendUrl}/confirmar/${token}`)
      .then(() => toast.success('Link RSVP copiado'));
  };

  // Staff no invitado aún
  const invitadoEmails = new Set(sesion.invitados.map(i => i.email.toLowerCase()));
  const staffNoInvitado = staff.filter(s => s.email && !invitadoEmails.has(s.email.toLowerCase()));

  return (
    <div className="space-y-5">
      {/* Info extra */}
      {(sesion.temas || sesion.expositor) && (
        <div className="text-sm text-slate-300 space-y-1">
          {sesion.expositor && <p><span className="text-slate-500">Expositor:</span> {sesion.expositor}</p>}
          {sesion.temas     && <p><span className="text-slate-500">Temas:</span> {sesion.temas}</p>}
        </div>
      )}

      {/* Link sala */}
      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
        <span className="text-xs text-slate-400 shrink-0">Link sala:</span>
        <span className="text-xs text-blue-300 truncate flex-1">{frontendUrl}/sala/{sesion.salaToken}</span>
        <button onClick={() => navigator.clipboard.writeText(`${frontendUrl}/sala/${sesion.salaToken}`).then(() => toast.success('Copiado'))}
          className="text-slate-400 hover:text-white shrink-0">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lista invitados */}
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Invitados ({sesion.invitados.length})</p>
        {sesion.invitados.length === 0 ? (
          <p className="text-slate-500 text-sm">Sin invitados aún.</p>
        ) : (
          <div className="space-y-1.5">
            {sesion.invitados.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 bg-white/3 rounded-lg px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{inv.nombre}</span>
                  {inv.cargo && <span className="text-slate-400 ml-2 text-xs">{inv.cargo}</span>}
                  <span className="text-slate-500 text-xs ml-2">{inv.email}</span>
                </div>
                <span className={`text-xs font-semibold ${RSVP_COLOR[inv.respuesta]}`}>
                  {inv.respuesta === 'pendiente' ? 'Pendiente' : inv.respuesta === 'confirmado' ? '✓ Confirmado' : '✗ Cancelado'}
                  {inv.entroSalaAt && ' · En sala'}
                </span>
                <button onClick={() => copyRsvp(inv.id)} className="text-slate-400 hover:text-white" title="Copiar link RSVP">
                  <Copy className="w-3 h-3" />
                </button>
                <button onClick={() => handleRemove(inv.id)} className="text-slate-500 hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agregar desde staff no invitado */}
      {staffNoInvitado.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Agregar funcionarios del cliente</p>
          <div className="flex flex-wrap gap-2">
            {staffNoInvitado.map(s => (
              <button
                key={s.id}
                onClick={() => handleAddFromStaff(s)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 hover:border-blue-400/50 hover:bg-blue-400/5 transition text-xs text-slate-300"
              >
                <UserPlus className="w-3 h-3" />
                {s.firstName} {s.lastName}
                {!s.email && <span className="text-red-400 ml-1">(sin correo)</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agregar invitado manual */}
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Agregar invitado manualmente</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input value={addNombre} onChange={e => setAddNombre(e.target.value)} placeholder="Nombre *"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400" />
          <input value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="Correo *" type="email"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400" />
          <input value={addCargo} onChange={e => setAddCargo(e.target.value)} placeholder="Cargo"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400" />
        </div>
        <button
          onClick={handleAdd}
          disabled={sending}
          className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/80 hover:bg-blue-500 disabled:opacity-60 transition text-sm font-semibold"
        >
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
  const [titulo,    setTitulo]    = useState('');
  const [fecha,     setFecha]     = useState('');
  const [lugar,     setLugar]     = useState('');
  const [teamsLink, setTeamsLink] = useState('');
  const [expositor, setExpositor] = useState('');
  const [temas,     setTemas]     = useState('');
  const [moduloId,  setModuloId]  = useState('');
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [saving,    setSaving]    = useState(false);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleCreate = async () => {
    if (!titulo.trim() || !fecha) { toast.error('Título y fecha son obligatorios'); return; }
    setSaving(true);
    try {
      const invitados: SesionInvitadoPayload[] = staff
        .filter(s => selected.has(s.id) && s.email)
        .map(s => ({ nombre: `${s.firstName} ${s.lastName}`, email: s.email!, cargo: s.jobTitle ?? undefined, clientStaffId: s.id }));

      await sesionesApi.create({
        projectId, companyId, titulo: titulo.trim(),
        fecha: new Date(fecha).toISOString(),
        moduloId:  moduloId || undefined,
        expositor: expositor.trim() || undefined,
        temas:     temas.trim() || undefined,
        lugar:     lugar.trim() || undefined,
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

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#1a1f2e] border border-white/10 rounded-none sm:rounded-2xl w-full sm:max-w-2xl max-h-screen sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#1a1f2e] z-10">
          <h2 className="text-lg font-bold">Nueva sesión de capacitación</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Campos básicos */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Título de la capacitación *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Capacitación módulo facturación"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 placeholder-slate-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fecha y hora *</label>
              <input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Módulo</label>
              <select value={moduloId} onChange={e => setModuloId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400">
                <option value="">— Sin módulo —</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Lugar</label>
              <input value={lugar} onChange={e => setLugar(e.target.value)} placeholder="Ej: Sala de reuniones / Virtual"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 placeholder-slate-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Expositor</label>
              <input value={expositor} onChange={e => setExpositor(e.target.value)} placeholder="Nombre del expositor"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 placeholder-slate-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              <Monitor className="w-3.5 h-3.5 inline mr-1" />
              Link de reunión Teams
            </label>
            <input value={teamsLink} onChange={e => setTeamsLink(e.target.value)}
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 placeholder-slate-500" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Temas a tratar</label>
            <textarea value={temas} onChange={e => setTemas(e.target.value)} rows={2}
              placeholder="Describe los temas que se cubrirán..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 placeholder-slate-500 resize-none" />
          </div>

          {/* Selección de invitados */}
          {staff.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                Invitar funcionarios del cliente
              </p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {staff.map(s => (
                  <label key={s.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)}
                      className="w-4 h-4 accent-blue-500" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{s.firstName} {s.lastName}</span>
                      {s.jobTitle && <span className="text-slate-400 text-xs ml-2">{s.jobTitle}</span>}
                    </div>
                    {s.email
                      ? <span className="text-xs text-slate-500 truncate max-w-[160px]">{s.email}</span>
                      : <span className="text-xs text-red-400">sin correo</span>
                    }
                  </label>
                ))}
              </div>
              {selected.size > 0 && (
                <p className="text-xs text-blue-300 mt-2">
                  {selected.size} {selected.size === 1 ? 'funcionario seleccionado' : 'funcionarios seleccionados'} — se enviará invitación por correo al crear.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-white/10 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition text-sm">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition font-semibold text-sm flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</> : 'Crear sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
