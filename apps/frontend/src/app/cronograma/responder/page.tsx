'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, Calendar, Clock, Building2 } from 'lucide-react';
import { cronogramaApi } from '@/lib/api';

interface BloqueInfo {
  titulo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  clienteNombre?: string;
  soInfo?: string;
  nombre?: string;
}

function decodeTokenPayload(token: string): BloqueInfo | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      titulo: payload.titulo ?? 'Visita programada',
      fecha: payload.fecha ?? '',
      horaInicio: payload.horaInicio ?? '',
      horaFin: payload.horaFin ?? '',
      clienteNombre: payload.clienteNombre,
      soInfo: payload.soInfo,
      nombre: payload.nombre,
    };
  } catch {
    return null;
  }
}

function formatFecha(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function ResponderContent() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const action = (params.get('action') ?? 'accept') as 'accept' | 'cancel';

  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState('');
  const [autoAccepted, setAutoAccepted] = useState(false);

  const info = token ? decodeTokenPayload(token) : null;

  const submit = async (overrideAction?: 'accept' | 'cancel') => {
    const act = overrideAction ?? action;
    if (act === 'cancel' && !motivo.trim()) {
      setError('Por favor explica el motivo de la cancelación.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await cronogramaApi.respond(token, act, motivo || undefined);
      setResult(r);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al procesar la respuesta.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-accept sin necesidad de clic
  useEffect(() => {
    if (action === 'accept' && token && !autoAccepted && !result) {
      setAutoAccepted(true);
      submit('accept');
    }
  }, [action, token]); // eslint-disable-line

  if (!token) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
        <p className="text-red-300 font-semibold">Enlace inválido o incompleto.</p>
      </div>
    );
  }

  if (result) {
    const isOk = result.ok;
    return (
      <div className="text-center py-8">
        {isOk ? (
          <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-green-400" />
        ) : (
          <XCircle className="w-14 h-14 mx-auto mb-4 text-red-400" />
        )}
        <h2 className="text-xl font-bold mb-2" style={{ color: '#e2e8f0' }}>
          {action === 'accept' ? '¡Visita confirmada!' : 'Visita cancelada'}
        </h2>
        <p className="text-sm" style={{ color: '#94a3b8' }}>{result.message}</p>
        <p className="text-xs mt-6" style={{ color: '#475569' }}>Puedes cerrar esta ventana.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Info del bloque */}
      {info && (
        <div className="rounded-xl p-4 mb-6" style={{ background: '#0f2040', border: '1px solid #1e3a5f' }}>
          {info.nombre && (
            <p className="text-sm mb-3" style={{ color: '#94a3b8' }}>
              Hola <strong style={{ color: '#e2e8f0' }}>{info.nombre}</strong>,
            </p>
          )}
          <div className="flex flex-col gap-2">
            <p className="text-base font-bold" style={{ color: '#e2e8f0' }}>{info.titulo}</p>
            {info.fecha && (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#94a3b8' }}>
                <Calendar className="w-4 h-4" />
                {formatFecha(info.fecha)}
              </div>
            )}
            {info.horaInicio && (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#94a3b8' }}>
                <Clock className="w-4 h-4" />
                {info.horaInicio} – {info.horaFin}
              </div>
            )}
            {info.clienteNombre && (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#94a3b8' }}>
                <Building2 className="w-4 h-4" />
                {info.clienteNombre}
              </div>
            )}
          </div>
        </div>
      )}

      {action === 'accept' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm" style={{ color: '#94a3b8' }}>Confirmando tu asistencia…</p>
        </div>
      )}

      {action === 'cancel' && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: '#cbd5e1' }}>
              Motivo de la cancelación <span className="text-red-400">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={4}
              placeholder="Ej: El cliente solicitó reprogramar la visita para la próxima semana..."
              className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none focus:ring-2"
              style={{
                background: '#0f2040',
                border: '1px solid #1e3a5f',
                color: '#e2e8f0',
              }}
            />
            {error && <p className="text-xs mt-1.5 text-red-400">{error}</p>}
          </div>
          <button
            onClick={() => submit()}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: '#dc2626' }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Cancelar visita y registrar motivo
          </button>
        </div>
      )}
    </div>
  );
}

export default function CronogramaResponderPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#060d1c' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#0a1628', border: '1px solid #1e3a5f', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', padding: '28px' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">AURA ERP</h1>
              <p className="text-xs text-blue-200">Cronograma de visitas</p>
            </div>
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: '28px' }}>
          <Suspense fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          }>
            <ResponderContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
