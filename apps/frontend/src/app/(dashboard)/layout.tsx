'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Toaster } from 'sonner';
import { usersApi } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated]     = useState(false);
  const [cmdOpen, setCmdOpen]       = useState(false);
  const { isAuthenticated, setPermissions } = useAuthStore();
  const { theme } = useTheme();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    usersApi.getMe().then((me: any) => {
      if (!me?.role?.permissions) { setPermissions([]); return; }
      try {
        const parsed = JSON.parse(me.role.permissions);
        setPermissions(Array.isArray(parsed) ? parsed : []);
      } catch { setPermissions([]); }
    }).catch(() => {});
  }, [hydrated, isAuthenticated, setPermissions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((p) => !p);
      }
    };
    const onCustom = () => setCmdOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('aura:command', onCustom);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('aura:command', onCustom);
    };
  }, []);

  if (!hydrated) return (
    <div style={{ minHeight: '100vh', background: '#020617' }} />
  );
  if (!isAuthenticated) return null;

  const isLight = theme === 'light';

  /* ─── Orb común ─── */
  const orb = {
    position: 'absolute' as const,
    borderRadius: '50%',
    pointerEvents: 'none' as const,
    zIndex: 0,
  };

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        background: isLight
          ? 'var(--bg-base)'
          : 'radial-gradient(ellipse at 80% 5%, #0d1d42 0%, #05091a 48%, #020510 100%)',
      }}
    >
      {/* Orbs — solo en dark mode */}
      {!isLight && (
        <>
          <div style={{ ...orb, top: '-18%',  right: '-8%',  width: 720, height: 720, background: 'radial-gradient(circle, rgba(37,99,235,0.58) 0%, transparent 60%)',   animation: 'orbFloat 16s ease-in-out infinite' }} />
          <div style={{ ...orb, bottom: '-22%', left: '-10%', width: 660, height: 660, background: 'radial-gradient(circle, rgba(79,70,229,0.48) 0%, transparent 60%)',   animation: 'orbFloat 20s ease-in-out infinite reverse' }} />
          <div style={{ ...orb, top: '25%',   left: '18%',   width: 520, height: 520, background: 'radial-gradient(circle, rgba(124,58,237,0.30) 0%, transparent 65%)',  animation: 'orbFloat 13s ease-in-out infinite' }} />
          <div style={{ ...orb, bottom: '12%', right: '18%', width: 360, height: 360, background: 'radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 65%)',   animation: 'orbFloat 17s ease-in-out infinite reverse' }} />
        </>
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((p) => !p)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 overflow-hidden relative z-10 min-h-0">
        <Header onMenuToggle={() => setMobileOpen((p) => !p)} />
        <main
          className="flex-1 overflow-y-auto p-3 md:p-6 min-h-0"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </main>

        {/* Footer status bar */}
        <div
          className="hidden md:flex items-center justify-between px-5 shrink-0"
          style={{
            height: 26,
            background: isLight ? 'rgba(255,255,255,0.35)' : 'rgba(2,6,23,0.70)',
            borderTop: `1px solid ${isLight ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.06)'}`,
            backdropFilter: 'blur(20px)',
          }}
        >
          <span className="text-[10px] font-mono tracking-widest" style={{ color: isLight ? 'rgba(15,23,42,0.55)' : 'var(--text-muted)' }}>
            AURA ERP · Sistemas Infotec
          </span>
          <span className="text-[10px] font-mono flex items-center gap-2" style={{ color: isLight ? 'rgba(15,23,42,0.55)' : 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ boxShadow: '0 0 4px #34d399' }} />
            Conectado
            <span className="opacity-40 ml-2">Ctrl+K Buscar</span>
          </span>
        </div>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <Toaster richColors position="top-right" />

      <style jsx global>{`
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(24px, -16px) scale(1.04); }
        }
      `}</style>
    </div>
  );
}
