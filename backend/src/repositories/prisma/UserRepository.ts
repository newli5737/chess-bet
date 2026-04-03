import type { PrismaClient } from '@prisma/client';
import type { IUserRepository } from '../interfaces/IUserRepository.js';
import type { UserDTO } from '../../domain/types.js';

export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<UserDTO | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserDTO | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: { email: string; password: string; role: string; sessionId: string }): Promise<UserDTO> {
    return this.prisma.user.create({ data });
  }

  async updateSessionId(id: string, sessionId: string): Promise<UserDTO> {
    return this.prisma.user.update({ where: { id }, data: { sessionId } });
  }

  async updatePassword(id: string, hashedPassword: string, newSessionId: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { password: hashedPassword, sessionId: newSessionId } });
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { avatar: avatarUrl } });
  }

  async updateBalance(id: string, delta: number): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { balance: { increment: delta } } });
  }

  async getBalance(id: string): Promise<{ balance: number } | null> {
    return this.prisma.user.findUnique({ where: { id }, select: { balance: true } });
  }
}
