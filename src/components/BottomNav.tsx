import { BookOpen, Target, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t-2 border-border safe-bottom shadow-[0_-6px_24px_-6px_hsl(var(--primary)/0.25)]">
      <div className="flex justify-around items-center h-18 max-w-lg mx-auto py-2">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const isBouncing = bouncingTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTap(tab.id)}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full"
            >
              <motion.div
                animate={isBouncing ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`relative flex items-center justify-center w-14 h-10 rounded-2xl border-2 ${
                  isActive
                    ? 'bg-primary/15 border-primary text-primary shadow-chunky'
                    : 'bg-transparent border-transparent text-muted-foreground'
                }`}
              >
                <tab.icon size={22} strokeWidth={2.5} />
              </motion.div>
              <span
                className={`text-[10px] font-display font-extrabold uppercase tracking-wider ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
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
