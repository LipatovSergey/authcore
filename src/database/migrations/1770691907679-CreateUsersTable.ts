import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUsersTable1770691907679 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'email', type: 'varchar', isNullable: false, isUnique: true },
          { name: 'password_hash', type: 'varchar', isNullable: false },
          {
            name: 'is_email_verified',
            type: 'boolean',
            isNullable: false,
            default: 'false',
          },
          {
            name: 'email_verified_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'unverified_expires_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
    );

    await queryRunner.query(`
      ALTER TABLE users
      ADD CONSTRAINT chk_users_email_verification_state
      CHECK (
        (
          is_email_verified = true
          AND email_verified_at IS NOT NULL
          AND unverified_expires_at IS NULL
        )
        OR
        (
          is_email_verified = false
          AND email_verified_at IS NULL
          AND unverified_expires_at IS NOT NULL
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
