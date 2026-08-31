import { HttpStatus, Inject, Injectable } from '@nestjs/common'

import { BusinessException } from '../common/business.exception'
import { CATALOG_REPOSITORY, type CatalogProductRecord, type CatalogRepository } from '../catalog/catalog.repository'
import type { ContentBlock } from '../catalog/catalog.types'

const CONTENT_BLOCK_TYPES = new Set([
  'gallery', 'image', 'badges', 'nutrition', 'nutrition_image', 'stats', 'scenario', 'text',
  'hero', 'notice_bar', 'product_rail', 'product_grid', 'image_banner', 'cert_wall', 'brand_block',
])

@Injectable()
export class AdminCatalogService {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly repository: CatalogRepository) {}

  async getProduct(id: string): Promise<CatalogProductRecord> {
    const product = await this.repository.findById(id)
    if (!product) throw new BusinessException(40404, '商品不存在', HttpStatus.NOT_FOUND)
    return product
  }

  async saveDraftBlocks(id: string, blocks: ContentBlock[]): Promise<CatalogProductRecord> {
    await this.getProduct(id)
    this.validateBlocks(blocks)
    await this.repository.saveDraftBlocks(id, blocks)
    return this.getProduct(id)
  }

  async publishDraft(id: string): Promise<CatalogProductRecord> {
    const product = await this.getProduct(id)
    this.validateBlocks(product.draftBlocks)
    await this.repository.publishDraft(id)
    return this.getProduct(id)
  }

  private validateBlocks(blocks: ContentBlock[]): void {
    for (const block of blocks) {
      if (!CONTENT_BLOCK_TYPES.has(block.type)) throw new BusinessException(42201, `不支持的内容块类型：${block.type}`, HttpStatus.UNPROCESSABLE_ENTITY)
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
}
