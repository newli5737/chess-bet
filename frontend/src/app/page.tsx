'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useSocket } from '@/lib/useSocket';
import { api } from '@/lib/api';
import { LogOut, Plus, Swords, User, Wallet, Trophy, Flame, Loader2 } from 'lucide-react';

export default function LobbyPage() {
  const { user, token, logout, updateBalance } = useAuthStore();
  const { socket, isConnected } = useSocket();
  const router = useRouter();
  
  const [betAmount, setBetAmount] = useState<string>('100000');
  const [gameType, setGameType] = useState<'chess' | 'xiangqi'>('chess');
  const [rooms, setRooms] = useState<{id: string, gameType: string, betAmount: number, status: string, playerCount?: number}[]>([]);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    
    // Fetch initial balance
    api.get('/api/wallet').then(res => {
      updateBalance(res.data.balance);
    }).catch(console.error);

  }, [token, router, updateBalance]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('request_room_list');

    socket.on('room_list_update', (roomList: any[]) => {
         // handle both old format (string[]) and new format (object[]) just in case
         if (roomList.length > 0 && typeof roomList[0] === 'string') {
            setRooms(roomList.map(id => ({ id, gameType: 'chess', betAmount: 0, status: 'waiting', playerCount: 1 })));
         } else {
            setRooms(roomList);
         }
      });
      
      socket.on('room_created', (data: any) => {
         router.push(`/room/${data.roomId}`);
      });
      
      socket.on('error', (err: any) => {
         alert(err.message || 'Có lỗi xảy ra!');
      });
  }, [socket, router]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.balance < Number(betAmount)) {
      alert("Bạn không đủ số dư trong ví để cược số tiền này!");
      return;
    }
    if (socket) {
      socket.emit('create_room', { userId: user.id, betAmount: Number(betAmount), gameType });
    } else {
      alert("Đang kết nối tới máy chủ, vui lòng đợi...");
    }
  };

  const handleJoinRoom = (roomId: string) => {
    if (socket && user) {
      router.push(`/room/${roomId}`);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      {/* Background Banners */}
      <div 
        className="absolute top-0 w-full h-[600px] opacity-30 pointer-events-none"
        style={{
           background: 'radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.2) 0%, rgba(0,0,0,0) 70%)'
        }}
      ></div>

      {/* Navbar */}
      <header className="glass-panel sticky top-0 z-50 flex items-center justify-between px-8 py-5 border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4">
          <Swords className="w-10 h-10 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
          <h1 className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-200">
            CHESS BET
          </h1>
        </div>
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="hidden md:flex items-center gap-2 bg-black/60 px-5 py-2.5 rounded-full border border-white/10">
             <User className="w-4 h-4 text-primary" />
             <span className="text-sm font-semibold text-white/80">{user.email}</span>
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-r from-black/80 to-amber-950/40 px-5 py-2.5 rounded-full border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
             <Wallet className="w-4 h-4 text-primary animate-pulse" />
             <span className="text-base font-bold text-amber-400">
               {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(user.balance)}
             </span>
          </div>
          <button onClick={logout} className="p-2.5 bg-destructive/20 text-destructive rounded-full hover:bg-destructive hover:text-white transition-all shadow-lg">
             <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-12 flex flex-col lg:flex-row gap-10 relative z-10">
        
        {/* Left Column: Create Room */}
        <div className="w-full lg:w-[400px] space-y-6 flex-shrink-0">
          <div className="glass p-8 rounded-3xl relative overflow-hidden group border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <Trophy className="w-24 h-24" />
            </div>
            <h2 className="text-3xl font-black mb-6 flex items-center gap-3 italic tracking-tight text-white">
              <Flame className="w-8 h-8 text-orange-500 animate-pulse" />
              TẠO CƯỢC MỚI
            </h2>
            <form onSubmit={handleCreateRoom} className="space-y-6 relative z-10">
              <div>
                <label className="block text-sm font-semibold text-white/60 mb-2 uppercase tracking-wider">Tiền cược (VNĐ)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black text-xl">₫</span>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl pl-10 pr-4 py-4 text-3xl font-black focus:outline-none focus:ring-2 focus:ring-primary/50 text-amber-400 shadow-inner"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/60 mb-2 uppercase tracking-wider">Loại Cờ</label>
                <select 
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value as 'chess' | 'xiangqi')}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-4 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 text-white shadow-inner appearance-none"
                >
                  <option value="chess">Cờ Vua (Chess)</option>
                  <option value="xiangqi">Cờ Tướng (Xiangqi)</option>
                </select>
              </div>
              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-xl rounded-xl py-5 hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(245,158,11,0.4)] hover:-translate-y-1"
              >
                <Plus className="w-7 h-7" />
                MỞ PHÒNG CHƠI
              </button>
            </form>
          </div>
          
          {/* Promos */}
          <div className="rounded-3xl overflow-hidden relative border border-white/10 shadow-xl h-[200px] bg-gradient-to-br from-amber-950/80 to-black p-6 flex flex-col justify-end">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <Trophy className="w-32 h-32" />
             </div>
             <div className="relative z-10">
                <h3 className="text-2xl font-bold text-amber-400 italic mb-2">Vinh Danh Nạp Rút</h3>
                <p className="text-sm text-white/70">Nạp nhanh qua Vietcombank. Tiền cược chuyển ngay trong 1 nốt nhạc.</p>
             </div>
          </div>
        </div>

        {/* Right Column: Open Lobbies */}
        <div className="w-full lg:flex-1">
          <div className="flex items-center gap-3 mb-8">
            <Swords className="w-8 h-8 text-primary" />
            <h2 className="text-4xl font-black italic tracking-tight text-white shadow-black drop-shadow-md">ĐẤU TRƯỜNG ĐANG MỞ</h2>
          </div>
          
          {!isConnected && (
            <div className="mb-6 p-4 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl flex items-center gap-3 font-semibold">
               <Loader2 className="animate-spin w-5 h-5" />
               Đang kết nối tới máy chủ thời gian thực...
            </div>
          )}

          {rooms.length === 0 ? (
            <div className="glass p-16 rounded-3xl text-center flex flex-col items-center border border-dashed border-white/20">
               <Trophy className="w-20 h-20 text-white/20 mb-6 drop-shadow-lg" />
               <h3 className="text-2xl font-bold text-white mb-2">Chưa có ai mở bàn cược trưa nay</h3>
               <p className="text-white/50 max-w-sm text-lg">Hãy trở thành người đầu tiên mở bàn và đợi Kiện tướng khác vào thách đấu.</p>
            </div>
          ) : (
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
               {rooms.map(room => (
                 <div key={room.id} className="relative group perspective-1000">
                    <div className="relative w-full h-[320px] overflow-hidden rounded-3xl transition-transform duration-700 transform group-hover:scale-[1.02] shadow-2xl border border-white/5 group-hover:border-primary/50">
                       <img 
                          src={room.gameType === 'xiangqi' ? "/xiangqi_table.png" : "/chess_table.png"} 
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                          alt={room.gameType === 'xiangqi' ? 'Bàn Cờ Tướng' : 'Bàn Cờ Vua'}
                       />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 group-hover:from-black/80 transition-all duration-500"></div>
                       
                       <div className="absolute top-5 left-5">
                         <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-md ${room.gameType === 'xiangqi' ? 'bg-red-500/30 text-red-100 border-red-500/50 shadow-red-500/20' : 'bg-amber-500/30 text-amber-100 border-amber-500/50 shadow-amber-500/20'}`}>
                           {room.gameType === 'xiangqi' ? 'CỜ TƯỚNG' : 'CỜ VUA'} | ID: {room.id.substring(0, 6).toUpperCase()}
                         </span>
                       </div>

                       <div className="absolute bottom-6 left-6 right-6 transition-all duration-500 group-hover:translate-y-[-20px] group-hover:opacity-0">
                         <h3 className="text-3xl font-black mt-2 text-white italic drop-shadow-xl flex items-center gap-2">
                            Kỳ Đài #00{room.id.substring(room.id.length - 2)}
                         </h3>
                         <div className="text-base font-semibold text-white/90 mt-3 flex items-center gap-3 bg-black/40 w-fit px-4 py-2 rounded-xl backdrop-blur-md border border-white/10">
                            <span className="text-amber-400">Cược: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(room.betAmount || 0)}</span>
                            <span className="text-white/30">•</span>
                            <span className="text-white/90 font-black tracking-widest">{room.playerCount ?? 0}/2 <span className="font-medium text-xs ml-1 text-white/50">NGƯỜI</span></span>
                            <span className="text-white/30">•</span>
                            {(() => {
                               const isDisconnected = room.status === 'playing' && (room.playerCount ?? 0) < 2;
                               const textColor = isDisconnected ? 'text-red-400' : (room.status === 'playing' ? 'text-green-400' : 'text-yellow-400 animate-pulse');
                               const bgColor = isDisconnected ? 'bg-red-400' : (room.status === 'playing' ? 'bg-green-400' : 'bg-yellow-400');
                               const label = isDisconnected ? 'Mất Kết Nối' : (room.status === 'playing' ? 'Đang Giao Tranh' : 'Đang Chờ Khách');

                               return (
                                 <span className={`flex items-center gap-2 ${textColor}`}>
                                   <div className={`w-2 h-2 rounded-full ${bgColor}`}></div>
                                   {label}
                                 </span>
                               );
                            })()}
                         </div>
                       </div>
                    </div>
                    
                    {/* Floating Action Button - Pops up on hover */}
                    <div className="absolute inset-0 m-auto w-[80%] h-14 opacity-0 transform translate-y-10 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 pointer-events-none z-10 flex justify-center items-center">
                      <button 
                        onClick={() => handleJoinRoom(room.id)}
                        className={`w-full font-black text-xl rounded-2xl py-4 transition-all shadow-[0_20px_40px_rgba(0,0,0,0.6)] backdrop-blur-lg border pointer-events-auto ${room.status === 'playing' ? 'bg-black/60 text-primary border-primary/50 hover:bg-primary hover:text-black shadow-[0_0_30px_rgba(245,158,11,0.3)]' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black border-amber-400/50 hover:brightness-110 shadow-[0_0_30px_rgba(245,158,11,0.5)]'}`}
                      >
                        {room.status === 'playing' ? 'VÀO XEM (KHÁN GIẢ)' : 'THAM CHIẾN NGAY'}
                      </button>
                    </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
