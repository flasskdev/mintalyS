import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (name.length < 4 || name.length > 32) {
      setError('Никнейм должен быть от 4 до 32 символов');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    setIsLoading(true);

    try {
      const hwid = localStorage.getItem('hwid') || undefined;
      const response = await register(email, password, name, hwid);
      
      if (response.success) {
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        setError(response.message || 'Ошибка регистрации');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-3 sm:p-4 bg-background overflow-x-hidden">
      <div className="w-full max-w-md my-auto">
        <div className="card p-5 sm:p-8 border-border/80 shadow-2xl animate-fade-in">
          <div className="text-center mb-4 sm:mb-6">
            <Link to="/dashboard" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white hover:text-zinc-200 transition-colors">
              Mintaly
            </Link>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground mt-2 sm:mt-3">Регистрация</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">Создайте ваш аккаунт</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
            <div>
              <label htmlFor="name" className="label block mb-1 text-xs sm:text-sm">
                Никнейм (4-32 символа)
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input input-icon-left text-sm py-2"
                  style={{ paddingLeft: '2.85rem' }}
                  placeholder="Введите никнейм"
                  required
                  autoComplete="username"
                  disabled={isLoading}
                  minLength={4}
                  maxLength={32}
                />
              </div>
            </div>

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
                  className="input input-icon-left text-sm py-2"
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
                Пароль (мин. 6 символов)
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input input-icon-left input-icon-right text-sm py-2"
                  style={{ paddingLeft: '2.85rem', paddingRight: '2.85rem' }}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                  minLength={6}
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

            <div>
              <label htmlFor="confirmPassword" className="label block mb-1 text-xs sm:text-sm">
                Подтвердите пароль
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input input-icon-left text-sm py-2"
                  style={{ paddingLeft: '2.85rem' }}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-2.5 font-semibold text-sm shadow-md mt-1"
              disabled={isLoading}
            >
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>

          <div className="mt-4 sm:mt-5 text-center text-xs sm:text-sm">
            <p className="text-muted-foreground text-xs">
              Уже есть аккаунт?{' '}
              <Link to="/login" className="text-zinc-200 hover:text-white hover:underline font-semibold transition-colors">
                Войти
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}