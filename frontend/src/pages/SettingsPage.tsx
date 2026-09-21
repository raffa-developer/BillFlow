import { useState, useEffect, useRef, type ComponentProps } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, UserCog } from 'lucide-react';
import { meApi } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { LoadingState } from '@/components/common/Spinner';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'company' | 'account';

function Field({ id, label, ...props }: { id: string; label: string } & ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('company');

  return (
    <div className="space-y-5">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" />
            {t('settings.tabCompany')}
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <UserCog className="h-4 w-4" />
            {t('settings.tabAccount')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <CompanyTab />
        </TabsContent>
        <TabsContent value="account" className="mt-4">
          <AccountTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { refresh } = useAuth();
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
    onSuccess: async () => {
      await refresh();
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success(t('settings.companySaved'));
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? t('settings.errorSave')),
  });

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.tabCompany')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('settings.companyDescription')}</p>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="settings-company-name" label={t('settings.companyName')} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Acme Lda." />
          <Field id="settings-company-vat" label={t('settings.vat')} value={form.companyVat} onChange={(e) => setForm({ ...form, companyVat: e.target.value })} placeholder="PT123456789" />
          <Field id="settings-company-email" label={t('common.email')} type="email" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} placeholder="contato@empresa.pt" />
          <Field id="settings-company-phone" label={t('common.phone')} value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} placeholder="+351 ..." />
        </div>
        <Field id="settings-company-address" label={t('common.address')} value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} placeholder="Rua, número, código postal, cidade" />
        <Field id="settings-company-logo" label={t('settings.logoUrl')} type="url" value={form.companyLogoUrl} onChange={(e) => setForm({ ...form, companyLogoUrl: e.target.value })} placeholder="https://..." />

        {form.companyLogoUrl && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('settings.logoPreview')}</p>
            <img src={form.companyLogoUrl} alt="Logo" className="h-12 object-contain" />
          </div>
        )}

        <div className="border-t border-border pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.defaultsSection')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('settings.defaultsDescription')}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field
              id="settings-default-tax-rate"
              label={t('settings.defaultTaxRate')}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.defaultTaxRate}
              onChange={(e) => setForm({ ...form, defaultTaxRate: e.target.value })}
            />
            <Field
              id="settings-default-payment-days"
              label={t('settings.defaultPaymentDays')}
              type="number"
              min="1"
              max="365"
              value={form.defaultPaymentDays}
              onChange={(e) => setForm({ ...form, defaultPaymentDays: e.target.value })}
            />
            <Field
              id="settings-invoice-prefix"
              label={t('settings.invoicePrefix')}
              value={form.invoicePrefix}
              onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
              placeholder="INV"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={save.isPending} data-testid="settings-company-submit">{t('common.save')}</Button>
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
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.emailSection')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.emailDescription')}</p>
        <form onSubmit={(e) => { e.preventDefault(); updateEmail.mutate(); }} className="mt-5 space-y-4">
          <Field id="settings-new-email" label={t('settings.newEmail')} type="email" value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} required />
          <Field id="settings-email-current-password" label={t('settings.currentPassword')} type="password" value={emailForm.currentPassword} onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })} required />
          <div className="flex justify-end">
            <Button type="submit" disabled={updateEmail.isPending}>{t('settings.changeEmail')}</Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('settings.passwordSection')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.passwordDescription')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pwForm.newPassword !== pwForm.confirm) {
              toast.error(t('settings.passwordMismatch'));
              return;
            }
            updatePassword.mutate();
          }}
          className="mt-5 space-y-4"
        >
          <Field id="settings-current-password" label={t('settings.currentPassword')} type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="settings-new-password" label={t('settings.newPassword')} type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} minLength={8} required />
            <Field id="settings-confirm-password" label={t('settings.confirmPassword')} type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} minLength={8} required />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={updatePassword.isPending}>{t('settings.changePassword')}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
