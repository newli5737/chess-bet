'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { WalletService } from '@/services/api.service';
import Header from '@/components/Header';
import { User as UserIcon, Wallet, Plus, ClipboardList, Loader2, ArrowLeft } from 'lucide-react';

function ProfileContent() {
  const { user, updateBalance } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initTab = searchParams.get('tab') || 'info';

  const [activeTab, setActiveTab] = useState(initTab);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  const [amount, setAmount] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    WalletService.getBalance().then(data => {
       updateBalance(data.balance);
       if (data.walletTransactions) {
          setTransactions(data.walletTransactions);
       }
    }).catch(console.error);

    WalletService.getBankAccounts().then(data => {
       setBankAccounts(data);
       if (data.length > 0) setSelectedBankId(data[0].id);
    }).finally(() => setIsLoading(false));
  }, [user?.id, router, updateBalance]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) < 10000) {
       alert("Số tiền nạp tối thiểu là 10.000 VNĐ");
       return;
    }
    setIsSubmitting(true);
    try {
       await WalletService.deposit({
         amount: Number(amount),
         bankAccountId: selectedBankId,
         transferNote: note
       });
       alert("Tạo yêu cầu nạp tiền thành công! Xin vui lòng chuyển khoản để Admin duyệt.");
       setAmount('');
       setNote('');
       setActiveTab('history');
       
       // Refresh history
       const data = await WalletService.getBalance();
       if (data.walletTransactions) {
          setTransactions(data.walletTransactions);
       }
    } catch(err: any) {
       alert(err.response?.data?.error || "Có lỗi xảy ra khi tạo yêu cầu nạp tiền.");
    } finally {
       setIsSubmitting(false);
    }
  };

  if (!user || isLoading) return (
    <div className="flex h-[400px] items-center justify-center">
       <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto mt-10">
      <div className="flex items-center gap-4 mb-8 px-4">
        <button onClick={() => router.push('/')} className="hover:text-primary transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-3xl font-black italic tracking-tighter text-white">TRANG CÁ NHÂN</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-8 px-4">
         {/* Sidebar */}
         <div className="w-full md:w-64 flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('info')}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all border ${activeTab === 'info' ? 'bg-primary/20 text-primary border-primary/50' : 'glass hover:bg-white/10 text-white/70 border-white/5'}`}
            >
              <UserIcon className="w-5 h-5" /> Thông tin
            </button>
            <button 
              onClick={() => setActiveTab('deposit')}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all border ${activeTab === 'deposit' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'glass hover:bg-white/10 text-white/70 border-white/5'}`}
            >
              <Plus className="w-5 h-5" /> Nạp tiền
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all border ${activeTab === 'history' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'glass hover:bg-white/10 text-white/70 border-white/5'}`}
            >
              <ClipboardList className="w-5 h-5" /> Lịch sử ví
            </button>
         </div>

         {/* Content */}
         <div className="flex-1 glass p-8 rounded-3xl border border-white/10 shadow-2xl relative min-h-[400px]">
            {activeTab === 'info' && (
               <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                  <h2 className="text-2xl font-bold text-white mb-6">Thông tin tài khoản</h2>
                  <div className="flex items-center gap-4 p-4 bg-black/40 rounded-xl border border-white/5">
                     <div className="w-16 h-16 bg-gradient-to-br from-primary to-orange-600 rounded-full flex items-center justify-center border-2 border-white/20">
                        <UserIcon className="w-8 h-8 text-white" />
                     </div>
                     <div>
                        <p className="text-white/50 text-sm">Email</p>
                        <p className="text-xl font-bold text-white">{user.email}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-black/40 rounded-xl border border-white/5">
                     <div className="w-16 h-16 bg-gradient-to-br from-amber-600 to-amber-900 rounded-full flex items-center justify-center border-2 border-white/20">
                        <Wallet className="w-8 h-8 text-amber-400" />
                     </div>
                     <div>
                        <p className="text-white/50 text-sm">Số dư hiện tại</p>
                        <p className="text-2xl font-black text-amber-400">
                           {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(user.balance)}
                        </p>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'deposit' && (
               <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                  <h2 className="text-2xl font-bold text-green-400 mb-6 flex items-center gap-2">
                    <Plus className="w-6 h-6" /> Tạo lệnh nạp tiền
                  </h2>
                  <form onSubmit={handleDeposit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-white/60 mb-2 uppercase tracking-wider">Số tiền nạp (VNĐ)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 font-black text-xl">₫</span>
                        <input 
                          type="number" 
                          min="10000"
                          step="10000"
                          required
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="Ví dụ: 100000"
                          className="w-full bg-black/60 border border-white/10 rounded-xl pl-10 pr-4 py-4 text-2xl font-black focus:outline-none focus:ring-2 focus:ring-green-500/50 text-green-400 shadow-inner"
                        />
                      </div>
                    </div>
                    
                    {bankAccounts.length > 0 && (
                      <div>
                        <label className="block text-sm font-semibold text-white/60 mb-2 uppercase tracking-wider">Tài khoản đích</label>
                        <select 
                          value={selectedBankId}
                          onChange={(e) => setSelectedBankId(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-green-500/50 text-white shadow-inner appearance-none"
                        >
                          {bankAccounts.map(b => (
                            <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber} ({b.accountName})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-white/60 mb-2 uppercase tracking-wider">Nội dung chuyển khoản (Tùy chọn)</label>
                      <input 
                          type="text" 
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder={`Nap tien ${user.email.split('@')[0]}`}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-green-500/50 text-white shadow-inner"
                        />
                    </div>

                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-green-500 to-green-700 text-white font-black text-xl rounded-xl py-4 hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(34,197,94,0.3)] hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'TẠO YÊU CẦU NẠP'}
                    </button>
                    
                    <p className="text-xs text-white/40 text-center italic mt-4">Sau khi tạo yêu cầu, xin vui lòng chuyển khoản theo thông tin tài khoản đích. Admin sẽ cộng tiền vào tài khoản của bạn sau vài phút.</p>
                  </form>
               </div>
            )}

            {activeTab === 'history' && (
               <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                  <h2 className="text-2xl font-bold text-blue-400 mb-6 flex items-center gap-2">
                    <ClipboardList className="w-6 h-6" /> Lịch sử thay đổi số dư
                  </h2>
                  
                  {transactions.length === 0 ? (
                    <div className="text-center p-8 text-white/40 border border-dashed border-white/10 rounded-xl">
                       Chưa có lịch sử giao dịch nào.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map(t => (
                        <div key={t.id} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                           <div>
                              <p className={`font-bold ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {t.type === 'deposit' ? 'Nạp tiền' : t.type === 'bet' ? 'Cược' : t.type === 'win' ? 'Thắng cược' : 'Rút tiền'}
                              </p>
                              <p className="text-xs text-white/40 mt-1">{new Date(t.createdAt).toLocaleString('vi-VN')}</p>
                           </div>
                           <div className="text-right">
                              <p className={`font-black text-lg ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {t.amount > 0 ? '+' : ''}{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(t.amount)}
                              </p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${t.status === 'completed' ? 'bg-green-500/20 text-green-300' : t.status === 'failed' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                {t.status}
                              </span>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>
            )}
         </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background relative flex flex-col pb-10">
      <div 
        className="fixed inset-0 opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.2) 0%, rgba(0,0,0,0) 70%)' }}
      ></div>
      <Header />
      <div className="flex-grow z-10 relative">
        <Suspense fallback={<div className="flex h-[400px] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
          <ProfileContent />
        </Suspense>
      </div>
    </div>
  );
}
