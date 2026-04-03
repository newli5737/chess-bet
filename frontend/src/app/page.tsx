'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useSocket } from '@/lib/useSocket';
import { WalletService } from '@/services/api.service';
import Header from '@/components/Header';
import { Swords, Loader2, Star, CheckCircle } from 'lucide-react';

interface RoomInfo {
  id: string;
  gameType: string;
  betAmount: number;
  status: string;
  playerCount?: number;
  hostId?: string | null;
  opponentId?: string | null;
  readyCount?: number;
}

export default function LobbyPage() {
  const { user, updateBalance } = useAuthStore();
  const { socket, isConnected } = useSocket();
  const router = useRouter();

  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'basic' | 'medium' | 'premium'>('basic');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    WalletService.getBalance()
      .then(data => {
        updateBalance(data.balance);
      })
      .catch(console.error);
  }, [user?.id, router, updateBalance]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('request_room_list');

    const handleRoomList = (roomList: RoomInfo[]) => {
      setRooms(roomList);
    };

    socket.on('room_list_update', handleRoomList);

    return () => {
      socket.off('room_list_update', handleRoomList);
    };
  }, [socket]);

  const handleJoinRoom = (room: RoomInfo) => {
    if (user) {
      router.push(`/room/${room.id}`);
    }
  };

  // Grouping Rooms into 3 Levels
  const basicRooms = rooms.filter(r => r.id.includes('basic'));
  const mediumRooms = rooms.filter(r => r.id.includes('medium'));
  const premiumRooms = rooms.filter(r => r.id.includes('premium'));

  const displayRooms = activeTab === 'basic' ? basicRooms
                     : activeTab === 'medium' ? mediumRooms
                     : premiumRooms;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background relative flex flex-col pb-10">
      <div
        className="absolute top-0 w-full h-[600px] opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.2) 0%, rgba(0,0,0,0) 70%)' }}
      ></div>

      <Header />

      <main className="flex-grow container mx-auto px-4 py-8 flex flex-col relative z-10">
        <div className="w-full">

          {/* Tabs */}
          <div className="flex bg-black/50 p-2 rounded-2xl border border-white/10 mb-8 backdrop-blur-md sticky top-28 z-40">
            <button
              onClick={() => setActiveTab('basic')}
              className={`flex-1 flex flex-col items-center py-4 rounded-xl transition-all ${activeTab === 'basic' ? 'bg-white/10 shadow-lg text-amber-400' : 'text-white/50 hover:text-white/80'}`}
            >
              <span className="font-bold text-lg uppercase tracking-widest">Cơ Bản</span>
              <span className="text-xs opacity-60">{"\u003C"} 100K VNĐ</span>
            </button>
            <button
              onClick={() => setActiveTab('medium')}
              className={`flex-1 flex flex-col items-center py-4 rounded-xl transition-all ${activeTab === 'medium' ? 'bg-white/10 shadow-lg text-amber-400' : 'text-white/50 hover:text-white/80'}`}
            >
              <span className="font-bold text-lg uppercase tracking-widest flex items-center gap-1"><Star className="w-4 h-4" /> Trung Cấp</span>
              <span className="text-xs opacity-60">100K - 1M VNĐ</span>
            </button>
            <button
              onClick={() => setActiveTab('premium')}
              className={`flex-1 flex flex-col items-center py-4 rounded-xl transition-all ${activeTab === 'premium' ? 'bg-white/10 shadow-lg text-amber-400' : 'text-white/50 hover:text-white/80'}`}
            >
              <span className="font-bold text-lg uppercase tracking-widest flex items-center gap-1"><Star className="w-4 h-4 fill-amber-400" /> Cao Cấp</span>
              <span className="text-xs opacity-60">{"\u2265"} 1M VNĐ</span>
            </button>
          </div>

          {!isConnected && (
            <div className="mb-6 p-4 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl flex items-center gap-3 font-semibold">
              <Loader2 className="animate-spin w-5 h-5" />
              Đang kết nối tới máy chủ thời gian thực...
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {displayRooms.map(room => (
              <div key={room.id} className="relative group perspective-1000">
                <div className={`relative w-full h-[320px] overflow-hidden rounded-3xl transition-all duration-700 transform group-hover:scale-[1.02] shadow-2xl border border-white/5 group-hover:border-primary/50`}>
                    <img
                      src="/xiangqi_table.png"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                      alt="Bàn Cờ Tướng"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 group-hover:from-black/80 transition-all duration-500"></div>

                    <div className="absolute top-5 left-5">
                      <span className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-md bg-red-500/30 text-red-100 border-red-500/50 shadow-red-500/20">
                        CỜ TƯỚNG | ID: {room.id.split('-').pop()}
                      </span>
                    </div>

                    {/* Ready indicator */}
                    {room.readyCount && room.readyCount > 0 && room.status === 'waiting' && (
                      <div className="absolute top-5 right-5 flex items-center gap-1 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full border border-green-500/50 backdrop-blur-md text-xs font-bold">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {room.readyCount}/2 Sẵn sàng
                      </div>
                    )}

                    <div className="absolute bottom-6 left-6 right-6 transition-all duration-500 group-hover:translate-y-[-20px] group-hover:opacity-0">
                      <h3 className="text-3xl font-black mt-2 text-white italic drop-shadow-xl flex items-center gap-2">
                        Kỳ Đài #{room.id.split('-').pop()}
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

                <div className="absolute inset-0 m-auto w-[80%] h-14 opacity-0 transform translate-y-10 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 pointer-events-none z-10 flex justify-center items-center">
                  <button
                    onClick={() => handleJoinRoom(room)}
                    className={`w-full font-black text-xl rounded-2xl py-4 transition-all shadow-[0_20px_40px_rgba(0,0,0,0.6)] backdrop-blur-lg border pointer-events-auto ${room.status === 'playing' ? 'bg-black/60 text-primary border-primary/50 hover:bg-primary hover:text-black' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black border-amber-400/50 hover:brightness-110'} shadow-[0_0_30px_rgba(245,158,11,0.5)]`}
                  >
                    {room.status === 'playing' ? 'VÀO XEM (KHÁN GIẢ)' : 'THAM CHIẾN NGAY'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
