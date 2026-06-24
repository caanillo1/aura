'use client';
import { motion } from 'framer-motion';

// Partículas deterministas (sin Math.random para evitar hydration mismatch)
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left:     (i * 17 + 11) % 97,
  size:     1.5 + (i % 3) * 0.8,
  duration: 12 + (i % 6) * 3,
  delay:    -(i * 1.4),
  opacity:  0.12 + (i % 4) * 0.08,
  isBlue:   i % 3 !== 2,
}));

// Hexágonos flotantes decorativos
const HEXAGONS = [
  { id: 0, size: 80,  top: '12%', left: '8%',  duration: 22, rotate: 360,  delay: 0,  opacity: 0.06 },
  { id: 1, size: 50,  top: '70%', left: '88%', duration: 28, rotate: -360, delay: 4,  opacity: 0.05 },
  { id: 2, size: 120, top: '45%', left: '75%', duration: 35, rotate: 180,  delay: 8,  opacity: 0.04 },
  { id: 3, size: 40,  top: '20%', left: '60%', duration: 18, rotate: -180, delay: 2,  opacity: 0.07 },
  { id: 4, size: 65,  top: '85%', left: '25%', duration: 25, rotate: 270,  delay: 12, opacity: 0.05 },
];

// Hexágono SVG
function Hexagon({ size, opacity }: { size: number; opacity: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.46;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <polygon points={pts}
        stroke="var(--accent-blue)"
        strokeWidth="1"
        fill="var(--accent-blue-bg)"
        opacity={opacity} />
    </svg>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* ── Orbs animados con movimiento x/y ───────────────────── */}
      <motion.div
        className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--accent-blue-bg) 0%, transparent 70%)' }}
        animate={{ x: [0, 40, -25, 30, 0], y: [0, -30, 40, -20, 0], scale: [1, 1.06, 0.95, 1.08, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />
      <motion.div
        className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--accent-violet-bg) 0%, transparent 70%)' }}
        animate={{ x: [0, -35, 25, -15, 0], y: [0, 30, -40, 25, 0], scale: [1, 1.09, 0.94, 1.06, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', times: [0, 0.3, 0.6, 0.8, 1], delay: 2 }}
      />
      <motion.div
        className="absolute top-[35%] left-[15%] w-[350px] h-[350px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--accent-blue-bg) 0%, transparent 70%)' }}
        animate={{ x: [0, 50, -20, 35, 0], y: [0, -25, 50, -30, 0], scale: [1, 1.12, 0.92, 1.05, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', times: [0, 0.3, 0.6, 0.85, 1], delay: 5 }}
      />

      {/* ── Cuadrícula pulsante ─────────────────────────────────── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Hexágonos flotantes ─────────────────────────────────── */}
      {HEXAGONS.map(h => (
        <motion.div
          key={h.id}
          className="absolute pointer-events-none"
          style={{ top: h.top, left: h.left }}
          animate={{ rotate: h.rotate, y: [0, -20, 0] }}
          transition={{ duration: h.duration, repeat: Infinity, ease: 'linear', delay: h.delay }}
        >
          <Hexagon size={h.size} opacity={h.opacity} />
        </motion.div>
      ))}

      {/* ── Partículas flotantes ────────────────────────────────── */}
      {PARTICLES.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${p.left}%`,
            width:  p.size,
            height: p.size,
            background: p.isBlue ? 'var(--accent-blue)' : 'var(--accent-violet)',
          }}
          initial={{ y: '110vh', opacity: 0 }}
          animate={{ y: '-10vh', opacity: [0, p.opacity, p.opacity, 0] }}
          transition={{
            duration: p.duration,
            delay:    p.delay,
            repeat:   Infinity,
            ease:     'linear',
            times:    [0, 0.1, 0.85, 1],
          }}
        />
      ))}

      {/* ── Destellos de borde (scan lines) ────────────────────── */}
      <motion.div
        className="absolute left-0 right-0 pointer-events-none"
        style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--accent-blue-bg), var(--accent-violet-bg), transparent)' }}
        animate={{ top: ['-2%', '102%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear', delay: 0 }}
      />
      <motion.div
        className="absolute left-0 right-0 pointer-events-none"
        style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--accent-violet-bg), var(--accent-blue-bg), transparent)' }}
        animate={{ top: ['-2%', '102%'] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear', delay: 5 }}
      />

      {/* Contenido */}
      <div className="relative z-10 w-full px-4 py-10">
        {children}
      </div>
    </div>
  );
}
