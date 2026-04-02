# Chess Betting Platform – Full Technical Specification

## 1. Overview

Hệ thống website chơi cờ (cờ vua hoặc cờ tướng) có đặt cược tiền theo phòng (room-based betting). Người chơi có thể tạo phòng với số tiền cược, người khác tham gia, và có thể có người thứ 3 xem trận (spectator).

Hệ thống có 2 role chính:

* User (người chơi)
* Admin (quản trị hệ thống)

Không yêu cầu SEO, ưu tiên realtime, nhẹ, dễ scale.

---

## 2. Tech Stack

### Frontend

* Next.js (App Router)
* React + Zustand (state management)
* TailwindCSS + shadcn/ui
* Socket.IO client

### Backend

* Node.js + Fastify
* Socket.IO (real-time communication)
* Prisma ORM

### Database

* PostgreSQL

### Cache / Realtime Scale

* Redis (pub/sub + caching)

### Deployment

* Docker + Nginx
* VPS / Cloud (AWS / DigitalOcean)

---

## 3. System Architecture

### Components

* API Server (Fastify)
* Realtime Server (Socket.IO)
* Database (PostgreSQL)
* Cache Layer (Redis)

### Flow

1. User tạo room
2. User khác join room
3. Server lock tiền cược
4. Game diễn ra qua socket
5. Kết thúc → trả tiền

---

## 4. Roles & Permissions

### 4.1 User

Quyền:

* Đăng ký / đăng nhập
* Xem danh sách phòng
* Tạo phòng (set số tiền cược)
* Tham gia phòng
* Chơi cờ
* Xem trận (spectator)
* Nạp tiền
* Xem lịch sử giao dịch

Không có quyền:

* Quản lý hệ thống
* Sửa tài khoản ngân hàng

---

### 4.2 Admin

Quyền:

* Quản lý user
* Xem toàn bộ giao dịch
* Quản lý tài khoản ngân hàng nhận tiền nạp

CRUD Bank Accounts:

* Tạo tài khoản ngân hàng
* Sửa thông tin tài khoản
* Xóa tài khoản
* Bật/tắt hiển thị

Thông tin bank account:

* bank_name
* account_number
* account_holder
* qr_code (optional)
* status (active/inactive)

---

## 5. Core Features

### 5.1 Authentication

* JWT-based auth
* Access token + refresh token

---

### 5.2 Wallet System

#### Tables

users

* id
* email
* password
* balance

wallet_transactions

* id
* user_id
* type (deposit, bet, win, refund)
* amount
* status
* created_at

#### Logic

* Khi join room → trừ tiền (hold)
* Khi kết thúc:

  * winner → nhận tiền
  * loser → mất tiền

---

### 5.3 Deposit (Nạp tiền)

Flow:

1. User vào trang nạp tiền
2. Hiển thị danh sách bank account (admin config)
3. User chuyển khoản
4. User submit form:

   * số tiền
   * nội dung CK
   * ảnh (optional)
5. Admin duyệt
6. Cộng tiền vào balance

#### Tables

deposits

* id
* user_id
* amount
* bank_account_id
* transfer_note
* status (pending, approved, rejected)
* created_at

---

### 5.4 Game Room

#### Room structure

rooms

* id
* host_id
* opponent_id
* bet_amount
* status (waiting, playing, finished)
* winner_id

#### Logic

* Host tạo room
* Opponent join
* Khi đủ 2 người → start game

---

### 5.5 Realtime Gameplay

#### Socket Events

Client → Server

* create_room
* join_room
* make_move
* leave_room

Server → Client

* room_update
* game_state
* move_made
* game_end

#### Spectator

* join room với role spectator
* chỉ receive event

---

### 5.6 Game Engine

Option:

* chess.js (cờ vua)
* custom / xiangqi.js (cờ tướng)

Server validate toàn bộ move.

---

## 6. Anti-Cheat & Security

* Validate move server-side
* Không trust client
* Rate limit socket
* Prevent double-spend (DB transaction)
* Timeout AFK

---

## 7. Scaling Strategy

### Phase 1

* Single server
* Socket.IO

### Phase 2

* Multiple instances
* Redis adapter

### Phase 3

* Microservices:

  * Game service
  * Wallet service

---

## 8. Admin Dashboard

### Features

* Manage users
* Manage deposits
* Manage bank accounts
* View game history

---

## 9. API Design (Sample)

Auth:

* POST /auth/login
* POST /auth/register

Wallet:

* GET /wallet
* GET /transactions

Deposit:

* GET /bank-accounts
* POST /deposit

Admin:

* POST /admin/bank-accounts
* PUT /admin/bank-accounts/:id
* DELETE /admin/bank-accounts/:id

---

## 10. Deployment Notes

* Use Nginx reverse proxy
* Enable sticky session (if no Redis adapter)
* Use HTTPS

---

## 11. Future Enhancements

* Auto payment integration (Momo, ZaloPay)
* Ranking system
* Tournament mode
* Chat in room

---

## 12. Conclusion

Hệ thống được thiết kế tối giản nhưng đủ mạnh:

* Realtime gameplay
* Betting system
* Admin-controlled deposit

Phù hợp triển khai nhanh và scale dần.
