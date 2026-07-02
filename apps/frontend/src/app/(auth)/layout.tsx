'use client';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';

// ── Partículas con glow neón — valores deterministas ─────────────────────
const PARTICLES_ALL = Array.from({ length: 35 }, (_, i) => ({
  id:       i,
  left:     (i * 19 + 7) % 97,
  size:     1.5 + (i % 4) * 0.7,
  duration: 9  + (i % 7) * 2.5,
  delay:    -(i * 0.85),
  color:    i % 5 === 0 ? 'cyan' : i % 3 === 2 ? 'violet' : 'blue',
  glow:     6  + (i % 3) * 6,
}));
// En móvil solo 6 partículas para no colapsar Safari iOS
const PARTICLES_MOBILE = PARTICLES_ALL.slice(0, 6);

const GLOW_COLORS = {
  blue:   { base: '#60a5fa', shadow: 'rgba(96,165,250,0.9)' },
  violet: { base: '#a78bfa', shadow: 'rgba(167,139,250,0.9)' },
  cyan:   { base: '#22d3ee', shadow: 'rgba(34,211,238,0.9)' },
};

// ── Estrellas fugaces ─────────────────────────────────────────────────────
const SHOOTING_STARS = [
  { id: 0, top: '12%', left: '65%', angle: 30,  len: 120, delay: 0,   repeatDelay: 7  },
  { id: 1, top: '28%', left: '20%', angle: 25,  len: 90,  delay: 3,   repeatDelay: 9  },
  { id: 2, top: '55%', left: '80%', angle: 35,  len: 140, delay: 6,   repeatDelay: 11 },
  { id: 3, top: '8%',  left: '42%', angle: 20,  len: 100, delay: 1.5, repeatDelay: 13 },
  { id: 4, top: '70%', left: '10%', angle: 40,  len: 80,  delay: 8,   repeatDelay: 10 },
];

// ── Estrellas fijas ───────────────────────────────────────────────────────
const STARS_ALL = Array.from({ length: 60 }, (_, i) => ({
  id:   i,
  top:  (i * 23 + 5)  % 98,
  left: (i * 31 + 13) % 98,
  size: i % 5 === 0 ? 2 : 1,
  dur:  2 + (i % 4),
  delay: (i * 0.3) % 3,
}));
const STARS_MOBILE = STARS_ALL.slice(0, 15);

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  // ── Mouse parallax (solo desktop) ──────────────────────────────────────
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springCfg = { stiffness: 40, damping: 18 };
  const mx = useSpring(rawX, springCfg);
  const my = useSpring(rawY, springCfg);

  const o1x = useTransform(mx, v =>  v *  1.0);
  const o1y = useTransform(my, v =>  v *  1.0);
  const o2x = useTransform(mx, v =>  v * -0.7);
  const o2y = useTransform(my, v =>  v * -0.7);
  const o3x = useTransform(mx, v =>  v *  0.4);
  const o3y = useTransform(my, v =>  v * -0.5);

  useEffect(() => {
    if (isMobile) return;
    const onMove = (e: MouseEvent) => {
      rawX.set((e.clientX / window.innerWidth  - 0.5) * 80);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 80);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [rawX, rawY, isMobile]);

  const PARTICLES = isMobile ? PARTICLES_MOBILE : PARTICLES_ALL;
  const STARS = isMobile ? STARS_MOBILE : STARS_ALL;

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center"
      style={{ background: '#020617' }}>

      {/* ── Aurora blob 1 — azul-violeta ──────────────────────── */}
      <motion.div className="absolute pointer-events-none"
        style={{
          width: isMobile ? 400 : 900, height: isMobile ? 400 : 900, top: '-25%', right: '-20%',
          background: 'radial-gradient(ellipse, rgba(59,130,246,0.55) 0%, rgba(139,92,246,0.3) 40%, transparent 70%)',
          filter: isMobile ? 'blur(40px)' : 'blur(90px)',
          x: isMobile ? 0 : o1x, y: isMobile ? 0 : o1y,
        }}
        animate={isMobile ? {} : {
          borderRadius: ['60% 40% 70% 30%/30% 60% 40% 70%','40% 60% 30% 70%/70% 30% 60% 40%','70% 30% 60% 40%/40% 70% 30% 60%','60% 40% 70% 30%/30% 60% 40% 70%'],
          scale: [1, 1.12, 0.92, 1.08, 1],
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Aurora blob 2 — violeta-cian ─────────────────────── */}
      <motion.div className="absolute pointer-events-none"
        style={{
          width: isMobile ? 350 : 750, height: isMobile ? 350 : 750, bottom: '-20%', left: '-15%',
          background: 'radial-gradient(ellipse, rgba(167,139,250,0.5) 0%, rgba(34,211,238,0.2) 50%, transparent 70%)',
          filter: isMobile ? 'blur(40px)' : 'blur(100px)',
          x: isMobile ? 0 : o2x, y: isMobile ? 0 : o2y,
        }}
        animate={isMobile ? {} : {
          borderRadius: ['40% 60% 30% 70%/60% 40% 70% 30%','70% 30% 60% 40%/30% 70% 40% 60%','30% 70% 40% 60%/70% 30% 60% 40%','40% 60% 30% 70%/60% 40% 70% 30%'],
          scale: [1, 0.9, 1.15, 0.95, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      {/* ── Aurora blob 3 y 4 — solo desktop ─────────────────── */}
      {!isMobile && (
        <>
          <motion.div className="absolute pointer-events-none"
            style={{
              width: 500, height: 500, top: '30%', left: '30%',
              background: 'radial-gradient(ellipse, rgba(34,211,238,0.3) 0%, rgba(59,130,246,0.2) 50%, transparent 70%)',
              filter: 'blur(70px)',
              x: o3x, y: o3y,
            }}
            animate={{
              scale: [1, 1.25, 0.85, 1.1, 1],
              borderRadius: ['50% 50% 50% 50%','60% 40% 55% 45%','40% 60% 45% 55%','50% 50% 50% 50%'],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
          />
          <motion.div className="absolute pointer-events-none"
            style={{
              width: 400, height: 400, top: '-10%', left: '5%',
              background: 'radial-gradient(ellipse, rgba(99,102,241,0.4) 0%, rgba(139,92,246,0.2) 50%, transparent 70%)',
              filter: 'blur(80px)',
            }}
            animate={{ scale: [1, 1.2, 0.9, 1], y: [0, 30, -20, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
        </>
      )}

      {/* ── Cuadrícula sutil ──────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* ── Estrellas fijas ───────────────────────────────────── */}
      {STARS.map(s => (
        <motion.div key={s.id} className="absolute rounded-full pointer-events-none"
          style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size, background: '#fff' }}
          animate={{ opacity: [0.1, 0.9, 0.1], scale: [1, 1.4, 1] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* ── Estrellas fugaces — solo desktop ─────────────────── */}
      {!isMobile && SHOOTING_STARS.map(ss => (
        <motion.div key={ss.id} className="absolute pointer-events-none"
          style={{
            top: ss.top, left: ss.left,
            width: ss.len, height: 1.5,
            background: 'linear-gradient(90deg, transparent, #60a5fa, #a78bfa, transparent)',
            boxShadow: '0 0 6px #60a5fa, 0 0 12px rgba(96,165,250,0.6)',
            rotate: ss.angle,
            borderRadius: 99,
          }}
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: [0, 1, 1, 0], x: [0, ss.len * 2] }}
          transition={{ duration: 0.9, delay: ss.delay, repeat: Infinity, repeatDelay: ss.repeatDelay, ease: 'easeOut' }}
        />
      ))}

      {/* ── Partículas con glow neón ──────────────────────────── */}
      {PARTICLES.map(p => {
        const c = GLOW_COLORS[p.color as keyof typeof GLOW_COLORS];
        return (
          <motion.div key={p.id} className="absolute rounded-full pointer-events-none"
            style={{
              left: `${p.left}%`,
              width: p.size, height: p.size,
              background: c.base,
              boxShadow: `0 0 ${p.glow}px ${c.shadow}, 0 0 ${p.glow * 2}px ${c.shadow}`,
            }}
            initial={{ y: '108vh', opacity: 0 }}
            animate={{ y: '-8vh', opacity: [0, 1, 1, 0] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear', times: [0, 0.08, 0.88, 1] }}
          />
        );
      })}

      {/* ── Scan line horizontal ──────────────────────────────── */}
      <motion.div className="absolute left-0 right-0 pointer-events-none"
        style={{ height: 1.5, background: 'linear-gradient(90deg,transparent 0%,rgba(96,165,250,0.6) 20%,rgba(167,139,250,0.8) 50%,rgba(34,211,238,0.6) 80%,transparent 100%)', boxShadow: '0 0 12px rgba(96,165,250,0.5)' }}
        animate={{ top: ['-2%', '102%'], opacity: [0, 0.8, 0.8, 0] }}
        transition={{ duration: 5, repeat: Infinity, repeatDelay: 4, ease: 'linear', times: [0, 0.05, 0.95, 1] }}
      />
      <motion.div className="absolute left-0 right-0 pointer-events-none"
        style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(167,139,250,0.7) 40%,rgba(96,165,250,0.7) 60%,transparent)', boxShadow: '0 0 8px rgba(167,139,250,0.5)' }}
        animate={{ top: ['-2%', '102%'], opacity: [0, 0.6, 0.6, 0] }}
        transition={{ duration: 7, repeat: Infinity, repeatDelay: 6, delay: 5, ease: 'linear', times: [0, 0.05, 0.95, 1] }}
      />

      {/* Contenido */}
      <div className="relative z-10 w-full px-4 py-10">
        {children}
      </div>
    </div>
  );
}
