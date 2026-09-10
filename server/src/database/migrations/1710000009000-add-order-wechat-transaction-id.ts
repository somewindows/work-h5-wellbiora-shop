import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm'

/** orders 增加微信支付订单号列（回调幂等 + 海关报关用）。 */
export class AddOrderWechatTransactionId1710000009000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'orders',
      new TableColumn({ name: 'wechat_transaction_id', type: 'varchar', length: '64', isNullable: true }),
    )
    // MySQL 不支持 TableUnique，唯一约束用唯一索引（迁移铁律，2026-09-06）
    await queryRunner.createIndex(
      'orders',
      new TableIndex({ name: 'IDX_orders_wechat_transaction_id', columnNames: ['wechat_transaction_id'], isUnique: true }),
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('orders', 'IDX_orders_wechat_transaction_id')
    await queryRunner.dropColumn('orders', 'wechat_transaction_id')
  }
}
