import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'order_items' })
@Index(['orderId'])
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'order_id', length: 36 }) orderId!: string
  @Column({ name: 'product_id', length: 32 }) productId!: string
  @Column({ length: 128 }) name!: string
  @Column({ length: 128 }) spec!: string
  @Column({ name: 'price_fen', type: 'int' }) priceFen!: number
  @Column({ type: 'int' }) quantity!: number
  @Column({ length: 255 }) img!: string
  @Column({ name: 'theme_light', length: 16 }) themeLight!: string
}
