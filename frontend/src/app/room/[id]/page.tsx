'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useSocket } from '@/lib/useSocket';
import { Chessboard as XiangqiBoard } from 'react-xiangqiboard';
import { User, ShieldAlert, Trophy, CheckCircle, XCircle, Play, UserX, Eye, ArrowUpCircle } from 'lucide-react';
import Header from '@/components/Header';
import { toast } from 'react-toastify';

interface RoomState {
  roomId: string;
  fen: string;
  status: string;
  gameType: string;
  xiangqiTurn: 'w' | 'b';
  hostId: string | null;
  opponentId: string | null;
  hostTime: number;
  opponentTime: number;
  lastMoveTimestamp: number;
  readyPlayers: string[];
  spectators: string[];
}

export default function RoomPage({ params }: { params: { id: string } }) {
  const roomId = params.id;
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const router = useRouter();

  const AnyXiangqiBoard = XiangqiBoard as any;

  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [roomStatus, setRoomStatus] = useState('waiting');
  const [xiangqiFen, setXiangqiFen] = useState<any>('start');
  const [xiangqiTurn, setXiangqiTurn] = useState<'w' | 'b'>('w');
  const xiangqiPosRef = useRef<any>({});
  const [winnerMessage, setWinnerMessage] = useState('');

  const [hostId, setHostId] = useState<string | null>(null);
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
  const [spectators, setSpectators] = useState<string[]>([]);
  const [isSpectator, setIsSpectator] = useState(false);

  const [hostTime, setHostTime] = useState(1200);
  const [opponentTime, setOpponentTime] = useState(1200);
  const [lastMoveTimestamp, setLastMoveTimestamp] = useState<number | null>(null);

  // Client-side visual timer countdown
  useEffect(() => {
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

  // Determine if current user is a spectator
  useEffect(() => {
    if (!user) return;
    setIsSpectator(hostId !== user.id && opponentId !== user.id);
  }, [hostId, opponentId, user]);

  // Determine board orientation
  useEffect(() => {
    if (!user) return;
    if (opponentId === user.id) {
      setBoardOrientation('black');
    } else {
      setBoardOrientation('white');
    }
  }, [hostId, opponentId, user]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (socket) {
      socket.emit('join_room', { roomId });

      const handleRoomState = (data: RoomState) => {
        useAuthStore.getState().checkAuth(); // Sync wallet
        setRoomStatus(data.status);
        setHostId(data.hostId);
        setOpponentId(data.opponentId);
        setReadyPlayers(data.readyPlayers || []);
        setSpectators(data.spectators || []);
        if (data.hostTime !== undefined) setHostTime(data.hostTime);
        if (data.opponentTime !== undefined) setOpponentTime(data.opponentTime);
        if (data.lastMoveTimestamp) setLastMoveTimestamp(data.lastMoveTimestamp);
        if (data.status === 'playing') setWinnerMessage('');

        try {
          if (data.fen === 'start') {
            setXiangqiFen('start');
          } else {
            setXiangqiFen(JSON.parse(data.fen));
          }
        } catch (e) {
          setXiangqiFen(data.fen);
        }

        if (data.xiangqiTurn) setXiangqiTurn(data.xiangqiTurn);
      };

      const handleMoveMade = (data: any) => {
        if (data.hostTime !== undefined) setHostTime(data.hostTime);
        if (data.opponentTime !== undefined) setOpponentTime(data.opponentTime);
        if (data.lastMoveTimestamp) setLastMoveTimestamp(data.lastMoveTimestamp);

        try {
          setXiangqiFen(data.fen?.startsWith('{') ? JSON.parse(data.fen) : data.fen);
        } catch (e) {}
        if (data.xiangqiTurn) setXiangqiTurn(data.xiangqiTurn);
      };

      const handleGameEnd = (data: any) => {
        useAuthStore.getState().checkAuth();
        setRoomStatus('finished');
        if (data.winnerId === user.id) {
          setWinnerMessage('🏆 CHIẾN THẮNG!');
          toast.success('🏆 Chúc mừng! Bạn đã chiến thắng!');
        } else if (data.winnerId) {
          setWinnerMessage('❌ THẤT BẠI.');
          toast.error('Bạn đã thua trận đấu này.');
        } else {
          setWinnerMessage('🤝 HÒA KỲ!');
          toast.info('Trận đấu hòa.');
        }
      };

      const handleKicked = (data: { roomId: string; userId: string; reason: string }) => {
        if (data.userId === user.id) {
          toast.warning(data.reason || 'Bạn đã bị kick khỏi phòng!');
          router.push('/');
        }
      };

      const handleError = (err: { message: string }) => {
        toast.error(err.message || 'Có lỗi xảy ra!');
        if (err.message === 'Room not found') {
          router.push('/');
        }
      };

      socket.on('room_state_update', handleRoomState);
      socket.on('move_made', handleMoveMade);
      socket.on('game_end', handleGameEnd);
      socket.on('kicked', handleKicked);
      socket.on('error', handleError);

      return () => {
        socket.emit('leave_room', { roomId });
        socket.off('room_state_update', handleRoomState);
        socket.off('move_made', handleMoveMade);
        socket.off('game_end', handleGameEnd);
        socket.off('kicked', handleKicked);
        socket.off('error', handleError);
      };
    }
  }, [socket, roomId, user?.id, router]);

  const isHost = hostId === user?.id;
  const isOpponent = opponentId === user?.id;
  const isPlayer = isHost || isOpponent;
  const isReady = user ? readyPlayers.includes(user.id) : false;
  const bothReady = hostId && opponentId && readyPlayers.includes(hostId) && readyPlayers.includes(opponentId);
  const hasEmptySlot = !hostId || !opponentId;

  const isPlayerTurn = () => {
    return (xiangqiTurn === 'w' && boardOrientation === 'white') ||
           (xiangqiTurn === 'b' && boardOrientation === 'black');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- Actions ---
  const handleReady = () => {
    socket?.emit('player_ready', { roomId });
  };

  const handleUnready = () => {
    socket?.emit('player_unready', { roomId });
  };

  const handleStartGame = () => {
    socket?.emit('start_game', { roomId });
  };

  const handleKickOpponent = () => {
    if (opponentId) {
      socket?.emit('kick_player', { roomId, targetUserId: opponentId });
      toast.info('Đã kick đối thủ khỏi phòng.');
    }
  };

  const handlePlayAgain = () => {
    socket?.emit('play_again', { roomId });
  };

  const handleJoinAsPlayer = () => {
    socket?.emit('join_as_player', { roomId });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-gradient-to-b from-amber-900/5 to-background pointer-events-none"></div>

      <Header />

      <div className="w-full flex flex-col items-center py-6 px-4 flex-grow relative z-10">
        <div className="w-full max-w-7xl flex justify-between items-center mb-8">
          <button onClick={() => router.push('/')} className="bg-white/5 border border-white/10 px-5 py-2.5 rounded-full text-white hover:bg-white/10 transition-all font-semibold flex items-center gap-2">
            <span>←</span> Thoát khỏi Phòng
          </button>
          <div className="flex items-center gap-3">
            {isSpectator && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-bold">
                <Eye className="w-4 h-4" />
                Đang xem
              </div>
            )}
            <div className="px-5 py-2 rounded-full glass border border-amber-500/30 text-amber-400 font-mono tracking-widest text-sm font-bold shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              MÃ PHÒNG: {roomId.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-10 items-center lg:items-start relative z-10">

          {/* Chess Board Container */}
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
                  ) : opponentId ? 'Đã vào phòng' : 'Chưa có đối thủ'}
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
                    if (isSpectator) return false;

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

                    if (socket) {
                      socket.emit('make_move', {
                        roomId,
                        fen: JSON.stringify(newPos),
                        xiangqiTurn: nextTurn,
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

          {/* Sidebar */}
          <div className="flex-1 w-full space-y-6">
            <div className="glass p-8 rounded-3xl border border-white/10 shadow-2xl">
              <div className="flex items-center gap-3 mb-8">
                <Trophy className="w-10 h-10 text-amber-500" />
                <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white">Trạng Thái Bàn</h2>
              </div>

              <div className="space-y-6 bg-black/40 p-6 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <span className="text-white/60 font-medium uppercase tracking-wider text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Diễn biến</span>
                  <span className={`px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-wider shadow-lg ${roomStatus === 'playing' ? 'bg-amber-500 text-black animate-pulse' : roomStatus === 'finished' ? 'bg-red-500/80 text-white' : 'bg-white/20 text-white'}`}>
                    {roomStatus === 'waiting' ? 'Đang Chờ' : roomStatus === 'playing' ? 'Đang Giao Tranh' : 'Đã Kết Thúc'}
                  </span>
                </div>

                {/* Players & Ready Status */}
                <div className="space-y-3">
                  {/* Host */}
                  <div className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-500/30">
                        <span className="text-red-400 font-bold text-xs">Đỏ</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{hostId ? (hostId === user.id ? 'BẠN (Chủ phòng)' : 'Đối thủ (Chủ phòng)') : 'Trống'}</p>
                      </div>
                    </div>
                    {hostId && roomStatus === 'waiting' && (
                      <span className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${readyPlayers.includes(hostId) ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                        {readyPlayers.includes(hostId) ? <><CheckCircle className="w-3 h-3" /> Sẵn sàng</> : <><XCircle className="w-3 h-3" /> Chưa sẵn sàng</>}
                      </span>
                    )}
                  </div>

                  {/* Opponent */}
                  <div className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-500/20 rounded-lg flex items-center justify-center border border-gray-500/30">
                        <span className="text-gray-400 font-bold text-xs">Đen</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{opponentId ? (opponentId === user.id ? 'BẠN' : 'Đối thủ') : 'Chờ người chơi...'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {opponentId && roomStatus === 'waiting' && (
                        <span className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${readyPlayers.includes(opponentId) ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                          {readyPlayers.includes(opponentId) ? <><CheckCircle className="w-3 h-3" /> Sẵn sàng</> : <><XCircle className="w-3 h-3" /> Chưa sẵn sàng</>}
                        </span>
                      )}
                      {/* Kick button for host */}
                      {isHost && opponentId && roomStatus === 'waiting' && (
                        <button
                          onClick={handleKickOpponent}
                          className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/30"
                          title="Kick đối thủ"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Turn indicator during game */}
                {roomStatus === 'playing' && (
                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <span className="text-white/60 font-medium uppercase tracking-wider text-sm">Đến Lượt</span>
                    <span className={`font-black text-xl bg-clip-text text-transparent ${xiangqiTurn === 'w' ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-gray-400 to-gray-600'}`}>
                      {xiangqiTurn === 'w' ? 'Người Chơi Đỏ' : 'Người Chơi Đen'}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {roomStatus === 'waiting' && isPlayer && (
                <div className="mt-6 space-y-3">
                  {/* Ready/Unready */}
                  {!isReady ? (
                    <button
                      onClick={handleReady}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:brightness-110 transition-all shadow-[0_10px_30px_rgba(34,197,94,0.3)]"
                    >
                      <CheckCircle className="w-6 h-6" />
                      SẴN SÀNG
                    </button>
                  ) : (
                    <button
                      onClick={handleUnready}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-lg bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500/50 hover:bg-yellow-500/30 transition-all"
                    >
                      <XCircle className="w-6 h-6" />
                      HỦY SẴN SÀNG
                    </button>
                  )}

                  {/* Start Game (Host Only) */}
                  {isHost && (
                    <button
                      onClick={handleStartGame}
                      disabled={!bothReady}
                      className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-lg transition-all ${
                        bothReady
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110 shadow-[0_10px_30px_rgba(245,158,11,0.4)] animate-pulse'
                          : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-6 h-6" />
                      {bothReady ? 'BẮT ĐẦU TRẬN ĐẤU' : 'CHỜ CẢ HAI SẴN SÀNG...'}
                    </button>
                  )}
                </div>
              )}

              {/* Spectator: Join as Player button */}
              {isSpectator && hasEmptySlot && roomStatus !== 'playing' && (
                <div className="mt-6">
                  <button
                    onClick={handleJoinAsPlayer}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:brightness-110 transition-all shadow-[0_10px_30px_rgba(59,130,246,0.3)]"
                  >
                    <ArrowUpCircle className="w-6 h-6" />
                    THAM GIA TRẬN ĐẤU
                  </button>
                </div>
              )}

              {/* Winner Message */}
              {winnerMessage && (
                <div className="mt-8 p-6 bg-gradient-to-r from-amber-600 to-orange-600 border border-amber-400 rounded-2xl text-center font-black text-xl text-black shadow-[0_0_40px_rgba(245,158,11,0.6)]">
                  <Trophy className="w-12 h-12 mx-auto mb-2 text-white" />
                  {winnerMessage}
                  <div className="flex justify-center gap-4 mt-6">
                    {isPlayer && (
                      <button
                        onClick={handlePlayAgain}
                        className="bg-white text-orange-600 px-6 py-2 rounded-full font-bold hover:bg-orange-100 transition-all shadow-lg text-sm"
                      >
                        Tiếp Tục Chơi
                      </button>
                    )}
                    <button
                      onClick={() => router.push('/')}
                      className="bg-black/20 border border-black/30 text-white px-6 py-2 rounded-full font-bold hover:bg-black/40 transition-all shadow-lg text-sm"
                    >
                      Rời Bàn
                    </button>
                  </div>
                </div>
              )}

              {/* Waiting for opponent */}
              {roomStatus === 'waiting' && !opponentId && (
                <div className="mt-8 p-6 glass border border-blue-400/30 text-blue-200 rounded-2xl text-center text-lg font-semibold animate-pulse shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                  <div className="loader inline-block border-2 border-t-2 border-blue-400 rounded-full w-6 h-6 mb-3 border-t-transparent animate-spin"></div>
                  <p>Đang tìm kiếm đối thủ tham gia...</p>
                </div>
              )}

              {/* Spectators count */}
              {spectators.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-white/40 text-sm">
                  <Eye className="w-4 h-4" />
                  {spectators.length} khán giả đang xem
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
