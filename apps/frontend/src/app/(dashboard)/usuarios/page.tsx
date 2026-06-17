'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Search, RefreshCw, CheckCircle2, XCircle, Pencil, KeyRound, UserCheck, UserX, Trash2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { usersApi, companyApi } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/usePermission';
import type { User, Role } from '@/types';

// Colores por tema: [dark, light]
const ROLE_STYLE: Record<string, { dark: string; light: string }> = {
  admin:                 { dark: 'rgba(239,68,68,0.15)',   light: 'rgba(185,28,28,0.10)'  },
  coordinator:           { dark: 'rgba(245,158,11,0.15)',  light: 'rgba(146,64,14,0.10)'  },
  implementer_clinical:  { dark: 'rgba(59,130,246,0.15)',  light: 'rgba(29,78,216,0.10)'  },
  implementer_financial: { dark: 'rgba(6,182,212,0.15)',   light: 'rgba(14,116,144,0.10)' },
  implementer_support:   { dark: 'rgba(99,102,241,0.15)',  light: 'rgba(67,56,202,0.10)'  },
  support:               { dark: 'rgba(139,92,246,0.15)',  light: 'rgba(109,40,217,0.10)' },
  client:                { dark: 'rgba(16,185,129,0.15)',  light: 'rgba(4,120,87,0.10)'   },
};
const ROLE_TEXT: Record<string, { dark: string; light: string }> = {
  admin:                 { dark: '#f87171', light: '#991b1b' },
  coordinator:           { dark: '#fbbf24', light: '#92400e' },
  implementer_clinical:  { dark: '#60a5fa', light: '#1d4ed8' },
  implementer_financial: { dark: '#22d3ee', light: '#0e7490' },
  implementer_support:   { dark: '#818cf8', light: '#4338ca' },
  support:               { dark: '#a78bfa', light: '#6d28d9' },
  client:                { dark: '#34d399', light: '#065f46' },
};

export default function UsuariosPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [roles, setRoles]     = useState<Role[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal editar
  const [editUser, setEditUser]       = useState<User | null>(null);
  const [editForm, setEditForm]       = useState({ firstName: '', lastName: '', jobTitle: '', phone: '', roleSlug: '', userType: 'agent' as 'agent' | 'client' });
  const [saving, setSaving]           = useState(false);

  // Modal reset password
  const [resetUser, setResetUser]     = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting]     = useState(false);

  // Modal nuevo usuario
  const EMPTY_NEW = { userType: 'agent' as 'agent'|'client', document: '', firstName: '', lastName: '', email: '', password: '', roleSlug: '', jobTitle: '', phone: '' };
  const [showNew, setShowNew]   = useState(false);
  const [newForm, setNewForm]   = useState(EMPTY_NEW);
  const [creating, setCreating] = useState(false);
  const [showPwd, setShowPwd]   = useState(false);

  // Modal eliminar usuario
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can } = usePermission();

  const tableStyle = {
    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.10)'}`,
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: isLight
      ? '0 8px 32px rgba(30,60,120,0.18), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  };

  const rowBorder = isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)';
  const headBg    = isLight ? 'rgba(30,60,120,0.06)' : 'rgba(255,255,255,0.03)';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ page, limit: 15, search: search || undefined, userType: filterType || undefined });
      setUsers(res.data);
      setTotal(res.meta.total);
    } catch { toast.error('Error al cargar usuarios'); }
    finally { setLoading(false); }
  }, [page, search, filterType]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { companyApi.getRoles().then(setRoles).catch(() => {}); }, []);

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({ firstName: u.firstName, lastName: u.lastName, jobTitle: u.jobTitle ?? '', phone: u.phone ?? '', roleSlug: u.role.slug, userType: (u.userType as 'agent' | 'client') ?? 'agent' });
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await usersApi.update(editUser.id, editForm);
      toast.success('Usuario actualizado');
      setEditUser(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al actualizar');
    } finally { setSaving(false); }
  };

  const handleToggle = async (u: User) => {
    try {
      await usersApi.toggleStatus(u.id);
      toast.success(`Usuario ${u.isActive ? 'desactivado' : 'activado'}`);
      load();
    } catch { toast.error('Error al cambiar estado'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await usersApi.delete(deleteTarget.id);
      toast.success(`Usuario "${deleteTarget.firstName} ${deleteTarget.lastName}" eliminado`);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al eliminar usuario');
    } finally { setDeleting(false); }
  };

  const handleResetPassword = async () => {
    if (!resetUser || newPassword.length < 8) return;
    setResetting(true);
    try {
      await usersApi.resetPassword(resetUser.id, newPassword);
      toast.success('Contraseña actualizada');
      setResetUser(null);
      setNewPassword('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al resetear contraseña');
    } finally { setResetting(false); }
  };

  const handleCreateUser = async () => {
    if (!newForm.document.trim() || !newForm.firstName.trim() || !newForm.lastName.trim() || !newForm.email.trim() || newForm.password.length < 8 || !newForm.roleSlug) {
      toast.error('Completa todos los campos obligatorios (contraseña mínimo 8 caracteres)');
      return;
    }
    setCreating(true);
    try {
      await usersApi.create({ ...newForm, jobTitle: newForm.jobTitle || undefined, phone: newForm.phone || undefined });
      toast.success(`Usuario ${newForm.firstName} ${newForm.lastName} creado`);
      setShowNew(false);
      setNewForm(EMPTY_NEW);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al crear usuario');
    } finally { setCreating(false); }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Usuarios</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{total} usuarios registrados</p>
        </div>
        {can('users.nuevo') && (
          <button onClick={() => { setNewForm(EMPTY_NEW); setShowNew(true); }}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-medium">
            <UserPlus className="w-4 h-4" />
            Nuevo usuario
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, email o documento..."
            className="input-glass w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          className="input-glass rounded-xl px-4 py-2.5 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="agent">Agentes</option>
          <option value="client">Clientes</option>
        </select>
        <button onClick={load} className="p-2.5 rounded-xl transition-colors" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl overflow-hidden" style={tableStyle}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: rowBorder, background: headBg }}>
              {['Usuario', 'Rol', 'Tipo', 'Último acceso', 'Estado', ''].map((h) => (
                <th key={h} className={`text-left font-medium px-5 py-3.5 text-xs uppercase tracking-wide ${!h ? 'pr-4' : ''} ${['Tipo','Último acceso'].includes(h) ? 'hidden lg:table-cell' : ''} ${h === 'Rol' ? 'hidden md:table-cell' : ''}`}
                  style={{ color: 'var(--text-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td colSpan={6} className="px-5 py-4">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />
                    </td>
                  </tr>
                ))
              : users.map((u, i) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    style={{ borderBottom: rowBorder }}
                    className="transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: 'linear-gradient(135deg, #1E3A5F, #2D5086)' }}>
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.firstName} {u.lastName}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: (ROLE_STYLE[u.role.slug]?.[isLight ? 'light' : 'dark']) ?? 'rgba(100,100,100,0.15)',
                          color:      (ROLE_TEXT[u.role.slug]?.[isLight ? 'light' : 'dark']) ?? 'var(--text-secondary)',
                          border:     `1px solid ${(ROLE_TEXT[u.role.slug]?.[isLight ? 'light' : 'dark']) ?? '#888'}40`,
                        }}>
                        {u.role.name}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {u.userType === 'agent' ? 'Agente' : 'Cliente'}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-xs" style={{ color: 'var(--text-muted)' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('es-CO') : 'Nunca'}
                    </td>
                    <td className="px-4 py-3.5">
                      {u.isActive
                        ? <span className="flex items-center gap-1.5 text-emerald-500 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Activo</span>
                        : <span className="flex items-center gap-1.5 text-red-400 text-xs"><XCircle className="w-3.5 h-3.5" />Inactivo</span>
                      }
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 justify-end">
                        {can('users.editar') && (
                          <button onClick={() => openEdit(u)} title="Editar"
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: isLight ? '#1d4ed8' : '#60a5fa' }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {can('users.password') && (
                          <button onClick={() => { setResetUser(u); setNewPassword(''); }} title="Resetear contraseña"
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: isLight ? '#92400e' : '#fbbf24' }}>
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {can('users.eliminar') && (
                          <button onClick={() => setDeleteTarget(u)} title="Eliminar usuario"
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: isLight ? '#dc2626' : '#f87171' }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {can('users.desactivar') && (
                          <button onClick={() => handleToggle(u)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                            style={u.isActive
                              ? { color: isLight ? '#991b1b' : '#f87171', background: isLight ? 'rgba(185,28,28,0.10)' : 'rgba(239,68,68,0.12)', border: `1px solid ${isLight ? 'rgba(185,28,28,0.25)' : 'rgba(239,68,68,0.25)'}` }
                              : { color: isLight ? '#065f46' : '#34d399', background: isLight ? 'rgba(6,95,70,0.10)'  : 'rgba(52,211,153,0.12)', border: `1px solid ${isLight ? 'rgba(6,95,70,0.25)'  : 'rgba(52,211,153,0.25)'}` }
                            }>
                            {u.isActive
                              ? <><UserX className="w-3.5 h-3.5" /> Desactivar</>
                              : <><UserCheck className="w-3.5 h-3.5" /> Activar</>
                            }
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
            }
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No se encontraron usuarios</div>
        )}
      </div>

      {/* Paginación */}
      {total > 15 && (
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Página {page} de {Math.ceil(total / 15)}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Anterior
            </button>
            <button disabled={page >= Math.ceil(total / 15)} onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-xl transition-colors disabled:opacity-30"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ── Modal editar usuario ───────────────────────────────────────────── */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Editar usuario">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nombre</label>
              <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={editForm.firstName} onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Apellido</label>
              <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={editForm.lastName} onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Cargo</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={editForm.jobTitle} onChange={(e) => setEditForm((p) => ({ ...p, jobTitle: e.target.value }))}
              placeholder="Coordinador, Implementador..." />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Teléfono</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Tipo de usuario</label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={editForm.userType} onChange={(e) => setEditForm((p) => ({ ...p, userType: e.target.value as 'agent' | 'client' }))}>
                <option value="agent">Agente</option>
                <option value="client">Cliente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Rol</label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={editForm.roleSlug} onChange={(e) => setEditForm((p) => ({ ...p, roleSlug: e.target.value }))}>
                {roles.map((r) => (
                  <option key={r.slug} value={r.slug}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>
            Los usuarios tipo <strong>Agente</strong> reciben notificaciones internas del sistema.
          </p>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditUser(null)}
              className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleSaveEdit} disabled={saving}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal eliminar usuario ────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Eliminar usuario">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl"
            style={{ background: isLight ? 'rgba(220,38,38,0.08)' : 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <Trash2 className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#ef4444' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: isLight ? '#991b1b' : '#fca5a5' }}>
                ¿Eliminar a {deleteTarget?.firstName} {deleteTarget?.lastName}?
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Esta acción es irreversible. Si el usuario tiene historial (requerimientos, gestiones, órdenes de servicio), no se podrá eliminar — usa "Desactivar" en su lugar.
              </p>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-medium">{deleteTarget?.email}</span>
          </p>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setDeleteTarget(null)}
              className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
              {deleting ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal resetear contraseña ──────────────────────────────────────── */}
      <Modal open={!!resetUser} onClose={() => setResetUser(null)} title={`Resetear contraseña — ${resetUser?.firstName}`}>
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Define una nueva contraseña para <strong>{resetUser?.email}</strong>. El usuario deberá usarla en su próximo inicio de sesión.
          </p>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nueva contraseña</label>
            <input type="password" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setResetUser(null)}
              className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleResetPassword} disabled={resetting || newPassword.length < 8}
              className="flex-1 py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}>
              {resetting ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal nuevo usuario ──────────────────────────────────────────────── */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nuevo usuario">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nombre *</label>
              <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={newForm.firstName} onChange={e => setNewForm(p => ({ ...p, firstName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Apellido *</label>
              <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={newForm.lastName} onChange={e => setNewForm(p => ({ ...p, lastName: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Documento *</label>
            <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={newForm.document} onChange={e => setNewForm(p => ({ ...p, document: e.target.value }))} placeholder="Cédula o NIT" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Correo electrónico *</label>
            <input type="email" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
              value={newForm.email} onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Contraseña * (mín. 8 caracteres)</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} className="input-glass w-full rounded-xl px-3 py-2.5 text-sm pr-10"
                value={newForm.password} onChange={e => setNewForm(p => ({ ...p, password: e.target.value }))}
                autoComplete="new-password" />
              <button type="button" onClick={() => setShowPwd(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Tipo *</label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={newForm.userType} onChange={e => setNewForm(p => ({ ...p, userType: e.target.value as 'agent'|'client' }))}>
                <option value="agent">Agente</option>
                <option value="client">Cliente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Rol *</label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={newForm.roleSlug} onChange={e => setNewForm(p => ({ ...p, roleSlug: e.target.value }))}>
                <option value="">Seleccionar rol...</option>
                {roles.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Cargo</label>
              <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={newForm.jobTitle} onChange={e => setNewForm(p => ({ ...p, jobTitle: e.target.value }))} placeholder="Opcional" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Teléfono</label>
              <input className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={newForm.phone} onChange={e => setNewForm(p => ({ ...p, phone: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowNew(false)}
              className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleCreateUser} disabled={creating}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-medium disabled:opacity-50">
              {creating ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
