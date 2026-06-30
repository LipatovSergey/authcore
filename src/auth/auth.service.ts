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
import { JwtTokensService } from './tokens/jwt-tokens.service';
import { RefreshTokensService } from './tokens/refresh-tokens.service';
import { RegisterRequestDto, RegisterResponseDto } from './dto/register.dto';
import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import { RefreshRequestDto, RefreshResponseDto } from './dto/refresh.dto';
import { LogoutRequestDto, LogoutResponseDto } from './dto/logout.dto';
import { LogoutAllRequestDto, LogoutAllResponseDto } from './dto/logoutAll.dto';
import { GetProfileResponseDto } from './dto/get-profile.dto';
import { EmailVerificationTokensService } from './tokens/email-verification-tokens.service';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  EmailVerificationResendRequestDto,
  EmailVerificationResendResponseDto,
} from './dto/email-verification-resend.dto';
import { PasswordResetTokensService } from './tokens/password-reset-tokens.service';
import { ForgotPasswordRequestDto } from './dto/forgot-password.dto';
import {
  ResetPasswordRequestDto,
  ResetPasswordResponseDto,
} from './dto/reset-password.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SessionsService } from './sessions/sessions.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokenReuseDetectedError } from './tokens/refresh-token-reuse-detected.error';
import { GetSessionsResponseDto } from './dto/get-sessions.dto';
import { RevokeSessionResponseDto } from './dto/revoke-session.dto';
import { RevokeOtherSessionsResponseDto } from './dto/revoke-other-sessions.dto';
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
    private readonly passwordResetTokenService: PasswordResetTokensService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly notificationService: NotificationsService,
    private readonly sessionService: SessionsService,
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
      await this.usersService.confirmEmailVerificationWithManager(
        user.id,
        now,
        manager,
      );

      await this.emailVerificationTokensService.markTokenAsUsedWithManager(
        {
          id: tokenInstance.id,
          now,
        },
        manager,
      );
    });

    return VERIFY_EMAIL_OUTCOME.VERIFIED;
  }

  async emailVerificationResend(
    input: EmailVerificationResendRequestDto,
  ): Promise<EmailVerificationResendResponseDto> {
    const { email } = input;
    const user = await this.usersService.findByEmail(email);
    if (!user || user.isEmailVerified) {
      return { message: 'ok' };
    }
    // issue email verification token
    const issuedEmailVerificationToken =
      await this.jwtTokensService.signEmailVerificationToken(user.id);

    let shouldSendEmail = false;
    await this.dataSource.transaction(async (manager) => {
      const unverifiedExpiresAt = this.calculateUnverifiedUserExpiresAt();
      const refreshed =
        await this.usersService.refreshUnverifiedExpiresAtWithManager(
          user.id,
          unverifiedExpiresAt,
          manager,
        );

      if (!refreshed) {
        return;
      }

      await this.emailVerificationTokensService.setActiveTokenWithManager(
        {
          ...issuedEmailVerificationToken,
          userId: user.id,
        },
        manager,
      );
      shouldSendEmail = true;
    });

    if (!shouldSendEmail) {
      return { message: 'ok' };
    }
    // create email verification link
    const baseUrl = this.config.getOrThrow<string>('authPublicUrl');
    const verificationLink = new URL(baseUrl);
    verificationLink.pathname = '/auth/email-verification';
    verificationLink.searchParams.set(
      'token',
      issuedEmailVerificationToken.rawToken,
    );
    // send email
    try {
      await this.notificationService.sendEmailVerification(
        email,
        verificationLink.toString(),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send email for email verification after token rotation: userId=${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { message: 'ok' };
    }
    return { message: 'ok' };
  }

  async resetPassword(
    input: ResetPasswordRequestDto,
  ): Promise<ResetPasswordResponseDto> {
    const tokenInstance = await this.passwordResetTokenService.validateOrThrow(
      input.token,
    );

    const user = await this.usersService.findById(tokenInstance.userId);
    if (!user) {
      this.logger.warn(`Token belongs to non-existent user`);
      throw new UnauthorizedException('Invalid password reset token');
    }

    const passwordHash = await this.secureHasher.hash(input.password);
    await this.dataSource.transaction(async (manager) => {
      const now = new Date();
      await this.usersService.resetPasswordWithManager(
        { id: user.id, passwordHash: passwordHash },
        manager,
      );
      await this.passwordResetTokenService.markTokenAsUsedWithManager(
        { id: tokenInstance.id, now },
        manager,
      );
    });

    return { message: 'ok' };
  }

  async forgotPassword(input: ForgotPasswordRequestDto) {
    const { email } = input;
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { message: 'ok' };
    }
    // issue password reset token
    const issuedPasswordResetToken =
      await this.jwtTokensService.signPasswordResetToken(user.id);
    // open transaction
    await this.dataSource.transaction(async (manager) => {
      await this.passwordResetTokenService.setActiveTokenWithManager(
        {
          ...issuedPasswordResetToken,
          userId: user.id,
        },
        manager,
      );
      if (!user.isEmailVerified) {
        const unverifiedExpiresAt = this.calculateUnverifiedUserExpiresAt();
        await this.usersService.refreshUnverifiedExpiresAtWithManager(
          user.id,
          unverifiedExpiresAt,
          manager,
        );
      }
    });
    // build link
    const baseUrl = this.config.getOrThrow<string>('passwordResetPageUrl');
    const passwordResetLink = new URL(baseUrl);
    passwordResetLink.searchParams.set(
      'token',
      issuedPasswordResetToken.rawToken,
    );
    // send email
    try {
      await this.notificationService.sendPasswordReset(
        email,
        passwordResetLink.toString(),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send password reset email after token rotation: userId=${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { message: 'ok' };
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

    const { user, issuedEmailVerificationToken } =
      await this.dataSource.transaction(async (manager) => {
        const user = await this.usersService.createUserWithManager(
          {
            email: input.email,
            passwordHash,
            unverifiedExpiresAt,
          },
          manager,
        );
        const issuedEmailVerificationToken =
          await this.jwtTokensService.signEmailVerificationToken(user.id);

        await this.emailVerificationTokensService.setActiveTokenWithManager(
          {
            ...issuedEmailVerificationToken,
            userId: user.id,
          },
          manager,
        );
        return { user, issuedEmailVerificationToken };
      });
    // create email verification link
    const baseUrl = this.config.getOrThrow<string>('authPublicUrl');
    const verificationLink = new URL(baseUrl);
    verificationLink.pathname = '/auth/email-verification';
    verificationLink.searchParams.set(
      'token',
      issuedEmailVerificationToken.rawToken,
    );
    // send email
    try {
      await this.notificationService.sendEmailVerification(
        user.email,
        verificationLink.toString(),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send email for email verification: userId=${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { message: 'ok' };
    }
    return { message: 'ok' };
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
      throw new UnauthorizedException({
        message: 'Email is not verified',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const issuedRefreshToken = await this.jwtTokensService.signRefreshToken(
      user.id,
    );

    const sessionId = await this.dataSource.transaction(async (manager) => {
      const session = await this.sessionService.createSession(
        {
          userId: user.id,
          ipAddress: null,
          userAgent: null,
        },
        manager,
      );
      await this.refreshTokensService.create(
        {
          ...issuedRefreshToken,
          userId: user.id,
          sessionId: session.id,
        },
        manager,
      );

      return session.id;
    });

    const rawAccessToken = await this.jwtTokensService.signAccessToken({
      sub: user.id,
      email: user.email,
      sessionId,
    });

    this.logger.log(`User logged in: email=${user.email} userId=${user.id}`);
    return {
      access_token: rawAccessToken,
      refresh_token: issuedRefreshToken.rawToken,
    };
  }

  async refresh(input: RefreshRequestDto): Promise<RefreshResponseDto> {
    let validatedToken: RefreshToken;
    try {
      validatedToken =
        await this.refreshTokensService.validateActiveForRotationOrThrow(
          input.refresh_token,
        );
    } catch (error) {
      if (!(error instanceof RefreshTokenReuseDetectedError)) {
        throw error;
      }
      await this.dataSource.transaction(async (manager) => {
        const revokedAt = new Date();
        await this.sessionService.revokeAllByUserId(
          {
            userId: error.userId,
            revokedAt,
          },
          manager,
        );
        await this.refreshTokensService.revokeAllByUserId(
          {
            userId: error.userId,
            revokedAt,
          },
          manager,
        );
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(validatedToken.userId);
    if (!user) {
      this.logger.warn(
        `Failed to refresh token because owner does not exist: userId=${validatedToken.userId}`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    const issuedRefreshToken = await this.jwtTokensService.signRefreshToken(
      user.id,
    );

    const sessionId = await this.dataSource.transaction(async (manager) => {
      const activeSession =
        await this.sessionService.validateActiveUserSessionOrThrow(
          {
            sessionId: validatedToken.sessionId,
            userId: user.id,
          },
          manager,
        );

      await this.refreshTokensService.rotate(
        {
          oldTokenId: validatedToken.id,
          newTokenInput: {
            ...issuedRefreshToken,
            userId: user.id,
            sessionId: activeSession.id,
          },
        },
        manager,
      );

      await this.sessionService.markSessionAsRefreshed(
        {
          sessionId: activeSession.id,
        },
        manager,
      );

      return activeSession.id;
    });

    const rawAccessToken = await this.jwtTokensService.signAccessToken({
      sub: user.id,
      email: user.email,
      sessionId,
    });

    this.logger.log(`Token refreshed: userId=${user.id}`);
    return {
      access_token: rawAccessToken,
      refresh_token: issuedRefreshToken.rawToken,
    };
  }

  async logout(input: LogoutRequestDto): Promise<LogoutResponseDto> {
    const dbToken = await this.refreshTokensService.verifyForRevocationOrThrow(
      input.refresh_token,
    );

    const revokedAt = new Date();

    await this.dataSource.transaction(async (manager) => {
      await this.sessionService.revoke(
        {
          sessionId: dbToken.sessionId,
          revokedAt,
        },
        manager,
      );

      await this.refreshTokensService.revokeAllBySessionId(
        {
          sessionId: dbToken.sessionId,
          revokedAt,
        },
        manager,
      );
    });

    this.logger.log(
      `User logged out: userId=${dbToken.userId}, sessionId=${dbToken.sessionId}`,
    );
    return { message: 'ok' };
  }

  async logoutAll(input: LogoutAllRequestDto): Promise<LogoutAllResponseDto> {
    const dbToken = await this.refreshTokensService.verifyForRevocationOrThrow(
      input.refresh_token,
    );

    const revokedAt = new Date();

    await this.dataSource.transaction(async (manager) => {
      await this.sessionService.revokeAllByUserId(
        {
          userId: dbToken.userId,
          revokedAt,
        },
        manager,
      );

      await this.refreshTokensService.revokeAllByUserId(
        {
          userId: dbToken.userId,
          revokedAt,
        },
        manager,
      );
    });

    this.logger.log(
      `User logged out from all sessions: userId=${dbToken.userId}`,
    );
    return { message: 'ok' };
  }

  async getActiveSessions(input: {
    sessionId: string;
    userId: string;
  }): Promise<GetSessionsResponseDto> {
    const { sessionId, userId } = input;
    const activeSessionsEntities = await this.dataSource.transaction(
      async (manager) => {
        const validActiveSession =
          await this.sessionService.validateActiveUserSessionOrThrow(
            {
              sessionId,
              userId,
            },
            manager,
          );
        return this.sessionService.findActiveByUserId(
          validActiveSession.userId,
          manager,
        );
      },
    );

    return {
      sessions: activeSessionsEntities.map((sessionEntity) => ({
        id: sessionEntity.id,
        user_agent: sessionEntity.userAgent,
        ip_address: sessionEntity.ipAddress,
        created_at: sessionEntity.createdAt,
        last_refreshed_at: sessionEntity.lastRefreshedAt,
      })),
    };
  }

  async revokeUserSession(input: {
    userId: string;
    sessionId: string;
  }): Promise<RevokeSessionResponseDto> {
    const { userId, sessionId } = input;
    const revokedAt = new Date();

    const revokedRefreshTokensCount = await this.dataSource.transaction(
      async (manager) => {
        await this.sessionService.validateActiveUserSessionOrThrow(
          {
            sessionId,
            userId,
          },
          manager,
        );

        await this.sessionService.revoke(
          {
            sessionId,
            revokedAt,
          },
          manager,
        );

        const revokedRefreshTokensCount =
          await this.refreshTokensService.revokeAllBySessionId(
            {
              sessionId,
              revokedAt,
            },
            manager,
          );

        return revokedRefreshTokensCount;
      },
    );

    this.logger.log(
      `User session revoked: userId=${userId}, sessionId=${sessionId}, revoked refresh tokens=${revokedRefreshTokensCount}`,
    );
    return { message: 'ok' };
  }

  async revokeOtherUserSessions(input: {
    userId: string;
    sessionId: string;
  }): Promise<RevokeOtherSessionsResponseDto> {
    const { userId, sessionId } = input;
    const revokedAt = new Date();

    const { revokedSessionsCount, revokedRefreshTokensCount } =
      await this.dataSource.transaction(async (manager) => {
        await this.sessionService.validateActiveUserSessionOrThrow(
          {
            sessionId,
            userId,
          },
          manager,
        );
        const revokedSessionsCount =
          await this.sessionService.revokeAllByUserIdExceptSessionId(
            {
              userId,
              currentSessionId: sessionId,
              revokedAt,
            },
            manager,
          );

        const revokedRefreshTokensCount =
          await this.refreshTokensService.revokeAllByUserIdExceptSessionId(
            {
              userId,
              currentSessionId: sessionId,
              revokedAt,
            },
            manager,
          );

        return { revokedSessionsCount, revokedRefreshTokensCount };
      });

    this.logger.log(
      `Other sessions revoked: userId=${userId}, currentSessionId=${sessionId}, revokedSessions=${revokedSessionsCount}, revokedRefreshTokens=${revokedRefreshTokensCount}`,
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
