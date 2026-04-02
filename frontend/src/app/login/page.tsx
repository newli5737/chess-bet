'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Loader2, Swords } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore(state => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token, user } = res.data;
      
      localStorage.setItem('chess-auth-token', token);
      setAuth(token, user);
      
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Đăng nhập thất bại. Kiểm tra lại thông tin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background"
      style={{
        background: 'radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.2) 0%, rgba(0,0,0,1) 100%)'
      }}
    >
      {/* Overlay để ảnh nền tối đê dễ nhìn text */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      <div className="glass w-full max-w-md p-10 rounded-3xl z-10 mx-4 border-t border-white/20 shadow-[0_0_50px_rgba(245,158,11,0.15)] relative">
        <div className="text-center mb-10">
          <Swords className="w-20 h-20 mx-auto mb-4 text-amber-500 drop-shadow-lg" />
          <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-200 uppercase">
            CHESS BET
          </h1>
          <p className="text-amber-100/70 mt-2 font-medium">Chào mừng trở lại đấu trường sinh tử</p>
        </div>

        {error && (
          <div className="bg-destructive/20 border border-destructive/50 text-destructive-foreground px-4 py-3 rounded-xl mb-6 text-sm text-center font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-amber-100/80 mb-2">Email của bạn</label>
            <input 
              type="email" 
              required
              className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/80 transition-all text-white placeholder-white/30"
              placeholder="ky-thu@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-amber-100/80 mb-2">Mật khẩu</label>
            <input 
              type="password" 
              required
              className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/80 transition-all text-white placeholder-white/30"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary to-amber-500 text-black font-black text-lg rounded-xl px-4 py-4 hover:brightness-110 transition-all mt-6 flex justify-center items-center shadow-[0_10px_30px_rgba(245,158,11,0.3)] hover:-translate-y-1"
          >
            {isLoading ? <Loader2 className="animate-spin w-6 h-6" /> : 'VÀO BÀN CỜ'}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-white/50">
          Chưa có tài khoản? <Link href="/register" className="text-primary hover:text-amber-300 transition-colors font-bold ml-1">Đăng ký Đại Kiện Tướng ngay</Link>
        </p>
      </div>
    </div>
  );
}
