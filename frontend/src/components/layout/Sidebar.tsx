import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Package, FileText, LogOut, Receipt, X, ChevronDown, Settings, BarChart2, Globe } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { languages } from '../../i18n/index';
import { cn } from '../../lib/utils';

const currencies = [
  { code: 'EUR', label: '€ Euro' },
  { code: 'BRL', label: 'R$ Real' },
  { code: 'USD', label: '$ Dollar' },
  { code: 'GBP', label: '£ Pound' },
] as const;

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { logout, user } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const nav = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/clients', icon: Users, label: t('nav.clients') },
    { to: '/products', icon: Package, label: t('nav.products') },
    { to: '/invoices', icon: FileText, label: t('nav.invoices') },
    { to: '/reports', icon: BarChart2, label: t('nav.reports') },
    { to: '/settings', icon: Settings, label: t('nav.settings') },
  ];

  const selectedCurrency = currencies.find(c => c.code === currency) ?? currencies[0];
  const selectedLang = languages.find(l => l.code === i18n.language) ?? languages[0];

  return (
    <aside className="flex h-full w-64 flex-col bg-slate-900 text-slate-100">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-600/30">
            <Receipt className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">BillFlow</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{t('nav.menu')}</p>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-3 py-4 space-y-1 shrink-0">
        {/* Currency picker */}
        <div className="relative">
          <button
            onClick={() => { setCurrencyOpen(v => !v); setLangOpen(false); }}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <span className="font-medium">{selectedCurrency.label}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', currencyOpen && 'rotate-180')} />
          </button>
          {currencyOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-full rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl z-10">
              {currencies.map(c => (
                <button
                  key={c.code}
                  onClick={() => { setCurrency(c.code); setCurrencyOpen(false); }}
                  className={cn(
                    'flex w-full items-center px-3 py-2 text-sm transition-colors',
                    c.code === currency ? 'text-blue-400 font-medium' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  )}
                >
                  {c.label}
                  {c.code === currency && <span className="ml-auto text-blue-400">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Language picker */}
        <div className="relative">
          <button
            onClick={() => { setLangOpen(v => !v); setCurrencyOpen(false); }}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">{selectedLang.label}</span>
            </span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', langOpen && 'rotate-180')} />
          </button>
          {langOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-full rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl z-10">
              {languages.map(l => (
                <button
                  key={l.code}
                  onClick={() => { i18n.changeLanguage(l.code); setLangOpen(false); }}
                  className={cn(
                    'flex w-full items-center px-3 py-2 text-sm transition-colors',
                    l.code === i18n.language ? 'text-blue-400 font-medium' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  )}
                >
                  {l.label}
                  {l.code === i18n.language && <span className="ml-auto text-blue-400">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-bold text-white">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <span className="text-xs text-slate-400 truncate flex-1">{user?.email}</span>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  );
}
