'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Users, Building2, ClipboardList, FolderKanban, TrendingUp } from 'lucide-react';
import { companyApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { CompanyStats } from '@/types';

interface CardDef {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;        // color acento (icono, número)
  glow: string;          // sombra de color del card
  borderColor: string;   // borde adicional de acento
}

const QUICK_LINKS = [
  { label: 'Ver clientes',     href: '/clientes',  icon: Building2,     accent: '#34d399' },
  { label: 'Ver proyectos',    href: '/proyectos', icon: FolderKanban,  accent: '#a78bfa' },
  { label: 'Órdenes servicio', href: '/ordenes',   icon: ClipboardList, accent: '#60a5fa' },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { theme } = useTheme();
  const [stats, setStats]   = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const isLight = theme === 'light';

  const canSeeStats = user?.role === 'admin' || user?.role === 'coordinator';

  useEffect(() => {
    if (!canSeeStats) { setLoading(false); return; }
    companyApi.getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [canSeeStats]);

  const cards: CardDef[] = stats ? [
    { label: 'Usuarios activos',    value: stats.users,          icon: Users,         accent: '#60a5fa', glow: 'rgba(96,165,250,0.18)',  borderColor: 'rgba(96,165,250,0.30)'  },
    { label: 'Clientes',            value: stats.clients,        icon: Building2,      accent: '#34d399', glow: 'rgba(52,211,153,0.16)',  borderColor: 'rgba(52,211,153,0.28)'  },
    { label: 'Órdenes de servicio', value: stats.serviceOrders,  icon: ClipboardList,  accent: '#a78bfa', glow: 'rgba(167,139,250,0.16)', borderColor: 'rgba(167,139,250,0.28)' },
    { label: 'Proyectos activos',   value: stats.activeProjects, icon: FolderKanban,   accent: '#fbbf24', glow: 'rgba(251,191,36,0.15)',  borderColor: 'rgba(251,191,36,0.28)'  },
  ] : [];

  // Estilos de cristal según tema
  const glassCard = (glow: string, borderColor: string) => ({
    background: isLight ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.80)' : borderColor}`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: isLight
      ? `0 8px 32px ${glow}, inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.3)`
      : `0 8px 32px ${glow}, inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.2)`,
  });

  const glassQuick = {
    background: isLight ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.10)'}`,
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: isLight
      ? '0 4px 16px rgba(80,120,200,0.10), inset 0 1px 0 rgba(255,255,255,0.92)'
      : '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Saludo */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Hola, {user?.firstName} 👋
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </motion.div>

      {/* Tarjetas estadísticas */}
      {canSeeStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl animate-pulse"
                  style={{ background: isLight ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.04)' }} />
              ))
            : cards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    whileHover={{ y: -3, scale: 1.01 }}
                    className="rounded-2xl p-5 cursor-default"
                    style={glassCard(card.glow, card.borderColor)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                          background: `${card.accent}22`,
                          border: `1px solid ${card.accent}40`,
                          boxShadow: `0 0 16px ${card.accent}18`,
                        }}>
                        <Icon style={{ color: card.accent, width: 26, height: 26 }} />
                      </div>
                      <TrendingUp className="w-4 h-4" style={{ color: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)' }} />
                    </div>
                    <p className="text-3xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
                      {card.value}
                    </p>
                    <p className="text-xs mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>{card.label}</p>
                  </motion.div>
                );
              })
          }
        </div>
      )}

      {/* Bienvenida para roles sin stats */}
      {!canSeeStats && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl p-8 text-center"
          style={glassCard('rgba(96,165,250,0.12)', 'rgba(255,255,255,0.10)')}
        >
          <FolderKanban className="w-12 h-12 mx-auto mb-4" style={{ color: '#60a5fa' }} />
          <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Bienvenido a AURA ERP</h3>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Usa el menú lateral para navegar a tus proyectos y actividades.
          </p>
        </motion.div>
      )}

      {/* Accesos rápidos */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Accesos rápidos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all"
                  style={glassQuick}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${item.accent}20`, border: `1px solid ${item.accent}30` }}>
                    <Icon style={{ color: item.accent, width: 16, height: 16 }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {item.label}
                  </span>
                </motion.div>
              </a>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
