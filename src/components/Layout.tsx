import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Outlet, Link, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { 
  LogOut, 
  Download, 
  MessageSquare, 
  User, 
  Ticket, 
  Key, 
  RefreshCw, 
  Menu, 
  X,
  ChevronDown,
  Shield,
  Crown,
  LayoutDashboard,
  CreditCard,
  Newspaper,
  MailCheck,
  Wallet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { CurrencySwitcher } from './CurrencySwitcher';
import { cn } from '../utils/helpers';

interface LayoutProps {
  children?: ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresSub: false },
  { path: '/subscription', label: 'Подписка', icon: CreditCard, requiresSub: false },
  { path: '/download', label: 'Download', icon: Download, requiresSub: true },
  { path: '/forum', label: 'Forum', icon: MessageSquare, requiresSub: false },
  { path: '/news', label: 'Новости', icon: Newspaper, requiresSub: false },
  { path: '/tickets', label: 'Tickets', icon: Ticket, requiresSub: false },
  { path: '/redeem', label: 'Redeem', icon: Key, requiresSub: false },
  { path: '/reset', label: 'Reset HWID', icon: RefreshCw, requiresSub: false },
  { path: '/account', label: 'Account', icon: User, requiresSub: false },
  { path: '/settings', label: 'Settings', icon: Shield, requiresSub: false },
] as const;

export function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const { formatPrice } = useCurrency();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const hasSubscription = Boolean(user?.sub_active);
  const isDev = Boolean(user?.dev);
  const needsVerification = false;

  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };
  return (
    <div className="min-h-screen bg-background">
      <div className={cn('fixed inset-0 z-40 bg-black/50 lg:hidden', sidebarOpen ? 'block' : 'hidden')} 
           onClick={() => setSidebarOpen(false)} />
      
      <aside 
        className={cn(
          'fixed top-0 inset-y-0 left-0 z-50 w-64 h-screen bg-card border-r border-border transform transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <Link to={isAuthenticated ? '/dashboard' : '/login'} className="text-xl font-extrabold tracking-tight text-white hover:text-zinc-200 transition-colors">
              Mintaly
            </Link>
            <button 
              className="lg:hidden p-2 rounded-lg hover:bg-accent"
              onClick={() => setSidebarOpen(false)}
              aria-label="Закрыть меню"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
            {needsVerification && (
              <NavLink
                to="/verify-email"
                className={({ isActive }) => cn(
                  'sidebar-btn text-yellow-500 hover:bg-yellow-500/10',
                  isActive && 'sidebar-btn-active'
                )}
              >
                <MailCheck className="w-5 h-5" />
                Подтвердить email
              </NavLink>
            )}

            {isAuthenticated && !needsVerification && navItems.map(({ path, label, icon: Icon, requiresSub }) => {
              if (requiresSub && !hasSubscription) return null;
              return (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) => cn(
                    'sidebar-btn',
                    isActive && 'sidebar-btn-active'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </NavLink>
              );
            })}

            {isAuthenticated && isDev && (
              <>
                <div className="pt-4 border-t border-border" />
                <NavLink
                  to="/admin"
                  className={({ isActive }) => cn(
                    'sidebar-btn',
                    isActive && 'sidebar-btn-active'
                  )}
                >
                  <Crown className="w-5 h-5" />
                  Admin Panel
                </NavLink>
              </>
            )}

            {isAuthenticated ? (
              <>
                <div className="pt-4 border-t border-border" />
                <button
                  onClick={handleLogout}
                  className="sidebar-btn text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <div className="pt-4 border-t border-border" />
                <Link to="/login" className="sidebar-btn text-zinc-300 hover:bg-zinc-800/70 hover:text-white">
                  <LogOut className="w-5 h-5 rotate-180" />
                  Войти
                </Link>
              </>
            )}
          </nav>

          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              © 2026 Mintaly
            </p>
            <div className="flex justify-center gap-4 mt-2 text-xs">
              <Link to="/settings?page=terms" className="text-muted-foreground hover:text-foreground">
                Соглашение
              </Link>
              <Link to="/settings?page=refund" className="text-muted-foreground hover:text-foreground">
                Правила возврата
              </Link>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64 min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6 gap-3">
            <button 
              className="lg:hidden p-2 rounded-lg hover:bg-accent"
              onClick={() => setSidebarOpen(true)}
              aria-label="Открыть меню"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="hidden lg:block flex-1" />

            <div className="flex items-center gap-2 sm:gap-3 flex-1 lg:flex-none justify-end">
              <CurrencySwitcher size="sm" className="mr-1" />
              {isAuthenticated && (
                <Link
                  to="/account"
                  className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs sm:text-sm font-semibold text-zinc-200 hover:border-zinc-500/80 hover:bg-zinc-800 transition-colors shadow-sm"
                  title="Ваш баланс"
                >
                  <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />
                  <span>{formatPrice(Number(user?.balance ?? 0))}</span>
                </Link>
              )}
              {needsVerification ? (
                <Link to="/verify-email" className="btn-primary">
                  <MailCheck className="w-4 h-4 mr-2" />
                  Подтвердить email
                </Link>
              ) : isAuthenticated ? (
                <>
                  {hasSubscription && (
                    <Link to="/download" className="btn-primary">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Link>
                  )}
                  <NavLink
                    to="/forum"
                    className={cn(
                      'hidden sm:inline-flex px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
                      location.pathname.startsWith('/forum')
                        ? 'bg-zinc-800 text-white border border-zinc-700/60 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    Forum
                  </NavLink>
                </>
              ) : (
                <Link to="/login" className="btn-primary">Войти</Link>
              )}
            </div>

            {isAuthenticated && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-100 font-semibold text-sm">
                    {user?.name ? user.name[0].toUpperCase() : '?'}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">{user?.name}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 animate-fade-in">
                    <div className="px-4 py-2 border-b border-border">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                      {isDev && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 rounded">
                          Developer
                        </span>
                      )}
                    </div>
                    <Link
                      to="/account"
                      className="block px-4 py-2 text-sm hover:bg-accent"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Account
                    </Link>
                    <Link
                      to="/settings"
                      className="block px-4 py-2 text-sm hover:bg-accent"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                      className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-accent"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main key={location.pathname} className="flex-1 container-main py-6 lg:py-8 animate-fade-in">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
