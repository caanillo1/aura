export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 30% 20%, rgba(59,130,246,0.12) 0%, transparent 50%), radial-gradient(ellipse at 75% 80%, rgba(139,92,246,0.1) 0%, transparent 50%), #020617',
      }}
    >
      {/* Cuadrícula sutil */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 w-full px-4 py-10">
        {children}
      </div>
    </div>
  );
}
