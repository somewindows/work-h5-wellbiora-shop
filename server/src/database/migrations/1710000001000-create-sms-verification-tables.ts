import { MigrationInterface, QueryRunner, Table } from 'typeorm'

export class CreateSmsVerificationTables1710000001000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sms_verification_codes',
        columns: [
          { name: 'phone', type: 'varchar', length: '11', isPrimary: true },
          { name: 'code_hash', type: 'char', length: '64' },
          { name: 'attempts', type: 'tinyint', unsigned: true, default: '0' },
          { name: 'expires_at', type: 'datetime' },
          { name: 'cooldown_until', type: 'datetime' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    )
    await queryRunner.createTable(
      new Table({
        name: 'sms_ip_rate_limits',
        columns: [
          { name: 'ip', type: 'varchar', length: '45', isPrimary: true },
          { name: 'send_count', type: 'smallint', unsigned: true, default: '0' },
          { name: 'window_expires_at', type: 'datetime' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sms_ip_rate_limits')
    await queryRunner.dropTable('sms_verification_codes')
  }
}
