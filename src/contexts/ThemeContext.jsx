import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themePref, setThemePref] = useState('system');

  const applyTheme = useCallback(() => {
    let currentTheme = themePref;
    if (themePref === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      currentTheme = isDark ? 'dark' : 'light';
    }
    if (currentTheme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
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

  useEffect(() => {
    document.body.style.backgroundImage = `url(${process.env.PUBLIC_URL}/images/bg-1.png)`;
  }, []);

  return (
    <ThemeContext.Provider value={{ themePref, setThemePref }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
