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
import { RefreshTokensService } from './providers/refresh-tokens.service';
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import { RefreshRequestDto, RefreshResponseDto } from './dto/refresh.dto';
import { LogoutRequestDto, LogoutResponseDto } from './dto/logout.dto';
import { LogoutAllRequestDto, LogoutAllResponseDto } from './dto/logoutAll.dto';
import { GetProfileResponseDto } from './dto/get-profile.dto';
import { EmailVerificationTokensService } from './providers/email-verification-tokens.service';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { ConfigService } from '@nestjs/config';
import { MailService } from './providers/mail.service';
import {
  EmailVerificationResendRequestDto,
  EmailVerificationResendResponseDto,
} from './dto/email-verification-resend.dto';

export const VERIFY_EMAIL_OUTCOME = {
  VERIFIED: 'verified',
  ALREADY_VERIFIED: 'already_verified',
} as const;

export type VerifyEmailOutcome =
  (typeof VERIFY_EMAIL_OUTCOME)[keyof typeof VERIFY_EMAIL_OUTCOME];

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @Inject(SECURE_HASHER)
    private readonly secureHasher: SecureHasher,
    private readonly usersService: UsersService,
    private readonly jwtTokensService: JwtTokensService,
    private readonly refreshTokensService: RefreshTokensService,
    private readonly emailVerificationTokensService: EmailVerificationTokensService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
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

  // TODO: need to refactor, transaction must be moved to separate file
  async verifyEmail(rawToken: string) {
    const tokenInstance =
      await this.emailVerificationTokensService.validateOrThrow(rawToken);

    const user = await this.usersService.findById(tokenInstance.userId);
    if (!user) {
      this.logger.warn(`Token belongs to non-existent user`);
      throw new UnauthorizedException('Invalid email verification token');
    }

    if (user.isEmailVerified) {
      return VERIFY_EMAIL_OUTCOME.ALREADY_VERIFIED;
    }

    await this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const usersRepo = manager.getRepository(User);
      const emailVerificationTokensRepo = manager.getRepository(
        EmailVerificationToken,
      );

      await usersRepo.update(user.id, {
        isEmailVerified: true,
        emailVerifiedAt: now,
        unverifiedExpiresAt: null,
      });

      await emailVerificationTokensRepo.update(tokenInstance.id, {
        usedAt: now,
      });
    });

    return VERIFY_EMAIL_OUTCOME.VERIFIED;
  }

  private async sendEmailVerification(userId: string, email: string) {
    const signedEmailVerificationToken =
      await this.jwtTokensService.signEmailVerificationToken(userId);

    await this.emailVerificationTokensService.create({
      ...signedEmailVerificationToken,
      userId,
    });

    // create email verification link
    const baseUrl = this.config.getOrThrow<string>('authPublicUrl');
    const verificationLink = new URL(baseUrl);
    verificationLink.pathname = '/auth/email-verification';
    verificationLink.searchParams.set(
      'token',
      signedEmailVerificationToken.rawToken,
    );
    await this.mailService.sendEmailVerification(
      email,
      verificationLink.toString(),
    );
  }

  async emailVerificationResend(
    input: EmailVerificationResendRequestDto,
  ): Promise<EmailVerificationResendResponseDto> {
    const { email } = input;
    const user = await this.usersService.findByEmail(email);
    if (user && !user.isEmailVerified) {
      const unverifiedExpiresAt = this.calculateUnverifiedUserExpiresAt();
      await this.usersService.refreshUnverifiedExpiresAt(
        user.id,
        unverifiedExpiresAt,
      );
      await this.sendEmailVerification(user.id, user.email);
    }

    return { message: 'ok' };
  }

  private calculateUnverifiedUserExpiresAt(): Date {
    const cutoffMs =
      Date.now() + this.config.getOrThrow<number>('unverifiedUserTtlMs');
    return new Date(cutoffMs);
  }

  async register(input: RegisterRequestDto): Promise<RegisterResponseDto> {
    const passwordHash = await this.secureHasher.hash(input.password);
    const unverifiedExpiresAt = this.calculateUnverifiedUserExpiresAt();

    const user = await this.usersService.createUser({
      email: input.email,
      passwordHash,
      unverifiedExpiresAt,
    });

    await this.sendEmailVerification(user.id, user.email);

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

    // must be after password check to avoid data leak
    if (!user.isEmailVerified) {
      this.logger.warn(
        `Failed login attempt because email=${input.email}, is not verified`,
      );
      throw new UnauthorizedException('Email is not verified');
    }

    const [rawAccessToken, signedRefreshToken] = await Promise.all([
      this.jwtTokensService.signAccessToken({
        sub: user.id,
        email: user.email,
      }),
      this.jwtTokensService.signRefreshToken(user.id),
    ]);

    await this.refreshTokensService.create({
      ...signedRefreshToken,
      userId: user.id,
    });

    this.logger.log(`User logged in: email=${user.email} userId=${user.id}`);
    return {
      access_token: rawAccessToken,
      refresh_token: signedRefreshToken.rawToken,
    };
  }

  async refresh(input: RefreshRequestDto): Promise<RefreshResponseDto> {
    const tokenInstance = await this.refreshTokensService.validateOrThrow(
      input.refresh_token,
    );

    const user = await this.usersService.findById(tokenInstance.userId);
    if (!user) {
      this.logger.warn(
        `Failed to refresh token because owner does not exist: userId=${tokenInstance.userId}`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    const [rawAccessToken, signedRefreshToken] = await Promise.all([
      this.jwtTokensService.signAccessToken({
        sub: user.id,
        email: user.email,
      }),
      this.jwtTokensService.signRefreshToken(user.id),
    ]);

    await this.refreshTokensService.rotate({
      oldTokenId: tokenInstance.id,
      newTokenInput: { ...signedRefreshToken, userId: user.id },
    });

    this.logger.log(`Token refreshed: userId=${user.id}`);
    return {
      access_token: rawAccessToken,
      refresh_token: signedRefreshToken.rawToken,
    };
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
