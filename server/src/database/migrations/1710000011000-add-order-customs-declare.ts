import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/** 复审 R10：orders 增加海关申报状态列（推仓/报关解耦后的持久化收敛依据）。 */
export class AddOrderCustomsDeclare1710000011000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'orders',
      new TableColumn({ name: 'customs_declare_status', type: 'varchar', length: '32', isNullable: true }),
    )
    await queryRunner.addColumn(
      'orders',
      new TableColumn({ name: 'customs_declared_at', type: 'datetime', isNullable: true }),
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('orders', 'customs_declared_at')
    await queryRunner.dropColumn('orders', 'customs_declare_status')
  }
}
