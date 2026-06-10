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
    const backgrounds = [
      `${process.env.PUBLIC_URL}/images/bg-1.png`,
      `${process.env.PUBLIC_URL}/images/bg-2.png`,
      `${process.env.PUBLIC_URL}/images/bg-3.png`,
      `${process.env.PUBLIC_URL}/images/bg-4.png`,
    ];

    backgrounds.forEach(src => {
      const img = new Image();
      img.src = src;
    });

    const randomBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    document.body.style.backgroundImage = `url(${randomBg})`;
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
