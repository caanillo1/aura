'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Mail, Phone, MapPin, Users, Hash, Briefcase, CheckCircle2, XCircle, UserCircle2 } from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { clientsApi } from '@/lib/api';
import { toast } from 'sonner';
import type { Client, ClientStaff } from '@/types';

type Tab = 'staff' | 'users';

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [client, setClient]   = useState<(Client & { staff: ClientStaff[] }) | null>(null);
  const [users, setUsers]     = useState<any[]>([]);
  const [tab, setTab]         = useState<Tab>('staff');
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const glassTable = {
    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.10)'}`,
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: isLight
      ? '0 8px 32px rgba(30,60,120,0.18), inset 0 1px 0 rgba(255,255,255,0.98)'
      : '0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)',
  };
  const rowBorder = isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)';

  useEffect(() => {
    clientsApi.get(id)
      .then(setClient)
      .catch(() => toast.error('Error al cargar el cliente'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (tab === 'users' && users.length === 0) {
      setLoadingUsers(true);
      clientsApi.getUsers(id)
        .then(setUsers)
        .catch(() => toast.error('Error al cargar usuarios'))
        .finally(() => setLoadingUsers(false));
    }
  }, [tab, id, users.length]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl animate-pulse">
        <div className="h-8 w-48 rounded-xl" style={{ background: 'var(--border-subtle)' }} />
        <div className="h-40 rounded-2xl" style={{ background: 'var(--border-subtle)' }} />
        <div className="h-64 rounded-2xl" style={{ background: 'var(--border-subtle)' }} />
      </div>
    );
  }

  if (!client) return <p style={{ color: 'var(--text-muted)' }}>Cliente no encontrado.</p>;

  return (
    <div className="space-y-5 max-w-4xl">
      <BackButton href="/clientes" label="Volver a clientes" />

      {/* Card empresa */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 card">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #1E3A5F, #2D5086)' }}>
            {client.businessName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>{client.businessName}</h2>
              {client.isActive
                ? <span className="flex items-center gap-1 text-emerald-500 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Activo</span>
                : <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3.5 h-3.5" />Inactivo</span>
              }
            </div>
            {client.commercialName && <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{client.commercialName}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              {[
                { icon: Hash,     value: client.nit,              mono: true },
                { icon: MapPin,   value: client.city && `${client.city}${client.department ? `, ${client.department}` : ''}` },
                { icon: Mail,     value: client.email },
                { icon: Phone,    value: client.phone },
                { icon: Briefcase,value: client.economicActivity },
              ].filter(i => i.value).map(({ icon: Icon, value, mono }) => (
                <div key={String(value)} className="flex items-center gap-2 text-sm">
                  <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <span className={`text-xs ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text-secondary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        {([
          { key: 'staff', label: 'Personal', icon: Users, count: client.staff?.length ?? 0 },
          { key: 'users', label: 'Usuarios portal', icon: UserCircle2, count: users.length },
        ] as const).map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'btn-primary text-white' : ''}`}
            style={tab !== key ? { color: 'var(--text-secondary)' } : {}}>
            <Icon className="w-4 h-4" />
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-white/20' : ''}`}
              style={tab !== key ? { background: 'var(--border-subtle)', color: 'var(--text-muted)' } : {}}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab: Personal */}
      {tab === 'staff' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl overflow-hidden" style={glassTable}>
          {!client.staff?.length ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No hay funcionarios registrados</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: rowBorder, background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.03)' }}>
                  {['Nombre', 'Cargo', 'Correo', 'Área'].map((h) => (
                    <th key={h} className={`text-left font-medium px-5 py-3 text-xs uppercase tracking-wide ${['Correo','Área'].includes(h) ? 'hidden md:table-cell' : ''}`}
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {client.staff.map((s) => (
                  <tr key={s.id} style={{ borderBottom: rowBorder }}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{s.firstName} {s.lastName}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{s.document}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{s.jobTitle ?? '—'}</td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-xs" style={{ color: 'var(--text-secondary)' }}>{s.email ?? '—'}</td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-xs" style={{ color: 'var(--text-secondary)' }}>{s.area ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      )}

      {/* Tab: Usuarios del portal */}
      {tab === 'users' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl overflow-hidden" style={glassTable}>
          {loadingUsers ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Cargando usuarios...</div>
          ) : !users.length ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Este cliente no tiene usuarios de portal registrados
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: rowBorder, background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.03)' }}>
                  {['Usuario', 'Rol', 'Último acceso', 'Estado'].map((h) => (
                    <th key={h} className={`text-left font-medium px-5 py-3 text-xs uppercase tracking-wide ${['Último acceso'].includes(h) ? 'hidden md:table-cell' : ''}`}
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: rowBorder }}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.firstName} {u.lastName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{u.role?.name}</td>
                    <td className="px-4 py-3.5 hidden md:table-cell text-xs" style={{ color: 'var(--text-muted)' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('es-CO') : 'Nunca'}
                    </td>
                    <td className="px-4 py-3.5">
                      {u.isActive
                        ? <span className="flex items-center gap-1 text-emerald-500 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Activo</span>
                        : <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3.5 h-3.5" />Inactivo</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      )}
    </div>
  );
}
