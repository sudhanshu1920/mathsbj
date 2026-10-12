import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as theme from './theme';

beforeEach(() => {
  vi.useFakeTimers();
  // Restore the in-memory store as well as storage because snapshots are cached.
  theme.setTheme('arctic-blue');
  theme.setMode('dark');
  vi.runOnlyPendingTimers();
  localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-mode');
  document.documentElement.style.colorScheme = '';
  theme.initTheme();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('appearance switching', () => {
  it('applies mode and selected theme atomically before persistence completes', () => {
    theme.setTheme('mint');
    vi.advanceTimersByTime(0);

    const storageWrite = vi.spyOn(Storage.prototype, 'setItem').mockClear();
    const observedRecords: MutationRecord[] = [];
    const observer = new MutationObserver((records) => observedRecords.push(...records));
    observer.observe(document.documentElement, { attributes: true });

    theme.setMode('light');

    expect(theme.getMode()).toBe('light');
    expect(theme.getTheme()).toBe('mint');
    expect(document.documentElement.classList.contains('theme-mint')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.dataset.mode).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.documentElement.classList.contains('theme-appearance-updating')).toBe(true);
    expect(storageWrite).not.toHaveBeenCalled();

    return Promise.resolve().then(() => {
      const classMutations = [...observedRecords, ...observer.takeRecords()]
        .filter((record) => record.attributeName === 'class');
      expect(classMutations).toHaveLength(1);
      observer.disconnect();
      vi.advanceTimersByTime(0);
      expect(storageWrite).toHaveBeenCalledTimes(1);
      expect(storageWrite).toHaveBeenCalledWith('math-app-mode-v1', 'light');
      expect(storageWrite).not.toHaveBeenCalledWith('math-app-theme-v5', expect.anything());
    });
  });

  it('keeps only the latest choice after rapid repeated switches', () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');

    theme.setMode('light');
    theme.setMode('dark');
    theme.setMode('light');

    expect(theme.getMode()).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    vi.advanceTimersByTime(0);

    expect(storageWrite).toHaveBeenCalledTimes(1);
    expect(storageWrite).toHaveBeenCalledWith('math-app-mode-v1', 'light');
    expect(theme.getMode()).toBe('light');
  });

  it('continues switching when localStorage writes throw', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    expect(() => theme.setMode('light')).not.toThrow();
    expect(theme.getMode()).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(() => vi.advanceTimersByTime(0)).not.toThrow();
  });

  it('falls back to safe defaults for unsupported runtime values', () => {
    theme.setTheme('not-a-theme' as theme.ThemeId);
    theme.setMode('sepia' as theme.ModeId);

    expect(theme.getTheme()).toBe('arctic-blue');
    expect(theme.getMode()).toBe('dark');
    expect(document.documentElement.classList.contains('theme-arctic-blue')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('keeps theme subscribers isolated from mode-only updates', () => {
    const listener = vi.fn();
    const unsubscribe = theme.subscribeTheme(listener);

    theme.setMode('light');
    theme.setMode('light');
    expect(listener).not.toHaveBeenCalled();

    theme.setTheme('forest');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
