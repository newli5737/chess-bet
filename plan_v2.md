# Kế Hoạch Triển Khai: Multi-Game Hub & User Management Extension

Nâng cấp hệ thống để hỗ trợ Đa nền tảng Cờ (Cờ Vua & Cờ Tướng), hoàn thiện hệ thống Profile của người dùng (Đổi Avatar, Password) và tính năng Nạp Tiền tự động/yêu cầu.

## Vui lòng xem xét các thay đổi sau

> [!WARNING]
> Kế hoạch này sẽ thay đổi Database Schema và thêm các bộ thư viện logic cờ mới. Bạn vui lòng đọc kỹ các câu hỏi ở phần **Open Questions** trước khi cho phép mình triển khai.

## Các Thay Đổi (Proposed Changes)

---

### Database Layer

#### [MODIFY] `backend/prisma/schema.prisma`
- Cập nhật bảng `User`: Thêm trường `avatar String?` để lưu link ảnh đại diện.
- Cập nhật bảng `Room`: Thêm trường `gameType String @default("chess")` để phân tách phòng `chess` (Cờ Vua) và `xiangqi` (Cờ Tướng).

---

### Backend Components

#### [MODIFY] `backend/src/routes/auth.ts`
- Thêm API `PUT /api/auth/profile` để user tự đổi Avatar và Mật khẩu. Sẽ đảm bảo băm (hash) mật khẩu mới trước khi lưu.

#### [MODIFY] `backend/src/routes/wallet.ts`
- Xây dựng hoàn chỉnh API `POST /api/wallet/deposit` theo schema `Deposit`.

#### [MODIFY] `backend/src/sockets.ts`
- Nâng cấp sự kiện `create_room` để FE có thể gửi lên `gameType` (Cờ vua hay Cờ tướng).
- Khi tạo và parse ván cờ, tuỳ thuộc vào `gameType` sẽ khởi tạo instance của `chess.js` hoặc thư viện `xiang.js`.
- Bổ sung validation nước đi hợp lệ (`move_made`) cho 2 loại luật cờ khác nhau.

---

### Frontend Components

#### [MODIFY] Cài đặt Packages
- Thêm `react-xiangqiboard` và `xiang.js` để làm giao diện & engine xử lý luật Cờ Tướng.

#### [MODIFY] Trang Sảnh (Lobby) - `frontend/src/app/page.tsx`
- Thêm Modal hiển thị **Hồ sơ cá nhân** (thay đổi Avatar, thay password).
- Thêm Modal **Nạp Tiền** để gọi API Deposit.
- Nút "Mở Phòng Chơi" sẽ hiển thị thêm tuỳ chọn dropdown: Tạo menu chọn Cờ Vua hay Cờ Tướng.
- Thay đổi Bảng danh sách "Đấu Trường Đang Mở" với các Icon/Badge đặc trưng để phân biệt phòng nào đang chơi Cờ Vua, phòng nào Cờ Tướng.

#### [MODIFY] Giao diện Bàn Cờ - `frontend/src/app/room/[id]/page.tsx`
- Viết lại logic Render để có thể chuyển đổi linh hoạt phụ thuộc dữ liệu Backend trả về:
  - Nếu `gameType === 'chess'` -> Hiển thị `<Chessboard />` (Đã có sẵn).
  - Nếu `gameType === 'xiangqi'` -> Hiển thị `<XiangqiBoard />` (Cờ Tướng).


---

## Các Câu Hỏi Lựa Chọn (Open Questions)

> [!IMPORTANT]
> 1. **Lưu trữ Avatar**: Hiện tại mình thiết kế cho phép User nhập một đường dẫn Ảnh (Image URL) bất kỳ làm Avatar để nhanh gọn, không lo setup Storage Server. Bạn có đồng ý với cách này không, hay muốn người dùng bắt buộc phải Tải lên (Upload) file?
> 2. **Duyệt nạp tiền**: Tính năng Nạp tiền (Deposit) tạm thời sẽ tự động cộng tiền ngay lập tức lúc gọi API để anh em dễ test và chơi thả ga. Hay bạn muốn tạo ra trạng thái "Pending" và cần giao diện Admin duyệt tay?
> 3. Mình sẽ xử lý Cờ Tướng bằng thư viện `react-xiangqiboard` và engine `xiang.js` vì kiến trúc của nó clone y hệt `react-chessboard` mà mình đang dùng. Điều này sẽ giúp mình tận dụng lại tới 90% code quản lý bàn cờ ở Frontend. Bạn đồng ý triển khai luôn nhé?

Nếu bạn OKE với toàn bộ ý tưởng, hoặc có câu trả lời cho các câu hỏi trên thì nhắn mình một dòng để mình bung sức làm luôn nhé!
