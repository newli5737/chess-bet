import type { UserDTO } from '../../domain/types.js';

export interface IUserRepository {
  findById(id: string): Promise<UserDTO | null>;
  findByEmail(email: string): Promise<UserDTO | null>;
  create(data: { email: string; password: string; role: string; sessionId: string }): Promise<UserDTO>;
  updateSessionId(id: string, sessionId: string): Promise<UserDTO>;
  updatePassword(id: string, hashedPassword: string, newSessionId: string): Promise<void>;
  updateAvatar(id: string, avatarUrl: string): Promise<void>;
  updateBalance(id: string, delta: number): Promise<void>;
  getBalance(id: string): Promise<{ balance: number } | null>;
}
