'use client';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { publicSesionesApi } from '@/lib/api';
import { CheckCircle2, XCircle, Loader2, Calendar, MapPin, Monitor, BookOpen } from 'lucide-react';

type Estado = 'cargando' | 'pendiente' | 'confirmando' | 'confirmado' | 'cancelando' | 'cancelado' | 'error';

interface Invitado {
  id: string;
  nombre: string;
  email: string;
  respuesta: string;
  sesion: {
    titulo: string;
    fecha: string;
    lugar?: string;
    temas?: string;
    teamsLink?: string;
  };
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  });
}

export default function ConfirmarPage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const token        = params.token as string;
  const accion       = searchParams.get('accion'); // 'cancelar' si viene del link de cancelar

  const [estado,   setEstado]   = useState<Estado>('cargando');
  const [invitado, setInvitado] = useState<Invitado | null>(null);

  useEffect(() => {
    publicSesionesApi.getRsvp(token)
      .then(data => {
        if (data?.statusCode >= 400) { setEstado('error'); return; }
        setInvitado(data);
        if (accion === 'cancelar') {
          setEstado('pendiente'); // mostrará botón de cancelar prominente
        } else {
          setEstado('pendiente');
        }
      })
      .catch(() => setEstado('error'));
  }, [token, accion]);

  const confirmar = async () => {
    setEstado('confirmando');
    const res = await publicSesionesApi.confirmar(token).catch(() => null);
    setEstado(res?.statusCode >= 400 ? 'error' : 'confirmado');
  };

  const cancelar = async () => {
    setEstado('cancelando');
    const res = await publicSesionesApi.cancelar(token).catch(() => null);
    setEstado(res?.statusCode >= 400 ? 'error' : 'cancelado');
  };

  // ── Auto-accionar si viene de link directo ───────────────────────────────
  useEffect(() => {
    if (estado === 'pendiente' && invitado) {
      if (accion === 'cancelar' && invitado.respuesta !== 'cancelado') {
        // No auto-cancelar, mostrar confirmación primero
      }
    }
  }, [estado, invitado, accion]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 max-w-md w-full text-white">

        {/* Cargando */}
        {estado === 'cargando' && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-400 mb-3" />
            <p className="text-slate-400">Cargando invitación...</p>
          </div>
        )}

        {/* Error */}
        {estado === 'error' && (
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">Invitación no encontrada</h2>
            <p className="text-slate-400 text-sm">El enlace puede haber expirado o ser incorrecto.</p>
          </div>
        )}

        {/* Confirmado */}
        {estado === 'confirmado' && (
          <div className="text-center py-4">
            <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-green-300 mb-2">¡Asistencia confirmada!</h2>
            <p className="text-slate-300 mb-4">Hola <strong>{invitado?.nombre}</strong>, quedaste registrado/a.</p>
            {invitado?.sesion && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-left text-sm mt-4">
                <p className="font-semibold text-green-300 mb-2">{invitado.sesion.titulo}</p>
                <p className="flex items-center gap-2 text-slate-300">
                  <Calendar className="w-4 h-4 shrink-0" />
                  {fmtFecha(invitado.sesion.fecha)}
                </p>
                {invitado.sesion.lugar && (
                  <p className="flex items-center gap-2 text-slate-300 mt-1">
                    <MapPin className="w-4 h-4 shrink-0" />
                    {invitado.sesion.lugar}
                  </p>
                )}
                {invitado.sesion.teamsLink && (
                  <a href={invitado.sesion.teamsLink} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-blue-300 hover:text-blue-200 mt-2">
                    <Monitor className="w-4 h-4 shrink-0" />
                    Unirse a la reunión Teams
                  </a>
                )}
              </div>
            )}
            <p className="text-slate-400 text-xs mt-4">Recibirás recordatorios antes de la sesión.</p>
          </div>
        )}

        {/* Cancelado */}
        {estado === 'cancelado' && (
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-red-300 mb-2">Participación cancelada</h2>
            <p className="text-slate-400">Has cancelado tu participación en esta sesión.</p>
          </div>
        )}

        {/* Pendiente — mostrar datos y botones */}
        {(estado === 'pendiente' || estado === 'confirmando' || estado === 'cancelando') && invitado && (
          <>
            <div className="mb-6">
              <p className="text-slate-400 text-sm mb-1">Invitación para</p>
              <h2 className="text-xl font-bold">{invitado.nombre}</h2>
            </div>

            <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <h3 className="font-semibold text-base text-blue-300">{invitado.sesion.titulo}</h3>
              <p className="flex items-center gap-2 text-slate-300">
                <Calendar className="w-4 h-4 shrink-0 text-slate-400" />
                {fmtFecha(invitado.sesion.fecha)}
              </p>
              {invitado.sesion.lugar && (
                <p className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                  {invitado.sesion.lugar}
                </p>
              )}
              {invitado.sesion.temas && (
                <p className="flex items-start gap-2 text-slate-300">
                  <BookOpen className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                  {invitado.sesion.temas}
                </p>
              )}
              {invitado.sesion.teamsLink && (
                <a href={invitado.sesion.teamsLink} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-blue-300 hover:text-blue-200">
                  <Monitor className="w-4 h-4 shrink-0" />
                  Reunión Teams
                </a>
              )}
            </div>

            {invitado.respuesta === 'confirmado' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center text-sm text-green-300 mb-4">
                Ya confirmaste tu asistencia.
              </div>
            )}

            {invitado.respuesta === 'cancelado' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center text-sm text-red-300 mb-4">
                Cancelaste tu participación.
              </div>
            )}

            {accion !== 'cancelar' && invitado.respuesta !== 'confirmado' && (
              <button
                onClick={confirmar}
                disabled={estado === 'confirmando'}
                className="w-full py-3 rounded-xl font-semibold bg-green-500 hover:bg-green-400 disabled:opacity-60 transition flex items-center justify-center gap-2 mb-3"
              >
                {estado === 'confirmando'
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando...</>
                  : <><CheckCircle2 className="w-4 h-4" /> Confirmar asistencia</>}
              </button>
            )}

            {accion === 'cancelar' && invitado.respuesta !== 'cancelado' && (
              <div className="space-y-3">
                <p className="text-center text-slate-300 text-sm">¿Confirmas que no podrás asistir?</p>
                <button
                  onClick={cancelar}
                  disabled={estado === 'cancelando'}
                  className="w-full py-3 rounded-xl font-semibold bg-red-500 hover:bg-red-400 disabled:opacity-60 transition flex items-center justify-center gap-2"
                >
                  {estado === 'cancelando'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelando...</>
                    : <><XCircle className="w-4 h-4" /> Sí, cancelar mi participación</>}
                </button>
                <button
                  onClick={() => window.history.back()}
                  className="w-full py-3 rounded-xl font-semibold border border-white/20 hover:bg-white/5 transition text-sm text-slate-300"
                >
                  Volver
                </button>
              </div>
            )}

            {accion !== 'cancelar' && invitado.respuesta !== 'cancelado' && (
              <button
                onClick={cancelar}
                disabled={estado === 'cancelando'}
                className="w-full py-2 rounded-xl text-sm text-slate-400 hover:text-red-300 transition"
              >
                {estado === 'cancelando' ? 'Cancelando...' : 'No podré asistir'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
