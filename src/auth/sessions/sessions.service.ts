import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { EntityManager, IsNull, Not } from 'typeorm';
import { Session } from './session.entity';
import { CreateSessionInput } from '../types/sessions';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  async findActiveByUserId(userId: string, manager: EntityManager) {
    const repo = manager.getRepository(Session);
    return repo.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async createSession(input: CreateSessionInput, manager: EntityManager) {
    const repo = manager.getRepository(Session);
    const { userId, ipAddress, userAgent } = input;
    const session = repo.create({
      userId,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });

    return repo.save(session);
  }

  async validateActiveUserSessionOrThrow(
    sessionId: string,
    userId: string,
    manager: EntityManager,
  ) {
    const repo = manager.getRepository(Session);
    const activeSession = await repo.findOneBy({
      id: sessionId,
      userId,
      revokedAt: IsNull(),
    });
    if (activeSession === null) {
      this.logger.warn('Invalid or revoked session');
      throw new UnauthorizedException('Invalid refresh token');
    }
    return activeSession;
  }

  async revoke(sessionId: string, revokedAt: Date, manager: EntityManager) {
    const repo = manager.getRepository(Session);
    const { affected } = await repo.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: revokedAt },
    );
    return affected ?? 0;
  }

  async revokeAllByUserId(
    userId: string,
    revokedAt: Date,
    manager: EntityManager,
  ) {
    const repo = manager.getRepository(Session);
    const { affected } = await repo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: revokedAt },
    );
    return affected ?? 0;
  }

  async revokeAllByUserIdExceptSessionId(
    userId: string,
    sessionId: string,
    revokedAt: Date,
    manager: EntityManager,
  ) {
    const repo = manager.getRepository(Session);
    const { affected } = await repo.update(
      { userId, id: Not(sessionId), revokedAt: IsNull() },
      { revokedAt },
    );
    return affected ?? 0;
  }

  async markSessionAsRefreshed(sessionId: string, manager: EntityManager) {
    const repo = manager.getRepository(Session);
    const { affected } = await repo.update(sessionId, {
      lastRefreshedAt: new Date(),
    });
    if (affected === 0) {
      throw new Error('Failed to mark session as refreshed');
    }
  }
}
