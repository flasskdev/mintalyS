import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Loader2, MessageSquare, Send, AlertCircle, User } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cn, formatDate, timeAgo } from '../utils/helpers';
import type { Ticket, TicketMessage } from '../types';

const CATEGORY_LABELS: Record<Ticket['category'], string> = {
  general: 'Общее',
  payment: 'Оплаты',
  technical: 'Технические',
  ban: 'Баны',
  other: 'Другое',
};

const STATUSES = {
  open: { label: 'Открыт', color: 'bg-green-500/10 text-green-500' },
  answered: { label: 'Отвечено', color: 'bg-blue-500/10 text-blue-500' },
  waiting: { label: 'Ожидание', color: 'bg-yellow-500/10 text-yellow-500' },
  closed: { label: 'Закрыт', color: 'bg-gray-500/10 text-gray-500' },
} as const;

export function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadTicket();
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const loadTicket = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getTicket(parseInt(id!));
      if (response.success && response.data) {
        setTicket(response.data.ticket);
        setMessages(response.data.messages);
      } else {
        setError(response.message || 'Обращение не найдено');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!reply.trim() || !ticket) return;

    setError('');
    setSending(true);
    try {
      const response = await api.replyTicket(ticket.id, reply);
      if (response.success && response.data?.message) {
        setMessages(prev => [...prev, response.data!.message]);
        setReply('');
      } else {
        setError(response.message || 'Ошибка отправки');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="card p-4 animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-2" />
          <div className="h-4 bg-muted rounded w-full" />
        </div>
        <div className="card p-6 animate-pulse">
          <div className="h-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card p-8 text-center text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="mb-4">{error || 'Обращение не найдено'}</p>
          <button onClick={() => navigate('/tickets')} className="btn-primary">
            К списку обращений
          </button>
        </div>
      </div>
    );
  }

  const isClosed = ticket.status === 'closed';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/tickets" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Все обращения
      </Link>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-xl font-bold truncate">{ticket.subject}</h1>
              <span className={cn('px-2 py-0.5 text-xs font-medium rounded', STATUSES[ticket.status].color)}>
                {STATUSES[ticket.status].label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>#{ticket.id}</span>
              <span>{CATEGORY_LABELS[ticket.category]}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(ticket.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        {messages.map(msg => {
          const mine = msg.user_id === user?.id;
          const staff = Number(msg.is_staff) === 1;
          return (
            <div key={msg.id} className={cn('card p-4', mine && !staff && 'border-primary/30')}>
              <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <User className="w-3 h-3" />
                  {msg.user?.name ?? (mine ? 'Вы' : 'Пользователь')}
                </span>
                {staff && (
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Поддержка</span>
                )}
                <span title={formatDate(msg.created_at)}>{timeAgo(msg.created_at)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {isClosed ? (
        <div className="card p-6 text-center text-sm text-muted-foreground">
          Обращение закрыто. Создайте новое обращение, если вопрос остался.
        </div>
      ) : (
        <div className="card p-4 space-y-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="input min-h-[100px] resize-y"
            placeholder="Ваш ответ..."
            maxLength={4000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{reply.length}/4000</span>
            <button onClick={handleReply} disabled={sending || !reply.trim()} className="btn-primary">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="ml-2">Отправить</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
