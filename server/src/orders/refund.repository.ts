import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import type { Repository } from 'typeorm'

import { RefundEntity } from './refund.entity'

export const REFUND_REPOSITORY = Symbol('REFUND_REPOSITORY')

export interface RefundRecord {
  id: string
  refundNo: string
  orderId: string
  orderNo: string
  amountFen: number
  totalFen: number
  status: string
  wechatRefundId: string | null
  channel: string
  reason: string | null
  succeededAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type NewRefund = Omit<RefundRecord, 'id' | 'createdAt' | 'updatedAt'>

export interface RefundRepository {
  create(input: NewRefund): RefundRecord
  save(refund: RefundRecord): Promise<RefundRecord>
  findByRefundNo(refundNo: string): Promise<RefundRecord | null>
  findByOrderId(orderId: string): Promise<RefundRecord[]>
}

@Injectable()
export class TypeOrmRefundRepository implements RefundRepository {
  constructor(@InjectRepository(RefundEntity) private readonly repository: Repository<RefundEntity>) {}

  create(input: NewRefund): RefundEntity {
    return this.repository.create(input)
  }

  save(refund: RefundRecord): Promise<RefundEntity> {
    return this.repository.save(refund as RefundEntity)
  }

  findByRefundNo(refundNo: string): Promise<RefundEntity | null> {
    return this.repository.findOneBy({ refundNo })
  }

  findByOrderId(orderId: string): Promise<RefundEntity[]> {
    return this.repository.find({ where: { orderId }, order: { createdAt: 'ASC' } })
  }
}

export class InMemoryRefundRepository implements RefundRepository {
  private readonly refunds = new Map<string, RefundRecord>()

  create(input: NewRefund): RefundRecord {
    const now = new Date()
    return { id: randomUUID(), createdAt: now, updatedAt: now, ...input }
  }

  async save(refund: RefundRecord): Promise<RefundRecord> {
    // 贴近真实库：refund_no 唯一约束（迁移 IDX_refunds_refund_no），并发同序号撞单抛 ER_DUP_ENTRY
    const duplicate = [...this.refunds.values()].find((item) => item.refundNo === refund.refundNo && item.id !== refund.id)
    if (duplicate) throw Object.assign(new Error(`Duplicate entry '${refund.refundNo}'`), { code: 'ER_DUP_ENTRY' })
    refund.updatedAt = new Date()
    this.refunds.set(refund.id, { ...refund })
    return refund
  }

  async findByRefundNo(refundNo: string): Promise<RefundRecord | null> {
    const refund = [...this.refunds.values()].find((item) => item.refundNo === refundNo)
    return refund ? { ...refund } : null
  }

  async findByOrderId(orderId: string): Promise<RefundRecord[]> {
    return [...this.refunds.values()]
      .filter((refund) => refund.orderId === orderId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((refund) => ({ ...refund }))
  }
}
