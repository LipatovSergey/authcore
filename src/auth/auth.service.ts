import {
  Inject,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import type { LoginInput, LoginOutput } from './interfaces/login.contract';
import {
  SECURE_HASHER,
  type SecureHasher,
} from './interfaces/secure-hasher.interface';
import { RefreshInput, RefreshOutput } from './interfaces/refresh.contract';
import type {
  RegisterInput,
  RegisterOutput,
} from './interfaces/register.contract';
import type { RefreshTokenPayload } from './interfaces/token-payloads.interface';
import { TokenService } from './providers/token.service';
import { CreateRefreshTokenInput } from './interfaces/refresh-tokens.contract';
import { RefreshTokenService } from './providers/refresh-tokens.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @Inject(SECURE_HASHER)
    private readonly secureHasher: SecureHasher,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  private dummyHash = '';

  async onModuleInit() {
    this.dummyHash = await this.secureHasher.hash(
      'authcore_dummy_password_for_timing_equalization_v1',
    );
  }

  async register(input: RegisterInput): Promise<RegisterOutput> {
    const passwordHash = await this.secureHasher.hash(input.password);

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
      await this.secureHasher.verify(this.dummyHash, input.password);
      throw new UnauthorizedException('Invalid credentials');
    }

    const check = await this.secureHasher.verify(
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

    const refreshTokenHash = await this.secureHasher.hash(refresh.token);
    const createRefreshTokenInput: CreateRefreshTokenInput = {
      tokenHash: refreshTokenHash,
      jti: refresh.jti,
      userId: user.id,
      expiresAt: refresh.expiresAt,
    };

    await this.refreshTokenService.create(createRefreshTokenInput);

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

    const dbToken = await this.refreshTokenService.findByJti(tokenPayload.jti);
    if (
      !dbToken ||
      Date.now() >= dbToken.expiresAt.getTime() ||
      dbToken.revokedAt !== null
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await this.secureHasher.verify(
      dbToken.tokenHash,
      input.refresh_token,
    );
    if (!isValid) {
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

    await this.refreshTokenService.revoke(dbToken.id);
    const refreshTokenHash = await this.secureHasher.hash(refresh.token);
    const createRefreshTokenInput: CreateRefreshTokenInput = {
      tokenHash: refreshTokenHash,
      jti: refresh.jti,
      userId: user.id,
      expiresAt: refresh.expiresAt,
    };

    await this.refreshTokenService.create(createRefreshTokenInput);

    return {
      access_token: access,
      refresh_token: refresh.token,
    };
  }
}
