import { HttpStatus, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { type EntityManager, Repository } from 'typeorm'
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'

import { BusinessException } from '../common/business.exception'

import type { ContentBlock, Product, ProductDetail } from './catalog.types'
import { CatalogProductEntity } from './catalog-product.entity'

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY')

export interface CatalogProductRecord extends ProductDetail {
  draftBlocks: ContentBlock[]
  contentVersion: number
  isActive: boolean
  goodsNo: string | null
  warehouseCode: string | null
  createdAt: Date
  updatedAt: Date
}

/** 加购/下单链路所需的只读商品视图：价格与上下架状态以 catalog 当前记录为准。 */
export interface SellableProductSource {
  findById(id: string): Promise<CatalogProductRecord | null>
}

export interface CatalogRepository extends SellableProductSource {
  count(): Promise<number>
  seed(products: ProductDetail[]): Promise<void>
  findAllPublished(): Promise<Product[]>
  findPublishedById(id: string): Promise<ProductDetail | null>
  findById(id: string): Promise<CatalogProductRecord | null>
  findAdminPage(options: { keyword?: string; isActive?: boolean; page: number; pageSize: number }): Promise<{ total: number; list: CatalogProductRecord[] }>
  /** 生成下一个商品 ID：WB + 5 位递增数字，取 10001 起最小未占用的编号（删除商品后编号可回收复用） */
  nextProductId(): Promise<string>
  /**
   * 复审 R15：insert-only 语义插入新商品——主键已存在必须报 ER_DUP_ENTRY，
   * 禁止 save() 的静默 upsert 覆盖先创建的商品；与 nextProductId 组成「分配 + 插入」冲突重试闭环。
   */
  insertProduct(record: CatalogProductRecord): Promise<CatalogProductRecord>
  save(record: CatalogProductRecord): Promise<CatalogProductRecord>
  saveDraftBlocks(id: string, blocks: ContentBlock[]): Promise<void>
  /**
   * 复审 R15：条件发布——仅当当前 contentVersion 与草稿内容均和服务层已校验快照一致时才发布
   * （TypeOrm 在事务内悲观锁行重读校验），不一致抛 40002「草稿已变更，请刷新后重新发布」。
   * 与历史快照写入一起放进 runInTransaction，任一步失败整体回滚不留半成品。
   */
  publishDraft(id: string, expected: { contentVersion: number; draftBlocks: ContentBlock[] }, manager?: EntityManager): Promise<void>
  /**
   * 复审 R15：条件回滚——仅当当前 contentVersion 与预期一致时才回滚到 target 内容，
   * 不一致抛 40002「发布版本已变更，请刷新后重试」（并发回滚/发布落败让位，不用旧对象覆盖）。
   */
  rollbackToVersion(id: string, expectedContentVersion: number, target: ContentBlock[], manager?: EntityManager): Promise<void>
  /** 复审 R15：发布/回滚的多写放进同一事务；内存实现以快照兜底恢复（仅覆盖本仓储） */
  runInTransaction<T>(work: (manager?: EntityManager) => Promise<T>): Promise<T>
}

function computeNextProductId(ids: string[]): string {
  const used = new Set(ids)
  for (let n = 10001; ; n++) {
    const id = `WB${String(n).padStart(5, '0')}`
    if (!used.has(id)) return id
  }
}

function cloneBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return structuredClone(blocks)
}

/** 复审 R15：内容摘要比对——键序无关的规范化序列化（MySQL JSON 会做键序归一化，显式规范化更稳） */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function sameBlocks(left: ContentBlock[], right: ContentBlock[]): boolean {
  return canonicalJson(left) === canonicalJson(right)
}

function toPublicProduct(record: CatalogProductRecord): Product {
  return {
    id: record.id,
    name: record.name,
    en: record.en,
    priceFen: record.priceFen,
    theme: record.theme,
    themeLight: record.themeLight,
    cardImg: record.cardImg,
    tags: [...record.tags],
    spec: record.spec,
    ...(record.flavor ? { flavor: record.flavor } : {}),
    ingredients: record.ingredients,
    originCert: record.originCert,
    ...(record.usage ? { usage: record.usage } : {}),
  }
}

function toPublicDetail(record: CatalogProductRecord): ProductDetail {
  return {
    ...toPublicProduct(record),
    complianceText: record.complianceText,
    blocks: cloneBlocks(record.blocks).filter((block) => block.hidden !== true),
  }
}

function toRecord(entity: CatalogProductEntity): CatalogProductRecord {
  return {
    ...entity,
    flavor: entity.flavor ?? undefined,
    usage: entity.usage ?? undefined,
    blocks: entity.blocks as ContentBlock[],
    draftBlocks: entity.draftBlocks as ContentBlock[],
  }
}

function toEntityInput(record: CatalogProductRecord): Omit<CatalogProductEntity, 'createdAt' | 'updatedAt'> {
  return {
    ...record,
    flavor: record.flavor ?? null,
    usage: record.usage ?? null,
    blocks: record.blocks as Record<string, unknown>[],
    draftBlocks: record.draftBlocks as Record<string, unknown>[],
  }
}

function toSeedRecord(product: ProductDetail): CatalogProductRecord {
  const now = new Date()
  return {
    ...product,
    blocks: cloneBlocks(product.blocks),
    draftBlocks: cloneBlocks(product.blocks),
    contentVersion: 1,
    isActive: true,
    goodsNo: null,
    warehouseCode: null,
    createdAt: now,
    updatedAt: now,
  }
}

@Injectable()
export class TypeOrmCatalogRepository implements CatalogRepository {
  constructor(@InjectRepository(CatalogProductEntity) private readonly repository: Repository<CatalogProductEntity>) {}

  count(): Promise<number> {
    return this.repository.count()
  }

  async seed(products: ProductDetail[]): Promise<void> {
    await this.repository.save(products.map((product) => this.repository.create(toEntityInput(toSeedRecord(product)))))
  }

  async findAllPublished(): Promise<Product[]> {
    return (await this.repository.find({ where: { isActive: true }, order: { id: 'ASC' } })).map((item) => toPublicProduct(toRecord(item)))
  }

  async findPublishedById(id: string): Promise<ProductDetail | null> {
    const product = await this.repository.findOneBy({ id, isActive: true })
    return product ? toPublicDetail(toRecord(product)) : null
  }

  async findById(id: string): Promise<CatalogProductRecord | null> {
    const product = await this.repository.findOneBy({ id })
    return product ? toRecord(product) : null
  }

  async nextProductId(): Promise<string> {
    const rows = await this.repository.find({ select: { id: true } })
    return computeNextProductId(rows.map((row) => row.id))
  }

  async findAdminPage(options: { keyword?: string; isActive?: boolean; page: number; pageSize: number }): Promise<{ total: number; list: CatalogProductRecord[] }> {
    const all = (await this.repository.find({ order: { updatedAt: 'DESC' } })).map(toRecord)
    const keyword = options.keyword?.trim().toLowerCase()
    const filtered = all.filter((product) =>
      (options.isActive === undefined || product.isActive === options.isActive) &&
      (!keyword || `${product.id} ${product.name} ${product.en}`.toLowerCase().includes(keyword)),
    )
    const start = (options.page - 1) * options.pageSize
    return { total: filtered.length, list: filtered.slice(start, start + options.pageSize) }
  }

  async insertProduct(record: CatalogProductRecord): Promise<CatalogProductRecord> {
    // 复审 R15：insert-only——主键已存在必须报 ER_DUP_ENTRY（save() 会按主键静默 upsert 覆盖先创建的商品）
    await this.repository.insert(toEntityInput(record) as QueryDeepPartialEntity<CatalogProductEntity>)
    return record
  }

  async save(record: CatalogProductRecord): Promise<CatalogProductRecord> {
    return toRecord(await this.repository.save(this.repository.create(toEntityInput(record))))
  }

  async saveDraftBlocks(id: string, blocks: ContentBlock[]): Promise<void> {
    const product = await this.repository.findOneBy({ id })
    if (!product) return
    product.draftBlocks = cloneBlocks(blocks) as Record<string, unknown>[]
    await this.repository.save(product)
  }

  async publishDraft(id: string, expected: { contentVersion: number; draftBlocks: ContentBlock[] }, manager?: EntityManager): Promise<void> {
    const product = await this.findForUpdate(id, manager)
    if (!product) throw new BusinessException(40404, '商品不存在', HttpStatus.NOT_FOUND)
    // 复审 R15：条件发布——服务层校验完成后草稿若被另一次保存替换（或并发发布已推进版本），拒绝发布
    if (product.contentVersion !== expected.contentVersion || !sameBlocks(product.draftBlocks as ContentBlock[], expected.draftBlocks)) {
      throw new BusinessException(40002, '草稿已变更，请刷新后重新发布')
    }
    product.blocks = cloneBlocks(product.draftBlocks as ContentBlock[]) as Record<string, unknown>[]
    product.contentVersion += 1
    await this.persist(product, manager)
  }

  async rollbackToVersion(id: string, expectedContentVersion: number, target: ContentBlock[], manager?: EntityManager): Promise<void> {
    const product = await this.findForUpdate(id, manager)
    if (!product) throw new BusinessException(40404, '商品不存在', HttpStatus.NOT_FOUND)
    // 复审 R15：条件回滚——并发回滚/发布已推进版本时落败让位
    if (product.contentVersion !== expectedContentVersion) {
      throw new BusinessException(40002, '发布版本已变更，请刷新后重试')
    }
    product.blocks = cloneBlocks(target) as Record<string, unknown>[]
    product.draftBlocks = cloneBlocks(target) as Record<string, unknown>[]
    product.contentVersion += 1
    await this.persist(product, manager)
  }

  runInTransaction<T>(work: (manager?: EntityManager) => Promise<T>): Promise<T> {
    return this.repository.manager.transaction(work)
  }

  /** 事务内 pessimistic_write 行锁（SELECT ... FOR UPDATE）串行化「校验 + 写入」；无事务时普通读取 */
  private findForUpdate(id: string, manager?: EntityManager): Promise<CatalogProductEntity | null> {
    return manager
      ? manager.getRepository(CatalogProductEntity).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } })
      : this.repository.findOneBy({ id })
  }

  private persist(product: CatalogProductEntity, manager?: EntityManager): Promise<CatalogProductEntity> {
    return manager ? manager.save(product) : this.repository.save(product)
  }
}

export class InMemoryCatalogRepository implements CatalogRepository {
  private readonly products = new Map<string, CatalogProductRecord>()

  async count(): Promise<number> {
    return this.products.size
  }

  async seed(products: ProductDetail[]): Promise<void> {
    for (const product of products) this.products.set(product.id, toSeedRecord(product))
  }

  async findAllPublished(): Promise<Product[]> {
    return [...this.products.values()].filter((product) => product.isActive).map(toPublicProduct)
  }

  async findPublishedById(id: string): Promise<ProductDetail | null> {
    const product = this.products.get(id)
    return product?.isActive ? toPublicDetail(product) : null
  }

  async findById(id: string): Promise<CatalogProductRecord | null> {
    const product = this.products.get(id)
    return product ? structuredClone(product) : null
  }

  async nextProductId(): Promise<string> {
    return computeNextProductId([...this.products.keys()])
  }

  async findAdminPage(options: { keyword?: string; isActive?: boolean; page: number; pageSize: number }): Promise<{ total: number; list: CatalogProductRecord[] }> {
    const keyword = options.keyword?.trim().toLowerCase()
    const filtered = [...this.products.values()].filter((product) =>
      (options.isActive === undefined || product.isActive === options.isActive) &&
      (!keyword || `${product.id} ${product.name} ${product.en}`.toLowerCase().includes(keyword)),
    )
    const start = (options.page - 1) * options.pageSize
    return { total: filtered.length, list: filtered.slice(start, start + options.pageSize).map((product) => structuredClone(product)) }
  }

  async insertProduct(record: CatalogProductRecord): Promise<CatalogProductRecord> {
    // 复审 R15：insert-only——key 已存在视为冲突抛 ER_DUP_ENTRY，禁止 Map.set 覆盖已有条目；
    // 检查与写入在同步段内原子完成（之间不插入 await）
    if (this.products.has(record.id)) {
      throw Object.assign(new Error(`Duplicate entry '${record.id}' for key 'PRIMARY'`), { code: 'ER_DUP_ENTRY' })
    }
    const saved = structuredClone({ ...record, updatedAt: new Date() })
    this.products.set(saved.id, saved)
    return structuredClone(saved)
  }

  async save(record: CatalogProductRecord): Promise<CatalogProductRecord> {
    const saved = structuredClone({ ...record, updatedAt: new Date() })
    this.products.set(saved.id, saved)
    return structuredClone(saved)
  }

  async saveDraftBlocks(id: string, blocks: ContentBlock[]): Promise<void> {
    const product = this.products.get(id)
    if (!product) return
    product.draftBlocks = cloneBlocks(blocks)
    product.updatedAt = new Date()
  }

  async publishDraft(id: string, expected: { contentVersion: number; draftBlocks: ContentBlock[] }): Promise<void> {
    // 复审 R15：镜像条件发布语义——校验与写入在同步段内原子完成
    const product = this.products.get(id)
    if (!product) throw new BusinessException(40404, '商品不存在', HttpStatus.NOT_FOUND)
    if (product.contentVersion !== expected.contentVersion || !sameBlocks(product.draftBlocks, expected.draftBlocks)) {
      throw new BusinessException(40002, '草稿已变更，请刷新后重新发布')
    }
    product.blocks = cloneBlocks(product.draftBlocks)
    product.contentVersion += 1
    product.updatedAt = new Date()
  }

  async rollbackToVersion(id: string, expectedContentVersion: number, target: ContentBlock[]): Promise<void> {
    // 复审 R15：镜像条件回滚语义——校验与写入在同步段内原子完成
    const product = this.products.get(id)
    if (!product) throw new BusinessException(40404, '商品不存在', HttpStatus.NOT_FOUND)
    if (product.contentVersion !== expectedContentVersion) {
      throw new BusinessException(40002, '发布版本已变更，请刷新后重试')
    }
    product.blocks = cloneBlocks(target)
    product.draftBlocks = cloneBlocks(target)
    product.contentVersion += 1
    product.updatedAt = new Date()
  }

  async runInTransaction<T>(work: (manager?: EntityManager) => Promise<T>): Promise<T> {
    // 内存无事务：快照兜底，work 抛错时恢复本仓储状态，镜像「多写同事务整体回滚」语义
    const backup = new Map([...this.products.entries()].map(([id, product]) => [id, structuredClone(product)]))
    try {
      return await work()
    } catch (error) {
      this.products.clear()
      for (const [id, product] of backup) this.products.set(id, product)
      throw error
    }
  }
}
