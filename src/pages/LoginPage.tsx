import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Eye, EyeOff, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { cn } from '../utils/helpers';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Developer 2FA state
  const [isDev2FA, setIsDev2FA] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const codeInputs = useRef<HTMLInputElement[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const hwid = localStorage.getItem('hwid') || undefined;
      const response = await login(email, password, hwid);

      if (response.two_factor_required) {
        setIsDev2FA(true);
        setTwoFaCode('');
        setResendCooldown(60);
        return;
      }

      if (response.requires_verification) {
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      if (response.success) {
        if (response.banned) {
          setError('Аккаунт заблокирован. Обратитесь в поддержку.');
          return;
        }
        navigate('/dashboard');
      } else {
        setError(response.message || 'Ошибка входа');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDev2FASubmit = async (candidateCode?: string) => {
    const code = (candidateCode ?? twoFaCode).trim();
    if (code.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const hwid = localStorage.getItem('hwid') || undefined;
      const response = await login(email, password, hwid, code);

      if (response.success) {
        if (response.banned) {
          setError('Аккаунт заблокирован. Обратитесь в поддержку.');
          return;
        }
        navigate('/dashboard');
      } else {
        setError(response.message || 'Неверный код подтверждения');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка при проверке кода');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val) || val.length > 1) return;

    const newCode = twoFaCode.split('');
    newCode[index] = val;
    const joined = newCode.join('');
    setTwoFaCode(joined);

    if (val && index < 5) {
      codeInputs.current[index + 1]?.focus();
    } else if (!val && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }

    if (joined.length === 6) {
      void handleDev2FASubmit(joined);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !twoFaCode[index] && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    setTwoFaCode(pasted);
    if (pasted.length === 6) {
      void handleDev2FASubmit(pasted);
    } else {
      codeInputs.current[pasted.length]?.focus();
    }
  };

  const handleResendDevCode = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setResendSuccess('');
    setError('');

    try {
      await api.resendVerificationCode(email, 'dev_login');
      setResendCooldown(60);
      setResendSuccess('Новый код отправлен на почту разработчика');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки кода');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-3 sm:p-4 bg-background overflow-x-hidden">
      <div className="w-full max-w-md my-auto">
        <div className="card p-5 sm:p-8 border-border/80 shadow-2xl animate-fade-in">
          {isDev2FA ? (
            <div>
              <div className="text-center mb-5 sm:mb-6">
                <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                  Вход разработчика
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm mt-1.5">
                  На почту разработчика <strong className="text-zinc-200">{email}</strong> отправлен код безопасности
                </p>
                <p className="text-[11px] text-amber-400/80 mt-1">
                  Проверьте почту для подтверждения входа в аккаунт разработчика
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {resendSuccess && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
                  {resendSuccess}
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); void handleDev2FASubmit(); }} className="space-y-5">
                <div className="flex justify-center gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      ref={(el) => { if (el) codeInputs.current[i] = el; }}
                      type="text"
                      maxLength={1}
                      value={twoFaCode[i] || ''}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={handlePaste}
                      className={cn(
                        'w-10 h-12 text-center text-xl font-mono font-medium rounded-lg border-2 transition-colors',
                        'bg-background border-input focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20',
                        'disabled:opacity-50'
                      )}
                      disabled={isLoading}
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <button
                    type="button"
                    onClick={() => { setIsDev2FA(false); setError(''); setTwoFaCode(''); }}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Назад к паролю
                  </button>
                  <button
                    type="button"
                    onClick={handleResendDevCode}
                    disabled={resendCooldown > 0 || resendLoading}
                    className="text-amber-400 hover:text-amber-300 disabled:text-muted-foreground transition-colors"
                  >
                    {resendCooldown > 0
                      ? `Повтор через ${resendCooldown}с`
                      : resendLoading
                        ? 'Отправка...'
                        : 'Отправить снова'}
                  </button>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full py-2.5 font-semibold text-sm shadow-md"
                  disabled={isLoading || twoFaCode.length !== 6}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Проверка...
                    </span>
                  ) : (
                    'Подтвердить вход'
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <div className="text-center mb-5 sm:mb-8">
                <Link to="/dashboard" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white hover:text-zinc-200 transition-colors">
                  Mintaly
                </Link>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground mt-2 sm:mt-4">Вход в аккаунт</h1>
                <p className="text-muted-foreground text-xs sm:text-sm mt-1 sm:mt-1.5">Введите ваши данные для входа</p>
              </div>

              {error && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
                <div>
                  <label htmlFor="email" className="label block mb-1 text-xs sm:text-sm">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input input-icon-left text-sm py-2 sm:py-2.5"
                      style={{ paddingLeft: '2.85rem' }}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="label block mb-1 text-xs sm:text-sm">
                    Пароль
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input input-icon-left input-icon-right text-sm py-2 sm:py-2.5"
                      style={{ paddingLeft: '2.85rem', paddingRight: '2.85rem' }}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full py-2.5 font-semibold text-sm shadow-md mt-1"
                  disabled={isLoading}
                >
                  {isLoading ? 'Вход...' : 'Войти'}
                </button>
              </form>

              <div className="mt-4 sm:mt-6 space-y-1.5 sm:space-y-2 text-center text-xs sm:text-sm">
                <Link to="/forgot-password" className="text-zinc-400 hover:text-zinc-200 hover:underline block transition-colors">
                  Забыли пароль?
                </Link>
                <p className="text-muted-foreground text-xs pt-1">
                  Нет аккаунта?{' '}
                  <Link to="/register" className="text-zinc-200 hover:text-white hover:underline font-semibold transition-colors">
                    Зарегистрироваться
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}