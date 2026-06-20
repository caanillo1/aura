'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Calendar, Clock, Building2, ShieldCheck } from 'lucide-react';
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

function formatFecha(val: string | undefined) {
  if (!val) return '';
  // Puede venir como ISO o como Date; tomamos solo YYYY-MM-DD
  const iso = typeof val === 'string' ? val.substring(0, 10) : '';
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function ResponderContent() {
  const params = useSearchParams();
  const token  = params.get('token') ?? '';
  const action = (params.get('action') ?? 'accept') as 'accept' | 'cancel';

  const [documento, setDocumento] = useState('');
  const [motivo, setMotivo]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError]         = useState('');

  const info = token ? decodeToken(token) : null;

  const handleSubmit = async () => {
    if (!documento.trim()) {
      setError('Por favor ingresa tu número de documento de identidad.');
      return;
    }
    if (action === 'cancel' && !motivo.trim()) {
      setError('Por favor explica el motivo de la cancelación.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await cronogramaApi.respond(token, action, motivo || undefined, documento);
      setResult(r);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al procesar la respuesta. Verifica que tu documento sea correcto.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center py-10">
        <XCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#f87171' }} />
        <p className="font-semibold" style={{ color: '#f87171' }}>Enlace inválido o incompleto.</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-14 h-14 mx-auto mb-4" style={{ color: action === 'accept' ? '#4ade80' : '#f87171' }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: '#e2e8f0' }}>
          {action === 'accept' ? '¡Visita confirmada!' : 'Visita cancelada'}
        </h2>
        <p className="text-sm" style={{ color: '#94a3b8' }}>{result.message}</p>
        <p className="text-xs mt-6" style={{ color: '#475569' }}>Puedes cerrar esta ventana.</p>
      </div>
    );
  }

  const isCancel = action === 'cancel';

  return (
    <div className="flex flex-col gap-5">
      {/* Título de acción */}
      <div className="flex items-center gap-3 pb-1"
        style={{ borderBottom: '1px solid #1e3a5f' }}>
        {isCancel
          ? <XCircle className="w-6 h-6 shrink-0" style={{ color: '#f87171' }} />
          : <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: '#4ade80' }} />
        }
        <div>
          <p className="font-bold text-base" style={{ color: '#e2e8f0' }}>
            {isCancel ? 'Cancelar visita' : 'Confirmar visita'}
          </p>
          <p className="text-xs" style={{ color: '#64748b' }}>
            {isCancel ? 'Por favor completa el formulario para cancelar.' : 'Verifica tu identidad para confirmar la cita.'}
          </p>
        </div>
      </div>

      {/* Detalles del bloque */}
      {info && (
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
      )}

      {/* Validación de identidad */}
      <div className="rounded-xl p-4 flex flex-col gap-3"
        style={{ background: '#0c1a30', border: '1px solid #1e3a5f' }}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" style={{ color: '#60a5fa' }} />
          <p className="text-xs font-semibold" style={{ color: '#60a5fa' }}>
            Verificación de identidad
          </p>
        </div>
        <p className="text-xs" style={{ color: '#64748b' }}>
          Ingresa el número de documento del líder de cliente asignado a esta orden de servicio.
        </p>
        <input
          type="text"
          value={documento}
          onChange={e => setDocumento(e.target.value)}
          placeholder="Ej: 1023456789"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{
            background: '#0a1628',
            border: '1px solid #1e3a5f',
            color: '#e2e8f0',
          }}
          onKeyDown={e => e.key === 'Enter' && !isCancel && handleSubmit()}
        />
      </div>

      {/* Motivo (solo para cancelar) */}
      {isCancel && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>
            Motivo de la cancelación <span style={{ color: '#f87171' }}>*</span>
          </label>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={4}
            placeholder="Ej: El cliente solicitó reprogramar para la próxima semana por cierre de mes..."
            className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
            style={{ background: '#0f2040', border: '1px solid #1e3a5f', color: '#e2e8f0' }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f87171' }} />
          <p className="text-sm" style={{ color: '#fca5a5' }}>{error}</p>
        </div>
      )}

      {/* Botón */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: isCancel ? '#dc2626' : '#16a34a' }}>
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : isCancel
            ? <XCircle className="w-4 h-4" />
            : <CheckCircle2 className="w-4 h-4" />
        }
        {loading ? 'Procesando...' : isCancel ? 'Cancelar visita' : 'Confirmar visita'}
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
