'use client';
import { motion } from 'framer-motion';

export function AuraText({ className = '' }: { className?: string }) {
  return (
    <div className={`relative inline-block overflow-hidden ${className}`}>
      {/* Texto base con gradiente */}
      <span
        className="text-3xl font-bold tracking-[0.18em] select-none"
        style={{
          background: 'linear-gradient(135deg, #85c1e9 0%, #5dade2 35%, #a78bfa 70%, #7c3aed 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        AURA
      </span>

      {/* Reflejo 1 — sweep rápido diagonal */}
      <motion.span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.85) 48%, rgba(255,255,255,0.4) 52%, transparent 70%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontSize: 'inherit',
          fontWeight: 'inherit',
          letterSpacing: 'inherit',
        }}
        animate={{ x: ['-160%', '160%'] }}
        transition={{
          duration: 0.9,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatDelay: 3.5,
        }}
      >
        AURA
      </motion.span>

      {/* Reflejo 2 — sweep suave más ancho, desplazado en tiempo */}
      <motion.span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.25) 55%, transparent 80%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontSize: 'inherit',
          fontWeight: 'inherit',
          letterSpacing: 'inherit',
        }}
        animate={{ x: ['-160%', '160%'] }}
        transition={{
          duration: 1.3,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatDelay: 3.5,
          delay: 0.15,
        }}
      >
        AURA
      </motion.span>
    </div>
  );
}
