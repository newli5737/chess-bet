import { Room } from '../domain/entities/Room.js';
import type { RoomListItem } from '../domain/types.js';

/**
 * RoomService — manages the in-memory room store.
 * Pure room state management, no money/DB logic.
 */
export class RoomService {
  private rooms = new Map<string, Room>();

  addRoom(room: Room): void {
    this.rooms.set(room.id, room);
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  getRoomList(): RoomListItem[] {
    return this.getAllRooms().map(r => r.toListItem());
  }

  /**
   * Initialize the 30 fixed tables.
   */
  initFixedTables(): void {
    const levels = [
      { prefix: 'basic', bet: 50000 },
      { prefix: 'medium', bet: 500000 },
      { prefix: 'premium', bet: 2000000 },
    ];

    for (const level of levels) {
      for (let i = 1; i <= 10; i++) {
        const id = `table-${level.prefix}-${i}`;
        this.addRoom(new Room(id, level.bet, true));
      }
    }
  }
}
