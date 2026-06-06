'use client';
import { motion } from 'framer-motion';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">

      {/* Fondo con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#050d1a] via-[#0d1b2e] to-[#0a0f1e]" />

      {/* Orbs decorativos */}
      <motion.div
        className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(45,80,134,0.25) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.6, 0.8, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(30,58,95,0.3) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.7, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute top-[40%] left-[20%] w-[300px] h-[300px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(93,173,226,0.08) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      {/* Grid sutil */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Contenido */}
      <div className="relative z-10 w-full px-4">
        {children}
      </div>
    </div>
  );
}
