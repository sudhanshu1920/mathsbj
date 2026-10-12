import { expect, it } from 'vitest';

it('hydrates saved premium theme and appearance before app initialization', async () => {
  localStorage.clear();
  localStorage.setItem('math-app-theme-v5', 'forest');
  localStorage.setItem('math-app-mode-v1', 'light');

  // This file imports the theme module only after setting stored preferences,
  // matching a fresh application process/restart.
  const theme = await import('./theme');
  theme.initTheme();

  expect(theme.getTheme()).toBe('forest');
  expect(theme.getMode()).toBe('light');
  expect(document.documentElement.classList.contains('theme-forest')).toBe(true);
  expect(document.documentElement.classList.contains('light')).toBe(true);
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  expect(document.documentElement.style.colorScheme).toBe('light');
});
