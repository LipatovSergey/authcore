import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  MailService,
  MailServiceContract,
} from '../../src/auth/providers/mail.service';
import type { App } from 'supertest/types';

export interface MailServiceMock extends MailServiceContract {
  lastEmailVerificationLink: string | null;
}

export async function createTestApp() {
  const mailServiceMock: MailServiceMock = {
    lastEmailVerificationLink: null,
    // eslint-disable-next-line @typescript-eslint/require-await
    async sendEmailVerification(_email, verificationLink) {
      mailServiceMock.lastEmailVerificationLink = verificationLink;
    },
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useValue(mailServiceMock)
    .compile();

  const app: INestApplication<App> = moduleFixture.createNestApplication();
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

  return {
    app,
    dataSource,
    httpServer,
    mailServiceMock,
  };
}
