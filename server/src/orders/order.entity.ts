import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'orders' })
@Unique(['userId', 'requestId'])
@Index(['userId', 'createdAt'])
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'order_no', length: 32, unique: true }) orderNo!: string
  @Column({ name: 'user_id', length: 36 }) userId!: string
  @Column({ name: 'request_id', length: 64 }) requestId!: string
  @Column({ length: 16 }) status!: string
  @Column({ name: 'payment_status', length: 16 }) paymentStatus!: string
  @Column({ name: 'warehouse_status', length: 64, nullable: true }) warehouseStatus!: string | null
  @Column({ name: 'total_fen', type: 'int' }) totalFen!: number
  @Column({ name: 'realname_name', length: 20 }) realnameName!: string
  @Column({ name: 'idcard_encrypted', type: 'text' }) idcardEncrypted!: string
  @Column({ name: 'idcard_fingerprint', length: 64 }) idcardFingerprint!: string
  @Column({ name: 'receiver_name', length: 20 }) receiverName!: string
  @Column({ name: 'receiver_phone', length: 11 }) receiverPhone!: string
  @Column({ name: 'receiver_region', length: 128 }) receiverRegion!: string
  @Column({ name: 'receiver_detail', length: 255 }) receiverDetail!: string
  @Column({ name: 'paid_at', type: 'datetime', nullable: true }) paidAt!: Date | null
  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true }) cancelledAt!: Date | null
  @CreateDateColumn({ name: 'created_at', type: 'datetime' }) createdAt!: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' }) updatedAt!: Date
}
