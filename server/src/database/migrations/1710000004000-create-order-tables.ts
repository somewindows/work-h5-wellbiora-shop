import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm'

export class CreateOrderTables1710000004000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: 'orders', columns: [
      { name: 'id', type: 'varchar', length: '36', isPrimary: true }, { name: 'order_no', type: 'varchar', length: '32', isUnique: true },
      { name: 'user_id', type: 'varchar', length: '36' }, { name: 'request_id', type: 'varchar', length: '64' }, { name: 'status', type: 'varchar', length: '16' },
      { name: 'payment_status', type: 'varchar', length: '16' }, { name: 'warehouse_status', type: 'varchar', length: '64', isNullable: true }, { name: 'total_fen', type: 'int' },
      { name: 'realname_name', type: 'varchar', length: '20' }, { name: 'idcard_encrypted', type: 'text' }, { name: 'idcard_fingerprint', type: 'varchar', length: '64' },
      { name: 'receiver_name', type: 'varchar', length: '20' }, { name: 'receiver_phone', type: 'varchar', length: '11' }, { name: 'receiver_region', type: 'varchar', length: '128' }, { name: 'receiver_detail', type: 'varchar', length: '255' },
      { name: 'paid_at', type: 'datetime', isNullable: true }, { name: 'cancelled_at', type: 'datetime', isNullable: true },
      { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' }, { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
    ] }), true)
    await queryRunner.createIndex('orders', new TableIndex({ name: 'IDX_orders_user_created', columnNames: ['user_id', 'created_at'] }))
    await queryRunner.createUniqueConstraint('orders', new TableUnique({ name: 'UQ_orders_user_request', columnNames: ['user_id', 'request_id'] }))
    await queryRunner.createTable(new Table({ name: 'order_items', columns: [
      { name: 'id', type: 'varchar', length: '36', isPrimary: true }, { name: 'order_id', type: 'varchar', length: '36' }, { name: 'product_id', type: 'varchar', length: '32' },
      { name: 'name', type: 'varchar', length: '128' }, { name: 'spec', type: 'varchar', length: '128' }, { name: 'price_fen', type: 'int' }, { name: 'quantity', type: 'int' }, { name: 'img', type: 'varchar', length: '255' }, { name: 'theme_light', type: 'varchar', length: '16' },
    ] }), true)
    await queryRunner.createIndex('order_items', new TableIndex({ name: 'IDX_order_items_order_id', columnNames: ['order_id'] }))
  }
  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.dropTable('order_items'); await queryRunner.dropTable('orders') }
}
