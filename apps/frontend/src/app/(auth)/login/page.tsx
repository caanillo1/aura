'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Loader2, AlertCircle, UserPlus, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AuraLogo } from '@/components/ui/AuraLogo';
import { AuraText } from '@/components/ui/AuraText';

// Only animate opacity + translateY — both are compositor-only (no paint)
const fieldVar: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: 0.25 + i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (searchParams.get('expired') === '1')
      setError('Tu sesión expiró. Por favor inicia sesión nuevamente.');
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
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
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md px-4">

        {/* ── Logo ── */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <AuraLogo size={72} animate={false} />
          </div>

          <AuraText />

          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="h-px w-12" style={{ background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.6))' }} />
            <span className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: 'rgba(148,163,184,0.8)' }}>
              Gestiones Inteligentes
            </span>
            <div className="h-px w-12" style={{ background: 'linear-gradient(90deg, rgba(167,139,250,0.6), transparent)' }} />
          </div>
        </motion.div>

        {/* ── Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="glass-strong rounded-2xl p-8 relative overflow-hidden"
            style={{ boxShadow: '0 0 40px rgba(59,130,246,0.15), 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)' }}>

            {/* Borde superior estático */}
            <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.6), rgba(167,139,250,0.6), transparent)' }}
            />

            <motion.div custom={0} variants={fieldVar} initial="hidden" animate="visible">
              <h2 className="text-xl font-semibold mb-1" style={{ color: '#f1f5f9' }}>Iniciar sesión</h2>
              <p className="text-sm mb-6" style={{ color: '#64748b' }}>Ingresa tus credenciales para continuar</p>
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div key="err"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 rounded-xl px-4 py-3 mb-5 overflow-hidden"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.35)' }}>
                  <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#f87171' }} />
                  <span className="text-sm" style={{ color: '#f87171' }}>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <motion.div custom={1} variants={fieldVar} initial="hidden" animate="visible">
                <label className="block text-xs font-semibold tracking-wide mb-1.5" style={{ color: '#94a3b8' }}>
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#475569' }} />
                  <input
                    type="email" name="email" value={form.email} onChange={handleChange}
                    placeholder="correo@empresa.com" autoComplete="email"
                    className="input-glass w-full rounded-xl pl-10 pr-4 py-3 text-sm"
                  />
                </div>
              </motion.div>

              {/* Contraseña */}
              <motion.div custom={2} variants={fieldVar} initial="hidden" animate="visible">
                <label className="block text-xs font-semibold tracking-wide mb-1.5" style={{ color: '#94a3b8' }}>
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#475569' }} />
                  <input
                    type={showPass ? 'text' : 'password'} name="password"
                    value={form.password} onChange={handleChange}
                    placeholder="Tu contraseña" autoComplete="current-password"
                    className="input-glass w-full rounded-xl pl-10 pr-11 py-3 text-sm"
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
                    style={{ color: '#475569' }}>
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>

              {/* Botón submit */}
              <motion.div custom={3} variants={fieldVar} initial="hidden" animate="visible">
                <motion.button type="submit" disabled={loading}
                  whileTap={{ scale: 0.97 }}
                  className="btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ boxShadow: '0 0 20px rgba(59,130,246,0.3)' }}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                    : 'Iniciar sesión'}
                </motion.button>
              </motion.div>
            </form>

            {/* Separador */}
            <motion.div custom={4} variants={fieldVar} initial="hidden" animate="visible"
              className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-xs" style={{ color: '#475569' }}>¿Nuevo en AURA?</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </motion.div>

            {/* Crear cuenta */}
            <motion.div custom={5} variants={fieldVar} initial="hidden" animate="visible">
              <Link href="/register">
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-center text-white cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #8b5cf6 100%)',
                    border: '1px solid rgba(139,92,246,0.5)',
                    boxShadow: '0 0 20px rgba(139,92,246,0.25)',
                  }}>
                  <UserPlus className="w-4 h-4" /> Crear Cuenta
                </motion.div>
              </Link>
            </motion.div>

            {/* Separador clientes */}
            <motion.div custom={6} variants={fieldVar} initial="hidden" animate="visible"
              className="flex items-center gap-3 mt-4 mb-3">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-xs" style={{ color: '#475569' }}>¿Cliente?</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </motion.div>

            {/* Firmar documentos */}
            <motion.div custom={7} variants={fieldVar} initial="hidden" animate="visible">
              <Link href="/buscar-firmas">
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-center cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    background: 'rgba(52,211,153,0.08)',
                    border: '1px solid rgba(52,211,153,0.35)',
                    color: '#34d399',
                  }}>
                  <PenLine className="w-4 h-4" /> Firmar documentos pendientes
                </motion.div>
              </Link>
            </motion.div>
          </div>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
          className="text-center text-xs mt-6" style={{ color: '#334155' }}>
          © 2024 Sistemas Infotec · AURA ERP v1.0.0
        </motion.p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#020617' }}>
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
