'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Loader2, AlertCircle, UserPlus, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AuraLogo } from '@/components/ui/AuraLogo';
import { AuraText } from '@/components/ui/AuraText';

// ── Variantes de animación ────────────────────────────────────────────────
const fieldVariants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
  visible: (i: number) => ({
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { delay: i * 0.09, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const cardVariants = {
  hidden:   { opacity: 0, y: 32, scale: 0.97 },
  visible:  { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  exit:     { opacity: 0, y: -20, scale: 0.96, transition: { duration: 0.3 } },
};

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
    if (!form.email || !form.password) { setError('Por favor completa todos los campos'); return; }
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
      <div className="w-full max-w-md">

        {/* ── Cabecera ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex justify-center mb-4"
          >
            <AuraLogo size={72} animate />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <AuraText />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="flex items-center justify-center gap-2 mt-3"
          >
            <div className="h-px w-12" style={{ background: 'var(--border-strong)' }} />
            <span className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: 'var(--text-muted)' }}>
              Gestiones Inteligentes
            </span>
            <div className="h-px w-12" style={{ background: 'var(--border-strong)' }} />
          </motion.div>
        </motion.div>

        {/* ── Card ─────────────────────────────────────────────── */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="glass-strong rounded-2xl p-8"
        >
          <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
            <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Iniciar sesión
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Ingresa tus credenciales para continuar
            </p>
          </motion.div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-2 rounded-xl px-4 py-3 mb-5 overflow-hidden"
                style={{ background: 'var(--accent-red-bg)', border: '1px solid rgba(248,113,113,0.28)' }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-red)' }} />
                <span className="text-sm" style={{ color: 'var(--accent-red)' }}>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
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
            </motion.div>

            {/* Contraseña */}
            <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
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
                  <motion.div
                    key={showPass ? 'off' : 'on'}
                    initial={{ rotate: -15, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </motion.div>
                </button>
              </div>
            </motion.div>

            {/* Botón principal */}
            <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
              <motion.button
                type="submit" disabled={loading}
                whileHover={{ scale: 1.015, boxShadow: '0 8px 30px rgba(59,130,246,0.35)' }}
                whileTap={{ scale: 0.97 }}
                className="btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.span key="loading" className="flex items-center gap-2"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
                    </motion.span>
                  ) : (
                    <motion.span key="idle"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      Iniciar sesión
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>
          </form>

          {/* Separador — nueva cuenta */}
          <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible"
            className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>¿Nuevo en AURA?</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
          </motion.div>

          {/* Crear cuenta */}
          <motion.div custom={5} variants={fieldVariants} initial="hidden" animate="visible">
            <Link href="/register">
              <motion.div
                whileHover={{ scale: 1.015, boxShadow: '0 6px 24px rgba(139,92,246,0.35)' }}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-xl py-3 text-sm font-semibold text-center text-white cursor-pointer flex items-center justify-center gap-2 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #8b5cf6 100%)',
                  border: '1px solid var(--accent-violet-border)',
                }}
              >
                <UserPlus className="w-4 h-4" />
                Crear Cuenta
              </motion.div>
            </Link>
          </motion.div>

          {/* Separador — clientes */}
          <motion.div custom={6} variants={fieldVariants} initial="hidden" animate="visible"
            className="flex items-center gap-3 mt-4 mb-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>¿Cliente?</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
          </motion.div>

          {/* Firmar documentos */}
          <motion.div custom={7} variants={fieldVariants} initial="hidden" animate="visible">
            <Link href="/buscar-firmas">
              <motion.div
                whileHover={{ scale: 1.015, boxShadow: '0 6px 24px rgba(52,211,153,0.2)' }}
                whileTap={{ scale: 0.98 }}
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
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          © 2024 Sistemas Infotec · AURA ERP v1.0.0
        </motion.p>
      </div>
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
