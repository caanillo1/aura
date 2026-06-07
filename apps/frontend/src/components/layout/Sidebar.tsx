'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Building2, FolderKanban,
  ClipboardList, FileText, BarChart3, Settings,
  ChevronLeft, ChevronRight, ChevronDown, LogOut,
  ClipboardPlus, ListOrdered, MessageSquarePlus,
  Briefcase, LayoutTemplate, Layers,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import { AuraLogo } from '@/components/ui/AuraLogo';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/types';

interface SubItem { href: string; label: string; icon: React.ElementType }
interface NavItem {
  href?: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  children?: SubItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard,
    roles: ['admin','coordinator','implementer_clinical','implementer_financial','implementer_support','support','client'],
  },
  {
    href: '/usuarios', label: 'Usuarios', icon: Users,
    roles: ['admin','coordinator'],
  },
  {
    href: '/clientes', label: 'Clientes', icon: Building2,
    roles: ['admin','coordinator','implementer_clinical','implementer_financial','implementer_support','support'],
  },
  // ── IMPLEMENTACIÓN (sub-menú) ─────────────────────────────────────────────
  {
    label: 'Implementación', icon: Briefcase,
    roles: ['admin','coordinator','implementer_clinical','implementer_financial','implementer_support'],
    children: [
      { href: '/implementacion/ordenes',    label: 'Órdenes de Servicio', icon: ClipboardList   },
      { href: '/implementacion/plantillas', label: 'Plantillas',          icon: LayoutTemplate  },
      { href: '/implementacion/modulos',    label: 'Módulos',             icon: Layers          },
      { href: '/implementacion/proyectos',  label: 'Proyectos',           icon: FolderKanban    },
    ],
  },
  // ── REQUERIMIENTOS (sub-menú) ─────────────────────────────────────────────
  {
    label: 'Requerimientos', icon: MessageSquarePlus,
    roles: ['admin','coordinator','implementer_clinical','implementer_financial','implementer_support','client'],
    children: [
      { href: '/requerimientos/nuevo',      label: 'Registrar',  icon: ClipboardPlus },
      { href: '/requerimientos/priorizar',  label: 'Priorizar',  icon: ListOrdered   },
    ],
  },
  {
    href: '/documentos', label: 'Documentos', icon: FileText,
    roles: ['admin','coordinator','implementer_clinical','implementer_financial','implementer_support','client'],
  },
  {
    href: '/reportes', label: 'Reportes', icon: BarChart3,
    roles: ['admin','coordinator'],
  },
  {
    href: '/configuracion', label: 'Configuración', icon: Settings,
    roles: ['admin'],
  },
];

interface SidebarProps { collapsed: boolean; onToggle: () => void }

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { theme } = useTheme();
  const isLight   = theme === 'light';

  // Estado de expansión de sub-menús
  const [expanded, setExpanded] = useState<string[]>(['Requerimientos', 'Implementación']);

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role as UserRole),
  );

  const toggleExpand = (label: string) =>
    setExpanded((p) => p.includes(label) ? p.filter((l) => l !== label) : [...p, label]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    clearAuth();
    toast.success('Sesión cerrada');
    router.push('/login');
  };

  const isActive = (href?: string) =>
    href ? (pathname === href || pathname.startsWith(href + '/')) : false;

  const hasActiveChild = (children?: SubItem[]) =>
    children?.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'));

  const itemStyle = (active: boolean) => ({
    background: active
      ? isLight ? 'rgba(30,58,95,0.13)' : 'rgba(59,130,246,0.15)'
      : 'transparent',
    border: active
      ? isLight ? '1px solid rgba(30,58,95,0.22)' : '1px solid rgba(59,130,246,0.28)'
      : '1px solid transparent',
  });

  const iconColor = (active: boolean) =>
    active ? (isLight ? '#1e3a5f' : '#60a5fa') : 'var(--text-muted)';

  const textColor = (active: boolean) =>
    active ? 'var(--text-primary)' : 'var(--text-secondary)';

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex flex-col h-full shrink-0"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        boxShadow: 'var(--sidebar-shadow)',
      }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? 'justify-center' : ''}`}
        style={{ borderBottom: `1px solid ${isLight ? 'rgba(100,140,200,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
        <AuraLogo size={32} />
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
              <p className="font-bold text-base leading-none tracking-wide" style={{ color: 'var(--text-primary)' }}>AURA</p>
              <p className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: 'var(--text-muted)' }}>ERP</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-0.5 px-2">
          {visibleItems.map((item) => {
            const active      = isActive(item.href);
            const childActive = hasActiveChild(item.children);
            const isOpen      = expanded.includes(item.label);
            const Icon        = item.icon;

            // ── Ítem con sub-menú ──────────────────────────────────────────
            if (item.children) {
              return (
                <li key={item.label} className="relative">
                  {/* Trigger */}
                  <motion.div whileHover={{ x: collapsed ? 0 : 2 }}
                    onClick={() => !collapsed && toggleExpand(item.label)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group ${collapsed ? 'justify-center' : ''}`}
                    style={itemStyle(childActive)}
                  >
                    <Icon className="w-5 h-5 shrink-0 transition-colors"
                      style={{ color: iconColor(childActive) }} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="text-sm font-medium whitespace-nowrap flex-1"
                          style={{ color: textColor(childActive) }}>
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {!collapsed && (
                      <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      </motion.div>
                    )}

                    {/* ── Flyout en modo colapsado ── */}
                    {collapsed && (
                      <div className="absolute left-full top-0 ml-3 min-w-[180px] rounded-xl overflow-hidden opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50"
                        style={{
                          background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,25,50,0.97)',
                          border: '1px solid var(--border-strong)',
                          backdropFilter: 'blur(20px)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                        }}>
                        {/* Cabecera del flyout */}
                        <div className="px-4 py-2.5 border-b"
                          style={{ borderColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)' }}>
                          <p className="text-xs font-bold uppercase tracking-wide"
                            style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                        </div>
                        {/* Sub-ítems del flyout */}
                        {item.children.map((child) => {
                          const childIsActive = pathname === child.href || pathname.startsWith(child.href + '/');
                          const ChildIcon = child.icon;
                          return (
                            <Link key={child.href} href={child.href}>
                              <div className="flex items-center gap-2.5 px-4 py-2.5 transition-colors"
                                style={{
                                  background: childIsActive
                                    ? isLight ? 'rgba(30,58,95,0.10)' : 'rgba(96,165,250,0.12)'
                                    : 'transparent',
                                  color: childIsActive ? iconColor(true) : 'var(--text-secondary)',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = isLight ? 'rgba(30,58,95,0.06)' : 'rgba(255,255,255,0.06)')}
                                onMouseLeave={e => (e.currentTarget.style.background = childIsActive ? (isLight ? 'rgba(30,58,95,0.10)' : 'rgba(96,165,250,0.12)') : 'transparent')}
                              >
                                <ChildIcon className="w-4 h-4 shrink-0"
                                  style={{ color: childIsActive ? iconColor(true) : 'var(--text-muted)' }} />
                                <span className="text-sm whitespace-nowrap font-medium"
                                  style={{ color: childIsActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                  {child.label}
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>

                  {/* Sub-ítems expandidos (sidebar abierto) */}
                  <AnimatePresence>
                    {!collapsed && isOpen && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="overflow-hidden ml-4 mt-0.5 space-y-0.5"
                      >
                        {item.children.map((child) => {
                          const childIsActive = pathname === child.href || pathname.startsWith(child.href + '/');
                          const ChildIcon = child.icon;
                          return (
                            <li key={child.href}>
                              <Link href={child.href}>
                                <motion.div whileHover={{ x: 2 }}
                                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer"
                                  style={{
                                    background: childIsActive
                                      ? isLight ? 'rgba(30,58,95,0.10)' : 'rgba(59,130,246,0.12)'
                                      : 'transparent',
                                    borderLeft: `2px solid ${childIsActive
                                      ? isLight ? '#1e3a5f' : '#60a5fa'
                                      : 'transparent'}`,
                                  }}
                                >
                                  <ChildIcon className="w-4 h-4 shrink-0"
                                    style={{ color: childIsActive ? iconColor(true) : 'var(--text-muted)' }} />
                                  <span className="text-sm whitespace-nowrap"
                                    style={{ color: childIsActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                    {child.label}
                                  </span>
                                </motion.div>
                              </Link>
                            </li>
                          );
                        })}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </li>
              );
            }

            // ── Ítem simple ───────────────────────────────────────────────
            return (
              <li key={item.href}>
                <Link href={item.href!}>
                  <motion.div whileHover={{ x: collapsed ? 0 : 2 }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group relative ${collapsed ? 'justify-center' : ''}`}
                    style={itemStyle(active)}
                  >
                    <Icon className="w-5 h-5 shrink-0 transition-colors"
                      style={{ color: iconColor(active) }} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="text-sm font-medium whitespace-nowrap"
                          style={{ color: textColor(active) }}>
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {collapsed && (
                      <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl"
                        style={{ background: isLight ? 'rgba(255,255,255,0.92)' : '#1e293b', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                        {item.label}
                      </div>
                    )}
                  </motion.div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User + logout */}
      <div className="px-2 pb-4 pt-3 space-y-1"
        style={{ borderTop: `1px solid ${isLight ? 'rgba(100,140,200,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
        {user && !collapsed && (
          <div className="px-3 py-2 rounded-xl mb-2"
            style={{ background: isLight ? 'rgba(30,58,95,0.08)' : 'rgba(255,255,255,0.05)' }}>
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user.firstName} {user.lastName}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{user.roleName}</p>
          </div>
        )}
        <button onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group hover:bg-red-500/10 ${collapsed ? 'justify-center' : ''}`}
          style={{ color: 'var(--text-muted)' }}>
          <LogOut className="w-5 h-5 shrink-0 group-hover:text-red-400 transition-colors" />
          {!collapsed && <span className="text-sm font-medium group-hover:text-red-400 transition-colors">Cerrar sesión</span>}
        </button>
      </div>

      {/* Toggle */}
      <button onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center transition-colors z-10"
        style={{
          background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(5,13,26,1)',
          border: `1px solid ${isLight ? 'rgba(100,140,200,0.30)' : 'rgba(255,255,255,0.12)'}`,
          color: 'var(--text-secondary)',
          boxShadow: isLight ? '0 2px 8px rgba(100,140,200,0.20)' : 'none',
        }}>
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </motion.aside>
  );
}
