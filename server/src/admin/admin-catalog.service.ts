import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import type { EntityManager } from 'typeorm'

import { BusinessException } from '../common/business.exception'
import { CATALOG_REPOSITORY, type CatalogProductRecord, type CatalogRepository } from '../catalog/catalog.repository'
import type { ContentBlock } from '../catalog/catalog.types'

import { type AdminActor, AuditLogService } from './audit-log.service'
import { CONTENT_VERSION_REPOSITORY, type ContentVersionRepository } from './content-version.repository'
import type { AdminProductQueryDto } from './dto/admin-product-query.dto'
import type { CreateAdminProductDto } from './dto/create-admin-product.dto'
import type { UpdateAdminProductDto } from './dto/update-admin-product.dto'
const CONTENT_BLOCK_TYPES = new Set([
  'gallery', 'image', 'badges', 'nutrition', 'nutrition_image', 'stats', 'scenario', 'text',
  'hero', 'notice_bar', 'product_rail', 'product_grid', 'image_banner', 'cert_wall', 'brand_block',
])

/** 复审 R15：商品编号「分配 + 插入」冲突重试上限（并发创建撞相同最小空号时重新分配） */
const MAX_PRODUCT_ID_ATTEMPTS = 5

@Injectable()
export class AdminCatalogService {
  private readonly logger = new Logger(AdminCatalogService.name)

  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repository: CatalogRepository,
    @Inject(CONTENT_VERSION_REPOSITORY) private readonly history: ContentVersionRepository,
    private readonly audit: AuditLogService,
  ) {}

  async getProduct(id: string): Promise<CatalogProductRecord> {
    const product = await this.repository.findById(id)
    if (!product) throw new BusinessException(40404, '商品不存在', HttpStatus.NOT_FOUND)
    return product
  }

  listProducts(query: AdminProductQueryDto): Promise<{ total: number; list: CatalogProductRecord[] }> {
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20))
    return this.repository.findAdminPage({ keyword: query.keyword, isActive: query.isActive, page, pageSize })
  }

  async createProduct(dto: CreateAdminProductDto, actor: AdminActor): Promise<CatalogProductRecord> {
    // 复审 R15：「分配最小空号 + 插入」冲突重试闭环——并发创建会拿到相同空号，
    // insert-only 语义撞唯一键（ER_DUP_ENTRY）后重新分配重试；禁止 save() 静默 upsert 覆盖先创建的商品。
    // 「最小空闲编号可复用」业务规则不变
    for (let attempt = 1; attempt <= MAX_PRODUCT_ID_ATTEMPTS; attempt++) {
      const id = await this.repository.nextProductId()
      const now = new Date()
      try {
        const saved = await this.repository.insertProduct({
          id,
          name: dto.name.trim(),
          en: dto.en.trim(),
          priceFen: dto.priceFen,
          theme: dto.theme,
          themeLight: dto.themeLight,
          cardImg: dto.cardImg,
          tags: dto.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
          spec: dto.spec,
          flavor: dto.flavor?.trim() || undefined,
          ingredients: dto.ingredients,
          originCert: dto.originCert,
          usage: dto.usage?.trim() || undefined,
          complianceText: dto.complianceText,
          blocks: [],
          draftBlocks: [],
          contentVersion: 0,
          isActive: false,
          goodsNo: null,
          warehouseCode: null,
          createdAt: now,
          updatedAt: now,
        })
        if (attempt > 1) this.logger.warn(`新建商品编号冲突重试后分配成功：第 ${attempt} 次分配到 ${saved.id}`)
        await this.audit.record(actor, 'create_product', 'catalog_product', saved.id, null, this.toAuditProduct(saved))
        return saved
      } catch (error) {
        if ((error as { code?: string }).code !== 'ER_DUP_ENTRY') throw error
        this.logger.warn(`新建商品编号 ${id} 撞唯一键冲突（第 ${attempt}/${MAX_PRODUCT_ID_ATTEMPTS} 次），重新分配`)
      }
    }
    throw new BusinessException(40002, '商品编号分配冲突，请稍后重试')
  }

  async updateProduct(id: string, dto: UpdateAdminProductDto, actor: AdminActor): Promise<CatalogProductRecord> {
    const product = await this.getProduct(id)
    // class-transformer 会把未提交的可选字段初始化为 undefined 的自有属性，直接展开会覆盖原值，先剔除
    const updates = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)) as UpdateAdminProductDto
    const saved = await this.repository.save({
      ...product,
      ...updates,
      tags: updates.tags?.map((tag) => tag.trim()).filter(Boolean) ?? product.tags,
      flavor: updates.flavor === undefined ? product.flavor : updates.flavor.trim() || undefined,
      usage: updates.usage === undefined ? product.usage : updates.usage.trim() || undefined,
      goodsNo: updates.goodsNo === undefined ? product.goodsNo : updates.goodsNo.trim() || null,
      warehouseCode: updates.warehouseCode === undefined ? product.warehouseCode : updates.warehouseCode.trim() || null,
    })
    await this.audit.record(actor, 'update_product', 'catalog_product', id, this.toAuditProduct(product), this.toAuditProduct(saved))
    return saved
  }

  async saveDraftBlocks(id: string, blocks: ContentBlock[]): Promise<CatalogProductRecord> {
    await this.getProduct(id)
    this.validateDraftBlocks(blocks)
    await this.repository.saveDraftBlocks(id, blocks)
    return this.getProduct(id)
  }

  async publishDraft(id: string, actor: AdminActor): Promise<CatalogProductRecord> {
    const product = await this.getProduct(id)
    this.validateBlocks(product.draftBlocks)
    // 复审 R15：条件发布——把已校验的草稿快照 + 期望版本传入仓储，事务内锁行重读校验，
    // 期间草稿被另一次保存替换（或并发发布已推进版本）则整体回滚并提示；
    // 发布主记录 + 历史快照（旧版兜底 + 新版）同事务，任一步失败不留半成品
    await this.repository.runInTransaction(async (manager) => {
      await this.repository.publishDraft(id, { contentVersion: product.contentVersion, draftBlocks: product.draftBlocks }, manager)
      await this.saveVersionIfMissing(id, product.contentVersion, product.blocks, actor.id, manager)
      await this.saveVersionIfMissing(id, product.contentVersion + 1, product.draftBlocks, actor.id, manager)
    })
    const published = await this.getProduct(id)
    await this.audit.record(actor, 'publish', 'catalog_product', id, product.blocks, published.blocks)
    return published
  }

  async rollback(id: string, actor: AdminActor): Promise<CatalogProductRecord> {
    const product = await this.getProduct(id)
    const previous = product.contentVersion > 1
      ? await this.history.findByProductAndVersion(id, product.contentVersion - 1)
      : null
    if (!previous) throw new BusinessException(40002, '没有可回滚的上一发布版本')
    // 复审 R15：条件回滚——并发回滚/发布推进版本后落败方抛错让位；主记录与新版本快照同事务
    await this.repository.runInTransaction(async (manager) => {
      await this.repository.rollbackToVersion(id, product.contentVersion, previous.blocks, manager)
      await this.history.save({ productId: id, version: product.contentVersion + 1, blocks: previous.blocks, createdBy: actor.id }, manager)
    })
    const saved = await this.getProduct(id)
    await this.audit.record(
      actor, 'rollback', 'catalog_product', id,
      { contentVersion: product.contentVersion, blocks: product.blocks },
      { contentVersion: saved.contentVersion, blocks: saved.blocks },
    )
    return saved
  }

  /** 草稿只校验块结构基本完整（对象 + 合法 type），允许保存半成品；完整校验在发布时进行。 */
  private validateDraftBlocks(blocks: ContentBlock[]): void {
    for (const block of blocks) {
      if (!block || typeof block !== 'object' || typeof block.type !== 'string') {
        throw new BusinessException(42201, '内容块缺少 type 字段', HttpStatus.UNPROCESSABLE_ENTITY)
      }
      if (!CONTENT_BLOCK_TYPES.has(block.type)) {
        throw new BusinessException(42201, `不支持的内容块类型：${block.type}`, HttpStatus.UNPROCESSABLE_ENTITY)
      }
    }
  }

  private validateBlocks(blocks: ContentBlock[]): void {
    this.validateDraftBlocks(blocks)
    for (const block of blocks) {
      this.validateRequiredFields(block)
      if (this.hasClaimMarker(block) && !this.isNonEmptyString(block.note)) {
        throw new BusinessException(42201, '带 * 的数据宣称必须填写来源脚注', HttpStatus.UNPROCESSABLE_ENTITY)
      }
    }
  }

  private validateRequiredFields(block: ContentBlock): void {
    switch (block.type) {
      case 'gallery':
        this.requireStringArray(block.images, 'gallery 内容块至少需要一张图片')
        return
      case 'image':
      case 'nutrition_image':
        this.requireString(block.src, `${block.type} 内容块缺少图片地址`)
        return
      case 'badges':
        this.requireString(block.title, 'badges 内容块缺少标题')
        this.requireStringArray(block.items, 'badges 内容块至少需要一项')
        return
      case 'nutrition':
        this.requireString(block.title, 'nutrition 内容块缺少标题')
        this.requireString(block.meta, 'nutrition 内容块缺少说明')
        this.requireStringArray(block.head, 'nutrition 内容块缺少表头')
        if (!Array.isArray(block.rows) || block.rows.some((row) => !Array.isArray(row) || row.some((cell) => !this.isNonEmptyString(cell)))) {
          throw new BusinessException(42201, 'nutrition 内容块缺少有效表格行', HttpStatus.UNPROCESSABLE_ENTITY)
        }
        this.requireString(block.note, 'nutrition 内容块缺少说明脚注')
        return
      case 'stats':
        if (!Array.isArray(block.items) || block.items.length === 0 || block.items.some((item) => !this.isStatsItem(item))) {
          throw new BusinessException(42201, 'stats 内容块缺少有效数据项', HttpStatus.UNPROCESSABLE_ENTITY)
        }
        return
      case 'scenario':
        this.requireString(block.title, 'scenario 内容块缺少标题')
        this.requireStringArray(block.items, 'scenario 内容块至少需要一项')
        return
      case 'text':
        this.requireString(block.body, 'text 内容块缺少正文')
        return
      case 'hero':
        this.requireString(block.kick, 'hero 内容块缺少英文引导语')
        this.requireString(block.title, 'hero 内容块缺少标题')
        return
      case 'notice_bar':
        this.requireString(block.text, 'notice_bar 内容块缺少文案')
        return
      case 'product_rail':
        this.requireString(block.title, 'product_rail 内容块缺少标题')
        this.requireString(block.en, 'product_rail 内容块缺少英文标题')
        this.requireStringArray(block.productIds, 'product_rail 内容块至少需要一个商品')
        return
      case 'product_grid':
        this.requireStringArray(block.productIds, 'product_grid 内容块至少需要一个商品')
        return
      case 'image_banner':
        this.requireString(block.src, 'image_banner 内容块缺少图片地址')
        return
      case 'cert_wall':
        if (!Array.isArray(block.items) || block.items.length === 0 || block.items.some((item) => !this.isIconLabelItem(item))) {
          throw new BusinessException(42201, 'cert_wall 内容块缺少有效图标项', HttpStatus.UNPROCESSABLE_ENTITY)
        }
        return
      case 'brand_block':
        this.requireString(block.kick, 'brand_block 内容块缺少英文引导语')
        this.requireString(block.title, 'brand_block 内容块缺少标题')
        this.requireString(block.desc, 'brand_block 内容块缺少正文')
    }
  }

  private hasClaimMarker(block: ContentBlock): boolean {
    return Object.entries(block).some(([key, value]) => key !== 'note' && this.valueHasClaimMarker(value))
  }

  private valueHasClaimMarker(value: unknown): boolean {
    if (typeof value === 'string') return value.includes('*')
    if (Array.isArray(value)) return value.some((item) => this.valueHasClaimMarker(item))
    if (value && typeof value === 'object') return Object.values(value).some((item) => this.valueHasClaimMarker(item))
    return false
  }

  private isStatsItem(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false
    const item = value as Record<string, unknown>
    return this.isNonEmptyString(item.n) && typeof item.unit === 'string' && this.isNonEmptyString(item.l) && this.isNonEmptyString(item.d)
  }

  private isIconLabelItem(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false
    const item = value as Record<string, unknown>
    return this.isNonEmptyString(item.icon) && this.isNonEmptyString(item.label)
  }

  private requireString(value: unknown, message: string): void {
    if (!this.isNonEmptyString(value)) throw new BusinessException(42201, message, HttpStatus.UNPROCESSABLE_ENTITY)
  }

  private requireStringArray(value: unknown, message: string): void {
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => !this.isNonEmptyString(item))) {
      throw new BusinessException(42201, message, HttpStatus.UNPROCESSABLE_ENTITY)
    }
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
  }

  private toAuditProduct(product: CatalogProductRecord): Record<string, unknown> {
    const { id, name, en, priceFen, theme, themeLight, cardImg, tags, spec, flavor, ingredients, originCert, usage, goodsNo, warehouseCode, isActive } = product
    return { id, name, en, priceFen, theme, themeLight, cardImg, tags, spec, flavor, ingredients, originCert, usage, goodsNo, warehouseCode, isActive }
  }

  private async saveVersionIfMissing(productId: string, version: number, blocks: ContentBlock[], createdBy: string, manager?: EntityManager): Promise<void> {
    const existing = await this.history.findByProductAndVersion(productId, version)
    if (!existing) await this.history.save({ productId, version, blocks, createdBy }, manager)
  }
}
