import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddSessionIdToRefreshTokens1781722398373 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM refresh_tokens');

    await queryRunner.addColumn(
      'refresh_tokens',
      new TableColumn({
        name: 'session_id',
        type: 'uuid',
        isNullable: false,
      }),
    );

    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_session_id',
        columnNames: ['session_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'refresh_tokens',
      new TableForeignKey({
        name: 'FK_refresh_tokens_session_id',
        columnNames: ['session_id'],
        referencedTableName: 'sessions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'refresh_tokens',
      'FK_refresh_tokens_session_id',
    );

    await queryRunner.dropIndex(
      'refresh_tokens',
      'IDX_refresh_tokens_session_id',
    );

    await queryRunner.dropColumn('refresh_tokens', 'session_id');
  }
}
