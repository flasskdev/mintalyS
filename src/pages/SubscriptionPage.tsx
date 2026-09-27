import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Crown, Tag, Calendar, AlertCircle, Download } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { CurrencySwitcher } from '../components/CurrencySwitcher';
import { cn } from '../utils/helpers';
import type { Subscription } from '../types';

export function SubscriptionPage() {
  const { user, refreshProfile } = useAuth();
  const { formatPrice } = useCurrency();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      const response = await api.getSubscriptions();
      if (response.success && response.data?.subs) {
        setSubscriptions(response.data.subs.filter(s => s.is_visible));
      }
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (subId: number) => {
    setError('');
    setSuccess('');
    setBuying(subId);
    try {
      const response = await api.buySubscription(subId);
      if (response.success) {
        setSuccess(response.message || 'Подписка успешно приобретена!');
        // a pending order does not change the subscription yet
        if (response.data?.order_status !== 'pending') {
          await refreshProfile();
        }
      } else {
        setError(response.message || 'Ошибка покупки');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBuying(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-10 bg-muted/60 rounded-lg w-1/3 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-1/3 mb-4" />
              <div className="h-8 bg-muted rounded w-1/2 mb-4" />
              <div className="h-4 bg-muted rounded w-full mb-2" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasSubscription = Boolean(user?.sub_active);
  const currentSub = subscriptions.find(s => s.id === user?.sub_id);
  const displayedSubscriptions = hasSubscription
    ? (currentSub ? [currentSub] : subscriptions.filter(s => s.id === user?.sub_id))
    : subscriptions;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Подписки</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {hasSubscription ? 'Ваш текущий активный план подписки' : 'Выберите подходящий план для доступа ко всем функциям'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Валюта:</span>
          <CurrencySwitcher size="md" />
        </div>
      </div>

      {hasSubscription && (
        <div className="card p-4 bg-zinc-800/40 border-zinc-700/60 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-700/40 border border-zinc-600/50 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-zinc-200" />
            </div>
            <div>
              <p className="font-medium text-foreground">У вас активная подписка</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Осталось дней: <span className="text-zinc-200 font-medium">{user?.sub_days_left}</span> | План: <span className="text-zinc-200 font-medium">{currentSub?.name || 'Активная подписка'}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-zinc-800/80 border border-zinc-700 rounded-lg text-zinc-100 text-sm flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-zinc-300 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className={cn(
        'grid gap-6',
        hasSubscription ? 'grid-cols-1 max-w-md' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      )}>
        {displayedSubscriptions.map(sub => {
          const isPopular = Boolean(Number(sub.is_popular));
          const hasDiscount = sub.final_cost !== undefined && sub.final_cost < sub.cost;
          const price = hasDiscount ? sub.final_cost! : sub.cost;
          const originalPrice = hasDiscount ? sub.cost : null;
          
          const isCurrent = user?.sub_id === sub.id && hasSubscription;
          const canBuy = !isCurrent;

          return (
            <div
              key={sub.id}
              className={cn(
                'card p-6 relative flex flex-col card-hover',
                isPopular && 'border-zinc-500/60 ring-1 ring-zinc-500/20',
                isCurrent && 'border-zinc-400/40 bg-zinc-800/30'
              )}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-zinc-100 text-zinc-950 text-xs font-bold rounded-full shadow-md tracking-wide">
                  Популярный
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-semibold text-lg text-foreground">{sub.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{sub.description}</p>
              </div>

              <div className="mb-4 space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-foreground tracking-tight">
                    {formatPrice(price)}
                  </span>
                  {originalPrice && (
                    <span className="text-muted-foreground line-through text-sm">
                      {formatPrice(originalPrice)}
                    </span>
                  )}
                  <span className="text-muted-foreground text-sm font-medium">/ {sub.sub_days} дн.</span>
                </div>
                {hasDiscount && sub.discount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-xs rounded font-medium">
                    <Tag className="w-3 h-3 text-zinc-400" />
                    -{sub.discount}%
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-3 mb-6 pt-3 border-t border-border/80">
                <div className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{sub.sub_days} дней подписки</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <Crown className="w-4 h-4 text-muted-foreground" />
                  <span>Доступ к закрытым разделам</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <Download className="w-4 h-4 text-muted-foreground" />
                  <span>Скачивание программы</span>
                </div>
              </div>

              <button
                onClick={() => handleBuy(sub.id)}
                disabled={buying === sub.id || !canBuy}
                className={cn(
                  'w-full py-2.5 font-medium transition-all duration-150',
                  isCurrent ? 'btn-secondary' : 'btn-primary'
                )}
              >
                {buying === sub.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrent ? (
                  'Текущий план'
                ) : (
                  'Оформить подписку'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {subscriptions.length === 0 && (
        <div className="card p-8 text-center text-muted-foreground">
          <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Нет доступных планов подписки</p>
        </div>
      )}
    </div>
  );
}