import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../../src/notifications/notifications.service';
import type { App } from 'supertest/types';
import { createNotificationsServiceMock } from '../mocks/notifications-service.mock';
import cookieParser from 'cookie-parser';

export async function createTestApp(
  envOverrides?: Record<string, string | undefined>,
) {
  const applyEnv = (envValues: Record<string, string | undefined>) => {
    Object.entries(envValues).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  };

  const previousEnv: Record<string, string | undefined> = {};
  if (envOverrides) {
    // save default values as they set in env
    Object.keys(envOverrides).forEach((key) => {
      previousEnv[key] = process.env[key];
    });

    // override values in process.env
    applyEnv(envOverrides);
  }

  const notificationsServiceMock = createNotificationsServiceMock();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(NotificationsService)
    .useValue(notificationsServiceMock)
    .compile();

  const app: INestApplication<App> = moduleFixture.createNestApplication();

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  const dataSource = app.get(DataSource);
  const httpServer = app.getHttpServer();

  const restoreEnv = () => {
    applyEnv(previousEnv);
  };

  return {
    app,
    dataSource,
    httpServer,
    notificationsServiceMock,
    restoreEnv,
  };
}
