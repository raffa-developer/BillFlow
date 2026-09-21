import { useState, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Receipt, CheckCircle2 } from 'lucide-react';
import { authApi } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/common/Spinner';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError(t('settings.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await authApi.reset(token, newPassword);
      setDone(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Invalid or expired token.');
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
          {done ? (
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="font-display text-lg font-bold tracking-tight text-foreground">{t('auth.reset.change')}</h1>
              <p className="text-sm text-muted-foreground">{t('auth.reset.redirecting')}</p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h1 className="font-display text-xl font-bold tracking-tight text-foreground">{t('auth.reset.title')}</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">{t('settings.passwordDescription')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-new-password">{t('auth.reset.newPassword')}</Label>
                  <Input
                    id="reset-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-confirm-password">{t('settings.confirmPassword')}</Label>
                  <Input
                    id="reset-confirm-password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Spinner className="h-4 w-4 border-primary-foreground border-t-transparent" />}
                  {t('auth.reset.change')}
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
