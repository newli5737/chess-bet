'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { AdminService } from '@/services/api.service';
import { toast } from 'react-toastify';

// ─── Types ──────────────────────────────────────────────────
type Tab = 'deposits' | 'withdrawals' | 'rooms' | 'users';

interface RoomState   { roomId: string; status: string; hostId: string | null; opponentId: string | null; hostTime: number; opponentTime: number; }
interface User        { id: string; email: string; balance: number; role: string; }
interface Deposit     { id: string; amount: number; status: string; createdAt: string; transferNote: string; user: { email: string }; bankAccount: { bankName: string; accountNumber: string; accountHolder: string }; }
interface Withdrawal  { id: string; amount: number; status: string; createdAt: string; bankName: string; accountNumber: string; accountHolder: string; note: string; user: { email: string }; }

// ─── Helpers ────────────────────────────────────────────────
const fmt     = (n: number) => n.toLocaleString('vi-VN') + '₫';
const fmtDate = (d: string) => new Date(d).toLocaleString('vi-VN');
const statusColor: Record<string, string> = {
  pending:  'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  approved: 'text-green-400  bg-green-400/10  border-green-400/20',
  rejected: 'text-red-400    bg-red-400/10    border-red-400/20',
  waiting:  'text-blue-400   bg-blue-400/10   border-blue-400/20',
  playing:  'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  finished: 'text-gray-400   bg-gray-400/10   border-gray-400/20',
};

function Badge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor[status] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/20'}`}>
      {status}
    </span>
  );
}

function ActionBtn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${
        danger
          ? 'bg-red-500/15 text-red-300 hover:bg-red-500/30 border border-red-500/30'
          : 'bg-green-500/15 text-green-300 hover:bg-green-500/30 border border-green-500/30'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Sidebar nav items ───────────────────────────────────────
const NAV: { key: Tab; icon: string; label: string }[] = [
  { key: 'deposits',    icon: '💰', label: 'Nạp tiền'   },
  { key: 'withdrawals', icon: '🏧', label: 'Rút tiền'   },
  { key: 'rooms',       icon: '🎮', label: 'Rooms Live' },
  { key: 'users',       icon: '👥', label: 'Users'      },
];

// ─── Main ────────────────────────────────────────────────────
export default function AdminPage() {
  const router    = useRouter();
  const { user }  = useAuthStore();
  const [tab, setTab]                 = useState<Tab>('deposits');
  const [collapsed, setCollapsed]     = useState(false);
  const [rooms, setRooms]             = useState<RoomState[]>([]);
  const [users, setUsers]             = useState<User[]>([]);
  const [deposits, setDeposits]       = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading]         = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/');
  }, [user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'rooms')       setRooms(await AdminService.getRooms());
      if (tab === 'users')       setUsers(await AdminService.getUsers());
      if (tab === 'deposits')    setDeposits(await AdminService.getDeposits());
      if (tab === 'withdrawals') setWithdrawals(await AdminService.getWithdrawals());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => {
    load();
    if (tab === 'rooms') pollRef.current = setInterval(load, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load, tab]);

  const handle = async (action: () => Promise<any>, msg: string) => {
    try { await action(); toast.success(msg); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Thao tác thất bại'); }
  };

  if (!user || user.role !== 'admin') return null;

  const pendingDeposits    = deposits.filter(d => d.status === 'pending').length;
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;

  const badge = (n: number) => n > 0
    ? <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{n}</span>
    : null;

  return (
    <div className="flex h-screen bg-[hsl(240,10%,3.9%)] text-white overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={`flex-shrink-0 flex flex-col border-r border-white/8 bg-black/30 backdrop-blur-xl transition-all duration-300 ease-in-out ${
          collapsed ? 'w-[60px]' : 'w-[220px]'
        }`}
      >
        {/* Logo + toggle */}
        <div className={`flex items-center h-16 px-3 border-b border-white/8 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <span className="font-black text-sm bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent whitespace-nowrap overflow-hidden">
              ⚙️ Admin
            </span>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all flex-shrink-0"
            title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 p-2 flex-grow">
          {NAV.map(({ key, icon, label }) => {
            const count = key === 'deposits' ? pendingDeposits : key === 'withdrawals' ? pendingWithdrawals : 0;
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all group relative ${
                  active
                    ? 'bg-yellow-400/15 text-yellow-300 border border-yellow-400/25'
                    : 'text-gray-400 hover:bg-white/8 hover:text-white border border-transparent'
                }`}
              >
                <span className="text-base flex-shrink-0">{icon}</span>
                {!collapsed && (
                  <>
                    <span className="truncate">{label}</span>
                    {badge(count)}
                  </>
                )}
                {/* Badge khi thu gọn */}
                {collapsed && count > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`p-3 border-t border-white/8 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <button onClick={() => router.push('/')} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition-all" title="Về trang chủ">
              🏠
            </button>
          ) : (
            <button onClick={() => router.push('/')} className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-all px-2 py-1.5 rounded-lg hover:bg-white/8 w-full">
              🏠 <span>Về trang chủ</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/8 bg-black/20 flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold text-white">
              {NAV.find(n => n.key === tab)?.icon} {NAV.find(n => n.key === tab)?.label}
            </h1>
            {tab === 'rooms' && <p className="text-xs text-gray-500">🔴 Live — tự động refresh mỗi 5 giây</p>}
          </div>
          <button
            onClick={load}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
            Refresh
          </button>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-auto p-6">

          {/* ── Deposits ── */}
          {tab === 'deposits' && (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-gray-400 text-left text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Số tiền</th>
                    <th className="px-4 py-3">Ngân hàng</th>
                    <th className="px-4 py-3">Nội dung</th>
                    <th className="px-4 py-3">Ngày</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d, i) => (
                    <tr key={d.id} className={`border-t border-white/5 hover:bg-white/5 transition-colors ${i % 2 ? 'bg-white/[0.02]' : ''}`}>
                      <td className="px-4 py-3 text-blue-300 font-medium">{d.user.email}</td>
                      <td className="px-4 py-3 font-bold text-green-400">{fmt(d.amount)}</td>
                      <td className="px-4 py-3 text-gray-300">
                        <div className="font-medium">{d.bankAccount.bankName}</div>
                        <div className="text-xs text-gray-500">{d.bankAccount.accountNumber} · {d.bankAccount.accountHolder}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-[150px] truncate">{d.transferNote || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(d.createdAt)}</td>
                      <td className="px-4 py-3"><Badge status={d.status} /></td>
                      <td className="px-4 py-3">
                        {d.status === 'pending' && (
                          <div className="flex gap-2">
                            <ActionBtn label="✓ Duyệt"    onClick={() => handle(() => AdminService.approveDeposit(d.id),  'Đã duyệt nạp tiền')} />
                            <ActionBtn label="✗ Từ chối" onClick={() => handle(() => AdminService.rejectDeposit(d.id),   'Đã từ chối')} danger />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {deposits.length === 0 && <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-600">Không có dữ liệu</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Withdrawals ── */}
          {tab === 'withdrawals' && (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-gray-400 text-left text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Số tiền</th>
                    <th className="px-4 py-3">Ngân hàng</th>
                    <th className="px-4 py-3">Ghi chú</th>
                    <th className="px-4 py-3">Ngày</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w, i) => (
                    <tr key={w.id} className={`border-t border-white/5 hover:bg-white/5 transition-colors ${i % 2 ? 'bg-white/[0.02]' : ''}`}>
                      <td className="px-4 py-3 text-blue-300 font-medium">{w.user.email}</td>
                      <td className="px-4 py-3 font-bold text-orange-400">{fmt(w.amount)}</td>
                      <td className="px-4 py-3 text-gray-300">
                        <div className="font-medium">{w.bankName}</div>
                        <div className="text-xs text-gray-500">{w.accountNumber} · {w.accountHolder}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-[140px] truncate">{w.note || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(w.createdAt)}</td>
                      <td className="px-4 py-3"><Badge status={w.status} /></td>
                      <td className="px-4 py-3">
                        {w.status === 'pending' && (
                          <div className="flex gap-2">
                            <ActionBtn label="✓ Đã chuyển" onClick={() => handle(() => AdminService.approveWithdrawal(w.id), 'Đã xác nhận chuyển tiền')} />
                            <ActionBtn label="✗ Hoàn tiền" onClick={() => handle(() => AdminService.rejectWithdrawal(w.id), 'Đã hoàn tiền cho user')} danger />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-600">Không có dữ liệu</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Rooms Live ── */}
          {tab === 'rooms' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {rooms.map(r => (
                <div key={r.roomId} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.08] transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[11px] font-mono text-gray-500 truncate max-w-[130px]">{r.roomId}</span>
                    <Badge status={r.status} />
                  </div>
                  <div className="space-y-1 text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                      <span>🔴</span>
                      <span className="font-mono text-[10px] text-white/70">{r.hostId?.slice(0, 10) ?? '—'}…</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>⚫</span>
                      <span className="font-mono text-[10px] text-white/70">{r.opponentId?.slice(0, 10) ?? '—'}…</span>
                    </div>
                    {r.status === 'playing' && (
                      <div className="flex gap-4 mt-2 pt-2 border-t border-white/10 text-xs font-mono">
                        <span className="text-red-400">🔴 {Math.floor(r.hostTime / 60)}:{String(r.hostTime % 60).padStart(2, '0')}</span>
                        <span className="text-gray-400">⚫ {Math.floor(r.opponentTime / 60)}:{String(r.opponentTime % 60).padStart(2, '0')}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {rooms.length === 0 && (
                <div className="col-span-full py-20 text-center text-gray-600">
                  <div className="text-5xl mb-3">🎮</div>
                  <div>Không có room nào đang hoạt động</div>
                </div>
              )}
            </div>
          )}

          {/* ── Users ── */}
          {tab === 'users' && (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-gray-400 text-left text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Số dư</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 font-mono">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} className={`border-t border-white/5 hover:bg-white/5 transition-colors ${i % 2 ? 'bg-white/[0.02]' : ''}`}>
                      <td className="px-4 py-3 text-blue-300 font-medium">{u.email}</td>
                      <td className={`px-4 py-3 font-bold ${u.balance > 0 ? 'text-green-400' : 'text-gray-500'}`}>{fmt(u.balance)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-white/8 text-gray-400 border-white/10'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{u.id}</td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan={4} className="px-4 py-16 text-center text-gray-600">Không có dữ liệu</td></tr>}
                </tbody>
              </table>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
