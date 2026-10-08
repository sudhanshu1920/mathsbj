import { supabase } from '@/integrations/supabase/client';

const KEYS = {
  progress: 'math-app-progress',
  analytics: 'math-app-analytics-v1',
  streak: 'math-app-streak-v1',
  xp: 'math-app-xp-v1',
} as const;

const META_KEY = 'math-app-sync-meta-v1';

type Meta = { lastPushAt?: number; lastPulledAt?: string; userId?: string };

const readJSON = (k: string) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
};
const writeJSON = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
};

const getMeta = (): Meta => readJSON(META_KEY) || {};
const setMeta = (m: Meta) => writeJSON(META_KEY, m);

const dispatchUpdated = () => {
  window.dispatchEvent(new CustomEvent('analytics-updated'));
  window.dispatchEvent(new CustomEvent('streak-updated'));
  window.dispatchEvent(new CustomEvent('xp-updated'));
};

let pushTimer: number | undefined;
let pushTimerUserId: string | undefined;
let syncing = false;

const setSyncing = (v: boolean) => {
  syncing = v;
  window.dispatchEvent(new CustomEvent('sync-state', { detail: { syncing: v } }));
};
export const isSyncing = () => syncing;

export async function pullFromCloud(userId: string, canApply?: () => boolean): Promise<void> {
  if (!supabase || !navigator.onLine) return;
  setSyncing(true);
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('progress, analytics, streak, xp, client_updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return;

    if (canApply && !canApply()) return;

    const localMeta = getMeta();
    const remoteTs = data.client_updated_at ? new Date(data.client_updated_at).getTime() : 0;
    const localTs = localMeta.lastPushAt || 0;

    // If switching users, always overwrite local with remote.
    const switchedUser = localMeta.userId && localMeta.userId !== userId;

    if (switchedUser || remoteTs >= localTs) {
      if (canApply && !canApply()) return;

      // A new account must never inherit the previous account's local data,
      // including when the remote record is empty or partially populated.
      if (switchedUser) {
        writeJSON(KEYS.progress, data.progress ?? {});
        writeJSON(KEYS.analytics, data.analytics ?? {});
        writeJSON(KEYS.streak, data.streak ?? {});
        writeJSON(KEYS.xp, data.xp ?? {});
      } else {
        if (data.progress && Object.keys(data.progress as object).length) writeJSON(KEYS.progress, data.progress);
        if (data.analytics && Object.keys(data.analytics as object).length) writeJSON(KEYS.analytics, data.analytics);
        if (data.streak && Object.keys(data.streak as object).length) writeJSON(KEYS.streak, data.streak);
        if (data.xp && Object.keys(data.xp as object).length) writeJSON(KEYS.xp, data.xp);
      }

      setMeta({ ...localMeta, userId, lastPulledAt: new Date().toISOString(), lastPushAt: remoteTs });
      dispatchUpdated();
    } else {
      setMeta({ ...localMeta, userId });
    }
  } catch (e) {
    console.warn('[sync] pull failed', e);
  } finally {
    setSyncing(false);
  }
}

export async function pushToCloud(userId: string): Promise<void> {
  if (!supabase || !navigator.onLine) return;
  setSyncing(true);
  try {
    const payload = {
      user_id: userId,
      progress: readJSON(KEYS.progress) || {},
      analytics: readJSON(KEYS.analytics) || {},
      streak: readJSON(KEYS.streak) || {},
      xp: readJSON(KEYS.xp) || {},
      client_updated_at: new Date().toISOString(),
    };
    // xp column may not exist in remote schema — server-ignore unknown gracefully
    const { error } = await supabase.from('user_data').upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
    setMeta({ ...getMeta(), userId, lastPushAt: Date.now() });
  } catch (e) {
    console.warn('[sync] push failed', e);
  } finally {
    setSyncing(false);
  }
}

export function schedulePush(userId: string, delayMs = 1500) {
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimerUserId = userId;
  pushTimer = window.setTimeout(() => {
    pushTimer = undefined;
    pushTimerUserId = undefined;
    void pushToCloud(userId);
  }, delayMs);
}

export function clearLocalUserData() {
  // All synced state is account-scoped. Clear every synced key on sign-out so
  // a later account cannot inherit or upload the previous account's data.
  localStorage.removeItem(KEYS.progress);
  localStorage.removeItem(KEYS.analytics);
  localStorage.removeItem(KEYS.streak);
  localStorage.removeItem(KEYS.xp);
  localStorage.removeItem(META_KEY);
  if (pushTimer) {
    window.clearTimeout(pushTimer);
    pushTimer = undefined;
    pushTimerUserId = undefined;
  }
  dispatchUpdated();
}

/** Initialize sync listeners for a signed-in user. Returns a cleanup fn. */
export function startSync(userId: string): () => void {
  if (!supabase) return () => {};

  let disposed = false;
  const isCurrent = () => !disposed;

  // Do not push a user's local snapshot until that user's cloud state has been
  // safely pulled. The guard prevents a late pull from an old account from
  // overwriting a newly signed-in user's local data after navigation/sign-out.
  void pullFromCloud(userId, isCurrent).then(() => {
    if (!disposed) void pushToCloud(userId);
  });

  const onLocalChange = () => {
    if (!disposed) schedulePush(userId);
  };
  const onOnline = () => {
    if (!disposed) void pushToCloud(userId);
  };

  window.addEventListener('analytics-updated', onLocalChange);
  window.addEventListener('streak-updated', onLocalChange);
  window.addEventListener('xp-updated', onLocalChange);
  window.addEventListener('online', onOnline);

  // Periodic safety push
  const interval = window.setInterval(() => {
    if (!disposed && navigator.onLine) void pushToCloud(userId);
  }, 60_000);

  return () => {
    disposed = true;
    window.removeEventListener('analytics-updated', onLocalChange);
    window.removeEventListener('streak-updated', onLocalChange);
    window.removeEventListener('xp-updated', onLocalChange);
    window.removeEventListener('online', onOnline);
    window.clearInterval(interval);
    if (pushTimer && pushTimerUserId === userId) {
      window.clearTimeout(pushTimer);
      pushTimer = undefined;
      pushTimerUserId = undefined;
    }
  };
}