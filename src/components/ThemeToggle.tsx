import { Sun, Moon, Check } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { m as motion, AnimatePresence } from 'framer-motion';
import { THEMES, useMode, useTheme, toggleMode, setTheme, type ThemeId } from '@/lib/theme';

interface ThemeToggleProps {
  compact?: boolean;
}

const LONG_PRESS_MS = 500;
const PANEL_GAP = 8;

const ThemeToggle = ({ compact = false }: ThemeToggleProps) => {
  const mode = useMode();
  const theme = useTheme();
  const isDark = mode === 'dark';

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 8 });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const buttonSize = compact ? 28 : 28;

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const panelWidth = Math.min(280, window.innerWidth - 16);
    const preferredRight = window.innerWidth - rect.right;
    const right = Math.max(8, Math.min(preferredRight, window.innerWidth - panelWidth - 8));

    setPosition({
      top: rect.bottom + PANEL_GAP,
      right,
    });
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;

    updatePosition();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPaletteOpen(false);
    };

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setPaletteOpen(false);
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsidePointer, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsidePointer, true);
    };
  }, [paletteOpen, updatePosition]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const cancelHold = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    longPressedRef.current = false;
    cancelHold();

    holdTimerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      updatePosition();
      setPaletteOpen(true);
    }, LONG_PRESS_MS);
  };

  const handleClick = () => {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    toggleMode();
  };

  const chooseTheme = (id: ThemeId) => {
    setTheme(id);
    setPaletteOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
        onContextMenu={(event) => event.preventDefault()}
        onClick={handleClick}
        className="h-7 w-7 rounded-full glass p-1.5 text-primary hover:text-primary-foreground hover:gradient-primary transition-all duration-300 glow-primary"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-expanded={paletteOpen}
        aria-haspopup="dialog"
        title={isDark ? 'Light mode • Hold for themes' : 'Dark mode • Hold for themes'}
      >
        {isDark ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {createPortal(
        <AnimatePresence>
          {paletteOpen && (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-label="Theme selector"
              initial={{ opacity: 0, y: -5, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.97 }}
              transition={{ duration: 0.16 }}
              style={{ position: 'fixed', top: position.top, right: position.right }}
              className="z-[9999] w-[min(280px,calc(100vw-1rem))] rounded-2xl border border-border/80 bg-popover/95 p-2.5 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground">Themes</p>
                  <p className="text-[9px] text-muted-foreground">Choose a colour style</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">
                  {THEMES.find((item) => item.id === theme)?.name ?? 'Theme'}
                </span>
              </div>

              <div
                className="grid h-[156px] auto-cols-[60px] grid-flow-col grid-rows-3 gap-1.5 overflow-x-auto overscroll-contain pr-1 scrollbar-thin"
                aria-label="Available themes"
              >
                {THEMES.map((item) => {
                  const selected = item.id === theme;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseTheme(item.id)}
                      aria-label={'Use ' + item.name + ' theme'}
                      aria-pressed={selected}
                      title={item.tagline}
                      className="group relative flex h-[48px] w-[60px] flex-col items-center justify-center gap-1 rounded-xl border border-border/70 bg-background/55 px-1 py-1 transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <span aria-hidden="true" className="relative h-5 w-8 overflow-hidden rounded-full border border-border/60 shadow-sm">
                        <span className="absolute inset-0" style={{ background: item.swatch[0] }} />
                        <span className="absolute inset-y-0 left-0 w-1/2" style={{ background: item.swatch[1], clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0 100%)' }} />
                        <span className="absolute inset-y-0 right-0 w-1/2" style={{ background: item.swatch[2], clipPath: 'polygon(30% 0, 100% 0, 100% 100%, 0 100%)' }} />
                      </span>
                      <span className="w-full truncate text-[8px] font-bold leading-none text-foreground">
                        {item.name}
                      </span>
                      {selected && (
                        <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check size={9} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

export default ThemeToggle;