import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Key, Loader2, Clock } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const ATTEMPT_STORAGE_KEY = 'mintaly_redeem_attempt_at';
const FALLBACK_COOLDOWN_MINUTES = 60;

function readLastAttempt(): number | null {
  const raw = localStorage.getItem(ATTEMPT_STORAGE_KEY);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function RedeemPage() {
  const { user, refreshProfile } = useAuth();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<number | null>(readLastAttempt);
  const [cooldownMinutes, setCooldownMinutes] = useState(FALLBACK_COOLDOWN_MINUTES);
  const [now, setNow] = useState(() => Date.now());

  const hasSubscription = !!user?.sub_active;

  useEffect(() => {
    api
      .getSettings()
      .then(response => {
        if (response.success && response.data?.settings) {
          const minutes = parseInt(response.data.settings.redeem_cooldown_minutes, 10);
          if (Number.isFinite(minutes) && minutes > 0) setCooldownMinutes(minutes);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cooldownMs = cooldownMinutes * 60000;
  const remainingMs = lastAttempt ? Math.max(0, cooldownMs - (now - lastAttempt)) : 0;
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const inCooldown = !hasSubscription && remainingMs > 0;

  const handleRedeem = async () => {
    const normalized = key.replace(/\s+/g, '').toUpperCase();

    if (normalized.length !== 64) {
      setError('Ключ должен содержать ровно 64 символа');
      return;
    }
    if (hasSubscription) {
      setError('У вас уже есть активная подписка');
      return;
    }
    if (inCooldown) {
      setError(`Попробуйте снова через ${remainingMinutes} мин.`);
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);

    const attemptAt = Date.now();
    localStorage.setItem(ATTEMPT_STORAGE_KEY, String(attemptAt));
    setLastAttempt(attemptAt);
    setNow(attemptAt);

    try {
      const response = await api.redeemKey(normalized);
      
      if (response.success) {
        setSuccess(response.message || 'Подписка успешно активирована!');
        setKey('');
        await refreshProfile();
        localStorage.removeItem(ATTEMPT_STORAGE_KEY);
        setLastAttempt(null);
      } else {
        setError(response.message || 'Неверный или использованный ключ');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка активации');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\s+/g, '').toUpperCase();
    if (text) setKey(text.slice(0, 64));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Redeem</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Активация подписки по ключу</p>
      </div>

      <div className="max-w-xl mx-auto">
        <div className="card p-6 space-y-6">
        <div className="p-4 bg-muted/40 border border-zinc-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">Как это работает</h3>
            <Key className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Введите 64-символьный ключ подписки. Ключ можно использовать только один раз.
            Активация доступна раз в {cooldownMinutes} мин.
          </p>
        </div>

        {hasSubscription ? (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">У вас уже есть активная подписка</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Активация ключа возможна только при отсутствии действующей подписки.
            </p>
          </div>
        ) : inCooldown ? (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-500">
              <Clock className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">Кулдаун активации</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Следующая попытка доступна через {remainingMinutes} мин.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="key" className="label block mb-1.5">Ключ подписки (64 символа)</label>
              <textarea
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value.replace(/\s+/g, '').toUpperCase().slice(0, 64))}
                onPaste={handlePaste}
                className="input min-h-[100px] font-mono text-sm resize-none"
                placeholder="Вставьте или введите 64-символьный ключ..."
                maxLength={64}
                disabled={isLoading}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Символов: {key.length}/64</span>
                <span>{key.length === 64 ? '✓' : '✗'}</span>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {success}
              </div>
            )}

            <button
              onClick={handleRedeem}
              disabled={isLoading || key.length !== 64}
              className="btn-primary w-full"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Активировать ключ'}
            </button>
          </>
        )}

        {!hasSubscription && !inCooldown && error && (
          <p className="text-xs text-muted-foreground text-center">
            Попытки активации доступны раз в {cooldownMinutes} мин.
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
