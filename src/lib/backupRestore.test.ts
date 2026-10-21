import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureBackupStorageSnapshot,
  createBackupText,
  replaceBackupStorageSnapshot,
  stableSerialize,
  validateBackupText,
} from './backupRestore';

type EditableEnvelope = {
  backupFormatVersion: number;
  dataSchemaVersion: number;
  payload: { storage: Record<string, string> };
  [key: string]: unknown;
};

const widgetPreferences = {
  version: 1,
  global: { enabled: true, composition: 'auto' },
  instances: [{
    widgetId: 18,
    preferences: {
      contentJson: '["target","progress"]',
      contentSchemaVersion: 2,
      style: 'glass',
      composition: 'hero_wide',
      themeMode: 'random',
      theme: 'violet',
    },
  }],
};

beforeEach(() => {
  vi.stubGlobal('crypto', {
    subtle: {
      digest: vi.fn(async (_algorithm: AlgorithmIdentifier, input: BufferSource) => {
        const bytes = input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        const digest = createHash('sha256').update(Buffer.from(bytes)).digest();
        return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength) as ArrayBuffer;
      }),
    },
  });
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('portable Math Master backup', () => {
  it('captures app-owned records while excluding credentials, account mode and regenerable flags', () => {
    localStorage.setItem('math-app-settings-v1', JSON.stringify({ sound: false, vibration: true }));
    localStorage.setItem('math-app-theme-v5', 'forest');
    localStorage.setItem('math-app-study-tracker-v1', JSON.stringify({
      version: 3, subjects: [{ id: 'custom-1', name: 'English' }],
      entries: { '2026-10-20|custom-1': { minutes: 45 } },
    }));
    localStorage.setItem('math-app-auth-token', 'secret');
    localStorage.setItem('math-app-sync-meta-v1', JSON.stringify({ userId: 'account-id' }));
    localStorage.setItem('math-app-guest-v1', '1');
    localStorage.setItem('offline-ready-v1', '1');
    localStorage.setItem('font-scale', '1.2');

    const snapshot = captureBackupStorageSnapshot();
    expect(snapshot['math-app-settings-v1']).toContain('"sound":false');
    expect(snapshot['math-app-theme-v5']).toBe('forest');
    expect(snapshot['math-app-study-tracker-v1']).toContain('custom-1');
    expect(snapshot['font-scale']).toBe('1.2');
    expect(snapshot).not.toHaveProperty('math-app-auth-token');
    expect(snapshot).not.toHaveProperty('math-app-sync-meta-v1');
    expect(snapshot).not.toHaveProperty('math-app-guest-v1');
    expect(snapshot).not.toHaveProperty('offline-ready-v1');
  });

  it('produces deterministic versioned data and verifies its SHA-256 checksum', async () => {
    const storageEntries = {
      'math-app-settings-v1': JSON.stringify({ sound: false, vibration: true }),
      'math-app-streak-v1': JSON.stringify({ targetMinutes: 30, days: { '2026-10-21': { seconds: 1200 } } }),
      'math-app-study-tracker-v1': JSON.stringify({
        version: 3,
        subjects: [{ id: 'builtin-math', name: 'Math', order: 0 }],
        subjectHistory: [{ effectiveDate: '0001-01-01', subjects: [{ id: 'builtin-math', name: 'Math', order: 0, archived: false }] }],
        entries: { '2026-10-21|builtin-math': { date: '2026-10-21', subjectId: 'builtin-math', status: 'completed', minutes: 35, note: 'Revision', updatedAt: '2026-10-21T07:00:00.000Z' } },
        preferences: { mode: 'month', anchorDate: '2026-10-21', templateStartDate: '2026-10-20', templateEndDate: '2026-12-31' },
      }),
    };
    const fixedDate = new Date('2026-10-21T08:30:00.000Z');
    const first = await createBackupText({ storageEntries, widgetPreferences, createdAt: fixedDate, appVersion: '1.2.3' });
    const second = await createBackupText({ storageEntries, widgetPreferences, createdAt: fixedDate, appVersion: '1.2.3' });
    expect(first).toBe(second);

    const validated = await validateBackupText(first);
    expect(validated.format).toBe('MathMasterBackup');
    expect(validated.backupFormatVersion).toBe(1);
    expect(validated.dataSchemaVersion).toBe(1);
    expect(validated.payload.storage['math-app-streak-v1']).toContain('targetMinutes');
    expect(validated.payload.native.widgetPreferences?.instances[0].preferences.themeMode).toBe('random');
    expect(validated.checksum.algorithm).toBe('SHA-256');
    expect(stableSerialize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('rejects checksum corruption, future versions and malformed persisted records', async () => {
    const source = await createBackupText({
      storageEntries: { 'math-app-settings-v1': JSON.stringify({ sound: true }) },
      createdAt: new Date('2026-10-21T08:30:00.000Z'),
    });
    const corrupt = JSON.parse(source) as EditableEnvelope;
    corrupt.payload.storage['math-app-settings-v1'] = JSON.stringify({ sound: false });
    await expect(validateBackupText(JSON.stringify(corrupt))).rejects.toThrow(/integrity/i);

    const future = JSON.parse(source) as EditableEnvelope;
    future.backupFormatVersion = 99;
    await expect(validateBackupText(JSON.stringify(future))).rejects.toThrow(/newer app version/i);

    const futureSchema = JSON.parse(source) as EditableEnvelope;
    futureSchema.dataSchemaVersion = 99;
    await expect(validateBackupText(JSON.stringify(futureSchema))).rejects.toThrow(/newer data schema/i);

    await expect(createBackupText({
      storageEntries: { 'math-app-streak-v1': '{broken json' },
    })).rejects.toThrow(/valid JSON/i);
  });

  it('validates date-wise Study Tracker entry uniqueness and schema integrity', async () => {
    await expect(createBackupText({
      storageEntries: {
        'math-app-study-tracker-v1': JSON.stringify({
          version: 3,
          subjects: [{ id: 's1', name: 'Math', order: 0 }, { id: 's1', name: 'English', order: 1 }],
          subjectHistory: [],
          entries: {},
          preferences: { mode: 'table' },
        }),
      },
    })).rejects.toThrow(/invalid or duplicate subject/i);
  });

  it('replaces only portable records and preserves credentials and unrelated storage', () => {
    localStorage.setItem('math-app-settings-v1', JSON.stringify({ sound: true }));
    localStorage.setItem('math-app-streak-v1', JSON.stringify({ targetMinutes: 5 }));
    localStorage.setItem('math-app-auth-token', 'leave-in-place');
    localStorage.setItem('third-party-widget-cache', 'untouched');

    replaceBackupStorageSnapshot({
      'math-app-settings-v1': JSON.stringify({ sound: false }),
      'math-app-study-tracker-v1': JSON.stringify({ version: 1, entries: {} }),
    });

    expect(localStorage.getItem('math-app-settings-v1')).toBe('{"sound":false}');
    expect(localStorage.getItem('math-app-streak-v1')).toBeNull();
    expect(localStorage.getItem('math-app-study-tracker-v1')).toBe('{"version":1,"entries":{}}');
    expect(localStorage.getItem('math-app-auth-token')).toBe('leave-in-place');
    expect(localStorage.getItem('third-party-widget-cache')).toBe('untouched');
  });

  it('rolls the current data back when a storage write fails halfway through restore', () => {
    const previousSettings = JSON.stringify({ sound: true });
    const previousStreak = JSON.stringify({ targetMinutes: 15 });
    localStorage.setItem('math-app-settings-v1', previousSettings);
    localStorage.setItem('math-app-streak-v1', previousStreak);
    const originalSetItem = Storage.prototype.setItem;
    let shouldFail = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key: string, value: string) {
      if (key === 'math-app-streak-v1' && shouldFail) {
        shouldFail = false;
        throw new Error('simulated storage quota failure');
      }
      return originalSetItem.call(this, key, value);
    });

    expect(() => replaceBackupStorageSnapshot({
      'math-app-settings-v1': JSON.stringify({ sound: false }),
      'math-app-streak-v1': JSON.stringify({ targetMinutes: 60 }),
    })).toThrow(/previous app data was restored/i);
    expect(localStorage.getItem('math-app-settings-v1')).toBe(previousSettings);
    expect(localStorage.getItem('math-app-streak-v1')).toBe(previousStreak);
  });

  it('rejects unsafe widget configurations rather than accepting arbitrary persisted fields', async () => {
    const badWidgets = { version: 1, global: { arbitraryExecutable: 'run' }, instances: [] };
    await expect(createBackupText({
      storageEntries: { 'math-app-settings-v1': JSON.stringify({ sound: true }) },
      widgetPreferences: badWidgets,
    })).rejects.toThrow(/unsupported widget preference/i);
  });
});
