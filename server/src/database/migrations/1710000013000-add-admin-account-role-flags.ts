import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/**
 * admin_accounts 增加角色与状态列（管理员账号管理）：
 * - role：super=超级管理员 / admin=普通管理员
 * - disabled：禁用标记
 * - must_change_password：强制改密标记（新建/重置密码后为 1）
 * 存量账号全部来自初始播种，up 中统一升级为 super，保证存在至少一个超级管理员。
 */
export class AddAdminAccountRoleFlags1710000013000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'admin_accounts',
      new TableColumn({ name: 'role', type: 'varchar', length: '16', isNullable: false, default: "'admin'" }),
    )
    await queryRunner.addColumn(
      'admin_accounts',
      new TableColumn({ name: 'disabled', type: 'tinyint', width: 1, isNullable: false, default: '0' }),
    )
    await queryRunner.addColumn(
      'admin_accounts',
      new TableColumn({ name: 'must_change_password', type: 'tinyint', width: 1, isNullable: false, default: '0' }),
    )
    // 存量账号即播种的初始管理员，升级为超级管理员
    await queryRunner.query("UPDATE admin_accounts SET role = 'super'")
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('admin_accounts', 'must_change_password')
    await queryRunner.dropColumn('admin_accounts', 'disabled')
    await queryRunner.dropColumn('admin_accounts', 'role')
  }
}
