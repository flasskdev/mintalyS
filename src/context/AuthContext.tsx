import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import type { User, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, hwid?: string, code?: string) => Promise<AuthResponse>;
  register: (email: string, password: string, name: string, hwid?: string) => Promise<AuthResponse>;
  verifyEmailSession: (code: string, email?: string) => Promise<AuthResponse>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    // If we have a token but no cached user yet, show loader while fetching
    return Boolean(savedToken && !savedUser);
  });

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    api.setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }, []);

  const refreshProfile = useCallback(async (explicitToken?: string) => {
    const currentToken = explicitToken || token || localStorage.getItem('auth_token');
    if (!currentToken) return;
    try {
      api.setToken(currentToken);
      const response = await api.getProfile();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        localStorage.setItem('auth_user', JSON.stringify(response.data.user));
      } else if (response.message === 'Требуется авторизация') {
        // Token was invalidated server-side (password change, admin action, etc.)
        clearSession();
      }
    } catch (error: unknown) {
      // Only clear session on 401 Unauthorized — keep cached data on network errors
      const msg = error instanceof Error ? error.message : '';
      if (msg === 'Требуется авторизация') {
        clearSession();
      } else {
        console.warn('Profile refresh failed (keeping session):', msg);
      }
    }
  }, [token, clearSession]);

  const login = async (email: string, password: string, hwid?: string, code?: string): Promise<AuthResponse> => {
    const response = await api.login(email, password, hwid, code);
    if (response.success && response.token) {
      setToken(response.token);
      api.setToken(response.token);
      localStorage.setItem('auth_token', response.token);
      if (response.data?.user) {
        setUser(response.data.user);
        localStorage.setItem('auth_user', JSON.stringify(response.data.user));
      } else {
        const profileResponse = await api.getProfile();
        if (profileResponse.success && profileResponse.data?.user) {
          setUser(profileResponse.data.user);
          localStorage.setItem('auth_user', JSON.stringify(profileResponse.data.user));
        }
      }
    }
    return response;
  };

  const register = async (email: string, password: string, name: string, hwid?: string): Promise<AuthResponse> => {
    const response = await api.register(email, password, name, hwid);
    if (response.success && response.token) {
      setToken(response.token);
      api.setToken(response.token);
      localStorage.setItem('auth_token', response.token);
      if (response.data?.user) {
        setUser(response.data.user);
        localStorage.setItem('auth_user', JSON.stringify(response.data.user));
      } else {
        const profileResponse = await api.getProfile();
        if (profileResponse.success && profileResponse.data?.user) {
          setUser(profileResponse.data.user);
          localStorage.setItem('auth_user', JSON.stringify(profileResponse.data.user));
        }
      }
    }
    return response;
  };

  const verifyEmailSession = async (code: string, email?: string): Promise<AuthResponse> => {
    const response = await api.verifyEmail(code, email);
    if (response.success && response.token) {
      setToken(response.token);
      api.setToken(response.token);
      localStorage.setItem('auth_token', response.token);
      if (response.data?.user) {
        setUser(response.data.user);
        localStorage.setItem('auth_user', JSON.stringify(response.data.user));
      }
    }
    return response;
  };

  const logout = useCallback(() => {
    api.logout().catch(() => undefined);
    clearSession();
  }, [clearSession]);

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...userData };
      localStorage.setItem('auth_user', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      api.setToken(storedToken);
      refreshProfile(storedToken).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshProfile]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      verifyEmailSession,
      logout,
      refreshProfile,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}