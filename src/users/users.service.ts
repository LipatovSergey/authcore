import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import type { CreateUserInput } from './interfaces/create-user.input';
import { isPostgresErrorLike } from './interfaces/utils/is-postgres-db-error.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

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
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }
}
