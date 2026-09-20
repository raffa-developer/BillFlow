import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Rail } from './Rail';
import { Flyout } from './Flyout';
import { Topbar } from './Topbar';
import { NAV_SECTIONS, activeSectionId } from './nav';

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [peek, setPeek] = useState<string | null>(() => activeSectionId(pathname));
  const [pinned, setPinned] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const closeTimer = useRef<number | null>(null);

  const openSection = pinned ?? peek;

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileNavOpen(false);
    setPeek(activeSectionId(pathname));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPeek(null), 150);
  };
  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex">
        <Rail
          openSection={openSection}
          onPeek={(s) => { cancelClose(); setPeek(s); }}
          onTogglePin={(s) => setPinned((p) => (p === s ? null : s))}
        />
        <Flyout openSection={openSection} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} />
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar-background p-0">
          <nav className="flex flex-col gap-1 p-3">
            {NAV_SECTIONS.flatMap((s) => s.items).map((item) => (
              <NavLink
                key={item.id}
                to={item.href}
                end={item.href === '/'}
                data-testid={`nav-mobile-${item.id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <item.icon className="h-4 w-4" />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenCommand={() => { /* wired in Task 6 */ }}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
