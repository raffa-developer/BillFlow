import { useState, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Receipt, CheckCircle2 } from 'lucide-react';
import { authApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">BillFlow</span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm">
          {done ? (
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('auth.reset.change')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('auth.reset.redirecting')}</p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('auth.reset.title')}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('settings.passwordDescription')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label={t('auth.reset.newPassword')}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  autoFocus
                />
                <Input
                  label={t('settings.confirmPassword')}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                />

                {error && (
                  <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2.5 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-10" loading={loading} size="lg">
                  {t('auth.reset.change')}
                </Button>
              </form>

              <div className="mt-5 text-center">
                <Link to="/login" className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:underline">
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
