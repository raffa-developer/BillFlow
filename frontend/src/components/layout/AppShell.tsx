import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { languages } from '@/i18n';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';

export function AppShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { currency, changeCurrency, converting } = useCurrency();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('billflow-sidebar-collapsed') === '1');

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('billflow-sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex">
        <Sidebar collapsed={collapsed} />
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="flex w-64 flex-col bg-card p-0 text-foreground">
          <SheetTitle className="sr-only">{t('nav.menu')}</SheetTitle>
          <SheetDescription className="sr-only">{t('nav.menu')}</SheetDescription>
          <Sidebar
            itemTestIdPrefix="nav-mobile"
            className="min-h-0 flex-1 border-r-0"
            onNavigate={() => setMobileNavOpen(false)}
          />
          <div className="flex flex-col gap-2 border-t border-border p-3">
            <select
              data-testid="nav-mobile-language"
              aria-label={t('nav.language')}
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <select
              data-testid="nav-mobile-currency"
              aria-label={t('nav.currency')}
              value={currency}
              disabled={converting}
              onChange={(e) => changeCurrency(e.target.value as typeof currency)}
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
            >
              {(['EUR', 'BRL', 'USD', 'GBP'] as const).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenCommand={() => setCommandOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          collapsed={collapsed}
          onToggleSidebar={toggleSidebar}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
