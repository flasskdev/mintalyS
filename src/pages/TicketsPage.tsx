import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  MessageSquare,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { api } from '../api/client';
import { cn, timeAgo } from '../utils/helpers';
import type { Ticket } from '../types';

const CATEGORIES = [
  { value: 'general', label: 'Общее' },
  { value: 'payment', label: 'Оплаты' },
  { value: 'technical', label: 'Технические' },
  { value: 'ban', label: 'Баны' },
  { value: 'other', label: 'Другое' },
] as const;

const STATUSES = {
  open: { label: 'Открыт', color: 'bg-green-500/10 text-green-500' },
  answered: { label: 'Отвечено', color: 'bg-blue-500/10 text-blue-500' },
  waiting: { label: 'Ожидание', color: 'bg-yellow-500/10 text-yellow-500' },
  closed: { label: 'Закрыт', color: 'bg-gray-500/10 text-gray-500' },
} as const;

export function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<'general' | 'payment' | 'technical' | 'ban' | 'other'>('general');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const response = await api.getTickets();
      if (response.success && response.data?.tickets) {
        setTickets(response.data.tickets);
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Заполните все поля');
      return;
    }

    setError('');
    setCreating(true);
    try {
      const response = await api.createTicket(subject, category, message);
      if (response.success) {
        setShowCreate(false);
        setSubject('');
        setMessage('');
        loadTickets();
      } else {
        setError(response.message || 'Ошибка создания');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-6 bg-muted rounded w-1/4 mb-2" />
            <div className="h-4 bg-muted rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tickets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Ваши обращения в поддержку</p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Новое обращение
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card p-6 space-y-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Новое обращение</h2>
            <button
              onClick={() => setShowCreate(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label htmlFor="subject" className="label block mb-1.5">Тема</label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input"
              placeholder="Тема обращения"
              maxLength={180}
            />
          </div>

          <div>
            <label htmlFor="category" className="label block mb-1.5">Категория</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="input"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="message" className="label block mb-1.5">Сообщение</label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input min-h-[120px] resize-y"
              placeholder="Опишите вашу проблему..."
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary flex-1"
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

      {tickets.length === 0 && !showCreate ? (
        <div className="card p-10 sm:p-14 text-center border-dashed border-zinc-800 bg-zinc-900/30 rounded-2xl flex flex-col items-center justify-center animate-fade-in max-w-2xl mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300 mb-4 shadow-sm">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">У вас пока нет обращений</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
            Если у вас возник вопрос или проблема с работой софта или подписки, создайте обращение — служба поддержки оперативно поможет вам.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Создать первое обращение
          </button>
        </div>
      ) : tickets.length > 0 ? (
        <div className="space-y-4">
          {tickets.map(ticket => (
            <Link
              key={ticket.id}
              to={`/tickets/${ticket.id}`}
              className="card p-4 hover:border-primary/50 transition-colors group block"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{ticket.subject}</h3>
                    <span className={cn('px-2 py-0.5 text-xs font-medium rounded', STATUSES[ticket.status].color)}>
                      {STATUSES[ticket.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{ticket.last_message || '—'}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(ticket.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {CATEGORIES.find(c => c.value === ticket.category)?.label ?? ticket.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}