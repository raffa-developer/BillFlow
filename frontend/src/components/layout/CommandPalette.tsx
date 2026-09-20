import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut,
} from '@/components/ui/command';
import { useTheme } from '@/contexts/ThemeContext';
import { NAV_SECTIONS } from './nav';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const go = (href: string) => { onOpenChange(false); navigate(href); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput data-testid="command-input" placeholder={t('nav.searchPlaceholder')} />
      <CommandList>
        <CommandEmpty>{t('common.noResults')}</CommandEmpty>
        {NAV_SECTIONS.map((section) => (
          <CommandGroup key={section.id} heading={t(section.labelKey)}>
            {section.items.map((item) => (
              <CommandItem
                key={item.id}
                data-testid={`command-item-${item.id}`}
                value={t(item.labelKey)}
                onSelect={() => go(item.href)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {t(item.labelKey)}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandGroup heading={t('nav.actions')}>
          <CommandItem value={t('nav.newInvoice')} onSelect={() => go('/invoices/new')}>
            {t('nav.newInvoice')}
          </CommandItem>
          <CommandItem value={t('nav.toggleTheme')} onSelect={() => { toggleTheme(); onOpenChange(false); }}>
            {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
