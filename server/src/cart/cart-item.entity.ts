import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'cart_items' })
@Unique(['userId', 'productId'])
@Index(['userId'])
export class CartItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', length: 36 })
  userId!: string

  @Column({ name: 'product_id', length: 32 })
  productId!: string

  @Column({ type: 'int' })
  quantity!: number

  @Column({ type: 'boolean', default: true })
  checked!: boolean

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
