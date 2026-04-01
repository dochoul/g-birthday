import { createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountMeInfo } from '../types/birthday';
import { getAccountMeInfo, getOAuthLoginUrl, logout as logoutApi } from '../api/client';

interface AuthContextType {
  accountInfo: AccountMeInfo | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  accountInfo: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: accountInfo = null, isLoading } = useQuery({
    queryKey: ['accountMe'],
    queryFn: getAccountMeInfo,
    retry: false,
  });

  const login = useCallback(async () => {
    const { authUrl } = await getOAuthLoginUrl();
    window.location.href = authUrl;
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    queryClient.clear();
    window.location.href = '/';
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ accountInfo, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
