'use client';
import { useState, useEffect } from 'react';
import {
  X, Send, Clock, Mail, Calendar, ToggleLeft, ToggleRight,
  CheckCircle2, Activity, Ban, Loader2, Plus, Trash2, Users, Search,
} from 'lucide-react';
import { projectsApi, usersApi } from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  activeFilters: {
    status: string[];
    clientId: string | null;
    dateFrom: string;
    dateTo: string;
  };
}

interface RecipientConfig {
  email: string;
  agentIds: string[];
}

type Tab = 'ahora' | 'programar';

const STATUS_CONFIG = {
  completado:  { label: 'Completado',  icon: CheckCircle2, color: '#34d399' },
  en_progreso: { label: 'En progreso', icon: Activity,     color: '#60a5fa' },
  bloqueado:   { label: 'Bloqueado',   icon: Ban,          color: '#f87171' },
};

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function AutomationModal({ open, onClose, activeFilters }: Props) {
  const [tab, setTab] = useState<Tab>('ahora');

  // Envío ahora
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails]         = useState<string[]>([]);
  const [subject, setSubject]       = useState('');
  const [message, setMessage]       = useState('');
  const [sending, setSending]       = useState(false);

  // Programar
  const [schedEnabled, setSchedEnabled]             = useState(false);
  const [schedDias, setSchedDias]                   = useState<number[]>([1, 2, 3, 4, 5]);
  const [schedTime, setSchedTime]                   = useState('08:00');
  const [schedStatus, setSchedStatus]               = useState(['completado', 'en_progreso', 'bloqueado']);
  const [schedDestinatarios, setSchedDestinatarios] = useState<RecipientConfig[]>([]);
  const [schedEmailInput, setSchedEmailInput]       = useState('');
  const [schedAsunto, setSchedAsunto]               = useState('');
  const [schedMensaje, setSchedMensaje]             = useState('');
  const [savingSchedule, setSavingSchedule]         = useState(false);
  const [loadingSchedule, setLoadingSchedule]       = useState(false);

  // Pending agent selection (for next recipient to add)
  const [pendingAgentIds, setPendingAgentIds] = useState<string[]>([]);
  const [agentSearch, setAgentSearch]         = useState('');
  const [loadingAgents, setLoadingAgents]     = useState(false);
  const [allAgents, setAllAgents]             = useState<{ id: string; firstName: string; lastName: string; jobTitle?: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoadingAgents(true);
    usersApi.listAgents({ limit: 200 }).then(res => {
      const list: any[] = Array.isArray(res) ? res : ((res as any).data ?? []);
      setAllAgents(list.map((u: any) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, jobTitle: u.jobTitle })));
    }).catch(() => {}).finally(() => setLoadingAgents(false));

    setLoadingSchedule(true);
    projectsApi.getActivityReportSchedule()
      .then((cfg: any) => {
        if (!cfg) return;
        setSchedEnabled(cfg.enabled ?? false);
        setSchedDias(cfg.diasSemana ?? [1, 2, 3, 4, 5]);
        const h = String(cfg.hora ?? 8).padStart(2, '0');
        const m = String(cfg.minuto ?? 0).padStart(2, '0');
        setSchedTime(`${h}:${m}`);
        setSchedStatus(cfg.status ?? ['completado', 'en_progreso', 'bloqueado']);
        setSchedAsunto(cfg.asunto ?? '');
        setSchedMensaje(cfg.mensaje ?? '');
        if (Array.isArray(cfg.destinatarios)) {
          setSchedDestinatarios(cfg.destinatarios.map((d: any) =>
            typeof d === 'string'
              ? { email: d, agentIds: [] }
              : { email: d.email, agentIds: d.agentIds ?? [] }
          ));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSchedule(false));
  }, [open]);

  if (!open) return null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function addEmailNow() {
    const parts = emailInput.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    if (!parts.length) return;
    setEmails(prev => [...new Set([...prev, ...parts])]);
    setEmailInput('');
  }

  function addRecipient() {
    const parts = schedEmailInput.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    if (!parts.length) return;
    const existing = new Set(schedDestinatarios.map(d => d.email));
    const newOnes  = parts.filter(e => !existing.has(e)).map(email => ({ email, agentIds: [...pendingAgentIds] }));
    if (!newOnes.length) return;
    setSchedDestinatarios(prev => [...prev, ...newOnes]);
    setSchedEmailInput('');
    // Keep pendingAgentIds so user can quickly add more emails with same agents
  }

  function removeRecipient(idx: number) {
    setSchedDestinatarios(prev => prev.filter((_, i) => i !== idx));
  }

  function togglePendingAgent(id: string) {
    setPendingAgentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleDia(d: number) {
    setSchedDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  }

  function toggleSchedStatus(s: string) {
    setSchedStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  const filteredAgents = agentSearch.trim()
    ? allAgents.filter(a => normalize(`${a.firstName} ${a.lastName}`).includes(normalize(agentSearch)))
    : allAgents;

  // ── Send now ──────────────────────────────────────────────────────────────

  async function handleSendNow() {
    if (!emails.length) { toast.error('Agrega al menos un destinatario'); return; }
    setSending(true);
    try {
      const res = await projectsApi.sendActivityReport({
        emails,
        subject:  subject || undefined,
        message:  message || undefined,
        status:   activeFilters.status.length ? activeFilters.status : undefined,
        clientId: activeFilters.clientId || undefined,
        dateFrom: activeFilters.dateFrom || undefined,
        dateTo:   activeFilters.dateTo   || undefined,
      });
      toast.success(`Reporte enviado a ${res.destinatarios} destinatario${res.destinatarios !== 1 ? 's' : ''} · ${res.enviados} actividades`);
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al enviar el reporte');
    } finally {
      setSending(false);
    }
  }

  // ── Save schedule ─────────────────────────────────────────────────────────

  async function handleSaveSchedule() {
    if (schedEnabled && !schedDestinatarios.length) { toast.error('Agrega al menos un destinatario'); return; }
    if (schedEnabled && !schedDias.length)          { toast.error('Selecciona al menos un día'); return; }
    const [horaStr, minStr] = schedTime.split(':');
    const hora   = parseInt(horaStr  ?? '8', 10);
    const minuto = parseInt(minStr   ?? '0', 10);
    setSavingSchedule(true);
    try {
      await projectsApi.saveActivityReportSchedule({
        enabled:       schedEnabled,
        diasSemana:    schedDias,
        hora,
        minuto,
        status:        schedStatus,
        destinatarios: schedDestinatarios.map(d => ({
          email:    d.email,
          agentIds: d.agentIds.length ? d.agentIds : undefined,
        })),
        asunto:  schedAsunto || undefined,
        mensaje: schedMensaje || undefined,
      });
      toast.success(schedEnabled ? 'Envío automático activado' : 'Envío automático desactivado');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar la configuración');
    } finally {
      setSavingSchedule(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5" style={{ color: '#818cf8' }} />
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Automatización de correo</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {([['ahora', 'Enviar ahora', Send], ['programar', 'Programar', Clock]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-2 flex-1 py-3 text-sm font-medium justify-center"
              style={tab === id
                ? { color: '#818cf8', borderBottom: '2px solid #818cf8' }
                : { color: 'var(--text-muted)' }}>
              <Icon className="w-4 h-4" /><span>{label}</span>
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* ── Enviar ahora ── */}
          {tab === 'ahora' && (
            <>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Destinatarios *</label>
                <div className="flex gap-2">
                  <input type="email" placeholder="correo@ejemplo.com" value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addEmailNow())}
                    className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                  <button onClick={addEmailNow}
                    className="px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {emails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {emails.map(e => (
                      <span key={e} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                        style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.2)' }}>
                        {e}<button onClick={() => setEmails(prev => prev.filter(x => x !== e))}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Asunto (opcional)</label>
                <input type="text" placeholder="Reporte Actividades Realizadas – hoy"
                  value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Mensaje adicional (opcional)</label>
                <textarea rows={3} placeholder="Escribe un mensaje introductorio…"
                  value={message} onChange={e => setMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Se enviarán las actividades con los filtros activos en este momento.</p>
              <button onClick={handleSendNow} disabled={sending || !emails.length}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: '#818cf8', color: '#fff' }}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Enviando…' : 'Enviar reporte ahora'}
              </button>
            </>
          )}

          {/* ── Programar ── */}
          {tab === 'programar' && (
            loadingSchedule ? (
              <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Cargando configuración…</span>
              </div>
            ) : (
              <>
                {/* Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Envío automático</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {schedEnabled ? 'Activo — se envía según el horario configurado' : 'Inactivo'}
                    </p>
                  </div>
                  <button onClick={() => setSchedEnabled(p => !p)}>
                    {schedEnabled
                      ? <ToggleRight className="w-8 h-8" style={{ color: '#818cf8' }} />
                      : <ToggleLeft  className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />}
                  </button>
                </div>

                {/* Days */}
                <div>
                  <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />Días de envío
                    <span className="ml-2 opacity-60">(Sáb = informe semanal)</span>
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DIAS.map((d, i) => (
                      <button key={i} onClick={() => toggleDia(i)}
                        className="w-10 py-1.5 rounded-lg text-xs font-semibold"
                        style={schedDias.includes(i)
                          ? { background: 'rgba(129,140,248,0.15)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.4)' }
                          : { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hour — free input */}
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Clock className="w-3.5 h-3.5 inline mr-1" />Hora de envío
                  </label>
                  <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-muted)' }}>Estados a incluir</label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      const active = schedStatus.includes(key);
                      return (
                        <button key={key} onClick={() => toggleSchedStatus(key)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={active
                            ? { background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`, color: cfg.color }
                            : { background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', opacity: 0.6 }}>
                          <Icon className="w-3.5 h-3.5" />{cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Destinatarios: agents first, then email ── */}
                <div className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--border-subtle)' }}>

                  {/* Step 1 — Select agents */}
                  <div className="px-3 pt-3 pb-2"
                    style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Paso 1 — Selecciona los agentes
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {pendingAgentIds.length > 0 && (
                          <button onClick={() => setPendingAgentIds([])}
                            className="text-[10px] hover:opacity-70"
                            style={{ color: 'var(--text-muted)' }}>
                            Limpiar
                          </button>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={pendingAgentIds.length > 0
                            ? { background: 'rgba(129,140,248,0.15)', color: '#818cf8' }
                            : { background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                          {pendingAgentIds.length === 0 ? 'Todos' : `${pendingAgentIds.length} seleccionados`}
                        </span>
                      </div>
                    </div>

                    {/* Search */}
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1.5"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)' }}>
                      <Search className="w-3 h-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      <input placeholder="Buscar agente…" value={agentSearch}
                        onChange={e => setAgentSearch(e.target.value)}
                        className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
                        style={{ color: 'var(--text-primary)' }} />
                    </div>

                    {/* Agent list */}
                    <div className="max-h-36 overflow-y-auto rounded-lg"
                      style={{ border: '1px solid var(--border-subtle)' }}>
                      {loadingAgents ? (
                        <div className="flex items-center justify-center gap-2 py-4">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Cargando agentes…</span>
                        </div>
                      ) : filteredAgents.length === 0 ? (
                        <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                          {allAgents.length === 0 ? 'No hay agentes disponibles' : 'Sin coincidencias'}
                        </p>
                      ) : filteredAgents.map(agent => {
                        const selected = pendingAgentIds.includes(agent.id);
                        return (
                          <button key={agent.id} onClick={() => togglePendingAgent(agent.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-white/5 text-left"
                            style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
                              style={selected
                                ? { background: '#818cf8', border: '1px solid #818cf8' }
                                : { border: '1px solid var(--border-subtle)' }}>
                              {selected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span style={{ color: 'var(--text-primary)', fontWeight: selected ? 600 : 400 }}>
                                {agent.firstName} {agent.lastName}
                              </span>
                              {agent.jobTitle && (
                                <span className="block truncate" style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.6 }}>
                                  {agent.jobTitle}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2 — Add email */}
                  <div className="px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                    <span className="text-xs font-semibold block mb-2" style={{ color: 'var(--text-primary)' }}>
                      Paso 2 — Agrega el correo destino
                    </span>
                    <div className="flex gap-2">
                      <input type="email" placeholder="correo@ejemplo.com"
                        value={schedEmailInput} onChange={e => setSchedEmailInput(e.target.value)}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addRecipient())}
                        className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                      <button onClick={addRecipient}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0"
                        style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }}>
                        <Plus className="w-3.5 h-3.5" />
                        {pendingAgentIds.length > 0 ? `Agregar · ${pendingAgentIds.length} agente${pendingAgentIds.length !== 1 ? 's' : ''}` : 'Agregar · Todos'}
                      </button>
                    </div>
                  </div>

                  {/* Added recipients list */}
                  {schedDestinatarios.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      {schedDestinatarios.map((r, idx) => {
                        const agentNames = r.agentIds.length
                          ? r.agentIds.map(id => allAgents.find(a => a.id === id)).filter(Boolean).map(a => `${a!.firstName} ${a!.lastName}`).join(', ')
                          : null;
                        return (
                          <div key={idx} className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-white/3"
                            style={{ borderBottom: idx < schedDestinatarios.length - 1 ? '1px solid var(--border-subtle)' : undefined }}>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.email}</p>
                              <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                                {agentNames ?? 'Todos los agentes'}
                              </p>
                            </div>
                            <button onClick={() => removeRecipient(idx)} className="p-1 rounded-lg hover:bg-white/5 shrink-0 mt-0.5">
                              <Trash2 className="w-3.5 h-3.5" style={{ color: '#f87171' }} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Subject / message */}
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Asunto del correo (opcional)</label>
                  <input type="text" placeholder="Reporte diario de actividades"
                    value={schedAsunto} onChange={e => setSchedAsunto(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Mensaje introductorio (opcional)</label>
                  <textarea rows={2} placeholder="Este reporte es generado automáticamente por AURA."
                    value={schedMensaje} onChange={e => setSchedMensaje(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                </div>

                <button onClick={handleSaveSchedule} disabled={savingSchedule}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: '#818cf8', color: '#fff' }}>
                  {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  {savingSchedule ? 'Guardando…' : 'Guardar configuración'}
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
