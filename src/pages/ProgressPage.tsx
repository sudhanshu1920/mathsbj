import { useEffect, useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Trophy, Target, XCircle, Flame, Settings as SettingsIcon, ArrowLeft } from 'lucide-react';
import { getProgress, ProgressData } from '@/lib/progress';
import { getStreak, StreakState } from '@/lib/streak';
import ProgressAnalytics from '@/components/ProgressAnalytics';
import XPBar from '@/components/XPBar';
import SettingsPanel from '@/components/SettingsPanel';

const ProgressPage = () => {
  const [data, setData] = useState<ProgressData>(getProgress());
  const [streak, setStreak] = useState<StreakState>(() => getStreak());
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const refreshAll = () => {
      setData(getProgress());
      setStreak(getStreak());
    };
    refreshAll();
    window.addEventListener('streak-updated', refreshAll);
    window.addEventListener('analytics-updated', refreshAll);
    return () => {
      window.removeEventListener('streak-updated', refreshAll);
      window.removeEventListener('analytics-updated', refreshAll);
    };
  }, []);

  useEffect(() => {
    if (!showSettings) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSettings(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [showSettings]);

  const accuracy = data.totalAttempts > 0 ? Math.round((data.correct / data.totalAttempts) * 100) : 0;

  const stats = [
    { label: 'Total', value: data.totalAttempts, icon: Target, color: 'text-primary' },
    { label: 'Correct', value: data.correct, icon: Trophy, color: 'text-success' },
    { label: 'Wrong', value: data.wrong, icon: XCircle, color: 'text-destructive' },
    { label: 'Streak', value: data.bestStreak, icon: Flame, color: 'text-warning' },
  ];

  const topicNames: Record<string, string> = {
    tables: 'Tables',
    squares: 'Squares',
    roots: 'Roots',
    cubes: 'Cubes',
    powers: 'Powers',
    percentage: 'Percentage',
  };

  return (
    <div>
      {/* Header */}
      <div className="app-top-header flex h-6 min-h-6 items-center justify-between mb-3 rounded-xl border border-border/50 px-2">
        <h1 className="font-display font-bold text-xl leading-none text-glow">Progress</h1>
        <div className="flex items-center gap-2">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full glass ${streak.current > 0 ? 'shadow-[0_0_18px_hsl(var(--warning)/0.45)] border-warning/40' : ''}`}
          >
            <motion.span
              animate={streak.current > 0 ? { scale: [1, 1.15, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className="inline-flex"
            >
              <Flame size={18} className={streak.current > 0 ? 'text-warning' : 'text-muted-foreground'} />
            </motion.span>
            <span className="font-display font-bold text-lg text-foreground">{streak.current}</span>
          </motion.div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ rotate: 35 }}
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            className="p-2 rounded-full glass text-muted-foreground hover:text-primary transition-colors"
          >
            <SettingsIcon size={18} />
          </motion.button>
        </div>
      </div>

      <div className="mb-6">
        <XPBar />
      </div>

      {/* Day / Week / Month analytics */}
      <ProgressAnalytics />

      {/* Accuracy ring */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        className="flex justify-center mb-8"
      >
        <div className="relative w-40 h-40 rounded-full overflow-visible">
          <div className="absolute inset-2 rounded-full blur-2xl" style={{borderRadius:'50%', background:'radial-gradient(circle, hsl(var(--primary)/0.15), transparent 70%)'}} />
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 relative drop-shadow-none">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(var(--ring-from, var(--primary)))" />
                <stop offset="100%" stopColor="hsl(var(--ring-to, var(--accent)))" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-secondary/60" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              stroke="url(#ringGrad)"
              strokeDasharray="264"
              initial={{ strokeDashoffset: 264 }}
              animate={{ strokeDashoffset: 264 - accuracy * 2.64 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display font-bold text-4xl text-foreground text-glow">{accuracy}%</span>
            <span className="text-xs text-muted-foreground">Accuracy</span>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-2xl p-4 text-center shadow-[0_0_18px_-6px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.4)] transition-shadow"
          >
            <s.icon size={20} className={`mx-auto mb-2 ${s.color}`} />
            <p className="font-display font-bold text-2xl text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* By topic */}
      {Object.keys(data.byTopic).length > 0 && (
        <div className="mb-8">
          <h3 className="font-display font-semibold text-lg mb-3 text-foreground">By Topic</h3>
          <div className="space-y-2">
            {Object.entries(data.byTopic).map(([key, val]) => {
              const topicAcc = val.attempts > 0 ? Math.round((val.correct / val.attempts) * 100) : 0;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass rounded-xl p-3 flex items-center justify-between"
                >
                  <span className="font-medium text-foreground">{topicNames[key] || key}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{val.attempts} Q</span>
                    <span className={`font-bold text-sm ${topicAcc >= 70 ? 'text-success' : 'text-warning'}`}>
                      {topicAcc}%
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full-screen settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            key="settings-fullscreen"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden"
          >
            <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-background/95 backdrop-blur">
              <button
                onClick={() => setShowSettings(false)}
                aria-label="Back"
                className="p-2 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="font-display font-bold text-lg text-foreground">Settings</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-4 py-5">
                <SettingsPanel />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProgressPage;
