import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MessageSquare, Lock, Loader2, Hash, User, Clock, ChevronRight, XCircle } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cn, timeAgo } from '../utils/helpers';
import type { ForumCategory, ForumThread } from '../types';

export function ForumPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<number>(1);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [, setLoading] = useState(true);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadThreads();
  }, [activeCategory, page]);

  const loadCategories = async () => {
    try {
      const response = await api.getForumCategories();
      if (response.success && response.data?.categories) {
        setCategories(response.data.categories);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadThreads = async () => {
    setThreadsLoading(true);
    try {
      const response = await api.getForumThreads(activeCategory, page, 20);
      if (response.success && response.data?.items) {
        if (page === 1) {
          setThreads(response.data.items);
        } else {
          setThreads(prev => [...prev, ...response.data!.items]);
        }
        setHasMore(response.data.items.length === 20);
      }
    } catch (error) {
      console.error('Failed to load threads:', error);
    } finally {
      setThreadsLoading(false);
      setLoading(false);
    }
  };

  const handleCreateThread = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Заполните все поля');
      return;
    }

    setError('');
    setCreating(true);
    try {
      const response = await api.createForumThread(activeCategory, title, content);
      if (response.success) {
        setShowCreate(false);
        setTitle('');
        setContent('');
        setPage(1);
        loadThreads();
      } else {
        setError(response.message || 'Ошибка создания');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    } finally {
      setCreating(false);
    }
  };

  const canPostInCategory = (category: ForumCategory) => {
    if (!category.min_sub_required) return true;
    return user?.sub_active === true;
  };

  const currentCategory = categories.find(c => c.id === activeCategory);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-zinc-300" />
            Forum
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Обсуждения и помощь</p>
        </div>
        {canPostInCategory(currentCategory!) && (
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Новая тема
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border">
          <nav className="flex overflow-x-auto scrollbar-thin" aria-label="Forum categories">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => { setActiveCategory(category.id); setPage(1); }}
                className={cn(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                  activeCategory === category.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
                disabled={!!category.is_locked}
              >
                <span className="flex items-center gap-1">
                  {category.name}
                  {category.min_sub_required && (
                    <Lock className="w-3 h-3" />
                  )}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4">
          {showCreate && (
            <div className="space-y-4 mb-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Создать тему</h3>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="title" className="label block mb-1.5">Заголовок</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="Тема обсуждения"
                  maxLength={180}
                />
              </div>

              <div>
                <label htmlFor="content" className="label block mb-1.5">Содержимое</label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input min-h-[150px] resize-y"
                  placeholder="Ваше сообщение..."
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateThread}
                  disabled={creating}
                  className="btn-primary"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Создать'}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="btn-outline"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {threadsLoading && page === 1 ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse border-b border-border pb-4 last:border-0">
                  <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-full mb-1" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>В этой категории пока нет тем</p>
              {canPostInCategory(currentCategory!) && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 btn-primary"
                >
                  Создать первую тему
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-0">
                {threads.map(thread => (
                  <Link
                    key={thread.id}
                    to={`/forum/${thread.id}`}
                    className="block p-4 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium group-hover:text-primary transition-colors truncate">
                            {thread.is_pinned && <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                            {thread.title}
                          </h3>
                          {thread.is_locked && <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {thread.user?.name || `User #${thread.user_id}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(thread.last_post_at || thread.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {thread.posts_count} ответов
                          </span>
                          <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {thread.views} просмотров
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>

              {hasMore && (
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={threadsLoading}
                  className="btn-outline w-full mt-4"
                >
                  {threadsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Загрузить еще'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!user?.sub_active && (
        <div className="card p-6 bg-yellow-500/10 border-yellow-500/20">
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6 text-yellow-500" />
            <div>
              <h3 className="font-medium">Закрытые разделы</h3>
              <p className="text-sm text-muted-foreground">
                Некоторые разделы форума доступны только для владельцев активной подписки.
                <Link to="/subscription" className="text-primary hover:underline ml-1">
                  Приобрести подписку
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}