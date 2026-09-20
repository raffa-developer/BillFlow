import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Receipt, ArrowLeft, MailCheck } from 'lucide-react';
import { authApi } from '../../lib/api';
import { Button } from '../../components/ui/ButtonLegacy';
import { Input } from '../../components/ui/InputLegacy';

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">BillFlow</span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <MailCheck className="h-6 w-6 text-green-600" />
              </div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('auth.forgot.checkEmail')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('auth.forgot.checkEmailDesc', { email })}</p>
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" /> {t('auth.forgot.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('auth.forgot.title')}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('auth.forgot.subtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label={t('common.email')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  required
                  autoFocus
                />

                {error && (
                  <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2.5 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-10" loading={loading} size="lg">
                  {t('auth.forgot.send')}
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
