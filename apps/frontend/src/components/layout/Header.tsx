'use client';
import { Sun, Moon, Menu, Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NotificationBell } from './NotificationBell';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':                'Dashboard',
  '/usuarios':                 'Usuarios',
  '/clientes':                 'Clientes',
  '/ordenes':                  'Órdenes de Servicio',
  '/proyectos':                'Proyectos',
  '/requerimientos/nuevo':     'Registrar Requerimiento',
  '/requerimientos/priorizar': 'Priorizar Requerimientos',
  '/documentos':               'Documentos',
  '/reportes':                     'Reportes',
  '/cronograma':                   'Cronograma de Atención',
  '/comercial/cotizaciones':       'Cotizaciones',
  '/configuracion/roles':          'Permisos de Roles',
  '/configuracion':                'Configuración',
};

interface HeaderProps { onMenuToggle?: () => void }

export function Header({ onMenuToggle }: HeaderProps) {
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isLight = theme === 'light';

  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/'),
  )?.[1] ?? 'AURA ERP';

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : 'AU';

  const openPalette = () =>
    window.dispatchEvent(new CustomEvent('aura:command'));

  return (
    <header
      className="flex items-center justify-between px-5 sm:px-6 shrink-0 transition-colors"
      style={{
        height: 72,
        background: isLight ? 'var(--header-bg)' : 'rgba(2,6,23,0.80)',
        borderBottom: '1px solid var(--header-border)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: 'var(--header-shadow)',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-semibold text-[15px] leading-tight" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Search pill */}
        <button
          onClick={openPalette}
          className="hidden sm:flex items-center gap-2.5 h-9 px-3.5 rounded-xl transition-all shine-on-hover"
          style={{
            background: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)'}`,
            color: 'var(--text-muted)',
            minWidth: 180,
          }}
          title="Buscar (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-medium flex-1 text-left">Buscar...</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
            ⌘K
          </kbd>
        </button>

        {/* Search icon mobile */}
        <button
          onClick={openPalette}
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Buscar"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-secondary)' }}
            title={isLight ? 'Modo oscuro' : 'Modo claro'}
          >
            {isLight
              ? <Moon className="w-4 h-4" />
              : <Sun className="w-4 h-4" />
            }
          </button>
        )}

        <NotificationBell />

        {/* Divider */}
        <div className="w-px h-6 mx-1" style={{ background: 'var(--border-subtle)' }} />

        {/* Avatar + name */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
              boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
            }}
          >
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {user?.firstName} {user?.lastName}
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
