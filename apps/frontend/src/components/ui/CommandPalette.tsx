'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Search, X, LayoutDashboard, Users, Building2, FolderKanban,
  ClipboardList, BarChart3, Settings, Briefcase, LayoutTemplate,
  Layers, MessageSquarePlus, ClipboardPlus, ListOrdered,
  FileText, ArrowRight, CalendarDays, TrendingUp, FileSpreadsheet,
  MapPin, Activity, Sparkles,
} from 'lucide-react';

interface Command {
  label: string;
  href: string;
  icon: React.ElementType;
  group: string;
  keywords?: string;   // términos adicionales de búsqueda
  shortcut?: string;
}

const COMMANDS: Command[] = [
  // ── Navegación principal ───────────────────────────────────────
  { label: 'Dashboard',           href: '/dashboard',                        icon: LayoutDashboard, group: 'Navegación',      shortcut: '⌘1', keywords: 'inicio home principal metricas kpi' },
  { label: 'Usuarios',            href: '/usuarios',                         icon: Users,           group: 'Navegación',      keywords: 'agentes equipo personas cuentas' },
  { label: 'Clientes',            href: '/clientes',                         icon: Building2,       group: 'Navegación',      keywords: 'empresas organizaciones nit' },
  { label: 'Cronograma',          href: '/cronograma',                       icon: CalendarDays,    group: 'Navegación',      keywords: 'agenda calendario visitas bloques horario' },
  { label: 'Documentos',          href: '/documentos',                       icon: FileText,        group: 'Navegación',      keywords: 'archivos repositorio adjuntos' },
  { label: 'Reportes',            href: '/reportes',                         icon: BarChart3,       group: 'Navegación',      keywords: 'informes graficas estadisticas' },
  { label: 'Configuración',       href: '/configuracion',                    icon: Settings,        group: 'Navegación',      keywords: 'ajustes empresa smtp colores sistema' },

  // ── Implementación ─────────────────────────────────────────────
  { label: 'Órdenes de Servicio', href: '/implementacion/ordenes',           icon: ClipboardList,   group: 'Implementación',  keywords: 'os ordenes contratos servicios' },
  { label: 'Plantillas',          href: '/implementacion/plantillas',        icon: LayoutTemplate,  group: 'Implementación',  keywords: 'flujos templates fases actividades' },
  { label: 'Módulos',             href: '/implementacion/modulos',           icon: Layers,          group: 'Implementación',  keywords: 'modulos configuracion sistema' },
  { label: 'Proyectos',           href: '/implementacion/proyectos',         icon: FolderKanban,    group: 'Implementación',  keywords: 'kanban actividades fases progreso' },
  { label: 'Actas Pendientes',    href: '/implementacion/visitas',           icon: MapPin,          group: 'Implementación',  keywords: 'actas visitas inicio cierre capacitacion entrega soporte diligenciar' },
  { label: 'Seguimientos',        href: '/implementacion/seguimientos',      icon: Activity,        group: 'Implementación',  keywords: 'seguimiento tareas pendientes estado' },
  { label: 'Análisis (Proyectos)',href: '/implementacion/analisis',          icon: Sparkles,        group: 'Implementación',  keywords: 'analisis ia inteligencia artificial proyectos metricas' },

  // ── Requerimientos ─────────────────────────────────────────────
  { label: 'Registrar Req.',      href: '/requerimientos/nuevo',             icon: ClipboardPlus,   group: 'Requerimientos',  keywords: 'nuevo requerimiento ticket solicitud funcional' },
  { label: 'Priorizar Req.',      href: '/requerimientos/priorizar',         icon: ListOrdered,     group: 'Requerimientos',  keywords: 'priorizar listar tickets cola backlog' },
  { label: 'Análisis (Req.)',     href: '/requerimientos/analisis',          icon: BarChart3,       group: 'Requerimientos',  keywords: 'analisis requerimientos tickets estadisticas' },

  // ── Comercial ──────────────────────────────────────────────────
  { label: 'Cotizaciones',        href: '/comercial/cotizaciones',           icon: FileSpreadsheet, group: 'Comercial',       keywords: 'cotizaciones propuestas precios valor comercial ventas' },
];

const GROUPS = ['Navegación', 'Implementación', 'Requerimientos', 'Comercial'];

// Normaliza texto: quita tildes y pasa a minúsculas
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

interface Props { open: boolean; onClose: () => void; }

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery]       = useState('');
  const [selected, setSelected] = useState(0);
  const router                  = useRouter();
  const inputRef                = useRef<HTMLInputElement>(null);
  const { theme }               = useTheme();
  const isLight                 = theme === 'light';

  const q = normalize(query);

  const filtered = COMMANDS.filter(c => {
    if (!q) return true;
    return (
      normalize(c.label).includes(q) ||
      normalize(c.group).includes(q) ||
      (c.keywords ? normalize(c.keywords).includes(q) : false)
    );
  });

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const go = useCallback((href: string) => {
    router.push(href);
    onClose();
  }, [router, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape')    { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && filtered[selected]) go(filtered[selected].href);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selected, go, onClose]);

  const panelBg     = isLight ? 'rgba(255,255,255,0.98)' : 'rgba(10,16,32,0.97)';
  const panelBorder = isLight ? 'rgba(15,23,42,0.10)'    : 'rgba(255,255,255,0.10)';
  const divider     = isLight ? 'rgba(15,23,42,0.07)'    : 'rgba(255,255,255,0.07)';

  // Resalta la parte que coincide con la búsqueda
  function highlight(text: string) {
    if (!q) return <span>{text}</span>;
    const norm = normalize(text);
    const idx  = norm.indexOf(q);
    if (idx === -1) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, idx)}
        <mark style={{ background: 'rgba(59,130,246,0.25)', color: 'var(--accent-blue)', borderRadius: 3, padding: '0 1px' }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </span>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ background: isLight ? 'rgba(15,23,42,0.30)' : 'rgba(0,0,0,0.70)', backdropFilter: 'blur(10px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-[560px] rounded-2xl overflow-hidden"
            style={{
              background: panelBg,
              border: `1px solid ${panelBorder}`,
              boxShadow: '0 32px 72px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.03)',
              backdropFilter: 'blur(48px) saturate(200%)',
            }}
            initial={{ opacity: 0, scale: 0.94, y: -16 }}
            animate={{ opacity: 1, scale: 1,    y: 0   }}
            exit   ={{ opacity: 0, scale: 0.94, y: -16 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Search row */}
            <div className="flex items-center gap-3 px-4 py-3.5"
              style={{ borderBottom: `1px solid ${divider}` }}>
              <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(0); }}
                placeholder="Buscar módulo, pantalla, acción..."
                className="flex-1 bg-transparent outline-none text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              />
              <div className="flex items-center gap-1.5">
                {query && (
                  <button onClick={() => { setQuery(''); setSelected(0); inputRef.current?.focus(); }}
                    className="p-1 rounded-lg transition-colors hover:bg-white/10"
                    style={{ color: 'var(--text-muted)' }}>
                    <X className="w-3 h-3" />
                  </button>
                )}
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: 'var(--border-subtle)', color: 'var(--text-muted)', border: `1px solid ${divider}` }}>
                  ESC
                </kbd>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Sin resultados para «{query}»
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Intenta con otro término
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {GROUPS.map(group => {
                    const items = filtered.filter(c => c.group === group);
                    if (!items.length) return null;
                    return (
                      <div key={group} className="mb-1">
                        <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                          style={{ color: 'var(--text-muted)' }}>
                          {group}
                        </p>
                        {items.map(cmd => {
                          const idx  = filtered.indexOf(cmd);
                          const Icon = cmd.icon;
                          const isSelected = selected === idx;
                          return (
                            <motion.button
                              key={cmd.href}
                              onClick={() => go(cmd.href)}
                              onMouseEnter={() => setSelected(idx)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl text-left transition-colors"
                              style={{
                                width: 'calc(100% - 8px)',
                                background: isSelected
                                  ? isLight ? 'rgba(37,99,235,0.08)' : 'rgba(59,130,246,0.12)'
                                  : 'transparent',
                              }}
                              whileHover={{ x: 2 }}
                              transition={{ duration: 0.1 }}
                            >
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                                style={{
                                  background: isSelected
                                    ? isLight ? 'rgba(37,99,235,0.15)' : 'rgba(59,130,246,0.20)'
                                    : isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)',
                                }}>
                                <Icon className="w-3.5 h-3.5 transition-colors"
                                  style={{ color: isSelected ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
                              </div>
                              <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                                {highlight(cmd.label)}
                              </span>
                              {cmd.shortcut && (
                                <span className="text-[10px] font-mono hidden sm:block"
                                  style={{ color: 'var(--text-muted)' }}>
                                  {cmd.shortcut}
                                </span>
                              )}
                              {isSelected && (
                                <motion.div
                                  initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.1 }}>
                                  <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--accent-blue)' }} />
                                </motion.div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2 text-[11px]"
              style={{ borderTop: `1px solid ${divider}`, color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1">
                <kbd className="font-mono px-1 rounded" style={{ background: 'var(--border-subtle)' }}>↑↓</kbd>
                navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono px-1 rounded" style={{ background: 'var(--border-subtle)' }}>↵</kbd>
                abrir
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono px-1 rounded" style={{ background: 'var(--border-subtle)' }}>esc</kbd>
                cerrar
              </span>
              <span className="ml-auto font-medium" style={{ color: 'var(--accent-blue)' }}>
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
