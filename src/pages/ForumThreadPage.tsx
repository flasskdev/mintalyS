import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, User, Clock, MoreVertical, Edit, Trash2, XCircle, Hash, Lock, MessageSquare } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cn, formatDate, timeAgo } from '../utils/helpers';
import type { ForumThread, ForumPost } from '../types';

const POSTS_PER_PAGE = 10;

export function ForumThreadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [error, setError] = useState('');
  const [editingPost, setEditingPost] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [postPage, setPostPage] = useState(1);
  const postsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      loadThread();
    }
  }, [id]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.post-menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const loadThread = async () => {
    setLoading(true);
    try {
      const response = await api.getForumThread(parseInt(id!));
      if (response.success && response.data) {
        setThread(response.data.thread);
        setPosts(response.data.posts);
      } else {
        navigate('/forum');
      }
    } catch (error) {
      console.error('Failed to load thread:', error);
      navigate('/forum');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !thread) return;

    setError('');
    setReplying(true);
    try {
      const response = await api.createForumPost(thread.id, replyContent);
      if (response.success && response.data?.post) {
        setPosts(prev => [...prev, response.data!.post]);
        setReplyContent('');
        setPostPage(Math.ceil((posts.length + 1) / POSTS_PER_PAGE));
      } else {
        setError(response.message || 'Ошибка отправки');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    } finally {
      setReplying(false);
    }
  };

  const handleEdit = async (postId: number) => {
    if (!editContent.trim()) return;

    try {
      const response = await api.editForumPost(postId, editContent);
      if (response.success) {
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          content: editContent,
          is_edited: true,
          updated_at: new Date().toISOString()
        } : p));
        setEditingPost(null);
        setEditContent('');
        setOpenMenuId(null);
      } else {
        setError(response.message || 'Ошибка редактирования');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  const handleDelete = async (postId: number) => {
    if (!confirm('Удалить это сообщение?')) return;

    try {
      const response = await api.deleteForumPost(postId);
      if (response.success) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_deleted: 1 } : p));
        setOpenMenuId(null);
      } else {
        setError(response.message || 'Ошибка удаления');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  const isOwnPost = (post: ForumPost) => post.user_id === user?.id;
  const canManagePost = (post: ForumPost) => isOwnPost(post) || Boolean(user?.dev);

  const totalPostPages = Math.ceil(posts.length / POSTS_PER_PAGE) || 1;
  const paginatedPosts = posts.slice((postPage - 1) * POSTS_PER_PAGE, postPage * POSTS_PER_PAGE);

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

  if (!thread) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <Link to="/forum" className="btn-primary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          К форуму
        </Link>
      </div>
    );
  }

  const canReply = !thread.is_locked && (!thread.category?.min_sub_required || Boolean(user?.sub_active));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/forum" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к форуму
      </Link>

      <div className="card overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border">
          <div className="flex items-center gap-2 mb-1.5">
            {Boolean(thread.is_pinned) && <Hash className="w-4 h-4 text-muted-foreground" />}
            {Boolean(thread.is_locked) && <Lock className="w-4 h-4 text-muted-foreground" />}
            <h1 className="text-xl font-semibold text-foreground">{thread.title}</h1>
          </div>
          <div className="flex items-center gap-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {thread.user?.name || `User #${thread.user_id}`}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(thread.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              {thread.posts_count} ответов
            </span>
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              {thread.views} просмотров
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-b border-border">
          <div className="prose max-w-none text-zinc-300 leading-relaxed text-sm sm:text-base">
            {thread.content.split('\n').map((line, i) => (
              <p key={i} className="whitespace-pre-wrap">{line}</p>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border">
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Пока нет ответов в этой теме.
            </p>
          ) : (
            paginatedPosts.map(post => (
              <div key={post.id} className={cn('p-4 sm:p-5 transition-all duration-150', post.is_deleted && 'opacity-50')}>
                {post.is_deleted ? (
                  <div className="text-center text-muted-foreground py-3 bg-zinc-900/30 rounded-lg border border-dashed border-zinc-800 text-xs">
                    <XCircle className="w-5 h-5 mx-auto mb-1 opacity-60" />
                    <p>Сообщение удалено</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-100 font-semibold text-xs flex-shrink-0">
                        {post.user?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-foreground">{post.user?.name || `User #${post.user_id}`}</span>
                          <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
                          {Boolean(post.is_edited || (post.updated_at && post.created_at && post.updated_at !== post.created_at)) && (
                            <span
                              className="text-xs text-muted-foreground font-normal hover:text-zinc-300 transition-colors"
                              title={post.updated_at ? `Изменено: ${formatDate(post.updated_at)}` : 'Изменено'}
                            >
                              (ред.)
                            </span>
                          )}
                        </div>
                        {editingPost === post.id ? (
                          <div className="space-y-2 mt-2">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="input min-h-[80px] resize-y text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(post.id)}
                                className="btn-primary text-xs py-1.5 px-3"
                              >
                                Сохранить
                              </button>
                              <button
                                onClick={() => { setEditingPost(null); setEditContent(''); }}
                                className="btn-outline text-xs py-1.5 px-3"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="prose max-w-none mt-1 whitespace-pre-wrap text-sm text-zinc-300">
                            {post.content}
                          </div>
                        )}
                      </div>
                      {canManagePost(post) && (
                        <div className="relative post-menu-container">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === post.id ? null : post.id);
                            }}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                            aria-label="Опции сообщения"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === post.id && (
                            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl py-1 z-20 min-w-[140px] animate-scale-in origin-top-right">
                              {!editingPost && (
                                <button
                                  onClick={() => {
                                    setEditingPost(post.id);
                                    setEditContent(post.content);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent flex items-center gap-2 text-zinc-200"
                                >
                                  <Edit className="w-3.5 h-3.5 text-zinc-400" />
                                  Редактировать
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(post.id)}
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
                  </>
                )}
              </div>
            ))
          )}
          <div ref={postsEndRef} />
        </div>

        {/* Posts pagination controls */}
        {totalPostPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border bg-zinc-950/20">
            <div className="text-xs text-muted-foreground">
              Страница {postPage} из {totalPostPages} ({posts.length} сообщ.)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPostPage(p => Math.max(1, p - 1))}
                disabled={postPage <= 1}
                className="btn-outline px-2.5 py-1 text-xs disabled:opacity-40"
              >
                Назад
              </button>
              {Array.from({ length: totalPostPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPostPage(p)}
                  className={cn(
                    'w-7 h-7 rounded-lg text-xs font-medium transition-colors',
                    postPage === p
                      ? 'bg-zinc-100 text-zinc-950 font-bold'
                      : 'hover:bg-zinc-800 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPostPage(p => Math.min(totalPostPages, p + 1))}
                disabled={postPage >= totalPostPages}
                className="btn-outline px-2.5 py-1 text-xs disabled:opacity-40"
              >
                Вперед
              </button>
            </div>
          </div>
        )}

        {canReply && (
          <div className="p-4 sm:p-6 border-t border-border">
            <h3 className="font-medium mb-3 text-sm">Ответить</h3>
            {error && (
              <div className="mb-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm animate-fade-in">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="input min-h-[100px] resize-y"
                placeholder="Ваш ответ..."
                disabled={replying}
              />
              <div className="flex justify-end">
                <button
                  onClick={handleReply}
                  disabled={replying || !replyContent.trim()}
                  className="btn-primary text-sm"
                >
                  {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Отправить'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!canReply && thread.is_locked && (
          <div className="p-4 bg-muted/50 text-center text-muted-foreground">
            <Lock className="w-5 h-5 mx-auto mb-2" />
            <p>Тема закрыта для ответов</p>
          </div>
        )}

        {!canReply && Boolean(thread.category?.min_sub_required) && !Boolean(user?.sub_active) && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-500">
              Для ответа в этой теме требуется активная подписка.
              <Link to="/subscription" className="text-primary hover:underline ml-1">
                Приобрести
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}