'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useSocket } from '@/lib/useSocket';
import { Chessboard as XiangqiBoard } from 'react-xiangqiboard';
import { User, ShieldAlert, Trophy } from 'lucide-react';
import Header from '@/components/Header';

export default function RoomPage({ params }: { params: { id: string } }) {
  const roomId = params.id;
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const router = useRouter();

  const AnyXiangqiBoard = XiangqiBoard as any;

  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [roomStatus, setRoomStatus] = useState('waiting');
  const [gameType, setGameType] = useState<'xiangqi'>('xiangqi');
  const [xiangqiFen, setXiangqiFen] = useState<any>('start');
  const [xiangqiTurn, setXiangqiTurn] = useState<'w'|'b'>('w');
  const xiangqiPosRef = useRef<any>({});
  const [winnerMessage, setWinnerMessage] = useState('');
  const [betAmount, setBetAmount] = useState<number | null>(null);

  const [hostTime, setHostTime] = useState(1200);
  const [opponentTime, setOpponentTime] = useState(1200);
  const [lastMoveTimestamp, setLastMoveTimestamp] = useState<number | null>(null);

  useEffect(() => {
    // Client-side visual timer countdown
    const interval = setInterval(() => {
      if (roomStatus === 'playing' && lastMoveTimestamp) {
        if (xiangqiTurn === 'w') {
           setHostTime(prev => Math.max(0, prev - 1));
        } else {
           setOpponentTime(prev => Math.max(0, prev - 1));
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [roomStatus, xiangqiTurn, lastMoveTimestamp]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (socket) {
      socket.emit('join_room', { userId: user.id, roomId });

      socket.on('room_update', (data) => {
        useAuthStore.getState().checkAuth(); // Auto Sync Wallet
        setRoomStatus(data.status);
        if (data.status === 'playing') setWinnerMessage('');
        if (data.opponentId === user.id) {
           setBoardOrientation('black');
        } else {
           setBoardOrientation('white');
        }
      });

      socket.on('game_state', (data) => {
        useAuthStore.getState().checkAuth(); // Auto Sync Wallet
        setRoomStatus(data.status);
        if (data.status === 'playing') setWinnerMessage('');
        if (data.opponentId === user.id) {
           setBoardOrientation('black');
        } else {
           setBoardOrientation('white');
        }
        if (data.hostTime !== undefined) setHostTime(data.hostTime);
        if (data.opponentTime !== undefined) setOpponentTime(data.opponentTime);
        if (data.lastMoveTimestamp) setLastMoveTimestamp(data.lastMoveTimestamp);
        if (data.gameType) setGameType(data.gameType);
        if (data.gameType === 'xiangqi') {
           try {
             setXiangqiFen(data.fen?.startsWith('{') ? JSON.parse(data.fen) : data.fen);
           } catch(e) {}
           if (data.xiangqiTurn) setXiangqiTurn(data.xiangqiTurn);
        }
      });

      socket.on('move_made', (data) => {
        if (data.hostTime !== undefined) setHostTime(data.hostTime);
        if (data.opponentTime !== undefined) setOpponentTime(data.opponentTime);
        if (data.lastMoveTimestamp) setLastMoveTimestamp(data.lastMoveTimestamp);

        if (data.gameType === 'xiangqi') {
           try {
             setXiangqiFen(data.fen?.startsWith('{') ? JSON.parse(data.fen) : data.fen);
           } catch(e) {}
           if (data.xiangqiTurn) setXiangqiTurn(data.xiangqiTurn);
        }
      });

      socket.on('game_end', (data) => {
        useAuthStore.getState().checkAuth(); // Sync Wallet for rewards
        setRoomStatus('finished');
        if (data.winnerId === user.id) {
           setWinnerMessage('CHIẾN THẮNG!');
        } else if (data.winnerId) {
           setWinnerMessage('THẤT BẠI.');
        } else {
           setWinnerMessage('HÒA KỲ!');
        }
      });
      
      socket.on('error', (err) => {
        alert(err.message);
        if (err.message === 'Room not found') {
           router.push('/');
        }
      });

      return () => {
         socket.emit('leave_room', { roomId, userId: user.id });
         socket.off('room_update');
         socket.off('game_state');
         socket.off('move_made');
         socket.off('game_end');
         socket.off('error');
      };
    }
  }, [socket, roomId, user?.id, router]);



  const handleXiangqiDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
      // Very basic MVP for Cờ Tướng: we send an update request to the server, but without a powerful xiangqi engine on frontend, we might have to just trust the board's internal update if we can't generate the FEN easily.
      // But wait! react-xiangqiboard manages FEN internally when you let it move. We'll just capture it.
      // Actually, we can use `onPieceDrop` which returns true if successful. If it is successful, how do we get the new FEN?
      // react-xiangqiboard has `position` prop. If we modify it, it updates. We need xiang.js or similar to compute the new FEN.
      // For MVP, if it's too complex to validate Xiangqi instantly, we will just alert 'Cờ Tướng requires backend validation full setup'.
      alert('Playing purely visually for now in MVP');
      return true;
  };

  const isPlayerTurn = () => {
      return (xiangqiTurn === 'w' && boardOrientation === 'white') || 
             (xiangqiTurn === 'b' && boardOrientation === 'black');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
       {/* Background Ambience */}
       <div 
        className="fixed inset-0 opacity-10 pointer-events-none"
        style={{
           backgroundImage: "url('https://images.unsplash.com/photo-1580541832626-2a7131ee3c37?q=80&w=2149&auto=format&fit=crop')",
           backgroundSize: 'cover',
           backgroundPosition: 'center',
        }}
       ></div>
       <div className="fixed inset-0 bg-gradient-to-b from-transparent to-background/90 pointer-events-none"></div>

       <Header />

       <div className="w-full flex flex-col items-center py-6 px-4 flex-grow relative z-10">
         <div className="w-full max-w-7xl flex justify-between items-center mb-8">
         <button onClick={() => router.push('/')} className="bg-white/5 border border-white/10 px-5 py-2.5 rounded-full text-white hover:bg-white/10 transition-all font-semibold flex items-center gap-2">
           <span>←</span> Thoát khỏi Phòng
         </button>
         <div className="px-5 py-2 rounded-full glass border border-amber-500/30 text-amber-400 font-mono tracking-widest text-sm font-bold shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            MÃ PHÒNG: {roomId.slice(0,8).toUpperCase()}
         </div>
       </div>
       
       <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-10 items-center lg:items-start relative z-10">
          
          {/* Tùy chỉnh Chess Board Container */}
          <div className="w-full lg:w-[650px] flex-shrink-0">
             <div className="flex items-center gap-3 mb-4 opacity-80">
                <div className="w-12 h-12 bg-black rounded-xl border border-white/10 flex items-center justify-center">
                  <User className="text-muted-foreground w-6 h-6" />
                </div>
                <div>
                   <h4 className="font-bold text-white text-lg">ĐỐI THỦ</h4>
                   <p className="text-xs text-muted-foreground">
                      {roomStatus === 'playing' ? (
                        <>Đang giao tranh • <span className="text-amber-500 font-mono font-bold text-sm bg-black/40 px-2 py-0.5 rounded ml-1 border border-amber-900/50">{formatTime(boardOrientation === 'white' ? opponentTime : hostTime)}</span></>
                      ) : 'Chưa có đối thủ'}
                   </p>
                </div>
             </div>

             <div className={`p-3 rounded-2xl border-[3px] bg-black/40 transition-all duration-500 shadow-2xl ${isPlayerTurn() && roomStatus === 'playing' ? 'border-primary shadow-[0_0_40px_rgba(245,158,11,0.5)]' : 'border-white/5'}`}>

                  <div className="bg-[#e4ca9f] p-2 rounded-lg flex justify-center w-full min-h-[550px]">
                    <AnyXiangqiBoard 
                      position={xiangqiFen} 
                      boardWidth={530}
                      boardOrientation={boardOrientation}
                      getPositionObject={(pos: any) => { xiangqiPosRef.current = pos; }}
                      onPieceDrop={(s: string, t: string, piece: string) => {
                          if (roomStatus !== 'playing') return false;
                          
                          // Check if it's player's turn
                          if ((xiangqiTurn === 'w' && boardOrientation === 'black') || 
                              (xiangqiTurn === 'b' && boardOrientation === 'white')) {
                              return false;
                          }
                          // Check if moving own piece
                          if (!piece || piece[0] !== boardOrientation[0]) return false;

                          const newPos = { ...xiangqiPosRef.current };
                          newPos[t] = piece;
                          delete newPos[s];
                          
                          const nextTurn = xiangqiTurn === 'w' ? 'b' : 'w';
                          setXiangqiFen(newPos);
                          setXiangqiTurn(nextTurn);

                          if (socket && user) {
                            socket.emit('make_move', { 
                               roomId, 
                               userId: user.id, 
                               fen: JSON.stringify(newPos),
                               xiangqiTurn: nextTurn
                            });
                          }
                          return true;
                      }}
                    />
                  </div>
             </div>

             <div className="flex items-center justify-end gap-3 mt-4">
                <div className="text-right">
                   <h4 className="font-bold text-primary text-lg">BẠN ({user.email.split('@')[0]})</h4>
                   <p className="text-xs text-primary/70">
                       {boardOrientation === 'white' ? 'Đội Đỏ (Đi Trước)' : 'Đội Đen'}
                       {roomStatus === 'playing' && <> • <span className="text-amber-500 font-mono font-bold text-sm bg-black/40 px-2 py-0.5 rounded ml-1 border border-amber-900/50">{formatTime(boardOrientation === 'white' ? hostTime : opponentTime)}</span></>}
                   </p>
                </div>
                <div className="w-12 h-12 bg-primary/20 rounded-xl border border-primary/50 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.4)]">
                  <User className="text-primary w-6 h-6" />
                </div>
             </div>
          </div>

          <div className="flex-1 w-full space-y-6">
             <div className="glass p-8 rounded-3xl border border-white/10 shadow-2xl">
                <div className="flex items-center gap-3 mb-8">
                   <Trophy className="w-10 h-10 text-amber-500" />
                   <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white">Trạng Thái Bàn</h2>
                </div>
                
                <div className="space-y-6 bg-black/40 p-6 rounded-2xl border border-white/5">
                   <div className="flex justify-between items-center pb-4 border-b border-white/10">
                      <span className="text-white/60 font-medium uppercase tracking-wider text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> Diễn biến</span>
                      <span className={`px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-wider shadow-lg ${roomStatus === 'playing' ? 'bg-amber-500 text-black animate-pulse' : 'bg-white/20 text-white'}`}>
                        {roomStatus === 'waiting' ? 'Đang Chờ Khách' : roomStatus === 'playing' ? 'Đang Giao Tranh' : 'Đã Kết Thúc'}
                      </span>
                   </div>
                   <div className="flex justify-between items-center pb-4 border-b border-white/10">
                      <span className="text-white/60 font-medium uppercase tracking-wider text-sm">Quân của bạn</span>
                      <span className="font-black text-lg capitalize">{boardOrientation === 'white' ? 'Đỏ' : 'Đen'}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-white/60 font-medium uppercase tracking-wider text-sm">Đến Lượt</span>
                      <span className={`font-black text-xl bg-clip-text text-transparent ${xiangqiTurn === 'w' ? 'bg-gradient-to-r from-red-500 to-red-400 drop-shadow-[0_0_2px_rgba(239,68,68,0.8)]' : 'bg-gradient-to-r from-gray-600 to-gray-800 drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]'}`}>
                        {xiangqiTurn === 'w' ? 'Người Chơi Đỏ' : 'Người Chơi Đen'}
                      </span>
                   </div>
                </div>

                {winnerMessage && (
                  <div className="mt-8 p-6 bg-gradient-to-r from-amber-600 to-orange-600 border border-amber-400 rounded-2xl text-center font-black text-xl text-black shadow-[0_0_40px_rgba(245,158,11,0.6)] animate-in fade-in zoom-in duration-500">
                    <Trophy className="w-12 h-12 mx-auto mb-2 text-white" />
                    {winnerMessage}
                    <div className="flex justify-center gap-4 mt-6">
                        <button 
                            onClick={() => {
                                socket?.emit('play_again', { roomId, userId: user!.id });
                                setWinnerMessage(winnerMessage + ' (Đang đợi đối thủ...)');
                            }}
                            className="bg-white text-orange-600 px-6 py-2 rounded-full font-bold hover:bg-orange-100 transition-all shadow-lg text-sm"
                        >
                            Tiếp Tục Chơi
                        </button>
                        <button 
                            onClick={() => router.push('/')}
                            className="bg-black/20 border border-black/30 text-white px-6 py-2 rounded-full font-bold hover:bg-black/40 transition-all shadow-lg text-sm"
                        >
                            Rời Bàn
                        </button>
                    </div>
                  </div>
                )}

                {roomStatus === 'waiting' && (
                  <div className="mt-8 p-6 glass border border-blue-400/30 text-blue-200 rounded-2xl text-center text-lg font-semibold animate-pulse shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                    <div className="loader inline-block border-2 border-t-2 border-blue-400 rounded-full w-6 h-6 mb-3 border-t-transparent animate-spin"></div>
                    <p>Đang tìm kiếm đối thủ tham gia...</p>
                  </div>
                )}
             </div>
          </div>
       </div>
     </div>
    </div>
  );
}
