import { Sun, Moon } from 'lucide-react';
import { useMode, toggleMode } from '@/lib/theme';

const ThemeToggle = () => {
  const mode = useMode();
  const isDark = mode === 'dark';

  return (
    <button
      onClick={toggleMode}
      className="h-7 w-7 rounded-full glass p-1.5 text-primary hover:text-primary-foreground hover:gradient-primary transition-all duration-300 glow-primary"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
};

export default ThemeToggle;
