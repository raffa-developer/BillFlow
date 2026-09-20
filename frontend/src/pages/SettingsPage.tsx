import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, UserCog } from 'lucide-react';
import { meApi } from '../lib/api';
import { Card } from '../components/ui/CardLegacy';
import { Button } from '../components/ui/ButtonLegacy';
import { Input } from '../components/ui/InputLegacy';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

type Tab = 'company' | 'account';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('company');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('settings.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.subtitle')}</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <TabButton active={tab === 'company'} onClick={() => setTab('company')} icon={<Building2 className="h-4 w-4" />}>
          {t('settings.tabCompany')}
        </TabButton>
        <TabButton active={tab === 'account'} onClick={() => setTab('account')} icon={<UserCog className="h-4 w-4" />}>
          {t('settings.tabAccount')}
        </TabButton>
      </div>

      {tab === 'company' ? <CompanyTab /> : <AccountTab />}
    </div>
  );
}

function TabButton({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function CompanyTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => meApi.get() });
  const user = data?.data.user;

  const [form, setForm] = useState({
    companyName: '',
    companyAddress: '',
    companyVat: '',
    companyEmail: '',
    companyPhone: '',
    companyLogoUrl: '',
    defaultTaxRate: '0',
    defaultPaymentDays: '30',
    invoicePrefix: 'INV',
  });

  const hydratedUserId = useRef<number | null>(null);

  // Hydrate once per user id — a background refetch must not clobber in-progress edits.
  useEffect(() => {
    if (user && hydratedUserId.current !== user.id) {
      hydratedUserId.current = user.id;
      setForm({
        companyName: user.companyName ?? '',
        companyAddress: user.companyAddress ?? '',
        companyVat: user.companyVat ?? '',
        companyEmail: user.companyEmail ?? '',
        companyPhone: user.companyPhone ?? '',
        companyLogoUrl: user.companyLogoUrl ?? '',
        defaultTaxRate: String(user.defaultTaxRate ?? 0),
        defaultPaymentDays: String(user.defaultPaymentDays ?? 30),
        invoicePrefix: user.invoicePrefix ?? 'INV',
      });
    }
  }, [user]);

  const save = useMutation({
    mutationFn: () => meApi.updateCompany({
      ...form,
      defaultTaxRate: parseFloat(form.defaultTaxRate) || 0,
      defaultPaymentDays: parseInt(form.defaultPaymentDays) || 30,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success(t('settings.companySaved'));
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('settings.errorSave')),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>;
  }

  return (
    <Card className="p-6">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{t('settings.companyDescription')}</p>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('settings.companyName')} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Acme Lda." />
          <Input label={t('settings.vat')} value={form.companyVat} onChange={(e) => setForm({ ...form, companyVat: e.target.value })} placeholder="PT123456789" />
          <Input label={t('common.email')} type="email" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} placeholder="contato@empresa.pt" />
          <Input label={t('common.phone')} value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} placeholder="+351 ..." />
        </div>
        <Input label={t('common.address')} value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} placeholder="Rua, número, código postal, cidade" />
        <Input label={t('settings.logoUrl')} type="url" value={form.companyLogoUrl} onChange={(e) => setForm({ ...form, companyLogoUrl: e.target.value })} placeholder="https://..." />

        {form.companyLogoUrl && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t('settings.logoPreview')}</p>
            <img src={form.companyLogoUrl} alt="Logo" className="h-12 object-contain" />
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-800 pt-5 mt-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('settings.defaultsSection')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('settings.defaultsDescription')}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label={t('settings.defaultTaxRate')}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.defaultTaxRate}
              onChange={(e) => setForm({ ...form, defaultTaxRate: e.target.value })}
            />
            <Input
              label={t('settings.defaultPaymentDays')}
              type="number"
              min="1"
              max="365"
              value={form.defaultPaymentDays}
              onChange={(e) => setForm({ ...form, defaultPaymentDays: e.target.value })}
            />
            <Input
              label={t('settings.invoicePrefix')}
              value={form.invoicePrefix}
              onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
              placeholder="INV"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" loading={save.isPending} data-testid="settings-company-submit">{t('common.save')}</Button>
        </div>
      </form>
    </Card>
  );
}

function AccountTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: ['me'], queryFn: () => meApi.get() });
  const user = data?.data.user;

  const [emailForm, setEmailForm] = useState({ email: '', currentPassword: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const hydratedEmailUserId = useRef<number | null>(null);

  // Hydrate once per user id so background refetches don't clobber edits.
  useEffect(() => {
    if (user && hydratedEmailUserId.current !== user.id) {
      hydratedEmailUserId.current = user.id;
      setEmailForm((f) => ({ ...f, email: user.email }));
    }
  }, [user]);

  const updateEmail = useMutation({
    mutationFn: () => meApi.updateEmail(emailForm.email, emailForm.currentPassword),
    onSuccess: async ({ data }) => {
      localStorage.setItem('token', data.token);
      await refresh();
      qc.invalidateQueries({ queryKey: ['me'] });
      setEmailForm({ email: data.user.email, currentPassword: '' });
      toast.success(t('settings.emailUpdated'));
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('settings.errorEmail')),
  });

  const updatePassword = useMutation({
    mutationFn: () => meApi.updatePassword(pwForm.currentPassword, pwForm.newPassword),
    onSuccess: () => {
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success(t('settings.passwordChanged'));
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('settings.errorPassword')),
  });

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('settings.emailSection')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5">{t('settings.emailDescription')}</p>
        <form onSubmit={(e) => { e.preventDefault(); updateEmail.mutate(); }} className="space-y-4">
          <Input label={t('settings.newEmail')} type="email" value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} required />
          <Input label={t('settings.currentPassword')} type="password" value={emailForm.currentPassword} onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })} required />
          <div className="flex justify-end">
            <Button type="submit" loading={updateEmail.isPending}>{t('settings.changeEmail')}</Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('settings.passwordSection')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5">{t('settings.passwordDescription')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pwForm.newPassword !== pwForm.confirm) {
              toast.error(t('settings.passwordMismatch'));
              return;
            }
            updatePassword.mutate();
          }}
          className="space-y-4"
        >
          <Input label={t('settings.currentPassword')} type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('settings.newPassword')} type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} minLength={8} required />
            <Input label={t('settings.confirmPassword')} type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} minLength={8} required />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={updatePassword.isPending}>{t('settings.changePassword')}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
