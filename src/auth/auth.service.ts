import {
  Inject,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import type { LoginInput, LoginOutput } from './interfaces/login.contract';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from './interfaces/password-hasher.interface';
import { RefreshInput, RefreshOutput } from './interfaces/refresh.contract';
import type {
  RegisterInput,
  RegisterOutput,
} from './interfaces/register.contract';
import type { RefreshTokenPayload } from './interfaces/token-payloads.interface';
import { TokenService } from './providers/token.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
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

  async login(input: LoginInput): Promise<LoginOutput> {
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

    const payload = { sub: user.id, email: user.email };
    const [access, refresh] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(user.id),
    ]);

    return {
      access_token: access,
      refresh_token: refresh.token,
    };
  }

  async refresh(input: RefreshInput): Promise<RefreshOutput> {
    let tokenPayload: RefreshTokenPayload;
    try {
      tokenPayload = await this.tokenService.verifyRefreshToken(
        input.refresh_token,
      );
    } catch (_error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(tokenPayload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload = { sub: user.id, email: user.email };
    const [access, refresh] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(user.id),
    ]);

    return {
      access_token: access,
      refresh_token: refresh.token,
    };
  }
}
