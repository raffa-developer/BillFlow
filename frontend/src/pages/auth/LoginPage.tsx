import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Receipt, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/ButtonLegacy';
import { Input } from '../../components/ui/InputLegacy';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('auth.login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-900 px-12 py-14 relative overflow-hidden">
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shrink-0">
            <Receipt className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">BillFlow</span>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl font-bold leading-tight text-white whitespace-pre-line">
              {t('auth.login.heroTitle')}
            </h2>
            <p className="text-slate-400 text-base max-w-xs">{t('auth.login.heroSubtitle')}</p>
          </div>

          <ul className="space-y-3">
            {(t('auth.login.features', { returnObjects: true }) as string[]).map((item) => (
              <li key={item} className="flex items-center gap-3 text-slate-400 text-sm">
                <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-600">{t('auth.login.copyright', { year: new Date().getFullYear() })}</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 py-12">
        <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">BillFlow</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('auth.login.title')}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('auth.login.subtitle')}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm">
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
              <Input
                label={t('auth.login.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2.5">
                  <span className="mt-0.5 shrink-0 text-red-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </span>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full h-10 text-sm" loading={loading} size="lg">
                {t('auth.login.signIn')}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/forgot" className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:underline">
                {t('auth.login.forgotPassword')}
              </Link>
            </div>

            <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('auth.login.noAccount')}{' '}
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
                {t('auth.login.createAccount')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
