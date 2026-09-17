import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/**
 * R08 对账依据落库：orders 增加用户实付金额与支付币种两列。
 * payer_total_fen = 微信 amount.payer_total（用户实付，分）；NULL = 历史订单/未支付。
 * pay_currency = 微信 amount.currency（预期恒 CNY）；优惠额不单独建列，读取时按 total_fen - payer_total_fen 派生。
 */
export class AddOrderPayerTotal1710000014000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'orders',
      new TableColumn({ name: 'payer_total_fen', type: 'int', isNullable: true }),
    )
    await queryRunner.addColumn(
      'orders',
      new TableColumn({ name: 'pay_currency', type: 'varchar', length: '8', isNullable: true }),
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('orders', 'pay_currency')
    await queryRunner.dropColumn('orders', 'payer_total_fen')
  }
}
