import { Palette } from 'lucide-react';
import { THEMES, setTheme, useTheme } from '@/lib/theme';

const ThemeToggle = () => {
  const theme = useTheme();
  const activeIndex = THEMES.findIndex((item) => item.id === theme);
  const active = THEMES[Math.max(0, activeIndex)] ?? THEMES[0];

  const cycleTheme = () => {
    const next = THEMES[(Math.max(0, activeIndex) + 1) % THEMES.length];
    setTheme(next.id);
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-full glass text-primary hover:text-primary-foreground hover:gradient-primary transition-all duration-300 glow-primary"
      aria-label={`Current theme: ${active.name}. Switch theme`}
      title={`Theme: ${active.name}`}
    >
      <Palette size={18} />
    </button>
  );
};

export default ThemeToggle;
