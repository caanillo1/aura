'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from 'next-themes';

interface BackButtonProps {
  href: string;
  label: string;
}

export function BackButton({ href, label }: BackButtonProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <Link href={href}>
      <motion.div
        whileHover="hover"
        whileTap={{ scale: 0.97 }}
        className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl cursor-pointer select-none w-fit"
        style={{
          background: isLight ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.07)',
          border: `1px solid ${isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.12)'}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: isLight
            ? '0 2px 12px rgba(30,60,120,0.12), inset 0 1px 0 rgba(255,255,255,0.95)'
            : '0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {/* Flecha animada */}
        <motion.div
          variants={{ hover: { x: -4 } }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          <ArrowLeft
            className="w-4 h-4"
            style={{ color: isLight ? '#1d4ed8' : '#60a5fa' }}
          />
        </motion.div>

        <span
          className="text-sm font-medium"
          style={{ color: isLight ? '#1a3050' : '#94a3b8' }}
        >
          {label}
        </span>
      </motion.div>
    </Link>
  );
}
