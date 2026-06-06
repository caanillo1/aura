'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { ShieldCheck, Save, ChevronDown } from 'lucide-react';
import { companyApi } from '@/lib/api';
import { BackButton } from '@/components/ui/BackButton';
import { toast } from 'sonner';
import type { Role } from '@/types';

// Mapa de permisos disponibles por categoría
const PERMISSION_GROUPS = [
  {
    group: 'Usuarios',
    permissions: [
      { key: 'users.view',       label: 'Ver usuarios'             },
      { key: 'users.create',     label: 'Crear usuarios'           },
      { key: 'users.edit',       label: 'Editar usuarios'          },
      { key: 'users.deactivate', label: 'Activar / Desactivar'     },
      { key: 'users.password',   label: 'Resetear contraseñas'     },
    ],
  },
  {
    group: 'Clientes',
    permissions: [
      { key: 'clients.view',   label: 'Ver clientes'    },
      { key: 'clients.create', label: 'Crear clientes'  },
      { key: 'clients.edit',   label: 'Editar clientes' },
      { key: 'clients.staff',  label: 'Gestionar personal del cliente' },
    ],
  },
  {
    group: 'Órdenes de Servicio',
    permissions: [
      { key: 'orders.view',   label: 'Ver órdenes'    },
      { key: 'orders.create', label: 'Crear órdenes'  },
      { key: 'orders.edit',   label: 'Editar órdenes' },
      { key: 'orders.assign', label: 'Asignar equipo' },
    ],
  },
  {
    group: 'Proyectos',
    permissions: [
      { key: 'projects.view',     label: 'Ver proyectos'          },
      { key: 'projects.edit',     label: 'Editar proyectos'       },
      { key: 'projects.progress', label: 'Actualizar avance'      },
      { key: 'activities.manage', label: 'Gestionar actividades'  },
    ],
  },
  {
    group: 'Documentos',
    permissions: [
      { key: 'documents.view',     label: 'Ver documentos'       },
      { key: 'documents.generate', label: 'Generar documentos'   },
      { key: 'documents.sign',     label: 'Firmar documentos'    },
      { key: 'evidences.upload',   label: 'Subir evidencias'     },
    ],
  },
  {
    group: 'Reportes & IA',
    permissions: [
      { key: 'reports.view',     label: 'Ver reportes'           },
      { key: 'reports.generate', label: 'Generar reportes'       },
      { key: 'ai.insights',      label: 'Acceso a análisis IA'   },
    ],
  },
  {
    group: 'Configuración',
    permissions: [
      { key: 'settings.view',  label: 'Ver configuración'     },
      { key: 'settings.edit',  label: 'Editar configuración'  },
      { key: 'roles.manage',   label: 'Gestionar roles'       },
    ],
  },
];

const ROLE_COLORS: Record<string, string> = {
  admin:                 '#f87171',
  coordinator:           '#fbbf24',
  implementer_clinical:  '#60a5fa',
  implementer_financial: '#22d3ee',
  implementer_support:   '#818cf8',
  support:               '#a78bfa',
  client:                '#34d399',
};

export default function RolesPermisosPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [roles, setRoles]         = useState<Role[]>([]);
  const [selected, setSelected]   = useState<Role | null>(null);
  const [perms, setPerms]         = useState<Set<string>>(new Set());
  const [saving, setSaving]       = useState(false);
  const [expanded, setExpanded]   = useState<string[]>(PERMISSION_GROUPS.map(g => g.group));

  useEffect(() => {
    companyApi.getRoles().then(r => {
      setRoles(r);
      if (r.length > 0) selectRole(r[0]);
    });
  }, []);

  const selectRole = (role: Role) => {
    setSelected(role);
    try {
      const parsed = role.permissions ? JSON.parse(role.permissions) : [];
      setPerms(new Set(Array.isArray(parsed) ? parsed : []));
    } catch { setPerms(new Set()); }
  };

  const togglePerm = (key: string) =>
    setPerms(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleGroup = (group: typeof PERMISSION_GROUPS[0]) => {
    const keys = group.permissions.map(p => p.key);
    const allOn = keys.every(k => perms.has(k));
    setPerms(prev => {
      const n = new Set(prev);
      allOn ? keys.forEach(k => n.delete(k)) : keys.forEach(k => n.add(k));
      return n;
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await companyApi.updateRolePermissions(selected.id, [...perms]);
      toast.success(`Permisos de "${selected.name}" actualizados`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar permisos');
    } finally { setSaving(false); }
  };

  const glass = (opacity = 0.75) => ({
    background: isLight ? `rgba(255,255,255,${opacity})` : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? `0 6px 24px rgba(30,60,120,0.14), inset 0 1px 0 rgba(255,255,255,0.98)`
      : `0 6px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.10)`,
  });

  return (
    <div className="space-y-5 max-w-5xl">
      <BackButton href="/configuracion" label="Volver a configuración" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <ShieldCheck className="w-5 h-5 text-violet-400" />
            Permisos de Roles
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Selecciona un rol y activa o desactiva sus permisos de acceso.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving || !selected}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-4">
        {/* Panel izquierdo: lista de roles */}
        <div className="rounded-2xl overflow-hidden p-2 space-y-1" style={glass(0.65)}>
          <p className="text-[10px] font-bold uppercase tracking-widest px-2 py-1.5"
            style={{ color: 'var(--text-muted)' }}>Roles del sistema</p>
          {roles.map(role => {
            const active = selected?.id === role.id;
            const color  = ROLE_COLORS[role.slug] ?? '#94a3b8';
            return (
              <button key={role.id} onClick={() => selectRole(role)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: active ? `${color}18` : 'transparent',
                  border: `1px solid ${active ? `${color}40` : 'transparent'}`,
                }}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-sm font-medium truncate"
                  style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {role.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Panel derecho: permisos */}
        {selected && (
          <motion.div key={selected.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            className="space-y-3">
            {/* Header del rol seleccionado */}
            <div className="flex items-center gap-3 rounded-2xl px-5 py-3" style={glass()}>
              <div className="w-3 h-3 rounded-full" style={{ background: ROLE_COLORS[selected.slug] ?? '#94a3b8' }} />
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{selected.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{perms.size} permisos activos</p>
              </div>
            </div>

            {/* Grupos de permisos */}
            {PERMISSION_GROUPS.map(group => {
              const keys    = group.permissions.map(p => p.key);
              const allOn   = keys.every(k => perms.has(k));
              const someOn  = keys.some(k => perms.has(k));
              const isOpen  = expanded.includes(group.group);

              return (
                <div key={group.group} className="rounded-2xl overflow-hidden" style={glass()}>
                  {/* Header del grupo */}
                  <button
                    onClick={() => setExpanded(p => p.includes(group.group) ? p.filter(g => g !== group.group) : [...p, group.group])}
                    className="w-full flex items-center justify-between px-5 py-3.5 transition-colors"
                    style={{ borderBottom: isOpen ? `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` : 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox de grupo */}
                      <button type="button" onClick={e => { e.stopPropagation(); toggleGroup(group); }}
                        className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
                        style={{
                          background: allOn ? '#6d28d9' : someOn ? 'rgba(109,40,217,0.25)' : 'transparent',
                          border: `2px solid ${allOn ? '#6d28d9' : someOn ? '#6d28d9' : 'var(--border-strong)'}`,
                        }}>
                        {allOn && <span className="text-white text-[10px]">✓</span>}
                        {someOn && !allOn && <span className="text-violet-400 text-[10px]">−</span>}
                      </button>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {group.group}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: isLight ? 'rgba(109,40,217,0.10)' : 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                        {keys.filter(k => perms.has(k)).length}/{keys.length}
                      </span>
                    </div>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </motion.div>
                  </button>

                  {/* Permisos individuales */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 py-3 grid grid-cols-2 gap-y-3 gap-x-6">
                          {group.permissions.map(p => {
                            const on = perms.has(p.key);
                            return (
                              <label key={p.key} className="flex items-center gap-3 cursor-pointer group">
                                <button type="button" onClick={() => togglePerm(p.key)}
                                  className="w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0"
                                  style={{
                                    background: on ? '#3b82f6' : 'transparent',
                                    border: `2px solid ${on ? '#3b82f6' : 'var(--border-strong)'}`,
                                  }}>
                                  {on && <span className="text-white text-[10px]">✓</span>}
                                </button>
                                <span className="text-sm transition-colors"
                                  style={{ color: on ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                  {p.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Necesario para AnimatePresence dentro de un componente que no lo importa
import { AnimatePresence } from 'framer-motion';
