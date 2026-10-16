import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'rh_theme_pref';

export function ThemeProvider({ children }) {
  const [themePref, setThemePrefState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch (_) {}
    return 'system';
  });

  const setThemePref = useCallback((pref) => {
    setThemePrefState(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch (_) {}
  }, []);

  const applyTheme = useCallback(() => {
    let currentTheme = themePref;
    if (themePref === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      currentTheme = isDark ? 'dark' : 'light';
    }
    if (currentTheme === 'light') {
      document.body.classList.add('light-theme');
      document.documentElement.style.colorScheme = 'light';
    } else {
      document.body.classList.remove('light-theme');
      document.documentElement.style.colorScheme = 'dark';
    }
  }, [themePref]);

  useEffect(() => {
    applyTheme();
    if (themePref === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [applyTheme, themePref]);

  return (
    <ThemeContext.Provider value={{ themePref, setThemePref }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
