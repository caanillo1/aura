'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Calendar, Clock, Building2, CalendarPlus } from 'lucide-react';
import { cronogramaApi } from '@/lib/api';

interface BloqueInfo {
  titulo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  clienteNombre?: string | null;
  nombre?: string;
}

function decodeToken(token: string): BloqueInfo | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function formatFecha(val?: string) {
  if (!val) return '';
  const iso = val.substring(0, 10);
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ── Bloque de detalle ─────────────────────────────────────────────────────────
function BloqueCard({ info }: { info: BloqueInfo }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: '#0f2040', border: '1px solid #1e3a5f' }}>
      <p className="text-sm font-bold" style={{ color: '#e2e8f0' }}>{info.titulo}</p>
      {info.fecha && (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#94a3b8' }}>
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span className="capitalize">{formatFecha(info.fecha)}</span>
        </div>
      )}
      {info.horaInicio && (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#94a3b8' }}>
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {info.horaInicio} – {info.horaFin}
        </div>
      )}
      {info.clienteNombre && (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#94a3b8' }}>
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          {info.clienteNombre}
        </div>
      )}
    </div>
  );
}

function buildIcsDataUri(info: BloqueInfo): string {
  const fecha = info.fecha.substring(0, 10).replace(/-/g, '');
  const dtStart = `${fecha}T${info.horaInicio.replace(':', '')}00`;
  const dtEnd   = `${fecha}T${info.horaFin.replace(':', '')}00`;
  const dtstamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 15) + 'Z';
  const titulo  = info.titulo.replace(/[,;\\]/g, ' ');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AURA ERP//ES',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:visita-${fecha}-${dtStart}@aura-erp`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=America/Bogota:${dtStart}`,
    `DTEND;TZID=America/Bogota:${dtEnd}`,
    `SUMMARY:${titulo}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM', 'ACTION:DISPLAY',
    `DESCRIPTION:Recordatorio: ${titulo}`,
    'TRIGGER:-PT30M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
}

// ── Resultado final ───────────────────────────────────────────────────────────
function ResultScreen({ action, message, info }: { action: 'accept' | 'cancel'; message: string; info: BloqueInfo | null }) {
  return (
    <div className="text-center py-8 flex flex-col items-center gap-4">
      {action === 'accept'
        ? <CheckCircle2 className="w-14 h-14" style={{ color: '#4ade80' }} />
        : <XCircle className="w-14 h-14" style={{ color: '#f87171' }} />
      }
      <div>
        <h2 className="text-xl font-bold" style={{ color: '#e2e8f0' }}>
          {action === 'accept' ? '¡Visita confirmada!' : 'Visita cancelada'}
        </h2>
        <p className="text-sm mt-2" style={{ color: '#94a3b8' }}>{message}</p>
      </div>
      {action === 'accept' && info && (
        <a href={buildIcsDataUri(info)} download="visita.ics"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#2563eb' }}>
          <CalendarPlus className="w-4 h-4" />
          Agregar al calendario
        </a>
      )}
      <p className="text-xs" style={{ color: '#475569' }}>Puedes cerrar esta ventana.</p>
    </div>
  );
}

// ── Contenido principal ───────────────────────────────────────────────────────
function ResponderContent() {
  const params  = useSearchParams();
  const token   = params.get('token') ?? '';
  const action  = (params.get('action') ?? 'accept') as 'accept' | 'cancel';

  const [motivo, setMotivo]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError]     = useState('');
  const submitted             = useRef(false);

  const info = token ? decodeToken(token) : null;

  const submit = async (overrideMotivo?: string) => {
    if (submitted.current) return;
    submitted.current = true;
    setLoading(true);
    setError('');
    try {
      const r = await cronogramaApi.respond(token, action, overrideMotivo);
      setResult(r);
    } catch (e: any) {
      submitted.current = false;
      setError(e?.response?.data?.message ?? 'Error al procesar la respuesta. El enlace puede haber expirado.');
    } finally {
      setLoading(false);
    }
  };

  // Confirmar: auto-submit al montar, sin formulario
  useEffect(() => {
    if (action === 'accept' && token) {
      submit();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) {
    return (
      <div className="text-center py-10">
        <XCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#f87171' }} />
        <p className="font-semibold" style={{ color: '#f87171' }}>Enlace inválido o incompleto.</p>
      </div>
    );
  }

  // Pantalla de resultado (accept o cancel exitoso)
  if (result) return <ResultScreen action={action} message={result.message} info={info} />;

  // ── Accept: spinner mientras procesa ─────────────────────────────────────
  if (action === 'accept') {
    return (
      <div className="flex flex-col items-center gap-5 py-8">
        {info && <BloqueCard info={info} />}
        {loading && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#60a5fa' }} />
            <p className="text-sm" style={{ color: '#94a3b8' }}>Confirmando visita…</p>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl px-4 py-3 w-full"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f87171' }} />
            <div>
              <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>
              <button onClick={() => { submitted.current = false; submit(); }}
                className="text-xs mt-1 underline" style={{ color: '#60a5fa' }}>
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Cancel: formulario de motivo ──────────────────────────────────────────
  const handleCancel = () => {
    if (!motivo.trim()) {
      setError('Por favor explica el motivo de la cancelación.');
      return;
    }
    submit(motivo.trim());
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <div className="flex items-center gap-3 pb-4" style={{ borderBottom: '1px solid #1e3a5f' }}>
        <XCircle className="w-6 h-6 shrink-0" style={{ color: '#f87171' }} />
        <div>
          <p className="font-bold text-base" style={{ color: '#e2e8f0' }}>Cancelar visita</p>
          <p className="text-xs" style={{ color: '#64748b' }}>Indica el motivo para que el equipo pueda reagendar</p>
        </div>
      </div>

      {/* Detalles de la visita */}
      {info && <BloqueCard info={info} />}

      {/* Motivo */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>
          Motivo de la cancelación <span style={{ color: '#f87171' }}>*</span>
        </label>
        <textarea
          value={motivo}
          onChange={e => { setMotivo(e.target.value); setError(''); }}
          rows={4}
          placeholder="Ej: Se reprogramó por cierre de mes en el cliente, disponible la próxima semana..."
          autoFocus
          className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
          style={{ background: '#0f2040', border: error ? '1px solid #f87171' : '1px solid #1e3a5f', color: '#e2e8f0' }}
        />
        {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
      </div>

      {/* Botón */}
      <button
        onClick={handleCancel}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: '#dc2626' }}>
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <XCircle className="w-4 h-4" />
        }
        {loading ? 'Procesando…' : 'Cancelar visita'}
      </button>
    </div>
  );
}

export default function CronogramaResponderPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#060d1c' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#0a1628', border: '1px solid #1e3a5f', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', padding: '24px 28px' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white leading-tight">AURA ERP</h1>
              <p className="text-xs" style={{ color: '#93c5fd' }}>Cronograma de visitas</p>
            </div>
          </div>
        </div>
        <div style={{ padding: '24px 28px' }}>
          <Suspense fallback={
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#60a5fa' }} />
            </div>
          }>
            <ResponderContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
