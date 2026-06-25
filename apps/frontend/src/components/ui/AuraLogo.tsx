'use client';

interface AuraLogoProps {
  size?: number;
  showText?: boolean;
  animate?: boolean;
}

export function AuraLogo({ size = 64, showText = false }: AuraLogoProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div>
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="grad-main" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5dade2" />
              <stop offset="50%" stopColor="#2D5086" />
              <stop offset="100%" stopColor="#1E3A5F" />
            </linearGradient>
            <linearGradient id="grad-shine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#85c1e9" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#5dade2" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Hexágono de fondo */}
          <path
            d="M32 4 L56 17.5 L56 46.5 L32 60 L8 46.5 L8 17.5 Z"
            fill="url(#grad-main)"
          />

          {/* Borde brillante */}
          <path
            d="M32 4 L56 17.5 L56 46.5 L32 60 L8 46.5 L8 17.5 Z"
            fill="none"
            stroke="url(#grad-shine)"
            strokeWidth="1"
          />

          {/* Letra A */}
          <path
            d="M22 46 L32 18 L42 46"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Barra horizontal */}
          <line x1="25.5" y1="36" x2="38.5" y2="36" stroke="white" strokeWidth="3" strokeLinecap="round" />

          {/* Detalles */}
          <circle cx="32" cy="10" r="2" fill="#85c1e9" opacity="0.7" />
          <circle cx="56" cy="17.5" r="1.5" fill="#5dade2" opacity="0.5" />
          <circle cx="8" cy="17.5" r="1.5" fill="#5dade2" opacity="0.5" />
        </svg>
      </div>

      {showText && (
        <div className="text-center">
          <span className="text-2xl font-bold tracking-tight text-gradient">AURA</span>
        </div>
      )}
    </div>
  );
}
