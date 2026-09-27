import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/helpers';

export function VerifyEmailPage({ onVerified }: { onVerified?: () => void | Promise<void> }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, verifyEmailSession, refreshProfile } = useAuth();

  const initialEmail = (searchParams.get('email') || user?.email || '').trim();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendSuccess, setResendSuccess] = useState('');
  const codeInputs = useRef<HTMLInputElement[]>([]);

  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail, email]);

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

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value) || value.length > 1) return;

    const newCode = code.split('');
    newCode[index] = value;
    const joinedCode = newCode.join('');
    setCode(joinedCode);

    if (value && index < 5) {
      codeInputs.current[index + 1]?.focus();
    } else if (!value && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }

    if (joinedCode.length === 6) {
      void handleVerify(joinedCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    setCode(pasted);
    if (pasted.length === 6) {
      void handleVerify(pasted);
    } else {
      codeInputs.current[pasted.length]?.focus();
    }
  };

  const handleVerify = async (codeToVerify?: string) => {
    const candidate = (codeToVerify ?? code).trim();
    if (candidate.length !== 6) return;

    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('Укажите email, на который был отправлен код');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await verifyEmailSession(candidate, targetEmail);

      if (response.success) {
        setSuccess(true);
        if (onVerified) {
          await Promise.resolve(onVerified());
        } else {
          await refreshProfile().catch(() => null);
        }
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setError(response.message || 'Неверный код подтверждения');
        setCode('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка при проверке кода');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    const targetEmail = email.trim();
    if (!targetEmail || resendCooldown > 0 || resendLoading) return;

    setResendLoading(true);
    setResendSuccess('');
    setError('');

    try {
      const res = await api.resendVerificationCode(targetEmail, 'verify');
      setResendCooldown(60);
      setResendSuccess(res.message || 'Новый код подтверждения отправлен на email');
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
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold mb-2 text-foreground">Email подтверждён!</h1>
              <p className="text-muted-foreground text-sm">Перенаправляем в личный кабинет...</p>
              <div className="mt-5 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-5">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Назад к входу
                </Link>
                <Link to="/dashboard" className="text-lg font-black tracking-tight text-white">
                  Mintaly
                </Link>
              </div>

              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-zinc-800/80 border border-zinc-700/60 rounded-full flex items-center justify-center mx-auto mb-3.5 text-zinc-200">
                  <Mail className="w-7 h-7" />
                </div>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                  Подтверждение регистрации
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm mt-1.5">
                  Введите 6-значный код подтверждения, отправленный на{' '}
                  <strong className="text-zinc-200">{email || 'ваш email'}</strong>
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-1">Код действителен 15 минут</p>
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

              {!initialEmail && (
                <div className="mb-4">
                  <label htmlFor="verify-email-input" className="label block mb-1 text-xs">
                    Ваш Email
                  </label>
                  <input
                    id="verify-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input text-sm py-2"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); void handleVerify(); }} className="space-y-5">
                <div className="flex justify-center gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      ref={(el) => { if (el) codeInputs.current[i] = el; }}
                      type="text"
                      maxLength={1}
                      value={code[i] || ''}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={handlePaste}
                      className={cn(
                        'w-10 h-12 text-center text-xl font-mono font-medium rounded-lg border-2 transition-colors',
                        'bg-background border-input focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-400/20',
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

                <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
                  <Link
                    to="/login"
                    className="text-muted-foreground hover:text-zinc-200 transition-colors"
                  >
                    Войти в другой аккаунт
                  </Link>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || resendLoading || !email}
                    className="text-zinc-200 hover:text-white font-medium disabled:text-muted-foreground transition-colors"
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
                  className="btn-primary w-full py-2.5 font-semibold text-sm shadow-md mt-2"
                  disabled={isLoading || code.length !== 6 || !email}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Проверка...
                    </span>
                  ) : (
                    'Завершить регистрацию'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}