'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Eye, EyeOff, Mail, Lock, User, IdCard, Briefcase,
  ShieldCheck, Loader2, AlertCircle, ChevronLeft,
  Building2, Users, Phone, Hash, FileText,
  ChevronRight, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { authApi, municipiosApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AuraLogo } from '@/components/ui/AuraLogo';
import { AuraText } from '@/components/ui/AuraText';
import { MunicipioSearch } from '@/components/ui/MunicipioSearch';
import type { UserType } from '@/types/auth.types';
import type { Municipio } from '@/types';

type Step = 'type' | 'company' | 'user';

interface CompanyForm {
  nit: string; businessName: string; commercialName: string;
  address: string; city: string; department: string;
  email: string; phone: string; economicActivity: string;
}
interface UserForm {
  document: string; firstName: string; lastName: string;
  email: string; password: string; confirmPassword: string;
  jobTitle: string; agentRegPassword: string;
}

// ── Variantes ────────────────────────────────────────────────────────────
const stepTransition = (dir: number) => ({
  enter:  { x: dir > 0 ? 80 : -80, opacity: 0, scale: 0.96 },
  center: { x: 0, opacity: 1, scale: 1,
    transition: { type: 'spring' as const, stiffness: 280, damping: 28 } },
  exit:   (d: number) => ({
    x: d > 0 ? -80 : 80, opacity: 0, scale: 0.96,
    transition: { duration: 0.22 } }),
});

const fieldVariants: Variants = {
  hidden:  { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: 0.05 + i * 0.07, duration: 0.38, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [userType, setUserType] = useState<UserType>('client');
  const [step, setStep] = useState<Step>('type');
  const [dir, setDir] = useState(1);
  const [showPass, setShowPass] = useState(false);
  const [showAgentPass, setShowAgentPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  useEffect(() => { municipiosApi.listPublic().then(setMunicipios).catch(() => {}); }, []);

  const [companyMode, setCompanyMode] = useState<'new' | 'existing'>('new');
  const [company, setCompany] = useState<CompanyForm>({
    nit: '', businessName: '', commercialName: '',
    address: '', city: '', department: '',
    email: '', phone: '', economicActivity: '',
  });
  const [user, setUser] = useState<UserForm>({
    document: '', firstName: '', lastName: '',
    email: '', password: '', confirmPassword: '',
    jobTitle: '', agentRegPassword: '',
  });

  const handleCompany = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompany((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError('');
  };
  const handleUser = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUser((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError('');
  };

  const goTo = (next: Step, direction = 1) => {
    setDir(direction); setError(''); setStep(next);
  };

  const validateCompany = () => {
    if (!company.nit.trim()) return 'El NIT es requerido';
    if (companyMode === 'new') {
      if (!company.businessName.trim()) return 'La razón social es requerida';
      if (!company.city.trim()) return 'Selecciona un municipio';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.document || !user.firstName || !user.lastName || !user.email || !user.password) {
      setError('Completa todos los campos obligatorios'); return;
    }
    if (user.password !== user.confirmPassword) { setError('Las contraseñas no coinciden'); return; }
    if (user.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (userType === 'agent' && !user.agentRegPassword) {
      setError('La contraseña de registro de agente es requerida'); return;
    }
    setLoading(true);
    try {
      const payload: Record<string, string> = {
        userType,
        document: user.document, firstName: user.firstName, lastName: user.lastName,
        email: user.email, password: user.password,
        ...(user.jobTitle && { jobTitle: user.jobTitle }),
        ...(userType === 'agent' && { agentRegPassword: user.agentRegPassword }),
        ...(userType === 'client' && {
          companyNit: company.nit,
          ...(companyMode === 'new' && company.businessName && { companyBusinessName: company.businessName }),
          ...(companyMode === 'new' && company.commercialName && { companyCommercialName: company.commercialName }),
          ...(companyMode === 'new' && company.address && { companyAddress: company.address }),
          ...(companyMode === 'new' && company.city && { companyCity: company.city }),
          ...(companyMode === 'new' && company.department && { companyDepartment: company.department }),
          ...(companyMode === 'new' && company.email && { companyEmail: company.email }),
          ...(companyMode === 'new' && company.phone && { companyPhone: company.phone }),
          ...(companyMode === 'new' && company.economicActivity && { companyEconomicActivity: company.economicActivity }),
        }),
      };
      const data = await authApi.register(payload);
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`¡Bienvenido, ${data.user.firstName}!`);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al crear la cuenta';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  const stepOrder: Step[] = userType === 'client' ? ['type', 'company', 'user'] : ['type', 'user'];
  const currentIdx = stepOrder.indexOf(step);
  const variants = stepTransition(dir);

  // ── Componentes auxiliares ────────────────────────────────────────────
  const Field = ({ i, children }: { i: number; children: React.ReactNode }) => (
    <motion.div custom={i} variants={fieldVariants} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );

  const ErrorBox = ({ msg }: { msg: string }) => (
    <motion.div initial={{ opacity: 0, height: 0, scale: 0.95 }}
      animate={{ opacity: 1, height: 'auto', scale: 1 }}
      exit={{ opacity: 0, height: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 overflow-hidden"
      style={{ background: 'var(--accent-red-bg)', border: '1px solid rgba(248,113,113,0.28)' }}>
      <AlertCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-red)' }} />
      <span className="text-sm" style={{ color: 'var(--accent-red)' }}>{msg}</span>
    </motion.div>
  );

  const InputIcon = ({ icon: Icon }: { icon: React.ElementType }) => (
    <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
  );

  return (
    <div className="flex min-h-screen items-center justify-center py-8">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        {/* ── Cabecera ─────────────────────────────────────────── */}
        <div className="text-center mb-6">
          <motion.div className="flex justify-center mb-3"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}>
            <AuraLogo size={60} animate />
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}>
            <AuraText />
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="flex items-center justify-center gap-2 mt-2">
            <div className="h-px w-10" style={{ background: 'var(--border-strong)' }} />
            <span className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: 'var(--text-muted)' }}>Crear cuenta</span>
            <div className="h-px w-10" style={{ background: 'var(--border-strong)' }} />
          </motion.div>
        </div>

        {/* ── Indicador de pasos ────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-2 mb-5">
          {stepOrder.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s} className="flex items-center gap-2">
                <motion.div
                  animate={{
                    scale: active ? 1.15 : 1,
                    boxShadow: active ? '0 0 16px var(--accent-violet-bg)' : '0 0 0 transparent',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                  style={{
                    background: done ? 'var(--accent-green-bg)' : active ? 'var(--accent-violet-bg)' : 'var(--surface-2)',
                    border: done ? '1px solid rgba(52,211,153,0.4)' : active ? '1px solid var(--accent-violet-border)' : '1px solid var(--border-subtle)',
                    color: done ? 'var(--accent-green)' : active ? 'var(--accent-violet)' : 'var(--text-muted)',
                  }}
                >
                  <AnimatePresence mode="wait">
                    {done ? (
                      <motion.div key="check"
                        initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 500 }}>
                        <Check className="w-3.5 h-3.5" />
                      </motion.div>
                    ) : (
                      <motion.span key={`n${i}`} initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        {i + 1}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
                {i < stepOrder.length - 1 && (
                  <div className="relative h-px w-8">
                    <div className="absolute inset-0" style={{ background: 'var(--border-subtle)' }} />
                    <motion.div className="absolute inset-0 origin-left"
                      initial={{ scaleX: 0 }} animate={{ scaleX: done ? 1 : 0 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      style={{ background: 'var(--accent-green)' }} />
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>

        {/* ── Card ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="glass-strong rounded-2xl overflow-hidden"
        >
          <AnimatePresence mode="wait" custom={dir}>

            {/* ── PASO 1: TIPO ── */}
            {step === 'type' && (
              <motion.div key="type" custom={dir}
                variants={variants} initial="enter" animate="center" exit="exit"
                className="p-8">
                <Field i={0}>
                  <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Crear cuenta
                  </h2>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                    ¿Cómo vas a usar AURA?
                  </p>
                </Field>

                <Field i={1}>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      {
                        type: 'client' as UserType, label: 'Empresa / Cliente', icon: Building2,
                        desc: 'Soy una empresa que contrata las implementaciones.',
                        accentBg: 'var(--accent-green-bg)', accentBorder: 'rgba(52,211,153,0.4)',
                        accentColor: 'var(--accent-green)', accentIconBg: 'rgba(52,211,153,0.15)',
                      },
                      {
                        type: 'agent' as UserType, label: 'Agente Infotec', icon: Users,
                        desc: 'Soy coordinador o implementador de Sistemas Infotec.',
                        accentBg: 'var(--accent-violet-bg)', accentBorder: 'var(--accent-violet-border)',
                        accentColor: 'var(--accent-violet)', accentIconBg: 'rgba(167,139,250,0.15)',
                      },
                    ].map(({ type, label, icon: Icon, desc, accentBg, accentBorder, accentColor, accentIconBg }) => {
                      const isActive = userType === type;
                      return (
                        <button key={type} type="button"
                          onClick={() => setUserType(type)}
                          className="flex flex-col items-center gap-3 p-5 rounded-xl text-center border-2 transition-all duration-200 active:scale-95"
                          style={{
                            background:   isActive ? accentBg        : 'var(--surface-2)',
                            borderColor:  isActive ? accentBorder     : 'var(--border-subtle)',
                            borderStyle:  'solid',
                          }}
                        >
                          <div className="p-3 rounded-lg transition-colors duration-200"
                            style={{ background: isActive ? accentIconBg : 'var(--surface-2)' }}>
                            <Icon className="w-6 h-6"
                              style={{ color: isActive ? accentColor : 'var(--text-muted)' }} />
                          </div>
                          <span className="text-sm font-bold leading-tight"
                            style={{ color: isActive ? accentColor : 'var(--text-secondary)' }}>
                            {label}
                          </span>
                          <span className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
                            {desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field i={2}>
                  <motion.button onClick={() => goTo(userType === 'client' ? 'company' : 'user')}
                    whileTap={{ scale: 0.97 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2">
                    Continuar <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </Field>

                <Field i={3}>
                  <div className="flex items-center gap-3 mt-5 mb-4">
                    <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>¿Ya tienes cuenta?</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                  </div>
                  <Link href="/login">
                    <div className="btn-glass w-full rounded-xl py-3 text-sm font-medium text-center cursor-pointer flex items-center justify-center gap-2">
                      <ChevronLeft className="w-4 h-4" /> Iniciar sesión
                    </div>
                  </Link>
                </Field>
              </motion.div>
            )}

            {/* ── PASO 2: EMPRESA ── */}
            {step === 'company' && (
              <motion.div key="company" custom={dir}
                variants={variants} initial="enter" animate="center" exit="exit"
                className="p-8">
                <Field i={0}>
                  <button onClick={() => goTo('type', -1)}
                    className="flex items-center gap-1 text-sm mb-4 transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}>
                    <ChevronLeft className="w-4 h-4" /> Volver
                  </button>
                  <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Empresa cliente
                  </h2>
                  <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                    ¿La empresa ya está registrada en AURA?
                  </p>
                </Field>

                <Field i={1}>
                  <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                    {[
                      { key: 'existing', label: 'Ya registrada', icon: Check },
                      { key: 'new',      label: 'Registrar nueva', icon: Building2 },
                    ].map(({ key, label, icon: Icon }) => (
                      <button key={key} type="button"
                        onClick={() => { setCompanyMode(key as 'new' | 'existing'); setError(''); }}
                        className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95"
                        style={{
                          background: companyMode === key ? 'var(--accent-green-bg)' : 'transparent',
                          color:      companyMode === key ? 'var(--accent-green)'    : 'var(--text-muted)',
                          border:     companyMode === key ? '1px solid rgba(52,211,153,0.3)' : '1px solid transparent',
                        }}>
                        <Icon className="w-4 h-4" /> {label}
                      </button>
                    ))}
                  </div>
                </Field>

                <AnimatePresence>{error && <ErrorBox msg={error} />}</AnimatePresence>

                <AnimatePresence mode="wait">
                  {companyMode === 'existing' ? (
                    <motion.div key="existing"
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                      className="space-y-4">
                      <Field i={0}>
                        <div className="flex items-start gap-3 rounded-xl p-4"
                          style={{ background: 'var(--accent-green-bg)', border: '1px solid rgba(52,211,153,0.25)' }}>
                          <Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--accent-green)' }} />
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            Ingresa el <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>NIT</span> de
                            tu empresa para asociar tu cuenta automáticamente.
                          </p>
                        </div>
                      </Field>
                      <Field i={1}>
                        <label className="block text-xs font-semibold tracking-wide mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>
                          NIT de la empresa <span style={{ color: 'var(--accent-red)' }}>*</span>
                        </label>
                        <div className="relative">
                          <InputIcon icon={Hash} />
                          <input type="text" name="nit" value={company.nit} onChange={handleCompany}
                            placeholder="900123456-7"
                            className="input-glass w-full rounded-xl pl-10 pr-4 py-3 text-sm" />
                        </div>
                        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                          Debe coincidir exactamente con el registrado por el administrador.
                        </p>
                      </Field>
                    </motion.div>
                  ) : (
                    <motion.div key="new"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                      className="space-y-3">
                      {[
                        { i: 0, name: 'nit', label: 'NIT', icon: Hash, placeholder: '900123456-7', required: true },
                        { i: 1, name: 'businessName', label: 'Razón Social', icon: FileText, placeholder: 'Hospital San Jorge S.A.S', required: true },
                        { i: 2, name: 'commercialName', label: 'Nombre Comercial', icon: Building2, placeholder: 'Hospital San Jorge', required: false },
                      ].map(({ i, name, label, icon, placeholder, required }) => (
                        <Field key={name} i={i}>
                          <label className="block text-xs font-semibold tracking-wide mb-1.5"
                            style={{ color: 'var(--text-secondary)' }}>
                            {label}{' '}
                            {required
                              ? <span style={{ color: 'var(--accent-red)' }}>*</span>
                              : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>}
                          </label>
                          <div className="relative">
                            <InputIcon icon={icon} />
                            <input type="text" name={name}
                              value={(company as any)[name]} onChange={handleCompany}
                              placeholder={placeholder}
                              className="input-glass w-full rounded-xl pl-10 pr-4 py-2.5 text-sm" />
                          </div>
                        </Field>
                      ))}
                      <Field i={3}>
                        <MunicipioSearch municipios={municipios}
                          value={company.city ? `${company.city}${company.department ? `, ${company.department}` : ''}` : ''}
                          onSelect={m => setCompany(p => ({ ...p, city: m?.nombreMunicipio ?? '', department: m?.nombreDepartamento ?? '' }))}
                          label="Municipio" required placeholder="Buscar municipio..."
                          inputClassName="input-glass rounded-xl pl-10 pr-8 py-2.5 text-sm" />
                      </Field>
                      <Field i={4}>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold tracking-wide mb-1.5"
                              style={{ color: 'var(--text-secondary)' }}>Correo empresa</label>
                            <div className="relative">
                              <InputIcon icon={Mail} />
                              <input type="email" name="email" value={company.email} onChange={handleCompany}
                                placeholder="info@empresa.com"
                                className="input-glass w-full rounded-xl pl-10 pr-3 py-2.5 text-sm" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold tracking-wide mb-1.5"
                              style={{ color: 'var(--text-secondary)' }}>Teléfono</label>
                            <div className="relative">
                              <InputIcon icon={Phone} />
                              <input type="tel" name="phone" value={company.phone} onChange={handleCompany}
                                placeholder="3101234567"
                                className="input-glass w-full rounded-xl pl-10 pr-3 py-2.5 text-sm" />
                            </div>
                          </div>
                        </div>
                      </Field>
                      <Field i={5}>
                        <label className="block text-xs font-semibold tracking-wide mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>Actividad económica</label>
                        <input type="text" name="economicActivity" value={company.economicActivity}
                          onChange={handleCompany} placeholder="Ej: Servicios de salud"
                          className="input-glass w-full rounded-xl px-4 py-2.5 text-sm" />
                      </Field>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Field i={6}>
                  <motion.button onClick={() => { const err = validateCompany(); if (err) { setError(err); return; } goTo('user'); }}
                    whileTap={{ scale: 0.97 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 mt-5">
                    Continuar <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </Field>
              </motion.div>
            )}

            {/* ── PASO 3: USUARIO ── */}
            {step === 'user' && (
              <motion.div key="user" custom={dir}
                variants={variants} initial="enter" animate="center" exit="exit"
                className="p-8">
                <Field i={0}>
                  <button onClick={() => goTo(userType === 'client' ? 'company' : 'type', -1)}
                    className="flex items-center gap-1 text-sm mb-4 transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}>
                    <ChevronLeft className="w-4 h-4" /> Volver
                  </button>
                  <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Datos personales
                  </h2>
                  <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                    {userType === 'client' ? 'Tu información como contacto principal' : 'Información del agente'}
                  </p>
                </Field>

                <AnimatePresence>{error && <ErrorBox msg={error} />}</AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <Field i={1}>
                    <label className="block text-xs font-semibold tracking-wide mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}>
                      Documento <span style={{ color: 'var(--accent-red)' }}>*</span>
                    </label>
                    <div className="relative">
                      <InputIcon icon={IdCard} />
                      <input type="text" name="document" value={user.document} onChange={handleUser}
                        placeholder="Número de documento"
                        className="input-glass w-full rounded-xl pl-10 pr-4 py-2.5 text-sm" />
                    </div>
                  </Field>

                  <Field i={2}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold tracking-wide mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>
                          Nombre <span style={{ color: 'var(--accent-red)' }}>*</span>
                        </label>
                        <div className="relative">
                          <InputIcon icon={User} />
                          <input type="text" name="firstName" value={user.firstName} onChange={handleUser}
                            placeholder="Carlos"
                            className="input-glass w-full rounded-xl pl-10 pr-3 py-2.5 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-wide mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>
                          Apellido <span style={{ color: 'var(--accent-red)' }}>*</span>
                        </label>
                        <input type="text" name="lastName" value={user.lastName} onChange={handleUser}
                          placeholder="Anillo"
                          className="input-glass w-full rounded-xl px-4 py-2.5 text-sm" />
                      </div>
                    </div>
                  </Field>

                  <Field i={3}>
                    <label className="block text-xs font-semibold tracking-wide mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}>
                      Correo <span style={{ color: 'var(--accent-red)' }}>*</span>
                    </label>
                    <div className="relative">
                      <InputIcon icon={Mail} />
                      <input type="email" name="email" value={user.email} onChange={handleUser}
                        placeholder="correo@empresa.com"
                        className="input-glass w-full rounded-xl pl-10 pr-4 py-2.5 text-sm" />
                    </div>
                  </Field>

                  <Field i={4}>
                    <label className="block text-xs font-semibold tracking-wide mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}>
                      Cargo{' '}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
                    </label>
                    <div className="relative">
                      <InputIcon icon={Briefcase} />
                      <input type="text" name="jobTitle" value={user.jobTitle} onChange={handleUser}
                        placeholder="Líder de proyecto, Coordinador..."
                        className="input-glass w-full rounded-xl pl-10 pr-4 py-2.5 text-sm" />
                    </div>
                  </Field>

                  <Field i={5}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold tracking-wide mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>
                          Contraseña <span style={{ color: 'var(--accent-red)' }}>*</span>
                        </label>
                        <div className="relative">
                          <InputIcon icon={Lock} />
                          <input type={showPass ? 'text' : 'password'} name="password"
                            value={user.password} onChange={handleUser} placeholder="Mín. 8 car."
                            className="input-glass w-full rounded-xl pl-10 pr-10 py-2.5 text-sm" />
                          <button type="button" onClick={() => setShowPass(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--text-muted)' }}>
                            <motion.div key={showPass ? 'off' : 'on'}
                              initial={{ rotate: -15, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
                              transition={{ duration: 0.2 }}>
                              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </motion.div>
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-wide mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>
                          Confirmar <span style={{ color: 'var(--accent-red)' }}>*</span>
                        </label>
                        <div className="relative">
                          <InputIcon icon={Lock} />
                          <input type={showPass ? 'text' : 'password'} name="confirmPassword"
                            value={user.confirmPassword} onChange={handleUser} placeholder="Repite"
                            className="input-glass w-full rounded-xl pl-10 pr-3 py-2.5 text-sm" />
                        </div>
                      </div>
                    </div>
                  </Field>

                  {userType === 'agent' && (
                    <Field i={6}>
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <label className="block text-xs font-semibold tracking-wide mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--accent-violet)' }} />
                            Contraseña de agente <span style={{ color: 'var(--accent-red)' }}>*</span>
                          </span>
                        </label>
                        <div className="relative">
                          <InputIcon icon={Lock} />
                          <input type={showAgentPass ? 'text' : 'password'} name="agentRegPassword"
                            value={user.agentRegPassword} onChange={handleUser}
                            placeholder="Solicitarla al administrador"
                            className="input-glass w-full rounded-xl pl-10 pr-10 py-2.5 text-sm"
                            style={{ borderColor: 'var(--accent-violet-border)' }} />
                          <button type="button" onClick={() => setShowAgentPass(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--text-muted)' }}>
                            {showAgentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          Requerida para cuentas de agente. Solicítala al administrador.
                        </p>
                      </motion.div>
                    </Field>
                  )}

                  <Field i={7}>
                    <motion.button type="submit" disabled={loading}
                      whileTap={{ scale: 0.97 }}
                      whileTap={{ scale: 0.97 }}
                      className="btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
                      <AnimatePresence mode="wait">
                        {loading ? (
                          <motion.span key="loading" className="flex items-center gap-2"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Loader2 className="w-4 h-4 animate-spin" /> Creando cuenta...
                          </motion.span>
                        ) : (
                          <motion.span key="idle" className="flex items-center gap-2"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Check className="w-4 h-4" /> Crear Cuenta
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  </Field>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="text-center text-xs mt-5" style={{ color: 'var(--text-muted)' }}>
          © 2024 Sistemas Infotec · AURA ERP v1.0.0
        </motion.p>
      </motion.div>
    </div>
  );
}
