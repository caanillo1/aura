'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Loader2, AlertCircle, UserPlus, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AuraLogo } from '@/components/ui/AuraLogo';
import { AuraText } from '@/components/ui/AuraText';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      setError('Tu sesión expiró. Por favor inicia sesión nuevamente.');
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Por favor completa todos los campos');
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.login(form);
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Bienvenido, ${data.user.firstName}`);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al iniciar sesión';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Cabecera */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <AuraLogo size={72} animate />
          </div>
          <AuraText />
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="h-px w-12" style={{ background: 'var(--border-strong)' }} />
            <span className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: 'var(--text-muted)' }}>
              Gestiones Inteligentes
            </span>
            <div className="h-px w-12" style={{ background: 'var(--border-strong)' }} />
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-2xl p-8"
        >
          <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Iniciar sesión
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Ingresa tus credenciales para continuar
          </p>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 rounded-xl px-4 py-3 mb-5"
              style={{
                background: 'var(--accent-red-bg)',
                border: '1px solid rgba(248,113,113,0.28)',
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-red)' }} />
              <span className="text-sm" style={{ color: 'var(--accent-red)' }}>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold tracking-wide mb-1.5"
                style={{ color: 'var(--text-secondary)' }}>
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--text-muted)' }} />
                <input
                  type="email" name="email" value={form.email} onChange={handleChange}
                  placeholder="correo@empresa.com" autoComplete="email"
                  className="input-glass w-full rounded-xl pl-10 pr-4 py-3 text-sm"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-xs font-semibold tracking-wide mb-1.5"
                style={{ color: 'var(--text-secondary)' }}>
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showPass ? 'text' : 'password'} name="password"
                  value={form.password} onChange={handleChange}
                  placeholder="Tu contraseña" autoComplete="current-password"
                  className="input-glass w-full rounded-xl pl-10 pr-11 py-3 text-sm"
                />
                <button type="button" onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botón principal */}
            <motion.button
              type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
              className="btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                : 'Iniciar sesión'
              }
            </motion.button>
          </form>

          {/* Separador — nueva cuenta */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>¿Nuevo en AURA?</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
          </div>

          {/* Crear cuenta */}
          <Link href="/register">
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full rounded-xl py-3 text-sm font-semibold text-center text-white cursor-pointer flex items-center justify-center gap-2 transition-all"
              style={{
                background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #8b5cf6 100%)',
                border: '1px solid var(--accent-violet-border)',
                boxShadow: '0 2px 12px var(--accent-violet-bg)',
              }}
            >
              <UserPlus className="w-4 h-4" />
              Crear Cuenta
            </motion.div>
          </Link>

          {/* Separador — clientes */}
          <div className="flex items-center gap-3 mt-4 mb-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>¿Cliente?</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
          </div>

          {/* Firmar documentos */}
          <Link href="/buscar-firmas">
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full rounded-xl py-3 text-sm font-semibold text-center cursor-pointer flex items-center justify-center gap-2 transition-all"
              style={{
                background: 'var(--accent-green-bg)',
                border: '1px solid rgba(52,211,153,0.28)',
                color: 'var(--accent-green)',
              }}
            >
              <PenLine className="w-4 h-4" />
              Firmar documentos pendientes
            </motion.div>
          </Link>
        </motion.div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          © 2024 Sistemas Infotec · AURA ERP v1.0.0
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
