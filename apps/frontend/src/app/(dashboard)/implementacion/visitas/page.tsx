'use client';
import { useState, useEffect, useCallback } from 'react';
import { Building2, Clock, FileText, CheckCircle2, Loader2, ClipboardList, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cronogramaApi, clientsApi } from '@/lib/api';
import { ClientCombobox } from '@/components/ui/ClientCombobox';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

interface VisitaBloque {
  id: string;
  titulo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  status: string;
  notas?: string | null;
  tipoActa?: string | null;
  actaId?: string | null;
  agente: { id: string; firstName: string; lastName: string };
  client?: { id: string; businessName: string } | null;
  serviceOrder?: { id: string; osNumber: string; product: string; project?: { id: string } | null } | null;
}

const TIPO_ACTA_CFG: Record<string, { label: string; color: string }> = {
  inicio:          { label: 'Acta de Inicio',      color: '#34d399' },
  visita:          { label: 'Acta de Visita',       color: '#60a5fa' },
  cierre:          { label: 'Acta de Cierre',       color: '#a78bfa' },
  capacitacion:    { label: 'Acta de Capacitación', color: '#fb923c' },
  entrega_soporte: { label: 'Entrega a Soporte',    color: '#f472b6' },
};

const STATUS_LABELS: Record<string, string> = {
  programado: 'Programado', en_curso: 'En curso',
  completado: 'Completado', cancelado: 'Cancelado',
};
const STATUS_COLORS: Record<string, string> = {
  programado: '#60a5fa', en_curso: '#fb923c',
  completado: '#34d399',  cancelado: '#9ca3af',
};

function VisitaCard({ b, onDiligenciar }: { b: VisitaBloque; onDiligenciar?: () => void }) {
  const fechaStr = (b.fecha as string).substring(0, 10);
  const isDone = !!b.actaId;
  const statusColor = STATUS_COLORS[b.status] ?? '#9ca3af';
  const dateObj = dayjs(fechaStr);
  const tipoCfg = b.tipoActa ? TIPO_ACTA_CFG[b.tipoActa] : null;

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3 transition-all hover:shadow-lg"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0"
            style={{
              background: tipoCfg ? `${tipoCfg.color}18` : '#60a5fa18',
              border: `1px solid ${tipoCfg ? `${tipoCfg.color}30` : '#60a5fa30'}`,
            }}>
            <span className="text-[9px] font-bold uppercase leading-none" style={{ color: tipoCfg?.color ?? '#60a5fa' }}>
              {dateObj.format('MMM')}
            </span>
            <span className="text-lg font-extrabold leading-tight" style={{ color: tipoCfg?.color ?? '#60a5fa' }}>
              {dateObj.date()}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{b.titulo}</p>
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
              <Clock className="w-3 h-3" /> {b.horaInicio} – {b.horaFin}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isDone && <CheckCircle2 className="w-4 h-4" style={{ color: '#34d399' }} />}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${statusColor}18`, color: statusColor }}>
            {STATUS_LABELS[b.status] ?? b.status}
          </span>
        </div>
      </div>

      {/* Tipo badge */}
      {tipoCfg && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: `${tipoCfg.color}18`, color: tipoCfg.color, border: `1px solid ${tipoCfg.color}30` }}>
            {tipoCfg.label}
          </span>
        </div>
      )}

      {/* Info rows */}
      <div className="flex flex-col gap-1.5">
        {b.client && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
            {b.client.businessName}
          </div>
        )}
        {b.serviceOrder && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
            OS {b.serviceOrder.osNumber} — {b.serviceOrder.product}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold text-white bg-violet-500">
            {b.agente.firstName[0]}
          </span>
          {b.agente.firstName} {b.agente.lastName}
        </div>
        {b.notas && (
          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{b.notas}</p>
        )}
      </div>

      {/* CTA */}
      {!isDone && onDiligenciar && (
        <button onClick={onDiligenciar}
          className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white w-full justify-center">
          <ClipboardList className="w-3.5 h-3.5" /> Diligenciar Acta
        </button>
      )}
      {isDone && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold justify-center"
          style={{ background: '#34d39918', color: '#34d399', border: '1px solid #34d39930' }}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Acta diligenciada
        </div>
      )}
    </div>
  );
}

export default function VisitasPage() {
  const router = useRouter();
  const [bloques, setBloques] = useState<VisitaBloque[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState('');
  const [tab, setTab] = useState<'pendientes' | 'diligenciadas'>('pendientes');
  const [clients, setClients] = useState<{ id: string; businessName: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const desde = dayjs().subtract(3, 'month').format('YYYY-MM-DD');
      const hasta = dayjs().add(6, 'month').format('YYYY-MM-DD');
      const data = await cronogramaApi.list({
        fechaDesde: desde,
        fechaHasta: hasta,
        ...(filterClient && { clientId: filterClient }),
      });
      const all: VisitaBloque[] = Array.isArray(data) ? data : (data.data ?? []);
      // Solo bloques que tienen tipo de acta asignado
      setBloques(all.filter(b => !!b.tipoActa));
    } catch {
      toast.error('Error al cargar las actas pendientes');
    } finally {
      setLoading(false);
    }
  }, [filterClient]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    clientsApi.list({ limit: 500 }).then((r: any) => setClients(r.data ?? r)).catch(() => {});
  }, []);

  const handleDiligenciar = (b: VisitaBloque) => {
    if (b.serviceOrder?.project?.id) {
      const params = new URLSearchParams({ bloqueId: b.id });
      if (b.tipoActa) params.set('tipo', b.tipoActa);
      router.push(`/implementacion/proyectos/${b.serviceOrder.project.id}/actas?${params.toString()}`);
    } else {
      toast.info('Este bloque no tiene una orden de servicio con proyecto. Asígnala desde el Cronograma para poder diligenciar el acta.');
    }
  };

  const pendientes    = bloques.filter(b => !b.actaId && b.status !== 'cancelado');
  const diligenciadas = bloques.filter(b => !!b.actaId);
  const displayed     = tab === 'pendientes' ? pendientes : diligenciadas;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Actas por Diligenciar</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Bloques del cronograma con acta pendiente (inicio, visita, capacitación, cierre, entrega a soporte)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ClientCombobox
            clients={clients}
            value={filterClient}
            onChange={setFilterClient}
            nullLabel="Todos los clientes"
            placeholder="Buscar cliente…"
            className="min-w-[180px]"
          />
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-50"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'pendientes' as const,    label: 'Pendientes',    count: pendientes.length },
          { key: 'diligenciadas' as const, label: 'Diligenciadas', count: diligenciadas.length },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: tab === t.key ? 'var(--accent-blue)' : 'var(--surface-2)',
              color: tab === t.key ? '#fff' : 'var(--text-secondary)',
            }}>
            {t.label}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: tab === t.key ? 'rgba(255,255,255,0.2)' : 'var(--surface-3)',
                color: tab === t.key ? '#fff' : 'var(--text-muted)',
              }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <AlertCircle className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {tab === 'pendientes'
              ? 'No hay actas pendientes por diligenciar'
              : 'No hay actas diligenciadas'}
          </p>
          {tab === 'pendientes' && (
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
              Las actas aparecen aquí cuando se agrega un tipo de acta al bloque en el Cronograma
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map(b => (
            <VisitaCard key={b.id} b={b}
              onDiligenciar={!b.actaId ? () => handleDiligenciar(b) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
