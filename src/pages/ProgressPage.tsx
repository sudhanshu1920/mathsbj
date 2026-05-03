import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Target, XCircle, Flame, RotateCcw, Snowflake } from 'lucide-react';
import { getProgress, resetProgress, ProgressData } from '@/lib/progress';
import {
  evaluateStreak,
  getStreak,
  setEnabled,
  setTarget,
  dayStatus,
  todayStr,
  getMaxFreezePerMonth,
  StreakState,
  DayStatus,
} from '@/lib/streak';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ProgressPage = () => {
  const [data, setData] = useState<ProgressData>(getProgress());
  const [streak, setStreak] = useState<StreakState>(() => evaluateStreak());
  const [customMin, setCustomMin] = useState<string>('');
  const [longPressDay, setLongPressDay] = useState<string | null>(null);
  const [tappedDay, setTappedDay] = useState<{ date: string; secs: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setData(getProgress());
    const refresh = () => setStreak(getStreak());
    window.addEventListener('streak-updated', refresh);
    return () => window.removeEventListener('streak-updated', refresh);
  }, []);

  const presetMinutes = [5, 10, 15, 30, 60];

  const handleToggle = (val: boolean) => {
    setStreak(setEnabled(val));
  };
  const handleSetTarget = (mins: number) => {
    setStreak(setTarget(mins));
  };

  // Build last 35 days (5 weeks) calendar grid
  const calendarDays = useMemo(() => {
    const today = new Date();
    const days: { date: string; status: DayStatus; dayNum: number }[] = [];
    // start from Sunday of the week 4 weeks ago
    const start = new Date(today);
    start.setDate(today.getDate() - 27);
    for (let i = 0; i < 28; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: ds, status: dayStatus(streak, ds), dayNum: d.getDate() });
    }
    return days;
  }, [streak]);

  const todaySecs = streak.days[todayStr()]?.seconds || 0;
  const targetSecs = streak.targetMinutes * 60;
  const todayPct = Math.min(100, Math.round((todaySecs / targetSecs) * 100));

  const startLongPress = (date: string) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressDay(date);
    }, 500);
  };
  const cancelLongPress = (date: string) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    // tap fallback
    if (longPressDay === null) {
      const secs = streak.days[date]?.seconds || 0;
      setTappedDay({ date, secs });
      setTimeout(() => setTappedDay(null), 1800);
    }
  };

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
      {/* Minimal streak hero */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-glow">Progress</h1>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border"
        >
          <Flame size={18} className={streak.current > 0 ? 'text-warning' : 'text-muted-foreground'} />
          <span className="font-display font-bold text-lg text-foreground">{streak.current}</span>
        </motion.div>
      </div>

      {/* Daily Target Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-4 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Daily Target</span>
          </div>
          <Switch checked={streak.enabled} onCheckedChange={handleToggle} />
        </div>

        <AnimatePresence initial={false}>
          {streak.enabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>⏱ {streak.targetMinutes} min</span>
                <span>{Math.floor(todaySecs / 60)}m / {streak.targetMinutes}m</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
                <motion.div
                  className="h-full gradient-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${todayPct}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presetMinutes.map((m) => (
                  <button
                    key={m}
                    onClick={() => handleSetTarget(m)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      streak.targetMinutes === m
                        ? 'gradient-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Custom"
                    value={customMin}
                    onChange={(e) => setCustomMin(e.target.value)}
                    className="w-16 bg-secondary border border-border rounded-full px-3 py-1.5 text-center text-xs font-bold text-foreground focus:border-primary outline-none"
                  />
                  <button
                    onClick={() => {
                      const n = Number(customMin);
                      if (n > 0) {
                        handleSetTarget(n);
                        setCustomMin('');
                      }
                    }}
                    className="px-2 py-1.5 rounded-full text-xs font-bold bg-primary/10 text-primary"
                  >
                    Set
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Calendar */}
      {streak.enabled && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-base text-foreground">Last 4 weeks</h3>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Snowflake size={12} className="text-primary" />
              {streak.freezesUsed}/{getMaxFreezePerMonth()}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((d) => {
              const base = 'aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all';
              const styles: Record<DayStatus, string> = {
                completed: 'bg-success/20 text-success border border-success/40',
                freeze: 'bg-primary/15 text-primary border border-primary/30',
                partial: 'bg-warning/15 text-warning border border-warning/30',
                missed: 'bg-secondary text-muted-foreground/50',
                upcoming: 'bg-muted/30 text-muted-foreground/30',
                today: 'bg-card border-2 border-primary text-foreground',
              };
              return (
                <button
                  key={d.date}
                  onTouchStart={() => startLongPress(d.date)}
                  onTouchEnd={() => cancelLongPress(d.date)}
                  onMouseDown={() => startLongPress(d.date)}
                  onMouseUp={() => cancelLongPress(d.date)}
                  onMouseLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                  className={`${base} ${styles[d.status]}`}
                >
                  {d.status === 'completed' ? '🟢' : d.status === 'freeze' ? '❄️' : d.dayNum}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {tappedDay && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center text-xs text-muted-foreground mt-2"
              >
                {tappedDay.date} • {Math.floor(tappedDay.secs / 60)}m {tappedDay.secs % 60}s
              </motion.div>
            )}
          </AnimatePresence>

          <Dialog open={!!longPressDay} onOpenChange={(o) => { if (!o) setLongPressDay(null); }}>
            <DialogContent className="rounded-2xl max-w-[320px]">
              <DialogHeader>
                <DialogTitle>{longPressDay}</DialogTitle>
              </DialogHeader>
              {longPressDay && (() => {
                const r = streak.days[longPressDay];
                const status = dayStatus(streak, longPressDay);
                const secs = r?.seconds || 0;
                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-semibold capitalize">{status}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Time spent</span><span className="font-semibold">{Math.floor(secs / 60)}m {secs % 60}s</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Target</span><span className="font-semibold">{streak.targetMinutes}m</span></div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Accuracy ring */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex justify-center mb-8"
      >
        <div className="relative w-36 h-36">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-secondary" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="stroke-primary"
              strokeDasharray={`${accuracy * 2.64} 264`}
              style={{ transition: 'stroke-dasharray 1s ease' }}
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

      {/* Reset */}
      <button
        onClick={() => {
          resetProgress();
          setData(getProgress());
        }}
        className="flex items-center gap-2 mx-auto text-muted-foreground hover:text-destructive transition-colors text-sm"
      >
        <RotateCcw size={14} />
        Reset Progress
      </button>
    </div>
  );
};

export default ProgressPage;
