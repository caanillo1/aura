'use client';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import {
  Building2, Upload, Save, Palette, Mail,
  Info, Eye, EyeOff, Loader2, CheckCircle2, X,
} from 'lucide-react';
import { BackButton } from '@/components/ui/BackButton';
import { companyApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { toast } from 'sonner';

type Tab = 'info' | 'branding' | 'smtp';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'info',     label: 'Información',  icon: Info    },
  { id: 'branding', label: 'Branding',     icon: Palette },
  { id: 'smtp',     label: 'Correo / SMTP', icon: Mail   },
];

const FIELD = 'input-glass w-full rounded-xl px-3 py-2.5 text-sm';

export default function EmpresaPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { can } = usePermission();
  const [tab, setTab]           = useState<Tab>('info');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [showAgentPwd, setShowAgentPwd] = useState(false);
  const logoRef                 = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '', commercialName: '', nit: '',
    address: '', city: '', department: '',
    email: '', phone: '', website: '',
    primaryColor: '#6366f1', secondaryColor: '#0ea5e9',
    logoData: '' as string,
    smtpHost: '', smtpPort: 587 as number | string,
    smtpUser: '', smtpPassword: '',
    smtpFromName: '', smtpFromEmail: '',
    emailSignature: '',
    agentRegPassword: '',
  });

  const tc = isLight
    ? { p: '#0a1628', s: '#1a3050', m: '#4a6080' }
    : { p: '#e2e8f0', s: '#94a3b8', m: '#6b82a0' };

  const glass = {
    background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.12)'}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  };

  useEffect(() => {
    companyApi.get().then((c: any) => {
      setForm({
        name:           c.name          ?? '',
        commercialName: c.commercialName ?? '',
        nit:            c.nit           ?? '',
        address:        c.address       ?? '',
        city:           c.city          ?? '',
        department:     c.department    ?? '',
        email:          c.email         ?? '',
        phone:          c.phone         ?? '',
        website:        c.website       ?? '',
        primaryColor:   c.primaryColor  ?? '#6366f1',
        secondaryColor: c.secondaryColor ?? '#0ea5e9',
        logoData:       c.logoData      ?? '',
        smtpHost:       c.smtpHost      ?? '',
        smtpPort:       c.smtpPort      ?? 587,
        smtpUser:       c.smtpUser      ?? '',
        smtpPassword:   '',
        smtpFromName:   c.smtpFromName  ?? '',
        smtpFromEmail:  c.smtpFromEmail ?? '',
        emailSignature: c.emailSignature ?? '',
        agentRegPassword: '',
      });
    }).catch(() => toast.error('Error al cargar datos de la empresa'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('El logo no debe superar 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => set('logoData', ev.target?.result as string ?? '');
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name:           form.name           || undefined,
        commercialName: form.commercialName || undefined,
        address:        form.address        || undefined,
        city:           form.city           || undefined,
        department:     form.department     || undefined,
        email:          form.email          || undefined,
        phone:          form.phone          || undefined,
        website:        form.website        || undefined,
        primaryColor:   form.primaryColor,
        secondaryColor: form.secondaryColor,
        logoData:       form.logoData       || undefined,
        smtpHost:       form.smtpHost       || undefined,
        smtpPort:       form.smtpPort ? Number(form.smtpPort) : undefined,
        smtpUser:       form.smtpUser       || undefined,
        smtpPassword:     form.smtpPassword     || undefined,
        smtpFromName:     form.smtpFromName     || undefined,
        smtpFromEmail:    form.smtpFromEmail    || undefined,
        emailSignature:   form.emailSignature   || undefined,
        agentRegPassword: form.agentRegPassword || undefined,
      };
      await companyApi.update(payload);
      set('agentRegPassword', '');
      toast.success('Datos de la empresa actualizados');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: tc.m }}>
      {children}
    </label>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#60a5fa' }} />
    </div>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <BackButton href="/configuracion" label="Configuración" />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)' }}>
          <Building2 className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="font-bold text-xl" style={{ color: tc.p }}>Datos de la Empresa</h2>
          <p className="text-sm" style={{ color: tc.m }}>Información general, branding y configuración de correo.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? (isLight ? '#fff' : 'rgba(255,255,255,0.10)') : 'transparent',
                color: active ? '#60a5fa' : tc.m,
                boxShadow: active ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
              }}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Información ──────────────────────────────────────────── */}
      {tab === 'info' && (
        <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 space-y-4" style={glass}>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Razón social *</Label>
              <input className={FIELD} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Razón social" />
            </div>
            <div>
              <Label>Nombre comercial</Label>
              <input className={FIELD} value={form.commercialName} onChange={e => set('commercialName', e.target.value)} placeholder="Nombre comercial" />
            </div>
          </div>

          <div>
            <Label>NIT (no editable)</Label>
            <input className={FIELD} value={form.nit} readOnly
              style={{ opacity: 0.5, cursor: 'not-allowed' }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Email corporativo</Label>
              <input className={FIELD} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="empresa@ejemplo.com" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <input className={FIELD} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+57 300 000 0000" />
            </div>
          </div>

          <div>
            <Label>Sitio web</Label>
            <input className={FIELD} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://empresa.com" />
          </div>

          <div>
            <Label>Dirección</Label>
            <input className={FIELD} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Calle 123 # 45-67" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Ciudad</Label>
              <input className={FIELD} value={form.city} onChange={e => set('city', e.target.value)} placeholder="Bogotá" />
            </div>
            <div>
              <Label>Departamento</Label>
              <input className={FIELD} value={form.department} onChange={e => set('department', e.target.value)} placeholder="Cundinamarca" />
            </div>
          </div>

          {/* Contraseña de agentes */}
          <div className="pt-2" style={{ borderTop: `1px solid ${isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)'}` }}>
            <Label>Contraseña de creación de agentes</Label>
            <div className="relative">
              <input
                className={FIELD}
                type={showAgentPwd ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.agentRegPassword}
                onChange={e => set('agentRegPassword', e.target.value)}
                placeholder="Dejar vacío para no modificar"
                style={{ paddingRight: 40 }}
              />
              <button type="button"
                onClick={() => setShowAgentPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: tc.m }}>
                {showAgentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: tc.m }}>
              Contraseña utilizada por el sistema para registrar agentes. Solo se actualiza si ingresas un valor.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Tab Branding ─────────────────────────────────────────────── */}
      {tab === 'branding' && (
        <motion.div key="branding" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 space-y-5" style={glass}>

          {/* Logo */}
          <div>
            <Label>Logo de la empresa</Label>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="w-24 h-24 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                style={{ background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)', border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}` }}>
                {form.logoData
                  ? <img src={form.logoData} alt="Logo" className="w-full h-full object-contain p-1" />
                  : <Building2 className="w-10 h-10" style={{ color: tc.m, opacity: 0.4 }} />
                }
              </div>
              <div className="flex-1 space-y-2">
                <button type="button" onClick={() => logoRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}>
                  <Upload className="w-4 h-4" /> Subir imagen
                </button>
                {form.logoData && (
                  <button type="button" onClick={() => set('logoData', '')}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                    <X className="w-3 h-3" /> Quitar logo
                  </button>
                )}
                <p className="text-[11px]" style={{ color: tc.m }}>PNG, JPG o SVG. Máximo 2 MB.</p>
              </div>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          {/* Colores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label>Color primario</Label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input type="color" value={form.primaryColor}
                    onChange={e => set('primaryColor', e.target.value)}
                    className="w-12 h-10 rounded-lg border-0 cursor-pointer p-0.5"
                    style={{ background: 'transparent' }} />
                </div>
                <input className={`${FIELD} flex-1 font-mono uppercase`}
                  value={form.primaryColor}
                  onChange={e => set('primaryColor', e.target.value)}
                  placeholder="#6366f1" maxLength={7} />
              </div>
            </div>
            <div>
              <Label>Color secundario</Label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input type="color" value={form.secondaryColor}
                    onChange={e => set('secondaryColor', e.target.value)}
                    className="w-12 h-10 rounded-lg border-0 cursor-pointer p-0.5"
                    style={{ background: 'transparent' }} />
                </div>
                <input className={`${FIELD} flex-1 font-mono uppercase`}
                  value={form.secondaryColor}
                  onChange={e => set('secondaryColor', e.target.value)}
                  placeholder="#0ea5e9" maxLength={7} />
              </div>
            </div>
          </div>

          {/* Preview de colores */}
          <div className="rounded-xl p-4 space-y-2"
            style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: tc.m }}>Vista previa</p>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 rounded-lg text-white text-xs font-bold"
                style={{ background: form.primaryColor }}>{form.name || 'Botón primario'}</button>
              <button className="px-4 py-2 rounded-lg text-white text-xs font-bold"
                style={{ background: form.secondaryColor }}>Secundario</button>
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full" style={{ background: form.primaryColor }} />
                <span className="w-5 h-5 rounded-full" style={{ background: form.secondaryColor }} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Tab SMTP ─────────────────────────────────────────────────── */}
      {tab === 'smtp' && (
        <motion.div key="smtp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-4">

          {/* Tarjeta de referencia smtp2go */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: isLight ? 'rgba(96,165,250,0.06)' : 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.22)' }}>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#60a5fa' }}>
                Datos del servidor SMTP2GO
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Servidor',       value: 'mail.smtp2go.com' },
                { label: 'Puerto recom.',  value: '2525' },
                { label: 'Alt. / TLS',     value: '8025 · 587 · 80 · 25' },
                { label: 'SSL',            value: '465 · 8465 · 443' },
              ].map(item => (
                <div key={item.label} className="rounded-xl px-3 py-2"
                  style={{ background: isLight ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.07)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: tc.m }}>{item.label}</p>
                  <p className="text-xs font-mono font-bold" style={{ color: '#60a5fa' }}>{item.value}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px]" style={{ color: tc.m }}>
              Usa el puerto <strong>2525</strong> (TLS/STARTTLS) o <strong>465</strong> (SSL) según tu preferencia.
              El usuario SMTP y el email remitente son <strong>notificaciones@si-rubi.com</strong>.
            </p>
          </div>

          <div className="rounded-2xl p-5 space-y-4" style={glass}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label>Servidor SMTP</Label>
                <input className={FIELD} value={form.smtpHost} onChange={e => set('smtpHost', e.target.value)} placeholder="mail.smtp2go.com" />
              </div>
              <div>
                <Label>Puerto</Label>
                <input className={FIELD} type="number" value={form.smtpPort}
                  onChange={e => set('smtpPort', e.target.value)}
                  placeholder="2525" min={1} max={65535} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Usuario SMTP</Label>
                <input className={FIELD} value={form.smtpUser} onChange={e => set('smtpUser', e.target.value)} placeholder="notificaciones@si-rubi.com" />
              </div>
              <div>
                <Label>Contraseña SMTP</Label>
                <div className="relative">
                  <input className={`${FIELD} pr-10`}
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.smtpPassword}
                    onChange={e => set('smtpPassword', e.target.value)}
                    placeholder="Dejar vacío para no cambiar" />
                  <button type="button" onClick={() => setShowPwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: tc.m }}>
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nombre del remitente</Label>
                <input className={FIELD} value={form.smtpFromName} onChange={e => set('smtpFromName', e.target.value)} placeholder="Sistemas Infotec" />
              </div>
              <div>
                <Label>Email del remitente</Label>
                <input className={FIELD} type="email" value={form.smtpFromEmail} onChange={e => set('smtpFromEmail', e.target.value)} placeholder="notificaciones@si-rubi.com" />
              </div>
            </div>

            <div>
              <Label>Firma del correo</Label>
              <textarea className={`${FIELD} resize-none`} rows={4}
                value={form.emailSignature}
                onChange={e => set('emailSignature', e.target.value)}
                placeholder="Firma que aparecerá al final de los correos enviados..." />
            </div>

            <div className="rounded-xl p-3 flex items-start gap-2.5"
              style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.18)' }}>
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs" style={{ color: tc.s }}>
                La contraseña se guarda de forma segura. Si dejas el campo vacío, la contraseña existente no se modificará.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Botón guardar */}
      {can('settings.editar') && (
        <div className="flex justify-end">
          <motion.button onClick={handleSave} disabled={saving}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50">
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Guardando...</>
              : <><Save className="w-4 h-4" /> Guardar cambios</>}
          </motion.button>
        </div>
      )}
    </div>
  );
}
