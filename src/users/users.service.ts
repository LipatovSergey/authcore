import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }
}
