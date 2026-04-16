import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { UsersService } from 'src/users/users.service';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { createTestApp } from '../helpers/test-app.helper';

describe('UsersService.cleanupUnverifiedUsers', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    usersService = app.get(UsersService);
    userRepository = dataSource.getRepository(User);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  it('returns 0 when there are no unverified cleanup candidates', async () => {
    const nowMock = new Date('2026-04-01T00:00:00.000Z');
    const result = await usersService.cleanupUnverifiedUsers(nowMock);
    expect(result).toBe(0);
  });

  it('deletes expired unverified users', async () => {
    const nowMock = new Date('2026-04-02T00:00:00.000Z');
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
    };
    await userRepository.save(user);
    const cleanupResult = await usersService.cleanupUnverifiedUsers(nowMock);
    expect(cleanupResult).toBe(1);
    const findResult = await userRepository.findOneBy({ email: user.email });
    expect(findResult).toBe(null);
  });

  it('does not delete an unverified users whose deadline has not expired', async () => {
    const nowMock = new Date('2026-04-02T00:00:00.000Z');
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt: new Date('2026-04-03T00:00:00.000Z'),
    };
    await userRepository.save(user);
    const cleanupResult = await usersService.cleanupUnverifiedUsers(nowMock);
    expect(cleanupResult).toBe(0);
    const findResult = await userRepository.findOneBy({ email: user.email });
    expect(findResult?.email).toBe(user.email);
  });

  it('does not delete user when deadline equals now', async () => {
    const nowMock = new Date('2026-04-02T00:00:00.000Z');
    const user = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt: nowMock,
    };
    await userRepository.save(user);
    const cleanupResult = await usersService.cleanupUnverifiedUsers(nowMock);
    expect(cleanupResult).toBe(0);
    const findResult = await userRepository.findOneBy({ email: user.email });
    expect(findResult?.email).toBe(user.email);
  });

  it('cleanup deletes only expired unverified users from mixed dataset', async () => {
    const nowMock = new Date('2026-04-02T00:00:00.000Z');
    const verifiedUser = {
      email: 'test@gmail.com',
      passwordHash: 'somePasswordHash',
      emailVerifiedAt: new Date('2026-04-01T00:00:00.000Z'),
      isEmailVerified: true,

      unverifiedExpiresAt: null,
    };
    const unverifiedNotExpiredUser = {
      email: 'test1@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt: new Date('2026-04-03T00:00:00.000Z'),
    };
    const unverifiedExpiredUser = {
      email: 'test2@gmail.com',
      passwordHash: 'somePasswordHash',
      isEmailVerified: false,
      unverifiedExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
    };
    await userRepository.save([
      verifiedUser,
      unverifiedNotExpiredUser,
      unverifiedExpiredUser,
    ]);
    const cleanupResult = await usersService.cleanupUnverifiedUsers(nowMock);
    expect(cleanupResult).toBe(1);
    const foundUsers = await userRepository.find({
      where: [
        { email: verifiedUser.email },
        { email: unverifiedNotExpiredUser.email },
      ],
    });
    expect(foundUsers.length).toBe(2);
    const foundExpiredUser = await userRepository.findOneBy({
      email: unverifiedExpiredUser.email,
    });
    expect(foundExpiredUser).toBeNull();
  });
});
