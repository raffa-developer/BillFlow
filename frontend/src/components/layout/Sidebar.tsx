import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, FileText,
  LogOut, Settings, BarChart2, Globe, User,
  ChevronLeft, ChevronRight, ChevronsUpDown,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { languages } from '../../i18n/index';
import { cn } from '../../lib/utils';

const currencies = [
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'BRL', symbol: 'R$', label: 'Real' },
  { code: 'USD', symbol: '$', label: 'Dollar' },
  { code: 'GBP', symbol: '£', label: 'Pound' },
] as const;

const nav = [
  { to: '/',         icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { to: '/clients',  icon: Users,           labelKey: 'nav.clients' },
  { to: '/products', icon: Package,         labelKey: 'nav.products' },
  { to: '/invoices', icon: FileText,        labelKey: 'nav.invoices' },
  { to: '/reports',  icon: BarChart2,       labelKey: 'nav.reports' },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { logout, user } = useAuth();
  const { currency, changeCurrency, converting } = useCurrency();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );
  const [accountOpen, setAccountOpen] = useState(false);

  const isMobile = !!onClose;
  const isCollapsed = !isMobile && collapsed;

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
    if (next) setAccountOpen(false);
  };

  const selectedCurrency = currencies.find(c => c.code === currency) ?? currencies[0];

  return (
    <aside className={cn(
      'relative flex h-full flex-col border-r border-slate-800/60 bg-slate-950 text-slate-100 transition-[width] duration-200 ease-in-out',
      isCollapsed ? 'w-[64px]' : 'w-[220px]'
    )}>

      {/* ── Brand ──────────────────────────────────────────── */}
      <div className={cn(
        'flex h-14 shrink-0 items-center border-b border-slate-800/60',
        isCollapsed ? 'justify-center' : 'gap-2.5 px-4'
      )}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-900/40">
          <FileText className="h-3.5 w-3.5 text-white" />
        </div>
        {!isCollapsed && (
          <span className="text-sm font-semibold tracking-tight text-white">BillFlow</span>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav className={cn('flex-1 overflow-y-auto py-3 px-2')}>
        {!isCollapsed && (
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            {t('nav.menu')}
          </p>
        )}

        <div className="space-y-0.5">
          {nav.map(({ to, icon: Icon, labelKey }) => {
            const isActive = to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={onClose}
                title={isCollapsed ? t(labelKey) : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-all duration-150',
                  isCollapsed && 'justify-center gap-0 px-0',
                  isActive
                    ? 'bg-blue-600/15 text-blue-400'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                )}
              >
                <Icon className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
                )} />
                {!isCollapsed && <span>{t(labelKey)}</span>}
              </NavLink>
            );
          })}
        </div>

        <div className="my-2 h-px bg-slate-800/60 mx-0" />

        <NavLink
          to="/settings"
          onClick={onClose}
          title={isCollapsed ? t('nav.settings') : undefined}
          className={({ isActive }) => cn(
            'group flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-all duration-150',
            isCollapsed && 'justify-center gap-0 px-0',
            isActive
              ? 'bg-blue-600/15 text-blue-400'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
          )}
        >
          {({ isActive }) => (
            <>
              <Settings className={cn(
                'h-4 w-4 shrink-0',
                isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
              )} />
              {!isCollapsed && <span>{t('nav.settings')}</span>}
            </>
          )}
        </NavLink>
      </nav>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-800/60">

        {/* Language + Currency — native selects, no clipping issues */}
        {!isCollapsed && (
          <div className="grid grid-cols-2 gap-1 border-b border-slate-800/60 px-2 py-2">
            {/* Language */}
            <div className="relative">
              <Globe className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
              <select
                value={i18n.language}
                onChange={e => i18n.changeLanguage(e.target.value)}
                className="h-7 w-full appearance-none rounded-md bg-slate-900 pl-6 pr-1 text-xs font-medium text-slate-300 border border-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer hover:bg-slate-800 transition-colors"
              >
                {languages.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Currency */}
            <div className="relative">
              {converting ? (
                <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
                  <div className="h-3 w-3 animate-spin rounded-full border border-blue-500 border-t-transparent" />
                </div>
              ) : (
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                  {selectedCurrency.symbol}
                </span>
              )}
              <select
                value={currency}
                disabled={converting}
                onChange={e => changeCurrency(e.target.value as typeof currency)}
                className="h-7 w-full appearance-none rounded-md bg-slate-900 pl-6 pr-1 text-xs font-medium text-slate-300 border border-slate-800 focus:border-blue-600 focus:outline-none cursor-pointer hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currencies.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Account */}
        <div className={cn('px-2 py-2', isCollapsed && 'flex justify-center')}>
          {isCollapsed ? (
            <button
              title={user?.email}
              onClick={logout}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800/80 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setAccountOpen(v => !v)}
                className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 ring-1 ring-slate-700/50">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">{user?.email}</p>
                  <p className="text-[10px] text-slate-600">BillFlow</p>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              </button>

              {accountOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-slate-800 bg-slate-900 py-1.5 shadow-2xl shadow-black/60 z-50">
                  <div className="border-b border-slate-800 px-3 py-2 mb-1">
                    <p className="truncate text-xs font-medium text-slate-200">{user?.email}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{t('nav.freePlan')}</p>
                  </div>
                  <button
                    onClick={() => { logout(); setAccountOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <div className={cn(
            'border-t border-slate-800/60 px-2 py-2',
            isCollapsed && 'flex justify-center'
          )}>
            <button
              onClick={toggleCollapse}
              title={isCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
              className={cn(
                'flex items-center gap-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-800/60 hover:text-slate-400 transition-colors',
                isCollapsed ? 'h-8 w-8 justify-center' : 'w-full px-2 py-1.5'
              )}
            >
              {isCollapsed
                ? <ChevronRight className="h-4 w-4" />
                : <><ChevronLeft className="h-3.5 w-3.5" /><span>{t('nav.collapse')}</span></>
              }
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
