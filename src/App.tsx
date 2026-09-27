import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { DashboardPage } from './pages/DashboardPage';
import { AccountPage } from './pages/AccountPage';
import { TicketsPage } from './pages/TicketsPage';
import { TicketPage } from './pages/TicketPage';
import { RedeemPage } from './pages/RedeemPage';
import { ResetPage } from './pages/ResetPage';
import { DownloadPage } from './pages/DownloadPage';
import { ForumPage } from './pages/ForumPage';
import { ForumThreadPage } from './pages/ForumThreadPage';
import { NewsListPage } from './pages/NewsListPage';
import { NewsPage } from './pages/NewsPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { AdminPage } from './pages/AdminPage';
import { SettingsPage } from './pages/SettingsPage';
import './index.css';

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
    </div>
  );
}

function ProtectedRoute({ children, requireSub = false, requireDev = false }: { 
  children: React.ReactNode; 
  requireSub?: boolean; 
  requireDev?: boolean;
}) {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  if (isLoading) {
    return <FullScreenLoader />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  
  if (requireSub && user && !user.sub_active) {
    return <Navigate to="/dashboard" replace />;
  }
  
  if (requireDev && user && !user.dev) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <FullScreenLoader />;
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

/**
 * The email confirmation page is reached *after* registering or logging in,
 * so the user is already authenticated but still unverified — it must not
 * be wrapped in `PublicRoute`.
 */
function VerifyEmailRoute() {
  const { isAuthenticated, user, isLoading, refreshProfile } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }
  if (isAuthenticated && user?.email_verified) {
    return <Navigate to="/dashboard" replace />;
  }

  return <VerifyEmailPage onVerified={refreshProfile} />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
      <Route path="/verify-email" element={<VerifyEmailRoute />} />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout>
            <DashboardPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/account" element={
        <ProtectedRoute>
          <Layout>
            <AccountPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/tickets" element={
        <ProtectedRoute>
          <Layout>
            <TicketsPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/tickets/:id" element={
        <ProtectedRoute>
          <Layout>
            <TicketPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/redeem" element={
        <ProtectedRoute>
          <Layout>
            <RedeemPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/reset" element={
        <ProtectedRoute>
          <Layout>
            <ResetPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/download" element={
        <ProtectedRoute requireSub>
          <Layout>
            <DownloadPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/forum" element={
        <ProtectedRoute>
          <Layout>
            <ForumPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/forum/:id" element={
        <ProtectedRoute>
          <Layout>
            <ForumThreadPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/news" element={
        <ProtectedRoute>
          <Layout>
            <NewsListPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/news/:id" element={
        <ProtectedRoute>
          <Layout>
            <NewsPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/subscription" element={
        <ProtectedRoute>
          <Layout>
            <SubscriptionPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin" element={
        <ProtectedRoute requireDev>
          <Layout>
            <AdminPage />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <Layout>
          <SettingsPage />
        </Layout>
      } />
      
      <Route path="/terms" element={<Navigate to="/settings?page=terms" replace />} />
      <Route path="/refund" element={<Navigate to="/settings?page=refund" replace />} />
      
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CurrencyProvider>
    </AuthProvider>
  );
}

export default App;