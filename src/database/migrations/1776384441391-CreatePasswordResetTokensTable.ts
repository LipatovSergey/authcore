import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePasswordResetTokensTable1776384441391 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.createTable(
      new Table({
        name: 'password_reset_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'jti',
            type: 'varchar',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'token_hash',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'used_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'revoked_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_password_reset_tokens_user_id',
            columnNames: ['user_id'],
          },
        ],
      }),
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX UQ_password_reset_tokens_active_user 
        ON password_reset_tokens (user_id) 
        WHERE used_at IS NULL AND revoked_at IS NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('password_reset_tokens');
  }
}
