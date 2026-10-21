import { APP_VERSION_NAME } from '@/lib/appVersion';

export const BACKUP_FORMAT = 'MathMasterBackup';
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_DATA_SCHEMA_VERSION = 1;
export const LAST_BACKUP_STORAGE_KEY = 'math-app-backup-last-v1';
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
const MAX_BACKUP_ENTRIES = 2_000;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const SENSITIVE_OR_TRANSIENT_KEY = /(auth|token|secret|password|credential|session|supabase|firebase|sync-meta|backup-last|cache|temporary|offline-ready)/i;
const PORTABLE_PREFERENCE_KEYS = new Set(['tables-pro-mode', 'desktop-mode', 'font-scale']);
const JSON_OBJECT_STORAGE_KEYS = new Set(['math-app-settings-v1','math-app-streak-v1','math-app-analytics-v1','math-app-progress','math-app-xp-v1','math-app-study-tracker-v1']);
const SCALAR_STORAGE_VALUES: Record<string, (value: string) => boolean> = {
  'math-app-theme-v5': (value) => ['arctic-blue','deep-space','titanium-silver','midnight-violet','sapphire','ocean-cyan','emerald-glass','aurora','soft-rose','sunset-gold','graphite','pearl-white','indigo','forest','mint','professional-slate','dark-gaming','light-minimal','midnight-blue','golden-premium','cyber-purple','blood-fire','matrix-green','rose-sakura','arctic-ice','void-black'].includes(value),
  'math-app-mode-v1': (value) => value === 'light' || value === 'dark',
  'math-app-background-notifications-enabled-v1': (value) => value === '0' || value === '1',
  'tables-pro-mode': (value) => value === '0' || value === '1',
  'desktop-mode': (value) => value === '0' || value === '1',
  'font-scale': (value) => Number.isFinite(Number(value)) && Number(value) >= 0.8 && Number(value) <= 1.5,
};
const WIDGET_GLOBAL_STRING_KEYS = new Set([
  'contentJson', 'style', 'composition', 'theme', 'mode', 'appAccentColor', 'accentColor',
]);
const WIDGET_GLOBAL_BOOLEAN_KEYS = new Set(['enabled']);
const WIDGET_INSTANCE_STRING_KEYS = new Set([
  'contentJson', 'style', 'composition', 'themeMode', 'theme',
]);
const WIDGET_INSTANCE_NUMBER_KEYS = new Set(['contentSchemaVersion']);
const WIDGET_CONTENT_OPTIONS = new Set([
  'appIdentity', 'target', 'progress', 'remaining', 'studyTime', 'streak', 'weekly', 'updateStatus',
]);
const WIDGET_COMPOSITIONS = new Set([
  'auto', 'hero_wide', 'compact_green', 'square_math_bot', 'medium_study',
  'square_cosmic', 'extra_wide_weekly', 'minimal_progress',
]);
const WIDGET_THEMES = new Set(['app', 'emerald', 'ocean', 'graphite', 'rose', 'violet', 'sapphire', 'aurora']);
const WIDGET_THEME_MODES = new Set([...WIDGET_THEMES, 'random']);
const WIDGET_STYLES = new Set(['glass', 'compact', 'minimal']);

export type WidgetPreferenceSnapshot = {
  version: 1;
  global: Record<string, string | number | boolean>;
  instances: Array<{ widgetId: number; preferences: Record<string, string | number | boolean> }>;
};

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  backupFormatVersion: typeof BACKUP_FORMAT_VERSION;
  appVersion: string;
  createdAt: string;
  dataSchemaVersion: number;
  payload: {
    storage: Record<string, string>;
    native: { widgetPreferences: WidgetPreferenceSnapshot | null };
  };
  checksum: { algorithm: 'SHA-256'; value: string };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const utf8Size = (value: string): number => new TextEncoder().encode(value).byteLength;

export function isBackupStorageKey(key: string): boolean {
  if (typeof key !== 'string' || !key || SENSITIVE_OR_TRANSIENT_KEY.test(key)) return false;
  if (key === 'math-app-guest-v1') return false;
  return key.startsWith('math-app-') || PORTABLE_PREFERENCE_KEYS.has(key);
}

/** Captures all portable app-owned localStorage records in one synchronous pass. */
export function captureBackupStorageSnapshot(storage: Storage = localStorage): Record<string, string> {
  const snapshot: Record<string, string> = Object.create(null) as Record<string, string>;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isBackupStorageKey(key)) keys.push(key);
  }
  keys.sort();
  if (keys.length > MAX_BACKUP_ENTRIES) throw new Error('Too many saved app records to back up safely.');
  let totalBytes = 0;
  for (const key of keys) {
    const value = storage.getItem(key);
    if (value === null) continue;
    const entryBytes = utf8Size(value);
    if (entryBytes > MAX_ENTRY_BYTES) throw new Error('A saved record is too large to export: ' + key);
    totalBytes += utf8Size(key) + entryBytes;
    if (totalBytes > MAX_BACKUP_BYTES) throw new Error('App data exceeds the supported 64 MB backup limit.');
    snapshot[key] = value;
  }
  return snapshot;
}

function stableValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Backup contains a non-finite number.');
    return value;
  }
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) throw new Error('Backup contains unsupported data.');
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) throw new Error('Backup contains undefined data.');
    result[key] = stableValue(value[key]);
  }
  return result;
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure SHA-256 verification is unavailable on this device.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validateWidgetString(field: string, value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 8192) return false;
  if (field === 'contentJson') {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length <= WIDGET_CONTENT_OPTIONS.size
        && parsed.every((entry) => typeof entry === 'string' && WIDGET_CONTENT_OPTIONS.has(entry))
        && new Set(parsed).size === parsed.length;
    } catch {
      return false;
    }
  }
  if (field === 'style') return WIDGET_STYLES.has(value);
  if (field === 'composition') return WIDGET_COMPOSITIONS.has(value);
  if (field === 'theme') return WIDGET_THEMES.has(value);
  if (field === 'themeMode') return WIDGET_THEME_MODES.has(value);
  if (field === 'mode') return value === 'dark' || value === 'light';
  if (field === 'appAccentColor' || field === 'accentColor') return /^#[0-9a-f]{6}$/i.test(value);
  return false;
}

function validateWidgetPreferences(value: unknown): WidgetPreferenceSnapshot | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.global) || !Array.isArray(value.instances)) {
    throw new Error('The backup contains invalid widget preferences.');
  }
  if (Object.keys(value.global).length > 32 || value.instances.length > 100) {
    throw new Error('The backup contains too many widget preferences.');
  }
  const global: Record<string, string | number | boolean> = Object.create(null) as Record<string, string | number | boolean>;
  for (const [key, item] of Object.entries(value.global)) {
    if (WIDGET_GLOBAL_BOOLEAN_KEYS.has(key)) {
      if (typeof item !== 'boolean') throw new Error('Invalid widget preference: ' + key);
    } else if (WIDGET_GLOBAL_STRING_KEYS.has(key)) {
      if (key === 'contentJson' || key === 'style' || key === 'composition' || key === 'theme' || key === 'mode') {
        if (!validateWidgetString(key, item)) throw new Error('Invalid widget preference: ' + key);
      } else if (typeof item !== 'string' || item.length > 128 || !/^#[0-9a-f]{6}$/i.test(item)) {
        throw new Error('Invalid widget preference: ' + key);
      }
    } else {
      throw new Error('Unsupported widget preference: ' + key);
    }
    global[key] = item as string | number | boolean;
  }

  const seenIds = new Set<number>();
  const instances = value.instances.map((entry) => {
    if (!isRecord(entry) || !Number.isSafeInteger(entry.widgetId) || (entry.widgetId as number) < 0 ||
        !isRecord(entry.preferences)) {
      throw new Error('The backup contains an invalid widget instance.');
    }
    const widgetId = entry.widgetId as number;
    if (seenIds.has(widgetId) || Object.keys(entry.preferences).length > 16) {
      throw new Error('The backup contains duplicate or excessive widget instances.');
    }
    seenIds.add(widgetId);
    const preferences: Record<string, string | number | boolean> = Object.create(null) as Record<string, string | number | boolean>;
    for (const [field, item] of Object.entries(entry.preferences)) {
      if (WIDGET_INSTANCE_STRING_KEYS.has(field)) {
        if (!validateWidgetString(field, item)) throw new Error('Invalid widget instance preference: ' + field);
      } else if (WIDGET_INSTANCE_NUMBER_KEYS.has(field)) {
        if (typeof item !== 'number' || !Number.isInteger(item) || item < 1 || item > 2) {
          throw new Error('Invalid widget instance preference: ' + field);
        }
      } else {
        throw new Error('Unsupported widget instance preference: ' + field);
      }
      preferences[field] = item as string | number | boolean;
    }
    return { widgetId, preferences };
  });
  return { version: 1, global, instances };
}

function validateStoragePayload(value: unknown): Record<string, string> {
  if (!isRecord(value)) throw new Error('The backup is missing its saved app data.');
  const keys = Object.keys(value);
  if (keys.length > MAX_BACKUP_ENTRIES) throw new Error('The backup contains too many saved records.');
  const storage: Record<string, string> = Object.create(null) as Record<string, string>;
  let totalBytes = 0;
  for (const key of keys.sort()) {
    const item = value[key];
    if (!isBackupStorageKey(key) || typeof item !== 'string') {
      throw new Error('The backup contains an unsupported or unsafe storage record.');
    }
    if (JSON_OBJECT_STORAGE_KEYS.has(key)) {
      let saved: unknown;
      try { saved = JSON.parse(item); } catch { throw new Error('A saved app record is not valid JSON: ' + key); }
      if (!isRecord(saved)) throw new Error('A saved app record has an invalid structure: ' + key);
      if (key === 'math-app-settings-v1') {
        for (const field of ['sound','vibration','keyboardShortcuts']) {
          if (field in saved && typeof saved[field] !== 'boolean') throw new Error('Invalid setting: ' + field);
        }
        if ('font' in saved && !['inter','space-grotesk','nunito','rajdhani'].includes(String(saved.font))) throw new Error('Invalid saved font preference.');
      }
      if (key === 'math-app-study-tracker-v1' && saved.version === 3) {
        if (!Array.isArray(saved.subjects) || !Array.isArray(saved.subjectHistory) || !isRecord(saved.entries) || !isRecord(saved.preferences)) {
          throw new Error('Study Tracker data is incomplete.');
        }
        const subjectIds = new Set<string>();
        for (const subject of saved.subjects) {
          if (!isRecord(subject) || typeof subject.id !== 'string' || !subject.id || subjectIds.has(subject.id) ||
              typeof subject.name !== 'string' || !subject.name.trim() || !Number.isFinite(subject.order)) {
            throw new Error('Study Tracker has an invalid or duplicate subject.');
          }
          subjectIds.add(subject.id);
        }
        const historyDates = new Set<string>();
        const historicalIds = new Set(subjectIds);
        for (const snapshot of saved.subjectHistory) {
          if (!isRecord(snapshot) || typeof snapshot.effectiveDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.effectiveDate) ||
              !Array.isArray(snapshot.subjects) || historyDates.has(snapshot.effectiveDate)) {
            throw new Error('Study Tracker subject history is invalid.');
          }
          historyDates.add(snapshot.effectiveDate);
          const snapshotIds = new Set<string>();
          for (const subject of snapshot.subjects) {
            if (!isRecord(subject) || typeof subject.id !== 'string' || !subject.id || snapshotIds.has(subject.id) ||
                typeof subject.name !== 'string' || !subject.name.trim() || !Number.isFinite(subject.order)) {
              throw new Error('Study Tracker subject history contains invalid subjects.');
            }
            snapshotIds.add(subject.id);
            historicalIds.add(subject.id);
          }
        }
        for (const [entryKey, entry] of Object.entries(saved.entries)) {
          if (!isRecord(entry) || typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
              typeof entry.subjectId !== 'string' || !historicalIds.has(entry.subjectId) ||
              !['not-started','in-progress','completed'].includes(String(entry.status)) ||
              !Number.isFinite(entry.minutes) || (entry.minutes as number) < 0 || typeof entry.note !== 'string' ||
              entryKey !== entry.date + '|' + entry.subjectId) {
            throw new Error('Study Tracker contains an invalid daily entry.');
          }
        }
        if (!['table','week','month'].includes(String(saved.preferences.mode))) throw new Error('Study Tracker view preference is invalid.');
      }
    }
    const scalarValidator = SCALAR_STORAGE_VALUES[key];
    if (scalarValidator && !scalarValidator(item)) throw new Error('A saved preference has an invalid value: ' + key);
    const keyBytes = utf8Size(key);
    const itemBytes = utf8Size(item);
    if (itemBytes > MAX_ENTRY_BYTES) throw new Error('A saved record is too large: ' + key);
    totalBytes += keyBytes + itemBytes;
    if (totalBytes > MAX_BACKUP_BYTES) throw new Error('The backup app data exceeds 64 MB.');
    storage[key] = item;
  }
  return storage;
}

export async function createBackupText(options: {
  storageEntries?: Record<string, string>;
  widgetPreferences?: unknown;
  createdAt?: Date;
  appVersion?: string;
} = {}): Promise<string> {
  const storage = validateStoragePayload(options.storageEntries ?? captureBackupStorageSnapshot());
  const widgetPreferences = validateWidgetPreferences(options.widgetPreferences ?? null);
  const createdAt = options.createdAt ?? new Date();
  if (!Number.isFinite(createdAt.getTime())) throw new Error('The backup timestamp is invalid.');

  const unsigned = {
    format: BACKUP_FORMAT,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    appVersion: options.appVersion ?? APP_VERSION_NAME,
    createdAt: createdAt.toISOString(),
    dataSchemaVersion: BACKUP_DATA_SCHEMA_VERSION,
    payload: { storage, native: { widgetPreferences } },
  };
  const checksum = await sha256Hex(stableSerialize(unsigned));
  const envelope: BackupEnvelope = {
    ...unsigned,
    format: BACKUP_FORMAT,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    checksum: { algorithm: 'SHA-256', value: checksum },
  };
  const text = stableSerialize(envelope);
  if (utf8Size(text) > MAX_BACKUP_BYTES) throw new Error('The backup exceeds the supported 64 MB limit.');
  return text;
}

export async function validateBackupText(text: string): Promise<BackupEnvelope> {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The selected file is empty.');
  if (utf8Size(text) > MAX_BACKUP_BYTES) throw new Error('The selected backup exceeds the supported 64 MB limit.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid Math Master backup.');
  }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new Error('This is not a supported Math Master backup file.');
  }
  if (!Number.isInteger(parsed.backupFormatVersion)) throw new Error('The backup format version is invalid.');
  if ((parsed.backupFormatVersion as number) > BACKUP_FORMAT_VERSION) {
    throw new Error('This backup was created by a newer app version. Update the app before restoring it.');
  }
  if (parsed.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error('This older backup format is not supported by this app.');
  }
  if (!Number.isInteger(parsed.dataSchemaVersion) || (parsed.dataSchemaVersion as number) < 1) {
    throw new Error('The backup data schema version is invalid.');
  }
  if ((parsed.dataSchemaVersion as number) > BACKUP_DATA_SCHEMA_VERSION) {
    throw new Error('This backup contains a newer data schema. Update the app before restoring it.');
  }
  if (typeof parsed.appVersion !== 'string' || parsed.appVersion.length > 64 ||
      typeof parsed.createdAt !== 'string' || !Number.isFinite(Date.parse(parsed.createdAt)) ||
      !isRecord(parsed.checksum) || parsed.checksum.algorithm !== 'SHA-256' ||
      typeof parsed.checksum.value !== 'string' || !/^[a-f0-9]{64}$/i.test(parsed.checksum.value) ||
      !isRecord(parsed.payload)) {
    throw new Error('The backup manifest is incomplete or invalid.');
  }
  const allowedKeys = ['appVersion', 'backupFormatVersion', 'checksum', 'createdAt', 'dataSchemaVersion', 'format', 'payload'];
  if (Object.keys(parsed).sort().join('|') !== allowedKeys.sort().join('|')) {
    throw new Error('The backup manifest contains unsupported fields.');
  }
  if (Object.keys(parsed.payload).sort().join('|') !== 'native|storage' ||
      !isRecord(parsed.payload.native) ||
      Object.keys(parsed.payload.native).join('|') !== 'widgetPreferences') {
    throw new Error('The backup payload structure is unsupported.');
  }
  const storage = validateStoragePayload(parsed.payload.storage);
  const widgetPreferences = validateWidgetPreferences(parsed.payload.native.widgetPreferences);
  const unsigned = {
    format: parsed.format,
    backupFormatVersion: parsed.backupFormatVersion,
    appVersion: parsed.appVersion,
    createdAt: parsed.createdAt,
    dataSchemaVersion: parsed.dataSchemaVersion as number,
    payload: { storage, native: { widgetPreferences } },
  };
  const actual = await sha256Hex(stableSerialize(unsigned));
  if (actual.toLowerCase() !== parsed.checksum.value.toLowerCase()) {
    throw new Error('Backup integrity check failed. The file may be damaged or modified.');
  }
  return {
    ...unsigned,
    format: BACKUP_FORMAT,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    checksum: { algorithm: 'SHA-256', value: actual },
  };
}

export function replaceBackupStorageSnapshot(
  nextSnapshot: Record<string, string>,
  storage: Storage = localStorage,
): Record<string, string> {
  const next = validateStoragePayload(nextSnapshot);
  const previous = captureBackupStorageSnapshot(storage);
  const apply = (snapshot: Record<string, string>) => {
    const currentManagedKeys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && isBackupStorageKey(key)) currentManagedKeys.push(key);
    }
    for (const key of currentManagedKeys) storage.removeItem(key);
    for (const key of Object.keys(snapshot).sort()) storage.setItem(key, snapshot[key]);
    for (const key of Object.keys(snapshot)) {
      if (storage.getItem(key) !== snapshot[key]) throw new Error('Could not verify restored record: ' + key);
    }
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && isBackupStorageKey(key) && !Object.prototype.hasOwnProperty.call(snapshot, key)) {
        throw new Error('An unexpected managed record remains after restore: ' + key);
      }
    }
  };
  try {
    apply(next);
  } catch (error) {
    try {
      apply(previous);
    } catch {
      throw new Error('Restore failed and automatic rollback could not be completed. Do not close the app; storage may be unavailable.');
    }
    const reason = error instanceof Error ? error.message : 'Storage write failed';
    throw new Error('Restore failed; previous app data was restored. ' + reason);
  }
  return previous;
}

export function refreshAppAfterRestore(): void {
  window.dispatchEvent(new CustomEvent('backup-restore-complete'));
  window.dispatchEvent(new CustomEvent('settings-updated'));
  window.dispatchEvent(new CustomEvent('streak-persisted'));
  window.dispatchEvent(new CustomEvent('streak-updated'));
  window.dispatchEvent(new CustomEvent('analytics-updated'));
  window.dispatchEvent(new CustomEvent('xp-updated'));
  window.dispatchEvent(new CustomEvent('background-notifications-updated'));
  window.dispatchEvent(new CustomEvent('study-tracker-updated'));
  for (const key of ['math-app-study-tracker-v1','math-app-settings-v1','math-app-streak-v1','math-app-theme-v5','math-app-mode-v1','tables-pro-mode']) {
    window.dispatchEvent(new StorageEvent('storage', { key }));
  }
  document.documentElement.classList.toggle('desktop-mode', localStorage.getItem('desktop-mode') === '1');
  const storedScale = Number(localStorage.getItem('font-scale') ?? '1');
  const fontScale = Number.isFinite(storedScale) ? Math.min(1.5, Math.max(0.8, storedScale)) : 1;
  document.documentElement.style.setProperty('--font-scale', String(fontScale));
}
