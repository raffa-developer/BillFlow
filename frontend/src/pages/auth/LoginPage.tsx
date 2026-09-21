import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Receipt, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/common/Spinner';

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
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-sidebar-background px-12 py-14 text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">BillFlow</span>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="font-display text-4xl font-bold leading-tight tracking-tight whitespace-pre-line">
              {t('auth.login.heroTitle')}
            </h2>
            <p className="text-sidebar-foreground/70 text-base max-w-xs">{t('auth.login.heroSubtitle')}</p>
          </div>

          <ul className="space-y-3">
            {(t('auth.login.features', { returnObjects: true }) as string[]).map((item) => (
              <li key={item} className="flex items-center gap-3 text-sidebar-foreground/70 text-sm">
                <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sidebar-foreground/50">{t('auth.login.copyright', { year: new Date().getFullYear() })}</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Receipt className="h-6 w-6" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight text-foreground">BillFlow</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t('auth.login.title')}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t('auth.login.subtitle')}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-7 shadow">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">{t('common.email')}</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">{t('auth.login.password')}</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Spinner className="h-4 w-4 border-primary-foreground border-t-transparent" />}
                {t('auth.login.signIn')}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/forgot" className="text-xs font-medium text-primary hover:underline">
                {t('auth.login.forgotPassword')}
              </Link>
            </div>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {t('auth.login.noAccount')}{' '}
              <Link to="/register" className="font-medium text-primary hover:underline">
                {t('auth.login.createAccount')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
