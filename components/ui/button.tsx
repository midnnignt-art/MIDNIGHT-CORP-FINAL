import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  fullWidth?: boolean;
  /** Fuerza el estado de carga (spinner + deshabilitado). */
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  loading = false,
  onClick,
  disabled,
  ...props
}) => {
  // Auto-loading: si el onClick devuelve una promesa, mostramos spinner y
  // deshabilitamos el botón hasta que resuelva. Esto evita el doble/triple
  // click en toda la app (la gente pensaba que "se quedó pensando").
  const [busy, setBusy] = React.useState(false);
  const mountedRef = React.useRef(true);
  React.useEffect(() => () => { mountedRef.current = false; }, []);

  const isBusy = loading || busy;
  const isDisabled = disabled || isBusy;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    const result = onClick?.(e) as unknown;
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setBusy(true);
      try {
        await result;
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    }
  };

  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-midnight-950 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.97]";

  const variants = {
    primary: "bg-white text-black hover:bg-gray-200 focus:ring-white",
    secondary: "bg-midnight-800 text-white border border-midnight-700 hover:border-gray-500 hover:bg-midnight-700 focus:ring-gray-500",
    outline: "border border-white/20 text-white hover:bg-white/10 focus:ring-white/50",
    ghost: "text-gray-400 hover:text-white hover:bg-white/5",
    danger: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
  };

  const sizes = {
    sm: "px-2 py-1 text-[10px] md:px-3 md:py-1.5 md:text-sm",
    md: "px-3 py-2 text-xs md:px-5 md:py-2.5 md:text-sm",
    lg: "px-4 py-2.5 text-sm md:px-6 md:py-3.5 md:text-base",
    icon: "h-8 w-8 p-1.5 md:h-10 md:w-10 md:p-2",
  };

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      onClick={onClick ? handleClick : undefined}
      disabled={isDisabled}
      aria-busy={isBusy}
      {...props}
    >
      {isBusy && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {children}
    </button>
  );
};
