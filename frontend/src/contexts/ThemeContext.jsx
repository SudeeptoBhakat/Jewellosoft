/**
 * ─── Theme Context ─────────────────────────────────────────────
 * Global theme state provider.
 *
 * Responsibilities:
 *   • Applies the active theme via `data-theme` attribute on <html>
 *   • Persists theme to localStorage for instant, flicker-free boot
 *   • Exposes `setTheme(key)` for the Settings page
 *   • Syncs theme from shop data (backend) on initial load
 * ────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const THEME_STORAGE_KEY = 'jewellosoft_theme';

/**
 * Theme definitions. 
 * Updated with the Premium Gold aesthetic.
 */
export const THEMES = [
  {
    key: 'default',
    label: 'Noir Gold',
    description: 'Bespoke charcoal and refined gold — the signature luxury experience.',
    icon: 'fa-solid fa-gem',
    cssTheme: null,                       // uses :root (custom gold variables)
    preview: {
      bg: '#0a0a0a',
      sidebar: '#070707',
      card: '#121212',
      accent: '#C9A84C',
      text: '#f8f6f0',
    },
  },
  {
    key: 'dark',
    label: 'Midnight Indigo',
    description: 'Deep navy with glowing indigo — classic and technical.',
    icon: 'fa-solid fa-moon',
    cssTheme: 'dark',
    preview: {
      bg: '#0f172a',
      sidebar: '#0c1322',
      card: '#1f2937',
      accent: '#6366f1',
      text: '#f1f5f9',
    },
  },
  {
    key: 'light',
    label: 'Mono Light',
    description: 'Purity in black and white — clean, fast, and high-contrast.',
    icon: 'fa-solid fa-sun',
    cssTheme: 'light',
    preview: {
      bg: '#f5f5f5',
      sidebar: '#fafafa',
      card: '#ffffff',
      accent: '#171717',
      text: '#171717',
    },
  },
];

const ThemeContext = createContext({
  theme: 'default',
  setTheme: () => {},
  themes: THEMES,
});

export const useTheme = () => useContext(ThemeContext);

/**
 * Apply `data-theme` attribute on <html>.
 */
function applyThemeToDOM(themeKey) {
  const def = THEMES.find((t) => t.key === themeKey) || THEMES[0];
  if (def.cssTheme) {
    document.documentElement.setAttribute('data-theme', def.cssTheme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function ThemeProvider({ children }) {
  const { shop } = useAuth();

  // Initialise from localStorage (synchronous — avoids flash)
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored && THEMES.some((t) => t.key === stored)) return stored;
    } catch { /* ignore */ }
    return 'default';
  });

  // ── Sync from Backend shop data ──
  useEffect(() => {
    if (shop?.theme) {
      let backendKey = shop.theme;
      
      // Map any old legacy strings safely
      const legacyMap = {
        'System Default': 'default',
        'Dark Mode': 'dark',
        'Light Mode': 'light',
        'halloween': 'default'
      };
      
      if (legacyMap[backendKey]) backendKey = legacyMap[backendKey];

      if (THEMES.some(t => t.key === backendKey) && backendKey !== theme) {
        setThemeState(backendKey);
        localStorage.setItem(THEME_STORAGE_KEY, backendKey);
      }
    }
  }, [shop?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply to DOM whenever theme changes
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  const setTheme = useCallback((key) => {
    if (!THEMES.some((t) => t.key === key)) return;
    setThemeState(key);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, key);
    } catch { /* ignore */ }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
