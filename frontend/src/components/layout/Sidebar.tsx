import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { NAV_SECTIONS } from './nav';

interface SidebarProps {
  collapsed?: boolean;
  itemTestIdPrefix?: string;
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ collapsed = false, itemTestIdPrefix = 'nav-item', onNavigate, className }: SidebarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const company = user?.companyName?.trim() || 'BillFlow';
  const logoUrl = user?.companyLogoUrl?.trim() || null;
  const showLogo = !!logoUrl && failedLogoUrl !== logoUrl;

  return (
    <div
      className={cn(
        'flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-border bg-card',
        'transition-[width] duration-200 ease-out motion-reduce:transition-none',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      <div className={cn('flex items-center gap-2.5 py-4', collapsed ? 'justify-center px-2' : 'px-4')}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Receipt className="h-4 w-4" />
        </span>
        <span className={cn('min-w-0 truncate font-display text-base font-bold tracking-tight text-foreground', collapsed && 'sr-only')}>
          BillFlow
        </span>
      </div>

      <div
        data-testid="nav-workspace"
        className={cn(
          'mb-5 flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 py-2.5',
          collapsed ? 'mx-2 justify-center px-0' : 'mx-3 px-3'
        )}
      >
        {showLogo ? (
          <img
            key={logoUrl}
            src={logoUrl}
            alt={company}
            onError={() => setFailedLogoUrl(logoUrl)}
            className="h-7 w-7 shrink-0 rounded-md bg-muted object-contain"
          />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
            {company.charAt(0).toUpperCase()}
          </span>
        )}
        <span className={cn('min-w-0 flex-1 truncate font-display text-sm font-semibold text-foreground', collapsed && 'sr-only')}>
          {company}
        </span>
      </div>

      <nav aria-label={t('nav.menu')} className="flex-1 space-y-5 overflow-y-auto px-3 pb-5">
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.id} data-testid={`nav-section-${section.id}`}>
            {collapsed ? (
              si > 0 && <div className="mx-1 mb-3 border-t border-border" />
            ) : (
              <p className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(section.labelKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item, ii) => (
                <NavLink
                  key={item.id}
                  to={item.href}
                  end={item.href === '/'}
                  data-testid={`${itemTestIdPrefix}-${item.id}`}
                  title={collapsed ? t(item.labelKey) : undefined}
                  onClick={onNavigate}
                  style={{ animationDelay: `${(si * 3 + ii) * 35}ms` }}
                  className={({ isActive }) =>
                    cn(
                      'nav-item-in flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-[color,background-color]',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className={cn('truncate', collapsed && 'sr-only')}>{t(item.labelKey)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
