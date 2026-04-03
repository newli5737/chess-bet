'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { AuthService } from '@/services/api.service';
import { LogOut, Swords, User, Wallet, PlusSquare } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await AuthService.logout();
    } catch(err) {
      console.error(err);
    }
    logout();
    router.push('/login');
  };

  if (!user) return null;

  return (
    <header className="glass-panel sticky top-0 z-50 flex flex-wrap items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-3 sm:gap-4 cursor-pointer" onClick={() => router.push('/')}>
        <Swords className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
        <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-200">
          CHESS BET
        </h1>
      </div>
      
      <div className="flex items-center gap-3 sm:gap-6 mt-4 sm:mt-0">
        <button 
          onClick={() => router.push('/profile')}
          className="flex items-center gap-2 bg-black/60 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-white/10 hover:bg-white/10 transition-all shadow-sm"
          title="Thông tin tài khoản"
        >
           <User className="w-4 h-4 text-primary" />
           <span className="text-sm font-semibold text-white/80 hidden md:inline">{user.email}</span>
        </button>
        
        <div className="flex items-center gap-2 bg-gradient-to-r from-black/80 to-amber-950/40 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
           <Wallet className="w-4 h-4 text-primary animate-pulse" />
           <span className="text-sm sm:text-base font-bold text-amber-400">
             {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(user.balance)}
           </span>
        </div>

        <button 
          onClick={() => router.push('/profile?tab=deposit')}
          className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-green-600/20 text-green-400 border border-green-500/50 rounded-full font-bold hover:bg-green-600 hover:text-white transition-all shadow-lg"
        >
          <PlusSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Nạp tiền</span>
        </button>

        <button onClick={handleLogout} className="p-2 sm:p-2.5 bg-destructive/20 text-destructive rounded-full hover:bg-destructive hover:text-white transition-all shadow-lg">
           <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </header>
  );
}
