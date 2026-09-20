import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS } from './nav';

interface FlyoutProps {
  openSection: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function Flyout({ openSection, onMouseEnter, onMouseLeave }: FlyoutProps) {
  const { t } = useTranslation();
  const section = NAV_SECTIONS.find((s) => s.id === openSection);
  if (!section) return null;

  return (
    <div
      data-testid="nav-flyout"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex h-full w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar-accent px-2 py-3"
    >
      <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/60">
        {t(section.labelKey)}
      </p>
      <div className="space-y-0.5">
        {section.items.map((item) => (
          <NavLink
            key={item.id}
            to={item.href}
            end={item.href === '/'}
            data-testid={`nav-item-${item.id}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary/20 text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
