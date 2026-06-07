import { LucideIcon } from 'lucide-react';

interface StatPillProps {
  icon: LucideIcon;
  value: string | number;
  color?: 'warning' | 'primary' | 'destructive' | 'accent';
}

const colorClass: Record<NonNullable<StatPillProps['color']>, string> = {
  warning: 'text-warning',
  primary: 'text-primary',
  destructive: 'text-destructive',
  accent: 'text-accent',
};

const StatPill = ({ icon: Icon, value, color = 'primary' }: StatPillProps) => (
  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border-2 border-border font-display font-extrabold text-sm">
    <Icon size={16} className={colorClass[color]} fill="currentColor" />
    <span className="text-foreground tabular-nums">{value}</span>
  </div>
);

export default StatPill;