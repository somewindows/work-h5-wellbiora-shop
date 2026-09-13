import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

/** 退款单账本（复审 R04/R05：退款受理≠到账需状态机收敛；稳定退款单号保证一次意图只退一次）。 */
export class CreateRefunds1710000010000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'refunds',
        columns: [
          { name: 'id', type: 'char', length: '36', isPrimary: true },
          { name: 'refund_no', type: 'varchar', length: '32' },
          { name: 'order_id', type: 'char', length: '36' },
          { name: 'order_no', type: 'varchar', length: '32' },
          { name: 'amount_fen', type: 'int' },
          { name: 'total_fen', type: 'int' },
          { name: 'status', type: 'varchar', length: '16' },
          { name: 'wechat_refund_id', type: 'varchar', length: '64', isNullable: true },
          { name: 'channel', type: 'varchar', length: '16' },
          { name: 'reason', type: 'varchar', length: '128', isNullable: true },
          { name: 'succeeded_at', type: 'datetime', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    )
    // MySQL 不支持 TableUnique，唯一约束用唯一索引（迁移铁律，2026-09-06）
    await queryRunner.createIndex('refunds', new TableIndex({ name: 'IDX_refunds_refund_no', columnNames: ['refund_no'], isUnique: true }))
    await queryRunner.createIndex('refunds', new TableIndex({ name: 'IDX_refunds_order_id', columnNames: ['order_id'] }))
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('refunds')
  }
}
