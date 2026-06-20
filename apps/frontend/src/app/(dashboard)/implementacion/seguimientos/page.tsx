'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Activity, Search, X, RefreshCw, Building2,
  Layers, AlignLeft, CalendarDays, GitBranch, TrendingDown, BarChart3,
  CheckCircle2, Clock, AlertCircle,
  ChevronLeft, ChevronRight, User, Users, ChevronDown,
} from 'lucide-react';
import { projectsApi, usersApi } from '@/lib/api';
import type { User as UserType } from '@/types';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import type { Project, ProjectActivity, ProjectModule, ProjectPhase, ActivityStatus } from '@/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/es';
dayjs.locale('es');

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ViewMode = 'kanban' | 'gantt' | 'lista' | 'calendario' | 'timeline' | 'burndown';

interface FlatActivity extends ProjectActivity {
  moduleName: string;
  phaseName: string;
  phaseColor?: string;
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ActivityStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pendiente:   { label: 'Pendiente',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: Clock        },
  en_progreso: { label: 'En progreso', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  icon: Activity     },
  completado:  { label: 'Completado',  color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: CheckCircle2 },
  bloqueado:   { label: 'Bloqueado',   color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: AlertCircle  },
};

const PRIORITY_COLOR: Record<string, string> = {
  alta: '#f87171', media: '#fb923c', baja: '#60a5fa', critica: '#a78bfa',
};

const VIEWS: { key: ViewMode; label: string; icon: React.ElementType }[] = [
  { key: 'kanban',    label: 'Kanban',    icon: Layers         },
  { key: 'gantt',     label: 'Gantt',     icon: BarChart3      },
  { key: 'lista',     label: 'Lista',     icon: AlignLeft      },
  { key: 'calendario',label: 'Calendario',icon: CalendarDays   },
  { key: 'timeline',  label: 'Timeline',  icon: GitBranch      },
  { key: 'burndown',  label: 'Burndown',  icon: TrendingDown   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenActivities(modules: ProjectModule[]): FlatActivity[] {
  const result: FlatActivity[] = [];
  for (const mod of modules) {
    for (const phase of (mod.phases ?? [])) {
      for (const act of (phase.activities ?? [])) {
        result.push({ ...act, moduleName: mod.name, phaseName: phase.name, phaseColor: phase.color });
      }
    }
  }
  return result;
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return dayjs(d).format('DD MMM YY');
}

// ── Tarjeta de actividad (usada en Kanban y Timeline) ────────────────────────

function ActivityCard({ act, compact = false }: { act: FlatActivity; compact?: boolean }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const cfg = STATUS_CFG[act.status];
  const border = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
  const surface = isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)';

  return (
    <div className="rounded-xl p-3 space-y-1.5 transition-all hover:shadow-md"
      style={{ background: surface, border: `1px solid ${border}` }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold leading-snug flex-1" style={{ color: 'var(--text-primary)' }}>{act.name}</p>
        {act.priority && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
            style={{ background: `${PRIORITY_COLOR[act.priority] ?? '#60a5fa'}20`, color: PRIORITY_COLOR[act.priority] ?? '#60a5fa' }}>
            {act.priority}
          </span>
        )}
      </div>
      {!compact && (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{act.moduleName} › {act.phaseName}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{cfg.label}</span>
        </div>
        {act.progressPercent !== undefined && (
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.2)' }}>
              <div className="h-full rounded-full" style={{ width: `${act.progressPercent}%`, background: cfg.color }} />
            </div>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{act.progressPercent}%</span>
          </div>
        )}
      </div>
      {!compact && act.assignedTo && (
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {act.assignedTo.firstName} {act.assignedTo.lastName}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Vista: Kanban (con Drag-and-Drop interactivo) ────────────────────────────

function KanbanView({ activities, onActivityUpdate }: { activities: FlatActivity[]; onActivityUpdate: (id: string, status: ActivityStatus) => void }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const COLS = ['pendiente', 'en_progreso', 'completado', 'bloqueado'] as ActivityStatus[];
  const border = isLight ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.06)';

  const [grouped, setGrouped] = useState<Record<ActivityStatus, FlatActivity[]>>(() =>
    COLS.reduce((acc, s) => ({ ...acc, [s]: activities.filter(a => a.status === s) }), {} as Record<ActivityStatus, FlatActivity[]>)
  );
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setGrouped(COLS.reduce((acc, s) => ({ ...acc, [s]: activities.filter(a => a.status === s) }), {} as Record<ActivityStatus, FlatActivity[]>));
  }, [activities]);

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const srcCol  = source.droppableId as ActivityStatus;
    const dstCol  = destination.droppableId as ActivityStatus;
    const srcItems = Array.from(grouped[srcCol]);
    const dstItems = Array.from(grouped[dstCol]);
    const [moved]  = srcItems.splice(source.index, 1);
    dstItems.splice(destination.index, 0, { ...moved, status: dstCol });

    setGrouped(g => ({ ...g, [srcCol]: srcItems, [dstCol]: dstItems }));
    setSaving(draggableId);

    try {
      await projectsApi.updateActivity(draggableId, { status: dstCol });
      onActivityUpdate(draggableId, dstCol);
      toast.success(`Actividad movida a "${STATUS_CFG[dstCol].label}"`);
    } catch {
      setGrouped(g => {
        const rollbackSrc = Array.from(g[srcCol]);
        const rollbackDst = Array.from(g[dstCol]);
        const [rb] = rollbackDst.splice(destination.index, 1);
        rollbackSrc.splice(source.index, 0, { ...rb, status: srcCol });
        return { ...g, [srcCol]: rollbackSrc, [dstCol]: rollbackDst };
      });
      toast.error('Error al actualizar el estado');
    } finally {
      setSaving(null);
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {COLS.map(col => {
          const cfg  = STATUS_CFG[col];
          const Icon = cfg.icon;
          const items = grouped[col];
          return (
            <div key={col} className="flex-shrink-0 w-72 flex flex-col rounded-2xl overflow-hidden"
              style={{ background: isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.02)', border: `1px solid ${border}` }}>
              <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${border}` }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: cfg.bg }}>
                  <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                </div>
                <span className="text-xs font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{cfg.label}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{items.length}</span>
              </div>
              <Droppable droppableId={col}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px] transition-colors"
                    style={{ background: snapshot.isDraggingOver ? cfg.bg : 'transparent' }}
                  >
                    {items.length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>Sin actividades</p>
                    )}
                    {items.map((a, index) => (
                      <Draggable key={a.id} draggableId={a.id} index={index}>
                        {(drag, snap) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            style={{
                              ...drag.draggableProps.style,
                              opacity: saving === a.id ? 0.5 : 1,
                              transform: snap.isDragging ? drag.draggableProps.style?.transform : 'none',
                            }}
                          >
                            <ActivityCard act={a} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}

// ── Vista: Gantt ──────────────────────────────────────────────────────────────

function GanttView({ activities, project }: { activities: FlatActivity[]; project: Project }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const border = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';

  const start = dayjs(project.startDate);
  const end   = dayjs(project.endDate);
  const totalDays = Math.max(end.diff(start, 'day'), 1);

  const withDates = activities.filter(a => a.plannedStartDate || a.plannedEndDate || a.actualStartDate);

  function barStyle(act: FlatActivity) {
    const s = dayjs(act.actualStartDate ?? act.plannedStartDate ?? project.startDate);
    const e = dayjs(act.actualEndDate ?? act.plannedEndDate ?? act.actualStartDate ?? project.endDate);
    const left = Math.max(0, s.diff(start, 'day')) / totalDays * 100;
    const width = Math.max(0.5, Math.min(100 - left, e.diff(s, 'day') + 1) / totalDays * 100);
    return { left: `${left}%`, width: `${width}%` };
  }

  const months: string[] = [];
  let cur = start.startOf('month');
  while (cur.isBefore(end.endOf('month'))) {
    months.push(cur.format('MMM YY'));
    cur = cur.add(1, 'month');
  }

  const monthWidth = months.length ? 100 / months.length : 100;

  return (
    <div className="overflow-auto h-full">
      <div style={{ minWidth: 700 }}>
        {/* Month headers */}
        <div className="flex sticky top-0 z-10" style={{ background: isLight ? '#fff' : 'rgba(10,16,38,1)', borderBottom: `1px solid ${border}`, paddingLeft: 220 }}>
          {months.map(m => (
            <div key={m}
              className="text-[10px] font-semibold py-2 text-center border-r"
              style={{ width: `${monthWidth}%`, minWidth: 80, borderColor: border, color: 'var(--text-muted)' }}>
              {m}
            </div>
          ))}
        </div>

        {/* Rows */}
        {withDates.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay actividades con fechas planificadas</p>
          </div>
        ) : withDates.map(act => {
          const cfg = STATUS_CFG[act.status];
          const bar = barStyle(act);
          return (
            <div key={act.id} className="flex items-center h-9 border-b hover:bg-white/5 transition-colors" style={{ borderColor: border }}>
              <div className="w-[220px] shrink-0 px-3 flex flex-col justify-center">
                <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{act.name}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{act.moduleName}</p>
              </div>
              <div className="flex-1 relative h-full flex items-center">
                {/* Grid lines */}
                {months.map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-r" style={{ left: `${i * monthWidth}%`, borderColor: border, opacity: 0.4 }} />
                ))}
                <div className="absolute h-5 rounded-full flex items-center px-2" title={act.name}
                  style={{ ...bar, background: cfg.bg, border: `1px solid ${cfg.color}40`, minWidth: 6, transition: 'all 0.3s' }}>
                  {parseFloat(bar.width) > 3 && (
                    <span className="text-[9px] font-semibold truncate" style={{ color: cfg.color }}>{act.progressPercent}%</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Vista: Lista ──────────────────────────────────────────────────────────────

function ListaView({ activities }: { activities: FlatActivity[] }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [filter, setFilter] = useState<ActivityStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const border = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';

  const filtered = activities.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.moduleName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const inputStyle = {
    background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${border}`,
    color: 'var(--text-primary)',
    borderRadius: 10,
    padding: '7px 12px 7px 32px',
    fontSize: 12,
    outline: 'none',
    width: '100%',
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar actividad..." style={inputStyle} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {([['all', 'Todas', '#94a3b8'], ...Object.entries(STATUS_CFG).map(([k, v]) => [k, v.label, v.color])] as [string, string, string][]).map(([key, label, color]) => (
            <button key={key} onClick={() => setFilter(key as any)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{
                background: filter === key ? `${color}20` : 'transparent',
                color: filter === key ? color : 'var(--text-muted)',
                border: `1px solid ${filter === key ? `${color}40` : border}`,
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl" style={{ border: `1px solid ${border}` }}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)', borderBottom: `1px solid ${border}` }}>
              {['Actividad', 'Módulo', 'Fase', 'Estado', 'Prioridad', 'Progreso', 'Inicio', 'Fin', 'Asignado'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Sin resultados</td></tr>
            ) : filtered.map((a, i) => {
              const cfg = STATUS_CFG[a.status];
              return (
                <tr key={a.id} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: border }}>
                  <td className="px-3 py-2 font-medium max-w-[200px]">
                    <p className="truncate" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
                    {a.code && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{a.code}</p>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[120px]">
                    <p className="truncate" style={{ color: 'var(--text-secondary)' }}>{a.moduleName}</p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[120px]">
                    <p className="truncate" style={{ color: 'var(--text-secondary)' }}>{a.phaseName}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {a.priority && (
                      <span className="text-[10px] font-medium capitalize" style={{ color: PRIORITY_COLOR[a.priority] ?? '#60a5fa' }}>{a.priority}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.2)' }}>
                        <div className="h-full rounded-full" style={{ width: `${a.progressPercent}%`, background: cfg.color }} />
                      </div>
                      <span style={{ color: 'var(--text-muted)' }}>{a.progressPercent}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{fmtDate(a.plannedStartDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{fmtDate(a.plannedEndDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                    {a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Vista: Calendario ─────────────────────────────────────────────────────────

function CalendarioView({ activities }: { activities: FlatActivity[] }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const border = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';

  const startOfGrid = month.startOf('week');
  const endOfGrid   = month.endOf('month').endOf('week');
  const days: Dayjs[] = [];
  let cur = startOfGrid;
  while (cur.isBefore(endOfGrid) || cur.isSame(endOfGrid, 'day')) {
    days.push(cur);
    cur = cur.add(1, 'day');
  }

  function activitiesForDay(d: Dayjs): FlatActivity[] {
    return activities.filter(a => {
      const s = a.plannedStartDate ?? a.actualStartDate;
      const e = a.plannedEndDate ?? a.actualEndDate;
      if (!s) return false;
      const ds = dayjs(s); const de = e ? dayjs(e) : ds;
      return (d.isSame(ds, 'day') || d.isAfter(ds, 'day')) && (d.isSame(de, 'day') || d.isBefore(de, 'day'));
    });
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between shrink-0">
        <button onClick={() => setMonth(m => m.subtract(1, 'month'))} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
          {month.format('MMMM YYYY')}
        </h3>
        <button onClick={() => setMonth(m => m.add(1, 'month'))} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'var(--text-muted)' }}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 text-[10px] font-semibold text-center pb-1" style={{ color: 'var(--text-muted)' }}>
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-px" style={{ background: border }}>
          {days.map(d => {
            const isCurrentMonth = d.isSame(month, 'month');
            const isToday = d.isSame(dayjs(), 'day');
            const dayActs = activitiesForDay(d);
            return (
              <div key={d.format('YYYY-MM-DD')}
                className="min-h-[72px] p-1.5 flex flex-col gap-1"
                style={{ background: isLight ? '#fff' : 'rgba(10,16,38,1)', opacity: isCurrentMonth ? 1 : 0.4 }}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold self-end ${isToday ? 'text-white' : ''}`}
                  style={{ background: isToday ? '#2563EB' : 'transparent', color: isToday ? '#fff' : 'var(--text-muted)' }}>
                  {d.date()}
                </div>
                {dayActs.slice(0, 2).map(a => {
                  const cfg = STATUS_CFG[a.status];
                  return (
                    <div key={a.id} className="rounded px-1 py-0.5 text-[9px] font-medium truncate"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {a.name}
                    </div>
                  );
                })}
                {dayActs.length > 2 && (
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>+{dayActs.length - 2} más</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Vista: Timeline ───────────────────────────────────────────────────────────

function TimelineView({ activities }: { activities: FlatActivity[] }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const border = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';

  const sorted = [...activities]
    .filter(a => a.plannedStartDate || a.actualStartDate || a.plannedEndDate)
    .sort((a, b) => {
      const da = dayjs(a.plannedStartDate ?? a.actualStartDate ?? a.plannedEndDate);
      const db = dayjs(b.plannedStartDate ?? b.actualStartDate ?? b.plannedEndDate);
      return da.isBefore(db) ? -1 : 1;
    });

  const unsorted = activities.filter(a => !a.plannedStartDate && !a.actualStartDate && !a.plannedEndDate);

  function renderGroup(items: FlatActivity[], label?: string) {
    if (items.length === 0) return null;
    const groupedByDate: Record<string, FlatActivity[]> = {};
    if (label) {
      groupedByDate['Sin fecha'] = items;
    } else {
      for (const a of items) {
        const dateKey = dayjs(a.plannedStartDate ?? a.actualStartDate ?? a.plannedEndDate).format('DD MMM YYYY');
        if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
        groupedByDate[dateKey].push(a);
      }
    }

    return Object.entries(groupedByDate).map(([date, acts]) => (
      <div key={date} className="flex gap-4">
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full mt-1 shrink-0 z-10" style={{ background: '#2563EB', border: '2px solid #6366F1' }} />
          <div className="flex-1 w-px mt-1" style={{ background: border }} />
        </div>
        <div className="flex-1 pb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{date}</p>
          <div className="space-y-2">
            {acts.map(a => <ActivityCard key={a.id} act={a} compact />)}
          </div>
        </div>
      </div>
    ));
  }

  if (sorted.length === 0 && unsorted.length === 0) {
    return <div className="flex items-center justify-center h-full"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin actividades</p></div>;
  }

  return (
    <div className="overflow-y-auto h-full pr-2">
      <div className="max-w-2xl">
        {sorted.length > 0 && renderGroup(sorted)}
        {unsorted.length > 0 && renderGroup(unsorted, 'Sin fecha')}
      </div>
    </div>
  );
}

// ── Vista: Burndown ───────────────────────────────────────────────────────────

function BurndownView({ activities, project }: { activities: FlatActivity[]; project: Project }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const total = activities.length;
  const start = dayjs(project.startDate);
  const end   = dayjs(project.endDate);
  const today = dayjs();

  const days: { fecha: string; ideal: number; real: number | null }[] = [];
  const totalDays = Math.max(end.diff(start, 'day'), 1);

  for (let i = 0; i <= totalDays; i++) {
    const d = start.add(i, 'day');
    const ideal = Math.round(total - (total * i / totalDays));
    const isPast = d.isBefore(today) || d.isSame(today, 'day');

    let real: number | null = null;
    if (isPast) {
      const completedByDate = activities.filter(a =>
        a.status === 'completado' &&
        a.actualEndDate &&
        dayjs(a.actualEndDate).isBefore(d.add(1, 'day'))
      ).length;
      real = total - completedByDate;
    }

    days.push({ fecha: d.format('DD/MM'), ideal, real });
  }

  const tickInterval = Math.max(1, Math.floor(totalDays / 8));
  const chartData = days.filter((_, i) => i % tickInterval === 0 || i === totalDays);

  const completed = activities.filter(a => a.status === 'completado').length;
  const blocked   = activities.filter(a => a.status === 'bloqueado').length;
  const inProgress = activities.filter(a => a.status === 'en_progreso').length;

  const textColor = isLight ? '#475569' : '#94a3b8';
  const gridColor = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)';

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Total', value: total, color: '#94a3b8' },
          { label: 'Completadas', value: completed, color: '#34d399' },
          { label: 'En progreso', value: inProgress, color: '#60a5fa' },
          { label: 'Bloqueadas', value: blocked, color: '#f87171' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center"
            style={{ background: `${s.color}12`, border: `1px solid ${s.color}30` }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="burnIdeal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="burnReal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: textColor }} />
            <YAxis tick={{ fontSize: 10, fill: textColor }} />
            <Tooltip
              contentStyle={{ background: isLight ? '#fff' : 'rgba(10,16,38,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: textColor }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: textColor }} />
            <Area type="monotone" dataKey="ideal" name="Ideal" stroke="#94a3b8" fill="url(#burnIdeal)" strokeDasharray="6 3" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="real"  name="Real"  stroke="#2563EB" fill="url(#burnReal)" strokeWidth={2} dot={false} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="shrink-0 text-center">
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Proyecto {fmtDate(project.startDate)} → {fmtDate(project.endDate)} · {Math.max(0, today.diff(start, 'day'))} días transcurridos de {totalDays}
        </p>
      </div>
    </div>
  );
}

// ── Selector de proyecto ──────────────────────────────────────────────────────

function ProjectSelector({ value, onChange }: { value: Project | null; onChange: (p: Project | null) => void }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(false);
  const [results, setResults] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const border  = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)';
  const surface = isLight ? '#FFFFFF' : 'rgba(10,18,42,0.98)';
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      setLoading(true);
      projectsApi.list({ search, limit: 10 })
        .then(r => setResults(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
  }, [search, open]);

  function select(p: Project) { onChange(p); setOpen(false); setSearch(''); }

  const inputStyle = {
    background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${border}`,
    color: 'var(--text-primary)',
    borderRadius: 12,
    padding: '10px 14px 10px 38px',
    width: '100%',
    fontSize: 13,
    outline: 'none',
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input
          value={value ? `${value.name} — ${value.serviceOrder?.client?.businessName ?? ''}` : search}
          onChange={e => { setSearch(e.target.value); setOpen(true); if (value) onChange(null); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar proyecto..."
          style={inputStyle}
        />
        {value && (
          <button onClick={() => { onChange(null); setSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && !value && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
              style={{ background: surface, border: `1px solid ${border}`, boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }}>
              {loading ? (
                <div className="flex items-center justify-center py-6"><RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
              ) : results.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Sin resultados</p>
              ) : results.map(p => (
                <button key={p.id} onClick={() => select(p)} className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(96,165,250,0.12)' }}>
                    <Building2 className="w-3.5 h-3.5" style={{ color: '#60a5fa' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.serviceOrder?.client?.businessName ?? '—'} · {p.status}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

// ── Selector de agente ────────────────────────────────────────────────────────

function AgentSelector({ value, onChange, border, surface }: {
  value: UserType | null;
  onChange: (u: UserType | null) => void;
  border: string;
  surface: string;
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [open, setOpen]     = useState(false);
  const [agents, setAgents] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    usersApi.listAgents({ limit: 50 })
      .then(r => setAgents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const dropSurface = isLight ? '#FFFFFF' : 'rgba(10,18,42,0.98)';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
        style={{ background: value ? 'rgba(99,102,241,0.15)' : surface, border: `1px solid ${border}`, color: value ? '#818cf8' : 'var(--text-muted)' }}>
        <User className="w-3.5 h-3.5" />
        {value ? `${value.firstName} ${value.lastName}` : 'Seleccionar agente'}
        <ChevronDown className="w-3 h-3" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="absolute top-full left-0 mt-1 min-w-[200px] rounded-xl overflow-hidden z-20"
              style={{ background: dropSurface, border: `1px solid ${border}`, boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }}>
              {value && (
                <button onClick={() => { onChange(null); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs transition-colors hover:bg-white/5"
                  style={{ color: '#f87171' }}>
                  <X className="w-3 h-3" /> Quitar filtro
                </button>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : agents.map(a => (
                <button key={a.id} onClick={() => { onChange(a); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                  style={{ background: value?.id === a.id ? 'rgba(99,102,241,0.1)' : undefined }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
                    {(a.firstName?.[0] ?? '') + (a.lastName?.[0] ?? '')}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    {a.firstName} {a.lastName}
                  </span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function SeguimientosPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [project, setProject]       = useState<Project | null>(null);
  const [allActivities, setAllActivities] = useState<FlatActivity[]>([]);
  const [loading, setLoading]       = useState(false);
  const [view, setView]             = useState<ViewMode>('kanban');
  const [agentMode, setAgentMode]   = useState<'all' | 'agent'>('all');
  const [selectedAgent, setSelectedAgent] = useState<UserType | null>(null);
  const border  = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)';
  const surface = isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)';

  const loadProject = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const p = await projectsApi.get(id);
      setAllActivities(flattenActivities(p.modules ?? []));
    } catch { toast.error('Error al cargar el proyecto'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (project?.id) loadProject(project.id);
    else setAllActivities([]);
  }, [project, loadProject]);

  const activities = agentMode === 'agent' && selectedAgent
    ? allActivities.filter(a => (a as any).assignedToId === selectedAgent.id)
    : allActivities;

  function handleActivityUpdate(id: string, status: ActivityStatus) {
    setAllActivities(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
            <Activity className="w-5 h-5" style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Seguimientos</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Visualización de actividades del proyecto en 6 modelos</p>
          </div>
        </div>
      </div>

      {/* Selector de proyecto */}
      <div className="px-6 pb-3 shrink-0">
        <ProjectSelector value={project} onChange={p => { setProject(p); setView('kanban'); }} />
      </div>

      {!project ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.08)', border: `1px solid ${border}` }}>
            <Activity className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Selecciona un proyecto para ver sus actividades</p>
        </div>
      ) : (
        <>
          {/* Info + filtro agente */}
          <div className="px-6 pb-3 shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {project.serviceOrder?.client?.businessName}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {activities.length}{agentMode === 'agent' ? `/${allActivities.length}` : ''} actividades
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${project.progressPercent}%`, background: 'linear-gradient(90deg,#2563EB,#6366F1)' }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{project.progressPercent}%</span>
                </div>
              </div>

              {/* Toggle todos / por agente */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: surface, border: `1px solid ${border}` }}>
                  <button onClick={() => { setAgentMode('all'); setSelectedAgent(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: agentMode === 'all' ? (isLight ? 'rgba(37,99,235,0.1)' : 'rgba(96,165,250,0.12)') : 'transparent',
                      color: agentMode === 'all' ? (isLight ? '#2563EB' : '#60a5fa') : 'var(--text-muted)',
                    }}>
                    <Users className="w-3.5 h-3.5" /> Todos
                  </button>
                  <button onClick={() => setAgentMode('agent')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: agentMode === 'agent' ? (isLight ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.15)') : 'transparent',
                      color: agentMode === 'agent' ? '#818cf8' : 'var(--text-muted)',
                    }}>
                    <User className="w-3.5 h-3.5" /> Por agente
                  </button>
                </div>

                {agentMode === 'agent' && (
                  <AgentSelector
                    value={selectedAgent}
                    onChange={setSelectedAgent}
                    border={border}
                    surface={surface}
                  />
                )}

                <button onClick={() => project && loadProject(project.id)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* View selector tabs */}
          <div className="px-6 shrink-0">
            <div className="flex gap-1 p-1 rounded-xl"
              style={{ background: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.04)', border: `1px solid ${border}` }}>
              {VIEWS.map(v => {
                const Icon = v.icon;
                const active = view === v.key;
                return (
                  <button key={v.key} onClick={() => setView(v.key)}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center"
                    style={{ color: active ? (isLight ? '#2563EB' : '#60a5fa') : 'var(--text-muted)' }}>
                    {active && (
                      <motion.div layoutId="seg-view-bg" className="absolute inset-0 rounded-lg"
                        style={{ background: isLight ? 'rgba(37,99,235,0.10)' : 'rgba(96,165,250,0.12)' }} />
                    )}
                    <Icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10 hidden sm:inline">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* View content */}
          <div className="flex-1 min-h-0 px-6 pt-4 pb-6 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full">
                  {view === 'kanban'     && <KanbanView     activities={activities} onActivityUpdate={handleActivityUpdate} />}
                  {view === 'gantt'      && <GanttView      activities={activities} project={project} />}
                  {view === 'lista'      && <ListaView      activities={activities} />}
                  {view === 'calendario' && <CalendarioView activities={activities} />}
                  {view === 'timeline'   && <TimelineView   activities={activities} />}
                  {view === 'burndown'   && <BurndownView   activities={activities} project={project} />}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </>
      )}
    </div>
  );
}
