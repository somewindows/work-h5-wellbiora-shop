import { MigrationInterface, QueryRunner, Table } from 'typeorm'

export class CreateUsers1710000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'phone', type: 'varchar', length: '11', isUnique: true },
          { name: 'nickname', type: 'varchar', length: '64', default: "'WELLBIORA 会员'" },
          { name: 'wechat_open_id', type: 'varchar', length: '64', isNullable: true, isUnique: true },
          { name: 'union_id', type: 'varchar', length: '64', isNullable: true, isUnique: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users')
  }
}
