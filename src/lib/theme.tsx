import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export type MezoneTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'mezone_theme_mode';

interface ThemeContextValue {
  theme: MezoneTheme;
  setTheme: (theme: MezoneTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

function readInitialTheme(): MezoneTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // ignore storage errors
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<MezoneTheme>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const setTheme = (next: MezoneTheme) => setThemeState(next);
  const toggleTheme = () => setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function ThemeToggleButton({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
      title={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
      className={`inline-flex items-center justify-center gap-1.5 border border-black/15 bg-white text-[#111113] rounded-lg hover:bg-[#EFECE5] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        compact ? 'h-9 px-2.5 text-xs font-medium' : 'h-9 px-3 text-xs font-semibold'
      }`}
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5 text-[#EA580C]" />
          {!compact && <span>Light</span>}
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-[#57534E]" />
          {!compact && <span>Dark</span>}
        </>
      )}
    </button>
  );
}
