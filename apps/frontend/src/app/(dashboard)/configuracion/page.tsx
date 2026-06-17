'use client';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { ShieldCheck, Building2, Settings2, MapPin, MessageCircle, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const OPCIONES = [
  {
    href: '/configuracion/roles',
    icon: ShieldCheck,
    title: 'Permisos de Roles',
    desc: 'Define qué puede hacer cada rol: ver, crear, editar, aprobar.',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.12)',
  },
  {
    href: '/configuracion/empresa',
    icon: Building2,
    title: 'Datos de la Empresa',
    desc: 'Nombre, NIT, logo, colores corporativos, SMTP de correos.',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.12)',
  },
  {
    href: '/configuracion/parametros',
    icon: Settings2,
    title: 'Parámetros del Sistema',
    desc: 'Configuraciones generales, rutas de archivos, límites.',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
  },
  {
    href: '/configuracion/municipios',
    icon: MapPin,
    title: 'Municipios',
    desc: 'Gestiona los municipios disponibles para asignar ubicación geográfica a clientes.',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.12)',
  },
  {
    href: '/configuracion/whatsapp',
    icon: MessageCircle,
    title: 'WhatsApp',
    desc: 'Conecta tu número de WhatsApp para enviar notificaciones automáticas a firmantes.',
    color: '#25d366',
    bg: 'rgba(37,211,102,0.12)',
  },
];

export default function ConfiguracionPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const glass = {
    background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.11)'}`,
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: isLight
      ? '0 6px 24px rgba(30,60,120,0.13), inset 0 1px 0 rgba(255,255,255,0.97)'
      : '0 6px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.09)',
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>Configuración</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Administra los parámetros del sistema.
        </p>
      </div>

      <div className="space-y-3">
        {OPCIONES.map((op, i) => {
          const Icon = op.icon;
          const content = (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -2 }}
              className="flex items-center gap-5 p-5 rounded-2xl cursor-pointer group transition-all"
              style={glass}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: op.bg, border: `1px solid ${op.color}30` }}>
                <Icon className="w-6 h-6" style={{ color: op.color }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{op.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{op.desc}</p>
              </div>
              <ChevronRight className="w-5 h-5 transition-colors" style={{ color: 'var(--text-muted)' }} />
            </motion.div>
          );

          return <Link key={op.title} href={op.href}>{content}</Link>;
        })}
      </div>
    </div>
  );
}
