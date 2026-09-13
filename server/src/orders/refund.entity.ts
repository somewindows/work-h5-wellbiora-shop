import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

/**
 * 退款单账本（复审 R04/R05）：每一次退款意图一行，退款单号发起前落库且终身复用。
 * status：processing 已受理在途 / success 已到账 / abnormal 异常 / closed 已关闭 / failed 通道未受理（可安全重新发起）
 * channel：admin 后台发起 / platform 微信商户平台发起（由退款回调补登）
 */
@Entity({ name: 'refunds' })
@Index(['orderId'])
export class RefundEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  /** 业务退款单号（微信 out_refund_no）：R + 订单号(22) + 2 位序号，≤32 位 */
  @Column({ name: 'refund_no', length: 32, unique: true }) refundNo!: string
  @Column({ name: 'order_id', length: 36 }) orderId!: string
  @Column({ name: 'order_no', length: 32 }) orderNo!: string
  /** 本次申请退款金额（分） */
  @Column({ name: 'amount_fen', type: 'int' }) amountFen!: number
  /** 发起时原订单实付快照（分），微信退款接口要求回传 */
  @Column({ name: 'total_fen', type: 'int' }) totalFen!: number
  @Column({ length: 16 }) status!: string
  /** 微信退款单号（refund_id），受理后回填 */
  @Column({ name: 'wechat_refund_id', type: 'varchar', length: 64, nullable: true }) wechatRefundId!: string | null
  @Column({ length: 16 }) channel!: string
  @Column({ type: 'varchar', length: 128, nullable: true }) reason!: string | null
  @Column({ name: 'succeeded_at', type: 'datetime', nullable: true }) succeededAt!: Date | null
  @CreateDateColumn({ name: 'created_at', type: 'datetime' }) createdAt!: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' }) updatedAt!: Date
}
