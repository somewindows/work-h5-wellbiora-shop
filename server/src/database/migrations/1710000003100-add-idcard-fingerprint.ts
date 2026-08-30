import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddIdcardFingerprint1710000003100 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('realname_profiles', new TableColumn({
      name: 'idcard_fingerprint', type: 'varchar', length: '64', isNullable: false,
    }))
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('realname_profiles', 'idcard_fingerprint')
  }
}
