'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

type ThemeContextValue = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'fanverse-admin:theme';

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'dark';
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'dark';
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(pref: ThemePreference): Theme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  root.setAttribute('data-theme', theme);
  // remove the no-transition class on next frame so genuine UI changes still animate
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove('theme-switching'));
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');
  const [theme, setTheme] = useState<Theme>('dark');

  // Hydrate from storage once mounted
  useEffect(() => {
    const pref = readStoredPreference();
    const next = resolveTheme(pref);
    setPreferenceState(pref);
    setTheme(next);
    applyTheme(next);
  }, []);

  // Track system preference changes when in 'system' mode
  useEffect(() => {
    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const next: Theme = media.matches ? 'dark' : 'light';
      setTheme(next);
      applyTheme(next);
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    window.localStorage.setItem(STORAGE_KEY, pref);
    const next = resolveTheme(pref);
    setTheme(next);
    applyTheme(next);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setPreference(next);
  }, [theme, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preference, setPreference, toggle }),
    [theme, preference, setPreference, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/**
 * Inline script that runs before React hydrates to prevent FOUC
 * (flash of unstyled / wrong-themed content). Inserted into <head>.
 */
export const themeBootstrapScript = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var pref = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'dark';
    var theme = pref === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : pref;
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;
