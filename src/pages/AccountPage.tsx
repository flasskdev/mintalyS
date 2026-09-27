import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, User, Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/helpers';

export function AccountPage() {
  const { user, updateUser, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'email' | 'password'>('profile');
  const [name, setName] = useState(user?.name || '');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleNameChange = async () => {
    if (name === user?.name) return;
    if (name.length < 4 || name.length > 32) {
      setError('Никнейм должен быть от 4 до 32 символов');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const response = await api.changeName(name);
      if (response.success) {
        updateUser({ name });
        setSuccess('Никнейм обновлен');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.message || 'Ошибка обновления');
        setName(user?.name || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      setName(user?.name || '');
    } finally {
      setIsLoading(false);
    }
  };

  const requestEmailChange = async () => {
    if (!newEmail || newEmail === user?.email) {
      setError('Введите новый email');
      return;
    }
    if (!newEmail.includes('@')) {
      setError('Неверный формат email');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const response = await api.requestEmailChange(newEmail);
      if (response.success) {
        setEmailCodeSent(true);
        setResendCooldown(60);
        setSuccess('Код отправлен на новый email');
      } else {
        setError(response.message || 'Ошибка отправки кода');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmailCode = async () => {
    if (emailCode.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const response = await api.changeEmail(emailCode);
      if (response.success) {
        await refreshProfile();
        setSuccess('Email изменен');
        setEmailCodeSent(false);
        setNewEmail('');
        setEmailCode('');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.message || 'Неверный код');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (newPassword.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const response = await api.changePassword(currentPassword, newPassword);
      if (response.success) {
        // the server rotated the token, so the session is no longer valid
        setSuccess(response.message || 'Пароль изменён. Войдите заново');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      } else {
        setError(response.message || 'Ошибка смены пароля');
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Account</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Управление вашим аккаунтом</p>
      </div>

      <div className="max-w-3xl">
        <div className="card">
        <div className="border-b border-border">
          <nav className="flex gap-4 p-4" aria-label="Account tabs">
            <button
              onClick={() => setActiveTab('profile')}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'profile' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <User className="w-4 h-4 inline mr-1" />
              Профиль
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'email' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Mail className="w-4 h-4 inline mr-1" />
              Email
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'password' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Lock className="w-4 h-4 inline mr-1" />
              Пароль
            </button>
          </nav>
        </div>

        <div className="p-4 space-y-4">
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

          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="label block mb-1.5">Никнейм</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input input-icon-left"
                    style={{ paddingLeft: '2.85rem' }}
                    minLength={4}
                    maxLength={32}
                    disabled={isLoading}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">От 4 до 32 символов</p>
              </div>
              <div>
                <label className="label block mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="input input-icon-left bg-muted/50"
                    style={{ paddingLeft: '2.85rem' }}
                    disabled
                  />
                </div>
              </div>
              <div>
                <label className="label block mb-1.5">ID</label>
                <div className="relative">
                  <input
                    type="text"
                    value={user?.id.toString() || ''}
                    className="input bg-muted/50"
                    disabled
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <button
                  onClick={handleNameChange}
                  disabled={isLoading || name === user?.name}
                  className="btn-primary"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить изменения'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-4">
              {!emailCodeSent ? (
                <>
                  <div>
                    <label htmlFor="newEmail" className="label block mb-1.5">Новый email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        id="newEmail"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="input input-icon-left"
                        style={{ paddingLeft: '2.85rem' }}
                        placeholder="new@example.com"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <button
                    onClick={requestEmailChange}
                    disabled={isLoading || !newEmail || newEmail === user?.email}
                    className="btn-primary"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Отправить код подтверждения'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Код отправлен на <strong>{newEmail}</strong>. Код действителен 15 минут.
                  </p>
                  <div>
                    <label htmlFor="emailCode" className="label block mb-1.5">Код подтверждения</label>
                    <input
                      id="emailCode"
                      type="text"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                      className="input text-center text-2xl tracking-widest font-mono"
                      maxLength={6}
                      placeholder="000000"
                      disabled={isLoading}
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={verifyEmailCode}
                      disabled={isLoading || emailCode.length !== 6}
                      className="btn-primary flex-1"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Подтвердить'}
                    </button>
                    <button
                      onClick={() => { setEmailCodeSent(false); setEmailCode(''); }}
                      disabled={isLoading || resendCooldown > 0}
                      className="btn-outline"
                    >
                      {resendCooldown > 0 ? `Повторно (${resendCooldown}s)` : 'Отправить снова'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'password' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="label block mb-1.5">Текущий пароль</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input input-icon-left"
                    style={{ paddingLeft: '2.85rem' }}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="newPassword" className="label block mb-1.5">Новый пароль (мин. 6 символов)</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input input-icon-left"
                    style={{ paddingLeft: '2.85rem' }}
                    placeholder="••••••••"
                    disabled={isLoading}
                    minLength={6}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="label block mb-1.5">Подтвердите новый пароль</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input input-icon-left"
                    style={{ paddingLeft: '2.85rem' }}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <button
                onClick={changePassword}
                disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                className="btn-primary"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сменить пароль'}
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}