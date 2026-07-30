import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { EntityManager, IsNull, Not } from 'typeorm';
import { Session } from './session.entity';
import {
  CreateSessionInput,
  MarkSessionAsRefreshedInput,
  RevokeAllUserSessionsInput,
  RevokeOtherUserSessionsInput,
  RevokeSessionInput,
  ValidateActiveUserSessionInput,
} from '../types/sessions';

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
    input: ValidateActiveUserSessionInput,
    manager: EntityManager,
  ) {
    const { sessionId, userId } = input;
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

  async revoke(input: RevokeSessionInput, manager: EntityManager) {
    const { sessionId, revokedAt } = input;
    const repo = manager.getRepository(Session);
    const { affected } = await repo.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: revokedAt },
    );
    return affected ?? 0;
  }

  async revokeAllByUserId(
    input: RevokeAllUserSessionsInput,
    manager: EntityManager,
  ) {
    const { userId, revokedAt } = input;
    const repo = manager.getRepository(Session);
    const { affected } = await repo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: revokedAt },
    );
    return affected ?? 0;
  }

  async revokeAllByUserIdExceptSessionId(
    input: RevokeOtherUserSessionsInput,
    manager: EntityManager,
  ) {
    const { userId, currentSessionId, revokedAt } = input;
    const repo = manager.getRepository(Session);
    const { affected } = await repo.update(
      { userId, id: Not(currentSessionId), revokedAt: IsNull() },
      { revokedAt },
    );
    return affected ?? 0;
  }

  async markSessionAsRefreshed(
    input: MarkSessionAsRefreshedInput,
    manager: EntityManager,
  ) {
    const { sessionId, refreshedAt } = input;
    const repo = manager.getRepository(Session);
    const { affected } = await repo.update(sessionId, {
      lastRefreshedAt: refreshedAt,
    });
    if (affected === 0) {
      throw new Error('Failed to mark session as refreshed');
    }
  }
}
