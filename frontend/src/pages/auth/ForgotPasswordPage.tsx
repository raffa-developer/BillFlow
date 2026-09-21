import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Receipt, ArrowLeft, MailCheck } from 'lucide-react';
import { authApi } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/common/Spinner';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgot(email);
      setSent(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Receipt className="h-6 w-6" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight text-foreground">BillFlow</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-7 shadow">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <MailCheck className="h-6 w-6" />
              </div>
              <h1 className="font-display text-lg font-bold tracking-tight text-foreground">{t('auth.forgot.checkEmail')}</h1>
              <p className="text-sm text-muted-foreground">{t('auth.forgot.checkEmailDesc', { email })}</p>
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" /> {t('auth.forgot.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h1 className="font-display text-xl font-bold tracking-tight text-foreground">{t('auth.forgot.title')}</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">{t('auth.forgot.subtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">{t('common.email')}</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Spinner className="h-4 w-4 border-primary-foreground border-t-transparent" />}
                  {t('auth.forgot.send')}
                </Button>
              </form>

              <div className="mt-5 text-center">
                <Link to="/login" className="text-sm text-primary hover:underline">
                  {t('auth.forgot.backToLogin')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
