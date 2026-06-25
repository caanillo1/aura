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

const fieldVar: Variants = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: 0.3 + i * 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

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
      <div className="w-full max-w-md">

        {/* ── Logo con anillos de pulso ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <div className="relative">
              {/* Anillos expansivos — ocultos en móvil para evitar sobrecarga de GPU */}
              {[0, 1, 2].map(i => (
                <motion.div key={i} className="absolute rounded-full pointer-events-none hidden sm:block"
                  style={{ inset: -16 - i * 14, border: '1px solid rgba(96,165,250,0.4)' }}
                  animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                  transition={{ duration: 2.5, delay: i * 0.75, repeat: Infinity, ease: 'easeOut' }}
                />
              ))}
              <motion.div
                initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}>
                <AuraLogo size={72} animate />
              </motion.div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <AuraText />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-2 mt-3">
            <motion.div className="h-px w-12"
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              style={{ background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.6))', transformOrigin: 'right' }} />
            <span className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: 'rgba(148,163,184,0.8)' }}>
              Gestiones Inteligentes
            </span>
            <motion.div className="h-px w-12"
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              style={{ background: 'linear-gradient(90deg, rgba(167,139,250,0.6), transparent)', transformOrigin: 'left' }} />
          </motion.div>
        </motion.div>

        {/* ── Card con halo pulsante ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Halo exterior — solo desktop */}
          <motion.div className="absolute inset-0 rounded-2xl pointer-events-none hidden sm:block"
            animate={{
              boxShadow: [
                '0 0 40px rgba(59,130,246,0.25), 0 0 80px rgba(139,92,246,0.12)',
                '0 0 60px rgba(139,92,246,0.35), 0 0 100px rgba(59,130,246,0.18)',
                '0 0 40px rgba(59,130,246,0.25), 0 0 80px rgba(139,92,246,0.12)',
              ]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="glass-strong rounded-2xl p-8 relative overflow-hidden"
            style={{ boxShadow: '0 0 40px rgba(59,130,246,0.2), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)' }}>

            {/* Borde superior con gradiente animado */}
            <motion.div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.8), rgba(167,139,250,0.8), transparent)' }}
            />

            <motion.div custom={0} variants={fieldVar} initial="hidden" animate="visible">
              <h2 className="text-xl font-semibold mb-1" style={{ color: '#f1f5f9' }}>
                Iniciar sesión
              </h2>
              <p className="text-sm mb-6" style={{ color: '#64748b' }}>
                Ingresa tus credenciales para continuar
              </p>
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div key="err"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 rounded-xl px-4 py-3 mb-5 overflow-hidden"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.35)', boxShadow: '0 0 20px rgba(248,113,113,0.15)' }}>
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
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors"
                    style={{ color: focused === 'email' ? '#60a5fa' : '#475569' }} />
                  <motion.input
                    type="email" name="email" value={form.email} onChange={handleChange}
                    onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                    placeholder="correo@empresa.com" autoComplete="email"
                    className="input-glass w-full rounded-xl pl-10 pr-4 py-3 text-sm"
                    animate={focused === 'email'
                      ? { boxShadow: '0 0 0 2px rgba(96,165,250,0.4), 0 0 20px rgba(96,165,250,0.15)' }
                      : { boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </motion.div>

              {/* Contraseña */}
              <motion.div custom={2} variants={fieldVar} initial="hidden" animate="visible">
                <label className="block text-xs font-semibold tracking-wide mb-1.5" style={{ color: '#94a3b8' }}>
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors"
                    style={{ color: focused === 'password' ? '#60a5fa' : '#475569' }} />
                  <motion.input
                    type={showPass ? 'text' : 'password'} name="password"
                    value={form.password} onChange={handleChange}
                    onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                    placeholder="Tu contraseña" autoComplete="current-password"
                    className="input-glass w-full rounded-xl pl-10 pr-11 py-3 text-sm"
                    animate={focused === 'password'
                      ? { boxShadow: '0 0 0 2px rgba(96,165,250,0.4), 0 0 20px rgba(96,165,250,0.15)' }
                      : { boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}
                    transition={{ duration: 0.2 }}
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#475569' }}>
                    <AnimatePresence mode="wait">
                      <motion.div key={showPass ? 'off' : 'on'}
                        initial={{ rotate: -20, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 20, opacity: 0 }} transition={{ duration: 0.18 }}>
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </motion.div>
                    </AnimatePresence>
                  </button>
                </div>
              </motion.div>

              {/* Botón */}
              <motion.div custom={3} variants={fieldVar} initial="hidden" animate="visible">
                <motion.button type="submit" disabled={loading}
                  whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(59,130,246,0.6), 0 8px 30px rgba(59,130,246,0.3)' }}
                  whileTap={{ scale: 0.97 }}
                  className="btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ boxShadow: '0 0 20px rgba(59,130,246,0.35)' }}>
                  <AnimatePresence mode="wait">
                    {loading
                      ? <motion.span key="l" className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
                        </motion.span>
                      : <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          Iniciar sesión
                        </motion.span>
                    }
                  </AnimatePresence>
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
                  whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(139,92,246,0.6), 0 6px 24px rgba(139,92,246,0.3)' }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-center text-white cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #8b5cf6 100%)',
                    border: '1px solid rgba(139,92,246,0.5)',
                    boxShadow: '0 0 20px rgba(139,92,246,0.3)',
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
                  whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(52,211,153,0.5), 0 6px 20px rgba(52,211,153,0.2)' }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-center cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    background: 'rgba(52,211,153,0.08)',
                    border: '1px solid rgba(52,211,153,0.35)',
                    color: '#34d399',
                    boxShadow: '0 0 15px rgba(52,211,153,0.15)',
                  }}>
                  <PenLine className="w-4 h-4" /> Firmar documentos pendientes
                </motion.div>
              </Link>
            </motion.div>
          </div>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
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
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"
          style={{ boxShadow: '0 0 16px rgba(96,165,250,0.6)' }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
