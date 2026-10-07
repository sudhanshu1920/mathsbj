import { Monitor, Smartphone, Minus, Plus, Type } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const closeTimer = useRef<number | null>(null);

  const updatePos = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - r.right);
    setPos({ top: r.bottom + 10, right });
  }, []);

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
    closeTimer.current = window.setTimeout(() => setOverlayOpen(false), 5000);
  }, []);

  useEffect(() => {
    if (overlayOpen) scheduleAutoClose();
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [overlayOpen, scale, scheduleAutoClose]);

  useEffect(() => {
    if (!overlayOpen) return;
    updatePos();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverlayOpen(false);
    };
    const onOutside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOverlayOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    document.addEventListener('pointerdown', onOutside, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
      document.removeEventListener('pointerdown', onOutside, true);
    };
  }, [overlayOpen, updatePos]);

  const startLongPress = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    longPressed.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      updatePos();
      setOverlayOpen(true);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cancelLongPress();
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const handleClick = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    setDesktop((d) => !d);
  };

  const dec = () => { setScale((s) => clamp(s - STEP)); scheduleAutoClose(); };
  const inc = () => { setScale((s) => clamp(s + STEP)); scheduleAutoClose(); };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleClick}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onContextMenu={(e) => e.preventDefault()}
        className="h-7 w-7 rounded-full bg-secondary p-1.5 text-secondary-foreground hover:bg-accent transition-colors"
        aria-label="Toggle desktop mode (long press for text size)"
        title={desktop ? 'Switch to mobile layout (long press: text size)' : 'Switch to desktop layout (long press: text size)'}
      >
        {desktop ? <Smartphone size={15} /> : <Monitor size={15} />}
      </button>

      {createPortal(
        <AnimatePresence>
          {overlayOpen && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              style={{ position: 'fixed', top: pos.top, right: pos.right }}
              className="z-[9999] flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-popover px-3 py-2.5 shadow-2xl"
              onMouseEnter={() => closeTimer.current && window.clearTimeout(closeTimer.current)}
              onMouseLeave={scheduleAutoClose}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Type size={12} />
                Text size
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={dec}
                  disabled={scale <= MIN_SCALE}
                  className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Decrease text size"
                >
                  <Minus size={20} />
                </button>
                <span className="min-w-[3.5rem] text-center text-base font-bold text-popover-foreground tabular-nums">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={inc}
                  disabled={scale >= MAX_SCALE}
                  className="h-11 w-11 inline-flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Increase text size"
                >
                  <Plus size={20} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

export default DesktopModeToggle;
