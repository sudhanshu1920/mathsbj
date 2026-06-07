import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'accent' | 'warm' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ChunkyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-chunky',
  accent: 'bg-accent text-accent-foreground shadow-chunky-accent',
  warm: 'bg-warning text-warning-foreground shadow-chunky-warm',
  danger: 'bg-destructive text-destructive-foreground shadow-chunky-danger',
  ghost: 'bg-card text-foreground border-2 border-border shadow-chunky',
};

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm rounded-xl',
  md: 'px-5 py-3 text-base rounded-2xl',
  lg: 'px-6 py-4 text-lg rounded-2xl',
};

const ChunkyButton = forwardRef<HTMLButtonElement, ChunkyButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'press-chunky font-display font-extrabold uppercase tracking-wide inline-flex items-center justify-center gap-2 select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
ChunkyButton.displayName = 'ChunkyButton';
export default ChunkyButton;