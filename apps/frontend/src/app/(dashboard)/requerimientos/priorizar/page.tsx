'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  ListOrdered, ArrowUp, ArrowDown, Plus, GripVertical,
  ChevronDown, Clock, Send, X
} from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type Prioridad = 'Crítico' | 'Alta' | 'Media' | 'Baja';
type Estado = 'Elaborado' | 'Priorizado' | 'Devuelto' | 'Negado' | 'Repriorizado' | 'Entregado';

interface HistorialItem {
  fecha: string;
  estado: Estado;
  observacion: string;
  usuario: string;
}

interface Requerimiento {
  id: number;
  titulo: string;
  tipo: string;
  prioridad: Prioridad;
  modulo: string;
  cliente: string;
  solicitante: string;
  implementador: string;
  estadoActual: Estado;
  historial: HistorialItem[];
}

// ── Estilos por prioridad ─────────────────────────────────────────────────────
const PRIORIDAD_STYLE: Record<Prioridad, { color: string; bg: string; icon: string }> = {
  Crítico: { color: '#dc2626', bg: 'rgba(220,38,38,0.13)',  icon: '🔴' },
  Alta:    { color: '#f97316', bg: 'rgba(249,115,22,0.13)', icon: '🟠' },
  Media:   { color: '#eab308', bg: 'rgba(234,179,8,0.12)',  icon: '🟡' },
  Baja:    { color: '#22c55e', bg: 'rgba(34,197,94,0.11)',  icon: '🟢' },
};

// ── Estilos por estado ────────────────────────────────────────────────────────
const ESTADO_STYLE: Record<Estado, { color: string; bg: string; dot: string }> = {
  Elaborado:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   dot: '#60a5fa' },
  Priorizado:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', dot: '#a78bfa' },
  Devuelto:     { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',   dot: '#fb923c' },
  Negado:       { color: '#f87171', bg: 'rgba(248,113,113,0.12)',  dot: '#f87171' },
  Repriorizado: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   dot: '#fbbf24' },
  Entregado:    { color: '#34d399', bg: 'rgba(52,211,153,0.11)',   dot: '#34d399' },
};

const ESTADOS: Estado[] = ['Elaborado','Priorizado','Devuelto','Negado','Repriorizado','Entregado'];

// ── Datos de demo ─────────────────────────────────────────────────────────────
const DEMO: Requerimiento[] = [
  {
    id: 1, titulo: 'Módulo facturación electrónica', tipo: 'Funcional',
    prioridad: 'Crítico', modulo: 'Facturación', cliente: 'Hospital San Jorge',
    solicitante: 'Carlos Anillo', implementador: 'Laura P.', estadoActual: 'Priorizado',
    historial: [
      { fecha: '2026-05-20', estado: 'Elaborado',  observacion: 'Requerimiento inicial documentado por el cliente.', usuario: 'Carlos A.' },
      { fecha: '2026-05-27', estado: 'Priorizado', observacion: 'Aprobado en reunión semanal. Alta urgencia por cierre fiscal.', usuario: 'Laura P.' },
    ],
  },
  {
    id: 2, titulo: 'Integración con RIPS', tipo: 'Integración',
    prioridad: 'Crítico', modulo: 'Salud', cliente: 'Clínica Los Andes',
    solicitante: 'Yaneth Pulgar', implementador: 'Juan M.', estadoActual: 'Repriorizado',
    historial: [
      { fecha: '2026-05-15', estado: 'Elaborado',    observacion: 'Levantamiento de requerimiento con el área de sistemas.', usuario: 'Yaneth P.' },
      { fecha: '2026-05-22', estado: 'Priorizado',   observacion: 'Primera priorización: semana 21.', usuario: 'Juan M.' },
      { fecha: '2026-05-29', estado: 'Devuelto',     observacion: 'Devuelto por inconsistencias en el mapeo de campos RIPS.', usuario: 'Ana R.' },
      { fecha: '2026-06-03', estado: 'Repriorizado', observacion: 'Correcciones aplicadas. Reprogramado para semana 23.', usuario: 'Juan M.' },
    ],
  },
  {
    id: 3, titulo: 'Reporte de glosas automático', tipo: 'Funcional',
    prioridad: 'Alta', modulo: 'Reportes', cliente: 'Hospital San Jorge',
    solicitante: 'Carlos Anillo', implementador: 'Laura P.', estadoActual: 'Priorizado',
    historial: [
      { fecha: '2026-05-28', estado: 'Elaborado',  observacion: 'Definición de estructura del reporte con el área financiera.', usuario: 'Carlos A.' },
      { fecha: '2026-06-02', estado: 'Priorizado', observacion: 'Incluido en sprint semana 23.', usuario: 'Laura P.' },
    ],
  },
  {
    id: 4, titulo: 'Exportar historia clínica PDF', tipo: 'Mejora',
    prioridad: 'Alta', modulo: 'Clínico', cliente: 'Clínica Los Andes',
    solicitante: 'Yaneth Pulgar', implementador: 'Ana R.', estadoActual: 'Negado',
    historial: [
      { fecha: '2026-05-20', estado: 'Elaborado', observacion: 'Solicitud del área médica para exportación de historial.', usuario: 'Yaneth P.' },
      { fecha: '2026-05-27', estado: 'Negado',    observacion: 'No aplica en el alcance del contrato actual. Requiere adición.', usuario: 'Admin' },
    ],
  },
  {
    id: 5, titulo: 'Dashboard de indicadores KPI', tipo: 'Funcional',
    prioridad: 'Media', modulo: 'Dashboard', cliente: 'Hospital San Jorge',
    solicitante: 'Admin', implementador: 'Juan M.', estadoActual: 'Entregado',
    historial: [
      { fecha: '2026-05-10', estado: 'Elaborado',  observacion: 'Definición de KPIs con gerencia.', usuario: 'Admin' },
      { fecha: '2026-05-17', estado: 'Priorizado', observacion: 'Sprint semana 20.', usuario: 'Juan M.' },
      { fecha: '2026-05-24', estado: 'Entregado',  observacion: 'Dashboard entregado y validado por el cliente.', usuario: 'Juan M.' },
    ],
  },
  {
    id: 6, titulo: 'Notificaciones por correo M365', tipo: 'Mejora',
    prioridad: 'Baja', modulo: 'Notif.', cliente: 'Clínica Los Andes',
    solicitante: 'Yaneth Pulgar', implementador: 'Laura P.', estadoActual: 'Elaborado',
    historial: [
      { fecha: '2026-06-01', estado: 'Elaborado', observacion: 'Requerimiento registrado. Pendiente de priorizar.', usuario: 'Yaneth P.' },
    ],
  },
];

type Filtro = 'Todos' | Prioridad;

// ── Tooltips Recharts ─────────────────────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(10,20,40,0.97)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:10, padding:'8px 14px' }}>
      <p style={{ color:'#e2e8f0', fontSize:12, fontWeight:600 }}>{label}</p>
      <p style={{ color:'#60a5fa', fontSize:13, fontWeight:700 }}>{payload[0].value} tickets</p>
    </div>
  );
};

const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.06) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  return (
    <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
      textAnchor="middle" dominantBaseline="central"
      style={{ fontSize:11, fontWeight:700, fill:'#fff', pointerEvents:'none' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function PriorizarRequerimientosPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [items, setItems]         = useState<Requerimiento[]>(DEMO);
  const [filter, setFilter]       = useState<Filtro>('Todos');
  const [expanded, setExpanded]   = useState<number[]>([]);

  // Filtros adicionales
  const [fCliente, setFCliente]           = useState('');
  const [fModulo, setFModulo]             = useState('');
  const [fImplementador, setFImplementador] = useState('');
  const [fPrioridad, setFPrioridad]       = useState('');

  // Opciones únicas para los selects
  const clientes       = [...new Set(DEMO.map(r => r.cliente))].sort();
  const modulos        = [...new Set(DEMO.map(r => r.modulo))].sort();
  const implementadores = [...new Set(DEMO.map(r => r.implementador))].sort();
  const prioridades    = ['Crítico','Alta','Media','Baja'] as Prioridad[];

  const activeFilters = [fCliente, fModulo, fImplementador, fPrioridad].filter(Boolean).length;

  const clearFilters = () => { setFCliente(''); setFModulo(''); setFImplementador(''); setFPrioridad(''); setFilter('Todos'); };

  // Modal nueva gestión
  const [modalTicket, setModalTicket] = useState<Requerimiento | null>(null);
  const [gestion, setGestion] = useState({ estado: 'Priorizado' as Estado, observacion: '', fecha: new Date().toISOString().split('T')[0] });
  const [savingGestion, setSavingGestion] = useState(false);

  const glass = (op = 0.75) => ({
    background: isLight ? `rgba(255,255,255,${op})` : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? `0 8px 32px rgba(30,60,120,0.15), inset 0 1px 0 rgba(255,255,255,0.98)`
      : `0 8px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)`,
  });
  const rowBorder = isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)';
  const tc = isLight
    ? { p:'#0a1628', s:'#1a3050', m:'#4a6080' }
    : { p:'#e2e8f0', s:'#94a3b8', m:'#6b82a0' };
  const axisColor = tc.m;

  const toggleExpand = (id: number) =>
    setExpanded(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const t = idx + dir;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    setItems(next);
  };

  const handleAddGestion = () => {
    if (!gestion.observacion.trim()) { toast.error('La observación es obligatoria'); return; }
    setSavingGestion(true);
    setTimeout(() => {
      setItems(prev => prev.map(r => {
        if (r.id !== modalTicket?.id) return r;
        return {
          ...r,
          estadoActual: gestion.estado,
          historial: [...r.historial, { fecha: gestion.fecha, estado: gestion.estado, observacion: gestion.observacion, usuario: 'Admin' }],
        };
      }));
      toast.success('Gestión registrada exitosamente');
      setModalTicket(null);
      setGestion({ estado: 'Priorizado', observacion: '', fecha: new Date().toISOString().split('T')[0] });
      setSavingGestion(false);
    }, 500);
  };

  const visible = items.filter(r => {
    if (filter !== 'Todos' && r.prioridad !== filter) return false;
    if (fCliente       && r.cliente       !== fCliente)       return false;
    if (fModulo        && r.modulo        !== fModulo)         return false;
    if (fImplementador && r.implementador !== fImplementador) return false;
    if (fPrioridad     && r.prioridad     !== fPrioridad)     return false;
    return true;
  });

  // Datos gráficos — basados en visible (afectados por filtros)
  const implMap: Record<string,number> = {};
  visible.forEach(r => { implMap[r.implementador] = (implMap[r.implementador] ?? 0) + 1; });
  const barData = Object.entries(implMap).map(([name,value]) => ({ name, value }));

  const prioMap: Record<string,number> = { Crítico:0,Alta:0,Media:0,Baja:0 };
  visible.forEach(r => { prioMap[r.prioridad] = (prioMap[r.prioridad] ?? 0) + 1; });
  const pieData = Object.entries(prioMap).filter(([,v]) => v > 0)
    .map(([name,value]) => ({ name, value, color: PRIORIDAD_STYLE[name as Prioridad].color }));

  return (
    <div className="space-y-5 max-w-6xl">
      <BackButton href="/requerimientos/nuevo" label="Registrar nuevo" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-xl flex items-center gap-2" style={{ color: tc.p }}>
            <ListOrdered className="w-5 h-5 text-violet-400" /> Priorizar Requerimientos
          </h2>
          <p className="text-sm mt-1" style={{ color: tc.m }}>Priorización semanal — cada ticket mantiene su cronología de cambios.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Enviar priorización */}
          <motion.button
            whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
            onClick={() => toast.success(`Priorización enviada — ${visible.length} ticket${visible.length !== 1 ? 's' : ''} notificados`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: isLight ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.12)',
              border: '1px solid rgba(52,211,153,0.40)',
              color: '#34d399',
              boxShadow: '0 2px 12px rgba(52,211,153,0.15)',
            }}>
            <Send className="w-4 h-4" /> Enviar
          </motion.button>

          {/* Nuevo requerimiento */}
          <Link href="/requerimientos/nuevo">
            <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
              className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-medium">
              <Plus className="w-4 h-4" /> Nuevo
            </motion.button>
          </Link>
        </div>
      </div>

      {/* ── Panel de filtros — ENCIMA de los gráficos ───────────────── */}
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
        className="rounded-2xl p-4" style={glass(0.65)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color:tc.m }}>Filtros</span>
            {activeFilters > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background:'rgba(96,165,250,0.15)', color:'#60a5fa' }}>
                {activeFilters} activo{activeFilters > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {activeFilters > 0 && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color:'#f87171' }}>
              <X className="w-3.5 h-3.5" /> Limpiar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color:tc.m }}>Cliente</label>
            <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
              value={fCliente} onChange={e => setFCliente(e.target.value)}>
              <option value="">Todos</option>
              {clientes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color:tc.m }}>Módulo</label>
            <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
              value={fModulo} onChange={e => setFModulo(e.target.value)}>
              <option value="">Todos</option>
              {modulos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color:tc.m }}>Implementador</label>
            <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
              value={fImplementador} onChange={e => setFImplementador(e.target.value)}>
              <option value="">Todos</option>
              {implementadores.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color:tc.m }}>Prioridad</label>
            <select className="input-glass w-full rounded-xl px-3 py-2 text-xs"
              value={fPrioridad} onChange={e => { setFPrioridad(e.target.value); setFilter('Todos'); }}>
              <option value="">Todas</option>
              {prioridades.map(p => (
                <option key={p} value={p}>{PRIORIDAD_STYLE[p].icon} {p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 pt-3 flex items-center justify-between"
          style={{ borderTop:`1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
          <span className="text-xs" style={{ color:tc.m }}>
            Mostrando <strong style={{ color:tc.s }}>{visible.length}</strong> de <strong style={{ color:tc.s }}>{items.length}</strong> requerimientos
          </span>
          <span className="text-[10px] italic" style={{ color:tc.m }}>
            Los gráficos reflejan la selección activa
          </span>
        </div>
      </motion.div>

      {/* Gráficos — responden a los filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}
          className="rounded-2xl p-5" style={glass()}>
          <p className="text-sm font-semibold mb-1" style={{ color:tc.p }}>Tickets por implementador</p>
          <p className="text-xs mb-4" style={{ color:tc.m }}>
            {visible.length} ticket{visible.length !== 1 ? 's' : ''} en la selección actual
          </p>
          {barData.length === 0
            ? <div className="h-[170px] flex items-center justify-center text-sm" style={{ color:tc.m }}>Sin datos para los filtros aplicados</div>
            : <ResponsiveContainer width="100%" height={170}>
                <BarChart data={barData} barCategoryGap="35%">
                  <XAxis dataKey="name" tick={{ fill:axisColor, fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill:axisColor, fontSize:11 }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="value" radius={[8,8,0,0]}>
                    {barData.map((_,i) => <Cell key={i} fill={['#60a5fa','#a78bfa','#34d399','#fbbf24'][i%4]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </motion.div>

        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
          className="rounded-2xl p-5" style={glass()}>
          <p className="text-sm font-semibold mb-1" style={{ color:tc.p }}>Distribución por prioridad</p>
          <p className="text-xs mb-1" style={{ color:tc.m }}>
            {visible.length} ticket{visible.length !== 1 ? 's' : ''} en la selección actual
          </p>
          {pieData.length === 0
            ? <div className="h-[185px] flex items-center justify-center text-sm" style={{ color:tc.m }}>Sin datos para los filtros aplicados</div>
            : <ResponsiveContainer width="100%" height={185}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={68} innerRadius={36}
                    dataKey="value" labelLine={false} label={renderPieLabel}>
                    {pieData.map((e,i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8}
                    formatter={(v) => <span style={{ fontSize:12, color:tc.s }}>{v}</span>} />
                  <Tooltip
                    formatter={(value,name) => [
                      <span style={{ color:'#e2e8f0', fontWeight:700 }}>{value as number} tickets</span>,
                      <span style={{ color:PRIORIDAD_STYLE[name as Prioridad]?.color }}>{name}</span>,
                    ]}
                    contentStyle={{ background:'rgba(10,20,40,0.97)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
          }
        </motion.div>
      </div>

      {/* Filtros rápidos de prioridad — chips glass */}
      <div className="flex gap-2 flex-wrap">
        {(['Todos','Crítico','Alta','Media','Baja'] as Filtro[]).map(f => {
          const ps   = f !== 'Todos' ? PRIORIDAD_STYLE[f] : null;
          const count = f === 'Todos' ? items.length : items.filter(r => r.prioridad === f).length;
          const active = filter === f;
          const accentColor = ps ? ps.color : '#60a5fa';
          const accentBg    = ps ? ps.bg    : 'rgba(96,165,250,0.15)';

          return (
            <motion.button key={f}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setFilter(f); setFPrioridad(''); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all"
              style={{
                background: active
                  ? isLight
                    ? `rgba(255,255,255,0.82)`
                    : accentBg
                  : isLight
                    ? 'rgba(255,255,255,0.55)'
                    : 'rgba(255,255,255,0.06)',
                border: `1px solid ${active
                  ? isLight ? `${accentColor}60` : `${accentColor}70`
                  : isLight ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.12)'}`,
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                boxShadow: active
                  ? isLight
                    ? `0 4px 16px ${accentColor}25, inset 0 1px 0 rgba(255,255,255,0.95)`
                    : `0 4px 16px ${accentColor}30, inset 0 1px 0 rgba(255,255,255,0.12)`
                  : isLight
                    ? '0 2px 8px rgba(30,60,120,0.10), inset 0 1px 0 rgba(255,255,255,0.90)'
                    : '0 2px 8px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)',
                color: active
                  ? isLight ? accentColor : accentColor
                  : tc.s,
              }}>
              {ps ? <span>{ps.icon}</span> : <span style={{ color:'#60a5fa', fontSize:10 }}>●</span>}
              <span>{f}</span>
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: active
                    ? isLight ? `${accentColor}18` : `${accentColor}22`
                    : isLight ? 'rgba(30,60,120,0.08)' : 'rgba(255,255,255,0.08)',
                  color: active ? accentColor : tc.m,
                }}>
                {count}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Tabla con cronología */}
      <div className="rounded-2xl overflow-hidden" style={glass()}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom:rowBorder, background: isLight ? 'rgba(30,60,120,0.05)' : 'rgba(255,255,255,0.03)' }}>
              {['','#','Requerimiento','Cliente','Módulo','Implementador','Prioridad','Estado','Mover'].map(h => (
                <th key={h} className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color:tc.m }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((req) => {
              const realIdx = items.findIndex(r => r.id === req.id);
              const ps  = PRIORIDAD_STYLE[req.prioridad];
              const es  = ESTADO_STYLE[req.estadoActual];
              const isOpen = expanded.includes(req.id);

              return (
                <>
                  {/* Fila principal */}
                  <motion.tr key={`row-${req.id}`} layout
                    initial={{ opacity:0 }} animate={{ opacity:1 }}
                    style={{ borderBottom: isOpen ? 'none' : rowBorder }}
                    className="transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = isLight ? 'rgba(30,60,120,0.03)' : 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Toggle cronología */}
                    <td className="px-3 py-3 w-8">
                      <button onClick={() => toggleExpand(req.id)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                        style={{ background: isOpen ? 'rgba(167,139,250,0.15)' : 'transparent', color: isOpen ? '#a78bfa' : tc.m }}>
                        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration:0.2 }}>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </motion.div>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 cursor-grab" style={{ color:tc.m }} />
                        <span className="text-xs font-mono font-bold" style={{ color:tc.m }}>
                          {String(realIdx+1).padStart(2,'0')}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-sm leading-tight" style={{ color:tc.p }}>{req.titulo}</p>
                      <p className="text-xs mt-0.5" style={{ color:tc.m }}>{req.solicitante}</p>
                    </td>
                    <td className="px-3 py-3 text-xs font-medium" style={{ color:tc.s }}>{req.cliente}</td>
                    <td className="px-3 py-3 text-xs" style={{ color:tc.s }}>{req.modulo}</td>
                    <td className="px-3 py-3 text-xs font-medium" style={{ color:tc.s }}>{req.implementador}</td>
                    <td className="px-3 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background:ps.bg, color:ps.color, border:`1px solid ${ps.color}40` }}>
                        {ps.icon} {req.prioridad}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit"
                        style={{ background:es.bg, color:es.color, border:`1px solid ${es.color}40` }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background:es.dot }} />
                        {req.estadoActual}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => move(realIdx,-1)} disabled={realIdx===0}
                          className="p-1.5 rounded-lg transition-colors disabled:opacity-20"
                          style={{ color: isLight ? '#1d4ed8' : '#60a5fa' }}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => move(realIdx,1)} disabled={realIdx===items.length-1}
                          className="p-1.5 rounded-lg transition-colors disabled:opacity-20"
                          style={{ color: isLight ? '#1d4ed8' : '#60a5fa' }}>
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setModalTicket(req); setGestion({ estado:'Priorizado', observacion:'', fecha: new Date().toISOString().split('T')[0] }); }}
                          className="p-1.5 rounded-lg transition-colors ml-1"
                          style={{ color:'#a78bfa' }}
                          title="Registrar gestión">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>

                  {/* Cronología */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.tr key={`hist-${req.id}`}
                        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                        style={{ borderBottom: rowBorder }}>
                        <td colSpan={9} className="px-6 pb-5 pt-2">
                          <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-3.5 h-3.5 text-violet-400" />
                            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color:tc.m }}>
                              Cronología — {req.historial.length} gestión{req.historial.length !== 1 ? 'es' : ''}
                            </span>
                          </div>
                          <div className="relative pl-5">
                            {/* Línea vertical */}
                            <div className="absolute left-[7px] top-2 bottom-2 w-px"
                              style={{ background: isLight ? 'rgba(30,60,120,0.15)' : 'rgba(255,255,255,0.10)' }} />

                            <div className="space-y-4">
                              {[...req.historial].reverse().map((h, i) => {
                                const hs = ESTADO_STYLE[h.estado];
                                return (
                                  <motion.div key={i}
                                    initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                                    transition={{ delay: i * 0.06 }}
                                    className="flex gap-4 relative"
                                  >
                                    {/* Dot */}
                                    <div className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 ring-2 z-10"
                                      style={{ background:hs.dot, boxShadow:`0 0 0 3px ${hs.dot}25` }} />

                                    {/* Contenido */}
                                    <div className="flex-1 rounded-xl p-3"
                                      style={{ background: isLight ? 'rgba(30,60,120,0.04)' : 'rgba(255,255,255,0.04)', border:`1px solid ${isLight ? 'rgba(30,60,120,0.08)' : 'rgba(255,255,255,0.07)'}` }}>
                                      <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                                          style={{ background:hs.bg, color:hs.color }}>
                                          {h.estado}
                                        </span>
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs font-medium" style={{ color:tc.m }}>
                                            {new Date(h.fecha).toLocaleDateString('es-CO',{ day:'2-digit', month:'short', year:'numeric' })}
                                          </span>
                                          <span className="text-xs" style={{ color:tc.m }}>por <strong style={{ color:tc.s }}>{h.usuario}</strong></span>
                                        </div>
                                      </div>
                                      <p className="text-sm leading-relaxed" style={{ color:tc.s }}>{h.observacion}</p>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="py-12 text-center text-sm" style={{ color:tc.m }}>
            No hay requerimientos con esta prioridad
          </div>
        )}
      </div>

      {/* ── Modal: registrar nueva gestión ──────────────────────────────────── */}
      <Modal open={!!modalTicket} onClose={() => setModalTicket(null)}
        title={`Registrar gestión — ${modalTicket?.titulo}`} width="max-w-lg">
        <div className="space-y-4">
          {/* Fecha + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color:'var(--text-muted)' }}>Fecha</label>
              <input type="date" className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={gestion.fecha} onChange={e => setGestion(p => ({ ...p, fecha:e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color:'var(--text-muted)' }}>Nuevo estado</label>
              <select className="input-glass w-full rounded-xl px-3 py-2.5 text-sm"
                value={gestion.estado} onChange={e => setGestion(p => ({ ...p, estado: e.target.value as Estado }))}>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Preview del estado seleccionado */}
          {gestion.estado && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
                style={{ background:ESTADO_STYLE[gestion.estado].bg, color:ESTADO_STYLE[gestion.estado].color }}>
                <span className="w-2 h-2 rounded-full" style={{ background:ESTADO_STYLE[gestion.estado].dot }} />
                {gestion.estado}
              </span>
              <span className="text-xs" style={{ color:'var(--text-muted)' }}>— estado que se registrará</span>
            </div>
          )}

          {/* Observación */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color:'var(--text-muted)' }}>
              Observación <span className="text-red-400 normal-case">*</span>
            </label>
            <textarea className="input-glass w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={4}
              placeholder="Describe la acción tomada, el motivo del cambio de estado..."
              value={gestion.observacion} onChange={e => setGestion(p => ({ ...p, observacion:e.target.value }))} />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalTicket(null)}
              className="px-4 py-2.5 rounded-xl text-sm transition-colors"
              style={{ border:'1px solid var(--border-subtle)', color:'var(--text-secondary)' }}>
              Cancelar
            </button>
            <button onClick={handleAddGestion} disabled={savingGestion}
              className="flex-1 btn-primary py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
              {savingGestion ? 'Guardando...' : 'Registrar gestión'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
