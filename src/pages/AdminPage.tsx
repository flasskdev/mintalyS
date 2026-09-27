import { useState, useEffect } from 'react';
import {
  Users,
  Crown,
  Key,
  Newspaper,
  ShoppingBag,
  Ticket as TicketIcon,
  ListChecks,
  Search,
  Shield,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  Ban,
  UserCheck,
  Plus,
  Save,
  Trash2,
  Wallet,
  Send,
  Edit,
  Fingerprint,
  Download,
  FileArchive,
  Eye,
  EyeOff
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cn, formatBytes, formatDate, timeAgo } from '../utils/helpers';
import type { User, Subscription, LicenseKey, Order, Ticket, News, TicketMessage, Settings as SiteSettings, AdminDownload } from '../types';

type AdminTab = 'overview' | 'users' | 'subs' | 'keys' | 'downloads' | 'news' | 'orders' | 'tickets' | 'logs' | 'settings';

interface AdminStats {
  total_users: number;
  active_subs: number;
  total_balance: number;
  today_registrations: number;
}

interface AdminLog {
  id: number;
  admin_id: number;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: string | null;
  ip: string | null;
  created_at: string;
}

export function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-3 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="w-6 h-6 text-primary" />
            Панель администратора
          </h1>
          <p className="text-muted-foreground text-sm">Вы вошли как разработчик ({user?.name})</p>
        </div>

        {/* Tab switcher pinned to top right */}
        <div className="p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-x-auto scrollbar-thin flex items-center gap-1 max-w-full">
          {[
            { id: 'overview' as AdminTab, label: 'Обзор', icon: ListChecks },
            { id: 'users' as AdminTab, label: 'Пользователи', icon: Users },
            { id: 'subs' as AdminTab, label: 'Подписки', icon: Crown },
            { id: 'keys' as AdminTab, label: 'Ключи', icon: Key },
            { id: 'downloads' as AdminTab, label: 'Сборки', icon: Download },
            { id: 'news' as AdminTab, label: 'Новости', icon: Newspaper },
            { id: 'orders' as AdminTab, label: 'Заказы', icon: ShoppingBag },
            { id: 'tickets' as AdminTab, label: 'Тикеты', icon: TicketIcon },
            { id: 'logs' as AdminTab, label: 'Логи', icon: Shield },
            { id: 'settings' as AdminTab, label: 'Настройки', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 flex items-center gap-1.5',
                activeTab === tab.id
                  ? 'bg-zinc-800 text-white font-semibold shadow-sm border border-zinc-700/70'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div key={activeTab} className="animate-fade-in">
        {activeTab === 'overview' && <OverviewTab onStats={setStats} stats={stats} onNavigate={setActiveTab} />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'subs' && <SubscriptionsTab />}
        {activeTab === 'keys' && <KeysTab />}
        {activeTab === 'downloads' && <DownloadsTab />}
        {activeTab === 'news' && <NewsAdminTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'tickets' && <TicketsAdminTab />}
        {activeTab === 'logs' && <LogsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

function StatsCard({ label, value, icon: Icon, suffix }: { label: string; value: number | string; icon: React.ElementType; suffix?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">
        {value.toLocaleString()}
        {suffix && <span className="text-base text-muted-foreground font-normal">{suffix}</span>}
      </p>
    </div>
  );
}

function OverviewTab({ onStats, stats, onNavigate }: { onStats: (s: AdminStats) => void; stats: AdminStats | null; onNavigate: (tab: AdminTab) => void }) {
  useEffect(() => {
    api.adminGetStats().then(res => {
      if (res.success && res.data) {
        onStats(res.data);
      }
    });
  }, [onStats]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Всего пользователей" value={stats?.total_users || 0} icon={Users} />
        <StatsCard label="Активных подписок" value={stats?.active_subs || 0} icon={Crown} />
        <StatsCard label="Баланс пользователей" value={stats?.total_balance || 0} icon={Wallet} suffix=" $" />
        <StatsCard label="Регистраций сегодня" value={stats?.today_registrations || 0} icon={UserCheck} />
      </div>

      <div className="card p-6">
        <h3 className="font-semibold mb-1 text-foreground">Быстрые действия</h3>
        <p className="text-sm text-muted-foreground mb-4">Управление основными сущностями.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('users')}
            className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-border/80 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-600/60 text-zinc-200 transition-all duration-150 font-medium text-sm group"
          >
            <Users className="w-4 h-4 text-zinc-400 group-hover:text-zinc-100 transition-colors flex-shrink-0" />
            <span>Пользователи</span>
          </button>
          <button
            onClick={() => onNavigate('subs')}
            className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-border/80 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-600/60 text-zinc-200 transition-all duration-150 font-medium text-sm group"
          >
            <Crown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-100 transition-colors flex-shrink-0" />
            <span>Подписки</span>
          </button>
          <button
            onClick={() => onNavigate('keys')}
            className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-border/80 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-600/60 text-zinc-200 transition-all duration-150 font-medium text-sm group"
          >
            <Key className="w-4 h-4 text-zinc-400 group-hover:text-zinc-100 transition-colors flex-shrink-0" />
            <span>Ключи</span>
          </button>
          <button
            onClick={() => onNavigate('news')}
            className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-border/80 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-600/60 text-zinc-200 transition-all duration-150 font-medium text-sm group"
          >
            <Newspaper className="w-4 h-4 text-zinc-400 group-hover:text-zinc-100 transition-colors flex-shrink-0" />
            <span>Новости</span>
          </button>
        </div>
      </div>
    </div>
  );
}

type UserActionMode = 'ban' | 'balance' | 'grant' | 'hwid';

const ACTION_TITLES: Record<UserActionMode, string> = {
  ban: 'Заблокировать',
  balance: 'Пополнить баланс',
  grant: 'Выдать подписку',
  hwid: 'Сбросить HWID',
};

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<{ user: User; mode: UserActionMode } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [grantDays, setGrantDays] = useState('30');
  const [grantSubId, setGrantSubId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page] = useState(1);

  useEffect(() => {
    loadUsers();
    api.getSubscriptions()
      .then(response => {
        if (response.success && response.data?.subs) setSubs(response.data.subs);
      })
      .catch(() => undefined);
  }, [page]);

  const openAction = (user: User, mode: UserActionMode) => {
    setError('');
    setSuccess('');
    setBanReason('');
    setBalanceAmount('');
    setGrantDays('30');
    setGrantSubId(user.sub_id ? String(user.sub_id) : '');
    setAction({ user, mode });
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.adminGetUsers(page, 50);
      if (response.success && response.data?.items) {
        setUsers(response.data.items);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.id.toString().includes(search)
  );

  const handleUnban = async (user: User) => {
    setError('');
    setSuccess('');
    try {
      const response = await api.adminUnbanUser(user.id);
      if (response.success) {
        setSuccess(`Пользователь ${user.name} разблокирован`);
        loadUsers();
      } else {
        setError(response.message || 'Ошибка');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  const runAction = async () => {
    if (!action) return;
    const { user, mode } = action;
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      if (mode === 'ban') {
        const response = await api.adminBanUser(user.id, banReason.trim() || 'Нарушение правил');
        if (!response.success) return setError(response.message || 'Ошибка');
        setSuccess(`Пользователь ${user.name} заблокирован`);
      } else if (mode === 'balance') {
        const amount = parseFloat(balanceAmount.replace(',', '.'));
        if (!Number.isFinite(amount) || amount <= 0) {
          setError('Введите корректную сумму');
          return;
        }
        const response = await api.adminAddBalance(user.id, amount);
        if (!response.success) return setError(response.message || 'Ошибка');
        setSuccess(`Баланс ${user.name} пополнен на ${amount}`);
      } else if (mode === 'grant') {
        const days = parseInt(grantDays, 10);
        if (!Number.isInteger(days) || days === 0) {
          setError('Введите количество дней (отрицательное — отзыв подписки)');
          return;
        }
        const response = await api.adminGrantSubscription(
          user.id,
          days,
          grantSubId ? parseInt(grantSubId, 10) : undefined,
        );
        if (!response.success) return setError(response.message || 'Ошибка');
        setSuccess(days > 0 ? `Подписка ${user.name} продлена на ${days} дн.` : `Подписка ${user.name} отозвана`);
      } else {
        const response = await api.adminResetUserHwid(user.id);
        if (!response.success) return setError(response.message || 'Ошибка');
        setSuccess(`HWID пользователя ${user.name} сброшен`);
      }
      setAction(null);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="card p-8 animate-pulse"><div className="h-6 bg-muted rounded w-1/3 mb-4" /><div className="h-96 bg-muted rounded" /></div>;
  }

  return (
    <div className="card overflow-hidden">
      {error && (
        <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-500/10 border-b border-green-500/20 text-green-500 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="p-4 border-b border-border flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по нику, email или ID..."
            className="input pl-10"
          />
        </div>
        <button onClick={loadUsers} className="btn-outline" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Обновить'}
        </button>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ник</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Подписка</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Баланс</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Роль</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Статус</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs">{user.id}</td>
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-3">
                  {user.sub_active ? (
                    <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-500 rounded">
                      {user.sub_days_left} дн.
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">Нет</span>
                  )}
                </td>
                <td className="px-4 py-3">{user.balance.toFixed(2)}</td>
                <td className="px-4 py-3">
                  {user.dev ? (
                    <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded">Dev</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Пользователь</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {user.banned ? (
                    <span className="px-2 py-0.5 text-xs bg-destructive/10 text-destructive rounded">Забанен</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-500 rounded">Активен</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 items-center">
                    {!user.dev && (
                      user.banned ? (
                        <button
                          onClick={() => handleUnban(user)}
                          className="p-1.5 rounded hover:bg-green-500/10 text-green-500"
                          title="Разблокировать"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => openAction(user, 'ban')}
                          className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                          title="Заблокировать"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )
                    )}
                    <button
                      onClick={() => openAction(user, 'balance')}
                      className="p-1.5 rounded hover:bg-primary/10 text-primary"
                      title="Пополнить баланс"
                    >
                      <Wallet className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openAction(user, 'grant')}
                      className="p-1.5 rounded hover:bg-primary/10 text-primary"
                      title="Выдать подписку"
                    >
                      <Crown className="w-4 h-4" />
                    </button>
                    {user.hwid && (
                      <button
                        onClick={() => openAction(user, 'hwid')}
                        className="p-1.5 rounded hover:bg-yellow-500/10 text-yellow-500"
                        title="Сбросить HWID"
                      >
                        <Fingerprint className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Пользователи не найдены</p>
        </div>
      )}

      {action && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-1">{ACTION_TITLES[action.mode]}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              #{action.user.id} · {action.user.name}
            </p>

            {action.mode === 'ban' && (
              <div className="space-y-4 mb-4">
                <div>
                  <label className="label block mb-1.5">Причина бана</label>
                  <input
                    type="text"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    className="input"
                    placeholder="Нарушение правил"
                    maxLength={255}
                  />
                </div>
              </div>
            )}

            {action.mode === 'balance' && (
              <div className="space-y-4 mb-4">
                <div>
                  <label className="label block mb-1.5">Сумма пополнения</label>
                  <input
                    type="number"
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(e.target.value)}
                    className="input"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Текущий баланс: {action.user.balance.toFixed(2)}</p>
              </div>
            )}

            {action.mode === 'grant' && (
              <div className="space-y-4 mb-4">
                <div>
                  <label className="label block mb-1.5">Дней подписки</label>
                  <input
                    type="number"
                    value={grantDays}
                    onChange={(e) => setGrantDays(e.target.value)}
                    className="input"
                    placeholder="30"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Отрицательное значение отзывает подписку.
                  </p>
                </div>
                <div>
                  <label className="label block mb-1.5">Тариф</label>
                  <select
                    value={grantSubId}
                    onChange={(e) => setGrantSubId(e.target.value)}
                    className="input"
                  >
                    <option value="">Текущий / первый доступный</option>
                    {subs.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} — {sub.sub_days} дн.
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {action.mode === 'hwid' && (
              <p className="text-sm text-muted-foreground mb-4">
                Текущий HWID: <span className="font-mono text-xs">{action.user.hwid}</span>.
                После сброса пользователь сможет привязать новое устройство при следующем входе.
              </p>
            )}

            {error && <p className="text-sm text-destructive mb-3">{error}</p>}

            <div className="flex gap-2">
              <button onClick={runAction} disabled={busy} className="btn-primary flex-1">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : ACTION_TITLES[action.mode]}
              </button>
              <button onClick={() => setAction(null)} disabled={busy} className="btn-outline">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubscriptionsTab() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    sub_days: 30,
    cost: 0,
    discount: 0,
    is_visible: 1,
    is_popular: 0,
    sort_order: 0,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSubs();
  }, []);

  const loadSubs = async () => {
    setLoading(true);
    try {
      const response = await api.getSubscriptions();
      if (response.success && response.data?.subs) {
        setSubs(response.data.subs);
      }
    } catch (error) {
      console.error('Failed to load subs:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ name: '', description: '', sub_days: 30, cost: 0, discount: 0, is_visible: 1, is_popular: 0, sort_order: 0 });
  };

  const startEdit = (sub: Subscription) => {
    setEditing(sub);
    setCreating(false);
    setForm({
      name: sub.name,
      description: sub.description,
      sub_days: sub.sub_days,
      cost: sub.cost,
      discount: sub.discount,
      is_visible: sub.is_visible ?? 1,
      is_popular: sub.is_popular ?? 0,
      sort_order: sub.sort_order ?? 0,
    });
  };

  const handleSave = async () => {
    if (!form.name || form.sub_days <= 0 || form.cost < 0) {
      setError('Заполните корректно все обязательные поля');
      return;
    }

    setError('');
    setSuccess('');
    try {
      if (creating) {
        const response = await api.adminCreateSubscription(form);
        if (response.success) {
          setSuccess('Подписка создана');
          setCreating(false);
          loadSubs();
        } else {
          setError(response.message || 'Ошибка создания');
        }
      } else if (editing) {
        const response = await api.adminUpdateSubscription(editing.id, form);
        if (response.success) {
          setSuccess('Подписка обновлена');
          setEditing(null);
          loadSubs();
        } else {
          setError(response.message || 'Ошибка обновления');
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  const handleDelete = async (sub: Subscription) => {
    if (!confirm(`Удалить подписку "${sub.name}"?`)) return;
    try {
      const response = await api.adminDeleteSubscription(sub.id);
      if (response.success) {
        setSuccess('Подписка удалена');
        loadSubs();
      } else {
        setError(response.message || 'Ошибка');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  if (loading) {
    return <div className="card p-8 animate-pulse"><div className="h-96 bg-muted rounded" /></div>;
  }

  return (
    <div className="card overflow-hidden">
      {error && <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-500/10 border-b border-green-500/20 text-green-500 text-sm">{success}</div>}

      <div className="p-4 border-b border-border flex justify-between items-center">
        <h3 className="font-semibold">Управление подписками</h3>
        <button onClick={startCreate} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Создать
        </button>
      </div>

      {(creating || editing) && (
        <div className="p-4 border-b border-border bg-muted/30 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label block mb-1.5">Название</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" placeholder="PLAN (30 days)" />
            </div>
            <div>
              <label className="label block mb-1.5">Описание</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input" placeholder="Короткое описание" />
            </div>
            <div>
              <label className="label block mb-1.5">Дней подписки</label>
              <input type="number" value={form.sub_days} onChange={e => setForm({ ...form, sub_days: parseInt(e.target.value) || 0 })} className="input" min="1" />
            </div>
            <div>
              <label className="label block mb-1.5">Цена ($)</label>
              <input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} className="input" min="0" step="0.01" />
            </div>
            <div>
              <label className="label block mb-1.5">Скидка (%)</label>
              <input type="number" value={form.discount} onChange={e => setForm({ ...form, discount: parseInt(e.target.value) || 0 })} className="input" min="0" max="90" />
            </div>
            <div>
              <label className="label block mb-1.5">Сортировка</label>
              <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} className="input" />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.is_visible} onChange={e => setForm({ ...form, is_visible: e.target.checked ? 1 : 0 })} className="w-4 h-4" />
              Видимость
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.is_popular} onChange={e => setForm({ ...form, is_popular: e.target.checked ? 1 : 0 })} className="w-4 h-4" />
              Популярный
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary">
              <Save className="w-4 h-4 mr-2" />
              Сохранить
            </button>
            <button onClick={() => { setCreating(false); setEditing(null); }} className="btn-outline">Отмена</button>
          </div>
        </div>
      )}

      {subs.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Подписки не созданы</div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Название</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Дней</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Цена</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Скидка</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Статус</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subs.map(sub => (
                <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{sub.id}</td>
                  <td className="px-4 py-3 font-medium">{sub.name}</td>
                  <td className="px-4 py-3">{sub.sub_days}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">${sub.cost.toFixed(2)}</span>
                    {sub.discount > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 rounded">
                        -{sub.discount}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{sub.discount > 0 ? `${sub.discount}%` : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 text-xs rounded', sub.is_visible ? 'bg-zinc-800 text-zinc-200 border border-zinc-700/60' : 'bg-muted text-muted-foreground')}>
                      {sub.is_visible ? 'Активен' : 'Скрыт'}
                    </span>
                    {sub.is_popular && <span className="ml-1 px-2 py-0.5 text-xs bg-zinc-100 text-zinc-950 font-bold rounded">Хит</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(sub)} className="p-1.5 rounded hover:bg-primary/10 text-primary" title="Редактировать">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(sub)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Удалить">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KeysTab() {
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedSub, setSelectedSub] = useState<number>(1);
  const [daysOverride, setDaysOverride] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadKeys();
    loadSubs();
  }, []);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const response = await api.adminGetLicenseKeys(1, 100);
      if (response.success && response.data?.items) {
        setKeys(response.data.items);
      }
    } catch (error) {
      console.error('Failed to load keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubs = async () => {
    try {
      const response = await api.getSubscriptions();
      if (response.success && response.data?.subs) {
        setSubs(response.data.subs);
      }
    } catch (error) {
      console.error('Failed to load subs:', error);
    }
  };

  const handleCreate = async () => {
    if (selectedSub <= 0) {
      setError('Выберите подписку');
      return;
    }
    setError('');
    setSuccess('');
    setCreating(true);
    try {
      const response = await api.adminCreateLicenseKey(
        selectedSub,
        daysOverride ? parseInt(daysOverride) : undefined,
        note
      );
      if (response.success) {
        setSuccess('Ключ создан');
        setNote('');
        setDaysOverride('');
        setCreating(false);
        loadKeys();
      } else {
        setError(response.message || 'Ошибка создания');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (key: LicenseKey) => {
    if (!confirm('Удалить этот ключ?')) return;
    try {
      const response = await api.adminDeleteLicenseKey(key.id);
      if (response.success) {
        setSuccess('Ключ удален');
        loadKeys();
      } else {
        setError(response.message || 'Ошибка');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  if (loading) {
    return <div className="card p-8 animate-pulse"><div className="h-96 bg-muted rounded" /></div>;
  }

  return (
    <div className="card overflow-hidden">
      {error && <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-500/10 border-b border-green-500/20 text-green-500 text-sm">{success}</div>}

      <div className="p-4 border-b border-border space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Лицензионные ключи</h3>
          <button onClick={handleCreate} disabled={creating} className="btn-primary">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" />Создать ключ</>}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label block mb-1.5">Подписка</label>
            <select value={selectedSub} onChange={e => setSelectedSub(parseInt(e.target.value))} className="input">
              {subs.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">Дней (переопределение)</label>
            <input type="number" value={daysOverride} onChange={e => setDaysOverride(e.target.value)} className="input" placeholder="По умолчанию" min="1" />
          </div>
          <div>
            <label className="label block mb-1.5">Примечание</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="Необязательно" maxLength={255} />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ключ</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Подписка</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Статус</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Использован</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {keys.map(key => (
              <tr key={key.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs">{key.id}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs">{key.key_code.slice(0, 16)}...{key.key_code.slice(-8)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{key.note || ''}</span>
                </td>
                <td className="px-4 py-3">{subs.find(s => s.id === key.sub_id)?.name || `#${key.sub_id}`}</td>
                <td className="px-4 py-3">
                  {key.used_by ? (
                    <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">Использован</span>
                  ) : key.is_disabled ? (
                    <span className="px-2 py-0.5 text-xs bg-destructive/10 text-destructive rounded">Отключен</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-500 rounded">Активен</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {key.used_by ? `${key.used_by} (${formatDate(key.used_at || '')})` : 'Нет'}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(key)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Удалить">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EMPTY_DOWNLOAD = { title: '', version: '1.0.0', filename: '', changelog: '', is_active: 0 };

function DownloadsTab() {
  const [downloads, setDownloads] = useState<AdminDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AdminDownload | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_DOWNLOAD);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.adminGetDownloads();
      if (response.success && response.data?.downloads) {
        setDownloads(response.data.downloads);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки списка');
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setEditing(null);
    setFormOpen(false);
    setForm(EMPTY_DOWNLOAD);
  };

  const openForm = (item: AdminDownload | null) => {
    setError('');
    setSuccess('');
    setEditing(item);
    setFormOpen(true);
    setForm(
      item
        ? {
            title: item.title,
            version: item.version,
            filename: item.filename,
            changelog: item.changelog ?? '',
            is_active: item.is_active,
          }
        : EMPTY_DOWNLOAD,
    );
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = editing
        ? await api.adminUpdateDownload(editing.id, form)
        : await api.adminCreateDownload(form);
      if (!response.success) {
        setError(response.message || 'Ошибка сохранения');
        return;
      }
      setSuccess(response.message || (editing ? 'Сборка обновлена' : 'Сборка добавлена'));
      closeForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: AdminDownload) => {
    setError('');
    setSuccess('');
    try {
      const response = await api.adminUpdateDownload(item.id, { is_active: item.is_active ? 0 : 1 });
      if (response.success) {
        setSuccess(`Сборка ${item.is_active ? 'отключена' : 'опубликована'}`);
        load();
      } else {
        setError(response.message || 'Ошибка');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handleDelete = async (item: AdminDownload) => {
    if (!window.confirm(`Удалить сборку «${item.title}» из списка? Файл на сервере останется.`)) return;
    setError('');
    setSuccess('');
    try {
      const response = await api.adminDeleteDownload(item.id);
      if (response.success) {
        setSuccess('Сборка удалена из списка');
        load();
      } else {
        setError(response.message || 'Ошибка');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  if (loading) return <div className="card p-8 animate-pulse"><div className="h-96 bg-muted rounded" /></div>;

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Файлы нужно загрузить в папку <code className="font-mono text-xs">STORAGE_DIR</code> на сервере.
          Здесь только описание сборки: имя файла, размер и SHA-256 считаются автоматически.
        </div>
        <button onClick={() => openForm(null)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Добавить сборку
        </button>
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

      {formOpen && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold">{editing ? `Сборка #${editing.id}` : 'Новая сборка'}</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label block mb-1.5">Название</label>
              <input
                className="input"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Mintaly Loader 1.0.1"
                maxLength={120}
              />
            </div>
            <div>
              <label className="label block mb-1.5">Версия</label>
              <input
                className="input"
                value={form.version}
                onChange={e => setForm(prev => ({ ...prev, version: e.target.value }))}
                placeholder="1.0.1"
                maxLength={32}
              />
            </div>
            <div>
              <label className="label block mb-1.5">Имя файла в STORAGE_DIR</label>
              <input
                className="input font-mono text-xs"
                value={form.filename}
                onChange={e => setForm(prev => ({ ...prev, filename: e.target.value }))}
                placeholder="mintaly-loader-1.0.1.zip"
              />
            </div>
          </div>
          <div>
            <label className="label block mb-1.5">Что изменилось</label>
            <textarea
              className="input min-h-[90px]"
              value={form.changelog}
              onChange={e => setForm(prev => ({ ...prev, changelog: e.target.value }))}
              placeholder="Исправления, новые функции..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active === 1}
              onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked ? 1 : 0 }))}
              className="w-4 h-4 rounded accent-primary"
            />
            Опубликована (доступна по подписке)
          </label>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить
            </button>
            <button onClick={closeForm} className="btn-outline">
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {downloads.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <FileArchive className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Сборок пока нет</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Сборка</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Файл</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Размер</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Состояние</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {downloads.map(item => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{item.id}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{item.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">v{item.version}</span>
                      {item.changelog && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.changelog}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{item.filename}</td>
                    <td className="px-4 py-3 text-xs">{formatBytes(item.filesize)}</td>
                    <td className="px-4 py-3">
                      {item.is_active ? (
                        <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-500 rounded">Опубликована</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">Скрыта</span>
                      )}
                      {!item.file_exists && (
                        <span className="ml-1 px-2 py-0.5 text-xs bg-destructive/10 text-destructive rounded">
                          файла нет
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleActive(item)}
                          className={cn(
                            'p-1.5 rounded',
                            item.is_active ? 'hover:bg-muted text-muted-foreground' : 'hover:bg-green-500/10 text-green-500'
                          )}
                          title={item.is_active ? 'Скрыть сборку' : 'Опубликовать сборку'}
                        >
                          {item.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => openForm(item)}
                          className="p-1.5 rounded hover:bg-primary/10 text-primary"
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                          title="Удалить из списка"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Последняя публикация: {downloads[0] ? timeAgo(downloads[0].created_at) : '—'}. Всего сборок: {downloads.length}.
        <Download className="w-3 h-3 inline ml-1" />
      </p>
    </div>
  );
}

function NewsAdminTab() {
  const [newsList, setNewsList] = useState<News[]>([]);
  const [, setLoading] = useState(true);
  const [editing, setEditing] = useState<News | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', short_desc: '', content: '', is_published: 1, is_pinned: 0 });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    try {
      const response = await api.getNews(1, 100);
      if (response.success && response.data?.items) {
        setNewsList(response.data.items);
      }
    } catch (error) {
      console.error('Failed to load news:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ title: '', short_desc: '', content: '', is_published: 1, is_pinned: 0 });
  };

  const startEdit = (news: News) => {
    setEditing(news);
    setCreating(false);
    setForm({ title: news.title, short_desc: news.short_desc, content: news.content, is_published: news.is_published, is_pinned: news.is_pinned });
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.short_desc.trim() || !form.content.trim()) {
      setError('Заполните все поля');
      return;
    }
    setError('');
    setSuccess('');
    try {
      if (creating) {
        const response = await api.adminCreateNews(form);
        if (response.success) {
          setSuccess('Новость создана');
          setCreating(false);
          loadNews();
        } else setError(response.message || 'Ошибка');
      } else if (editing) {
        const response = await api.adminUpdateNews(editing.id, form);
        if (response.success) {
          setSuccess('Новость обновлена');
          setEditing(null);
          loadNews();
        } else setError(response.message || 'Ошибка');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  const handleDelete = async (news: News) => {
    if (!confirm(`Удалить новость "${news.title}"?`)) return;
    try {
      const response = await api.adminDeleteNews(news.id);
      if (response.success) {
        setSuccess('Новость удалена');
        loadNews();
      } else setError(response.message || 'Ошибка');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  return (
    <div className="card overflow-hidden">
      {error && <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-500/10 border-b border-green-500/20 text-green-500 text-sm">{success}</div>}

      <div className="p-4 border-b border-border flex justify-between items-center">
        <h3 className="font-semibold">Новости</h3>
        <button onClick={startCreate} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Создать
        </button>
      </div>

      {(creating || editing) && (
        <div className="p-4 border-b border-border bg-muted/30 space-y-4">
          <div>
            <label className="label block mb-1.5">Заголовок</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input" maxLength={180} />
          </div>
          <div>
            <label className="label block mb-1.5">Краткое описание</label>
            <input type="text" value={form.short_desc} onChange={e => setForm({ ...form, short_desc: e.target.value })} className="input" maxLength={300} />
          </div>
          <div>
            <label className="label block mb-1.5">Содержание</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="input min-h-[200px] resize-y" />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked ? 1 : 0 })} className="w-4 h-4" />
              Опубликована
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked ? 1 : 0 })} className="w-4 h-4" />
              Закрепить
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary">
              <Save className="w-4 h-4 mr-2" />
              Сохранить
            </button>
            <button onClick={() => { setCreating(false); setEditing(null); }} className="btn-outline">Отмена</button>
          </div>
        </div>
      )}

      {newsList.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Новости не созданы</div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Заголовок</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Дата</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Просмотры</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Статус</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {newsList.map(news => (
                <tr key={news.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{news.id}</td>
                  <td className="px-4 py-3 font-medium">{news.title}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(news.created_at)}</td>
                  <td className="px-4 py-3">{news.views}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 text-xs rounded', news.is_published ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground')}>
                      {news.is_published ? 'Опубликована' : 'Черновик'}
                    </span>
                    {news.is_pinned && <span className="ml-1 px-2 py-0.5 text-xs bg-primary/20 text-primary rounded">Закрепл.</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(news)} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(news)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await api.adminGetOrders(1, 100);
      if (response.success && response.data?.items) {
        setOrders(response.data.items);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (order: Order, status: Order['status']) => {
    try {
      const response = await api.adminSetOrderStatus(order.id, status);
      if (response.success) {
        setSuccess(`Заказ #${order.id}: ${status}`);
        setTimeout(() => setSuccess(''), 3000);
        loadOrders();
      } else {
        setError(response.message || 'Ошибка');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  if (loading) return <div className="card p-8 animate-pulse"><div className="h-96 bg-muted rounded" /></div>;

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Заказы</h3>
        {success && <span className="text-xs text-emerald-500">{success}</span>}
      </div>
      {error && <div className="px-4 py-2 text-xs text-destructive bg-destructive/10">{error}</div>}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Пользователь</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Подписка</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Дней</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Сумма</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Метод</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs">{order.id}</td>
                <td className="px-4 py-3">{order.user_id}</td>
                <td className="px-4 py-3">{order.sub_name}</td>
                <td className="px-4 py-3">{order.days}</td>
                <td className="px-4 py-3 font-medium">{order.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-capitalize">{order.method}</td>
                <td className="px-4 py-3">
                  <select
                    value={order.status}
                    onChange={e => handleStatusChange(order, e.target.value as Order['status'])}
                    className={cn(
                      'text-xs px-2 py-1 rounded border',
                      order.status === 'paid' && 'bg-green-500/10 border-green-500/30 text-green-500',
                      order.status === 'pending' && 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
                      order.status === 'failed' && 'bg-destructive/10 border-destructive/30 text-destructive',
                      order.status === 'refunded' && 'bg-muted border-border text-muted-foreground'
                    )}
                  >
                    <option value="pending">pending</option>
                    <option value="paid">paid</option>
                    <option value="failed">failed</option>
                    <option value="refunded">refunded</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TicketsAdminTab() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await api.adminGetTickets(1, 100);
      if (response.success && response.data?.items) {
        setTickets(response.data.items);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const openTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    try {
      const response = await api.getTicket(ticket.id);
      if (response.success && response.data) {
        setMessages(response.data.messages);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !reply.trim()) return;
    setError('');
    setReplying(true);
    try {
      const response = await api.adminReplyTicket(selectedTicket.id, reply);
      if (response.success) {
        setReply('');
        openTicket(selectedTicket);
        loadTickets();
      } else {
        setError(response.message || 'Ошибка');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    } finally {
      setReplying(false);
    }
  };

  const handleStatus = async (status: Ticket['status']) => {
    if (!selectedTicket) return;
    try {
      const response = await api.adminUpdateTicketStatus(selectedTicket.id, status);
      if (response.success) {
        setSelectedTicket({ ...selectedTicket, status });
        loadTickets();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка');
    }
  };

  if (loading) return <div className="card p-8 animate-pulse"><div className="h-96 bg-muted rounded" /></div>;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Все обращения</h3>
        </div>
        {tickets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Тикетов нет</div>
        ) : (
          <div className="divide-y divide-border overflow-y-auto max-h-[600px] scrollbar-thin">
            {tickets.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => openTicket(ticket)}
                className={cn(
                  'w-full text-left p-4 hover:bg-muted/30 transition-colors',
                  selectedTicket?.id === ticket.id && 'bg-muted/30'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{ticket.subject}</span>
                  <span className={cn(
                    'px-2 py-0.5 text-xs rounded flex-shrink-0',
                    ticket.status === 'open' && 'bg-green-500/10 text-green-500',
                    ticket.status === 'answered' && 'bg-blue-500/10 text-blue-500',
                    ticket.status === 'waiting' && 'bg-yellow-500/10 text-yellow-500',
                    ticket.status === 'closed' && 'bg-muted text-muted-foreground'
                  )}>
                    {ticket.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>#{ticket.id}</span>
                  <span>{ticket.category}</span>
                  <span>{timeAgo(ticket.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedTicket ? (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{selectedTicket.subject}</h3>
              <p className="text-xs text-muted-foreground">Тикет #{selectedTicket.id} · {selectedTicket.category}</p>
            </div>
            <div className="flex gap-1">
              <select
                value={selectedTicket.status}
                onChange={e => handleStatus(e.target.value as Ticket['status'])}
                className="text-xs px-2 py-1 rounded border border-input bg-background"
              >
                <option value="open">open</option>
                <option value="answered">answered</option>
                <option value="waiting">waiting</option>
                <option value="closed">closed</option>
              </select>
            </div>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto max-h-[400px] scrollbar-thin">
            {messages.map(msg => (
              <div key={msg.id} className={cn(
                'p-3 rounded-lg max-w-[85%]',
                msg.is_staff ? 'bg-primary/10 ml-auto' : 'bg-muted/50'
              )}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{msg.is_staff ? 'Администратор' : (msg.user_name ?? `#${msg.user_id}`)}</span>
                  {msg.is_staff && <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded">STAFF</span>}
                  <span>{timeAgo(msg.created_at)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
              </div>
            ))}
          </div>

          {selectedTicket.status !== 'closed' && (
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  className="input flex-1 min-h-[60px] resize-y"
                  placeholder="Ответ от имени администрации..."
                  disabled={replying}
                />
                <button
                  onClick={handleReply}
                  disabled={replying || !reply.trim()}
                  className="btn-primary self-end"
                >
                  {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="card p-8 text-center text-muted-foreground">
          <TicketIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Выберите обращение для просмотра</p>
        </div>
      )}
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await api.adminGetLogs(1, 100);
      if (response.success && response.data?.items) {
        setLogs(response.data.items);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="card p-8 animate-pulse"><div className="h-96 bg-muted rounded" /></div>;

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">Журнал действий администраторов</h3>
      </div>
      {logs.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Логов нет</div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Админ</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Действие</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Объект</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Детали</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">IP</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{log.id}</td>
                  <td className="px-4 py-3">{log.admin_id}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {log.target_type ? `${log.target_type}#${log.target_id}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[250px] truncate">{log.details || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.ip || '-'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const [form, setForm] = useState<SiteSettings>({
    site_name: 'Mintaly',
    registration_open: '1',
    maintenance: '0',
    forum_open: '1',
    hwid_reset_days: '30',
    redeem_cooldown_minutes: '60',
    terms_text: '',
    refund_text: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api
      .getSettings()
      .then(response => {
        if (response.success && response.data?.settings) {
          setForm(prev => ({ ...prev, ...response.data!.settings }));
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof SiteSettings, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await api.adminUpdateSettings(form);
      if (response.success) {
        setSuccess(response.message || 'Настройки сохранены');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.message || 'Ошибка сохранения');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card p-8 animate-pulse"><div className="h-96 bg-muted rounded" /></div>;

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Настройки сайта</h3>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Сохранить
        </button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label block mb-1.5">Название сайта</label>
          <input className="input" value={form.site_name} onChange={e => set('site_name', e.target.value)} maxLength={64} />
        </div>
        <div>
          <label className="label block mb-1.5">Сброс HWID (дней)</label>
          <input className="input" type="number" min={1} value={form.hwid_reset_days} onChange={e => set('hwid_reset_days', e.target.value)} />
        </div>
        <div>
          <label className="label block mb-1.5">Повтор redeem (минут)</label>
          <input className="input" type="number" min={1} value={form.redeem_cooldown_minutes} onChange={e => set('redeem_cooldown_minutes', e.target.value)} />
        </div>
        <div className="flex flex-col justify-end gap-2">
          {([
            ['registration_open', 'Регистрация открыта'],
            ['forum_open', 'Форум открыт'],
            ['maintenance', 'Режим обслуживания'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form[key] === '1'}
                onChange={e => set(key, e.target.checked ? '1' : '0')}
                className="w-4 h-4 rounded accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label block mb-1.5">Пользовательское соглашение</label>
        <p className="text-xs text-muted-foreground mb-1.5">
          Пустая строка отделяет абзацы, строка с `# ` — заголовок, `- ` или `• ` — пункт списка.
        </p>
        <textarea
          className="input min-h-[180px] font-mono text-xs"
          value={form.terms_text}
          onChange={e => set('terms_text', e.target.value)}
          placeholder="# Пользовательское соглашение&#10;&#10;1. Общие положения&#10;..."
        />
      </div>

      <div>
        <label className="label block mb-1.5">Правила возврата</label>
        <textarea
          className="input min-h-[140px] font-mono text-xs"
          value={form.refund_text}
          onChange={e => set('refund_text', e.target.value)}
          placeholder="# Правила возврата&#10;&#10;1. Общие условия&#10;..."
        />
      </div>
    </div>
  );
}