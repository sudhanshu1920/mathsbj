import { useEffect, useMemo, useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { getAnalytics, getDay, todayStr, AnalyticsState, DayAnalytics } from '@/lib/analytics';
import { getStreak } from '@/lib/streak';

type Tab = 'day' | 'week' | 'month';
const TABS: Tab[] = ['day', 'week', 'month'];

const pad = (n: number) => String(n).padStart(2, '0');
const dstr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(d.getDate() + n); return x; };

const DAY_LABEL = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
const WEEK_LABEL = (start: Date, end: Date) => {
  const sm = start.toLocaleDateString(undefined, { month: 'short' });
  const em = end.toLocaleDateString(undefined, { month: 'short' });
  return `${start.getDate()} ${sm} – ${end.getDate()} ${em}`;
};
const MONTH_LABEL = (d: Date) =>
  d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase();

const startOfWeek = (d: Date) => {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  return addDays(d, diff);
};

const ProgressAnalytics = () => {
  const [tab, setTab] = useState<Tab>('day');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [state, setState] = useState<AnalyticsState>(() => getAnalytics());
  const [target, setTarget] = useState<number>(() => getStreak().targetMinutes);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    const refresh = () => { setState(getAnalytics()); setTarget(getStreak().targetMinutes); };
    window.addEventListener('analytics-updated', refresh);
    window.addEventListener('streak-updated', refresh);
    return () => {
      window.removeEventListener('analytics-updated', refresh);
      window.removeEventListener('streak-updated', refresh);
    };
  }, []);

  // Reset anchor when switching tab
  useEffect(() => { setAnchor(new Date()); setTooltip(null); }, [tab]);

  const switchTab = (dir: 1 | -1) => {
    const i = TABS.indexOf(tab);
    const ni = Math.max(0, Math.min(TABS.length - 1, i + dir));
    setTab(TABS[ni]);
  };

  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart == null) return;
    const delta = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(delta) > 50) switchTab(delta < 0 ? 1 : -1);
    setTouchStart(null);
  };

  // Step navigation per tab
  const step = (dir: -1 | 1) => {
    setTooltip(null);
    if (tab === 'day') setAnchor(addDays(anchor, dir));
    else if (tab === 'week') setAnchor(addDays(anchor, dir * 7));
    else {
      const x = new Date(anchor);
      x.setMonth(x.getMonth() + dir);
      setAnchor(x);
    }
  };

  // ---------- Day ----------
  const dayData: DayAnalytics = useMemo(
    () => getDay(state, dstr(anchor)),
    [state, anchor]
  );
  const dayMax = useMemo(() => Math.max(1, ...dayData.hours), [dayData]);
  const isToday = dstr(anchor) === todayStr();

  // ---------- Week ----------
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekData = useMemo(
    () => weekDays.map((d) => ({ date: d, day: getDay(state, dstr(d)) })),
    [state, weekDays]
  );
  const weekTotal = weekData.reduce((s, w) => s + w.day.points, 0);
  const targetPoints = target * 4; // ~4 pts per min baseline (visual)
  const weekMax = Math.max(targetPoints, ...weekData.map((w) => w.day.points), 1);

  // ---------- Month ----------
  const monthDays = useMemo(() => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => new Date(y, m, i + 1));
  }, [anchor]);
  const monthData = useMemo(
    () => monthDays.map((d) => getDay(state, dstr(d))),
    [state, monthDays]
  );
  const monthTotal = monthData.reduce((s, d) => s + d.points, 0);
  const monthMax = Math.max(1, ...monthData.map((d) => d.points));

  // Build grid offset (Mon=0..Sun=6)
  const firstDow = (() => {
    const d = monthDays[0]?.getDay() ?? 1;
    return d === 0 ? 6 : d - 1;
  })();

  return (
    <div
      className="glass border border-border rounded-2xl p-4 mb-6 select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Tabs */}
      <div className="grid grid-cols-3 mb-4 relative">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative py-2 text-sm font-display font-semibold capitalize transition-colors ${
              tab === t ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {t}
            {tab === t && (
              <motion.div
                layoutId="tab-underline"
                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary"
              />
            )}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-1 px-1">
        <button onClick={() => step(-1)} className="p-1 text-muted-foreground hover:text-foreground">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h3 className="font-display font-bold text-base text-foreground">
            {tab === 'day' && DAY_LABEL(anchor)}
            {tab === 'week' && WEEK_LABEL(weekStart, addDays(weekStart, 6))}
            {tab === 'month' && MONTH_LABEL(anchor)}
          </h3>
        </div>
        <button
          onClick={() => step(1)}
          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
          disabled={tab === 'day' && isToday}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="h-4 mb-3" />

      {/* Chart */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab + dstr(anchor)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {tab === 'day' && (
            <div>
              <div className="relative h-40 flex items-end gap-[2px] px-1 border-b border-border/50">
                {dayData.hours.map((v, h) => {
                  const pct = (v / dayMax) * 100;
                  return (
                    <button
                      key={h}
                      onClick={() => setTooltip(v > 0 ? `${h}:00 • ${v}` : null)}
                      className="flex-1 h-full flex items-end"
                    >
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${pct}%` }}
                        transition={{ duration: 0.5, delay: h * 0.01 }}
                        className={`w-full rounded-sm ${v > 0 ? 'bg-success shadow-[0_0_8px_hsl(var(--success)/0.6)]' : 'bg-muted/40'}`}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                {[0, 4, 8, 12, 16, 20, 24].map((h) => (
                  <span key={h}>{h === 0 || h === 24 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}</span>
                ))}
              </div>
            </div>
          )}

          {tab === 'week' && (
            <div>
              <div className="relative h-40 flex items-end gap-2 px-2 border-b border-border/50">
                {/* Target line */}
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-primary/60"
                  style={{ bottom: `${(targetPoints / weekMax) * 100}%` }}
                />
                {weekData.map(({ date, day }, i) => {
                  const pct = (day.points / weekMax) * 100;
                  const completed = day.points >= targetPoints && targetPoints > 0;
                  return (
                    <button
                      key={i}
                      onClick={() => setTooltip(`${date.toLocaleDateString(undefined, { weekday: 'short' })} • ${day.questions} Q`)}
                      className="flex-1 h-full flex items-end justify-center"
                    >
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${pct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05 }}
                        className={`w-full rounded-md relative ${day.points > 0 ? 'bg-success shadow-[0_0_10px_hsl(var(--success)/0.5)]' : 'bg-muted/40'}`}
                      >
                        {completed && (
                          <Check size={12} className="absolute top-1 left-1/2 -translate-x-1/2 text-background" strokeWidth={3} />
                        )}
                      </motion.div>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-2">
                {weekData.map(({ date }, i) => {
                  const isAnchor = dstr(date) === dstr(anchor);
                  return (
                    <span key={i} className={`flex-1 text-center ${isAnchor ? 'font-bold text-foreground' : ''}`}>
                      {date.toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'month' && (
            <div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
                {monthDays.map((d, i) => {
                  const data = monthData[i];
                  const ratio = data.points / monthMax;
                  const size = 18 + ratio * 28; // 18..46
                  const active = data.points > 0;
                  return (
                    <button
                      key={i}
                      onClick={() => setTooltip(active ? `${d.getDate()} • ${data.questions} Q` : null)}
                      className="aspect-square flex items-center justify-center relative"
                    >
                      {active ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.01, type: 'spring', stiffness: 200, damping: 18 }}
                          className="rounded-full bg-success/85 text-background font-bold text-[11px] flex items-center justify-center shadow-[0_0_12px_hsl(var(--success)/0.5)]"
                          style={{ width: size, height: size }}
                        >
                          {d.getDate()}
                        </motion.div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{d.getDate()}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 gap-1 mt-3 text-[10px] text-muted-foreground">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="text-center">{d}</div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-xs text-muted-foreground mt-3"
          >
            {tooltip}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProgressAnalytics;