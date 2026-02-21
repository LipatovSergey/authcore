import {
  Inject,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import type {
  RegisterInput,
  RegisterOutput,
} from './interfaces/register.contract';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from './interfaces/password-hasher.interface';
import type { LoginInput } from './interfaces/login.contract';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly usersService: UsersService,
  ) {}

  private dummyHash = '';

  async onModuleInit() {
    this.dummyHash = await this.passwordHasher.hash(
      'authcore_dummy_password_for_timing_equalization_v1',
    );
  }

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

  async login(input: LoginInput) {
    const user = await this.usersService.findByEmail(input.email);
    if (!user) {
      await this.passwordHasher.verify(this.dummyHash, input.password);
      throw new UnauthorizedException('Invalid credentials');
    }

    const check = await this.passwordHasher.verify(
      user.passwordHash,
      input.password,
    );

    if (!check) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { message: 'ok' };
  }
}
