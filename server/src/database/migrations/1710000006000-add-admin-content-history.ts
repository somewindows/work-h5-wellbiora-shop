import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class AddAdminContentHistory1710000006000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'catalog_content_versions',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'product_id', type: 'varchar', length: '32' },
        { name: 'version', type: 'int' },
        { name: 'blocks', type: 'json' },
        { name: 'created_by', type: 'varchar', length: '36' },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true)
    await queryRunner.createIndex('catalog_content_versions', new TableIndex({ name: 'UQ_catalog_content_versions_product_version', columnNames: ['product_id', 'version'], isUnique: true }))
    await queryRunner.createTable(new Table({
      name: 'admin_audit_logs',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'admin_id', type: 'varchar', length: '36' },
        { name: 'admin_username', type: 'varchar', length: '64' },
        { name: 'action', type: 'varchar', length: '32' },
        { name: 'target_type', type: 'varchar', length: '32' },
        { name: 'target_id', type: 'varchar', length: '64' },
        { name: 'before_data', type: 'json', isNullable: true },
        { name: 'after_data', type: 'json', isNullable: true },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true)
    await queryRunner.createIndex('admin_audit_logs', new TableIndex({ name: 'IDX_admin_audit_logs_target', columnNames: ['target_type', 'target_id'] }))
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('admin_audit_logs')
    await queryRunner.dropTable('catalog_content_versions')
  }
}
