import { BookOpen, ListChecks, BarChart3 } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { forwardRef, useRef, useCallback, useEffect, useState } from 'react';
import { playClick } from '@/lib/sound';

interface BottomNavProps {
  active: 'learn' | 'practice' | 'progress';
  onChange: (tab: 'learn' | 'practice' | 'progress') => void;
  onDoubleTap?: (tab: 'learn' | 'practice' | 'progress') => void;
}

const tabs = [
  { id: 'learn' as const, label: 'Learning', icon: BookOpen },
  { id: 'practice' as const, label: 'Quiz', icon: ListChecks },
  { id: 'progress' as const, label: 'Progress', icon: BarChart3 },
];

const DOUBLE_TAP_DELAY = 280;

const BottomNav = forwardRef<HTMLElement, BottomNavProps>(({ active, onChange, onDoubleTap }, ref) => {
  const lastTapTime = useRef<Record<string, number>>({});
  const tapTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [bouncingTab, setBouncingTab] = useState<string | null>(null);
  const bounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      Object.values(tapTimers.current).forEach((timer) => clearTimeout(timer));
      if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
    };
  }, []);

  const handleTap = useCallback((tabId: 'learn' | 'practice' | 'progress') => {
    const now = Date.now();
    const lastTap = lastTapTime.current[tabId] || 0;
    playClick();

    if (tapTimers.current[tabId]) {
      clearTimeout(tapTimers.current[tabId]);
    }

    if (now - lastTap < DOUBLE_TAP_DELAY) {
      lastTapTime.current[tabId] = 0;
      setBouncingTab(tabId);
      if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
      bounceTimerRef.current = setTimeout(() => {
        bounceTimerRef.current = null;
        setBouncingTab(null);
      }, 220);
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
      onDoubleTap?.(tabId);
    } else {
      lastTapTime.current[tabId] = now;
      tapTimers.current[tabId] = setTimeout(() => {
        onChange(tabId);
        lastTapTime.current[tabId] = 0;
      }, DOUBLE_TAP_DELAY);
    }
  }, [onChange, onDoubleTap]);

  return (
    <nav
      ref={ref}
      aria-label="Primary navigation"
      className="bottom-nav fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-b-0 border-x-0 shadow-[0_-12px_32px_-12px_hsl(var(--primary)/0.35)]"
    >
      <div className="flex h-full max-w-lg mx-auto items-center justify-around px-1">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const isBouncing = bouncingTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTap(tab.id)}
              className={`bottom-nav-item-button relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[48px] py-1 ${isActive ? 'is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
            >
              <motion.div
                animate={isBouncing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className={`bottom-nav-item relative flex items-center justify-center w-12 h-7 rounded-xl border ${isActive
                  ? 'is-active'
                  : ''}`}
              >
                <tab.icon size={19} strokeWidth={2.5} />
              </motion.div>
              <span
                className={`text-[9px] leading-none font-display font-extrabold uppercase tracking-wider ${isActive ? 'text-primary neon-text' : 'text-muted-foreground'}`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

BottomNav.displayName = 'BottomNav';

export default BottomNav;
