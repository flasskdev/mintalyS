import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Clock, Info, Loader2, Shield, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate, parseDate } from '../utils/helpers';

const FALLBACK_RESET_DAYS = 30;

export function ResetPage() {
  const { user, refreshProfile } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hwidResetDays, setHwidResetDays] = useState(FALLBACK_RESET_DAYS);
  const [nextReset, setNextReset] = useState<Date | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then(response => {
        if (response.success && response.data?.settings) {
          const days = parseInt(response.data.settings.hwid_reset_days, 10);
          if (Number.isFinite(days) && days > 0) setHwidResetDays(days);
        }
      })
      .catch(() => undefined);
  }, []);

  const computeNextReset = useCallback(() => {
    const last = parseDate(user?.hwid_reset_at);
    if (!last) {
      setNextReset(null);
      return;
    }
    setNextReset(new Date(last.getTime() + hwidResetDays * 24 * 60 * 60 * 1000));
  }, [user?.hwid_reset_at, hwidResetDays]);

  useEffect(() => {
    computeNextReset();
  }, [computeNextReset]);

  const canReset = !nextReset || nextReset.getTime() <= Date.now();

  const handleReset = async () => {
    if (!canReset) return;

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await api.resetHwid();
      
      if (response.success) {
        setSuccess(response.message || 'HWID сброшен. Он будет привязан при следующем входе.');
        setTimeout(() => setSuccess(''), 5000);
        await refreshProfile();
        computeNextReset();
      } else {
        setError(response.message || 'Ошибка сброса HWID');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reset HWID</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Сброс привязки оборудования</p>
      </div>

      <div className="max-w-xl mx-auto">
        <div className="card p-6 space-y-6">
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <Shield className="w-8 h-8 text-muted-foreground" />
          <div>
            <h3 className="font-medium">Что делает сброс HWID</h3>
            <p className="text-sm text-muted-foreground">
              Сбрасывает привязку вашего аккаунта к текущему оборудованию. 
              При следующем входе в лаунчере HWID автоматически обновится на текущий.
            </p>
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

        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-3">Текущий статус</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Текущий HWID</span>
                <span className="font-mono text-xs truncate max-w-[200px]">
                  {user?.hwid || 'Не привязан'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сбросов всего</span>
                <span>{user?.hwid_reset_count || 0}</span>
              </div>
              {user?.hwid_reset_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Последний сброс</span>
                  <span>{formatDate(user.hwid_reset_at)}</span>
                </div>
              )}
            </div>
          </div>

          {canReset ? (
            <>
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">Сброс доступен</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Вы можете сбросить HWID прямо сейчас.
                </p>
              </div>

              <button
                onClick={handleReset}
                disabled={isLoading}
                className="btn-destructive w-full"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сбросить HWID'}
              </button>
            </>
          ) : (
            <>
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-500">
                  <Clock className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">Сброс недоступен</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Следующий сброс будет доступен {nextReset ? formatDate(nextReset.toISOString()) : `через ${hwidResetDays} дней`}
                </p>
              </div>

              <button
                onClick={handleReset}
                disabled
                className="btn-destructive w-full opacity-50 cursor-not-allowed"
              >
                Сбросить HWID
              </button>
            </>
          )}

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              <Info className="w-3 h-3 inline mr-1" />
              Сброс HWID доступен раз в {hwidResetDays} дней. 
              После сброса старый HWID перестанет работать.
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
