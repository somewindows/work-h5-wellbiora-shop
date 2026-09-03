import { MigrationInterface, QueryRunner, Table } from 'typeorm'

export class CreateAdminLoginRateLimits1710000007000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'admin_login_rate_limits',
        columns: [
          { name: 'rate_key', type: 'varchar', length: '80', isPrimary: true },
          { name: 'fail_count', type: 'smallint', unsigned: true, default: '0' },
          { name: 'window_expires_at', type: 'datetime' },
          { name: 'locked_until', type: 'datetime', isNullable: true },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('admin_login_rate_limits')
  }
}
