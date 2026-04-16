import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { EmailVerificationToken } from '../auth/entities/email-verification-token.entity';
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

  async refreshUnverifiedExpiresAt(id: string, unverifiedExpiresAt: Date) {
    const { affected } = await this.repo.update(id, { unverifiedExpiresAt });
    if (affected === 0) {
      throw new InternalServerErrorException(
        'Unexpected missing user during unverified expiry refresh',
      );
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  async cleanupUnverifiedUsers(cutoffDate: Date): Promise<number> {
    const cleanupCandidateRows: Array<{ id: string }> = await this.repo
      .createQueryBuilder('user')
      .where('user.isEmailVerified = :isEmailVerified', {
        isEmailVerified: false,
      })
      .leftJoin(
        EmailVerificationToken,
        'evt',
        'evt.userId = user.id AND evt.usedAt IS NULL AND evt.revokedAt IS NULL',
      )
      .andWhere('(evt.id IS NULL OR evt.createdAt < :cutoffDate)', {
        cutoffDate,
      })
      .select('user.id', 'id')
      .getRawMany();

    const cleanupCandidateIds = cleanupCandidateRows.map((item) => item.id);
    if (cleanupCandidateIds.length === 0) {
      return 0;
    }
    const { affected } = await this.repo.delete(cleanupCandidateIds);
    if (affected === undefined || affected === null) {
      throw new Error(
        'Failed to determine how many unverified users were deleted',
      );
    }
    return affected;
  }
}
