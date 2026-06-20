import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import * as Joi from 'joi';
import configuration from './config/configuration';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { NotificationsModule } from './notifications/notifications.module';

const DOTENV_CONFIG_PATH = process.env.DOTENV_CONFIG_PATH ?? '.env.development';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      envFilePath: [DOTENV_CONFIG_PATH],

      validationSchema: Joi.object({
        AUTH_PUBLIC_URL: Joi.string().required(),

        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().integer().required(),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),

        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_ACCESS_EXPIRES_IN: Joi.string().required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
        JWT_EMAIL_VERIFICATION_SECRET: Joi.string().required(),
        JWT_EMAIL_VERIFICATION_EXPIRES_IN: Joi.string().required(),
        JWT_PASSWORD_RESET_SECRET: Joi.string().required(),
        JWT_PASSWORD_RESET_EXPIRES_IN: Joi.string().required(),

        ARGON2_MEMORY_COST: Joi.number().integer().positive().required(),
        ARGON2_TIME_COST: Joi.number().integer().positive().required(),
        ARGON2_PARALLELISM: Joi.number().integer().positive().required(),

        THROTTLE_DEFAULT_LIMIT: Joi.number().integer().positive().required(),
        THROTTLE_DEFAULT_TTL_MS: Joi.number().integer().positive().required(),
        THROTTLE_AUTH_REGISTER_LIMIT: Joi.number()
          .integer()
          .positive()
          .required(),
        THROTTLE_AUTH_REGISTER_TTL_MS: Joi.number()
          .integer()
          .positive()
          .required(),
        THROTTLE_AUTH_LOGIN_LIMIT: Joi.number().integer().positive().required(),
        THROTTLE_AUTH_LOGIN_TTL_MS: Joi.number()
          .integer()
          .positive()
          .required(),
        THROTTLE_AUTH_REFRESH_LIMIT: Joi.number()
          .integer()
          .positive()
          .required(),
        THROTTLE_AUTH_REFRESH_TTL_MS: Joi.number()
          .integer()
          .positive()
          .required(),

        FRONTEND_ORIGIN: Joi.string().required(),
        EMAIL_VERIFICATION_RESULT_URL: Joi.string().required(),
        PASSWORD_RESET_PAGE_URL: Joi.string().required(),

        UNVERIFIED_USER_TTL_MS: Joi.number().integer().positive().required(),
        EMAIL_VERIFICATION_TOKEN_RETENTION_MS: Joi.number()
          .integer()
          .positive()
          .required(),
        PASSWORD_RESET_TOKEN_RETENTION_MS: Joi.number()
          .integer()
          .positive()
          .required(),
        REFRESH_TOKEN_RETENTION_MS: Joi.number()
          .integer()
          .positive()
          .required(),

        ENABLE_DEMO_NOTIFICATIONS_OUTBOX: Joi.boolean().required(),
        PORT: Joi.number().integer().positive().optional(),
        NODE_ENV: Joi.string().optional(),
      }),

      load: [configuration],
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.getOrThrow<number>('throttler.defaultTtlMs'),
          limit: config.getOrThrow<number>('throttler.defaultLimit'),
        },
        {
          name: 'authRegister',
          ttl: config.getOrThrow<number>('throttler.registerTtlMs'),
          limit: config.getOrThrow<number>('throttler.registerLimit'),
        },
        {
          name: 'authLogin',
          ttl: config.getOrThrow<number>('throttler.loginTtlMs'),
          limit: config.getOrThrow<number>('throttler.loginLimit'),
        },
        {
          name: 'authRefresh',
          ttl: config.getOrThrow<number>('throttler.refreshTtlMs'),
          limit: config.getOrThrow<number>('throttler.refreshLimit'),
        },
      ],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('database.host'),
        port: config.getOrThrow<number>('database.port'),
        username: config.getOrThrow<string>('database.username'),
        password: config.getOrThrow<string>('database.password'),
        database: config.getOrThrow<string>('database.name'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    ScheduleModule.forRoot(),

    AuthModule,

    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
