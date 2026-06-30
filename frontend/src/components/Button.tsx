import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'grass' | 'turf' | 'ghost' | 'flare';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  grass:
    'bg-grass text-ink font-bold hover:bg-grass-deep active:translate-y-px shadow-grass',
  turf:
    'bg-turf-2 text-chalk border border-edge-2 hover:border-grass/60 active:translate-y-px',
  ghost: 'bg-transparent text-chalk-dim hover:text-chalk hover:bg-turf-2',
  flare:
    'bg-flare text-ink font-bold hover:brightness-110 active:translate-y-px shadow-flare',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-[12px] gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-[13px] gap-2',
  lg: 'h-14 px-5 text-base rounded-[15px] gap-2.5',
};

export function Button({
  variant = 'turf',
  size = 'md',
  leftIcon,
  fullWidth,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center select-none',
        'transition-[transform,background-color,border-color,filter] duration-150',
        'disabled:opacity-45 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {leftIcon}
      {children}
    </button>
  );
}
