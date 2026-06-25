'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { publicSesionesApi } from '@/lib/api';
import { CheckCircle2, Loader2, Calendar, MapPin, Monitor, Users, BookOpen } from 'lucide-react';

type Estado = 'cargando' | 'formulario' | 'enviando' | 'registrado' | 'error';

interface Sesion {
  id: string;
  titulo: string;
  fecha: string;
  lugar?: string;
  temas?: string;
  teamsLink?: string;
  modulo?: { name: string };
  invitados: Array<{ id: string; nombre: string; email: string; entroSalaAt?: string }>;
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  });
}

export default function SalaPage() {
  const params = useParams();
  const token  = params.token as string;

  const [estado,  setEstado]  = useState<Estado>('cargando');
  const [sesion,  setSesion]  = useState<Sesion | null>(null);
  const [nombre,  setNombre]  = useState('');
  const [email,   setEmail]   = useState('');
  const [cargo,   setCargo]   = useState('');
  const [documento, setDocumento] = useState('');
  const [error,   setError]   = useState('');

  useEffect(() => {
    publicSesionesApi.getSala(token)
      .then(data => {
        if (data?.statusCode >= 400) { setEstado('error'); return; }
        setSesion(data);
        setEstado('formulario');
      })
      .catch(() => setEstado('error'));
  }, [token]);

  const entrar = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setError('');
    setEstado('enviando');
    const res = await publicSesionesApi.entrar(token, {
      nombre: nombre.trim(),
      email:  email.trim() || undefined,
      documento: documento.trim() || undefined,
      cargo: cargo.trim() || undefined,
    }).catch(() => null);

    if (!res || res?.statusCode >= 400) {
      setEstado('formulario');
      setError('Ocurrió un error al registrar tu entrada. Intenta de nuevo.');
      return;
    }
    setEstado('registrado');
  };

  const enSala = sesion?.invitados.filter(i => i.entroSalaAt) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">

        {/* Card de info de la sesión */}
        {sesion && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 text-white">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-0.5">Capacitación</p>
                <h1 className="text-lg font-bold leading-tight">{sesion.titulo}</h1>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 text-slate-300">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                {fmtFecha(sesion.fecha)}
              </p>
              {sesion.lugar && (
                <p className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  {sesion.lugar}
                </p>
              )}
              {sesion.teamsLink && (
                <a href={sesion.teamsLink} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-blue-300 hover:text-blue-200">
                  <Monitor className="w-4 h-4 shrink-0" />
                  Unirse a la reunión Teams
                </a>
              )}
            </div>
            {enSala.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                  <Users className="w-3.5 h-3.5" />
                  {enSala.length} {enSala.length === 1 ? 'persona en sala' : 'personas en sala'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Cargando */}
        {estado === 'cargando' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-400 mb-3" />
            <p className="text-slate-400">Cargando sala...</p>
          </div>
        )}

        {/* Error */}
        {estado === 'error' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white">
            <p className="text-red-400 font-semibold">Sala no encontrada</p>
            <p className="text-slate-400 text-sm mt-1">El enlace puede ser incorrecto o haber expirado.</p>
          </div>
        )}

        {/* Registrado */}
        {estado === 'registrado' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-white">
            <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-green-300 mb-2">¡Entrada registrada!</h2>
            <p className="text-slate-300 text-sm">
              <strong>{nombre}</strong>, tu asistencia quedó registrada correctamente.
            </p>
            {sesion?.teamsLink && (
              <a href={sesion.teamsLink} target="_blank" rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold transition">
                <Monitor className="w-4 h-4" />
                Unirse a la reunión Teams
              </a>
            )}
          </div>
        )}

        {/* Formulario */}
        {(estado === 'formulario' || estado === 'enviando') && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 text-white">
            <h2 className="text-lg font-bold mb-1">Registrar entrada</h2>
            <p className="text-slate-400 text-sm mb-5">Completa tus datos para quedar registrado/a en esta sesión.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre completo *</label>
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Documento de identidad</label>
                  <input
                    value={documento}
                    onChange={e => setDocumento(e.target.value)}
                    placeholder="Número de documento"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cargo</label>
                <input
                  value={cargo}
                  onChange={e => setCargo(e.target.value)}
                  placeholder="Tu cargo"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button
                onClick={entrar}
                disabled={estado === 'enviando'}
                className="w-full py-3 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition flex items-center justify-center gap-2"
              >
                {estado === 'enviando'
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
                  : '🚪 Registrar mi entrada'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
