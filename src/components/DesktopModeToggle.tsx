import { Monitor, Smartphone, Minus, Plus, Type } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, m as motion } from 'framer-motion';

const MODE_KEY = 'desktop-mode';
const SCALE_KEY = 'font-scale';
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.5;
const STEP = 0.1;

const clamp = (n: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(n * 100) / 100));

const applyDesktopClass = (enabled: boolean) => {
  document.documentElement.classList.toggle('desktop-mode', enabled);
};

const applyFontScale = (scale: number) => {
  document.documentElement.style.setProperty('--font-scale', String(scale));
};

export const initDesktopMode = () => {
  applyDesktopClass(localStorage.getItem(MODE_KEY) === '1');
  const savedScale = parseFloat(localStorage.getItem(SCALE_KEY) || '1');
  applyFontScale(Number.isFinite(savedScale) ? clamp(savedScale) : 1);
};

const DesktopModeToggle = () => {
  const [desktop, setDesktop] = useState(() => localStorage.getItem(MODE_KEY) === '1');
  const [scale, setScale] = useState<number>(() => {
    const s = parseFloat(localStorage.getItem(SCALE_KEY) || '1');
    return Number.isFinite(s) ? clamp(s) : 1;
  });
  const [overlayOpen, setOverlayOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    applyDesktopClass(desktop);
    localStorage.setItem(MODE_KEY, desktop ? '1' : '0');
  }, [desktop]);

  useEffect(() => {
    applyFontScale(scale);
    localStorage.setItem(SCALE_KEY, String(scale));
  }, [scale]);

  const scheduleAutoClose = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOverlayOpen(false), 3000);
  }, []);

  useEffect(() => {
    if (overlayOpen) scheduleAutoClose();
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [overlayOpen, scale, scheduleAutoClose]);

  const startLongPress = () => {
    longPressed.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setOverlayOpen(true);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    setDesktop((d) => !d);
  };

  const dec = () => setScale((s) => clamp(s - STEP));
  const inc = () => setScale((s) => clamp(s + STEP));

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
        onContextMenu={(e) => e.preventDefault()}
        className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
        aria-label="Toggle desktop mode (long press for text size)"
        title={desktop ? 'Switch to mobile layout (long press: text size)' : 'Switch to desktop layout (long press: text size)'}
      >
        {desktop ? <Smartphone size={18} /> : <Monitor size={18} />}
      </button>

      <AnimatePresence>
        {overlayOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full mt-2 z-50 flex items-center gap-2 rounded-full border border-border bg-popover/95 backdrop-blur px-2 py-1.5 shadow-lg"
            onMouseEnter={() => closeTimer.current && window.clearTimeout(closeTimer.current)}
            onMouseLeave={scheduleAutoClose}
          >
            <button
              onClick={dec}
              disabled={scale <= MIN_SCALE}
              className="p-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Decrease text size"
            >
              <Minus size={14} />
            </button>
            <div className="flex items-center gap-1 px-1 text-xs font-medium text-popover-foreground tabular-nums">
              <Type size={12} />
              {Math.round(scale * 100)}%
            </div>
            <button
              onClick={inc}
              disabled={scale >= MAX_SCALE}
              className="p-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Increase text size"
            >
              <Plus size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DesktopModeToggle;
