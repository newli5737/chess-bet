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
  },

  withdraw: async (data: { amount: number, bankName: string, accountNumber: string, accountHolder: string, note?: string }) => {
    const res = await api.post('/wallet/withdraw', data);
    return res.data;
  },
};

export const AdminService = {
  getUsers: async () => {
    const res = await api.get('/admin/users');
    return res.data;
  },

  getRooms: async () => {
    const res = await api.get('/admin/rooms');
    return res.data;
  },

  // ── Deposits ──
  getDeposits: async () => {
    const res = await api.get('/admin/deposits');
    return res.data;
  },

  approveDeposit: async (id: string) => {
    const res = await api.post(`/admin/deposits/${id}/approve`);
    return res.data;
  },

  rejectDeposit: async (id: string) => {
    const res = await api.post(`/admin/deposits/${id}/reject`);
    return res.data;
  },

  // ── Withdrawals ──
  getWithdrawals: async () => {
    const res = await api.get('/admin/withdrawals');
    return res.data;
  },

  approveWithdrawal: async (id: string) => {
    const res = await api.post(`/admin/withdrawals/${id}/approve`);
    return res.data;
  },

  rejectWithdrawal: async (id: string) => {
    const res = await api.post(`/admin/withdrawals/${id}/reject`);
    return res.data;
  },
};

