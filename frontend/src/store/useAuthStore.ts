import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  role: string;
  balance: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  updateBalance: (balance: number) => void;
  logout: () => void;
}

// Persist simple state to localStorage in init component
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user }),
  updateBalance: (balance) => set((state) => ({ user: state.user ? { ...state.user, balance } : null })),
  logout: () => {
    localStorage.removeItem('chess-auth-token');
    set({ token: null, user: null });
  },
}));
