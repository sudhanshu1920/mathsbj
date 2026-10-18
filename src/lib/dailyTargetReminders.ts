import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { getStreak, todayStr } from '@/lib/streak';

export const DAILY_REMINDER_POLICY_VERSION = 2;

/** Local device time, in minutes after midnight. One native AlarmManager alarm is queued at a time. */
export const DAILY_REMINDER_MINUTES = [
  12 * 60,
  14 * 60,
  16 * 60,
  18 * 60,
  19 * 60,
  19 * 60 + 45,
  20 * 60 + 30,
  21 * 60,
  21 * 60 + 30,
  21 * 60 + 50,
  22 * 60,
] as const;

/**
 * Each inner array belongs to the matching DAILY_REMINDER_MINUTES stage.
 * %1$d is the remaining study-target time (minutes); %2$d is the actual
 * minutes left until the local 10 PM cutoff. The target source of truth is
 * streak.ts and is measured in study minutes, not question counts.
 */
export const MARATHI_REMINDER_MESSAGES = [
  [
    'चॅम्पियन, आजचं अभ्यासाचं टार्गेट सुरू करूया का? अजून %1$d मिनिटांचा अभ्यास बाकी 💪',
    'नवीन दिवस, नवीन संधी! अभ्यासासाठी अजून %1$d मिनिटं—छान सुरुवात करूया 🚀',
    'आजची छोटीशी मेहनत मोठा फरक घडवेल. लक्ष्याचे %1$d मिनिटं पूर्ण करूया 🌟',
  ],
  [
    'दुपार झाली! टार्गेट अजून झोपलंय की तू? अभ्यासाचे %1$d मिनिटं बाकी 😂',
    'फोनला पुरेसा आराम मिळाला, आता मेंदूची पाळी! अजून %1$d मिनिटांचा अभ्यास 😎',
    'एक छोटा अभ्यासाचा राऊंड होऊ दे—लक्ष्याचे %1$d मिनिटं बाकी 📚',
  ],
  [
    'टार्गेटशी एवढी ओळख वाढवायची आहे का? चला, अजून %1$d मिनिटं अभ्यास करूया 😂',
    'थोडा अभ्यास करून टाक, नाहीतर टार्गेट रात्री स्वप्नात येईल! %1$d मिनिटं बाकी 😏',
    'स्क्रोलिंग थांबवून छोटा स्प्रिंट मार—अभ्यासाचे %1$d मिनिटं बाकी 🚀',
  ],
  [
    'संध्याकाळ झाली बॉस! बहाण्यांचा कोटा पूर्ण, आता लक्ष्याचे %1$d मिनिटं करूया 😏',
    'आजचा अभ्यास उद्यावर ढकलण्याची स्पर्धा चालू आहे का? अजून %1$d मिनिटं 😂',
    'चहा-ब्रेक छान झाला; आता अभ्यासाचाही एक राऊंड! %1$d मिनिटं बाकी ☕',
  ],
  [
    'आता वेळ वाया नको! उरलेले %1$d मिनिटं अभ्यास करून टार्गेट जवळ आणूया 🔥',
    'आजचा दिवस अजून हातात आहे. लक्ष्याचे %1$d मिनिटं पूर्ण करूया 💪',
    'एकाग्रतेचा छोटा स्प्रिंट सुरू कर—अजून %1$d मिनिटांचा अभ्यास बाकी ⏳',
  ],
  [
    'वेळ वेगाने पुढे जातोय! अभ्यासाचे %1$d मिनिटं बाकी—आता छान फोकस करूया 🔥',
    'लक्ष्याला जवळ आणण्याची वेळ आली. अजून %1$d मिनिटांचा अभ्यास बाकी 💪',
    'चला बॉस, पुढचा अभ्यासाचा राऊंड सुरू! लक्ष्याचे %1$d मिनिटं बाकी 🚀',
  ],
  [
    'रात्रीची तयारी सुरू, पण टार्गेट अजून तयार नाही? अभ्यासाचे %1$d मिनिटं बाकी 😂',
    'टार्गेटला आजच निरोप देणार की उद्याही सोबत ठेवणार? अजून %1$d मिनिटं 😏',
    'मजेत सांगतोय—आता अभ्यासाचा छोटा राऊंड करूया! %1$d मिनिटं बाकी 🔥',
  ],
  [
    'फक्त वेळ पाहून उपयोग नाही! लक्ष्याचे %1$d मिनिटं पूर्ण करण्याची वेळ आली ⏳',
    'आजचा दिवस संपण्याआधी स्वतःला एक छोटीशी जिंक दे—%1$d मिनिटं बाकी 💪',
    'घड्याळ पुढे जातंय; चला, उरलेला अभ्यास आत्ताच पूर्ण करूया 🔥 (%1$d मिनिटं)',
  ],
  [
    'फायनल राऊंड सुरू! लक्ष्याचे %1$d मिनिटं पूर्ण करूया आणि आजचा दिवस जिंकूया 🔥',
    'आजचं टार्गेट आजच—उद्याच्या स्वतःवर सगळं काम ढकलू नकोस 😎 (%1$d मिनिटं बाकी)',
    'शेवटच्या टप्प्यात आहोत! शक्य तितका अभ्यास पूर्ण करूया 💪 अजून %1$d मिनिटं',
  ],
  [
    'रात्री 10 वाजेपर्यंत फक्त %2$d मिनिटं! अभ्यासाचे %1$d मिनिटं बाकी—शक्य तितकं पूर्ण करूया ⏳',
    'शेवटची संधी जवळ आली: 10 वाजेपर्यंत %2$d मिनिटं. लक्ष्याचे %1$d मिनिटं पूर्ण करूया 🚀',
    'काउंटडाउन सुरू! 10 वाजेपर्यंत %2$d मिनिटं बाकी; अभ्यासाचे %1$d मिनिटं शक्य तितके पूर्ण करूया 🔥',
  ],
  [
    'आजचा शेवटचा रिमाइंडर! अभ्यासाचं लक्ष्य अजून %1$d मिनिटांनी बाकी—शक्य तितकं पूर्ण करूया 💪',
    'आजच्या दिवसाची अंतिम हाक: लक्ष्याचे %1$d अभ्यास-मिनिटं बाकी. छोटासा प्रयत्नही मोलाचा 🌟',
    'आज इथेच शेवटचा चेक-इन! शक्य तितकं अभ्यासाचं लक्ष्य पूर्ण करूया 🚀 (%1$d मिनिटं बाकी)',
  ],
] as const;

export const HINDI_REMINDER_MESSAGES = [
  [
    'चैंपियन, आज का स्टडी टारगेट शुरू करें? अभी %1$d मिनट की पढ़ाई बाकी है 💪',
    'नया दिन, नया मौका! बस %1$d मिनट का लक्ष्य पूरा करना है—शानदार शुरुआत करें 🚀',
    'आज की छोटी मेहनत बड़ा फर्क लाएगी। लक्ष्य के %1$d मिनट पूरे करें 🌟',
  ],
  [
    'दोपहर हो गई! टारगेट अभी सो रहा है या आप? %1$d मिनट की पढ़ाई बाकी 😂',
    'मोबाइल को आराम मिल गया, अब दिमाग की बारी! %1$d मिनट पढ़ाई बाकी 😎',
    'एक छोटा स्टडी राउंड हो जाए—लक्ष्य के %1$d मिनट बाकी 📚',
  ],
  [
    'टारगेट से इतनी दोस्ती मत करो! चलिए, %1$d मिनट पढ़ाई और 😂',
    'थोड़ा पढ़ लो, वरना टारगेट रात को सपने में आएगा! %1$d मिनट बाकी 😏',
    'स्क्रॉलिंग रोककर छोटा स्प्रिंट लगाओ—%1$d मिनट की पढ़ाई बाकी 🚀',
  ],
  [
    'शाम हो गई जनाब! बहाने पूरे हों तो लक्ष्य के %1$d मिनट भी पूरे कर लें 😏',
    'आज का काम कल पर डालने का रिकॉर्ड बनाना है क्या? %1$d मिनट बाकी 😂',
    'ब्रेक अच्छा था; अब पढ़ाई का भी एक राउंड हो जाए! %1$d मिनट बाकी ☕',
  ],
  [
    'अब वक्त बर्बाद नहीं! लक्ष्य के %1$d मिनट पूरे करने का समय है 🔥',
    'दिन अभी हाथ में है। चलिए, पढ़ाई के %1$d मिनट पूरे करते हैं 💪',
    'फोकस का छोटा स्प्रिंट शुरू करें—%1$d मिनट की पढ़ाई बाकी ⏳',
  ],
  [
    'वक्त तेजी से निकल रहा है! %1$d मिनट की पढ़ाई बाकी—अब फोकस करें 🔥',
    'लक्ष्य को करीब लाने का समय है। अभी %1$d मिनट पढ़ाई बाकी 💪',
    'चलिए बॉस, अगला स्टडी राउंड शुरू करें! %1$d मिनट बाकी 🚀',
  ],
  [
    'रात होने वाली है और टारगेट अभी भी बाकी? %1$d मिनट पढ़ाई करें 😂',
    'आज टारगेट खत्म करना है या कल भी साथ घुमाना है? %1$d मिनट बाकी 😏',
    'मजाक अपनी जगह—अब पढ़ाई का छोटा राउंड कर लें! %1$d मिनट बाकी 🔥',
  ],
  [
    'सिर्फ घड़ी देखने से काम नहीं चलेगा! लक्ष्य के %1$d मिनट पूरे करने का वक्त है ⏳',
    'दिन खत्म होने से पहले खुद को एक जीत दिला दें—%1$d मिनट बाकी 💪',
    'घड़ी आगे बढ़ रही है; बाकी पढ़ाई अभी पूरी करें 🔥 (%1$d मिनट)',
  ],
  [
    'फाइनल राउंड शुरू! लक्ष्य के %1$d मिनट पूरे करें और आज का दिन जीतें 🔥',
    'आज का टारगेट आज ही! कल वाले खुद पर सारा काम मत डालो 😎 (%1$d मिनट बाकी)',
    'आखिरी दौर में हैं—जितनी पढ़ाई हो सके, पूरी कर लें 💪 अभी %1$d मिनट बाकी',
  ],
  [
    'रात 10 बजे तक सिर्फ %2$d मिनट! पढ़ाई के %1$d मिनट बाकी—जितना हो सके पूरा करें ⏳',
    'आखिरी मौका करीब है: 10 बजे तक %2$d मिनट। लक्ष्य के %1$d मिनट पूरे करें 🚀',
    'काउंटडाउन शुरू! 10 बजे तक %2$d मिनट बाकी; पढ़ाई के %1$d मिनट पूरे करने की कोशिश करें 🔥',
  ],
  [
    'आज का आखिरी रिमाइंडर! स्टडी टारगेट के %1$d मिनट बाकी—जितना हो सके पूरा करें 💪',
    'आज की अंतिम याद दिलाहट: लक्ष्य के %1$d मिनट बाकी। छोटा प्रयास भी मायने रखता है 🌟',
    'आज का आखिरी चेक-इन! पढ़ाई का लक्ष्य जितना हो सके पूरा कर लें 🚀 (%1$d मिनट बाकी)',
  ],
] as const;

export const getNextDailyReminderMinute = (
  currentMinute: number,
  schedule: readonly number[] = DAILY_REMINDER_MINUTES,
): number | null => schedule.find((minute) => minute > currentMinute) ?? null;

/** Returns the latest stage that is valid at this local minute; cutoff is inclusive at 10:00 PM only. */
export const getDailyReminderStageIndex = (
  currentMinute: number,
  schedule: readonly number[] = DAILY_REMINDER_MINUTES,
): number | null => {
  if (!Number.isFinite(currentMinute) || schedule.length === 0) return null;
  if (currentMinute < schedule[0] || currentMinute > schedule[schedule.length - 1]) return null;
  let stageIndex: number | null = null;
  for (let index = 0; index < schedule.length; index += 1) {
    if (schedule[index] > currentMinute) break;
    stageIndex = index;
  }
  return stageIndex;
};

export const getRemainingTargetMinutes = (targetMinutes: number, elapsedSeconds: number): number =>
  Math.max(0, Math.ceil((Math.max(1, targetMinutes) * 60 - Math.max(0, elapsedSeconds)) / 60));

/** Recompute goal completion from current target settings; persisted flags can become stale after a target increase. */
export const isDailyTargetComplete = (targetMinutes: number, elapsedSeconds: number): boolean =>
  Math.max(0, elapsedSeconds) >= Math.max(1, targetMinutes) * 60;

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
  }): Promise<{ synced: boolean; scheduled: boolean }>;
  setUpdateAlerts(options: { enabled: boolean }): Promise<{ configured: boolean; success?: boolean; subscribed?: boolean }>;
  consumeNotificationAction(): Promise<{
    action?: string;
    versionName?: string | null;
    versionCode?: string | null;
    updateManifestUrl?: string | null;
  }>;
  syncHomeWidget(options: {
    targetMinutes: number;
    elapsedSeconds: number;
    dayKey: string;
    currentStreak: number;
  }): Promise<{ synced: boolean }>;
  syncHomeWidgetUpdateStatus(options: {
    installedVersionCode: number;
    installedVersionName: string;
    latestVersionCode: number;
    latestVersionName: string;
  }): Promise<{ synced: boolean }>;
}

const NativeNotifications = registerPlugin<MathMasterNotificationsPlugin>('MathMasterNotifications');
const ENABLED_KEY = 'math-app-background-notifications-enabled-v1';
let listenersStarted = false;
let lastPayloadSignature = '';
let lastUpdateAlertsSetting: boolean | null = null;
let syncQueue: Promise<void> = Promise.resolve();
let updateAlertsSyncPromise: Promise<void> | null = null;
let requestedUpdateAlertsSetting: boolean | null = null;
let lastPersistedSyncAt = 0;
let lastWidgetPayloadSignature = '';
let widgetSyncQueue: Promise<void> = Promise.resolve();

const queueHomeWidgetSync = (force = false): void => {
  if (!Capacitor.isNativePlatform()) return;
  const streak = getStreak();
  const date = todayStr();
  const record = streak.days[date];
  const elapsedSeconds = Math.max(0, Math.floor(record?.seconds ?? 0));
  const payload = {
    targetMinutes: Math.max(1, Math.floor(streak.targetMinutes)),
    elapsedSeconds,
    dayKey: date,
    currentStreak: Math.max(0, Math.floor(streak.current)),
  };
  // The widget only displays whole study minutes. Keep sending the freshest
  // seconds at each minute boundary instead of invoking the Android bridge
  // on every one-second persistence tick.
  const signature = JSON.stringify({
    ...payload,
    elapsedSeconds: Math.floor(elapsedSeconds / 60) * 60,
  });
  if (!force && signature === lastWidgetPayloadSignature) return;
  lastWidgetPayloadSignature = signature;
  widgetSyncQueue = widgetSyncQueue
    .catch(() => undefined)
    .then(async () => {
      const result = await NativeNotifications.syncHomeWidget(payload);
      if (result.synced !== true) throw new Error('Native home widget did not confirm its state update.');
    })
    .catch(() => {
      lastWidgetPayloadSignature = '';
    });
};

export const syncHomeWidgetUpdateStatus = async (status: {
  installedVersionCode: number;
  installedVersionName: string;
  latestVersionCode: number;
  latestVersionName: string;
}): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await NativeNotifications.syncHomeWidgetUpdateStatus(status);
    return result.synced === true;
  } catch {
    // Home-screen presentation is auxiliary and must never interrupt update checks.
    return false;
  }
};

const queueUpdateAlertsSync = (): void => {
  requestedUpdateAlertsSetting = getBackgroundNotificationsEnabled();
  if (updateAlertsSyncPromise) return;

  updateAlertsSyncPromise = (async () => {
    while (requestedUpdateAlertsSetting !== null) {
      const desired = requestedUpdateAlertsSetting;
      requestedUpdateAlertsSetting = null;
      if (lastUpdateAlertsSetting === desired) continue;

      try {
        const result = await NativeNotifications.setUpdateAlerts({ enabled: desired });
        if (!result.configured) {
          // A Firebase-free build still supports local reminders. Do not keep
          // retrying an integration that is not present in this installed APK.
          console.info('Background notifications: FCM update alerts are not configured on this build.');
          lastUpdateAlertsSetting = desired;
        } else if (result.success !== true || result.subscribed !== desired) {
          console.warn('Background notifications: FCM topic subscription was not confirmed; it will be retried on the next sync.');
          lastUpdateAlertsSetting = null;
        } else {
          lastUpdateAlertsSetting = desired;
        }
      } catch {
        console.warn('Background notifications: unable to synchronize FCM update-topic preference.');
        lastUpdateAlertsSetting = null;
      }

      // If the user toggled the preference while Firebase was working, apply
      // the newest choice after the in-flight operation completes.
      if (getBackgroundNotificationsEnabled() !== desired) {
        requestedUpdateAlertsSetting = getBackgroundNotificationsEnabled();
      }
    }
  })().finally(() => {
    updateAlertsSyncPromise = null;
    if (requestedUpdateAlertsSetting !== null) queueUpdateAlertsSync();
  });
};

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
  const completed = isDailyTargetComplete(streak.targetMinutes, elapsedSeconds);

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

const queueNativeSync = (force = false): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(false);

  const backgroundEnabled = getBackgroundNotificationsEnabled();
  const state = getNativeState(backgroundEnabled);
  const signature = JSON.stringify(state);
  if (!force && signature === lastPayloadSignature) return syncQueue.then(() => true);
  lastPayloadSignature = signature;

  let succeeded = false;
  syncQueue = syncQueue
    .catch(() => undefined)
    .then(async () => {
      const syncResult = await NativeNotifications.syncDailyTarget(state);
      if (syncResult.synced !== true) {
        throw new Error('Native daily reminder scheduler did not confirm the requested state.');
      }
      // Keep local alarm scheduling independent of FCM/network latency.
      // Push topic changes are serialized separately and can retry on a later
      // progress sync or app resume without blocking the study reminder toggle.
      queueUpdateAlertsSync();
      succeeded = true;
    })
    .catch(() => {
      // A native bridge failure must not crash the web app. A later startup,
      // resume, target change, or progress update retries synchronization.
      lastPayloadSignature = '';
    });
  return syncQueue.then(() => succeeded);
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

  const synchronized = await queueNativeSync(true);
  if (synchronized) {
    window.dispatchEvent(new CustomEvent('background-notifications-updated', { detail: { enabled } }));
    return true;
  }

  // Revert the opt-in preference if the native permission/scheduling bridge
  // failed; the UI must not claim reminders were enabled when no alarm exists.
  try { localStorage.setItem(ENABLED_KEY, enabled ? '0' : '1'); } catch { /* Storage may be unavailable. */ }
  lastPayloadSignature = '';
  lastUpdateAlertsSetting = null;
  window.dispatchEvent(new CustomEvent('background-notifications-updated', {
    detail: { enabled: !enabled },
  }));
  return false;
};

/** Start one app-wide sync loop; the Android native alarm survives app closure/reboot. */
export const initializeBackgroundNotifications = (): (() => void) => {
  if (listenersStarted || typeof window === 'undefined') return () => undefined;
  listenersStarted = true;

  let lastPersistedDayKey = todayStr();
  let lastMinuteBucket = -1;

  const onProgressPersisted = () => {
    queueHomeWidgetSync();
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
  const onStreakUpdated = () => {
    queueHomeWidgetSync(true);
    void queueNativeSync(true);
  };
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
    queueHomeWidgetSync(true);
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
  queueHomeWidgetSync(true);
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
    window.removeEventListener('focus', onResume);
    window.removeEventListener('online', onResume);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisibility);
  };
};
