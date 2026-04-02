import { PrismaClient } from '@prisma/client';
import { Chess } from 'chess.js';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('1. Fetching user...');
    // Just fetch any user
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found');
    console.log('User:', user.id);
    
    console.log('2. Creating room in DB...');
    const roomRecord = await prisma.room.create({
      data: {
        hostId: user.id,
        betAmount: 100000,
        status: 'waiting'
      }
    });
    console.log('Room:', roomRecord.id);
    
    console.log('3. new Chess()...');
    const chess = new Chess();
    console.log('Chess obj created.');
    console.log('SUCCESS');
  } catch (e) {
    console.error('ERROR:', e);
  }
}
main();
