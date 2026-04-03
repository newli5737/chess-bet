-- Migration 001: Thêm CHECK constraint đảm bảo balance >= 0
-- Đây là lớp bảo vệ thứ 2 chống race condition âm tiền.
-- Lớp thứ 1: SELECT FOR UPDATE trong PayoutService.deductBets()

-- Chạy idempotent: kiểm tra constraint chưa tồn tại trước khi thêm
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'User_balance_non_negative'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_balance_non_negative"
      CHECK (balance >= 0);

    RAISE NOTICE 'Constraint User_balance_non_negative đã được thêm thành công.';
  ELSE
    RAISE NOTICE 'Constraint User_balance_non_negative đã tồn tại, bỏ qua.';
  END IF;
END
$$;
