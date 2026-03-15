import {
  Inject,
  Injectable,
  Logger,
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
import type { CreateRefreshTokenInput } from './interfaces/refresh-tokens.contract';
import { RefreshTokenService } from './providers/refresh-tokens.service';
import { RefreshToken } from './entities/refresh-token.entity';
import type { LogoutInput, LogoutOutput } from './interfaces/logout.contract';
import {
  LogoutAllInput,
  LogoutAllOutput,
} from './interfaces/logout-all.contract';
import { GetProfileOutput } from './interfaces/get-profile.contract';

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
  private readonly logger = new Logger(AuthService.name);

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

    this.logger.log(`User registered: email=${user.email} userId=${user.id}`);
    return {
      id: user.id,
      email: user.email,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }

  async login(input: LoginInput): Promise<LoginOutput> {
    const user = await this.usersService.findByEmail(input.email);
    if (!user) {
      this.logger.warn(
        `Failed login attempt because user not found: email=${input.email}`,
      );
      await this.secureHasher.verify(this.dummyHash, input.password);
      throw new UnauthorizedException('Invalid credentials');
    }

    const check = await this.secureHasher.verify(
      user.passwordHash,
      input.password,
    );

    if (!check) {
      this.logger.warn(
        `Failed login attempt because password mismatch: email=${input.email}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const [access, refresh] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload.sub),
    ]);

    const refreshTokenHash = await this.secureHasher.hash(refresh.token);
    const createRefreshTokenInput: CreateRefreshTokenInput = {
      tokenHash: refreshTokenHash,
      jti: refresh.jti,
      userId: payload.sub,
      expiresAt: refresh.expiresAt,
    };

    await this.refreshTokenService.create(createRefreshTokenInput);

    this.logger.log(`User logged in: email=${user.email} userId=${user.id}`);
    return {
      access_token: access,
      refresh_token: refresh.token,
    };
  }

  async refresh(input: RefreshInput): Promise<RefreshOutput> {
    const tokenPayload: RefreshTokenPayload =
      await this.verifyRefreshPayloadOrThrow(input.refresh_token);

    const dbToken = await this.validateRefreshTokenOrThrow(
      tokenPayload.jti,
      input.refresh_token,
    );

    const user = await this.usersService.findById(dbToken.userId);
    if (!user) {
      this.logger.warn(
        `Failed to refresh token because owner does not exist: userId=${dbToken.userId}`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload = { sub: user.id, email: user.email };
    const [access, refresh] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload.sub),
    ]);

    const refreshTokenHash = await this.secureHasher.hash(refresh.token);
    const createRefreshTokenInput: CreateRefreshTokenInput = {
      tokenHash: refreshTokenHash,
      jti: refresh.jti,
      userId: payload.sub,
      expiresAt: refresh.expiresAt,
    };

    await this.refreshTokenService.rotate({
      oldTokenId: dbToken.id,
      newTokenInput: createRefreshTokenInput,
    });

    const tokens = {
      access_token: access,
      refresh_token: refresh.token,
    };

    this.logger.log(`Token refreshed: userId=${user.id}`);
    return tokens;
  }

  async logout(input: LogoutInput): Promise<LogoutOutput> {
    const tokenPayload: RefreshTokenPayload =
      await this.verifyRefreshPayloadOrThrow(input.refresh_token);

    const dbToken = await this.validateRefreshTokenOrThrow(
      tokenPayload.jti,
      input.refresh_token,
    );

    await this.refreshTokenService.revoke(dbToken.id);
    this.logger.log(`User logged out: userId=${dbToken.userId}`);
    return { message: 'ok' };
  }

  async logoutAll(input: LogoutAllInput): Promise<LogoutAllOutput> {
    const tokenPayload: RefreshTokenPayload =
      await this.verifyRefreshPayloadOrThrow(input.refresh_token);

    const dbToken = await this.validateRefreshTokenOrThrow(
      tokenPayload.jti,
      input.refresh_token,
    );

    await this.refreshTokenService.revokeAllByUserId(dbToken.userId);
    this.logger.log(
      `User logged out from all sessions: userId=${dbToken.userId}`,
    );
    return { message: 'ok' };
  }

  async getProfile(userId: string): Promise<GetProfileOutput> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      this.logger.warn(
        `Failed to get user profile because user not found: userId=${userId}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      id: user.id,
      email: user.email,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }

  private async verifyRefreshPayloadOrThrow(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.tokenService.verifyRefreshToken(token);
    } catch (_error) {
      this.logger.warn('Invalid refresh token');
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async validateRefreshTokenOrThrow(
    jti: string,
    token: string,
  ): Promise<RefreshToken> {
    const dbToken = await this.refreshTokenService.findByJti(jti);
    if (
      !dbToken ||
      Date.now() >= dbToken.expiresAt.getTime() ||
      dbToken.revokedAt !== null
    ) {
      this.logger.warn('Invalid refresh token');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await this.secureHasher.verify(dbToken.tokenHash, token);
    if (!isValid) {
      this.logger.warn('Invalid refresh token');
      throw new UnauthorizedException('Invalid refresh token');
    }

    return dbToken;
  }
}
