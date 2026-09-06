import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

export class CreateCartItems1710000002000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'cart_items',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'user_id', type: 'varchar', length: '36' },
        { name: 'product_id', type: 'varchar', length: '32' },
        { name: 'quantity', type: 'int' },
        { name: 'checked', type: 'tinyint', width: 1, default: '1' },
        { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true)
    await queryRunner.createIndex('cart_items', new TableIndex({ name: 'IDX_cart_items_user_id', columnNames: ['user_id'] }))
    await queryRunner.createIndex('cart_items', new TableIndex({ name: 'UQ_cart_items_user_product', columnNames: ['user_id', 'product_id'], isUnique: true }))
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('cart_items')
  }
}
