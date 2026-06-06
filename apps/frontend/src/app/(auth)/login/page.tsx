'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, Loader2, AlertCircle, UserPlus } from 'lucide-react';
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
      setError('Tu sesiÃ³n expirÃ³. Por favor inicia sesiÃ³n nuevamente.');
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
      const msg = err?.response?.data?.message ?? 'Error al iniciar sesiÃ³n';
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
        {/* Logo */}
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
          <p className="text-slate-400 text-sm mt-2 tracking-widest uppercase text-xs">
            Gestiones Inteligentes
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-2xl p-8"
        >
          <h2 className="text-xl font-semibold text-white mb-1">Iniciar SesiÃ³n</h2>
          <p className="text-slate-400 text-sm mb-6">Ingresa tus credenciales para continuar</p>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-red-400 text-sm">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Correo electrÃ³nico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email" name="email" value={form.email} onChange={handleChange}
                  placeholder="correo@empresa.com" autoComplete="email"
                  className="input-glass w-full rounded-lg pl-10 pr-4 py-2.5 text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                ContraseÃ±a
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'} name="password"
                  value={form.password} onChange={handleChange}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" autoComplete="current-password"
                  className="input-glass w-full rounded-lg pl-10 pr-10 py-2.5 text-sm"
                />
                <button type="button" onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
              className="btn-primary w-full rounded-lg py-2.5 text-sm font-semibold text-white mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                : 'Iniciar SesiÃ³n'
              }
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-slate-500 text-xs">Â¿Nuevo en AURA?</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Crear cuenta â€” color distintivo violeta/esmeralda */}
          <Link href="/register">
            <motion.div
              whileHover={{ scale: 1.01, boxShadow: '0 4px 24px rgba(139,92,246,0.35)' }}
              whileTap={{ scale: 0.99 }}
              className="w-full rounded-lg py-2.5 text-sm font-semibold text-center text-white cursor-pointer flex items-center justify-center gap-2 transition-all"
              style={{
                background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #8b5cf6 100%)',
                border: '1px solid rgba(139,92,246,0.4)',
              }}
            >
              <UserPlus className="w-4 h-4" />
              Crear Cuenta
            </motion.div>
          </Link>
        </motion.div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Â© 2024 Sistemas Infotec Â· AURA ERP v1.0.0
        </p>
      </motion.div>
    </div>
  );
}
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
