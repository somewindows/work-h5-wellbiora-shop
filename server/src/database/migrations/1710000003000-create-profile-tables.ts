import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class CreateProfileTables1710000003000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'addresses',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'user_id', type: 'varchar', length: '36' },
        { name: 'receiver_name', type: 'varchar', length: '20' },
        { name: 'phone', type: 'varchar', length: '11' },
        { name: 'region', type: 'varchar', length: '128' },
        { name: 'detail', type: 'varchar', length: '255' },
        { name: 'is_default', type: 'tinyint', width: 1, default: '0' },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true)
    await queryRunner.createIndex('addresses', new TableIndex({ name: 'IDX_addresses_user_id', columnNames: ['user_id'] }))
    await queryRunner.createTable(new Table({
      name: 'realname_profiles',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'user_id', type: 'varchar', length: '36', isUnique: true },
        { name: 'name', type: 'varchar', length: '20' },
        { name: 'idcard_encrypted', type: 'text' },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('realname_profiles')
    await queryRunner.dropTable('addresses')
  }
}
