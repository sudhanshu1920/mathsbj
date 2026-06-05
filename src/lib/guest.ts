const KEY = 'math-app-guest-v1';

export const isGuest = (): boolean => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};

export const setGuest = (v: boolean) => {
  try {
    if (v) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent('guest-updated'));
  } catch { /* ignore */ }
};