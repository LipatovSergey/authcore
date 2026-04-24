import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThan, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import type { CreateUserInput } from './interfaces/create-user.input';
import { isPostgresErrorLike } from './interfaces/utils/is-postgres-db-error.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  private readonly logger = new Logger(UsersService.name);

  async createUserWithManager(
    input: CreateUserInput,
    manager: EntityManager,
  ): Promise<User> {
    const repo = manager.getRepository(User);
    const user = repo.create({
      email: input.email,
      passwordHash: input.passwordHash,
      unverifiedExpiresAt: input.unverifiedExpiresAt,
    });

    try {
      return await repo.save(user);
    } catch (error) {
      if (
        isPostgresErrorLike(error) &&
        error.code === '23505' &&
        error.detail.includes('email')
      ) {
        this.logger.warn(
          `Registration failed because email already exists: email=${input.email}`,
        );
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async refreshUnverifiedExpiresAtWithManager(
    id: string,
    unverifiedExpiresAt: Date,
    manager: EntityManager,
  ): Promise<boolean> {
    const repo = manager.getRepository(User);
    const { affected } = await repo.update(
      { id, isEmailVerified: false },
      { unverifiedExpiresAt },
    );
    return affected === 1;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  async confirmEmailVerificationWithManager(
    id: string,
    now: Date,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(User);
    await repo.update(id, {
      isEmailVerified: true,
      emailVerifiedAt: now,
      unverifiedExpiresAt: null,
    });
  }

  async cleanupUnverifiedUsers(now: Date): Promise<number> {
    const { affected } = await this.repo.delete({
      isEmailVerified: false,
      unverifiedExpiresAt: LessThan(now),
    });
    if (affected === undefined || affected === null) {
      throw new Error(
        'Failed to determine how many unverified users were deleted',
      );
    }
    return affected;
  }
}
