'use client';
import { useState, useEffect, useMemo } from 'react';
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

type Tab = 'ahora' | 'programar';

const STATUS_CONFIG = {
  completado:  { label: 'Completado',  icon: CheckCircle2, color: '#34d399' },
  en_progreso: { label: 'En progreso', icon: Activity,     color: '#60a5fa' },
  bloqueado:   { label: 'Bloqueado',   icon: Ban,          color: '#f87171' },
};

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const HORAS = Array.from({ length: 24 }, (_, i) => ({ value: i, label: `${String(i).padStart(2, '0')}:00` }));

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
  const [schedEnabled, setSchedEnabled]         = useState(false);
  const [schedDias, setSchedDias]               = useState<number[]>([1, 2, 3, 4, 5]);
  const [schedHora, setSchedHora]               = useState(8);
  const [schedStatus, setSchedStatus]           = useState(['completado', 'en_progreso', 'bloqueado']);
  const [schedEmails, setSchedEmails]           = useState<string[]>([]);
  const [schedEmailInput, setSchedEmailInput]   = useState('');
  const [schedAsunto, setSchedAsunto]           = useState('');
  const [schedMensaje, setSchedMensaje]         = useState('');
  const [schedAgentIds, setSchedAgentIds]       = useState<string[]>([]);
  const [agentSearch, setAgentSearch]           = useState('');
  const [savingSchedule, setSavingSchedule]     = useState(false);
  const [loadingSchedule, setLoadingSchedule]   = useState(false);

  // Agents list
  const [allAgents, setAllAgents] = useState<{ id: string; firstName: string; lastName: string; jobTitle?: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    // Load agents
    usersApi.listAgents({ limit: 200 }).then(res => {
      setAllAgents(res.data.map((u: any) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, jobTitle: u.jobTitle })));
    }).catch(() => {});

    // Load schedule config
    setLoadingSchedule(true);
    projectsApi.getActivityReportSchedule()
      .then((cfg: any) => {
        if (!cfg) return;
        setSchedEnabled(cfg.enabled ?? false);
        setSchedDias(cfg.diasSemana ?? [1,2,3,4,5]);
        setSchedHora(cfg.hora ?? 8);
        setSchedStatus(cfg.status ?? ['completado','en_progreso','bloqueado']);
        setSchedEmails(cfg.destinatarios ?? []);
        setSchedAsunto(cfg.asunto ?? '');
        setSchedMensaje(cfg.mensaje ?? '');
        setSchedAgentIds(cfg.agentIds ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingSchedule(false));
  }, [open]);

  const filteredAgents = useMemo(() => {
    if (!agentSearch.trim()) return allAgents;
    const q = normalize(agentSearch);
    return allAgents.filter(a => normalize(`${a.firstName} ${a.lastName}`).includes(q));
  }, [allAgents, agentSearch]);

  if (!open) return null;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function addEmail(list: string[], setList: (v: string[]) => void, input: string, setInput: (v: string) => void) {
    const parts = input.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    if (!parts.length) return;
    setList([...new Set([...list, ...parts])]);
    setInput('');
  }

  function removeEmail(list: string[], setList: (v: string[]) => void, email: string) {
    setList(list.filter(e => e !== email));
  }

  function toggleSchedStatus(s: string) {
    setSchedStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function toggleDia(d: number) {
    setSchedDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  }

  function toggleAgent(id: string) {
    setSchedAgentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // ── Send now ─────────────────────────────────────────────────────────────────

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

  // ── Save schedule ─────────────────────────────────────────────────────────────

  async function handleSaveSchedule() {
    if (schedEnabled && !schedEmails.length) { toast.error('Agrega al menos un destinatario'); return; }
    if (schedEnabled && !schedDias.length)   { toast.error('Selecciona al menos un día'); return; }
    setSavingSchedule(true);
    try {
      await projectsApi.saveActivityReportSchedule({
        enabled:       schedEnabled,
        diasSemana:    schedDias,
        hora:          schedHora,
        minuto:        0,
        status:        schedStatus,
        destinatarios: schedEmails,
        asunto:        schedAsunto || undefined,
        mensaje:       schedMensaje || undefined,
        agentIds:      schedAgentIds.length ? schedAgentIds : undefined,
      });
      toast.success(schedEnabled ? 'Envío automático activado' : 'Envío automático desactivado');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar la configuración');
    } finally {
      setSavingSchedule(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {([['ahora', 'Enviar ahora', Send], ['programar', 'Programar', Clock]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-2 flex-1 py-3 text-sm font-medium transition-colors"
              style={tab === id
                ? { color: '#818cf8', borderBottom: '2px solid #818cf8' }
                : { color: 'var(--text-muted)' }}>
              <Icon className="w-4 h-4 mx-auto" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* ── Tab: Enviar ahora ── */}
          {tab === 'ahora' && (
            <>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Destinatarios *</label>
                <div className="flex gap-2">
                  <input type="email" placeholder="correo@ejemplo.com" value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addEmail(emails, setEmails, emailInput, setEmailInput))}
                    className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                  <button onClick={() => addEmail(emails, setEmails, emailInput, setEmailInput)}
                    className="px-3 py-2 rounded-xl transition-colors"
                    style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {emails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {emails.map(e => (
                      <span key={e} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                        style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.2)' }}>
                        {e}<button onClick={() => removeEmail(emails, setEmails, e)}><X className="w-3 h-3" /></button>
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

              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Se enviarán las actividades con los filtros activos en este momento.
              </p>

              <button onClick={handleSendNow} disabled={sending || !emails.length}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ background: '#818cf8', color: '#fff' }}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Enviando…' : 'Enviar reporte ahora'}
              </button>
            </>
          )}

          {/* ── Tab: Programar ── */}
          {tab === 'programar' && (
            loadingSchedule ? (
              <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Cargando configuración…</span>
              </div>
            ) : (
              <>
                {/* Enable toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Envío automático</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {schedEnabled ? 'Activo — se envía según el horario configurado' : 'Inactivo'}
                    </p>
                  </div>
                  <button onClick={() => setSchedEnabled(p => !p)} className="transition-colors">
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
                        className="w-10 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={schedDias.includes(i)
                          ? { background: 'rgba(129,140,248,0.15)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.4)' }
                          : { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hour */}
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Clock className="w-3.5 h-3.5 inline mr-1" />Hora de envío
                  </label>
                  <select value={schedHora} onChange={e => setSchedHora(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                    {HORAS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
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
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={active
                            ? { background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`, color: cfg.color }
                            : { background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', opacity: 0.6 }}>
                          <Icon className="w-3.5 h-3.5" />{cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Agents filter */}
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Users className="w-3.5 h-3.5 inline mr-1" />Agentes a incluir
                    <span className="ml-1 opacity-60">(vacío = todos)</span>
                  </label>

                  {/* Selected agents chips */}
                  {schedAgentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {schedAgentIds.map(id => {
                        const agent = allAgents.find(a => a.id === id);
                        if (!agent) return null;
                        return (
                          <span key={id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                            {agent.firstName} {agent.lastName}
                            <button onClick={() => toggleAgent(id)}><X className="w-3 h-3" /></button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Search + list */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      <input placeholder="Buscar agente…" value={agentSearch}
                        onChange={e => setAgentSearch(e.target.value)}
                        className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-50"
                        style={{ color: 'var(--text-primary)' }} />
                    </div>
                    <div className="max-h-36 overflow-y-auto">
                      {filteredAgents.length === 0 ? (
                        <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>Sin agentes</p>
                      ) : filteredAgents.map(agent => {
                        const selected = schedAgentIds.includes(agent.id);
                        return (
                          <button key={agent.id} onClick={() => toggleAgent(agent.id)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-white/5"
                            style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <div className="text-left">
                              <span style={{ color: 'var(--text-primary)', fontWeight: selected ? 600 : 400 }}>
                                {agent.firstName} {agent.lastName}
                              </span>
                              {agent.jobTitle && (
                                <span className="block opacity-50" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{agent.jobTitle}</span>
                              )}
                            </div>
                            <div className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                              style={selected
                                ? { background: '#34d399', border: '1px solid #34d399' }
                                : { border: '1px solid var(--border-subtle)' }}>
                              {selected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Recipients */}
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Destinatarios del correo</label>
                  <div className="flex gap-2">
                    <input type="email" placeholder="correo@ejemplo.com"
                      value={schedEmailInput} onChange={e => setSchedEmailInput(e.target.value)}
                      onKeyDown={e => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addEmail(schedEmails, setSchedEmails, schedEmailInput, setSchedEmailInput))}
                      className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                    <button onClick={() => addEmail(schedEmails, setSchedEmails, schedEmailInput, setSchedEmailInput)}
                      className="px-3 py-2 rounded-xl transition-colors"
                      style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {schedEmails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {schedEmails.map(e => (
                        <span key={e} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                          style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.2)' }}>
                          {e}<button onClick={() => removeEmail(schedEmails, setSchedEmails, e)}><Trash2 className="w-3 h-3" /></button>
                        </span>
                      ))}
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
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
