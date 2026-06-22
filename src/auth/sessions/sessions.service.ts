import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { Session } from './session.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateSessionInput } from '../types/sessions';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session) private readonly repo: Repository<Session>,
  ) {}
  private readonly logger = new Logger(SessionsService.name);

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

  async validateActiveSessionOrThrow(
    sessionId: string,
    manager: EntityManager,
  ) {
    const repo = manager.getRepository(Session);
    const activeSession = await repo.findOneBy({
      id: sessionId,
      revokedAt: IsNull(),
    });
    if (activeSession === null) {
      this.logger.warn('Invalid or revoked session during refresh');
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
    return affected;
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
    return affected;
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
