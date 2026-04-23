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

  async createUser(input: CreateUserInput): Promise<User> {
    const user = this.repo.create({
      email: input.email,
      passwordHash: input.passwordHash,
      unverifiedExpiresAt: input.unverifiedExpiresAt,
    });

    try {
      return await this.repo.save(user);
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

  async refreshUnverifiedExpiresAt(
    id: string,
    unverifiedExpiresAt: Date,
  ): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      await this.refreshUnverifiedExpiresAtWithManager(
        id,
        unverifiedExpiresAt,
        manager,
      );
    });
  }

  async refreshUnverifiedExpiresAtWithManager(
    id: string,
    unverifiedExpiresAt: Date,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(User);
    await repo.update({ id, isEmailVerified: false }, { unverifiedExpiresAt });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
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
