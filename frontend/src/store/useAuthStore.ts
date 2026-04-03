import { create } from 'zustand';
import { AuthService } from '@/services/api.service';

interface User {
  id: string;
  email: string;
  role: string;
  balance: number;
}

interface AuthState {
  user: User | null;
  setAuth: (user: User | null) => void;
  updateBalance: (balance: number) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

// Persist simple state to localStorage in init component
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setAuth: (user) => set({ user }),
  updateBalance: (balance) => set((state) => ({ user: state.user ? { ...state.user, balance } : null })),
  logout: () => {
    localStorage.removeItem('chess-auth-user'); // optionally
    set({ user: null });
  },
  checkAuth: async () => {
    try {
      const userData = await AuthService.getMe();
      if (userData) {
        set({ user: userData });
      } else {
        set({ user: null });
      }
    } catch (error) {
      set({ user: null });
    }
  }
}));
