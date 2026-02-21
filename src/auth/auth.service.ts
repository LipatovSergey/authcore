import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import type { RegisterInput } from './interfaces/register.input';
import type { RegisterOutput } from './interfaces/register.output';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from './interfaces/password-hasher.interface';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly usersService: UsersService,
  ) {}

  async register(input: RegisterInput): Promise<RegisterOutput> {
    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = await this.usersService.createUser({
      email: input.email,
      passwordHash,
    });

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
