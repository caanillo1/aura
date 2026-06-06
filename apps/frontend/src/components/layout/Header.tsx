'use client';
import { Bell, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':                   'Dashboard',
  '/usuarios':                    'Usuarios',
  '/clientes':                    'Clientes',
  '/ordenes':                     'Órdenes de Servicio',
  '/proyectos':                   'Proyectos',
  '/requerimientos/nuevo':        'Registrar Requerimiento',
  '/requerimientos/priorizar':    'Priorizar Requerimientos',
  '/documentos':                  'Documentos',
  '/reportes':                    'Reportes',
  '/configuracion/roles':         'Permisos de Roles',
  '/configuracion':               'Configuración',
};

export function Header() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/'),
  )?.[1] ?? 'AURA ERP';

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : 'AU';

  return (
    <header
      className="h-14 flex items-center justify-between px-6 shrink-0 transition-colors"
      style={{
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--header-border)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: '0 1px 0 var(--border-subtle)',
      }}
    >
      <h1 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h1>

      <div className="flex items-center gap-2">
        {/* Toggle tema */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4 hover:text-amber-400 transition-colors" />
              : <Moon className="w-4 h-4 hover:text-blue-400 transition-colors" />
            }
          </button>
        )}

        {/* Notificaciones */}
        <button
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #1E3A5F, #2D5086)' }}
          >
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium leading-none" style={{ color: 'var(--text-primary)' }}>
              {user?.firstName}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {user?.roleName}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
