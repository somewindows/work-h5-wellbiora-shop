import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'catalog_content_versions' })
@Index(['productId', 'version'], { unique: true })
export class ContentVersionEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'product_id', length: 32 }) productId!: string
  @Column({ type: 'int' }) version!: number
  @Column({ type: 'json' }) blocks!: Record<string, unknown>[]
  @Column({ name: 'created_by', length: 36 }) createdBy!: string
  @CreateDateColumn({ name: 'created_at', type: 'datetime' }) createdAt!: Date
}
