'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/services/api';

export interface UserProfile {
  id: string;
  name: string;
  publicAlias: string;
  email: string;
  role: 'AUCTIONEER' | 'BIDDER';
  totalBalance: number;
  committedBalance: number;
  availableBalance: number;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  darkMode: boolean;
  toggleDarkMode: () => void;
  loginWithToken: (token: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem('verzel_theme');
    const isDark = savedTheme ? savedTheme === 'dark' : true;
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('verzel_theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  };

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem('verzel_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await apiFetch<UserProfile>('/auth/me');
      setUser(profile);
    } catch {
      localStorage.removeItem('verzel_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const loginWithToken = async (token: string) => {
    localStorage.setItem('verzel_token', token);
    await refreshProfile();
  };

  const logout = () => {
    localStorage.removeItem('verzel_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        darkMode,
        toggleDarkMode,
        loginWithToken,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);