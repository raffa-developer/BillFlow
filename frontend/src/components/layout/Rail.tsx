import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS, activeSectionId } from './nav';

interface RailProps {
  openSection: string | null;
  onPeek: (section: string) => void;
  onTogglePin: (section: string) => void;
}

export function Rail({ openSection, onPeek, onTogglePin }: RailProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const active = activeSectionId(pathname);

  return (
    <nav
      aria-label={t('nav.menu')}
      className="flex h-full w-11 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar-background py-2"
    >
      {NAV_SECTIONS.map((section) => {
        const Icon = section.items[0].icon;
        const isActive = section.id === active;
        const isOpen = section.id === openSection;
        return (
          <button
            key={section.id}
            type="button"
            data-testid={`nav-rail-${section.id}`}
            aria-label={t(section.labelKey)}
            aria-expanded={isOpen}
            onMouseEnter={() => onPeek(section.id)}
            onFocus={() => onPeek(section.id)}
            onClick={() => onTogglePin(section.id)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              isActive && 'bg-sidebar-primary text-sidebar-primary-foreground',
              isOpen && !isActive && 'ring-2 ring-sidebar-ring/60'
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </nav>
  );
}
