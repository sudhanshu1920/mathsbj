import { BookOpen, Target, BarChart3 } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { useRef, useCallback, useState } from 'react';
import { playClick } from '@/lib/sound';

interface BottomNavProps {
  active: 'learn' | 'practice' | 'progress';
  onChange: (tab: 'learn' | 'practice' | 'progress') => void;
  onDoubleTap?: (tab: 'learn' | 'practice' | 'progress') => void;
}

const tabs = [
  { id: 'learn' as const, label: 'Learning', icon: BookOpen },
  { id: 'practice' as const, label: 'Quiz', icon: Target },
  { id: 'progress' as const, label: 'Progress', icon: BarChart3 },
];

const DOUBLE_TAP_DELAY = 280;

const BottomNav = ({ active, onChange, onDoubleTap }: BottomNavProps) => {
  const lastTapTime = useRef<Record<string, number>>({});
  const tapTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [bouncingTab, setBouncingTab] = useState<string | null>(null);

  const handleTap = useCallback((tabId: 'learn' | 'practice' | 'progress') => {
    const now = Date.now();
    const lastTap = lastTapTime.current[tabId] || 0;
    playClick();

    if (tapTimers.current[tabId]) {
      clearTimeout(tapTimers.current[tabId]);
    }

    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected
      lastTapTime.current[tabId] = 0;
      setBouncingTab(tabId);
      setTimeout(() => setBouncingTab(null), 300);
      
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
      
      onDoubleTap?.(tabId);
    } else {
      // Wait to see if it's a double tap
      lastTapTime.current[tabId] = now;
      tapTimers.current[tabId] = setTimeout(() => {
        onChange(tabId);
        lastTapTime.current[tabId] = 0;
      }, DOUBLE_TAP_DELAY);
    }
  }, [onChange, onDoubleTap]);

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-3xl border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-card/80"
    >
      <div className="flex h-[68px] w-full items-center justify-around gap-1 px-1">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const isBouncing = bouncingTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTap(tab.id)}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <motion.div
                animate={isBouncing ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`relative flex items-center justify-center w-14 h-10 rounded-2xl border ${
                  isActive
                    ? 'bg-primary/10 border-primary/60 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.45),0_0_18px_hsl(var(--primary)/0.45)]'
                    : 'bg-transparent border-transparent text-muted-foreground'
                }`}
              >
                <tab.icon size={22} strokeWidth={2.5} />
              </motion.div>
              <span
                className={`text-[10px] font-display font-extrabold uppercase tracking-wider ${
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
};

export default BottomNav;
