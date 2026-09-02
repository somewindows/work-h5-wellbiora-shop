import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 订单状态历史：记录本地主状态每次变更的来源（用户/管理员/状态同步/系统）。 */
@Entity({ name: 'order_status_events' })
@Index(['orderId', 'createdAt'])
export class OrderStatusEventEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'order_id', length: 36 }) orderId!: string
  @Column({ name: 'from_status', length: 16, nullable: true }) fromStatus!: string | null
  @Column({ name: 'to_status', length: 16 }) toStatus!: string
  /** user / admin / sync / system */
  @Column({ length: 16 }) source!: string
  @Column({ length: 255, nullable: true }) remark!: string | null
  @CreateDateColumn({ name: 'created_at', type: 'datetime' }) createdAt!: Date
}
