'use client';
import { motion } from 'framer-motion';

interface AuraLogoProps {
  size?: number;
  showText?: boolean;
  animate?: boolean;
}

export function AuraLogo({ size = 64, showText = false, animate = true }: AuraLogoProps) {
  const Wrapper = animate ? motion.div : 'div';
  const wrapperProps = animate
    ? { whileHover: { scale: 1.05 }, transition: { type: 'spring', stiffness: 400 } }
    : {};

  return (
    <div className="flex flex-col items-center gap-3">
      <Wrapper {...(wrapperProps as any)}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradiente principal */}
            <linearGradient id="grad-main" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5dade2" />
              <stop offset="50%" stopColor="#2D5086" />
              <stop offset="100%" stopColor="#1E3A5F" />
            </linearGradient>
            {/* Gradiente brillante */}
            <linearGradient id="grad-shine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#85c1e9" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#5dade2" stopOpacity="0.2" />
            </linearGradient>
            {/* Sombra */}
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#1E3A5F" floodOpacity="0.6" />
            </filter>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Hexágono de fondo */}
          <path
            d="M32 4 L56 17.5 L56 46.5 L32 60 L8 46.5 L8 17.5 Z"
            fill="url(#grad-main)"
            filter="url(#shadow)"
          />

          {/* Borde brillante del hexágono */}
          <path
            d="M32 4 L56 17.5 L56 46.5 L32 60 L8 46.5 L8 17.5 Z"
            fill="none"
            stroke="url(#grad-shine)"
            strokeWidth="1"
          />

          {/* Letra A estilizada — trazo izquierdo */}
          <path
            d="M22 46 L32 18 L42 46"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#glow)"
          />

          {/* Barra horizontal de la A */}
          <line
            x1="25.5"
            y1="36"
            x2="38.5"
            y2="36"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Punto de brillo superior */}
          <circle cx="32" cy="10" r="2" fill="#85c1e9" opacity="0.7" />

          {/* Reflejos en esquinas */}
          <circle cx="56" cy="17.5" r="1.5" fill="#5dade2" opacity="0.5" />
          <circle cx="8" cy="17.5" r="1.5" fill="#5dade2" opacity="0.5" />
        </svg>
      </Wrapper>

      {showText && (
        <div className="text-center">
          <span className="text-2xl font-bold tracking-tight text-gradient">AURA</span>
        </div>
      )}
    </div>
  );
}
