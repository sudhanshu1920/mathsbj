import { Sun, Moon } from 'lucide-react';
import { useMode, toggleMode } from '@/lib/theme';

const ThemeToggle = () => {
  const mode = useMode();
  const isDark = mode === 'dark';

  return (
    <button
      onClick={toggleMode}
      className="p-2 rounded-full glass text-primary hover:text-primary-foreground hover:gradient-primary transition-all duration-300 glow-primary"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

export default ThemeToggle;
