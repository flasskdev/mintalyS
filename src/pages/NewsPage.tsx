import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, User, Clock, MessageSquare, MoreVertical, Edit, Trash2, Eye } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cn, formatDate, timeAgo } from '../utils/helpers';
import type { News, NewsComment } from '../types';

const COMMENTS_PER_PAGE = 10;

export function NewsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [news, setNews] = useState<News | null>(null);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [error, setError] = useState('');
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [commentPage, setCommentPage] = useState(1);

  useEffect(() => {
    if (id) {
      loadNews();
    }
  }, [id]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.comment-menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const loadNews = async () => {
    setLoading(true);
    try {
      const response = await api.getNewsItem(parseInt(id!));
      if (response.success && response.data) {
        setNews(response.data.news);
        setComments(response.data.comments);
      } else {
        navigate('/news');
      }
    } catch (error) {
      console.error('Failed to load news:', error);
      navigate('/news');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !news) return;

    setError('');
    setReplying(true);
    try {
      const response = await api.addNewsComment(news.id, replyContent);
      if (response.success && response.data?.comment) {
        setComments(prev => [response.data!.comment, ...prev]);
        setReplyContent('');
        setCommentPage(1);
      } else {
        setError(response.message || 'Ошибка отправки');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    } finally {
      setReplying(false);
    }
  };

  const handleEdit = async (commentId: number) => {
    if (!editContent.trim()) return;

    try {
      const response = await api.editNewsComment(commentId, editContent);
      if (response.success) {
        setComments(prev => prev.map(c => c.id === commentId ? {
          ...c,
          content: editContent,
          is_edited: true,
          updated_at: new Date().toISOString()
        } : c));
        setEditingComment(null);
        setEditContent('');
        setOpenMenuId(null);
      } else {
        setError(response.message || 'Ошибка редактирования');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('Удалить этот комментарий?')) return;

    try {
      const response = await api.deleteNewsComment(commentId);
      if (response.success) {
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_deleted: 1 } : c));
        setOpenMenuId(null);
      } else {
        setError(response.message || 'Ошибка удаления');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  const isOwnComment = (comment: NewsComment) => comment.user_id === user?.id;
  const canManageComment = (comment: NewsComment) => isOwnComment(comment) || Boolean(user?.dev);

  const totalCommentPages = Math.ceil(comments.length / COMMENTS_PER_PAGE) || 1;
  const paginatedComments = comments.slice((commentPage - 1) * COMMENTS_PER_PAGE, commentPage * COMMENTS_PER_PAGE);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card p-6 animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4" />
          <div className="h-4 bg-muted rounded w-full mb-2" />
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!news) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <Link to="/dashboard" className="btn-primary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        На главную
      </Link>

      <article className="card overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            {news.is_pinned && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                Закреплено
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold mb-3">{news.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {news.author_id ? `Author #${news.author_id}` : 'Mintaly Team'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(news.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              {comments.filter(c => !c.is_deleted).length} комментариев
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {news.views} просмотров
            </span>
          </div>
        </div>

        <div className="p-6 border-b border-border prose max-w-none text-zinc-300 leading-relaxed">
          {news.content.split('\n').map((line, i) => (
            <p key={i} className="whitespace-pre-wrap">{line}</p>
          ))}
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Комментарии ({comments.filter(c => !c.is_deleted).length})
            </h2>
            {totalCommentPages > 1 && (
              <span className="text-xs text-muted-foreground">
                Страница {commentPage} из {totalCommentPages}
              </span>
            )}
          </div>

          {user ? (
            <div className="mb-6 p-4 rounded-xl bg-zinc-850/50 border border-border/80 shadow-sm">
              <h3 className="font-medium mb-2.5 text-xs text-muted-foreground uppercase tracking-wider">
                Оставить комментарий
              </h3>
              {error && (
                <div className="mb-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm animate-fade-in">
                  {error}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="input flex-1 min-h-[75px] resize-y text-sm"
                  placeholder="Напишите ваш комментарий..."
                  disabled={replying}
                />
                <button
                  onClick={handleReply}
                  disabled={replying || !replyContent.trim()}
                  className="btn-primary sm:self-end text-sm py-2 px-5 shadow-sm"
                >
                  {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Отправить'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-3.5 rounded-lg bg-zinc-900/40 border border-dashed border-zinc-800 text-xs text-muted-foreground text-center">
              <Link to="/login" className="text-zinc-200 hover:underline font-medium">Войдите</Link>, чтобы оставить комментарий
            </div>
          )}

          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Пока нет комментариев. Будьте первым!
              </p>
            ) : (
              paginatedComments.map(comment => (
                <div key={comment.id} className={cn(comment.is_deleted && 'opacity-50', 'transition-all duration-150')}>
                  {comment.is_deleted ? (
                    <div className="text-center text-muted-foreground py-3 bg-zinc-900/30 rounded-lg border border-dashed border-zinc-800 text-xs">
                      Комментарий удален
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-100 font-semibold text-xs flex-shrink-0">
                        {comment.user?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-foreground">{comment.user?.name || `User #${comment.user_id}`}</span>
                          <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
                          {Boolean(comment.is_edited || (comment.updated_at && comment.created_at && comment.updated_at !== comment.created_at)) && (
                            <span
                              className="text-xs text-muted-foreground font-normal hover:text-zinc-300 transition-colors"
                              title={comment.updated_at ? `Изменено: ${formatDate(comment.updated_at)}` : 'Изменено'}
                            >
                              (ред.)
                            </span>
                          )}
                        </div>
                        {editingComment === comment.id ? (
                          <div className="space-y-2 mt-2">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="input min-h-[80px] resize-y"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(comment.id)}
                                className="btn-primary text-xs py-1.5 px-3"
                              >
                                Сохранить
                              </button>
                              <button
                                onClick={() => { setEditingComment(null); setEditContent(''); }}
                                className="btn-outline text-xs py-1.5 px-3"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="prose max-w-none whitespace-pre-wrap text-sm text-zinc-300">
                            {comment.content}
                          </div>
                        )}
                      </div>
                      {canManageComment(comment) && (
                        <div className="relative comment-menu-container">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === comment.id ? null : comment.id);
                            }}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                            aria-label="Опции комментария"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === comment.id && (
                            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl py-1 z-20 min-w-[140px] animate-scale-in origin-top-right">
                              {!editingComment && (
                                <button
                                  onClick={() => {
                                    setEditingComment(comment.id);
                                    setEditContent(comment.content);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent flex items-center gap-2 text-zinc-200"
                                >
                                  <Edit className="w-3.5 h-3.5 text-zinc-400" />
                                  Редактировать
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(comment.id)}
                                className="w-full px-3 py-1.5 text-left text-xs text-destructive hover:bg-accent flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Удалить
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Comment pagination controls */}
          {totalCommentPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border mt-6">
              <div className="text-xs text-muted-foreground">
                Страница {commentPage} из {totalCommentPages}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCommentPage(p => Math.max(1, p - 1))}
                  disabled={commentPage <= 1}
                  className="btn-outline px-2.5 py-1 text-xs disabled:opacity-40"
                >
                  Назад
                </button>
                {Array.from({ length: totalCommentPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setCommentPage(p)}
                    className={cn(
                      'w-7 h-7 rounded-lg text-xs font-medium transition-colors',
                      commentPage === p
                        ? 'bg-zinc-100 text-zinc-950 font-bold'
                        : 'hover:bg-zinc-800 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setCommentPage(p => Math.min(totalCommentPages, p + 1))}
                  disabled={commentPage >= totalCommentPages}
                  className="btn-outline px-2.5 py-1 text-xs disabled:opacity-40"
                >
                  Вперед
                </button>
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}