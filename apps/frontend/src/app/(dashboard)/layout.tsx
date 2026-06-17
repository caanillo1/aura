'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Toaster } from 'sonner';
import { usersApi } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { isAuthenticated, setPermissions } = useAuthStore();
  const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/login');
  }, [hydrated, isAuthenticated, router]);

  // Refresca permisos desde el servidor en cada carga del dashboard
  // así los cambios de roles toman efecto sin necesidad de re-login
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

  // Mientras el store rehidrata desde localStorage, mostrar fondo oscuro sin redirigir
  if (!hydrated) return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at top right, #0f1f3d 0%, #060d1c 50%, #050810 100%)' }} />
  );
  if (!isAuthenticated) return null;

  const isLight = theme === 'light';

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        background: isLight
          ? 'linear-gradient(135deg, #4a7fc1 0%, #6b9fd8 25%, #8b7ac8 60%, #5a7ec0 100%)'
          : 'radial-gradient(ellipse at top right, #0f1f3d 0%, #060d1c 50%, #050810 100%)',
      }}
    >
      {/* Orbs glassmorphism — dan profundidad al blur en ambos modos */}
      {isLight ? (
        <>
          <div className="absolute pointer-events-none z-0" style={{ top: '-15%', right: '-8%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(70,140,230,0.38) 0%, transparent 65%)', animation: 'orbFloat 14s ease-in-out infinite' }} />
          <div className="absolute pointer-events-none z-0" style={{ bottom: '-20%', left: '-8%', width: 580, height: 580, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.28) 0%, transparent 65%)', animation: 'orbFloat 18s ease-in-out infinite reverse' }} />
          <div className="absolute pointer-events-none z-0" style={{ top: '35%', left: '30%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.20) 0%, transparent 65%)', animation: 'orbFloat 11s ease-in-out infinite' }} />
        </>
      ) : (
        <>
          <div className="absolute pointer-events-none z-0" style={{ top: '-20%', right: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,80,134,0.35) 0%, transparent 65%)', animation: 'orbFloat 16s ease-in-out infinite' }} />
          <div className="absolute pointer-events-none z-0" style={{ bottom: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,58,95,0.40) 0%, transparent 65%)', animation: 'orbFloat 20s ease-in-out infinite reverse' }} />
          <div className="absolute pointer-events-none z-0" style={{ top: '30%', left: '25%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(93,173,226,0.08) 0%, transparent 65%)', animation: 'orbFloat 12s ease-in-out infinite' }} />
        </>
      )}

      {/* Sidebar */}
      <div className="relative z-10 h-full">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((p) => !p)} />
      </div>

      {/* Contenido principal */}
      <div className="flex flex-col flex-1 overflow-hidden relative z-10">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

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
