'use client';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { ShieldCheck, Save, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { companyApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { BackButton } from '@/components/ui/BackButton';
import { toast } from 'sonner';
import type { Role } from '@/types';

const PERMISSION_GROUPS = [
  {
    group: 'Usuarios',
    permissions: [
      { key: 'users.buscar',     label: 'Buscar / Ver usuarios'    },
      { key: 'users.nuevo',      label: 'Crear nuevo usuario'      },
      { key: 'users.editar',     label: 'Editar usuarios'          },
      { key: 'users.eliminar',   label: 'Eliminar usuarios'        },
      { key: 'users.desactivar', label: 'Activar / Desactivar'     },
      { key: 'users.password',   label: 'Resetear contraseñas'     },
    ],
  },
  {
    group: 'Clientes',
    permissions: [
      { key: 'clients.buscar',   label: 'Buscar / Ver clientes'           },
      { key: 'clients.nuevo',    label: 'Crear nuevo cliente'             },
      { key: 'clients.editar',   label: 'Editar clientes'                 },
      { key: 'clients.eliminar', label: 'Eliminar clientes'               },
      { key: 'clients.importar', label: 'Importar clientes desde Excel'   },
      { key: 'clients.staff',    label: 'Gestionar personal del cliente'  },
    ],
  },
  {
    group: 'Órdenes de Servicio',
    permissions: [
      { key: 'orders.buscar',   label: 'Buscar / Ver órdenes'  },
      { key: 'orders.nuevo',    label: 'Crear nueva orden'     },
      { key: 'orders.editar',   label: 'Editar órdenes'        },
      { key: 'orders.eliminar', label: 'Eliminar órdenes'      },
      { key: 'orders.asignar',  label: 'Asignar equipo'        },
    ],
  },
  {
    group: 'Tickets / Requerimientos',
    permissions: [
      { key: 'tickets.buscar',    label: 'Buscar / Ver tickets'     },
      { key: 'tickets.nuevo',     label: 'Crear nuevo ticket'       },
      { key: 'tickets.editar',    label: 'Editar tickets'           },
      { key: 'tickets.eliminar',  label: 'Eliminar tickets'         },
      { key: 'tickets.priorizar', label: 'Priorizar por Excel'      },
      { key: 'tickets.gestionar', label: 'Registrar gestión'        },
    ],
  },
  {
    group: 'Proyectos',
    permissions: [
      { key: 'projects.buscar',    label: 'Buscar / Ver proyectos'  },
      { key: 'projects.editar',    label: 'Editar proyectos'        },
      { key: 'projects.avance',    label: 'Actualizar avance'       },
      { key: 'activities.manage',  label: 'Gestionar actividades'   },
    ],
  },
  {
    group: 'Documentos',
    permissions: [
      { key: 'documents.buscar',    label: 'Buscar / Ver documentos' },
      { key: 'documents.generate',  label: 'Generar documentos'      },
      { key: 'documents.sign',      label: 'Firmar documentos'       },
      { key: 'evidences.importar',  label: 'Subir evidencias'        },
    ],
  },
  {
    group: 'Reportes & IA',
    permissions: [
      { key: 'reports.buscar',   label: 'Buscar / Ver reportes'  },
      { key: 'reports.generate', label: 'Generar reportes'       },
      { key: 'ai.insights',      label: 'Acceso a análisis IA'   },
    ],
  },
  {
    group: 'Configuración',
    permissions: [
      { key: 'settings.buscar',  label: 'Ver configuración'    },
      { key: 'settings.editar',  label: 'Editar configuración' },
      { key: 'roles.manage',     label: 'Gestionar roles'      },
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

const getColor = (slug: string) => ROLE_COLORS[slug] ?? '#94a3b8';

function parsePerms(raw?: string | null): string[] {
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export default function RolesPermisosPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can } = usePermission();

  const [roles, setRoles]       = useState<Role[]>([]);
  const [selected, setSelected] = useState<Role | null>(null);
  const [perms, setPerms]       = useState<Set<string>>(new Set());
  const [saving, setSaving]     = useState(false);
  const [expanded, setExpanded] = useState<string[]>(PERMISSION_GROUPS.map(g => g.group));

  // Modal crear rol
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState('');
  const [newDesc, setNewDesc]       = useState('');
  const [creating, setCreating]     = useState(false);

  // Confirmación eliminar
  const [toDelete, setToDelete] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    companyApi.getRoles().then(r => {
      setRoles(r);
      if (r.length > 0) selectRole(r[0]);
    });
  }, []);

  const selectRole = (role: Role) => {
    setSelected(role);
    setPerms(new Set(parsePerms(role.permissions)));
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
      const updated = await companyApi.updateRolePermissions(selected.id, Array.from(perms));
      // Actualizar el estado local con los permisos guardados
      setRoles(prev => prev.map(r => r.id === updated.id ? { ...r, permissions: updated.permissions } : r));
      setSelected(prev => prev ? { ...prev, permissions: updated.permissions } : prev);
      toast.success(`Permisos de "${selected.name}" actualizados`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar permisos');
    } finally { setSaving(false); }
  };

  const handleCreateRole = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const role = await companyApi.createRole(newName.trim(), newDesc.trim() || undefined);
      setRoles(prev => [...prev, role]);
      setShowCreate(false);
      setNewName(''); setNewDesc('');
      selectRole(role);
      toast.success(`Rol "${role.name}" creado`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al crear rol');
    } finally { setCreating(false); }
  };

  const handleDeleteRole = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await companyApi.deleteRole(toDelete.id);
      const remaining = roles.filter(r => r.id !== toDelete.id);
      setRoles(remaining);
      setToDelete(null);
      if (selected?.id === toDelete.id) {
        if (remaining.length > 0) selectRole(remaining[0]);
        else { setSelected(null); setPerms(new Set()); }
      }
      toast.success(`Rol "${toDelete.name}" eliminado`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al eliminar rol');
    } finally { setDeleting(false); }
  };

  const glass = (opacity = 0.75) => ({
    background: isLight ? `rgba(255,255,255,${opacity})` : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? '0 6px 24px rgba(30,60,120,0.14), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 6px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.10)',
  });

  const isAdmin = selected?.slug === 'admin';

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
        {can('roles.manage') && (
          <button onClick={handleSave} disabled={saving || !selected || isAdmin}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-4">
        {/* Panel izquierdo: lista de roles */}
        <div className="rounded-2xl overflow-hidden p-2 space-y-1" style={glass(0.65)}>
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Roles del sistema
            </p>
            {can('roles.manage') && (
              <button onClick={() => setShowCreate(true)}
                className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-violet-500/20"
                title="Crear rol">
                <Plus className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
              </button>
            )}
          </div>

          {roles.map(role => {
            const active = selected?.id === role.id;
            const color  = getColor(role.slug);
            return (
              <div key={role.id} className="flex items-center gap-1 group">
                <button onClick={() => selectRole(role)}
                  className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
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
                {!role.isSystem && can('roles.manage') && (
                  <button onClick={() => setToDelete(role)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/15"
                    title="Eliminar rol">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Panel derecho: permisos */}
        {selected && (
          <motion.div key={selected.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            className="space-y-3">
            {/* Header del rol seleccionado */}
            <div className="flex items-center gap-3 rounded-2xl px-5 py-3" style={glass()}>
              <div className="w-3 h-3 rounded-full" style={{ background: getColor(selected.slug) }} />
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{selected.name}</p>
                {isAdmin
                  ? <p className="text-xs" style={{ color: '#a78bfa' }}>El administrador tiene acceso total sin restricciones</p>
                  : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{perms.size} permisos activos</p>
                }
              </div>
              {isAdmin && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                  Acceso total
                </span>
              )}
            </div>

            {/* Grupos de permisos */}
            {PERMISSION_GROUPS.map(group => {
              const keys   = group.permissions.map(p => p.key);
              const allOn  = isAdmin || keys.every(k => perms.has(k));
              const someOn = isAdmin || keys.some(k => perms.has(k));
              const isOpen = expanded.includes(group.group);

              return (
                <div key={group.group} className="rounded-2xl overflow-hidden" style={glass()}>
                  <button
                    onClick={() => setExpanded(p => p.includes(group.group) ? p.filter(g => g !== group.group) : [...p, group.group])}
                    className="w-full flex items-center justify-between px-5 py-3.5 transition-colors"
                    style={{ borderBottom: isOpen ? `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` : 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <button type="button"
                        onClick={e => { e.stopPropagation(); if (!isAdmin) toggleGroup(group); }}
                        disabled={isAdmin}
                        className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
                        style={{
                          background: allOn ? '#6d28d9' : someOn ? 'rgba(109,40,217,0.25)' : 'transparent',
                          border: `2px solid ${allOn ? '#6d28d9' : someOn ? '#6d28d9' : 'var(--border-strong)'}`,
                          cursor: isAdmin ? 'not-allowed' : 'pointer',
                        }}>
                        {allOn && <span className="text-white text-[10px]">✓</span>}
                        {someOn && !allOn && <span className="text-violet-400 text-[10px]">−</span>}
                      </button>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {group.group}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: isLight ? 'rgba(109,40,217,0.10)' : 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                        {isAdmin ? `${keys.length}/${keys.length}` : `${keys.filter(k => perms.has(k)).length}/${keys.length}`}
                      </span>
                    </div>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </motion.div>
                  </button>

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
                            const on = isAdmin || perms.has(p.key);
                            return (
                              <label key={p.key} className="flex items-center gap-3 cursor-pointer group">
                                <button type="button" onClick={() => { if (!isAdmin) togglePerm(p.key); }}
                                  disabled={isAdmin}
                                  className="w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0"
                                  style={{
                                    background: on ? '#3b82f6' : 'transparent',
                                    border: `2px solid ${on ? '#3b82f6' : 'var(--border-strong)'}`,
                                    cursor: isAdmin ? 'not-allowed' : 'pointer',
                                    opacity: isAdmin ? 0.7 : 1,
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

      {/* Modal: Crear rol */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl p-6 space-y-4"
              style={glass(0.95)}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Crear nuevo rol</h3>
                <button onClick={() => setShowCreate(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                    Nombre del rol *
                  </label>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateRole()}
                    placeholder="Ej: Supervisor de campo"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                    Descripción (opcional)
                  </label>
                  <input
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Ej: Supervisa actividades en campo"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                  Cancelar
                </button>
                <button onClick={handleCreateRole} disabled={creating || !newName.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white btn-primary disabled:opacity-50">
                  {creating ? 'Creando...' : 'Crear rol'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Confirmar eliminar */}
      <AnimatePresence>
        {toDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl p-6 space-y-4"
              style={glass(0.95)}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(239,68,68,0.12)' }}>
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Eliminar rol</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Esta acción no se puede deshacer</p>
                </div>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                ¿Estás seguro de eliminar el rol <strong style={{ color: 'var(--text-primary)' }}>"{toDelete.name}"</strong>?
                Los usuarios con este rol no podrán ser eliminados hasta reasignarlos.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                  Cancelar
                </button>
                <button onClick={handleDeleteRole} disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#dc2626' }}>
                  {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
