/**
 * migrate.ts — Chạy các SQL migration thủ công.
 * Dùng cho dự án đang sử dụng `prisma db push` (không dùng prisma migrate).
 *
 * Cách dùng:
 *   npx tsx prisma/migrate.ts
 */
import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Thiếu DATABASE_URL trong .env');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

async function runMigrations() {
  await client.connect();
  console.log('✅ Đã kết nối PostgreSQL');

  // Tạo bảng theo dõi migrations nếu chưa có
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_manual_migrations" (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Đảm bảo chạy đúng thứ tự 001, 002, ...

  for (const file of files) {
    // Kiểm tra migration này đã chạy chưa
    const { rows } = await client.query(
      `SELECT 1 FROM "_manual_migrations" WHERE name = $1`,
      [file],
    );

    if (rows.length > 0) {
      console.log(`⏭️  ${file} — đã chạy trước đó, bỏ qua.`);
      continue;
    }

    console.log(`🚀 Đang chạy: ${file}`);
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO "_manual_migrations" (name) VALUES ($1)`,
        [file],
      );
      console.log(`✅ ${file} — OK`);
    } catch (err) {
      console.error(`❌ ${file} — THẤT BẠI:`, err);
      process.exit(1);
    }
  }

  await client.end();
  console.log('\n🎉 Tất cả migrations đã hoàn thành.');
}

runMigrations().catch(err => {
  console.error('❌ Lỗi không xác định:', err);
  process.exit(1);
});
