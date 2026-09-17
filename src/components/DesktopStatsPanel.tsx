import { useEffect, useState } from 'react';
import { Flame, Trophy, Target, Zap, Command, Keyboard, ChevronRight } from 'lucide-react';
import { getXP, levelFromXP, xpInLevel, xpProgressPct, XP_PER_LEVEL } from '@/lib/xp';
import { getStreak } from '@/lib/streak';
import { getProgress } from '@/lib/progress';
import { getAnalytics, getDay, todayStr } from '@/lib/analytics';

interface Props {
  onStartPractice: (topic: string) => void;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
}

const QUICK = [
  { id: 'tables', label: 'Tables' },
  { id: 'squares', label: 'Squares' },
  { id: 'roots', label: 'Roots' },
  { id: 'percentage', label: 'Percentage' },
];

const readStats = () => {
  const xp = getXP();
  const streak = getStreak();
  const progress = getProgress();
  const day = getDay(getAnalytics(), todayStr());
  return {
    level: levelFromXP(xp.total),
    xpIn: xpInLevel(xp.total),
    xpPct: xpProgressPct(xp.total),
    totalXp: xp.total,
    streak: streak.current,
    best: streak.best,
    todayQ: day.questions,
    todayAcc: day.questions > 0 ? Math.round((day.correct / day.questions) * 100) : 0,
    allAcc: progress.totalAttempts > 0 ? Math.round((progress.correct / progress.totalAttempts) * 100) : 0,
    allQ: progress.totalAttempts,
  };
};

const Row = ({ icon: Icon, label, value, tone }: { icon: typeof Flame; label: string; value: string; tone: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-b-0">
    <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
      <Icon size={14} className={tone} />
      {label}
    </span>
    <span className="font-display font-bold text-sm text-foreground tabular-nums">{value}</span>
  </div>
);

const DesktopStatsPanel = ({ onStartPractice, onOpenPalette, onOpenShortcuts }: Props) => {
  const [s, setS] = useState(readStats);

  useEffect(() => {
    const refresh = () => setS(readStats());
    refresh();
    ['xp-updated', 'streak-updated', 'analytics-updated', 'progress-updated'].forEach((e) =>
      window.addEventListener(e, refresh),
    );
    return () => {
      ['xp-updated', 'streak-updated', 'analytics-updated', 'progress-updated'].forEach((e) =>
        window.removeEventListener(e, refresh),
      );
    };
  }, []);

  return (
    <aside className="w-[264px] shrink-0 pt-4 pr-4">
      <div className="sticky top-4 space-y-3">
        {/* Level / XP */}
        <div className="glass rounded-xl p-3">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Level</span>
            <span className="font-display font-extrabold text-xl text-primary tabular-nums">{s.level}</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-500"
              style={{ width: `${s.xpPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>{s.xpIn} / {XP_PER_LEVEL} XP</span>
            <span>{s.totalXp} total</span>
          </div>
        </div>

        {/* Stats */}
        <div className="glass rounded-xl px-3 py-1.5">
          <Row icon={Flame} label="Streak" value={`${s.streak} d`} tone="text-warning" />
          <Row icon={Trophy} label="Best" value={`${s.best} d`} tone="text-success" />
          <Row icon={Target} label="Today" value={`${s.todayQ} Q · ${s.todayAcc}%`} tone="text-primary" />
          <Row icon={Zap} label="All time" value={`${s.allQ} Q · ${s.allAcc}%`} tone="text-accent" />
        </div>

        {/* Quick practice */}
        <div className="glass rounded-xl p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Quick practice</p>
          <div className="space-y-1">
            {QUICK.map((q) => (
              <button
                key={q.id}
                onClick={() => onStartPractice(q.id)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
              >
                {q.label}
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div className="glass rounded-xl p-3 space-y-1">
          <button
            onClick={onOpenPalette}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <span className="flex items-center gap-2"><Command size={14} /> Command palette</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">Ctrl K</kbd>
          </button>
          <button
            onClick={onOpenShortcuts}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <span className="flex items-center gap-2"><Keyboard size={14} /> Shortcuts</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">?</kbd>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DesktopStatsPanel;
