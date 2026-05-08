import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'billflow_theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): { theme: Theme; fromStorage: boolean } {
  if (typeof window === 'undefined') {
    return { theme: 'light', fromStorage: false };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return { theme: stored, fromStorage: true };
    }
  } catch {
    // localStorage unavailable
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return { theme: prefersDark ? 'dark' : 'light', fromStorage: false };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = getInitialTheme();
  const [theme, setThemeState] = useState<Theme>(initial.theme);
  const [followSystem, setFollowSystem] = useState(!initial.fromStorage);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (!followSystem || typeof window === 'undefined') return;
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [followSystem]);

  const setTheme = (next: Theme) => {
    setFollowSystem(false);
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
