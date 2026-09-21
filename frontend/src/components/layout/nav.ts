import { LayoutDashboard, FileText, Users, Package, BarChart2, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

export interface NavSection {
  id: string;
  labelKey: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    labelKey: 'nav.main',
    items: [
      { id: 'dashboard', href: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { id: 'invoices', href: '/invoices', labelKey: 'nav.invoices', icon: FileText },
      { id: 'clients', href: '/clients', labelKey: 'nav.clients', icon: Users },
    ],
  },
  {
    id: 'finance',
    labelKey: 'nav.finance',
    items: [
      { id: 'products', href: '/products', labelKey: 'nav.products', icon: Package },
      { id: 'reports', href: '/reports', labelKey: 'nav.reports', icon: BarChart2 },
    ],
  },
  {
    id: 'system',
    labelKey: 'nav.system',
    items: [
      { id: 'settings', href: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
];
