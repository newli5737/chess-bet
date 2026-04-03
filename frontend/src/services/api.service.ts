import { api } from '@/lib/api';

export const AuthService = {
  login: async (credentials: { email: string, password: string }) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  
  register: async (credentials: { email: string, password: string }) => {
    const res = await api.post('/auth/register', credentials);
    return res.data;
  },
  
  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
  
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  }
};

export const WalletService = {
  getBalance: async () => {
    const res = await api.get('/wallet');
    return res.data;
  },

  getBankAccounts: async () => {
    const res = await api.get('/wallet/bank-accounts');
    return res.data;
  },

  deposit: async (data: { amount: number, bankAccountId: string, transferNote?: string }) => {
    const res = await api.post('/wallet/deposit', data);
    return res.data;
  }
};
