import { Sun, Moon } from 'lucide-react';
import { useMode, toggleMode } from '@/lib/theme';

interface ThemeToggleProps {
  compact?: boolean;
}

const ThemeToggle = ({ compact = false }: ThemeToggleProps) => {
  const mode = useMode();
  const isDark = mode === 'dark';

  return (
    <button
      onClick={toggleMode}
      className={`${compact ? 'h-7 w-7 p-1.5' : 'p-2'} rounded-full glass text-primary hover:text-primary-foreground hover:gradient-primary transition-all duration-300 glow-primary`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={compact ? 15 : 18} /> : <Moon size={compact ? 15 : 18} />}
    </button>
  );
};

export default ThemeToggle;
