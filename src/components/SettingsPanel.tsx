import { useEffect, useRef, useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, LogOut, RefreshCw, Check, Cloud, CloudOff, Volume2, Vibrate, Target, Bell, LogIn, Palette, Sun, Moon, Crown, Keyboard, LayoutGrid, Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings, setSound, setVibration, setKeyboardShortcuts, setHomeScreenWidgetsEnabled, setHomeWidgetContent, setHomeWidgetStyle, setHomeWidgetTheme, type AppSettings, type HomeWidgetContent, type HomeWidgetStyle, type HomeWidgetTheme } from '@/lib/settings';
import { getStreak, setTarget, todayStr, type StreakState } from '@/lib/streak';
import { isGuest, setGuest } from '@/lib/guest';
import { THEMES, setTheme as setAppTheme, useTheme, useMode, setMode } from '@/lib/theme';
import { checkForAppUpdate } from '@/lib/appUpdateService';
import { announceUpdateAvailable } from '@/lib/appUpdateEvents';
import { MOTION } from '@/lib/motion';
import { APP_VERSION_NAME } from '@/lib/appVersion';
import {
  getBackgroundNotificationsEnabled,
  setBackgroundNotificationsEnabled,
  syncHomeWidgetPreferences,
  refreshHomeWidget,
} from '@/lib/dailyTargetReminders';

type UpdateState = 'idle' | 'checking' | 'available' | 'updating' | 'done' | 'offline' | 'error';

const PRESET_MINUTES = [5, 10, 15, 30, 60];

const WIDGET_CONTENT_OPTIONS: Array<{ id: HomeWidgetContent; label: string }> = [
  { id: 'appIdentity', label: 'App Identity' },
  { id: 'target', label: "Today's Target" },
  { id: 'progress', label: 'Progress' },
  { id: 'remaining', label: 'Remaining Target' },
  { id: 'studyTime', label: 'Study Time' },
  { id: 'streak', label: 'Streak' },
  { id: 'updateStatus', label: 'Update Status' },
];

const WIDGET_STYLES: Array<{ id: HomeWidgetStyle; label: string }> = [
  { id: 'glass', label: 'Glass' },
  { id: 'compact', label: 'Compact' },
  { id: 'minimal', label: 'Minimal' },
];

const WIDGET_THEMES: Array<{ id: HomeWidgetTheme; label: string }> = [
  { id: 'app', label: 'Match App Theme' },
  { id: 'violet', label: 'Violet Glass' },
];

const SettingsPanel = () => {
  const { user, signOut } = useAuth();
  const [settings, setSettingsState] = useState<AppSettings>(() => getSettings());
  const [streak, setStreak] = useState<StreakState>(() => getStreak());
  const [backgroundNotificationsEnabled, setBackgroundNotificationsEnabledState] = useState(() => getBackgroundNotificationsEnabled());
  const [notificationToggleBusy, setNotificationToggleBusy] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [widgetPreviewVisible, setWidgetPreviewVisible] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const updateResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateCheckInFlightRef = useRef(false);
  const theme = useTheme();
  const mode = useMode();
  const guest = !user && isGuest();
  const todayRecord = streak.days[todayStr()];
  const todaySeconds = Math.max(0, Math.floor(todayRecord?.seconds ?? 0));
  const completedMinutes = Math.min(streak.targetMinutes, Math.floor(todaySeconds / 60));
  const remainingMinutes = Math.max(0, Math.ceil((streak.targetMinutes * 60 - todaySeconds) / 60));
  const widgetProgress = Math.min(100, Math.round((todaySeconds / Math.max(1, streak.targetMinutes * 60)) * 100));

  const mountedRef = useRef(true);

  useEffect(() => {
    void syncHomeWidgetPreferences();
  }, [theme, mode]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (updateResetTimerRef.current) {
        clearTimeout(updateResetTimerRef.current);
        updateResetTimerRef.current = null;
      }
    };
  }, []);

  const scheduleUpdateReset = (delay: number) => {
    if (!mountedRef.current) return;
    if (updateResetTimerRef.current) clearTimeout(updateResetTimerRef.current);
    updateResetTimerRef.current = setTimeout(() => {
      updateResetTimerRef.current = null;
      if (mountedRef.current) setUpdateState('idle');
    }, delay);
  };

  useEffect(() => {
    const refresh = () => {
      setSettingsState(getSettings());
      setStreak(getStreak());
      setBackgroundNotificationsEnabledState(getBackgroundNotificationsEnabled());
    };
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener('settings-updated', refresh);
    window.addEventListener('streak-updated', refresh);
    window.addEventListener('background-notifications-updated', refresh);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    return () => {
      window.removeEventListener('settings-updated', refresh);
      window.removeEventListener('streak-updated', refresh);
      window.removeEventListener('background-notifications-updated', refresh);
      window.removeEventListener('online', onOn);
      window.removeEventListener('offline', onOff);
    };
  }, []);

  const initial = (user?.user_metadata?.display_name || user?.email || '?').toString().charAt(0).toUpperCase();
  const displayName = user?.user_metadata?.display_name || 'Account';

  const checkForUpdates = async () => {
    if (updateCheckInFlightRef.current) return;
    updateCheckInFlightRef.current = true;
    if (updateResetTimerRef.current) {
      clearTimeout(updateResetTimerRef.current);
      updateResetTimerRef.current = null;
    }

    setUpdateState('checking');
    try {
      const result = await checkForAppUpdate();
      if (result.status === 'available') {
        // The global updater may still show its popup even if Settings was
        // closed while the shared network request was in flight.
        announceUpdateAvailable(result.update, true);
        if (!mountedRef.current) return;
        setUpdateState('available');
        scheduleUpdateReset(8000);
      } else {
        if (!mountedRef.current) return;
        if (result.status === 'current') {
          setUpdateState('done');
          scheduleUpdateReset(2500);
        } else if (result.status === 'offline') {
          setUpdateState('offline');
          scheduleUpdateReset(2500);
        } else {
          setUpdateState('error');
          scheduleUpdateReset(4000);
        }
      }
    } catch {
      if (mountedRef.current) {
        setUpdateState('error');
        scheduleUpdateReset(4000);
      }
    } finally {
      updateCheckInFlightRef.current = false;
    }
  };

  const handleBackgroundNotificationsToggle = async (enabled: boolean) => {
    if (notificationToggleBusy) return;
    setNotificationToggleBusy(true);
    try {
      const applied = await setBackgroundNotificationsEnabled(enabled);
      setBackgroundNotificationsEnabledState(applied ? enabled : getBackgroundNotificationsEnabled());
    } finally {
      if (mountedRef.current) setNotificationToggleBusy(false);
    }
  };

  const updateLabel: Record<UpdateState, string> = {
    idle: 'Check for updates',
    checking: 'Checking…',
    available: 'New update available — tap to check',
    updating: 'Downloading update…',
    done: "You're using the latest version",
    offline: 'You are offline — tap to retry',
    error: 'Unable to check — tap to retry',
  };

  const isBusy = updateState === 'checking' || updateState === 'updating';

  return (
    <div className="space-y-4 min-w-0">
      {/* Profile */}
      {user && (
        <div className="glass rounded-2xl p-3 flex items-center gap-3">
          <div className="h-11 w-11 rounded-full gradient-primary text-primary-foreground font-display font-bold flex items-center justify-center text-lg">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              {online ? <Cloud size={11} className="text-success" /> : <CloudOff size={11} />}
              {user.email}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: MOTION.scale.press }}
            onClick={() => void signOut()}
            aria-label="Sign out"
            className="p-2 rounded-full text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut size={16} />
          </motion.button>
        </div>
      )}

      {/* Guest banner */}
      {guest && (
        <div className="glass-lite rounded-2xl p-3 flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-secondary text-foreground font-display font-bold flex items-center justify-center text-lg">
            G
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">Guest</p>
            <p className="text-xs text-muted-foreground truncate">Local only — sign in to back up</p>
          </div>
          <motion.button
            whileTap={{ scale: MOTION.scale.press }}
            onClick={() => setGuest(false)}
            aria-label="Sign in"
            className="p-2 rounded-full text-muted-foreground hover:text-primary transition-colors"
          >
            <LogIn size={16} />
          </motion.button>
        </div>
      )}

      {/* Sound */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground flex items-center gap-2">
          <Volume2 size={16} className="text-muted-foreground" /> Sound
        </span>
        <Switch checked={settings.sound} onCheckedChange={(v) => setSettingsState(setSound(v))} />
      </div>

      {/* Vibration */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground flex items-center gap-2">
          <Vibrate size={16} className="text-muted-foreground" /> Vibration
        </span>
        <Switch checked={settings.vibration} onCheckedChange={(v) => setSettingsState(setVibration(v))} />
      </div>

      {/* Desktop keyboard shortcuts */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground flex items-center gap-2">
          <Keyboard size={16} className="text-muted-foreground" /> Keyboard shortcuts
        </span>
        <Switch
          checked={settings.keyboardShortcuts}
          onCheckedChange={(v) => setSettingsState(setKeyboardShortcuts(v))}
          aria-label="Toggle keyboard shortcuts"
        />
      </div>

      {/* Compact home-screen widget controls */}
      <section className="rounded-xl border border-border/60 bg-card/20 px-3 py-2.5">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
            <LayoutGrid size={16} className="shrink-0 text-muted-foreground" />
            <span>Home Screen Widgets</span>
          </span>
          <Switch
            checked={settings.homeScreenWidgetsEnabled}
            onCheckedChange={(enabled) => {
              const next = setHomeScreenWidgetsEnabled(enabled);
              setSettingsState(next);
              if (!enabled) setWidgetPreviewVisible(false);
              void syncHomeWidgetPreferences().then((synced) => {
                if (enabled && synced) refreshHomeWidget();
              });
            }}
            aria-label="Home Screen Widgets"
          />
        </div>

        <AnimatePresence initial={false}>
          {settings.homeScreenWidgetsEnabled && (
            <motion.div
              key="home-widget-options"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: MOTION.duration.standard, ease: MOTION.ease.easeOut }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Widget Content</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WIDGET_CONTENT_OPTIONS.map((option) => {
                      const selected = settings.homeWidgetContent.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            const nextContent = selected
                              ? settings.homeWidgetContent.filter((field) => field !== option.id)
                              : [...settings.homeWidgetContent, option.id];
                            if (nextContent.length === 0) return;
                            setSettingsState(setHomeWidgetContent(nextContent));
                            void syncHomeWidgetPreferences();
                          }}
                          className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selected
                              ? 'border-primary/70 bg-primary/10 text-primary'
                              : 'border-border/70 bg-transparent text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Widget Style</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WIDGET_STYLES.map((option) => {
                      const selected = settings.homeWidgetStyle === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSettingsState(setHomeWidgetStyle(option.id));
                            void syncHomeWidgetPreferences();
                          }}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selected
                              ? 'border-primary/70 bg-primary/10 text-primary'
                              : 'border-border/70 bg-transparent text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Widget Theme</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WIDGET_THEMES.map((option) => {
                      const selected = settings.homeWidgetTheme === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSettingsState(setHomeWidgetTheme(option.id));
                            void syncHomeWidgetPreferences();
                          }}
                          className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selected
                              ? 'border-primary/70 bg-primary/10 text-primary'
                              : 'border-border/70 bg-transparent text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    aria-expanded={widgetPreviewVisible}
                    onClick={() => setWidgetPreviewVisible((visible) => !visible)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Eye size={14} />
                    Preview
                    <span className="sr-only">widget</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {widgetPreviewVisible && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className={`mt-2 rounded-2xl border p-3 shadow-sm ${
                          mode === 'light'
                            ? 'border-slate-200 bg-slate-50 text-slate-800'
                            : 'border-white/10 bg-slate-950/85 text-slate-100'
                        }`}
                      >
                        {settings.homeWidgetContent.includes('appIdentity') && (
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Math Master</p>
                        )}
                        <div className="flex items-center gap-3">
                          {settings.homeWidgetContent.includes('progress') && (
                            <span className="text-2xl font-bold text-primary">{widgetProgress}%</span>
                          )}
                          <div className="min-w-0 flex-1">
                            {settings.homeWidgetContent.includes('target') && (
                              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">Today's Target</p>
                            )}
                            {settings.homeWidgetContent.includes('studyTime') && (
                              <p className="mt-0.5 text-sm font-semibold">{completedMinutes} / {streak.targetMinutes} min</p>
                            )}
                            {settings.homeWidgetContent.includes('progress') && (
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-current/15">
                                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${widgetProgress}%` }} />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] opacity-80">
                          {settings.homeWidgetContent.includes('remaining') && (
                            <span>{remainingMinutes === 0 ? 'Target complete' : `${remainingMinutes} min left`}</span>
                          )}
                          {settings.homeWidgetContent.includes('streak') && <span>🔥 {streak.current}-day streak</span>}
                        </div>
                        {settings.homeWidgetContent.includes('updateStatus') && (
                          <p className="mt-2 truncate text-[10px] opacity-60">Updates refresh when the app opens</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Daily target */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <Target size={16} className="text-muted-foreground" /> Daily Target
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_MINUTES.map((m) => (
            <motion.button
              key={m}
              whileTap={{ scale: MOTION.scale.press }}
              onClick={() => setStreak(setTarget(m))}
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

      {/* Background notifications: one contextual permission request opts into local
          daily reminders and server-pushed version updates together. */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/30 p-2.5">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <Bell size={16} className="shrink-0 text-muted-foreground" />
          Background notifications
        </p>
        <Switch
          checked={backgroundNotificationsEnabled}
          disabled={notificationToggleBusy}
          onCheckedChange={(value) => { void handleBackgroundNotificationsToggle(value); }}
          aria-label="Enable background notifications"
        />
      </div>

      {/* Appearance — keep theme identity separate from the Light/Dark mode. */}
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <Palette size={16} className="text-muted-foreground" /> Theme
        </p>
        <div className="mb-2 flex gap-2">
          {(['dark', 'light'] as const).map((m) => {
            const active = mode === m;
            const Icon = m === 'dark' ? Moon : Sun;
            return (
              <motion.button
                key={m}
                type="button"
                whileTap={{ scale: MOTION.scale.press }}
                onClick={() => setMode(m)}
                aria-pressed={active}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors duration-100 ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/70 bg-transparent text-muted-foreground hover:border-primary/40'
                }`}
              >
                <Icon size={14} />
                {m === 'dark' ? 'Dark' : 'Light'}
              </motion.button>
            );
          })}
        </div>
        <div
          data-theme-selector-grid
          className="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3 md:grid-cols-4"
        >
          {THEMES.map((t) => {
            const selected = theme === t.id;
            return (
              <motion.button
                key={t.id}
                data-theme-option={t.id}
                type="button"
                whileTap={{ scale: MOTION.scale.press }}
                onClick={() => setAppTheme(t.id)}
                aria-label={`Select ${t.name} theme`}
                aria-pressed={selected}
                className={`flex min-h-9 min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors duration-100 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? 'border-primary/70 bg-primary/10'
                    : 'border-border/70 bg-card/30 hover:border-primary/40'
                }`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="flex shrink-0 items-center gap-0.5" aria-hidden="true">
                    {t.swatch.map((color, index) => (
                      <span
                        key={index}
                        data-theme-swatch
                        className="h-2 w-2 rounded-full ring-1 ring-border/60"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[11px] font-semibold leading-tight text-foreground">
                    {t.name}
                  </span>
                </span>
                {t.premium && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold leading-none text-muted-foreground">
                    <Crown size={9} />
                    PRO
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${
                    selected ? 'bg-primary text-primary-foreground' : 'text-transparent'
                  }`}
                >
                  <Check size={9} />
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Update */}
      <motion.button
        whileTap={{ scale: MOTION.scale.press }}
        onClick={checkForUpdates}
        disabled={isBusy}
        className={"w-full flex items-center justify-between rounded-2xl px-4 py-3 border glass transition-all " + (
          isBusy ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40'
        )}
      >
        <span className="text-sm font-medium text-foreground">{updateLabel[updateState]}</span>
        <AnimatePresence mode="wait" initial={false}>
          {updateState === 'done' ? (
            <motion.span key="d" initial={{ scale: MOTION.scale.subtle }} animate={{ scale: 1 }} exit={{ scale: MOTION.scale.subtle }}>
              <Check size={18} className="text-success" />
            </motion.span>
          ) : (
            <motion.span
              key="r"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, rotate: isBusy ? 360 : 0 }}
              exit={{ opacity: 0 }}
              transition={isBusy ? { repeat: Infinity, duration: 1, ease: 'linear' } : { duration: 0.2 }}
              className={isBusy ? 'text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]' : 'text-muted-foreground'}
            >
              <RefreshCw size={18} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <p className="text-center text-[11px] text-muted-foreground">App Version {APP_VERSION_NAME}</p>
    </div>
  );
};

export default SettingsPanel;
    
