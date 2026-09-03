import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

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
  save(record: CatalogProductRecord): Promise<CatalogProductRecord>
  saveDraftBlocks(id: string, blocks: ContentBlock[]): Promise<void>
  publishDraft(id: string): Promise<void>
}

function cloneBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return structuredClone(blocks)
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

  async save(record: CatalogProductRecord): Promise<CatalogProductRecord> {
    return toRecord(await this.repository.save(this.repository.create(toEntityInput(record))))
  }

  async saveDraftBlocks(id: string, blocks: ContentBlock[]): Promise<void> {
    const product = await this.repository.findOneBy({ id })
    if (!product) return
    product.draftBlocks = cloneBlocks(blocks) as Record<string, unknown>[]
    await this.repository.save(product)
  }

  async publishDraft(id: string): Promise<void> {
    const product = await this.repository.findOneBy({ id })
    if (!product) return
    product.blocks = cloneBlocks(product.draftBlocks as ContentBlock[]) as Record<string, unknown>[]
    product.contentVersion += 1
    await this.repository.save(product)
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

  async findAdminPage(options: { keyword?: string; isActive?: boolean; page: number; pageSize: number }): Promise<{ total: number; list: CatalogProductRecord[] }> {
    const keyword = options.keyword?.trim().toLowerCase()
    const filtered = [...this.products.values()].filter((product) =>
      (options.isActive === undefined || product.isActive === options.isActive) &&
      (!keyword || `${product.id} ${product.name} ${product.en}`.toLowerCase().includes(keyword)),
    )
    const start = (options.page - 1) * options.pageSize
    return { total: filtered.length, list: filtered.slice(start, start + options.pageSize).map((product) => structuredClone(product)) }
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

  async publishDraft(id: string): Promise<void> {
    const product = this.products.get(id)
    if (!product) return
    product.blocks = cloneBlocks(product.draftBlocks)
    product.contentVersion += 1
    product.updatedAt = new Date()
  }
}
