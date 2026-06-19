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

  // Ctrl+K and custom event trigger
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

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        background: isLight
          ? 'var(--bg-base)'
          : 'radial-gradient(ellipse at top right, #0f1f3d 0%, #060d1c 50%, #050810 100%)',
      }}
    >
      {/* Dark mode depth orbs */}
      {!isLight && (
        <>
          <div className="absolute pointer-events-none z-0" style={{ top: '-20%', right: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,80,134,0.35) 0%, transparent 65%)', animation: 'orbFloat 16s ease-in-out infinite' }} />
          <div className="absolute pointer-events-none z-0" style={{ bottom: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,58,95,0.40) 0%, transparent 65%)', animation: 'orbFloat 20s ease-in-out infinite reverse' }} />
          <div className="absolute pointer-events-none z-0" style={{ top: '30%', left: '25%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(93,173,226,0.08) 0%, transparent 65%)', animation: 'orbFloat 12s ease-in-out infinite' }} />
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
            background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(2,6,23,0.90)',
            borderTop: `1px solid ${isLight ? 'rgba(15,23,42,0.07)' : 'rgba(255,255,255,0.05)'}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <span className="text-[10px] font-mono tracking-widest" style={{ color: 'var(--text-muted)' }}>
            AURA ERP · Sistemas Infotec
          </span>
          <span className="text-[10px] font-mono flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
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
          50%       { transform: translate(28px, -18px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
