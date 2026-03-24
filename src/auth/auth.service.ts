import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import {
  SECURE_HASHER,
  type SecureHasher,
} from './interfaces/secure-hasher.interface';
import { JwtTokensService } from './providers/jwt-tokens.service';
import type { CreateRefreshTokenInput } from './types/refresh-tokens';
import { RefreshTokensService } from './providers/refresh-tokens.service';
import type { SignedRefreshToken } from './types/jwt-tokens';
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import { RefreshRequestDto, RefreshResponseDto } from './dto/refresh.dto';
import { LogoutRequestDto, LogoutResponseDto } from './dto/logout.dto';
import { LogoutAllRequestDto, LogoutAllResponseDto } from './dto/logoutAll.dto';
import { GetProfileResponseDto } from './dto/get-profile.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @Inject(SECURE_HASHER)
    private readonly secureHasher: SecureHasher,
    private readonly usersService: UsersService,
    private readonly jwtTokensService: JwtTokensService,
    private readonly refreshTokensService: RefreshTokensService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  // Used for timing equalization when login fails because the user does not exist.
  private dummyHash = '';
  // Generate the dummy hash on startup so login requests do not recompute it.
  async onModuleInit() {
    this.dummyHash = await this.secureHasher.hash(
      'authcore_dummy_password_for_timing_equalization_v1',
    );
  }

  private createRefreshTokenInput(
    signedRefreshToken: SignedRefreshToken,
    userId: string,
  ): CreateRefreshTokenInput {
    return {
      rawToken: signedRefreshToken.token,
      jti: signedRefreshToken.jti,
      userId,
      expiresAt: signedRefreshToken.expiresAt,
    };
  }

  async register(input: RegisterRequestDto): Promise<RegisterResponseDto> {
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

  async login(input: LoginRequestDto): Promise<LoginResponseDto> {
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

    const [access, refresh] = await Promise.all([
      this.jwtTokensService.signAccessToken({
        sub: user.id,
        email: user.email,
      }),
      this.jwtTokensService.signRefreshToken(user.id),
    ]);

    const createRefreshTokenInput = this.createRefreshTokenInput(
      refresh,
      user.id,
    );

    await this.refreshTokensService.create(createRefreshTokenInput);

    this.logger.log(`User logged in: email=${user.email} userId=${user.id}`);
    return {
      access_token: access,
      refresh_token: refresh.token,
    };
  }

  async refresh(input: RefreshRequestDto): Promise<RefreshResponseDto> {
    const dbToken = await this.refreshTokensService.validateOrThrow(
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
      this.jwtTokensService.signAccessToken(payload),
      this.jwtTokensService.signRefreshToken(payload.sub),
    ]);

    const createRefreshTokenInput = this.createRefreshTokenInput(
      refresh,
      user.id,
    );

    await this.refreshTokensService.rotate({
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

  async logout(input: LogoutRequestDto): Promise<LogoutResponseDto> {
    const dbToken = await this.refreshTokensService.validateOrThrow(
      input.refresh_token,
    );

    await this.refreshTokensService.revoke(dbToken.id);
    this.logger.log(`User logged out: userId=${dbToken.userId}`);
    return { message: 'ok' };
  }

  async logoutAll(input: LogoutAllRequestDto): Promise<LogoutAllResponseDto> {
    const dbToken = await this.refreshTokensService.validateOrThrow(
      input.refresh_token,
    );

    await this.refreshTokensService.revokeAllByUserId(dbToken.userId);
    this.logger.log(
      `User logged out from all sessions: userId=${dbToken.userId}`,
    );
    return { message: 'ok' };
  }

  async getProfile(userId: string): Promise<GetProfileResponseDto> {
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
}
