import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Argon2PasswordHasher } from './providers/argon2-secure-hasher.service';
import { SECURE_HASHER } from './interfaces/secure-hasher.interface';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtTokensService } from './providers/jwt-tokens.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokensService } from './providers/refresh-tokens.service';
import { EmailVerificationTokensService } from './providers/email-verification-tokens.service';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { MailService } from './providers/mail.service';
import { UnverifiedUsersCleanupService } from './providers/unverified-users-cleanup.service';

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
    TypeOrmModule.forFeature([RefreshToken, EmailVerificationToken]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtTokensService,
    RefreshTokensService,
    EmailVerificationTokensService,
    MailService,
    UnverifiedUsersCleanupService,
    { provide: SECURE_HASHER, useClass: Argon2PasswordHasher },
  ],
})
export class AuthModule {}
