import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Database Seed...');

  // Create or Update Admin User
  const adminPassword = await bcrypt.hash('test1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: { balance: 100000 },
    create: {
      email: 'admin@admin.com',
      password: adminPassword,
      role: 'admin',
      balance: 100000,
    },
  });
  console.log(`Admin user ready: ${admin.email}`);

  // Create Test Players
  const player1 = await prisma.user.upsert({
    where: { email: 'player1@test.com' },
    update: { balance: 50000000 },
    create: {
      email: 'player1@test.com',
      password: await bcrypt.hash('password', 10),
      role: 'user',
      balance: 50000000,
    },
  });
  console.log(`Test Player 1 ready: ${player1.email}`);

  const player2 = await prisma.user.upsert({
    where: { email: 'player2@test.com' },
    update: { balance: 50000000 },
    create: {
      email: 'player2@test.com',
      password: await bcrypt.hash('password', 10),
      role: 'user',
      balance: 50000000,
    },
  });
  console.log(`Test Player 2 ready: ${player2.email}`);

  // Ensure a Bank Account exists for testing deposits
  const existingBank = await prisma.bankAccount.findFirst();
  if (!existingBank) {
    const bankAccount = await prisma.bankAccount.create({
      data: {
        bankName: 'Vietcombank',
        accountNumber: '1012345678',
        accountHolder: 'CHESS BET ADMIN',
        status: 'active',
      },
    });
    console.log(`Admin Bank Account ready: ${bankAccount.bankName}`);
  }

  console.log('Database Seeding Completed Successfully! 🌱');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
