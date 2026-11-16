import { Check } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { MOTION } from '@/lib/motion';
import { THEMES, setTheme, useTheme, type ThemeId } from '@/lib/theme';

type ThemeOptionsGridVariant = 'popup' | 'settings';

interface ThemeOptionsGridProps {
  variant: ThemeOptionsGridVariant;
  onSelect?: () => void;
}

const ThemeOptionsGrid = ({ variant, onSelect }: ThemeOptionsGridProps) => {
  const selectedTheme = useTheme();
  const compact = variant === 'popup';

  const handleSelect = (id: ThemeId) => {
    setTheme(id);
    onSelect?.();
  };

  return (
    <div
      role="group"
      aria-label={compact ? 'Available themes' : 'Available color themes'}
      data-theme-selector-grid={variant}
      className={compact
        ? 'mx-auto grid h-[156px] max-w-[200px] auto-cols-[60px] grid-flow-col grid-rows-3 gap-1.5 overflow-x-auto overscroll-contain pr-1 scrollbar-thin'
        : 'grid grid-cols-4 gap-1 min-[480px]:grid-cols-5 min-[768px]:grid-cols-6 min-[1024px]:grid-cols-7'}
    >
      {THEMES.map((item) => {
        const selected = item.id === selectedTheme;

        return (
          <motion.button
            key={item.id}
            data-theme-option={item.id}
            type="button"
            whileTap={{ scale: MOTION.scale.press }}
            onClick={() => handleSelect(item.id)}
            aria-label={`${compact ? 'Use' : 'Select'} ${item.name} theme`}
            aria-pressed={selected}
            title={item.tagline}
            className={compact
              ? 'group relative flex h-[48px] w-[60px] flex-col items-center justify-center gap-1 rounded-xl border border-border/70 bg-background/55 px-1 py-1 transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
              : `group relative flex h-10 min-w-0 w-full flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  selected
                    ? 'border-primary/60 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.10)]'
                    : 'border-border/70 bg-background/55 hover:border-primary/40 hover:bg-primary/[0.03]'
                }`}
          >
            <span
              data-theme-swatch
              aria-hidden="true"
              className={`relative shrink-0 overflow-hidden rounded-full border border-border/60 shadow-sm ${compact ? 'h-5 w-8' : 'h-3.5 w-6'}`}
            >
              <span className="absolute inset-0" style={{ background: item.swatch[0] }} />
              <span
                className="absolute inset-y-0 left-0 w-1/2"
                style={{
                  background: item.swatch[1],
                  clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0 100%)',
                }}
              />
              <span
                className="absolute inset-y-0 right-0 w-1/2"
                style={{
                  background: item.swatch[2],
                  clipPath: 'polygon(30% 0, 100% 0, 100% 100%, 0 100%)',
                }}
              />
            </span>
            <span className={`w-full truncate text-center font-bold leading-none text-foreground ${compact ? 'text-[8px]' : 'text-[8px]'}`}>
              {item.name}
            </span>
            {selected && (
              <span
                data-theme-selected-indicator
                aria-hidden="true"
                className={`absolute right-1 top-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground ${compact ? 'h-3.5 w-3.5' : 'h-3 w-3'}`}
              >
                <Check size={8} strokeWidth={3} />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

export default ThemeOptionsGrid;
