import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { getStreak, todayStr } from '@/lib/streak';

export const DAILY_REMINDER_MINUTES = [720, 840, 960, 1080, 1200, 1320] as const;

export const MARATHI_REMINDER_MESSAGES = [
  'अरे चॅम्पियन, अजून %d मिनिटं बाकी! मेंदूला थोडं काम दे 😎',
  'दिवस पुढे गेलाय; तुझं लक्ष्य अजून बैठकीत आहे का? %d मिनिटं बाकी 😂',
  'आजचं लक्ष्य उद्यावर ढकलायचं? अजून %d मिनिटं आहेत—चल सुरू होऊया 😏',
  'गणित पळणार नाही, पण आजचा दिवस निघून जाईल! %d मिनिटं बाकी 📚',
  'थोडंसं अजून: %d मिनिटं. उद्याचा तू आजच्या तुला धन्यवाद देईल 💪',
  'स्क्रोलिंगला सुट्टी, अभ्यासाला संधी! %d मिनिटं अजून 🔥',
  'तुझी streak वाट पाहतेय; %d मिनिटं अजून बाकी 🌟',
  'चॅम्पियन, ब्रेक संपला समज! फक्त %d मिनिटं बाकी 🚀',
  'आजची मेहनत उद्याचा आत्मविश्वास वाढवते. %d मिनिटं बाकी 💪',
  'लक्ष्य पूर्ण झाल्यावरच विजयाची घंटा! %d मिनिटं बाकी 🛎️',
  'फोनला आराम दे; भविष्याला वेळ दे. अजून %d मिनिटं 😏',
  'मिशन अधूरं आहे; छोटा स्प्रिंट मार—%d मिनिटं बाकी 🏁',
] as const;

export const HINDI_REMINDER_MESSAGES = [
  'जनाब, लक्ष्य अभी बाकी है! बस %d मिनट और—चलो शुरू करें 😎',
  'दिन आगे बढ़ गया, आपका लक्ष्य अभी बैठक में है क्या? %d मिनट बाकी 😂',
  'आज का काम कल पर छोड़ना है? अभी %d मिनट बाकी हैं 😏',
  'गणित कहीं भाग नहीं रहा, पर आज का दिन निकल जाएगा! %d मिनट बाकी 📚',
  'बस थोड़ा और: %d मिनट। कल वाला आप आज वाले को धन्यवाद देगा 💪',
  'स्क्रॉलिंग को छुट्टी दो, पढ़ाई को मौका! %d मिनट बाकी 🔥',
  'आपकी स्ट्रीक इंतज़ार कर रही है; %d मिनट और 🌟',
  'चैंपियन, ब्रेक खत्म समझो! सिर्फ़ %d मिनट बाकी 🚀',
  'आज की मेहनत कल का आत्मविश्वास बढ़ाएगी। %d मिनट बाकी 💪',
  'लक्ष्य पूरा होगा तभी जीत की घंटी बजेगी! %d मिनट बाकी 🛎️',
  'मोबाइल को आराम, भविष्य को समय दो। बस %d मिनट 😏',
  'मिशन अधूरा है; छोटा सा स्प्रिंट लगाओ—%d मिनट बाकी 🏁',
] as const;

interface MathMasterNotificationsPlugin {
  requestPermission(): Promise<{ granted: boolean }>;
  syncDailyTarget(options: {
    enabled: boolean;
    targetMinutes: number;
    elapsedSeconds: number;
    completed: boolean;
    dayKey: string;
    scheduleMinutesJson: string;
    marathiMessagesJson: string;
    hindiMessagesJson: string;
  }): Promise<{ scheduled: boolean }>;
  setUpdateAlerts(options: { enabled: boolean }): Promise<{ configured: boolean; subscribed?: boolean }>;
  consumeNotificationAction(): Promise<{
    action?: string;
    versionName?: string | null;
    versionCode?: string | null;
    updateManifestUrl?: string | null;
  }>;
}

const NativeNotifications = registerPlugin<MathMasterNotificationsPlugin>('MathMasterNotifications');
const ENABLED_KEY = 'math-app-background-notifications-enabled-v1';
let listenersStarted = false;
let lastPayloadSignature = '';
let lastUpdateAlertsSetting: boolean | null = null;
let syncQueue: Promise<void> = Promise.resolve();
let lastPersistedSyncAt = 0;

export const getNextDailyReminderMinute = (
  currentMinute: number,
  schedule: readonly number[] = DAILY_REMINDER_MINUTES,
): number | null => schedule.find((minute) => minute > currentMinute) ?? null;

export const getRemainingTargetMinutes = (targetMinutes: number, elapsedSeconds: number): number =>
  Math.max(0, Math.ceil((Math.max(1, targetMinutes) * 60 - Math.max(0, elapsedSeconds)) / 60));

export const getBackgroundNotificationsEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
};

const getNativeState = (enabled = getBackgroundNotificationsEnabled()) => {
  const streak = getStreak();
  const date = todayStr();
  const record = streak.days[date];
  const elapsedSeconds = Math.max(0, Math.floor(record?.seconds ?? 0));
  const completed = Boolean(record?.completed || elapsedSeconds >= streak.targetMinutes * 60);

  return {
    // Preserve the user's opt-in separately from today's completion state so
    // Android can cancel today's alarms and still retain tomorrow's noon alarm.
    enabled: enabled && streak.enabled,
    targetMinutes: streak.targetMinutes,
    elapsedSeconds,
    completed,
    dayKey: date,
    scheduleMinutesJson: JSON.stringify(DAILY_REMINDER_MINUTES),
    marathiMessagesJson: JSON.stringify(MARATHI_REMINDER_MESSAGES),
    hindiMessagesJson: JSON.stringify(HINDI_REMINDER_MESSAGES),
  };
};

const queueNativeSync = (force = false): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();

  const backgroundEnabled = getBackgroundNotificationsEnabled();
  const state = getNativeState(backgroundEnabled);
  const signature = JSON.stringify(state);
  if (!force && signature === lastPayloadSignature) return syncQueue;
  lastPayloadSignature = signature;

  syncQueue = syncQueue
    .catch(() => undefined)
    .then(async () => {
      await NativeNotifications.syncDailyTarget(state);
      if (lastUpdateAlertsSetting !== backgroundEnabled) {
        await NativeNotifications.setUpdateAlerts({ enabled: backgroundEnabled });
        lastUpdateAlertsSetting = backgroundEnabled;
      }
    })
    .catch(() => {
      // A native bridge failure must not crash the web app. A later startup,
      // resume, target change, or progress update retries synchronization.
      lastPayloadSignature = '';
    });
  return syncQueue;
};

export const setBackgroundNotificationsEnabled = async (enabled: boolean): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;

  if (enabled) {
    try {
      const result = await NativeNotifications.requestPermission();
      if (!result.granted) return false;
    } catch {
      return false;
    }
  }

  try {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    return false;
  }

  lastPayloadSignature = '';
  lastUpdateAlertsSetting = null;
  window.dispatchEvent(new CustomEvent('background-notifications-updated', { detail: { enabled } }));

  try {
    await queueNativeSync(true);
    return true;
  } catch {
    try { localStorage.setItem(ENABLED_KEY, enabled ? '0' : '1'); } catch { /* Storage may be unavailable. */ }
    lastPayloadSignature = '';
    window.dispatchEvent(new CustomEvent('background-notifications-updated', {
      detail: { enabled: !enabled },
    }));
    return false;
  }
};

/** Start one app-wide sync loop; the Android native alarm survives app closure/reboot. */
export const initializeBackgroundNotifications = (): (() => void) => {
  if (listenersStarted || typeof window === 'undefined') return () => undefined;
  listenersStarted = true;

  let lastPersistedDayKey = todayStr();
  let lastMinuteBucket = -1;

  const onProgressPersisted = () => {
    if (!getBackgroundNotificationsEnabled()) return;
    const now = Date.now();
    const currentDayKey = todayStr();
    if (currentDayKey !== lastPersistedDayKey) {
      lastPersistedDayKey = currentDayKey;
      lastMinuteBucket = -1;
    }
    // streak.ts persists every second. Sync the native preference only when the
    // completed-minute value changes; target completion also dispatches streak-updated.
    if (now - lastPersistedSyncAt < 900 && getBackgroundNotificationsEnabled()) return;
    const streak = getStreak();
    const date = todayStr();
    const seconds = Math.max(0, Math.floor(streak.days[date]?.seconds ?? 0));
    const minuteBucket = Math.floor(seconds / 60);
    if (minuteBucket === lastMinuteBucket) return;
    lastMinuteBucket = minuteBucket;
    lastPersistedSyncAt = now;
    void queueNativeSync();
  };
  const onStreakUpdated = () => { void queueNativeSync(true); };
  const dispatchNotificationAction = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const notification = await NativeNotifications.consumeNotificationAction();
      if (notification.action === 'study-reminder') {
        window.dispatchEvent(new CustomEvent('study-reminder-tapped', { detail: notification }));
      } else if (notification.action === 'app-update') {
        window.dispatchEvent(new CustomEvent('app-update-notification-tapped', { detail: notification }));
      }
    } catch {
      // Older installed APKs may not yet include the native notification bridge.
    }
  };
  const onResume = () => {
    void queueNativeSync(true);
    void dispatchNotificationAction();
  };
  const onVisibility = () => { if (document.visibilityState === 'visible') onResume(); };
  const onStorage = (event: StorageEvent) => {
    if (event.key === 'math-app-streak-v1' || event.key === ENABLED_KEY) onResume();
  };
  let appResumeListener: { remove: () => Promise<void> } | null = null;
  let disposed = false;
  void dispatchNotificationAction();
  if (Capacitor.isNativePlatform()) {
    void App.addListener('resume', onResume).then((listener) => {
      if (disposed) void listener.remove();
      else appResumeListener = listener;
    }).catch(() => {
      // Focus/visibility listeners are used as a fallback.
    });
  }

  window.addEventListener('streak-persisted', onProgressPersisted);
  window.addEventListener('streak-updated', onStreakUpdated);
  window.addEventListener('background-notifications-updated', onResume);
  window.addEventListener('focus', onResume);
  window.addEventListener('online', onResume);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisibility);
  void queueNativeSync(true);

  return () => {
    disposed = true;
    listenersStarted = false;
    if (appResumeListener) void appResumeListener.remove();
    window.removeEventListener('streak-persisted', onProgressPersisted);
    window.removeEventListener('streak-updated', onStreakUpdated);
    window.removeEventListener('background-notifications-updated', onResume);
    window.removeEventListener('focus', onResume);
    window.removeEventListener('online', onResume);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisibility);
  };
};
