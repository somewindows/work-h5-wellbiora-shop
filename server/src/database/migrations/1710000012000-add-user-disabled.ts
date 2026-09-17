import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/** users 增加禁用标记列（后台会员管理：禁用/启用）。 */
export class AddUserDisabled1710000012000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({ name: 'disabled', type: 'tinyint', width: 1, isNullable: false, default: '0' }),
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'disabled')
  }
}
