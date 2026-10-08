import { useEffect, useRef, useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, LogOut, RefreshCw, Check, Cloud, CloudOff, Volume2, Vibrate, Target, LogIn, Palette, Sun, Moon, Crown, Keyboard, Type } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings, setSound, setVibration, setKeyboardShortcuts, setFont, AppSettings } from '@/lib/settings';
import { FONT_OPTIONS } from '@/lib/font';
import { getStreak, setTarget, StreakState } from '@/lib/streak';
import { pullFromCloud, pushToCloud, isSyncing } from '@/lib/sync';
import { isGuest, setGuest } from '@/lib/guest';
import { THEMES, setTheme as setAppTheme, useTheme, useMode, setMode } from '@/lib/theme';
import { triggerUpdate } from '@/pwa';
import { checkAndInstallAndroidUpdate, isAndroidNativeUpdaterAvailable } from '@/nativeAppUpdater';

type UpdateState = 'idle' | 'checking' | 'updating' | 'done' | 'offline' | 'error';

const PRESET_MINUTES = [5, 10, 15, 30, 60];

const SettingsPanel = () => {
  const { user, signOut } = useAuth();
  const [settings, setSettingsState] = useState<AppSettings>(() => getSettings());
  const [streak, setStreak] = useState<StreakState>(() => getStreak());
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [online, setOnline] = useState(navigator.onLine);
  const updateResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = useTheme();
  const mode = useMode();
  const guest = !user && isGuest();

  useEffect(() => {
    return () => {
      if (updateResetTimerRef.current) {
        clearTimeout(updateResetTimerRef.current);
        updateResetTimerRef.current = null;
      }
    };
  }, []);

  const scheduleUpdateReset = (delay: number) => {
    if (updateResetTimerRef.current) clearTimeout(updateResetTimerRef.current);
    updateResetTimerRef.current = setTimeout(() => {
      updateResetTimerRef.current = null;
      setUpdateState('idle');
    }, delay);
  };

  useEffect(() => {
    const refresh = () => { setSettingsState(getSettings()); setStreak(getStreak()); };
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener('settings-updated', refresh);
    window.addEventListener('streak-updated', refresh);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    return () => {
      window.removeEventListener('settings-updated', refresh);
      window.removeEventListener('streak-updated', refresh);
      window.removeEventListener('online', onOn);
      window.removeEventListener('offline', onOff);
    };
  }, []);

  const initial = (user?.user_metadata?.display_name || user?.email || '?').toString().charAt(0).toUpperCase();
  const displayName = user?.user_metadata?.display_name || 'Account';

  const checkForUpdates = async () => {
    if (!navigator.onLine) {
      setUpdateState('offline');
      scheduleUpdateReset(1800);
      return;
    }

    setUpdateState('checking');
    const safety = setTimeout(() => setUpdateState('idle'), 15000);

    try {
      if (user) {
        await pullFromCloud(user.id);
        await pushToCloud(user.id);
      }

      if (isAndroidNativeUpdaterAvailable()) {
        const result = await checkAndInstallAndroidUpdate();

        if (result.status === 'offline') {
          setUpdateState('offline');
        } else if (result.status === 'updated') {
          setUpdateState('updating');
        } else if (result.status === 'current') {
          setUpdateState('done');
        } else if (result.status === 'error') {
          setUpdateState('error');
          scheduleUpdateReset(3000);
        } else {
          setUpdateState('done');
        }
      } else {
        const result = await triggerUpdate();
        if (result === 'offline') {
          setUpdateState('offline');
          setTimeout(() => setUpdateState('idle'), 1800);
        } else if (result === 'updated') {
          setUpdateState('updating');
        } else {
          setUpdateState('done');
          scheduleUpdateReset(1600);
        }
      }
    } catch {
      setUpdateState('error');
      setTimeout(() => setUpdateState('idle'), 3000);
    } finally {
      clearTimeout(safety);
    }
  };

  const updateLabel: Record<UpdateState, string> = {
    idle: 'Check for updates',
    checking: 'Checking…',
    updating: 'Downloading update…',
    done: 'Up to date',
    offline: 'You are offline',
    error: 'Update failed — try again',
  };

  const isBusy = updateState === 'checking' || updateState === 'updating' || isSyncing();

  return (
    <div className="space-y-5 min-w-0">
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
            whileTap={{ scale: 0.92 }}
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
            whileTap={{ scale: 0.92 }}
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
              whileTap={{ scale: 0.95 }}
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

      {/* Font */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <Type size={16} className="text-muted-foreground" /> Font
        </p>
        <div className="grid grid-cols-2 gap-2">
          {FONT_OPTIONS.map((font) => {
            const selected = settings.font === font.id;
            const optionClass = selected
              ? 'border-primary bg-primary/10 text-primary shadow-[0_10px_28px_-18px_hsl(var(--primary)/0.7)]'
              : 'border-border/70 bg-transparent text-foreground hover:border-primary/40';
            return (
              <motion.button
                key={font.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setSettingsState(setFont(font.id))}
                aria-pressed={selected}
                data-font-selector
                className={"relative min-w-0 rounded-2xl border px-3 py-2.5 text-left transition-all " + optionClass}
              >
                <span
                  className="block truncate text-[15px] font-semibold leading-tight"
                  style={{ fontFamily: font.family }}
                >
                  {font.name}
                </span>
                <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                  {font.tagline}
                </span>
                {selected && (
                  <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check size={12} />
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Appearance — Themes */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <Palette size={16} className="text-muted-foreground" /> Themes
        </p>
        {/* Dark / Light mode */}
        <div className="flex gap-2 mb-3">
          {(['dark', 'light'] as const).map((m) => {
            const active = mode === m;
            const Icon = m === 'dark' ? Moon : Sun;
            return (
              <motion.button
                key={m}
                whileTap={{ scale: 0.96 }}
                onClick={() => setMode(m)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-2xl px-3 py-2 border text-sm font-semibold transition-all ${
                  active
                    ? 'border-primary bg-primary/10 text-primary glow-primary'
                    : 'border-border glass text-muted-foreground hover:border-primary/40'
                }`}
              >
                <Icon size={15} />
                {m === 'dark' ? 'Dark' : 'Light'}
              </motion.button>
            );
          })}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x" style={{ scrollbarWidth: 'none' }}>
          {THEMES.map((t) => {
            const selected = theme === t.id;
            return (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => setAppTheme(t.id)}
                className={`relative shrink-0 snap-start w-[108px] rounded-2xl p-3 border text-left transition-all duration-200 ${
                  selected
                    ? 'border-primary glow-primary'
                    : 'border-border/70 glass hover:border-primary/40'
                }`}
              >
                {/* Color preview: 3 circular dots (bg / primary / accent) */}
                <div className="flex -space-x-2 mb-2">
                  {t.swatch.map((c, i) => (
                    <span
                      key={i}
                      className="h-7 w-7 rounded-full border-2 border-background shadow-sm"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight">{t.name}</p>
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 truncate">{t.tagline}</p>

                {/* Premium badge */}
                {t.premium && (
                  <span
                    className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  >
                    <Crown size={9} /> PRO
                  </span>
                )}

                {/* Selected check */}
                {selected && (
                  <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check size={12} />
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Update */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={checkForUpdates}
        disabled={isBusy}
        className={"w-full flex items-center justify-between rounded-2xl px-4 py-3 border glass transition-all " + (
          isBusy ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40'
        )}
      >
        <span className="text-sm font-medium text-foreground">{updateLabel[updateState]}</span>
        <AnimatePresence mode="wait" initial={false}>
          {updateState === 'done' ? (
            <motion.span key="d" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
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
    </div>
  );
};

export default SettingsPanel;
    
