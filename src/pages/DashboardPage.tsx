import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Download, 
  MessageSquare, 
  Shield, 
  Crown,
  ArrowRight,
  Bell,
  Package,
  RotateCcw
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { cn, formatDateShort } from '../utils/helpers';
import type { News, Subscription } from '../types';

export function DashboardPage() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [news, setNews] = useState<News[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [subsLoading, setSubsLoading] = useState(true);

  const hasSubscription = Boolean(user?.sub_active);
  const isDev = Boolean(user?.dev);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [newsRes, subsRes] = await Promise.all([
          api.getNews(1, 5),
          api.getSubscriptions(),
        ]);
        
        if (newsRes.success && newsRes.data?.items) {
          setNews(newsRes.data.items);
        }
        if (subsRes.success && subsRes.data?.subs) {
          setSubscriptions(subsRes.data.subs.filter(s => s.is_visible));
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setNewsLoading(false);
        setSubsLoading(false);
      }
    };

    fetchData();
  }, []);

  const popularSub = subscriptions.find(s => s.is_popular) || subscriptions[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mintaly</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Добро пожаловать, {user?.name}! {hasSubscription ? 'Активная подписка' : 'Подписка не оформлена'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasSubscription && (
            <Link to="/download" className="btn-primary">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Link>
          )}
          <Link to="/forum" className="btn-secondary">
            <MessageSquare className="w-4 h-4 mr-2" />
            Forum
          </Link>
          {isDev && (
            <Link to="/admin" className="btn-outline">
              <Crown className="w-4 h-4 mr-2" />
              Admin
            </Link>
          )}
        </div>
      </div>

      {!hasSubscription && (
        <div className="card p-6 bg-zinc-900/60 border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <Package className="w-5 h-5 text-zinc-300" />
                Для начала приобретите подписку
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Получите доступ к скачиванию, закрытым разделам форума и другим функциям
              </p>
            </div>
            <Link to="/subscription" className="btn-primary whitespace-nowrap">
              Выбрать план
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Новости</h2>
            <Link to="/news" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:inline">
              Все новости →
            </Link>
          </div>

          {newsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-6 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-4 bg-muted rounded w-full mb-2" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                </div>
              ))}
            </div>
          ) : news.length === 0 ? (
            <div className="card p-8 text-center text-muted-foreground">
              Новостей пока нет
            </div>
          ) : (
            <div className="space-y-4">
              {news.map(item => (
                <Link 
                  key={item.id} 
                  to={`/news/${item.id}`}
                  className="card p-4 card-hover hover:border-zinc-500/40 transition-all group block"
                >
                  <h3 className="font-medium text-lg text-foreground group-hover:text-white transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                    {item.short_desc}
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {formatDateShort(item.created_at)}
                    </span>
                    <span className="text-sm text-zinc-200 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                      Подробнее
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-4">
            <h3 className="font-semibold mb-4 text-foreground">Популярный план</h3>
            {subsLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-6 bg-muted rounded" />
                <div className="h-4 bg-muted rounded" />
                <div className="h-4 bg-muted rounded" />
              </div>
            ) : popularSub ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {formatPrice(popularSub.final_cost !== undefined && popularSub.final_cost < popularSub.cost 
                      ? popularSub.final_cost 
                      : popularSub.cost)}
                  </span>
                  {popularSub.final_cost !== undefined && popularSub.final_cost < popularSub.cost && (
                    <span className="text-muted-foreground line-through text-sm">
                      {formatPrice(popularSub.cost)}
                    </span>
                  )}
                  <span className="text-muted-foreground text-sm">/ {popularSub.sub_days} дн.</span>
                </div>
                <p className="text-sm text-muted-foreground">{popularSub.description}</p>
                <Link to="/subscription" className="btn-primary w-full text-sm">
                  Купить {popularSub.name}
                </Link>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Планы загружаются...</p>
            )}
          </div>

          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
              <Shield className="w-5 h-5 text-zinc-300" />
              Ваш статус
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Никнейм</span>
                <span className="font-medium text-foreground">{user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium truncate max-w-[150px] text-foreground">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-medium text-foreground">#{user?.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Подписка</span>
                <span className={cn('font-medium', hasSubscription ? 'text-zinc-200' : 'text-muted-foreground')}>
                  {hasSubscription 
                    ? `Активна (${user?.sub_days_left} дн.)` 
                    : 'Нет'}
                </span>
              </div>
              {Boolean(user?.hwid) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">HWID</span>
                  <span className="font-medium truncate max-w-[150px] font-mono text-xs text-foreground">
                    {user?.hwid}
                  </span>
                </div>
              )}
              {isDev && (
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground">Роль</span>
                  <span className="font-medium text-zinc-200 flex items-center gap-1">
                    <Crown className="w-4 h-4 text-zinc-300" />
                    Developer
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Быстрые действия
            </h3>
            <div className="space-y-2">
              <Link to="/tickets" className="btn-outline w-full justify-start">
                <MessageSquare className="w-4 h-4 mr-2" />
                Обращения в поддержку
              </Link>
              <Link to="/redeem" className="btn-outline w-full justify-start">
                <Package className="w-4 h-4 mr-2" />
                Активировать ключ
              </Link>
              <Link to="/reset" className="btn-outline w-full justify-start">
                <RotateCcw className="w-4 h-4 mr-2" />
                Сбросить HWID
              </Link>
              {hasSubscription && (
                <Link to="/download" className="btn-primary w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Скачать программу
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}