import { LucideIcon } from 'lucide-react';

interface StatPillProps {
  icon: LucideIcon;
  value: string | number;
  color?: 'warning' | 'primary' | 'destructive' | 'accent';
  compact?: boolean;
}

const colorClass: Record<NonNullable<StatPillProps['color']>, string> = {
  warning: 'text-warning',
  primary: 'text-primary',
  destructive: 'text-destructive',
  accent: 'text-accent',
};

const StatPill = ({ icon: Icon, value, color = 'primary', compact = false }: StatPillProps) => (
  <div className={`flex items-center gap-1 rounded-full bg-card border font-display font-extrabold ${compact ? 'px-2 py-0.5 border' : 'gap-1.5 px-3 py-1.5 border-2 text-sm'}`}>
    <Icon size={compact ? 13 : 16} className={colorClass[color]} fill="currentColor" />
    <span className={`${compact ? 'text-[11px]' : 'text-foreground'} text-foreground tabular-nums`}>{value}</span>
  </div>
);

export default StatPill;