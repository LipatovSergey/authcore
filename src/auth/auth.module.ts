import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Argon2PasswordHasher } from './hashing/argon2-secure-hasher.service';
import { SECURE_HASHER } from './interfaces/secure-hasher.interface';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtTokensService } from './tokens/jwt-tokens.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokensService } from './tokens/refresh-tokens.service';
import { EmailVerificationTokensService } from './tokens/email-verification-tokens.service';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { UnverifiedUsersCleanupService } from './cleanup/unverified-users-cleanup.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { PasswordResetTokensService } from './tokens/password-reset-tokens.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailVerificationTokensCleanupService } from './cleanup/email-verification-tokens-cleanup.service';
import { PasswordResetTokensCleanupService } from './cleanup/password-reset-tokens-cleanup.service';
import { RefreshTokensCleanupService } from './cleanup/refresh-tokens-cleanup.service';
import { Session } from './sessions/session.entity';
import { SessionsService } from './sessions/sessions.service';
import { RefreshCookieService } from './cookies/refresh-cookie.service';

@Module({
  imports: [
    UsersModule,
    // default values must be specified even if they are always overwritten
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('jwt.accessSecret'),
        signOptions: {
          expiresIn: config.getOrThrow('jwt.accessExpiresIn'),
        },
      }),
    }),
    TypeOrmModule.forFeature([
      RefreshToken,
      EmailVerificationToken,
      PasswordResetToken,
      Session,
    ]),
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtTokensService,
    RefreshTokensService,
    RefreshTokensCleanupService,
    EmailVerificationTokensService,
    EmailVerificationTokensCleanupService,
    PasswordResetTokensCleanupService,
    PasswordResetTokensService,
    UnverifiedUsersCleanupService,
    SessionsService,
    RefreshCookieService,
    { provide: SECURE_HASHER, useClass: Argon2PasswordHasher },
  ],
})
export class AuthModule {}
