'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
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

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
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
    setDir(direction);
    setError('');
    setStep(next);
  };

  const nextFromType = () => {
    goTo(userType === 'client' ? 'company' : 'user');
  };

  const validateCompany = () => {
    if (!company.nit.trim()) return 'El NIT es requerido';
    if (companyMode === 'new') {
      if (!company.businessName.trim()) return 'La razón social es requerida';
      if (!company.city.trim()) return 'Selecciona un municipio';
    }
    return null;
  };

  const nextFromCompany = () => {
    const err = validateCompany();
    if (err) { setError(err); return; }
    goTo('user');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.document || !user.firstName || !user.lastName || !user.email || !user.password) {
      setError('Completa todos los campos obligatorios');
      return;
    }
    if (user.password !== user.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (user.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (userType === 'agent' && !user.agentRegPassword) {
      setError('La contraseña de registro de agente es requerida');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, string> = {
        userType,
        document: user.document,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: user.password,
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

  // ── Shared error box ──────────────────────────────────────────────────────
  const ErrorBox = ({ msg }: { msg: string }) => (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4"
      style={{ background: 'var(--accent-red-bg)', border: '1px solid rgba(248,113,113,0.28)' }}>
      <AlertCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-red)' }} />
      <span className="text-sm" style={{ color: 'var(--accent-red)' }}>{msg}</span>
    </motion.div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Cabecera */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <AuraLogo size={60} animate />
          </div>
          <AuraText />
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="h-px w-10" style={{ background: 'var(--border-strong)' }} />
            <span className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: 'var(--text-muted)' }}>
              Crear cuenta
            </span>
            <div className="h-px w-10" style={{ background: 'var(--border-strong)' }} />
          </div>
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {stepOrder.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s} className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: active ? 1.1 : 1 }}
                  className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: done
                      ? 'var(--accent-green-bg)'
                      : active
                      ? 'var(--accent-violet-bg)'
                      : 'var(--surface-2)',
                    border: done
                      ? '1px solid rgba(52,211,153,0.4)'
                      : active
                      ? '1px solid var(--accent-violet-border)'
                      : '1px solid var(--border-subtle)',
                    color: done
                      ? 'var(--accent-green)'
                      : active
                      ? 'var(--accent-violet)'
                      : 'var(--text-muted)',
                    boxShadow: active ? '0 0 12px var(--accent-violet-bg)' : 'none',
                  }}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </motion.div>
                {i < stepOrder.length - 1 && (
                  <div className="h-px w-8 transition-all"
                    style={{ background: done ? 'var(--accent-green)' : 'var(--border-subtle)' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>

            {/* ── PASO 1: TIPO ── */}
            {step === 'type' && (
              <motion.div key="type" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="p-8"
              >
                <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Crear cuenta
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                  ¿Cómo vas a usar AURA?
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    {
                      type: 'client' as UserType,
                      label: 'Empresa / Cliente',
                      icon: Building2,
                      desc: 'Soy una empresa que contrata las implementaciones y quiero hacer seguimiento de mi proyecto.',
                      accentBg: 'var(--accent-green-bg)',
                      accentBorder: 'rgba(52,211,153,0.4)',
                      accentColor: 'var(--accent-green)',
                      accentIconBg: 'rgba(52,211,153,0.15)',
                    },
                    {
                      type: 'agent' as UserType,
                      label: 'Agente Infotec',
                      icon: Users,
                      desc: 'Soy coordinador o implementador de Sistemas Infotec.',
                      accentBg: 'var(--accent-violet-bg)',
                      accentBorder: 'var(--accent-violet-border)',
                      accentColor: 'var(--accent-violet)',
                      accentIconBg: 'rgba(167,139,250,0.15)',
                    },
                  ].map(({ type, label, icon: Icon, desc, accentBg, accentBorder, accentColor, accentIconBg }) => {
                    const isActive = userType === type;
                    return (
                      <motion.button key={type} type="button"
                        onClick={() => setUserType(type)}
                        whileTap={{ scale: 0.97 }}
                        className="flex flex-col items-center gap-3 p-5 rounded-xl text-center transition-all"
                        style={{
                          background: isActive ? accentBg : 'var(--surface-2)',
                          border: `2px solid ${isActive ? accentBorder : 'var(--border-subtle)'}`,
                          boxShadow: isActive ? `0 0 20px ${accentBg}` : 'none',
                        }}
                      >
                        <div className="p-3 rounded-lg transition-all"
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
                      </motion.button>
                    );
                  })}
                </div>

                <motion.button onClick={nextFromType} whileTap={{ scale: 0.98 }}
                  className="btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2">
                  Continuar <ChevronRight className="w-4 h-4" />
                </motion.button>

                <div className="flex items-center gap-3 mt-5 mb-4">
                  <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>¿Ya tienes cuenta?</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                </div>
                <Link href="/login">
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    className="btn-glass w-full rounded-xl py-3 text-sm font-medium text-center cursor-pointer flex items-center justify-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> Iniciar sesión
                  </motion.div>
                </Link>
              </motion.div>
            )}

            {/* ── PASO 2: EMPRESA ── */}
            {step === 'company' && (
              <motion.div key="company" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="p-8"
              >
                <button onClick={() => goTo('type', -1)}
                  className="flex items-center gap-1 text-sm mb-4 transition-colors"
                  style={{ color: 'var(--text-muted)' }}>
                  <ChevronLeft className="w-4 h-4" /> Volver
                </button>
                <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Empresa cliente
                </h2>
                <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                  ¿La empresa ya está registrada en AURA?
                </p>

                {/* Toggle nueva / existente */}
                <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                  {[
                    { key: 'existing', label: 'Ya registrada', icon: Check },
                    { key: 'new',      label: 'Registrar nueva', icon: Building2 },
                  ].map(({ key, label, icon: Icon }) => (
                    <button key={key} type="button"
                      onClick={() => { setCompanyMode(key as 'new' | 'existing'); setError(''); }}
                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all"
                      style={companyMode === key
                        ? { background: 'var(--accent-green-bg)', color: 'var(--accent-green)', border: '1px solid rgba(52,211,153,0.3)' }
                        : { color: 'var(--text-muted)', border: '1px solid transparent' }
                      }>
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {error && <ErrorBox msg={error} />}
                </AnimatePresence>

                {/* Empresa ya registrada */}
                {companyMode === 'existing' && (
                  <motion.div key="existing-form"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }} className="space-y-4">
                    <div className="flex items-start gap-3 rounded-xl p-4"
                      style={{ background: 'var(--accent-green-bg)', border: '1px solid rgba(52,211,153,0.25)' }}>
                      <Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--accent-green)' }} />
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        Ingresa el <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>NIT</span> de
                        tu empresa. Si ya está registrada, tu cuenta quedará asociada automáticamente.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold tracking-wide mb-1.5"
                        style={{ color: 'var(--text-secondary)' }}>
                        NIT de la empresa <span style={{ color: 'var(--accent-red)' }}>*</span>
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                          style={{ color: 'var(--text-muted)' }} />
                        <input type="text" name="nit" value={company.nit} onChange={handleCompany}
                          placeholder="900123456-7"
                          className="input-glass w-full rounded-xl pl-10 pr-4 py-3 text-sm" />
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        El NIT debe coincidir exactamente con el registrado por el administrador.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Nueva empresa */}
                {companyMode === 'new' && (
                  <motion.div key="new-form"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }} className="space-y-3">
                    {[
                      { name: 'nit', label: 'NIT', icon: Hash, placeholder: '900123456-7', required: true },
                      { name: 'businessName', label: 'Razón Social', icon: FileText, placeholder: 'Hospital San Jorge S.A.S', required: true },
                      { name: 'commercialName', label: 'Nombre Comercial', icon: Building2, placeholder: 'Hospital San Jorge', required: false },
                    ].map(({ name, label, icon: Icon, placeholder, required }) => (
                      <div key={name}>
                        <label className="block text-xs font-semibold tracking-wide mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>
                          {label}{' '}
                          {required
                            ? <span style={{ color: 'var(--accent-red)' }}>*</span>
                            : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
                          }
                        </label>
                        <div className="relative">
                          <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                            style={{ color: 'var(--text-muted)' }} />
                          <input type="text" name={name}
                            value={(company as any)[name]} onChange={handleCompany}
                            placeholder={placeholder}
                            className="input-glass w-full rounded-xl pl-10 pr-4 py-2.5 text-sm" />
                        </div>
                      </div>
                    ))}
                    <div>
                      <MunicipioSearch
                        municipios={municipios}
                        value={company.city ? `${company.city}${company.department ? `, ${company.department}` : ''}` : ''}
                        onSelect={m => setCompany(p => ({
                          ...p, city: m?.nombreMunicipio ?? '', department: m?.nombreDepartamento ?? '',
                        }))}
                        label="Municipio" required
                        placeholder="Buscar municipio o departamento..."
                        inputClassName="input-glass rounded-xl pl-10 pr-8 py-2.5 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold tracking-wide mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>Correo empresa</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                            style={{ color: 'var(--text-muted)' }} />
                          <input type="email" name="email" value={company.email} onChange={handleCompany}
                            placeholder="info@empresa.com"
                            className="input-glass w-full rounded-xl pl-10 pr-3 py-2.5 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold tracking-wide mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>Teléfono</label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                            style={{ color: 'var(--text-muted)' }} />
                          <input type="tel" name="phone" value={company.phone} onChange={handleCompany}
                            placeholder="3101234567"
                            className="input-glass w-full rounded-xl pl-10 pr-3 py-2.5 text-sm" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold tracking-wide mb-1.5"
                        style={{ color: 'var(--text-secondary)' }}>Actividad económica</label>
                      <input type="text" name="economicActivity" value={company.economicActivity}
                        onChange={handleCompany} placeholder="Ej: Servicios de salud"
                        className="input-glass w-full rounded-xl px-4 py-2.5 text-sm" />
                    </div>
                  </motion.div>
                )}

                <motion.button onClick={nextFromCompany} whileTap={{ scale: 0.98 }}
                  className="btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 mt-5">
                  Continuar <ChevronRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}

            {/* ── PASO 3: DATOS USUARIO ── */}
            {step === 'user' && (
              <motion.div key="user" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="p-8"
              >
                <button onClick={() => goTo(userType === 'client' ? 'company' : 'type', -1)}
                  className="flex items-center gap-1 text-sm mb-4 transition-colors"
                  style={{ color: 'var(--text-muted)' }}>
                  <ChevronLeft className="w-4 h-4" /> Volver
                </button>
                <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Datos personales
                </h2>
                <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                  {userType === 'client' ? 'Tu información como contacto principal' : 'Información del agente'}
                </p>

                <AnimatePresence>
                  {error && <ErrorBox msg={error} />}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-3">
                  {/* Documento */}
                  <div>
                    <label className="block text-xs font-semibold tracking-wide mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}>
                      Documento <span style={{ color: 'var(--accent-red)' }}>*</span>
                    </label>
                    <div className="relative">
                      <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: 'var(--text-muted)' }} />
                      <input type="text" name="document" value={user.document} onChange={handleUser}
                        placeholder="Número de documento"
                        className="input-glass w-full rounded-xl pl-10 pr-4 py-2.5 text-sm" />
                    </div>
                  </div>

                  {/* Nombre + Apellido */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold tracking-wide mb-1.5"
                        style={{ color: 'var(--text-secondary)' }}>
                        Nombre <span style={{ color: 'var(--accent-red)' }}>*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                          style={{ color: 'var(--text-muted)' }} />
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

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold tracking-wide mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}>
                      Correo <span style={{ color: 'var(--accent-red)' }}>*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: 'var(--text-muted)' }} />
                      <input type="email" name="email" value={user.email} onChange={handleUser}
                        placeholder="correo@empresa.com"
                        className="input-glass w-full rounded-xl pl-10 pr-4 py-2.5 text-sm" />
                    </div>
                  </div>

                  {/* Cargo */}
                  <div>
                    <label className="block text-xs font-semibold tracking-wide mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}>
                      Cargo{' '}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: 'var(--text-muted)' }} />
                      <input type="text" name="jobTitle" value={user.jobTitle} onChange={handleUser}
                        placeholder="Líder de proyecto, Coordinador..."
                        className="input-glass w-full rounded-xl pl-10 pr-4 py-2.5 text-sm" />
                    </div>
                  </div>

                  {/* Contraseñas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold tracking-wide mb-1.5"
                        style={{ color: 'var(--text-secondary)' }}>
                        Contraseña <span style={{ color: 'var(--accent-red)' }}>*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                          style={{ color: 'var(--text-muted)' }} />
                        <input type={showPass ? 'text' : 'password'} name="password"
                          value={user.password} onChange={handleUser} placeholder="Mín. 8 car."
                          className="input-glass w-full rounded-xl pl-10 pr-10 py-2.5 text-sm" />
                        <button type="button" onClick={() => setShowPass((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          style={{ color: 'var(--text-muted)' }}>
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold tracking-wide mb-1.5"
                        style={{ color: 'var(--text-secondary)' }}>
                        Confirmar <span style={{ color: 'var(--accent-red)' }}>*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                          style={{ color: 'var(--text-muted)' }} />
                        <input type={showPass ? 'text' : 'password'} name="confirmPassword"
                          value={user.confirmPassword} onChange={handleUser} placeholder="Repite"
                          className="input-glass w-full rounded-xl pl-10 pr-3 py-2.5 text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Contraseña agente */}
                  {userType === 'agent' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="block text-xs font-semibold tracking-wide mb-1.5"
                        style={{ color: 'var(--text-secondary)' }}>
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--accent-violet)' }} />
                          Contraseña de agente <span style={{ color: 'var(--accent-red)' }}>*</span>
                        </span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                          style={{ color: 'var(--text-muted)' }} />
                        <input type={showAgentPass ? 'text' : 'password'} name="agentRegPassword"
                          value={user.agentRegPassword} onChange={handleUser}
                          placeholder="Solicitarla al administrador"
                          className="input-glass w-full rounded-xl pl-10 pr-10 py-2.5 text-sm"
                          style={{ borderColor: 'var(--accent-violet-border)' }} />
                        <button type="button" onClick={() => setShowAgentPass((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          style={{ color: 'var(--text-muted)' }}>
                          {showAgentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Requerida para cuentas de agente. Solicítala al administrador.
                      </p>
                    </motion.div>
                  )}

                  <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
                    className="btn-primary w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando cuenta...</>
                      : <><Check className="w-4 h-4" /> Crear Cuenta</>
                    }
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--text-muted)' }}>
          © 2024 Sistemas Infotec · AURA ERP v1.0.0
        </p>
      </motion.div>
    </div>
  );
}
