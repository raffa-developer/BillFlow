import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Menu, Moon, Search, Sun, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTheme } from '@/contexts/ThemeContext';
import { languages } from '@/i18n';
import { NAV_SECTIONS } from './nav';

interface TopbarProps {
  onOpenCommand: () => void;
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenCommand, onOpenMobileNav }: TopbarProps) {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { currency, changeCurrency, converting } = useCurrency();
  const { theme, toggleTheme } = useTheme();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const activeItem = NAV_SECTIONS.flatMap((s) => s.items).find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  );

  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 lg:px-4">
      <button
        data-testid="topbar-menu"
        aria-label={t('nav.menu')}
        onClick={onOpenMobileNav}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="text-sm font-semibold text-foreground">
        {activeItem ? t(activeItem.labelKey) : 'BillFlow'}
      </h1>
      <div className="flex-1" />
      <button
        data-testid="topbar-command"
        onClick={onOpenCommand}
        className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted sm:flex"
      >
        <Search className="h-3.5 w-3.5" />
        {t('nav.searchPlaceholder')}
        <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>
      <button
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <select
        data-testid="topbar-language"
        aria-label={t('nav.language')}
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="hidden rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground md:block"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
      <select
        data-testid="topbar-currency"
        aria-label={t('nav.currency')}
        value={currency}
        disabled={converting}
        onChange={(e) => changeCurrency(e.target.value as typeof currency)}
        className="hidden rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground md:block"
      >
        {(['EUR', 'BRL', 'USD', 'GBP'] as const).map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <div ref={accountRef} className="relative">
        <button
          data-testid="topbar-account"
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          onClick={() => setAccountOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground lg:block">{user?.email}</span>
          <ChevronsUpDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
        </button>
        {accountOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-popover py-1.5 shadow-lg">
            <p className="truncate px-3 py-2 text-xs text-muted-foreground">{user?.email}</p>
            <button
              data-testid="account-logout"
              onClick={() => { logout(); setAccountOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('nav.logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
