export interface IRoomHistoryRepository {
  createRecord(data: {
    hostId: string;
    opponentId: string | null;
    betAmount: number;
    gameType: string;
    status: string;
    winnerId: string | null;
  }): Promise<void>;
}
