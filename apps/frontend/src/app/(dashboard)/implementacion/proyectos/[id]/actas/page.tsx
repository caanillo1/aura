'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  ArrowLeft, Plus, RefreshCw, FileText, Trash2, Pencil, Printer,
  CheckCircle2, Clock, X, Link2, PenLine, Upload, RotateCcw, Lock, Shield, Settings, Mail,
} from 'lucide-react';
import { actasApi, projectsApi, clientsApi, usersApi, companyApi, municipiosApi, cronogramaApi, type CreateActaPayload, type ActaActividadPayload } from '@/lib/api';
import { SignaturePad, type SignaturePadRef } from '@/components/ui/SignaturePad';
import { ActaDocumento } from '@/components/actas/ActaDocumento';
import { MunicipioSearch } from '@/components/ui/MunicipioSearch';
import type { Municipio } from '@/types';
import { toast } from 'sonner';

// ── Tipos locales ──────────────────────────────────────────────────────────

type ActaType = 'inicio' | 'visita' | 'cierre' | 'capacitacion' | 'entrega_soporte';

interface Firmante  { id?: string; nombre: string; cargo: string; empresa: string; email?: string; telefono?: string; documento?: string; fecha: string; orden: number; signatureData?: string; signedAt?: string; signerType?: string; }
interface FechaV    { fecha: string; horaInicio: string; horaFin: string; }
interface Compromiso{ numero: number; compromiso: string; responsable: string; estado: string; assignedToId?: string; clientStaffId?: string; moduleId?: string; phaseId?: string; activityId?: string; fechaLimite?: string; diasVigencia?: number; responsablePrincipal?: string; }
interface Participante { numero: number; nombre: string; cargo?: string; documento?: string; }
interface Accion    { accion: string; responsable: string; fechaLimite: string; }
interface Contacto  { nombre: string; telefono: string; area: string; }
interface CheckItem { label: string; checked: boolean; obs: string; medio?: string; }
interface ActaActividadRow { activityId: string; assignedToId?: string; clientStaffId?: string; status: string; }

// ── Configuración de tipos ─────────────────────────────────────────────────

const TYPE_CFG: Record<ActaType, { label: string; color: string; bg: string; short: string }> = {
  inicio:         { label: 'Acta de Inicio',           color: '#34d399', bg: 'rgba(52,211,153,0.12)',  short: 'INICIO' },
  visita:         { label: 'Acta de Visita',            color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  short: 'VISITA' },
  cierre:         { label: 'Acta de Cierre',            color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', short: 'CIERRE' },
  capacitacion:   { label: 'Acta de Capacitación',      color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  short: 'CAPAC.' },
  entrega_soporte:{ label: 'Entrega a Soporte',          color: '#f472b6', bg: 'rgba(244,114,182,0.12)', short: 'SOPORTE' },
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  borrador:   { label: 'Borrador',   color: '#94a3b8' },
  finalizado: { label: 'Finalizado', color: '#34d399' },
};

// ── Checklists predefinidos ────────────────────────────────────────────────

const MODULOS_DEFAULT: CheckItem[] = [
  'Archivo','Agenda médica','Consulta externa (historias clínicas)','Hospitalización',
  'Inventario / Farmacia','Facturación (todas las modalidades)','Emisión electrónica (FEV / DSA / NE)',
  'Dashboard Power BI','Contabilidad','Cartera y glosas','Tesorería','Nómina',
  'Consentimiento informado','Compras',
].map(l => ({ label: l, checked: false, obs: '' }));

const INFRA_DEFAULT: CheckItem[] = [
  'Certificado SSL instalado','IP pública o VPN activa (autogestión)',
  'Servidor cumple condiciones mínimas','Estaciones cumplen condiciones mínimas',
  'Internet ≥ 5 Mbps estable',
].map(l => ({ label: l, checked: false, obs: '' }));

const DOCS_DEFAULT: CheckItem[] = [
  'Manuales de usuario','Video grabación capacitaciones',
  'Contrato / SLA firmado','Certificados digitales (emisión electrónica)',
].map(l => ({ label: l, checked: false, obs: '', medio: '' }));

const EMISION_DEFAULT: CheckItem[] = [
  'Emisión de FEV, NE, DSA','Generación de XML (UBL 2.1)','Resolución y rangos de facturación',
  'Firma electrónica cargada','Código CUFE / CUNE / CUDS','Representación gráfica estándar',
  'Manejo de anexos en factura','Acceso a portal del proveedor',
  'Consulta y descarga de XML y PDF','Reenvío de facturas por correo',
].map(l => ({ label: l, checked: false, obs: '' }));

// ── Helpers ────────────────────────────────────────────────────────────────

// timeZone:'UTC' porque las fechas llegan como medianoche UTC desde el servidor
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

// Returns today's date as YYYY-MM-DD in LOCAL time (not UTC — avoids off-by-one in UTC-5 zones)
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function parseChecklist(json: string | null | undefined, def: CheckItem[]): CheckItem[] {
  if (!json) return def.map(x => ({ ...x }));
  try { return JSON.parse(json); } catch { return def.map(x => ({ ...x })); }
}

function emptyFirmante(n = 0): Firmante {
  return { nombre: '', cargo: '', empresa: '', email: '', fecha: '', orden: n, signerType: 'agent' };
}

// ── Sub-componente: tabla editable de firmantes ────────────────────────────

interface StaffOption { id: string; firstName: string; lastName: string; jobTitle?: string | null; document?: string; email?: string | null; phone?: string | null; }

// ── Panel de gestión de firmas (siempre accesible desde la card) ──────────────

function FirmantesPanel({ acta, userSignature, onSetupSignature, onClose, onRefresh }: {
  acta: any;
  userSignature?: string | null;
  onSetupSignature?: () => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [firmantes, setFirmantes]       = useState<any[]>(acta?.firmantes ?? []);
  const [signing, setSigning]           = useState<string | null>(null);
  const [resending, setResending]       = useState<string | null>(null);
  const [loadingFresh, setLoadingFresh] = useState(true);
  // Firmante que estaba esperando a que el agente configure su firma
  const pendingSignRef = useRef<any>(null);

  // Siempre cargamos datos frescos al abrir el panel
  useEffect(() => {
    actasApi.get(acta.id)
      .then(fresh => setFirmantes(fresh?.firmantes ?? []))
      .catch(() => {})
      .finally(() => setLoadingFresh(false));
  }, [acta.id]);

  // Cuando userSignature pasa de null→valor, firmamos automáticamente el pendiente
  useEffect(() => {
    const pending = pendingSignRef.current;
    if (userSignature && pending) {
      pendingSignRef.current = null;
      doSign(pending, userSignature);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSignature]);

  const copyLink = (f: any) => {
    const url = `${window.location.origin}/firmar/${f.id}`;
    navigator.clipboard.writeText(url).then(() =>
      toast.success(`Enlace copiado para ${f.nombre}`)
    );
  };

  const resendEmail = async (f: any) => {
    setResending(f.id);
    try {
      await actasApi.resendEmail(acta.id, f.id);
      toast.success(`Correo reenviado a ${f.email}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al reenviar correo');
    } finally {
      setResending(null);
    }
  };

  const doSign = async (f: any, sig: string) => {
    setSigning(f.id);
    try {
      await actasApi.signFirmante(f.id, sig);
      const now = new Date().toISOString();
      setFirmantes(prev => prev.map(fw =>
        fw.id === f.id ? { ...fw, signatureData: sig, signedAt: now, signerType: 'agent' } : fw
      ));
      toast.success('Firma registrada');
      onRefresh();
    } catch { toast.error('Error al firmar'); }
    finally { setSigning(null); }
  };

  const handleAgentSign = async (f: any) => {
    if (!userSignature) {
      // Guardar firmante pendiente y abrir setup (panel permanece abierto)
      pendingSignRef.current = f;
      onSetupSignature?.();
      return;
    }
    await doSign(f, userSignature);
  };

  const signedCount = firmantes.filter(f => f.signedAt).length;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col"
        style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.12)', maxHeight: '82vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <PenLine className="w-4 h-4 text-blue-400" /> Gestionar firmas
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {TYPE_CFG[acta.type as ActaType]?.label}
              {acta.numero ? ` · No. ${acta.numero}` : ''} · {signedCount}/{firmantes.length} firmado{firmantes.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Firmar todos los firmantes del agente de una vez */}
            {userSignature && firmantes.some(f => !f.signedAt && f.signerType !== 'client') && (
              <button
                onClick={async () => {
                  const pending = firmantes.filter(f => !f.signedAt && f.signerType !== 'client');
                  for (const f of pending) await doSign(f, userSignature);
                }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.30)' }}>
                <PenLine className="w-3.5 h-3.5" /> Firmar todo
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Aviso sin firma de agente */}
        {!userSignature && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-xl flex items-center gap-2 text-xs shrink-0"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)', color: '#fbbf24' }}>
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>Sin firma de agente configurada.</span>
            <button onClick={onSetupSignature} className="underline font-semibold ml-1">Configurar</button>
          </div>
        )}

        {/* Lista de firmantes */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {loadingFresh ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
            </div>
          ) : firmantes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Sin firmantes registrados</p>
          ) : (
            firmantes.map(f => {
              const signed  = !!f.signedAt;
              const signing_ = signing === f.id;
              return (
                <div key={f.id} className="p-3 rounded-xl"
                  style={{
                    background: signed ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${signed ? 'rgba(52,211,153,0.20)' : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{f.nombre}</p>
                      {f.cargo   && <p className="text-xs text-slate-400">{f.cargo}</p>}
                      {f.empresa && <p className="text-xs text-slate-500">{f.empresa}</p>}
                    </div>
                    {signed && (
                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold" style={{ color: '#34d399' }}>
                          <CheckCircle2 className="w-3 h-3 inline mr-0.5" />Firmado
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(f.signedAt).toLocaleDateString('es-CO')}
                          {' · '}{f.signerType === 'client' ? 'cliente' : 'agente'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Preview firma */}
                  {signed && f.signatureData && (
                    <div className="bg-white rounded-lg p-2 flex justify-center mb-2">
                      <img src={f.signatureData} alt="firma" style={{ maxHeight: 44, maxWidth: 160 }} />
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex gap-2 flex-wrap">
                    {!signed && f.signerType !== 'client' && (
                      <button onClick={() => handleAgentSign(f)} disabled={signing_}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.20)' }}>
                        {signing_ ? <RefreshCw className="w-3 h-3 animate-spin" /> : <PenLine className="w-3 h-3" />}
                        {signing_ ? 'Firmando...' : 'Firmar (agente)'}
                      </button>
                    )}
                    {!signed && f.signerType !== 'agent' && f.id && (
                      <button onClick={() => copyLink(f)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.20)' }}>
                        <Link2 className="w-3 h-3" /> Copiar enlace cliente
                      </button>
                    )}
                    {!signed && f.email && f.id && (
                      <button
                        onClick={() => resendEmail(f)}
                        disabled={resending === f.id}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.20)' }}>
                        {resending === f.id
                          ? <RefreshCw className="w-3 h-3 animate-spin" />
                          : <Mail className="w-3 h-3" />}
                        {resending === f.id ? 'Enviando...' : 'Reenviar correo'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={onClose}
            className="w-full py-2 rounded-xl text-sm font-medium"
            style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal para configurar la firma del agente (se guarda en el perfil del usuario)
function SetupSignatureModal({ onClose, onSaved }: {
  onClose: () => void; onSaved: (dataUrl: string) => void;
}) {
  const padRef  = useRef<SignaturePadRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab]       = useState<'draw' | 'upload'>('draw');
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const data = tab === 'draw' ? padRef.current?.getDataUrl() : preview;
    if (!data) { toast.error('Dibuja o carga tu firma'); return; }
    setSaving(true);
    try {
      await usersApi.updateSignature(data);
      toast.success('Firma guardada en tu perfil');
      onSaved(data);
    } catch { toast.error('Error al guardar la firma'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col"
        style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.12)' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" /> Configura tu firma digital
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Se guardará en tu perfil y se usará en todas las actas</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex gap-2 px-5 pt-4">
          {[{ k: 'draw', label: 'Dibujar', icon: PenLine }, { k: 'upload', label: 'Cargar imagen', icon: Upload }].map(({ k, label, icon: Icon }) => (
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
              <p className="text-xs text-slate-400 mb-3">Carga una imagen PNG/JPG de tu firma</p>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />
              {preview ? (
                <div className="text-center">
                  <img src={preview} alt="firma" className="max-h-40 mx-auto rounded-xl border border-slate-200 bg-white p-2" />
                  <button onClick={() => setPreview(null)} className="text-xs mt-2 text-slate-400 flex items-center gap-1 mx-auto">
                    <RotateCcw className="w-3 h-3" /> Cambiar
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full py-10 rounded-xl border-2 border-dashed flex flex-col items-center gap-2"
                  style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#94a3b8' }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setPreview(ev.target?.result as string); r.readAsDataURL(f); }}>
                  <Upload className="w-8 h-8 opacity-50" />
                  <span className="text-sm">Haz clic o arrastra la imagen aquí</span>
                  <span className="text-xs opacity-60">PNG, JPG, WEBP · Firma sobre fondo blanco</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm" style={{ color: '#94a3b8' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.30)' }}>
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Guardando...' : 'Guardar firma'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FirmantesEditor({ rows, setRows, tc, clientStaff, clientName, agents, userSignature, onSetupSignature }: {
  rows: Firmante[]; setRows: (r: Firmante[]) => void; tc: any;
  clientStaff?: StaffOption[]; clientName?: string;
  agents?: StaffOption[];
  userSignature?: string | null; onSetupSignature?: () => void;
}) {
  const inputRowStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: tc.s };
  const [agentSigning, setAgentSigning] = useState<number | null>(null);

  const update = (i: number, k: keyof Firmante, v: string | number) =>
    setRows(rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const add = () => setRows([...rows, emptyFirmante(rows.length)]);
  const del = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const addFromStaff = (staffId: string) => {
    const s = clientStaff?.find(x => x.id === staffId);
    if (!s) return;
    setRows([...rows, {
      nombre: `${s.firstName} ${s.lastName}`,
      cargo: s.jobTitle ?? '',
      empresa: clientName ?? '',
      email: s.email ?? '',
      telefono: s.phone ?? '',
      documento: s.document ?? '',
      fecha: '', orden: rows.length,
      signerType: 'client',
    }]);
  };

  const addFromAgent = (agentId: string) => {
    const a = agents?.find(x => x.id === agentId);
    if (!a) return;
    setRows([...rows, {
      nombre: `${a.firstName} ${a.lastName}`,
      cargo: a.jobTitle ?? '',
      empresa: '',
      email: a.email ?? '',
      telefono: a.phone ?? '',
      documento: '',
      fecha: '', orden: rows.length,
      signerType: 'agent',
    }]);
  };

  const handleAgentSign = async (i: number, r: Firmante) => {
    if (!r.id) { toast.error('Guarda el acta primero para poder firmar'); return; }
    if (!userSignature) { onSetupSignature?.(); return; }
    setAgentSigning(i);
    try {
      await actasApi.signFirmante(r.id, userSignature);
      const now = new Date().toISOString();
      setRows(rows.map((row, idx) => idx === i
        ? { ...row, signatureData: userSignature, signedAt: now, signerType: 'agent' }
        : row));
      toast.success('Firma registrada');
    } catch { toast.error('Error al registrar la firma'); }
    finally { setAgentSigning(null); }
  };

  const copySignLink = (r: Firmante) => {
    if (!r.id) return;
    const url = `${window.location.origin}/firmar/${r.id}`;
    navigator.clipboard.writeText(url).then(() =>
      alert(`Enlace copiado:\n${url}\n\nCompártelo con ${r.nombre} para que firme desde cualquier dispositivo.`)
    );
  };

  return (
    <div>
      {/* Header: título + botón manual */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: tc.m }}>Firmantes</span>
        <button onClick={add} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.20)' }}>
          <Plus className="w-3 h-3" /> Agregar manual
        </button>
      </div>
      {/* Selectores rápidos desde listas */}
      {((agents && agents.length > 0) || (clientStaff && clientStaff.length > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          {agents && agents.length > 0 && (
            <select defaultValue="" onChange={e => { if (e.target.value) { addFromAgent(e.target.value); e.target.value = ''; } }}
              className="w-full text-xs px-3 py-2 rounded-xl outline-none"
              style={{ background: '#1e2537', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', colorScheme: 'dark' as const }}>
              <option value="">Agregar del equipo →</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}{a.jobTitle ? ` — ${a.jobTitle}` : ''}</option>
              ))}
            </select>
          )}
          {clientStaff && clientStaff.length > 0 && (
            <select defaultValue="" onChange={e => { if (e.target.value) { addFromStaff(e.target.value); e.target.value = ''; } }}
              className="w-full text-xs px-3 py-2 rounded-xl outline-none"
              style={{ background: '#1e2537', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa', colorScheme: 'dark' as const }}>
              <option value="">Agregar del cliente →</option>
              {clientStaff.map(s => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.jobTitle ? ` — ${s.jobTitle}` : ''}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Aviso si el agente no tiene firma configurada */}
      {!userSignature && (
        <div className="mb-3 px-3 py-2 rounded-xl flex items-center gap-2 text-xs"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)', color: '#fbbf24' }}>
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span>No tienes firma configurada.</span>
          <button onClick={onSetupSignature} className="underline font-semibold">Configúrala aquí</button>
        </div>
      )}

      {rows.length === 0 && <p className="text-xs py-2 text-center" style={{ color: tc.m }}>Sin firmantes</p>}

      {rows.map((r, i) => {
        const hasSig = r.signatureData;
        const firmId = r.id;
        const isSigning = agentSigning === i;
        const isClient = r.signerType === 'client';
        return (
          <div key={i} className="mb-3 rounded-xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${isClient ? 'rgba(96,165,250,0.18)' : 'rgba(167,139,250,0.18)'}`,
            }}>
            {/* Card header: tipo badge + eliminar */}
            <div className="flex items-center justify-between px-3 py-2 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{
                  background: isClient ? 'rgba(96,165,250,0.12)' : 'rgba(167,139,250,0.12)',
                  color: isClient ? '#60a5fa' : '#a78bfa',
                }}>
                {isClient ? 'Firmante · Cliente' : 'Firmante · Agente'}
              </span>
              <button onClick={() => del(i)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                style={{ color: '#f87171' }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Campos */}
            <div className="p-3 space-y-2.5">
              {/* Nombre — ancho completo */}
              <input placeholder="Nombre completo" value={r.nombre}
                onChange={e => update(i, 'nombre', e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputRowStyle} />

              {/* Cargo + Empresa en dos columnas */}
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Cargo" value={r.cargo}
                  onChange={e => update(i, 'cargo', e.target.value)}
                  className="text-sm px-3 py-2 rounded-lg outline-none" style={inputRowStyle} />
                <input placeholder="Empresa" value={r.empresa}
                  onChange={e => update(i, 'empresa', e.target.value)}
                  className="text-sm px-3 py-2 rounded-lg outline-none" style={inputRowStyle} />
              </div>

              {/* Correo + Teléfono: apilados en mobile, lado a lado en sm+ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="email" placeholder="Correo electrónico" value={r.email ?? ''}
                  onChange={e => update(i, 'email', e.target.value)}
                  className="text-sm px-3 py-2 rounded-lg outline-none" style={inputRowStyle} />
                <input type="tel" placeholder="WhatsApp (10 dígitos)" value={(r as any).telefono ?? ''}
                  onChange={e => update(i, 'telefono', e.target.value)}
                  className="text-sm px-3 py-2 rounded-lg outline-none" style={inputRowStyle} />
              </div>

              {/* Zona de firma */}
              <div className="pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {hasSig ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-white rounded-lg px-2 py-1 inline-flex">
                      <img src={hasSig} alt="firma" className="h-9" style={{ maxWidth: 130 }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold flex items-center gap-1" style={{ color: '#34d399' }}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isClient ? 'Firmado · cliente' : 'Firmado · agente'}
                      </p>
                      {r.signedAt && (
                        <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>
                          {new Date(r.signedAt).toLocaleDateString('es-CO')}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.signerType !== 'client' && (
                      <button onClick={() => handleAgentSign(i, r)} disabled={isSigning}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.20)', opacity: isSigning ? 0.7 : 1 }}>
                        {isSigning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
                        {isSigning ? 'Firmando...' : 'Firmar como agente'}
                      </button>
                    )}
                    {r.signerType !== 'agent' && firmId && (
                      <button onClick={() => copySignLink(r)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.20)' }}>
                        <Link2 className="w-3.5 h-3.5" /> Enlace para cliente
                      </button>
                    )}
                    {r.signerType !== 'agent' && !firmId && (
                      <p className="text-xs italic" style={{ color: '#94a3b8' }}>Guarda el acta para generar enlace de firma</p>
                    )}
                    {!hasSig && r.signerType !== 'client' && r.signerType !== 'agent' && (
                      <p className="text-xs italic" style={{ color: '#94a3b8' }}>Pendiente de firma</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-componente: tabla editable genérica ────────────────────────────────

const clampDateYear = (val: string): string => {
  if (!val) return val;
  const parts = val.split('-');
  if (parts[0] && parts[0].length > 4) parts[0] = parts[0].slice(0, 4);
  return parts.join('-');
};

function DynamicTable<T extends Record<string, any>>({ title, rows, setRows, columns, emptyRow, tc }: {
  title: string; rows: T[]; setRows: (r: T[]) => void;
  columns: { key: keyof T; label: string; type?: 'text' | 'date' | 'time' | 'select' | 'bool'; opts?: string[] }[];
  emptyRow: T; tc: any;
}) {
  const update = (i: number, k: keyof T, v: any) =>
    setRows(rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const add = () => setRows([...rows, { ...emptyRow }]);
  const del = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: tc.m }}>{title}</span>
        <button onClick={add} className="flex items-center gap-1 text-xs px-2 py-1 rounded"
          style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.20)' }}>
          <Plus className="w-3 h-3" /> Agregar
        </button>
      </div>
      {rows.length === 0 && <p className="text-xs py-2 text-center" style={{ color: tc.m }}>Sin registros</p>}
      {rows.map((row, i) => (
        <div key={i} className={`grid gap-2 mb-2 items-start`}
          style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr) auto` }}>
          {columns.map(col => (
            <div key={String(col.key)}>
              {col.type === 'bool' ? (
                <select value={row[col.key] === true ? 'si' : row[col.key] === false ? 'no' : ''}
                  onChange={e => update(i, col.key, e.target.value === 'si' ? true : e.target.value === 'no' ? false : null)}
                  className="w-full text-sm px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: tc.s }}>
                  <option value="">—</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              ) : col.type === 'select' ? (
                <select value={row[col.key] ?? ''} onChange={e => update(i, col.key, e.target.value)}
                  className="w-full text-sm px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: tc.s }}>
                  {col.opts?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={col.type === 'date' ? 'date' : col.type === 'time' ? 'time' : 'text'}
                  placeholder={col.label} value={row[col.key] ?? ''}
                  max={col.type === 'date' ? '2099-12-31' : undefined}
                  min={col.type === 'date' ? '2000-01-01' : undefined}
                  onChange={e => update(i, col.key, col.type === 'date' ? clampDateYear(e.target.value) : e.target.value)}
                  className="w-full text-sm px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: tc.s,
                    ...(col.type === 'time' ? { colorScheme: 'dark' } : {}) }} />
              )}
            </div>
          ))}
          <button onClick={() => del(i)} className="p-1.5 rounded" style={{ color: '#f87171' }}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ── Sub-componente: tabla checklist (entrega soporte) ──────────────────────

function ChecklistTable({ title, items, setItems, showMedio, tc }: {
  title: string; items: CheckItem[]; setItems: (x: CheckItem[]) => void;
  showMedio?: boolean; tc: any;
}) {
  const toggle = (i: number) => setItems(items.map((x, idx) => idx === i ? { ...x, checked: !x.checked } : x));
  const setObs = (i: number, v: string) => setItems(items.map((x, idx) => idx === i ? { ...x, obs: v } : x));
  const setMed = (i: number, v: string) => setItems(items.map((x, idx) => idx === i ? { ...x, medio: v } : x));

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: tc.m }}>{title}</p>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', color: tc.m }}>
              <th className="text-left px-3 py-2 text-xs font-medium">Ítem</th>
              <th className="px-3 py-2 text-xs font-medium w-20">Sí / No</th>
              {showMedio && <th className="px-3 py-2 text-xs font-medium w-28">Medio</th>}
              <th className="px-3 py-2 text-xs font-medium">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <td className="px-3 py-2" style={{ color: tc.s }}>{item.label}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => toggle(i)}
                    className="w-8 h-5 rounded-full relative transition-colors"
                    style={{ background: item.checked ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.10)' }}>
                    <span className="absolute top-0.5 transition-all rounded-full w-4 h-4 shadow"
                      style={{ left: item.checked ? '14px' : '2px', background: item.checked ? '#34d399' : '#94a3b8' }} />
                  </button>
                </td>
                {showMedio && (
                  <td className="px-2 py-1.5">
                    <input value={item.medio ?? ''} onChange={e => setMed(i, e.target.value)} placeholder="Medio"
                      className="w-full text-xs px-2 py-1 rounded outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: tc.s }} />
                  </td>
                )}
                <td className="px-2 py-1.5">
                  <input value={item.obs} onChange={e => setObs(i, e.target.value)} placeholder="—"
                    className="w-full text-xs px-2 py-1 rounded outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: tc.s }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Compromisos editor (visita) ────────────────────────────────────────────

function CompromisosEditor({ rows, setRows, projectModules, agents, clientStaff, tc, actaFecha }: {
  rows: Compromiso[];
  setRows: (r: Compromiso[]) => void;
  projectModules: any[];
  agents: { id: string; firstName: string; lastName: string }[];
  clientStaff: { id: string; firstName: string; lastName: string; jobTitle?: string | null }[];
  tc: any;
  actaFecha: string;
}) {
  const inputSty = { background: '#1a2235', border: '1px solid rgba(255,255,255,0.12)', color: tc.s, colorScheme: 'dark' as const };

  const add = () => setRows([...rows, { numero: rows.length + 1, compromiso: '', responsable: '', estado: 'pendiente' }]);
  const del = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const upd = (i: number, patch: Partial<Compromiso>) =>
    setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const handleDias = (i: number, dias: number) => {
    if (!dias || dias < 1) { upd(i, { diasVigencia: undefined, fechaLimite: undefined }); return; }
    const base = actaFecha ? new Date(actaFecha + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + dias);
    upd(i, { diasVigencia: dias, fechaLimite: base.toISOString().slice(0, 10) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: tc.m }}>Compromisos</span>
        <button onClick={add} className="flex items-center gap-1 text-xs px-2 py-1 rounded"
          style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.20)' }}>
          <Plus className="w-3 h-3" /> Agregar
        </button>
      </div>
      {rows.length === 0 && <p className="text-xs py-2 text-center" style={{ color: tc.m }}>Sin compromisos</p>}
      {rows.map((r, i) => {
        const phasesForModule = r.moduleId
          ? (projectModules.find((m: any) => m.id === r.moduleId)?.phases ?? [])
          : [];
        return (
          <div key={i} className="mb-3 p-3 rounded-xl space-y-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Fila 1: compromiso + estado + borrar */}
            <div className="flex gap-2 items-start">
              <textarea rows={2} placeholder="Descripción del compromiso"
                value={r.compromiso} onChange={e => upd(i, { compromiso: e.target.value })}
                className="flex-1 text-sm px-2 py-1.5 rounded-lg outline-none resize-none"
                style={inputSty} />
              <select value={r.estado} onChange={e => upd(i, { estado: e.target.value })}
                className="text-xs px-2 py-1.5 rounded-lg outline-none shrink-0"
                style={{ ...inputSty, width: 110 }}>
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En proceso</option>
                <option value="cumplido">Cumplido</option>
              </select>
              <button onClick={() => del(i)} style={{ color: '#f87171', marginTop: 4 }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Fila 2: agente + responsable cliente */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] mb-0.5" style={{ color: tc.m }}>Agente responsable</p>
                <select value={r.assignedToId ?? ''} onChange={e => upd(i, { assignedToId: e.target.value || undefined })}
                  className="w-full text-xs px-2 py-1 rounded-lg outline-none" style={inputSty}>
                  <option value="">— Sin asignar —</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] mb-0.5" style={{ color: tc.m }}>Responsable del cliente</p>
                <select value={r.clientStaffId ?? ''} onChange={e => upd(i, { clientStaffId: e.target.value || undefined })}
                  className="w-full text-xs px-2 py-1 rounded-lg outline-none" style={inputSty}>
                  <option value="">— Sin asignar —</option>
                  {clientStaff.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.jobTitle ? ` (${s.jobTitle})` : ''}</option>)}
                </select>
              </div>
            </div>
            {/* Fila 3: módulo + fase */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] mb-0.5" style={{ color: tc.m }}>Módulo del plan</p>
                <select value={r.moduleId ?? ''} onChange={e => upd(i, { moduleId: e.target.value || undefined, phaseId: undefined })}
                  className="w-full text-xs px-2 py-1 rounded-lg outline-none" style={inputSty}>
                  <option value="">— Sin módulo —</option>
                  {projectModules.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] mb-0.5" style={{ color: tc.m }}>Fase</p>
                <select value={r.phaseId ?? ''} onChange={e => upd(i, { phaseId: e.target.value || undefined })}
                  className="w-full text-xs px-2 py-1 rounded-lg outline-none" style={inputSty}
                  disabled={!r.moduleId}>
                  <option value="">— {r.moduleId ? 'Seleccionar fase' : 'Primero un módulo'} —</option>
                  {phasesForModule.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            {/* Fila 4: días vigencia → fecha límite + responsable principal */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] mb-0.5" style={{ color: tc.m }}>Días para cumplir</p>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={1} max={365} placeholder="ej: 10"
                    value={r.diasVigencia ?? ''}
                    onChange={e => handleDias(i, parseInt(e.target.value) || 0)}
                    className="w-20 text-xs px-2 py-1 rounded-lg outline-none" style={inputSty} />
                  {r.fechaLimite && (
                    <span className="text-[10px]" style={{ color: '#34d399' }}>
                      → {new Date(r.fechaLimite + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] mb-0.5" style={{ color: tc.m }}>Responsable principal</p>
                <select value={r.responsablePrincipal ?? ''} onChange={e => upd(i, { responsablePrincipal: e.target.value || undefined })}
                  className="w-full text-xs px-2 py-1 rounded-lg outline-none" style={inputSty}>
                  <option value="">— Sin definir —</option>
                  <option value="agente">Agente (implementador)</option>
                  <option value="cliente">Cliente</option>
                </select>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Actividades del Plan de Trabajo para acta de visita ───────────────────

const ACT_STATUS_CFG: Record<string, { label: string; color: string; bg: string; pct: number }> = {
  pendiente:   { label: 'Pendiente',    color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', pct: 0   },
  en_progreso: { label: 'En progreso',  color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  pct: 50  },
  completado:  { label: 'Completado',   color: '#34d399', bg: 'rgba(52,211,153,0.15)',  pct: 100 },
  bloqueado:   { label: 'Bloqueado',    color: '#f87171', bg: 'rgba(248,113,113,0.15)', pct: 0   },
};

function ActividadesVisitaEditor({ rows, setRows, projectModules, agents, clientStaff, tc, defaultAgentId, statusLabel }: {
  rows: ActaActividadRow[];
  setRows: (r: ActaActividadRow[]) => void;
  projectModules: any[];
  agents: { id: string; firstName: string; lastName: string }[];
  clientStaff: { id: string; firstName: string; lastName: string; jobTitle?: string | null }[];
  tc: any;
  defaultAgentId?: string;
  statusLabel?: string;
}) {
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const inputSty = { background: '#1a2235', border: '1px solid rgba(255,255,255,0.12)', color: tc.s, colorScheme: 'dark' as const };

  const selectedIds = new Set(rows.map(r => r.activityId));

  const toggleActivity = (activity: any) => {
    if (selectedIds.has(activity.id)) {
      setRows(rows.filter(r => r.activityId !== activity.id));
    } else {
      setRows([...rows, {
        activityId: activity.id,
        assignedToId: defaultAgentId ?? activity.assignedToId ?? undefined,
        clientStaffId: activity.clientStaffId ?? undefined,
        status: 'completado',
      }]);
    }
  };

  const updateRow = (activityId: string, patch: Partial<ActaActividadRow>) =>
    setRows(rows.map(r => r.activityId === activityId ? { ...r, ...patch } : r));

  const allActivities = projectModules.flatMap((m: any) =>
    (m.phases ?? []).flatMap((p: any) => (p.activities ?? []).map((a: any) => ({ ...a, phaseName: p.name, moduleName: m.name })))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: tc.m }}>
          Actividades del Plan de Trabajo
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
          {rows.length} seleccionada{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {projectModules.length === 0 ? (
        <p className="text-xs text-center py-3" style={{ color: tc.m }}>Sin módulos en el plan de trabajo</p>
      ) : (
        <div className="space-y-2">
          {projectModules.map((mod: any) => {
            const modActivities = (mod.phases ?? []).flatMap((p: any) => p.activities ?? []);
            const selectedInMod = modActivities.filter((a: any) => selectedIds.has(a.id)).length;
            const isOpen = openModuleId === mod.id;
            return (
              <div key={mod.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <button type="button" onClick={() => setOpenModuleId(isOpen ? null : mod.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span className="text-sm font-medium" style={{ color: tc.p }}>{mod.name}</span>
                  <div className="flex items-center gap-2">
                    {selectedInMod > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: 'rgba(52,211,153,0.20)', color: '#34d399' }}>
                        {selectedInMod}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: tc.m }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1">
                    {(mod.phases ?? []).map((phase: any) => (
                      <div key={phase.id} className="mb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider mt-2 mb-1" style={{ color: tc.m }}>
                          {phase.name}
                        </p>
                        {(phase.activities ?? []).length === 0 ? (
                          <p className="text-xs italic" style={{ color: tc.m }}>Sin actividades</p>
                        ) : (
                          (phase.activities ?? []).map((act: any) => {
                            const selected = selectedIds.has(act.id);
                            const row = rows.find(r => r.activityId === act.id);
                            const rowStatus = row?.status ?? 'completado';
                            const statusCfg = ACT_STATUS_CFG[rowStatus] ?? ACT_STATUS_CFG.completado;
                            return (
                              <div key={act.id} className="mb-2 rounded-lg p-2"
                                style={{ background: selected ? 'rgba(52,211,153,0.04)' : 'transparent', border: selected ? '1px solid rgba(52,211,153,0.15)' : '1px solid transparent' }}>
                                {/* Activity header row */}
                                <div className="flex items-start gap-2">
                                  <input type="checkbox" checked={selected} onChange={() => toggleActivity(act)}
                                    className="mt-0.5 shrink-0 accent-emerald-500" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-[10px]" style={{ color: '#60a5fa' }}>{act.code}</span>
                                      <span className="text-xs" style={{ color: selected ? tc.p : tc.m }}>{act.name}</span>
                                      <span className="text-[10px] px-1 rounded" style={{
                                        background: act.status === 'completado' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
                                        color: act.status === 'completado' ? '#34d399' : '#94a3b8',
                                      }}>{act.status}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Expanded fields when selected */}
                                {selected && row && (
                                  <div className="ml-5 mt-2 space-y-2">
                                    {/* Status selector */}
                                    <div>
                                      <p className="text-[10px] mb-1" style={{ color: tc.m }}>{statusLabel ?? 'Estado tras esta visita'}</p>
                                      <div className="flex gap-1 flex-wrap">
                                        {Object.entries(ACT_STATUS_CFG).map(([key, cfg]) => (
                                          <button key={key} type="button"
                                            onClick={() => updateRow(act.id, { status: key })}
                                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold transition-all"
                                            style={{
                                              background: rowStatus === key ? cfg.bg : 'rgba(255,255,255,0.04)',
                                              color: rowStatus === key ? cfg.color : '#94a3b8',
                                              border: `1px solid ${rowStatus === key ? cfg.color + '60' : 'rgba(255,255,255,0.08)'}`,
                                            }}>
                                            {cfg.label} ({cfg.pct}%)
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    {/* Agente + Responsable cliente */}
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <p className="text-[10px] mb-0.5" style={{ color: tc.m }}>Agente</p>
                                        <select value={row.assignedToId ?? ''}
                                          onChange={e => updateRow(act.id, { assignedToId: e.target.value || undefined })}
                                          className="w-full text-xs px-2 py-1 rounded-lg outline-none" style={inputSty}>
                                          <option value="">— Sin asignar —</option>
                                          {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <p className="text-[10px] mb-0.5" style={{ color: tc.m }}>Responsable cliente</p>
                                        <select value={row.clientStaffId ?? ''}
                                          onChange={e => updateRow(act.id, { clientStaffId: e.target.value || undefined })}
                                          className="w-full text-xs px-2 py-1 rounded-lg outline-none" style={inputSty}>
                                          <option value="">— Sin asignar —</option>
                                          {clientStaff.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.jobTitle ? ` (${s.jobTitle})` : ''}</option>)}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary of selected */}
      {rows.length > 0 && (
        <div className="mt-3 space-y-1">
          {rows.map(row => {
            const act = allActivities.find((a: any) => a.id === row.activityId);
            if (!act) return null;
            const cfg = ACT_STATUS_CFG[row.status] ?? ACT_STATUS_CFG.completado;
            return (
              <div key={row.activityId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                <span className="flex-1 truncate" style={{ color: tc.p }}>{act.moduleName} › {act.phaseName} › {act.name}</span>
                <span className="shrink-0 font-bold" style={{ color: cfg.color }}>{cfg.pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Input helper ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>{label}</label>
      {children}
    </div>
  );
}

// ── Modal principal de Crear / Editar acta ─────────────────────────────────

interface ActaModalProps {
  mode: 'create' | 'edit';
  defaultType?: ActaType;
  acta?: any;
  projectId: string;
  projectModules: any[];
  municipios: Municipio[];
  clientMunicipioId?: string;
  clientName?: string;
  clientStaff?: StaffOption[];
  agentOptions?: StaffOption[];
  userSignature?: string | null;
  currentUser?: { id: string; firstName: string; lastName: string } | null;
  onSetupSignature?: () => void;
  onClose: () => void;
  onSaved: (newActaId?: string) => void;
  tc: any;
}

function ActaModal({ mode, defaultType, acta, projectId, projectModules, municipios, clientMunicipioId, clientName, clientStaff, agentOptions, userSignature, currentUser, onSetupSignature, onClose, onSaved, tc }: ActaModalProps) {
  const inputCls = "w-full text-sm px-3 py-2 rounded-xl outline-none";
  const inputStyle = { background: '#1a2235', border: '1px solid rgba(255,255,255,0.12)', color: tc.s, colorScheme: 'dark' as const };

  // ── Estado base ──
  const [type, setType]     = useState<ActaType>(acta?.type ?? defaultType ?? 'inicio');
  const [fecha, setFecha]   = useState(acta?.fecha ? acta.fecha.slice(0, 10) : localToday());
  // Municipio: inicializar desde el acta existente o desde el municipio del cliente
  const initMunicipioId = acta?.municipioId ?? (mode === 'create' ? (clientMunicipioId ?? null) : null);
  const initMunicipio   = municipios.find(m => m.id === (initMunicipioId ?? '')) ?? null;
  const [municipioId, setMunicipioId] = useState<string | null>(initMunicipioId ?? null);
  const [ciudad, setCiudad] = useState(
    initMunicipio?.nombreMunicipio ?? acta?.municipio?.nombreMunicipio ?? acta?.ciudad ?? ''
  );
  const [lugar, setLugar]   = useState(acta?.lugar ?? '');
  const [numero, setNumero] = useState(acta?.numero ?? '');
  const [status, setStatus] = useState(acta?.status ?? 'borrador');

  // ── Inicio ──
  const [asunto, setAsunto]               = useState(acta?.asunto ?? '');
  const [objetivoGeneral, setObjetivo]    = useState(acta?.objetivoGeneral ?? '');
  const [alcance, setAlcance]             = useState(acta?.alcance ?? '');

  // ── Agente / Implementador ──
  const currentUserFullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : '';
  const [implementador, setImplementador] = useState(
    acta?.implementadorNombre ?? (mode === 'create' ? currentUserFullName : '')
  );
  const [agents, setAgents] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  useEffect(() => {
    usersApi.listAgents({ limit: 100 }).then(res => {
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      setAgents(list);
    }).catch(() => {});
  }, []);

  // Al abrir en modo creación: pre-crea el firmante del agente con el usuario actual
  useEffect(() => {
    if (mode !== 'create' || !currentUser) return;
    const agentName = `${currentUser.firstName} ${currentUser.lastName}`;
    setFirmantes(prev => {
      if (prev.some(f => f.signerType === 'agent')) return prev;
      return [{
        nombre: agentName, cargo: '', empresa: '', fecha: '', orden: 0,
        signerType: 'agent',
        signatureData: userSignature ?? undefined,
        signedAt: userSignature ? new Date().toISOString() : undefined,
      }];
    });
  // Solo al montar con currentUser disponible
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Cuando llega la firma del usuario, aplicarla al firmante agente si aún no tiene firma
  useEffect(() => {
    if (mode !== 'create' || !userSignature) return;
    setFirmantes(prev => prev.map(f =>
      f.signerType === 'agent' && !f.signatureData
        ? { ...f, signatureData: userSignature, signedAt: f.signedAt ?? new Date().toISOString() }
        : f
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSignature]);

  // ── Visita ──
  const [jefe, setJefe]                   = useState(acta?.jefeNombre ?? '');
  const [actividades, setActividades]     = useState(acta?.actividadesRealizadas ?? '');
  const [fechasV, setFechasV]             = useState<FechaV[]>(
    acta?.fechasVisita?.map((f: any) => ({ fecha: f.fecha.slice(0, 10), horaInicio: f.horaInicio ?? '', horaFin: f.horaFin ?? '' })) ?? []
  );
  const [compromisos, setCompromisos]     = useState<Compromiso[]>(
    acta?.compromisos?.map((c: any) => ({
      numero: c.numero ?? 1,
      compromiso: c.compromiso,
      responsable: c.responsable ?? '',
      estado: c.estado ?? 'pendiente',
      assignedToId: c.assignedToId ?? undefined,
      clientStaffId: c.clientStaffId ?? undefined,
      moduleId: c.moduleId ?? undefined,
      phaseId: c.phaseId ?? undefined,
      activityId: c.activityId ?? undefined,
      fechaLimite: c.fechaLimite ? c.fechaLimite.slice(0, 10) : undefined,
      responsablePrincipal: c.responsablePrincipal ?? undefined,
    })) ?? []
  );
  const [actaActividades, setActaActividades] = useState<ActaActividadRow[]>(
    acta?.actaActividades?.map((a: any) => ({
      activityId: a.activityId,
      assignedToId: a.assignedToId ?? undefined,
      clientStaffId: a.clientStaffId ?? undefined,
      status: a.status ?? 'completado',
    })) ?? []
  );

  // ── Cierre ──
  const DEFAULT_CIERRE_CUERPO = 'Por medio de la presente me permito comunicar que una vez culminados los procesos de parametrización, capacitación, pruebas y arranque en producción se da por cerrada completamente la etapa de implementación de los siguientes modulos.';
  const [cuerpo, setCuerpo]               = useState(
    acta?.cuerpo ?? (mode === 'create' && (defaultType === 'cierre') ? DEFAULT_CIERRE_CUERPO : '')
  );
  const [cierreModulos, setCierreModulos] = useState<{id:string;name:string}[]>(() => {
    try { return JSON.parse(acta?.cierreModulosJson ?? '[]'); } catch { return []; }
  });
  const [contactos, setContactos]         = useState<Contacto[]>(
    acta?.contactos?.map((c: any) => ({ nombre: c.nombre ?? '', telefono: c.telefono ?? '', area: c.area ?? '' })) ?? []
  );

  // Cuando el usuario cambia a tipo 'cierre' en modo crear y no ha escrito nada, poner el texto por defecto
  React.useEffect(() => {
    if (mode === 'create' && type === 'cierre' && !cuerpo) {
      setCuerpo(DEFAULT_CIERRE_CUERPO);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // ── Capacitación ──
  const [moduloId, setModuloId]           = useState(acta?.moduloId ?? '');
  const [expositorId, setExpositorId]     = useState<string>(() => {
    // Intentar encontrar el agente por nombre al editar
    return '';
  });
  const [expositor, setExpositor]         = useState(acta?.expositor ?? '');
  const [temas, setTemas]                 = useState(acta?.temasCapacitacion ?? '');
  const [horaInicio, setHoraInicio]       = useState(acta?.horaInicio ?? '');
  const [horaFin, setHoraFin]             = useState(acta?.horaFin ?? '');
  const [participantes, setParticipantes] = useState<Participante[]>(
    acta?.participantes?.map((p: any) => ({
      numero: p.numero ?? 1, nombre: p.nombre, cargo: p.cargo ?? '',
      documento: p.documento ?? '',
    })) ?? []
  );
  const [acciones, setAcciones]           = useState<Accion[]>(
    acta?.acciones?.map((a: any) => ({ accion: a.accion, responsable: a.responsable ?? '', fechaLimite: a.fechaLimite ? a.fechaLimite.slice(0, 10) : '' })) ?? []
  );

  // ── Entrega soporte ──
  const [nit, setNit]                   = useState(acta?.nitCliente ?? '');
  const [sedes, setSedes]               = useState(acta?.sedes ?? '');
  const [respImpl, setRespImpl]         = useState(acta?.responsableImplementador ?? '');
  const [respSop, setRespSop]           = useState(acta?.responsableSoporte ?? '');
  const [capMod, setCapMod]             = useState(acta?.capacitacionModalidad ?? '');
  const [capHoras, setCapHoras]         = useState(acta?.capacitacionHoras ?? '');
  const [capPruebas, setCapPruebas]     = useState<boolean | null>(acta?.capacitacionPruebas ?? null);
  const [reqs, setReqs]                 = useState(acta?.requerimientosAdicionales ?? '');
  const [obsGen, setObsGen]             = useState(acta?.observacionesGenerales ?? '');
  const [ventanas, setVentanas]         = useState(acta?.ventanasDistintas ?? '');
  const [modCheck, setModCheck]         = useState<CheckItem[]>(parseChecklist(acta?.modulosChecklist, MODULOS_DEFAULT));
  const [infraCheck, setInfraCheck]     = useState<CheckItem[]>(parseChecklist(acta?.infraestructuraChecklist, INFRA_DEFAULT));
  const [docsCheck, setDocsCheck]       = useState<CheckItem[]>(parseChecklist(acta?.documentacionChecklist, DOCS_DEFAULT));
  const [emisCheck, setEmisCheck]       = useState<CheckItem[]>(parseChecklist(acta?.emisionElectronicaChecklist, EMISION_DEFAULT));

  // ── Firmantes ──
  const [firmantes, setFirmantes]       = useState<Firmante[]>(
    acta?.firmantes?.map((f: any) => ({
      id: f.id,
      nombre: f.nombre ?? '',
      cargo: f.cargo ?? '',
      empresa: f.empresa ?? '',
      documento: f.documento ?? '',
      fecha: f.fecha ? f.fecha.slice(0, 10) : '',
      orden: f.orden ?? 0,
      signatureData: f.signatureData ?? undefined,
      signedAt: f.signedAt ?? undefined,
      signerType: f.signerType ?? undefined,
    })) ?? []
  );

  const [saving, setSaving]             = useState(false);

  const handleSave = async () => {
    if (!fecha) { toast.error('La fecha es requerida'); return; }
    setSaving(true);
    try {
      const payload: CreateActaPayload = {
        projectId, type, fecha, ciudad: ciudad || undefined, municipioId: municipioId || undefined, lugar: lugar || undefined,
        numero: numero || undefined, status,
        asunto: asunto || undefined, objetivoGeneral: objetivoGeneral || undefined, alcance: alcance || undefined,
        implementadorNombre: implementador || undefined, jefeNombre: jefe || undefined,
        actividadesRealizadas: actividades || undefined,
        cuerpo: cuerpo || undefined,
        cierreModulosJson: cierreModulos.length > 0 ? JSON.stringify(cierreModulos) : undefined,
        moduloId: moduloId || undefined, expositor: expositor || undefined, temasCapacitacion: temas || undefined,
        horaInicio: horaInicio || undefined, horaFin: horaFin || undefined,
        nitCliente: nit || undefined, sedes: sedes || undefined,
        responsableImplementador: respImpl || undefined, responsableSoporte: respSop || undefined,
        capacitacionModalidad: capMod || undefined,
        capacitacionHoras: capHoras !== '' ? Number(capHoras) : undefined,
        capacitacionPruebas: capPruebas !== null ? capPruebas : undefined,
        requerimientosAdicionales: reqs || undefined, observacionesGenerales: obsGen || undefined,
        ventanasDistintas: ventanas || undefined,
        modulosChecklist: JSON.stringify(modCheck),
        infraestructuraChecklist: JSON.stringify(infraCheck),
        documentacionChecklist: JSON.stringify(docsCheck),
        emisionElectronicaChecklist: JSON.stringify(emisCheck),
        firmantes: firmantes.map((f, i) => ({ ...f, orden: i, fecha: f.fecha || undefined })),
        fechasVisita: fechasV.map(f => ({ ...f })),
        compromisos: compromisos.map((c, i) => ({
          numero: i + 1,
          compromiso: c.compromiso,
          responsable: c.responsable || undefined,
          estado: c.estado,
          assignedToId: c.assignedToId,
          clientStaffId: c.clientStaffId,
          moduleId: c.moduleId,
          phaseId: c.phaseId,
          activityId: c.activityId,
          fechaLimite: c.fechaLimite || undefined,
          responsablePrincipal: c.responsablePrincipal || undefined,
        })),
        participantes: participantes.map((p, i) => ({
          numero: i + 1, nombre: p.nombre, cargo: p.cargo || undefined,
          documento: p.documento || undefined,
        })),
        acciones: acciones.map(a => ({ ...a, fechaLimite: a.fechaLimite || undefined })),
        contactos,
        actaActividades: (type === 'visita' || type === 'capacitacion') ? actaActividades : undefined,
      };
      let newActaId: string | undefined;
      if (mode === 'create') {
        const created: any = await actasApi.create(payload);
        newActaId = created?.id;
      } else {
        await actasApi.update(acta.id, payload);
      }
      toast.success(mode === 'create' ? 'Acta creada' : 'Acta actualizada');
      onSaved(newActaId);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  const cfg = TYPE_CFG[type];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="relative flex flex-col rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh]"
        style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.10)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: cfg.bg, color: cfg.color }}>{cfg.short}</span>
            <h3 className="text-base font-semibold" style={{ color: tc.p }}>
              {mode === 'create' ? 'Nueva Acta' : 'Editar Acta'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: tc.m }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Tipo + estado */}
          {mode === 'create' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de acta">
                <select value={type} onChange={e => setType(e.target.value as ActaType)}
                  className={inputCls} style={inputStyle}>
                  {Object.entries(TYPE_CFG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Estado">
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className={inputCls} style={inputStyle}>
                  <option value="borrador">Borrador</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </Field>
            </div>
          )}

          {mode === 'edit' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estado">
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className={inputCls} style={inputStyle}>
                  <option value="borrador">Borrador</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </Field>
              <Field label="Número de acta">
                <input value={numero} onChange={e => setNumero(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Auto" />
              </Field>
            </div>
          )}

          {/* Campos comunes */}
          <div className={`grid gap-3 ${type === 'capacitacion' ? 'grid-cols-5' : 'grid-cols-3'}`}>
            <Field label="Fecha">
              <input type="date" value={fecha}
                max="2099-12-31" min="2000-01-01"
                onChange={e => setFecha(clampDateYear(e.target.value))}
                className={inputCls} style={inputStyle} />
            </Field>
            {type === 'capacitacion' && (<>
              <Field label="Hora inicio">
                <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
                  className={inputCls} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </Field>
              <Field label="Hora fin">
                <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)}
                  className={inputCls} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </Field>
            </>)}
            <Field label="Ciudad">
              <MunicipioSearch
                municipios={municipios}
                value={(() => {
                  const sel = municipios.find(m => m.id === (municipioId ?? ''));
                  return sel ? `${sel.nombreMunicipio}, ${sel.nombreDepartamento}` : ciudad;
                })()}
                onSelect={m => {
                  if (m) { setMunicipioId(m.id); setCiudad(m.nombreMunicipio); }
                  else   { setMunicipioId(null);  setCiudad(''); }
                }}
                inputClassName="text-sm py-2 rounded-xl outline-none"
                inputStyle={inputStyle}
                placeholder="Buscar municipio o departamento..."
              />
            </Field>
            {type !== 'inicio' && type !== 'entrega_soporte' && (
              <Field label="Lugar">
                <input value={lugar} onChange={e => setLugar(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Instalaciones del cliente" />
              </Field>
            )}
          </div>

          {/* ── INICIO ── */}
          {type === 'inicio' && (<>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Agente responsable">
                <select
                  value={agents.find(a => `${a.firstName} ${a.lastName}` === implementador)?.id ?? '__custom__'}
                  onChange={e => {
                    const agent = agents.find(a => a.id === e.target.value);
                    if (!agent) return;
                    const agentName = `${agent.firstName} ${agent.lastName}`;
                    setImplementador(agentName);
                    // Sync: actualiza o crea el firmante del agente en la lista
                    const isSelf = agent.id === currentUser?.id;
                    const sig    = isSelf ? (userSignature ?? undefined) : undefined;
                    setFirmantes(prev => {
                      const idx = prev.findIndex(f => f.signerType === 'agent' || (!f.signerType && f.signerType !== 'client'));
                      const agentFirmante: Firmante = {
                        ...(idx >= 0 ? prev[idx] : { cargo: '', empresa: '', fecha: '', orden: prev.length }),
                        nombre: agentName,
                        signerType: 'agent',
                        signatureData: sig ?? (idx >= 0 ? prev[idx].signatureData : undefined),
                        signedAt: sig ? (idx >= 0 ? prev[idx].signedAt ?? new Date().toISOString() : new Date().toISOString()) : (idx >= 0 ? prev[idx].signedAt : undefined),
                      };
                      if (idx >= 0) return prev.map((f, i) => i === idx ? agentFirmante : f);
                      return [agentFirmante, ...prev];
                    });
                  }}
                  className={inputCls} style={inputStyle}>
                  <option value="__custom__" disabled>Seleccionar agente...</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                  ))}
                </select>
              </Field>
              <Field label="Asunto">
                <input value={asunto} onChange={e => setAsunto(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Inicio de implementación..." />
              </Field>
              <Field label="Objetivo general">
                <textarea value={objetivoGeneral} onChange={e => setObjetivo(e.target.value)} rows={3}
                  className={inputCls} style={inputStyle} placeholder="Objetivo del proyecto..." />
              </Field>
              <Field label="Alcance">
                <textarea value={alcance} onChange={e => setAlcance(e.target.value)} rows={3}
                  className={inputCls} style={inputStyle} placeholder="Módulos y actividades incluidas..." />
              </Field>
            </div>
          </>)}

          {/* ── VISITA ── */}
          {type === 'visita' && (<>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Implementador">
                <input value={implementador} onChange={e => setImplementador(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Nombre del implementador" />
              </Field>
              <Field label="Jefe de implementación">
                <input value={jefe} onChange={e => setJefe(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Nombre del jefe" />
              </Field>
            </div>
            <DynamicTable<FechaV>
              title="Fechas y horarios de visita"
              rows={fechasV} setRows={setFechasV}
              columns={[
                { key: 'fecha', label: 'Fecha', type: 'date' },
                { key: 'horaInicio', label: 'Hora inicio', type: 'time' },
                { key: 'horaFin', label: 'Hora fin', type: 'time' },
              ]}
              emptyRow={{ fecha: '', horaInicio: '', horaFin: '' }}
              tc={tc}
            />
            <Field label="Actividades realizadas">
              <textarea value={actividades} onChange={e => setActividades(e.target.value)} rows={4}
                className={inputCls} style={inputStyle} placeholder="Describa las actividades realizadas durante la visita..." />
            </Field>
            <ActividadesVisitaEditor
              rows={actaActividades} setRows={setActaActividades}
              projectModules={projectModules}
              agents={agents}
              clientStaff={clientStaff ?? []}
              tc={tc}
            />
            <CompromisosEditor
              rows={compromisos} setRows={setCompromisos}
              projectModules={projectModules}
              agents={agents}
              clientStaff={clientStaff ?? []}
              tc={tc}
              actaFecha={fecha}
            />
          </>)}

          {/* ── CIERRE ── */}
          {type === 'cierre' && (<>

            {/* Módulos a cerrar */}
            {projectModules.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: tc.m }}>
                  Módulos a cerrar
                </p>
                <div className="rounded-xl p-3 flex flex-wrap gap-2"
                  style={{ background: '#1a2235', border: '1px solid rgba(255,255,255,0.10)' }}>
                  {projectModules.map((m: any) => {
                    const selected = cierreModulos.some(cm => cm.id === m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCierreModulos(prev =>
                          selected
                            ? prev.filter(cm => cm.id !== m.id)
                            : [...prev, { id: m.id, name: m.name }]
                        )}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={selected
                          ? { background: 'rgba(167,139,250,0.20)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.40)' }
                          : { background: 'rgba(255,255,255,0.04)', color: tc.m, border: '1px solid rgba(255,255,255,0.10)' }
                        }
                      >
                        {selected && <span style={{ fontSize: 10 }}>✓</span>}
                        {m.name}
                      </button>
                    );
                  })}
                </div>
                {cierreModulos.length === 0 && (
                  <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    Selecciona los módulos que quedan cerrados con esta acta
                  </p>
                )}
              </div>
            )}

            <Field label="Cuerpo del acta">
              <textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={6}
                className={inputCls} style={inputStyle}
                placeholder="Por medio de la presente, comunicamos a usted que el proceso de implementación..." />
            </Field>

            <DynamicTable<Contacto>
              title="Contactos de soporte"
              rows={contactos} setRows={setContactos}
              columns={[
                { key: 'nombre', label: 'Nombre' },
                { key: 'telefono', label: 'Teléfono' },
                { key: 'area', label: 'Área' },
              ]}
              emptyRow={{ nombre: '', telefono: '', area: '' }}
              tc={tc}
            />
          </>)}

          {/* ── CAPACITACIÓN ── */}
          {type === 'capacitacion' && (<>

            {/* Módulo + Expositor (dropdown de agentes) */}
            <div className="grid grid-cols-2 gap-3">
              {projectModules.length > 0 && (
                <Field label="Módulo">
                  <select value={moduloId} onChange={e => setModuloId(e.target.value)}
                    className={inputCls} style={inputStyle}>
                    <option value="">— Seleccionar —</option>
                    {projectModules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Expositor (agente)">
                <select
                  value={expositorId}
                  onChange={e => {
                    const agent = agents.find(a => a.id === e.target.value);
                    setExpositorId(e.target.value);
                    setExpositor(agent ? `${agent.firstName} ${agent.lastName}` : '');
                  }}
                  className={inputCls} style={inputStyle}>
                  <option value="">— Seleccionar agente —</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Actividades del plan de trabajo */}
            <ActividadesVisitaEditor
              rows={actaActividades} setRows={setActaActividades}
              projectModules={projectModules} agents={agents}
              clientStaff={clientStaff ?? []} tc={tc}
              defaultAgentId={expositorId || undefined}
              statusLabel="Estado tras esta capacitación"
            />

            {/* Temas */}
            <Field label="Temas y ejercicios prácticos">
              <textarea value={temas} onChange={e => setTemas(e.target.value)} rows={4}
                className={inputCls} style={inputStyle}
                placeholder="Liste los temas tratados en la capacitación..." />
            </Field>

            {/* Participantes desde personal del cliente */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tc.m }}>Participantes</p>
                <div className="flex gap-2">
                  {(clientStaff ?? []).length > 0 && (
                    <select
                      defaultValue=""
                      onChange={e => {
                        const s = (clientStaff ?? []).find(x => x.id === e.target.value);
                        if (!s) return;
                        e.target.value = '';
                        setParticipantes(prev => [
                          ...prev,
                          { numero: prev.length + 1, nombre: `${s.firstName} ${s.lastName}`,
                            cargo: s.jobTitle ?? '', documento: s.document ?? '' },
                        ]);
                      }}
                      className="text-xs px-2 py-1.5 rounded-lg outline-none"
                      style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                      <option value="">+ Del cliente</option>
                      {(clientStaff ?? []).map(s => (
                        <option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.jobTitle ? ` (${s.jobTitle})` : ''}</option>
                      ))}
                    </select>
                  )}
                  <button type="button"
                    onClick={() => setParticipantes(prev => [
                      ...prev,
                      { numero: prev.length + 1, nombre: '', cargo: '', documento: '' },
                    ])}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                    + Manual
                  </button>
                </div>
              </div>

              {participantes.length === 0 ? (
                <p className="text-xs text-center py-3" style={{ color: tc.m }}>Sin registros</p>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                        {['Nombre', 'Cargo', 'Documento', ''].map(h => (
                          <th key={h} className="px-2 py-2 text-left font-medium" style={{ color: tc.m }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {participantes.map((p, i) => (
                        <tr key={i} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                          {(['nombre', 'cargo', 'documento'] as const).map(k => (
                            <td key={k} className="px-2 py-1">
                              <input
                                value={(p as any)[k] ?? ''}
                                onChange={e => setParticipantes(prev => prev.map((r, j) => j === i ? { ...r, [k]: e.target.value } : r))}
                                className="w-full bg-transparent outline-none text-xs"
                                style={{ color: tc.s, minWidth: 60 }}
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1">
                            <button type="button"
                              onClick={() => setParticipantes(prev => prev.filter((_, j) => j !== i))}
                              className="text-red-400 hover:text-red-300">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {participantes.some(p => p.documento) && (
                <p className="text-[10px] mt-1.5" style={{ color: 'rgba(96,165,250,0.7)' }}>
                  ℹ Los participantes con documento podrán firmar desde "Buscar documentos para firmar"
                </p>
              )}
            </div>

            <DynamicTable<Accion>
              title="Observaciones y acciones a tomar"
              rows={acciones} setRows={setAcciones}
              columns={[
                { key: 'accion', label: 'Acción a tomar' },
                { key: 'responsable', label: 'Responsable' },
                { key: 'fechaLimite', label: 'Fecha límite', type: 'date' },
              ]}
              emptyRow={{ accion: '', responsable: '', fechaLimite: '' }}
              tc={tc}
            />
          </>)}

          {/* ── ENTREGA A SOPORTE ── */}
          {type === 'entrega_soporte' && (<>
            <div className="grid grid-cols-2 gap-3">
              <Field label="NIT del cliente">
                <input value={nit} onChange={e => setNit(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="900.000.000-0" />
              </Field>
              <Field label="Sede(s)">
                <input value={sedes} onChange={e => setSedes(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Principal" />
              </Field>
              <Field label="Responsable implementación">
                <input value={respImpl} onChange={e => setRespImpl(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Nombre del implementador" />
              </Field>
              <Field label="Responsable soporte receptor">
                <input value={respSop} onChange={e => setRespSop(e.target.value)}
                  className={inputCls} style={inputStyle} placeholder="Nombre del receptor" />
              </Field>
            </div>

            {/* Capacitación resumen */}
            <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: tc.m }}>Resumen de capacitación</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Modalidad">
                  <select value={capMod} onChange={e => setCapMod(e.target.value)}
                    className={inputCls} style={inputStyle}>
                    <option value="">— Seleccionar —</option>
                    <option value="virtual">Virtual</option>
                    <option value="presencial">Presencial</option>
                  </select>
                </Field>
                <Field label="Horas totales">
                  <input type="number" value={capHoras} onChange={e => setCapHoras(e.target.value)}
                    className={inputCls} style={inputStyle} placeholder="0" />
                </Field>
                <Field label="¿Pruebas de arranque?">
                  <select value={capPruebas === true ? 'si' : capPruebas === false ? 'no' : ''}
                    onChange={e => setCapPruebas(e.target.value === 'si' ? true : e.target.value === 'no' ? false : null)}
                    className={inputCls} style={inputStyle}>
                    <option value="">—</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                </Field>
              </div>
            </div>

            <ChecklistTable title="1. Checklist módulos entregados" items={modCheck} setItems={setModCheck} tc={tc} />
            <ChecklistTable title="3. Infraestructura técnica" items={infraCheck} setItems={setInfraCheck} tc={tc} />
            <ChecklistTable title="5. Documentación entregada" items={docsCheck} setItems={setDocsCheck} showMedio tc={tc} />
            <ChecklistTable title="8. Emisión electrónica" items={emisCheck} setItems={setEmisCheck} tc={tc} />

            <Field label="4. Requerimientos adicionales">
              <textarea value={reqs} onChange={e => setReqs(e.target.value)} rows={3}
                className={inputCls} style={inputStyle} placeholder="Listado de requerimientos adicionales..." />
            </Field>
            <Field label="6. Observaciones generales">
              <textarea value={obsGen} onChange={e => setObsGen(e.target.value)} rows={3}
                className={inputCls} style={inputStyle} placeholder="Observaciones..." />
            </Field>
            <Field label="9. Ventanas con metodología distinta">
              <textarea value={ventanas} onChange={e => setVentanas(e.target.value)} rows={3}
                className={inputCls} style={inputStyle} placeholder="Módulos fuera del modelo convencional..." />
            </Field>
          </>)}

          {/* Firmantes (todos los tipos) */}
          <div className="border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <FirmantesEditor rows={firmantes} setRows={setFirmantes} tc={tc}
              clientStaff={clientStaff} clientName={clientName} agents={agentOptions}
              userSignature={userSignature} onSetupSignature={onSetupSignature} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm" style={{ color: tc.m }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
            style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.30)' }}>
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Guardando...' : 'Guardar acta'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vista de impresión ─────────────────────────────────────────────────────

// ── Modal configuración de branding (logo + colores) ──────────────────────────
function BrandingConfigModal({ company, onClose, onSaved }: {
  company: any; onClose: () => void; onSaved: (updated: any) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string>(company?.logoData ?? '');
  const [primary,     setPrimary]     = useState(company?.primaryColor ?? '#1E3A5F');
  const [secondary,   setSecondary]   = useState(company?.secondaryColor ?? '#2D5086');
  const [addr,        setAddr]        = useState(company?.address ?? '');
  const [phone,       setPhone]       = useState(company?.phone ?? '');
  const [email,       setEmail]       = useState(company?.email ?? '');
  const [website,     setWebsite]     = useState(company?.website ?? '');
  const [saving,      setSaving]      = useState(false);

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => setLogoPreview(ev.target?.result as string);
    r.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await companyApi.update({
        logoData: logoPreview || null,
        primaryColor: primary,
        secondaryColor: secondary,
        address: addr,
        phone,
        website,
      } as any);
      toast.success('Branding actualizado');
      onSaved({ ...company, ...updated, logoData: logoPreview });
      onClose();
    } catch { toast.error('Error al guardar el branding'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col"
        style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.12)', maxHeight: '88vh' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" /> Configurar branding del reporte
          </p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Logo */}
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Logo de la empresa</p>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoFile} />
            <div className="flex items-center gap-4">
              <div className="w-32 h-16 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden"
                style={{ borderColor: 'rgba(96,165,250,0.4)', background: logoPreview ? '#fff' : 'rgba(96,165,250,0.05)' }}
                onClick={() => fileRef.current?.click()}>
                {logoPreview
                  ? <img src={logoPreview} alt="logo" className="max-h-full max-w-full object-contain p-1" />
                  : <span className="text-xs text-blue-400">Subir logo</span>}
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <p>PNG, JPG, SVG, WEBP</p>
                <p>Fondo transparente recomendado</p>
                {logoPreview && (
                  <button onClick={() => setLogoPreview('')} className="text-red-400 underline">Quitar logo</button>
                )}
              </div>
            </div>
          </div>

          {/* Colores */}
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Colores corporativos</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Color primario</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={primary} onChange={e => setPrimary(e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer border-0 p-0" style={{ background: 'none' }} />
                  <input type="text" value={primary} onChange={e => setPrimary(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none text-white font-mono"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Encabezado, fondo principal</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Color secundario</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer border-0 p-0" style={{ background: 'none' }} />
                  <input type="text" value={secondary} onChange={e => setSecondary(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none text-white font-mono"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Secciones alternadas</p>
              </div>
            </div>
          </div>

          {/* Datos pie de página */}
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Pie de pagina del reporte</p>
            <div className="space-y-2">
              {[
                { label: 'Direccion', value: addr, set: setAddr, placeholder: 'Calle 62 # 44-43, Barranquilla' },
                { label: 'Telefono', value: phone, set: setPhone, placeholder: '3029183 - 3206162053' },
                { label: 'Correo', value: email, set: setEmail, placeholder: 'comercial@empresa.com' },
                { label: 'Sitio web', value: website, set: setWebsite, placeholder: 'www.empresa.com' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="text-xs text-slate-400 mb-0.5 block">{label}</label>
                  <input type="text" value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                    className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none text-white"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Preview mini */}
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Vista previa</p>
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.10)' }}>
              <div className="h-10 flex items-center px-3 gap-3" style={{ background: primary }}>
                {logoPreview
                  ? <img src={logoPreview} alt="logo" className="h-7 object-contain bg-white rounded px-1" />
                  : <div className="w-12 h-7 bg-white/20 rounded flex items-center justify-center text-[9px] text-white">LOGO</div>}
                <span className="text-white text-xs font-bold uppercase tracking-widest">{company?.commercialName || company?.name}</span>
              </div>
              <div className="h-5 px-3 flex items-center" style={{ background: secondary }}>
                <span className="text-white text-[9px] font-semibold uppercase tracking-wider">OBJETIVO GENERAL</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5 pt-3 border-t shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm" style={{ color: '#94a3b8' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.30)' }}>
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {saving ? 'Guardando...' : 'Guardar branding'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PrintView con template profesional ────────────────────────────────────────
function PrintView({ acta, project, company, userSignature, onClose, onConfigureBranding }: {
  acta: any; project: any; company: any; userSignature?: string | null;
  onClose: () => void; onConfigureBranding: () => void;
}) {
  const isBrandConfigured = !!(company?.logoData);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/generate-acta-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acta: { ...acta, project }, company }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `acta-${acta.tipo ?? acta.type ?? 'doc'}-${acta.numero ?? 'doc'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[download-acta-pdf]', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
      alignItems: 'flex-start', justifyContent: 'center', paddingTop: 16, paddingBottom: 32,
      overflowY: 'auto', background: 'rgba(0,0,0,0.88)' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 820, margin: '0 auto', padding: '0 12px' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 12, padding: '0 2px', flexWrap: 'wrap', gap: 8 }}>
          <button onClick={onConfigureBranding} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            borderRadius: 12, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            ...(isBrandConfigured
              ? { background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.20)' }
              : { background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }) }}>
            ⚙ {isBrandConfigured ? 'Editar branding' : 'Configurar branding'}
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={handleDownloadPdf} disabled={downloading} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
              borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: downloading ? 'wait' : 'pointer',
              background: 'rgba(96,165,250,0.2)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)',
              opacity: downloading ? 0.7 : 1 }}>
              {downloading
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Printer className="w-4 h-4" />}
              {downloading ? 'Generando...' : 'Descargar PDF'}
            </button>
            <button onClick={onClose} style={{ padding: 8, borderRadius: 12, cursor: 'pointer',
              color: '#94a3b8', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isBrandConfigured && (
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 12, fontSize: 12, flexWrap: 'wrap',
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
            ⚙ Logo no configurado — se usaran colores predeterminados.
            <button onClick={onConfigureBranding} style={{ textDecoration: 'underline', fontWeight: 600,
              background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', marginLeft: 4 }}>
              Configurar ahora
            </button>
          </div>
        )}

        <ActaDocumento
          acta={{ ...acta, project }}
          company={company}
          userSignature={userSignature}
        />
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function ActasPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromBloqueId = searchParams.get('bloqueId');
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const tc = {
    p: isLight ? '#0f172a' : '#f1f5f9',
    s: isLight ? '#1e293b' : '#e2e8f0',
    m: isLight ? '#64748b' : '#94a3b8',
    bg: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
  };
  const cardStyle = {
    background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '16px',
    padding: '20px',
  };

  const [project, setProject]       = useState<any>(null);
  const [actas, setActas]           = useState<any[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [clientStaff, setClientStaff] = useState<StaffOption[]>([]);
  const [agents, setAgents]           = useState<StaffOption[]>([]);
  const [userSignature, setUserSignature] = useState<string | null>(null);
  const [currentUser,   setCurrentUser]   = useState<{ id: string; firstName: string; lastName: string } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [filterType, setFilterType] = useState<ActaType | 'todas'>('todas');

  // Modal states
  const [createModal, setCreateModal]   = useState(false);
  const [createType, setCreateType]     = useState<ActaType>('inicio');
  const [editActa, setEditActa]         = useState<any>(null);
  const [printActa, setPrintActa]       = useState<any>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [typeSelector, setTypeSelector] = useState(false);
  const [showSetupSig, setShowSetupSig]       = useState(false);
  const [finalizing, setFinalizing]           = useState<string | null>(null);
  const [firmasActa, setFirmasActa]           = useState<any>(null);
  const [printLoading, setPrintLoading]       = useState<string | null>(null);
  const [company, setCompany]                 = useState<any>(null);
  const [showBranding, setShowBranding]       = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [proj, acts] = await Promise.all([
        projectsApi.get(id),
        actasApi.list(id),
      ]);
      setProject(proj);
      setActas(Array.isArray(acts) ? acts : []);
      const clientId = proj?.serviceOrder?.client?.id;
      if (clientId) {
        try {
          const staff = await clientsApi.getStaff(clientId);
          setClientStaff(Array.isArray(staff) ? staff : (staff as any).data ?? []);
        } catch { /* silencioso */ }
      }
    } catch { toast.error('Error al cargar actas'); }
    finally { setLoading(false); }
  }, [id]);

  // Carga la firma del usuario y datos de la empresa al montar
  useEffect(() => {
    usersApi.getMe().then(me => {
      setUserSignature(me.signatureData ?? null);
      setCurrentUser({ id: me.id, firstName: me.firstName, lastName: me.lastName });
    }).catch(() => {});
    companyApi.get().then(setCompany).catch(() => {});
    municipiosApi.listAll().then(setMunicipios).catch(() => {});
    usersApi.listAgents({ limit: 200 }).then(res => {
      const list = (res as any).data ?? res;
      setAgents(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-abre el selector de tipo cuando se llega desde el cronograma
  useEffect(() => {
    if (fromBloqueId) setTypeSelector(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await actasApi.remove(deleteId);
      setActas(prev => prev.filter(a => a.id !== deleteId));
      setDeleteId(null);
      toast.success('Acta eliminada');
    } catch { toast.error('Error al eliminar'); }
    finally { setDeleting(false); }
  };

  const handleFinalize = async (actaId: string) => {
    setFinalizing(actaId);
    try {
      await actasApi.finalize(actaId);
      setActas(prev => prev.map(a => a.id === actaId ? { ...a, status: 'finalizado' } : a));
      toast.success('Acta finalizada');
    } catch { toast.error('Error al finalizar'); }
    finally { setFinalizing(null); }
  };

  // Carga datos frescos antes de abrir el reporte para que las firmas sean visibles
  const handlePrint = async (actaId: string) => {
    setPrintLoading(actaId);
    try {
      const fresh = await actasApi.get(actaId);
      setPrintActa(fresh);
    } catch { toast.error('Error al cargar el acta'); }
    finally { setPrintLoading(null); }
  };

  const filtered = filterType === 'todas' ? actas : actas.filter(a => a.type === filterType);
  const modules  = project?.modules ?? [];

  const countByType = (t: ActaType) => actas.filter(a => a.type === t).length;

  if (loading && !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: '#60a5fa' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Back */}
      <button onClick={() => router.push(`/implementacion/proyectos/${id}`)}
        className="flex items-center gap-2 text-sm transition-colors"
        style={{ color: tc.m }}>
        <ArrowLeft className="w-4 h-4" /> Volver al proyecto
      </button>

      {/* Header */}
      <div style={cardStyle}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-bold text-xl" style={{ color: tc.p }}>Actas del Proyecto</h2>
            {project && (
              <p className="text-sm mt-0.5" style={{ color: tc.m }}>
                {project.name} · {project.serviceOrder?.client?.businessName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-xl" style={{ color: tc.m }}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setTypeSelector(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
              <Plus className="w-4 h-4" /> Nueva Acta
            </button>
          </div>
        </div>

        {/* Resumen por tipo */}
        <div className="flex flex-wrap gap-3 mt-4">
          {(Object.keys(TYPE_CFG) as ActaType[]).map(t => {
            const c = countByType(t);
            const cfg = TYPE_CFG[t];
            return (
              <div key={t} className="text-center px-4 py-2 rounded-xl"
                style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
                <p className="text-lg font-bold" style={{ color: cfg.color }}>{c}</p>
                <p className="text-xs" style={{ color: cfg.color, opacity: 0.8 }}>{cfg.short}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[{ k: 'todas', label: 'Todas', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
          ...Object.entries(TYPE_CFG).map(([k, v]) => ({ k, label: v.label, color: v.color, bg: v.bg }))
        ].map(({ k, label, color, bg }) => (
          <button key={k} onClick={() => setFilterType(k as any)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: filterType === k ? bg : 'transparent',
              color: filterType === k ? color : tc.m,
              border: filterType === k ? `1px solid ${color}40` : '1px solid rgba(255,255,255,0.10)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-16" style={cardStyle}>
          <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: tc.m, opacity: 0.4 }} />
          <p className="font-medium" style={{ color: tc.m }}>No hay actas {filterType !== 'todas' ? `de tipo "${TYPE_CFG[filterType as ActaType]?.label}"` : ''}</p>
          <p className="text-sm mt-1" style={{ color: tc.m, opacity: 0.6 }}>Crea una nueva acta con el botón de arriba</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(acta => {
            const cfg = TYPE_CFG[acta.type as ActaType] ?? TYPE_CFG.inicio;
            const stCfg = STATUS_CFG[acta.status] ?? STATUS_CFG.borrador;
            return (
              <motion.div key={acta.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col rounded-2xl p-4 gap-3"
                style={{ background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)` }}>

                {/* Badge + status */}
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  <span className="text-xs font-medium" style={{ color: stCfg.color }}>
                    {stCfg.label === 'Finalizado' ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <Clock className="w-3 h-3 inline mr-1" />}
                    {stCfg.label}
                  </span>
                </div>

                {/* Info */}
                <div>
                  {acta.numero && <p className="text-xs font-mono mb-1" style={{ color: tc.m }}>No. {acta.numero}</p>}
                  <p className="text-sm font-semibold" style={{ color: tc.s }}>
                    {acta.type === 'inicio' && (acta.asunto || 'Acta de inicio')}
                    {acta.type === 'visita' && `Visita ${fmtDate(acta.fecha)}`}
                    {acta.type === 'cierre' && 'Acta de cierre'}
                    {acta.type === 'capacitacion' && (acta.modulo?.name || acta.expositor || 'Capacitación')}
                    {acta.type === 'entrega_soporte' && 'Entrega a soporte'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: tc.m }}>
                    {fmtDate(acta.fecha)}{acta.ciudad && ` · ${acta.ciudad}`}
                  </p>
                </div>

                {/* Contadores */}
                <div className="flex gap-3 text-xs" style={{ color: tc.m }}>
                  {acta.firmantes?.length > 0 && <span>{acta.firmantes.length} firmante{acta.firmantes.length !== 1 ? 's' : ''}</span>}
                  {acta.compromisos?.length > 0 && <span>{acta.compromisos.length} compromiso{acta.compromisos.length !== 1 ? 's' : ''}</span>}
                  {acta.participantes?.length > 0 && <span>{acta.participantes.length} participante{acta.participantes.length !== 1 ? 's' : ''}</span>}
                </div>

                {/* Acciones */}
                {(() => {
                  const isLocked = acta.firmantes?.some((f: any) => f.signerType === 'client' && f.signedAt);
                  const isPrintLoading = printLoading === acta.id;
                  return (
                    <div className="flex items-center gap-2 mt-auto pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      {/* Ver / Imprimir — carga datos frescos */}
                      <button onClick={() => handlePrint(acta.id)} disabled={isPrintLoading}
                        title="Ver / Imprimir"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-1 justify-center"
                        style={{ background: 'rgba(96,165,250,0.08)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.15)' }}>
                        {isPrintLoading
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Printer className="w-3.5 h-3.5" />}
                        Ver
                      </button>
                      {/* Gestionar firmas — siempre accesible */}
                      {acta.firmantes?.length > 0 && (
                        <button onClick={() => setFirmasActa(acta)} title="Gestionar firmas"
                          className="p-1.5 rounded-lg"
                          style={{ background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.15)' }}>
                          <PenLine className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Finalizar */}
                      {acta.status !== 'finalizado' && (
                        <button onClick={() => handleFinalize(acta.id)} title="Finalizar acta" disabled={finalizing === acta.id}
                          className="p-1.5 rounded-lg"
                          style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }}>
                          {finalizing === acta.id
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {/* Editar (bloqueado si cliente firmó) */}
                      <button
                        onClick={isLocked ? undefined : () => setEditActa(acta)}
                        title={isLocked ? 'No editable: el cliente ya firmó' : 'Editar'}
                        className="p-1.5 rounded-lg"
                        style={{
                          background: isLocked ? 'rgba(255,255,255,0.03)' : 'rgba(251,191,36,0.08)',
                          color: isLocked ? '#475569' : '#fbbf24',
                          border: `1px solid ${isLocked ? 'rgba(255,255,255,0.06)' : 'rgba(251,191,36,0.15)'}`,
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                        }}>
                        {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setDeleteId(acta.id)} title="Eliminar"
                        className="p-1.5 rounded-lg"
                        style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.15)' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })()}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Type selector */}
      <AnimatePresence>
        {typeSelector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl p-6 w-full max-w-md shadow-2xl"
              style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.10)' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold" style={{ color: tc.p }}>Selecciona el tipo de acta</h3>
                <button onClick={() => setTypeSelector(false)} style={{ color: tc.m }}><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {(Object.entries(TYPE_CFG) as [ActaType, typeof TYPE_CFG[ActaType]][]).map(([k, v]) => (
                  <button key={k} onClick={() => { setCreateType(k); setTypeSelector(false); setCreateModal(true); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                    style={{ background: v.bg, border: `1px solid ${v.color}30` }}>
                    <FileText className="w-4 h-4 shrink-0" style={{ color: v.color }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: v.color }}>{v.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create modal */}
      {createModal && (
        <ActaModal
          mode="create"
          defaultType={createType}
          projectId={id}
          projectModules={modules}
          municipios={municipios}
          clientMunicipioId={project?.serviceOrder?.client?.municipioId}
          clientName={project?.serviceOrder?.client?.businessName}
          clientStaff={clientStaff}
          agentOptions={agents}
          userSignature={userSignature}
          currentUser={currentUser}
          onSetupSignature={() => setShowSetupSig(true)}
          onClose={() => setCreateModal(false)}
          onSaved={(newActaId) => {
            setCreateModal(false);
            if (fromBloqueId && newActaId) {
              cronogramaApi.update(fromBloqueId, { actaId: newActaId }).catch(() => {});
            }
            load();
          }}
          tc={tc}
        />
      )}

      {/* Edit modal */}
      {editActa && (
        <ActaModal
          mode="edit"
          acta={editActa}
          projectId={id}
          projectModules={modules}
          municipios={municipios}
          clientMunicipioId={project?.serviceOrder?.client?.municipioId}
          clientName={project?.serviceOrder?.client?.businessName}
          clientStaff={clientStaff}
          agentOptions={agents}
          userSignature={userSignature}
          currentUser={currentUser}
          onSetupSignature={() => setShowSetupSig(true)}
          onClose={() => setEditActa(null)}
          onSaved={() => { setEditActa(null); load(); }}
          tc={tc}
        />
      )}

      {/* Setup firma modal */}
      {showSetupSig && (
        <SetupSignatureModal
          onClose={() => setShowSetupSig(false)}
          onSaved={data => { setUserSignature(data); setShowSetupSig(false); }}
        />
      )}

      {/* Panel gestión de firmas */}
      {firmasActa && (
        <FirmantesPanel
          acta={firmasActa}
          userSignature={userSignature}
          onSetupSignature={() => setShowSetupSig(true)}
          onClose={() => setFirmasActa(null)}
          onRefresh={load}
        />
      )}

      {/* Print view — usa datos frescos cargados por handlePrint */}
      {printActa && (
        <PrintView
          acta={printActa}
          project={project}
          company={company}
          userSignature={userSignature}
          onClose={() => setPrintActa(null)}
          onConfigureBranding={() => setShowBranding(true)}
        />
      )}

      {/* Modal de configuración de branding (se abre sobre el PrintView) */}
      {showBranding && (
        <BrandingConfigModal
          company={company}
          onClose={() => setShowBranding(false)}
          onSaved={updated => { setCompany(updated); setShowBranding(false); }}
        />
      )}

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              style={{ background: '#0f1629', border: '1px solid rgba(248,113,113,0.20)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(248,113,113,0.12)' }}>
                  <Trash2 className="w-5 h-5" style={{ color: '#f87171' }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: tc.p }}>Eliminar acta</h3>
                  <p className="text-sm" style={{ color: tc.m }}>Esta acción no se puede deshacer</p>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-xl text-sm" style={{ color: tc.m }}>Cancelar</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                  {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print CSS */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #acta-print { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
