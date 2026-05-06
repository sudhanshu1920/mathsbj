import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Target, XCircle, Flame, Settings as SettingsIcon } from 'lucide-react';
import { getProgress, ProgressData } from '@/lib/progress';
import { getStreak, StreakState } from '@/lib/streak';
import ProgressAnalytics from '@/components/ProgressAnalytics';
import XPBar from '@/components/XPBar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-display font-bold text-2xl text-glow">Progress</h1>
        <div className="flex items-center gap-2">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border"
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
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            className="p-2 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <SettingsIcon size={18} />
          </motion.button>
        </div>
      </div>

      <div className="mb-6">
        <XPBar />
      </div>

      {/* Daily Target Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-4 mb-6 relative overflow-hidden"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            Daily Target
            {todayPct >= 100 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 14 }}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success text-background"
              >
                <Check size={12} strokeWidth={3} />
              </motion.span>
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.floor(todaySecs / 60)}m / {streak.targetMinutes}m
          </span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full gradient-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${todayPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presetMinutes.map((m) => (
            <motion.button
              key={m}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSetTarget(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                streak.targetMinutes === m
                  ? 'gradient-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {m}m
            </motion.button>
          ))}
        </div>
        <AnimatePresence>
          {celebrate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
            >
              <Particles count={20} emoji="🎉" spread={140} duration={1.2} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Day / Week / Month analytics */}
      <ProgressAnalytics />

      {/* Accuracy ring */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        className="flex justify-center mb-8"
      >
        <div className="relative w-36 h-36">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-secondary" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="stroke-primary"
              strokeDasharray="264"
              initial={{ strokeDashoffset: 264 }}
              animate={{ strokeDashoffset: 264 - accuracy * 2.64 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display font-bold text-3xl text-foreground">{accuracy}%</span>
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
            className="bg-card border border-border rounded-2xl p-4 text-center"
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
                <div key={key} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                  <span className="font-medium text-foreground">{topicNames[key] || key}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{val.attempts} Q</span>
                    <span className={`font-bold text-sm ${topicAcc >= 70 ? 'text-success' : 'text-warning'}`}>
                      {topicAcc}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="rounded-2xl max-w-[340px]">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Sound</span>
              <Switch checked={settings.sound} onCheckedChange={(v) => setSettingsState(setSound(v))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Vibration</span>
              <Switch checked={settings.vibration} onCheckedChange={(v) => setSettingsState(setVibration(v))} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Daily Target</p>
              <div className="flex flex-wrap gap-1.5">
                {presetMinutes.map((m) => (
                  <motion.button
                    key={m}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSetTarget(m)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      streak.targetMinutes === m
                        ? 'gradient-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {m}m
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProgressPage;
