import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, Lock, AlertCircle, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../api/client';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const initial = searchParams.get('email');
    if (initial) setEmail(initial);
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await api.resetPassword(email, code, password);
      if (response.success) {
        setSuccess(response.message || 'Пароль изменён');
        setDone(true);
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setError(response.message || 'Ошибка сброса пароля');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Укажите email');
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.forgotPassword(email);
      if (response.success) {
        setResendCooldown(60);
        setNotice(response.message || 'Новый код отправлен');
      } else {
        setError(response.message || 'Ошибка отправки кода');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-3 sm:p-4 bg-background overflow-x-hidden">
        <div className="w-full max-w-md my-auto">
          <div className="card p-5 sm:p-8 text-center border-border/80 shadow-2xl animate-fade-in">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-800/80 border border-zinc-700/60 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-zinc-100" />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground mb-2">Пароль изменён</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mb-5 sm:mb-6">
              {success ? `${success}. ` : ''}Перенаправляем на страницу входа...
            </p>
            <Link to="/login" className="btn-primary w-full py-2.5 font-semibold text-sm shadow-md">
              Войти
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-3 sm:p-4 bg-background overflow-x-hidden">
      <div className="w-full max-w-md my-auto">
        <div className="card p-5 sm:p-8 border-border/80 shadow-2xl animate-fade-in">
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Назад
          </Link>

          <div className="text-center mb-5 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Новый пароль</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1 sm:mt-1.5">Введите код из письма и задайте новый пароль</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {notice && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input input-icon-left text-sm"
                  style={{ paddingLeft: '2.85rem' }}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="code" className="label block mb-1.5">Код подтверждения</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input input-icon-left tracking-[0.4em] text-center text-sm"
                  style={{ paddingLeft: '2.85rem' }}
                  placeholder="000000"
                  maxLength={6}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label block mb-1.5">Новый пароль</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input input-icon-left text-sm"
                  style={{ paddingLeft: '2.85rem' }}
                  placeholder="Минимум 6 символов"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label block mb-1.5">Повторите пароль</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input input-icon-left text-sm"
                  style={{ paddingLeft: '2.85rem' }}
                  placeholder="Ещё раз"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить пароль'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Не получили код?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={isLoading || resendCooldown > 0}
              className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {resendCooldown > 0 ? `Отправить повторно (${resendCooldown}с)` : 'Отправить повторно'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
