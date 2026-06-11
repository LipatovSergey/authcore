import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { User } from '../../src/users/entities/user.entity';

type CreateUserFixtureOptions = {
  email?: string;
  isEmailVerified?: boolean;
  emailVerifiedAt?: Date | null;
  unverifiedExpiresAt?: Date | null;
};

export async function createUserFixture(
  dataSource: DataSource,
  options: CreateUserFixtureOptions = {},
): Promise<User> {
  const {
    email = `user-${randomUUID()}@test.com`,
    isEmailVerified = false,
    emailVerifiedAt = null,
    unverifiedExpiresAt = new Date('2026-04-01T00:00:00.000Z'),
  } = options;

  const userRepository = dataSource.getRepository(User);
  return userRepository.save({
    email,
    passwordHash: 'test-password-hash',
    isEmailVerified,
    emailVerifiedAt,
    unverifiedExpiresAt,
  });
}
