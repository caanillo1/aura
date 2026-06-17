'use client';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { usePermission } from '@/hooks/usePermission';
import {
  Settings2, Users, Building2, Briefcase, FolderOpen,
  Loader2, Edit2, Check, X, Eye, EyeOff,
} from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { companyApi } from '@/lib/api';
import { toast } from 'sonner';
import type { CompanyStats, SystemConfig } from '@/types';

// Configs predefinidas con descripción legible
const PREDEFINED: { key: string; label: string; description: string; placeholder: string; secret?: boolean; badge?: string; options?: { value: string; label: string; color: string }[] }[] = [
  { key: 'proveedor_correo', label: 'Proveedor de correo', description: 'Selecciona qué servicio usa AURA para enviar correos. Resend requiere API Key; SMTP requiere datos en Datos de la Empresa.', placeholder: 'resend', badge: 'Correo',
    options: [
      { value: 'resend', label: 'Resend',  color: '#34d399' },
      { value: 'smtp',   label: 'SMTP',    color: '#60a5fa' },
    ],
  },
  { key: 'resend_api_key',       label: 'Resend API Key',              description: 'API Key de resend.com para envío de correos. Crea cuenta gratis en resend.com', placeholder: 're_xxxxxxxxxxxx', secret: true, badge: 'Correo' },
  { key: 'resend_from_email',    label: 'Email remitente (Resend)',     description: 'Dirección "De:" para correos enviados con Resend. Usa onboarding@resend.dev si no tienes dominio verificado', placeholder: 'noreply@tuempresa.com', badge: 'Correo' },
  { key: 'files_base_path',      label: 'Ruta base de archivos',       description: 'Directorio raíz para almacenamiento de documentos',  placeholder: 'C:/aura/files' },
  { key: 'max_file_size_mb',     label: 'Tamaño máximo de archivo',    description: 'Límite en MB para carga de documentos',              placeholder: '10' },
  { key: 'session_timeout_min',  label: 'Tiempo de sesión (minutos)',  description: 'Minutos de inactividad antes de cerrar sesión',      placeholder: '60' },
  { key: 'max_login_attempts',   label: 'Intentos máximos de login',   description: 'Bloqueo temporal tras N intentos fallidos',          placeholder: '5' },
  { key: 'pagination_limit',     label: 'Registros por página',        description: 'Límite por defecto en listados paginados',           placeholder: '20' },
  { key: 'support_email',        label: 'Email de soporte',            description: 'Correo que recibe incidencias internas',             placeholder: 'soporte@empresa.com' },
  { key: 'maintenance_mode',     label: 'Modo mantenimiento',          description: 'Activar para bloquear acceso no-admin (true/false)', placeholder: 'false' },
];

const STAT_CARDS = [
  { label: 'Usuarios activos',     key: 'users'          as const, icon: Users,     color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  { label: 'Clientes registrados', key: 'clients'        as const, icon: Building2, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { label: 'Órdenes de servicio',  key: 'serviceOrders'  as const, icon: Briefcase, color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  { label: 'Proyectos activos',    key: 'activeProjects' as const, icon: FolderOpen, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
];

export default function ParametrosPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can } = usePermission();
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState<CompanyStats | null>(null);
  const [configs, setConfigs]   = useState<SystemConfig[]>([]);
  const [editing, setEditing]   = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<Record<string, boolean>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  const glass = {
    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  };

  useEffect(() => {
    Promise.all([
      companyApi.getStats(),
      companyApi.getConfigs(),
    ]).then(([s, c]) => {
      setStats(s as CompanyStats);
      setConfigs(c as SystemConfig[]);
    }).catch(() => toast.error('Error al cargar parámetros'))
      .finally(() => setLoading(false));
  }, []);

  const getValue = (key: string) => {
    const cfg = configs.find(c => c.configKey === key);
    return cfg?.configValue ?? '';
  };

  const startEdit = (key: string) => {
    const cfg = PREDEFINED.find(p => p.key === key);
    const current = getValue(key);
    // Para campos con opciones, si no hay valor guardado usar la primera opción como default
    const initial = (!current && cfg?.options) ? cfg.options[0].value : current;
    setEditing(p => ({ ...p, [key]: initial }));
  };

  const cancelEdit = (key: string) => {
    setEditing(p => { const n = { ...p }; delete n[key]; return n; });
  };

  const saveConfig = async (key: string) => {
    const value = editing[key] ?? '';
    setSaving(p => ({ ...p, [key]: true }));
    try {
      await companyApi.upsertConfig(key, value);
      setConfigs(prev => {
        const exists = prev.find(c => c.configKey === key);
        if (exists) return prev.map(c => c.configKey === key ? { ...c, configValue: value } : c);
        return [...prev, { configKey: key, configValue: value, updatedAt: new Date().toISOString() }];
      });
      cancelEdit(key);
      toast.success('Parámetro guardado');
    } catch {
      toast.error('Error al guardar parámetro');
    } finally {
      setSaving(p => { const n = { ...p }; delete n[key]; return n; });
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#60a5fa' }} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <BackButton href="/configuracion" label="Configuración" />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}>
          <Settings2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="font-bold text-xl" style={{ color: tc.p }}>Parámetros del Sistema</h2>
          <p className="text-sm" style={{ color: tc.m }}>Estadísticas del sistema y configuraciones clave-valor.</p>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STAT_CARDS.map((sc, i) => {
            const Icon = sc.icon;
            return (
              <motion.div key={sc.key}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl p-4 text-center" style={glass}>
                <div className="w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center"
                  style={{ background: sc.bg }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: sc.color, width: 18, height: 18 }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: sc.color }}>{stats[sc.key]}</p>
                <p className="text-[11px] mt-0.5 leading-tight" style={{ color: tc.m }}>{sc.label}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Configuraciones ───────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden" style={glass}>

        <div className="px-5 py-3.5 border-b" style={{ borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tc.m }}>
            Parámetros configurables
          </p>
        </div>

        <div className="divide-y" style={{ borderColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)' }}>
          {PREDEFINED.map(cfg => {
            const isEditing  = cfg.key in editing;
            const isSaving   = saving[cfg.key];
            const current    = getValue(cfg.key);
            const isRevealed = showSecret[cfg.key];

            return (
              <div key={cfg.key} className="px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium" style={{ color: tc.p }}>{cfg.label}</p>
                    {cfg.badge && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                        {cfg.badge}
                      </span>
                    )}
                    {cfg.key === 'resend_api_key' && current && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                        ✓ Activo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: tc.m }}>{cfg.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isEditing ? (
                    cfg.options ? (
                      /* Campo de selección con chips */
                      <>
                        <div className="flex gap-1.5">
                          {cfg.options.map(opt => {
                            const sel = editing[cfg.key] === opt.value;
                            return (
                              <button key={opt.value} type="button"
                                onClick={() => setEditing(p => ({ ...p, [cfg.key]: opt.value }))}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                style={{
                                  background: sel ? `${opt.color}20` : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'),
                                  color:  sel ? opt.color : tc.m,
                                  border: `1px solid ${sel ? opt.color + '60' : 'transparent'}`,
                                }}>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        <button onClick={() => saveConfig(cfg.key)} disabled={isSaving}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => cancelEdit(cfg.key)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171' }}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      /* Campo de texto libre */
                      <>
                        <input
                          className="input-glass rounded-lg px-2.5 py-1.5 text-sm w-44"
                          type={cfg.secret && !isRevealed ? 'password' : 'text'}
                          value={editing[cfg.key]}
                          onChange={e => setEditing(p => ({ ...p, [cfg.key]: e.target.value }))}
                          placeholder={cfg.placeholder}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') saveConfig(cfg.key); if (e.key === 'Escape') cancelEdit(cfg.key); }}
                        />
                        {cfg.secret && (
                          <button onClick={() => setShowSecret(p => ({ ...p, [cfg.key]: !p[cfg.key] }))}
                            className="p-1.5 rounded-lg" style={{ color: tc.m }}>
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button onClick={() => saveConfig(cfg.key)} disabled={isSaving}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => cancelEdit(cfg.key)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171' }}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )
                  ) : (
                    <>
                      {cfg.options ? (
                        /* Mostrar chip coloreado según la opción activa */
                        (() => {
                          const opt = cfg.options!.find(o => o.value === (current || cfg.placeholder));
                          return opt ? (
                            <span className="text-xs font-bold px-3 py-1 rounded-lg"
                              style={{ background: `${opt.color}18`, color: opt.color, border: `1px solid ${opt.color}40` }}>
                              {opt.label}
                            </span>
                          ) : (
                            <span className="text-sm font-mono px-2.5 py-1 rounded-lg" style={{ color: tc.m, opacity: 0.5 }}>—</span>
                          );
                        })()
                      ) : (
                        <span className="text-sm font-mono px-2.5 py-1 rounded-lg"
                          style={{
                            background: current ? (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)') : 'transparent',
                            color: current ? tc.p : tc.m,
                          }}>
                          {current
                            ? (cfg.secret ? '••••••••••••' : current)
                            : <span style={{ opacity: 0.5 }}>—</span>}
                        </span>
                      )}
                      {can('settings.editar') && (
                        <button onClick={() => startEdit(cfg.key)}
                          className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                          style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa' }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Configs adicionales de la BD (si hay más que las predefinidas) */}
      {(() => {
        const extra = configs.filter(c => !PREDEFINED.find(p => p.key === c.configKey));
        if (extra.length === 0) return null;
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl overflow-hidden" style={glass}>
            <div className="px-5 py-3.5 border-b" style={{ borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)' }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tc.m }}>
                Parámetros adicionales ({extra.length})
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)' }}>
              {extra.map(cfg => {
                const isEditing = cfg.configKey in editing;
                const isSaving  = saving[cfg.configKey];
                return (
                  <div key={cfg.configKey} className="px-5 py-3.5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono" style={{ color: tc.p }}>{cfg.configKey}</p>
                      {cfg.description && <p className="text-[11px] mt-0.5" style={{ color: tc.m }}>{cfg.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isEditing ? (
                        <>
                          <input className="input-glass rounded-lg px-2.5 py-1.5 text-sm w-44"
                            value={editing[cfg.configKey]}
                            onChange={e => setEditing(p => ({ ...p, [cfg.configKey]: e.target.value }))}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') saveConfig(cfg.configKey); if (e.key === 'Escape') cancelEdit(cfg.configKey); }} />
                          <button onClick={() => saveConfig(cfg.configKey)} disabled={isSaving}
                            className="p-1.5 rounded-lg" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => cancelEdit(cfg.configKey)}
                            className="p-1.5 rounded-lg" style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171' }}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-mono px-2.5 py-1 rounded-lg"
                            style={{ background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)', color: tc.p }}>
                            {cfg.configValue || '—'}
                          </span>
                          {can('settings.editar') && (
                            <button onClick={() => startEdit(cfg.configKey)}
                              className="p-1.5 rounded-lg" style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa' }}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })()}
    </div>
  );
}
