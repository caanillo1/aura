'use client';
import { Sun, Moon, Menu, Search, Command } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NotificationBell } from './NotificationBell';

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

interface HeaderProps { onMenuToggle?: () => void }

export function Header({ onMenuToggle }: HeaderProps) {
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

  const openPalette = () =>
    window.dispatchEvent(new CustomEvent('aura:command'));

  return (
    <header
      className="h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 transition-colors"
      style={{
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--header-border)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: 'var(--header-shadow)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuToggle}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Search / Command Palette trigger */}
        <button
          onClick={openPalette}
          className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg transition-all text-xs font-medium shine-on-hover"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            color: 'var(--text-muted)',
          }}
          title="Buscar (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Buscar...</span>
          <span className="flex items-center gap-0.5 ml-1 opacity-60">
            <kbd className="text-[10px] font-mono">⌘K</kbd>
          </span>
        </button>

        {/* Icon-only search on mobile */}
        <button
          onClick={openPalette}
          className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Buscar"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Toggle tema */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
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
        <NotificationBell />

        {/* Avatar */}
        <div className="flex items-center gap-2.5 ml-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #1E3A5F, #2D5086)' }}
          >
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium leading-none" style={{ color: 'var(--text-primary)' }}>
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
