import React, { useId } from 'react';
import { APP_CONFIG, type AppTheme } from '../config/tradingConfig';

interface LotFastLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showWordmark?: boolean;
  theme?: AppTheme;
  className?: string;
}

const THEME_PALETTE: Record<
  AppTheme,
  {
    primaryTop: string;
    primaryBot: string;
    ringStart: string;
    ringMid: string;
    ringEnd: string;
    glow: string;
    wordmarkGradient: string;
  }
> = {
  'obsidian-jade': {
    primaryTop: '#4DF7B8',
    primaryBot: '#05B879',
    ringStart: '#10E89B',
    ringMid: '#38BDF8',
    ringEnd: '#F5B841',
    glow: '#10E89B',
    wordmarkGradient: 'from-emerald-300 via-teal-200 to-amber-200',
  },
  'royal-gold': {
    primaryTop: '#FDE68A',
    primaryBot: '#D97706',
    ringStart: '#F5B841',
    ringMid: '#FBBF24',
    ringEnd: '#FB923C',
    glow: '#F5B841',
    wordmarkGradient: 'from-amber-200 via-yellow-300 to-orange-300',
  },
  'arctic-slate': {
    primaryTop: '#7DD3FC',
    primaryBot: '#0284C7',
    ringStart: '#38BDF8',
    ringMid: '#818CF8',
    ringEnd: '#34D399',
    glow: '#38BDF8',
    wordmarkGradient: 'from-sky-300 via-cyan-200 to-indigo-300',
  },
};

export const LotFastLogo: React.FC<LotFastLogoProps> = ({
  size = 'sm',
  showIcon = true,
  showWordmark = true,
  theme = 'obsidian-jade',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const p = THEME_PALETTE[theme] ?? THEME_PALETTE['obsidian-jade'];

  const iconSizeClass =
    size === 'lg'
      ? 'h-16 w-16'
      : size === 'md'
        ? 'h-9 w-9'
        : 'h-7 w-7 lg:h-8 lg:w-8';

  const wordmarkClass =
    size === 'lg'
      ? 'text-2xl'
      : size === 'md'
        ? 'text-lg'
        : 'text-[17px] lg:text-[19px]';

  return (
    <span className={`inline-flex shrink-0 items-center gap-2 ${className}`}>
      {showIcon && (
      <svg
        viewBox="0 0 512 512"
        fill="none"
        aria-hidden="true"
        className={`${iconSizeClass} shrink-0 drop-shadow-[0_4px_14px_rgba(0,0,0,0.45)]`}
      >
        <defs>
          <linearGradient
            id={`lf-bg-${uid}`}
            x1="24"
            y1="16"
            x2="488"
            y2="496"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#162238" />
            <stop offset="55%" stopColor="#0B111E" />
            <stop offset="100%" stopColor="#060911" />
          </linearGradient>
          <linearGradient
            id={`lf-ring-${uid}`}
            x1="48"
            y1="48"
            x2="464"
            y2="464"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={p.ringStart} stopOpacity="0.82" />
            <stop offset="52%" stopColor={p.ringMid} stopOpacity="0.4" />
            <stop offset="100%" stopColor={p.ringEnd} stopOpacity="0.78" />
          </linearGradient>
          <linearGradient
            id={`lf-bar-${uid}`}
            x1="270"
            y1="118"
            x2="368"
            y2="394"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={p.primaryTop} />
            <stop offset="100%" stopColor={p.primaryBot} />
          </linearGradient>
          <linearGradient
            id={`lf-apex-${uid}`}
            x1="140"
            y1="220"
            x2="392"
            y2="120"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <radialGradient id={`lf-glow-${uid}`} cx="50%" cy="18%" r="55%">
            <stop offset="0%" stopColor={p.glow} stopOpacity="0.24" />
            <stop offset="100%" stopColor={p.glow} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="512" height="512" rx="116" fill={`url(#lf-bg-${uid})`} />
        <rect width="512" height="512" rx="116" fill={`url(#lf-glow-${uid})`} />
        <rect
          x="32"
          y="32"
          width="448"
          height="448"
          rx="90"
          stroke={`url(#lf-ring-${uid})`}
          strokeWidth="8"
        />

        {/* Subtle Precision Crosshairs */}
        <path
          d="M104 256H408M256 104V408"
          stroke="#FFFFFF"
          strokeOpacity="0.06"
          strokeWidth="4"
        />

        {/* 1st-Order Platinum L-Pillar */}
        <rect x="128" y="246" width="54" height="128" rx="16" fill="#E2E8F0" />
        <rect x="128" y="330" width="136" height="44" rx="16" fill="#E2E8F0" />

        {/* 2nd-Order Scaled Execution Candlestick Pillar */}
        <rect
          x="292"
          y="150"
          width="66"
          height="224"
          rx="18"
          fill={`url(#lf-bar-${uid})`}
        />
        <rect x="319" y="108" width="12" height="46" rx="6" fill={p.primaryTop} />
        <rect x="319" y="370" width="12" height="34" rx="6" fill={p.primaryBot} />

        {/* Velocity Apex Trajectory Arrow */}
        <path
          d="M142 214L244 166L284 196L378 118"
          stroke={`url(#lf-apex-${uid})`}
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M332 114H382V164"
          stroke={`url(#lf-apex-${uid})`}
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      )}

      {showWordmark && (
        <span
          className={`font-display whitespace-nowrap font-extrabold leading-none tracking-tight ${wordmarkClass}`}
        >
          <span className="text-slate-50">Lot</span>
          <span
            className={`bg-gradient-to-r bg-clip-text text-transparent ${p.wordmarkGradient}`}
          >
            Fast
          </span>
          <span className="sr-only">{APP_CONFIG.APP_NAME}</span>
        </span>
      )}
    </span>
  );
};
