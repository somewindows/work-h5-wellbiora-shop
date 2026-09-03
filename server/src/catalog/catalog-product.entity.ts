import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'catalog_products' })
export class CatalogProductEntity {
  @PrimaryColumn({ length: 32 })
  id!: string

  @Column({ length: 128 })
  name!: string

  @Column({ length: 128 })
  en!: string

  @Column({ name: 'price_fen', type: 'int' })
  priceFen!: number

  @Column({ length: 16 })
  theme!: string

  @Column({ name: 'theme_light', length: 16 })
  themeLight!: string

  @Column({ name: 'card_img', length: 255 })
  cardImg!: string

  @Column({ type: 'json' })
  tags!: string[]

  @Column({ length: 128 })
  spec!: string

  @Column({ length: 128, nullable: true })
  flavor!: string | null

  @Column({ type: 'text' })
  ingredients!: string

  @Column({ name: 'origin_cert', length: 255 })
  originCert!: string

  @Column({ type: 'text', nullable: true })
  usage!: string | null

  @Column({ name: 'compliance_text', type: 'text' })
  complianceText!: string

  @Column({ type: 'json' })
  blocks!: Record<string, unknown>[]

  @Column({ name: 'draft_blocks', type: 'json' })
  draftBlocks!: Record<string, unknown>[]

  @Column({ name: 'content_version', type: 'int', default: 1 })
  contentVersion!: number

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean

  @Column({ name: 'goods_no', length: 64, nullable: true })
  goodsNo!: string | null

  @Column({ name: 'warehouse_code', length: 64, nullable: true })
  warehouseCode!: string | null

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
