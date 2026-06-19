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
  Briefcase, LayoutTemplate, Layers, X,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import { AuraLogo } from '@/components/ui/AuraLogo';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/usePermission';
import type { UserRole } from '@/types';

interface SubItem { href: string; label: string; icon: React.ElementType; permission?: string }
interface NavItem {
  href?: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  permission?: string;
  children?: SubItem[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard,
    roles: ['admin','coordinator','implementer_clinical','implementer_financial','implementer_support','support','client'] },
  { href: '/usuarios', label: 'Usuarios', icon: Users,
    roles: ['admin','coordinator'], permission: 'users.buscar' },
  { href: '/clientes', label: 'Clientes', icon: Building2,
    roles: ['admin','coordinator','implementer_clinical','implementer_financial','implementer_support','support'],
    permission: 'clients.buscar' },
  { label: 'Implementación', icon: Briefcase,
    roles: ['admin','coordinator','implementer_clinical','implementer_financial','implementer_support'],
    children: [
      { href: '/implementacion/ordenes',    label: 'Órdenes de Servicio', icon: ClipboardList,  permission: 'orders.buscar'   },
      { href: '/implementacion/plantillas', label: 'Plantillas',          icon: LayoutTemplate, permission: 'settings.editar' },
      { href: '/implementacion/modulos',    label: 'Módulos',             icon: Layers,         permission: 'settings.editar' },
      { href: '/implementacion/proyectos',  label: 'Proyectos',           icon: FolderKanban,   permission: 'projects.editar' },
    ],
  },
  { label: 'Requerimientos', icon: MessageSquarePlus,
    roles: ['admin','coordinator','implementer_clinical','implementer_financial','implementer_support','client'],
    children: [
      { href: '/requerimientos/nuevo',     label: 'Registrar', icon: ClipboardPlus, permission: 'tickets.nuevo'  },
      { href: '/requerimientos/priorizar', label: 'Priorizar', icon: ListOrdered,   permission: 'tickets.buscar' },
    ],
  },
  { href: '/documentos', label: 'Documentos', icon: FileText,
    roles: ['admin','coordinator','implementer_clinical','implementer_financial','implementer_support','client'] },
  { href: '/reportes', label: 'Reportes', icon: BarChart3,
    roles: ['admin','coordinator'] },
  { href: '/configuracion', label: 'Configuración', icon: Settings,
    roles: ['admin'], permission: 'settings.editar' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can }  = usePermission();

  const [expanded, setExpanded] = useState<string[]>(['Requerimientos', 'Implementación']);

  const visibleItems = NAV_ITEMS.filter(item => {
    if (!user || !item.roles.includes(user.role as UserRole)) return false;
    if (item.permission && !can(item.permission)) return false;
    if (item.children) return item.children.some(c => !c.permission || can(c.permission));
    return true;
  });

  const toggleExpand = (label: string) =>
    setExpanded(p => p.includes(label) ? p.filter(l => l !== label) : [...p, label]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    clearAuth();
    toast.success('Sesión cerrada');
    router.push('/login');
  };

  const isActive     = (href?: string) => href ? (pathname === href || pathname.startsWith(href + '/')) : false;
  const hasActiveChild = (children?: SubItem[]) =>
    Boolean(children?.some(c => pathname === c.href || pathname.startsWith(c.href + '/')));

  /* ── Estilo de ítem activo — cápsula flotante ── */
  const activeStyle = {
    background: 'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
    boxShadow: '0 0 35px rgba(59,130,246,.45), 0 8px 20px rgba(37,99,235,.30), inset 0 1px 0 rgba(255,255,255,.18)',
    borderRadius: 16,
  };
  const activeStyleLight = {
    background: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
    boxShadow: '0 4px 20px rgba(37,99,235,.30), 0 0 0 1px rgba(37,99,235,.15)',
    borderRadius: 16,
  };
  const getActive = (active: boolean) => active ? (isLight ? activeStyleLight : activeStyle) : { borderRadius: 12 };

  const iconC  = (active: boolean) => active ? '#FFFFFF' : 'var(--text-muted)';
  const textC  = (active: boolean) => active ? 'rgba(255,255,255,0.96)' : 'var(--text-secondary)';

  const sidebarStyle = {
    background: isLight ? 'var(--sidebar-bg)' : 'rgba(10,16,38,0.92)',
    borderRight: '1px solid var(--sidebar-border)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: 'var(--sidebar-shadow)',
  };

  function renderBody(isCollapsed: boolean, onClose?: () => void) {
    const isMobile = Boolean(onClose);

    return (
      <>
        {/* Liquid wave — dark mode only, expanded only */}
        {!isCollapsed && !isLight && !isMobile && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '18%',
              left: '5%',
              width: '90%',
              height: '52%',
              background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.28) 0%, rgba(99,102,241,0.14) 55%, transparent 80%)',
              filter: 'blur(32px)',
              borderRadius: '60% 40% 70% 50% / 50% 60% 40% 70%',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}

        {/* Logo */}
        <div
          className={`relative z-10 flex items-center gap-3 px-5 ${isCollapsed ? 'justify-center py-5' : 'py-5'}`}
          style={{ borderBottom: `1px solid ${isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.05)'}` }}
        >
          <AuraLogo size={30} />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}
              >
                <p className="font-bold text-[15px] leading-none tracking-wider" style={{ color: 'var(--text-primary)' }}>AURA</p>
                <p className="text-[9px] tracking-[0.25em] uppercase mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>ERP Enterprise</p>
              </motion.div>
            )}
          </AnimatePresence>
          {isMobile && (
            <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex-1 py-3 overflow-y-auto overflow-x-hidden">
          <ul className="space-y-0.5 px-3">
            {visibleItems.map(item => {
              const active      = isActive(item.href);
              const childActive = hasActiveChild(item.children);
              const isOpen      = expanded.includes(item.label);
              const Icon        = item.icon;

              if (item.children) {
                return (
                  <li key={item.label} className="relative">
                    <motion.div
                      whileHover={{ x: isCollapsed ? 0 : 3 }}
                      transition={{ duration: 0.12 }}
                      onClick={() => !isCollapsed && toggleExpand(item.label)}
                      className={`flex items-center gap-3 px-3 h-[44px] transition-all cursor-pointer group ${isCollapsed ? 'justify-center' : 'shine-on-hover'}`}
                      style={getActive(childActive)}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0 transition-colors" style={{ color: iconC(childActive) }} />
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.span
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            className="text-sm font-medium whitespace-nowrap flex-1 leading-none"
                            style={{ color: textC(childActive) }}
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {!isCollapsed && (
                        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown className="w-3.5 h-3.5" style={{ color: childActive ? 'rgba(255,255,255,0.60)' : 'var(--text-muted)' }} />
                        </motion.div>
                      )}

                      {/* Flyout collapsed */}
                      {isCollapsed && !isMobile && (
                        <div
                          className="absolute left-full top-0 ml-3 min-w-[190px] rounded-2xl overflow-hidden opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50"
                          style={{
                            background: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(10,18,42,0.98)',
                            border: '1px solid var(--border-subtle)',
                            backdropFilter: 'blur(24px)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                          }}
                        >
                          <div className="px-4 py-3" style={{ borderBottom: `1px solid var(--border-subtle)` }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                          </div>
                          {item.children.filter(c => !c.permission || can(c.permission)).map(child => {
                            const ca = pathname === child.href || pathname.startsWith(child.href + '/');
                            const CI = child.icon;
                            return (
                              <Link key={child.href} href={child.href}>
                                <div className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-white/5"
                                  style={{ background: ca ? (isLight ? 'rgba(37,99,235,0.07)' : 'rgba(59,130,246,0.10)') : 'transparent' }}>
                                  <CI className="w-4 h-4 shrink-0" style={{ color: ca ? '#60a5fa' : 'var(--text-muted)' }} />
                                  <span className="text-sm font-medium" style={{ color: ca ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                    {child.label}
                                  </span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>

                    {/* Sub-items expanded */}
                    <AnimatePresence>
                      {!isCollapsed && isOpen && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeInOut' }}
                          className="overflow-hidden ml-3 mt-0.5 space-y-0.5"
                        >
                          {item.children.filter(c => !c.permission || can(c.permission)).map(child => {
                            const ca = pathname === child.href || pathname.startsWith(child.href + '/');
                            const CI = child.icon;
                            return (
                              <li key={child.href}>
                                <Link href={child.href} onClick={onClose}>
                                  <motion.div
                                    whileHover={{ x: 3, scale: 1.01 }}
                                    transition={{ duration: 0.12 }}
                                    className="flex items-center gap-2.5 px-3 h-[38px] rounded-[10px] transition-all cursor-pointer shine-on-hover"
                                    style={{
                                      background: ca
                                        ? isLight ? 'rgba(37,99,235,0.09)' : 'rgba(59,130,246,0.14)'
                                        : 'transparent',
                                      borderLeft: `2px solid ${ca ? (isLight ? '#2563EB' : '#60a5fa') : 'transparent'}`,
                                    }}
                                  >
                                    <CI className="w-4 h-4 shrink-0" style={{ color: ca ? (isLight ? '#2563EB' : '#60a5fa') : 'var(--text-muted)' }} />
                                    <span className="text-[13px] font-medium whitespace-nowrap"
                                      style={{ color: ca ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
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

              // Item simple
              return (
                <li key={item.href}>
                  <Link href={item.href!} onClick={onClose}>
                    <motion.div
                      whileHover={{ x: isCollapsed ? 0 : 3 }}
                      transition={{ duration: 0.12 }}
                      className={`flex items-center gap-3 px-3 h-[44px] transition-all cursor-pointer group relative ${isCollapsed ? 'justify-center' : 'shine-on-hover'}`}
                      style={getActive(active)}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0 transition-colors" style={{ color: iconC(active) }} />
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.span
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            className="text-sm font-medium whitespace-nowrap leading-none"
                            style={{ color: textC(active) }}
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {/* Tooltip collapsed */}
                      {isCollapsed && !isMobile && (
                        <div
                          className="absolute left-full ml-3 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
                          style={{
                            background: isLight ? '#FFFFFF' : 'rgba(10,18,42,0.98)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.20)',
                          }}
                        >
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
        <div
          className="relative z-10 px-3 pb-4 pt-3 space-y-1"
          style={{ borderTop: `1px solid ${isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.05)'}` }}
        >
          {user && !isCollapsed && (
            <div className="px-3 py-2.5 rounded-[14px] mb-2"
              style={{ background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)' }}>
              <p className="text-[13px] font-semibold truncate leading-none" style={{ color: 'var(--text-primary)' }}>
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[11px] truncate mt-1" style={{ color: 'var(--text-muted)' }}>{user.roleName}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 h-[40px] rounded-[12px] transition-all group hover:bg-red-500/10 ${isCollapsed ? 'justify-center' : ''}`}
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0 group-hover:text-red-400 transition-colors" />
            {!isCollapsed && (
              <span className="text-sm font-medium group-hover:text-red-400 transition-colors">Cerrar sesión</span>
            )}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 280 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="hidden md:flex flex-col h-full shrink-0 relative z-10 overflow-hidden"
        style={sidebarStyle}
      >
        {renderBody(collapsed)}

        {/* Toggle */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-[72px] w-6 h-6 rounded-full flex items-center justify-center transition-colors z-20"
          style={{
            background: isLight ? '#FFFFFF' : 'rgba(10,18,42,1)',
            border: `1px solid ${isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)'}`,
            color: 'var(--text-secondary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </motion.aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 md:hidden"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onMobileClose}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex flex-col md:hidden overflow-hidden"
              style={{ width: 280, ...sidebarStyle }}
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            >
              {renderBody(false, onMobileClose)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
