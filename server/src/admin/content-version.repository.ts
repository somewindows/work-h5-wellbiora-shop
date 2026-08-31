import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import type { ContentBlock } from '../catalog/catalog.types'
import { ContentVersionEntity } from './content-version.entity'

export const CONTENT_VERSION_REPOSITORY = Symbol('CONTENT_VERSION_REPOSITORY')
export interface ContentVersionRecord { id: string; productId: string; version: number; blocks: ContentBlock[]; createdBy: string; createdAt: Date }
export interface ContentVersionRepository {
  save(input: Omit<ContentVersionRecord, 'id' | 'createdAt'>): Promise<ContentVersionRecord>
  findByProduct(productId: string): Promise<ContentVersionRecord[]>
  findByProductAndVersion(productId: string, version: number): Promise<ContentVersionRecord | null>
}

@Injectable()
export class TypeOrmContentVersionRepository implements ContentVersionRepository {
  constructor(@InjectRepository(ContentVersionEntity) private readonly repository: Repository<ContentVersionEntity>) {}
  async save(input: Omit<ContentVersionRecord, 'id' | 'createdAt'>): Promise<ContentVersionRecord> {
    return this.repository.save(this.repository.create({ ...input, blocks: input.blocks as Record<string, unknown>[] })) as unknown as Promise<ContentVersionRecord>
  }
  async findByProduct(productId: string): Promise<ContentVersionRecord[]> { return (await this.repository.find({ where: { productId }, order: { version: 'ASC' } })) as unknown as ContentVersionRecord[] }
  async findByProductAndVersion(productId: string, version: number): Promise<ContentVersionRecord | null> { return await this.repository.findOneBy({ productId, version }) as unknown as ContentVersionRecord | null }
}

export class InMemoryContentVersionRepository implements ContentVersionRepository {
  private readonly versions: ContentVersionRecord[] = []
  async save(input: Omit<ContentVersionRecord, 'id' | 'createdAt'>): Promise<ContentVersionRecord> {
    const saved = { id: randomUUID(), createdAt: new Date(), ...structuredClone(input) }
    this.versions.push(saved)
    return structuredClone(saved)
  }
  async findByProduct(productId: string): Promise<ContentVersionRecord[]> { return this.versions.filter((item) => item.productId === productId).sort((a, b) => a.version - b.version).map((item) => structuredClone(item)) }
  async findByProductAndVersion(productId: string, version: number): Promise<ContentVersionRecord | null> { return structuredClone(this.versions.find((item) => item.productId === productId && item.version === version) ?? null) }
}
