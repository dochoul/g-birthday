import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { AccountMeInfo } from '../types/birthday';

interface AuthContextType {
  accountInfo: AccountMeInfo;
  isLoading: boolean;
}

const GUEST_USER: AccountMeInfo = {
  user_id: 'local',
  name: '로컬 사용자',
  address: '',
  cell: '',
  nodes: [],
};

const AuthContext = createContext<AuthContextType>({
  accountInfo: GUEST_USER,
  isLoading: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ accountInfo: GUEST_USER, isLoading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
