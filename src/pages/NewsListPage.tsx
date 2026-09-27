import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, Pin, Eye, MessageSquare, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import { cn, formatDateShort, timeAgo, truncate } from '../utils/helpers';
import type { News, PaginatedResponse } from '../types';

const PER_PAGE = 10;

export function NewsListPage() {
  const [items, setItems] = useState<News[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNews(page);
  }, [page]);

  const loadNews = async (targetPage: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getNews(targetPage, PER_PAGE);
      const data = response.data as PaginatedResponse<News> | undefined;
      if (response.success && data) {
        setItems(data.items);
        setTotal(data.total);
        setTotalPages(Math.max(data.total_pages, 1));
        setPage(data.page);
      } else {
        setError(response.message || 'Не удалось загрузить новости');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Новости</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Обновления, релизы и объявления</p>
      </div>

      <div className="max-w-3xl space-y-6">

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/2 mb-2" />
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center text-muted-foreground">
          <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Новостей пока нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(news => (
            <Link
              key={news.id}
              to={`/news/${news.id}`}
              className={cn(
                'card p-4 hover:border-primary/50 transition-colors block',
                Number(news.is_pinned) === 1 && 'border-primary/30',
              )}
            >
              <div className="flex items-start gap-3">
                {Number(news.is_pinned) === 1 && <Pin className="w-4 h-4 text-primary mt-1 flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold mb-1">{news.title}</h2>
                  {news.short_desc && (
                    <p className="text-sm text-muted-foreground mb-2">{truncate(news.short_desc, 160)}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatDateShort(news.created_at)}</span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {news.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {news.comments_count ?? 0}
                    </span>
                    <span className="ml-auto">{timeAgo(news.updated_at ?? news.created_at)}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && total > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            Страница {page} из {totalPages} · всего {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-outline"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-outline"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center pt-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}
      </div>
    </div>
  );
}
