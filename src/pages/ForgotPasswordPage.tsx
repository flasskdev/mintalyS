import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '../api/client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.forgotPassword(email);
      
      if (response.success) {
        setSuccess(true);
      } else {
        setError(response.message || 'Ошибка отправки кода');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-3 sm:p-4 bg-background overflow-x-hidden">
        <div className="w-full max-w-md my-auto">
          <div className="card p-5 sm:p-8 text-center border-border/80 shadow-2xl animate-fade-in">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-800/80 border border-zinc-700/60 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-zinc-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground mb-2">Код отправлен</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mb-5 sm:mb-6">
              Мы отправили 6-значный код на <strong className="text-foreground">{email}</strong>. Код действителен 15 минут.
            </p>
            <Link
              to={`/reset-password?email=${encodeURIComponent(email)}`}
              className="btn-primary w-full py-2.5 font-semibold text-sm shadow-md"
            >
              Ввести код
            </Link>
            <p className="mt-4 text-xs sm:text-sm text-muted-foreground">
              <Link to="/login" className="text-zinc-300 hover:text-white hover:underline transition-colors">
                ← Вернуться к входу
              </Link>
            </p>
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
            to="/login" 
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 sm:mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Назад
          </Link>
          
          <div className="text-center mb-5 sm:mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Восстановление пароля</h1>
            <p className="text-muted-foreground text-sm mt-1.5">Введите email для получения кода сброса</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label block mb-1.5">
                Email
              </label>
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

            <button
              type="submit"
              className="btn-primary w-full py-2.5 font-semibold text-sm shadow-md"
              disabled={isLoading}
            >
              {isLoading ? 'Отправка...' : 'Отправить код'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <Link to="/login" className="text-zinc-300 hover:text-white hover:underline transition-colors text-xs font-medium">
              ← Вернуться к входу
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}