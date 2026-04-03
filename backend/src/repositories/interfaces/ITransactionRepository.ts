export interface ITransactionRepository {
  create(data: {
    userId: string;
    type: string;   // 'deposit' | 'bet' | 'win' | 'refund'
    amount: number;
    status: string;  // 'completed' | 'failed'
  }): Promise<void>;
}
