import { useEffect, useRef, useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, LogOut, RefreshCw, Check, Cloud, CloudOff, Volume2, Vibrate, Target, Bell, LogIn, Palette, Sun, Moon, Crown, Keyboard } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings, setSound, setVibration, setKeyboardShortcuts, type AppSettings } from '@/lib/settings';
import { getStreak, setTarget, type StreakState } from '@/lib/streak';
import { isGuest, setGuest } from '@/lib/guest';
import { THEMES, setTheme as setAppTheme, useTheme, useMode, setMode } from '@/lib/theme';
import { checkForAppUpdate } from '@/lib/appUpdateService';
import { announceUpdateAvailable } from '@/lib/appUpdateEvents';
import { MOTION } from '@/lib/motion';
import { APP_VERSION_NAME } from '@/lib/appVersion';
import {
  getBackgroundNotificationsEnabled,
  setBackgroundNotificationsEnabled,
} from '@/lib/dailyTargetReminders';

type UpdateState = 'idle' | 'checking' | 'available' | 'updating' | 'done' | 'offline' | 'error';

const PRESET_MINUTES = [5, 10, 15, 30, 60];

const SettingsPanel = () => {
  const { user, signOut } = useAuth();
  const [settings, setSettingsState] = useState<AppSettings>(() => getSettings());
  const [streak, setStreak] = useState<StreakState>(() => getStreak());
  const [backgroundNotificationsEnabled, setBackgroundNotificationsEnabledState] = useState(() => getBackgroundNotificationsEnabled());
  const [notificationToggleBusy, setNotificationToggleBusy] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [online, setOnline] = useState(navigator.onLine);
  const updateResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateCheckInFlightRef = useRef(false);
  const theme = useTheme();
  const mode = useMode();
  const guest = !user && isGuest();
  const mountedRef = useRef(true);

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
    
