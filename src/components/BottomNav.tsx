import { BookOpen, ListChecks, BarChart3 } from 'lucide-react';
import { forwardRef, memo, useCallback, useRef } from 'react';
import { playClick } from '@/lib/sound';

interface BottomNavProps {
  active: 'learn' | 'practice' | 'progress';
  hidden?: boolean;
  onChange: (tab: 'learn' | 'practice' | 'progress') => void;
  onDoubleTap?: (tab: 'learn' | 'practice' | 'progress') => void;
}

const tabs = [
  { id: 'learn' as const, label: 'Learning', icon: BookOpen },
  { id: 'practice' as const, label: 'Quiz', icon: ListChecks },
  { id: 'progress' as const, label: 'Progress', icon: BarChart3 },
];

const DOUBLE_TAP_DELAY = 280;

const BottomNavBase = forwardRef<HTMLElement, BottomNavProps>(({ active, hidden = false, onChange, onDoubleTap }, ref) => {
  const lastTapTime = useRef<Record<string, number>>({});

  const handleTap = useCallback((tabId: 'learn' | 'practice' | 'progress') => {
    const now = Date.now();
    const lastTap = lastTapTime.current[tabId] || 0;
    const isDoubleTap = now - lastTap < DOUBLE_TAP_DELAY;

    // First tap navigates immediately. Double-tap detection is independent of
    // navigation so the old 280ms deferral no longer adds tap latency.
    if (isDoubleTap) {
      lastTapTime.current[tabId] = 0;
      onDoubleTap?.(tabId);
      if (navigator.vibrate) navigator.vibrate(10);
    } else {
      lastTapTime.current[tabId] = now;
      onChange(tabId);
    }

    // Non-critical feedback stays after the navigation request.
    playClick();
  }, [onChange, onDoubleTap]);

  return (
    <nav
      ref={ref}
      data-app-floating-nav="true"
      aria-label="Primary navigation"
      aria-hidden={hidden || undefined}
      hidden={hidden}
      style={hidden ? { display: "none" } : undefined}
      className="bottom-nav fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-b-0 border-x-0"
    >
      <div className="flex h-full max-w-lg mx-auto items-center justify-around px-1">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTap(tab.id)}
              className={`motion-press bottom-nav-item-button relative flex flex-1 h-full min-h-[48px] flex-col items-center justify-center gap-0.5 py-1 ${
                isActive ? 'is-active' : ''
              }`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
            >
              <div
                className={`bottom-nav-item relative flex h-7 w-12 items-center justify-center rounded-xl border ${
                  isActive ? 'is-active' : ''
                }`}
              >
                <tab.icon size={19} strokeWidth={2.5} />
              </div>
              <span
                className={`text-[9px] leading-none font-display font-extrabold uppercase tracking-wider ${
                  isActive ? 'text-primary neon-text' : 'text-muted-foreground'
                }`}
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

BottomNavBase.displayName = 'BottomNav';

const BottomNav = memo(BottomNavBase);
BottomNav.displayName = 'BottomNav';

export default BottomNav;