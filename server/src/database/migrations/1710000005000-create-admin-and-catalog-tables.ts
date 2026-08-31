import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class CreateAdminAndCatalogTables1710000005000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'admin_accounts',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'username', type: 'varchar', length: '64', isUnique: true },
        { name: 'password_hash', type: 'varchar', length: '255' },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true)
    await queryRunner.createTable(new Table({
      name: 'catalog_products',
      columns: [
        { name: 'id', type: 'varchar', length: '32', isPrimary: true },
        { name: 'name', type: 'varchar', length: '128' }, { name: 'en', type: 'varchar', length: '128' },
        { name: 'price_fen', type: 'int' }, { name: 'theme', type: 'varchar', length: '16' },
        { name: 'theme_light', type: 'varchar', length: '16' }, { name: 'card_img', type: 'varchar', length: '255' },
        { name: 'tags', type: 'json' }, { name: 'spec', type: 'varchar', length: '128' },
        { name: 'flavor', type: 'varchar', length: '128', isNullable: true }, { name: 'ingredients', type: 'text' },
        { name: 'origin_cert', type: 'varchar', length: '255' }, { name: 'usage', type: 'text', isNullable: true },
        { name: 'compliance_text', type: 'text' }, { name: 'blocks', type: 'json' }, { name: 'draft_blocks', type: 'json' },
        { name: 'content_version', type: 'int', default: '1' }, { name: 'is_active', type: 'tinyint', width: 1, default: '1' },
        { name: 'goods_no', type: 'varchar', length: '64', isNullable: true }, { name: 'warehouse_code', type: 'varchar', length: '64', isNullable: true },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true)
    await queryRunner.createIndex('catalog_products', new TableIndex({ name: 'IDX_catalog_products_active', columnNames: ['is_active'] }))
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('catalog_products')
    await queryRunner.dropTable('admin_accounts')
  }
}
