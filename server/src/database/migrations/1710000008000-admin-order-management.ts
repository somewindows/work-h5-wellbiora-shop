import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm'

export class AdminOrderManagement1710000008000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('orders', [
      new TableColumn({ name: 'system_remark', type: 'text', isNullable: true }),
      new TableColumn({ name: 'refund_fen', type: 'int', isNullable: true }),
      new TableColumn({ name: 'refunded_at', type: 'datetime', isNullable: true }),
    ])
    await queryRunner.createTable(
      new Table({
        name: 'order_status_events',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'order_id', type: 'varchar', length: '36' },
          { name: 'from_status', type: 'varchar', length: '16', isNullable: true },
          { name: 'to_status', type: 'varchar', length: '16' },
          { name: 'source', type: 'varchar', length: '16' },
          { name: 'remark', type: 'varchar', length: '255', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    )
    await queryRunner.createIndex('order_status_events', new TableIndex({ name: 'IDX_order_status_events_order_created', columnNames: ['order_id', 'created_at'] }))
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('order_status_events')
    await queryRunner.dropColumn('orders', 'refunded_at')
    await queryRunner.dropColumn('orders', 'refund_fen')
    await queryRunner.dropColumn('orders', 'system_remark')
  }
}
