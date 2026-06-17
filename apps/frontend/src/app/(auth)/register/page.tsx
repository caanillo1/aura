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

const steps: { key: Step; label: string }[] = [
  { key: 'type', label: 'Tipo' },
  { key: 'company', label: 'Empresa' },
  { key: 'user', label: 'Datos' },
];

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
          // Solo enviar razón social cuando se está creando empresa nueva
          // Si companyMode === 'existing', no se envía → backend hace lookup por NIT
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

  // Índice del paso actual para el indicador
  const stepOrder: Step[] = userType === 'client'
    ? ['type', 'company', 'user']
    : ['type', 'user'];
  const currentIdx = stepOrder.indexOf(step);

  return (
    <div className="flex min-h-screen items-center justify-center py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-7">
          <div className="flex justify-center mb-3">
            <AuraLogo size={60} animate />
          </div>
          <AuraText />
          <p className="text-slate-400 text-xs mt-1.5 tracking-widest uppercase">
            Gestiones Inteligentes
          </p>
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {stepOrder.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                  done ? 'bg-green-500 text-white' :
                  active ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30' :
                  'bg-white/10 text-slate-500'
                }`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < stepOrder.length - 1 && (
                  <div className={`h-px w-8 transition-all ${done ? 'bg-green-500' : 'bg-white/10'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            {/* ── PASO 1: TIPO ──────────────────────────────────────────── */}
            {step === 'type' && (
              <motion.div key="type" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="p-8"
              >
                <h2 className="text-xl font-semibold text-white mb-1">Crear cuenta</h2>
                <p className="text-slate-400 text-sm mb-6">¿Cómo vas a usar AURA?</p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    {
                      type: 'client' as UserType,
                      label: 'Empresa / Cliente',
                      icon: Building2,
                      desc: 'Soy una empresa que contrata las implementaciones y quiero hacer seguimiento de mi proyecto.',
                      color: 'emerald',
                    },
                    {
                      type: 'agent' as UserType,
                      label: 'Agente Infotec',
                      icon: Users,
                      desc: 'Soy coordinador o implementador de Sistemas Infotec.',
                      color: 'violet',
                    },
                  ].map(({ type, label, icon: Icon, desc, color }) => (
                    <motion.button key={type} type="button"
                      onClick={() => setUserType(type)}
                      whileTap={{ scale: 0.97 }}
                      className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all text-center ${
                        userType === type
                          ? color === 'emerald'
                            ? 'border-emerald-500/70 bg-emerald-500/10'
                            : 'border-violet-500/70 bg-violet-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className={`p-3 rounded-lg ${
                        userType === type
                          ? color === 'emerald' ? 'bg-emerald-500/20' : 'bg-violet-500/20'
                          : 'bg-white/5'
                      }`}>
                        <Icon className={`w-6 h-6 ${
                          userType === type
                            ? color === 'emerald' ? 'text-emerald-400' : 'text-violet-400'
                            : 'text-slate-400'
                        }`} />
                      </div>
                      <span className={`text-sm font-bold leading-tight ${
                        userType === type ? 'text-white' : 'text-slate-400'
                      }`}>{label}</span>
                      <span className="text-xs text-slate-500 leading-snug">{desc}</span>
                    </motion.button>
                  ))}
                </div>

                <motion.button onClick={nextFromType} whileTap={{ scale: 0.98 }}
                  className="btn-primary w-full rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2">
                  Continuar <ChevronRight className="w-4 h-4" />
                </motion.button>

                <div className="flex items-center gap-3 mt-5 mb-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-slate-500 text-xs">¿Ya tienes cuenta?</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <Link href="/login">
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    className="w-full rounded-lg py-2.5 text-sm font-medium text-center text-slate-300 hover:text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center justify-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> Iniciar Sesión
                  </motion.div>
                </Link>
              </motion.div>
            )}

            {/* ── PASO 2: EMPRESA (solo cliente) ───────────────────────── */}
            {step === 'company' && (
              <motion.div key="company" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="p-8"
              >
                <button onClick={() => goTo('type', -1)}
                  className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Volver
                </button>
                <h2 className="text-xl font-semibold text-white mb-1">Empresa cliente</h2>
                <p className="text-slate-400 text-sm mb-5">¿La empresa ya está registrada en AURA?</p>

                {/* Toggle nueva / existente */}
                <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-white/5 border border-white/10">
                  {[
                    { key: 'existing', label: 'Ya está registrada', icon: Check },
                    { key: 'new',      label: 'Registrar nueva',   icon: Building2 },
                  ].map(({ key, label, icon: Icon }) => (
                    <button key={key} type="button"
                      onClick={() => { setCompanyMode(key as 'new' | 'existing'); setError(''); }}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        companyMode === key
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}>
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-red-400 text-sm">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── EMPRESA YA REGISTRADA: solo NIT ── */}
                {companyMode === 'existing' && (
                  <motion.div key="existing-form"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4">
                      <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Ingresa el <span className="text-white font-semibold">NIT</span> de tu empresa.
                        Si ya está registrada, tu cuenta quedará asociada automáticamente.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        NIT de la empresa <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" name="nit" value={company.nit} onChange={handleCompany}
                          placeholder="900123456-7"
                          className="input-glass w-full rounded-lg pl-10 pr-4 py-3 text-sm" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5">
                        El NIT debe coincidir exactamente con el registrado por el administrador de AURA.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* ── NUEVA EMPRESA: formulario completo ── */}
                {companyMode === 'new' && (
                  <motion.div key="new-form"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        NIT <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" name="nit" value={company.nit} onChange={handleCompany}
                          placeholder="900123456-7"
                          className="input-glass w-full rounded-lg pl-10 pr-4 py-2.5 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Razón Social <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" name="businessName" value={company.businessName} onChange={handleCompany}
                          placeholder="Hospital San Jorge S.A.S"
                          className="input-glass w-full rounded-lg pl-10 pr-4 py-2.5 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Nombre Comercial <span className="text-slate-500 font-normal">(opcional)</span>
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" name="commercialName" value={company.commercialName} onChange={handleCompany}
                          placeholder="Hospital San Jorge"
                          className="input-glass w-full rounded-lg pl-10 pr-4 py-2.5 text-sm" />
                      </div>
                    </div>
                    <div>
                      <MunicipioSearch
                        municipios={municipios}
                        value={company.city ? `${company.city}${company.department ? `, ${company.department}` : ''}` : ''}
                        onSelect={m => setCompany(p => ({
                          ...p,
                          city:       m?.nombreMunicipio ?? '',
                          department: m?.nombreDepartamento ?? '',
                        }))}
                        label="Municipio"
                        required
                        placeholder="Buscar municipio o departamento..."
                        inputClassName="input-glass rounded-lg pl-10 pr-8 py-2.5 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Correo empresa</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input type="email" name="email" value={company.email} onChange={handleCompany}
                            placeholder="info@empresa.com"
                            className="input-glass w-full rounded-lg pl-10 pr-3 py-2.5 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Teléfono</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input type="tel" name="phone" value={company.phone} onChange={handleCompany}
                            placeholder="3101234567"
                            className="input-glass w-full rounded-lg pl-10 pr-3 py-2.5 text-sm" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Actividad económica</label>
                      <input type="text" name="economicActivity" value={company.economicActivity} onChange={handleCompany}
                        placeholder="Ej: Servicios de salud"
                        className="input-glass w-full rounded-lg px-4 py-2.5 text-sm" />
                    </div>
                  </motion.div>
                )}

                <motion.button onClick={nextFromCompany} whileTap={{ scale: 0.98 }}
                  className="btn-primary w-full rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 mt-5">
                  Continuar <ChevronRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}

            {/* ── PASO 3: DATOS USUARIO ─────────────────────────────────── */}
            {step === 'user' && (
              <motion.div key="user" custom={dir} variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="p-8"
              >
                <button onClick={() => goTo(userType === 'client' ? 'company' : 'type', -1)}
                  className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Volver
                </button>
                <h2 className="text-xl font-semibold text-white mb-1">Datos personales</h2>
                <p className="text-slate-400 text-sm mb-5">
                  {userType === 'client' ? 'Tu información como contacto principal' : 'Información del agente'}
                </p>

                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-red-400 text-sm">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-3">
                  {/* Documento */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Documento <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" name="document" value={user.document} onChange={handleUser}
                        placeholder="Número de documento"
                        className="input-glass w-full rounded-lg pl-10 pr-4 py-2.5 text-sm" />
                    </div>
                  </div>

                  {/* Nombre + Apellido */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Nombre <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" name="firstName" value={user.firstName} onChange={handleUser}
                          placeholder="Carlos"
                          className="input-glass w-full rounded-lg pl-10 pr-3 py-2.5 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Apellido <span className="text-red-400">*</span></label>
                      <input type="text" name="lastName" value={user.lastName} onChange={handleUser}
                        placeholder="Anillo"
                        className="input-glass w-full rounded-lg px-4 py-2.5 text-sm" />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Correo <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="email" name="email" value={user.email} onChange={handleUser}
                        placeholder="correo@empresa.com"
                        className="input-glass w-full rounded-lg pl-10 pr-4 py-2.5 text-sm" />
                    </div>
                  </div>

                  {/* Cargo */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Cargo <span className="text-slate-500 font-normal">(opcional)</span>
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" name="jobTitle" value={user.jobTitle} onChange={handleUser}
                        placeholder="Líder de proyecto, Coordinador..."
                        className="input-glass w-full rounded-lg pl-10 pr-4 py-2.5 text-sm" />
                    </div>
                  </div>

                  {/* Contraseña */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Contraseña <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type={showPass ? 'text' : 'password'} name="password" value={user.password} onChange={handleUser}
                          placeholder="Mín. 8 caracteres"
                          className="input-glass w-full rounded-lg pl-10 pr-10 py-2.5 text-sm" />
                        <button type="button" onClick={() => setShowPass((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirmar <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type={showPass ? 'text' : 'password'} name="confirmPassword" value={user.confirmPassword} onChange={handleUser}
                          placeholder="Repite"
                          className="input-glass w-full rounded-lg pl-10 pr-3 py-2.5 text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Contraseña agente */}
                  {userType === 'agent' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                          Contraseña de registro agente <span className="text-red-400">*</span>
                        </span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type={showAgentPass ? 'text' : 'password'} name="agentRegPassword"
                          value={user.agentRegPassword} onChange={handleUser}
                          placeholder="Solicitarla al administrador"
                          className="input-glass w-full rounded-lg pl-10 pr-10 py-2.5 text-sm border-violet-400/30" />
                        <button type="button" onClick={() => setShowAgentPass((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                          {showAgentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Requerida para cuentas de agente. Solicítala al admin.</p>
                    </motion.div>
                  )}

                  <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
                    className="btn-primary w-full rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
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

        <p className="text-center text-slate-600 text-xs mt-5">
          © 2024 Sistemas Infotec · AURA ERP v1.0.0
        </p>
      </motion.div>
    </div>
  );
}
