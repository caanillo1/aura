'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { AuraChat } from '@/components/ui/AuraChat';
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
  useEffect(() => { if (hydrated && !isAuthenticated) router.push('/login'); }, [hydrated, isAuthenticated, router]);
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(p => !p); }
    };
    const onCmd = () => setCmdOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('aura:command', onCmd);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('aura:command', onCmd); };
  }, []);

  if (!hydrated) return <div style={{ minHeight: '100vh', background: '#020617' }} />;
  if (!isAuthenticated) return null;

  const isLight = theme === 'light';

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        background: isLight
          ? '#F5F7FB'
          : 'linear-gradient(180deg, #020617 0%, #081120 50%, #020617 100%)',
      }}
    >
      {/* Ambient lights — dark mode only */}
      {!isLight && (
        <>
          <div className="absolute inset-0 pointer-events-none z-0" style={{
            background: 'radial-gradient(circle at 15% 20%, rgba(59,130,246,0.12) 0%, transparent 35%)',
          }} />
          <div className="absolute inset-0 pointer-events-none z-0" style={{
            background: 'radial-gradient(circle at 85% 80%, rgba(99,102,241,0.10) 0%, transparent 40%)',
          }} />
        </>
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(p => !p)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 overflow-hidden relative z-10 min-h-0">
        <Header onMenuToggle={() => setMobileOpen(p => !p)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0"
          style={{ WebkitOverflowScrolling: 'touch' }}>
          {children}
        </main>

        {/* Status bar */}
        <div className="hidden md:flex items-center justify-between px-5 shrink-0"
          style={{
            height: 26,
            background: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(2,6,23,0.85)',
            borderTop: `1px solid ${isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.04)'}`,
            backdropFilter: 'blur(12px)',
          }}>
          <span className="text-[10px] font-mono tracking-widest" style={{ color: 'var(--text-muted)' }}>
            AURA ERP · Sistemas Infotec
          </span>
          <span className="text-[10px] font-mono flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ boxShadow: '0 0 4px #34d399' }} />
            Conectado · <span className="opacity-50">Ctrl+K</span>
          </span>
        </div>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <AuraChat />
      <Toaster richColors position="top-right" />
    </div>
  );
}
