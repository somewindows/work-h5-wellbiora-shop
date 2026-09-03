import { plainToInstance } from 'class-transformer'

import { InMemoryCatalogRepository } from '../catalog/catalog.repository'
import type { ProductDetail } from '../catalog/catalog.types'

import { AdminCatalogService } from './admin-catalog.service'
import { InMemoryAuditLogRepository } from './audit-log.repository'
import { AuditLogService } from './audit-log.service'
import { InMemoryContentVersionRepository } from './content-version.repository'
import { CreateAdminProductDto } from './dto/create-admin-product.dto'
import { UpdateAdminProductDto } from './dto/update-admin-product.dto'

describe('AdminCatalogService', () => {
  const actor = { id: 'admin-1', username: 'operator' }
  const product: ProductDetail = {
    id: 'WB10001', name: '测试商品', en: 'Test product', priceFen: 100,
    theme: '#000000', themeLight: '#FFFFFF', cardImg: '/assets/test.jpg', tags: [],
    spec: '1 件', ingredients: '测试成分', originCert: '测试产地',
    blocks: [{ type: 'gallery', images: ['/assets/test.jpg'] }],
    complianceText: '固定合规声明',
  }

  const createService = async (products: ProductDetail[] = [product]) => {
    const repository = new InMemoryCatalogRepository()
    const versions = new InMemoryContentVersionRepository()
    const auditLogs = new InMemoryAuditLogRepository()
    await repository.seed(products)
    const service = new AdminCatalogService(repository, versions, new AuditLogService(auditLogs))
    return { service, repository, versions, auditLogs }
  }

  it('草稿允许保存缺脚注的半成品，发布时才拒绝没有来源脚注的星号数据宣称', async () => {
    const { service } = await createService()
    const blocks = [{
      type: 'stats',
      items: [{ n: '4', unit: 'x', l: '吸收利用提升*', d: 'BIOAVAILABILITY' }],
    }]

    await expect(service.saveDraftBlocks('WB10001', blocks)).resolves.toMatchObject({ id: 'WB10001' })
    await expect(service.publishDraft('WB10001', actor)).rejects.toMatchObject({ code: 42201 })
  })

  it('草稿允许保存缺少必填字段的半成品，发布时才校验必填', async () => {
    const { service } = await createService()

    await expect(service.saveDraftBlocks('WB10001', [{ type: 'image' }])).resolves.toMatchObject({ id: 'WB10001' })
    await expect(service.publishDraft('WB10001', actor)).rejects.toMatchObject({ code: 42201 })
  })

  it('保存草稿时即拒绝非法块类型与缺少 type 的内容块', async () => {
    const { service } = await createService()

    await expect(service.saveDraftBlocks('WB10001', [{ type: 'unknown_block' }])).rejects.toMatchObject({ code: 42201 })
    await expect(service.saveDraftBlocks('WB10001', [{}] as never)).rejects.toMatchObject({ code: 42201 })
  })

  it('局部更新保留未提交的字段（DTO 实例的 undefined 属性不覆盖原值）', async () => {
    const { service, repository } = await createService([{ ...product, flavor: '莓果' }])
    const seeded = await repository.findById('WB10001')
    await repository.save({ ...seeded!, goodsNo: 'G-1' })
    // 模拟 ValidationPipe 产出的 DTO 实例：未提交的可选字段也是自有属性（值为 undefined）
    const dto = plainToInstance(UpdateAdminProductDto, { priceFen: 200 })

    const saved = await service.updateProduct('WB10001', dto, actor)

    expect(saved).toMatchObject({ id: 'WB10001', name: '测试商品', priceFen: 200, theme: '#000000', flavor: '莓果', goodsNo: 'G-1', isActive: true })
  })

  it('新建商品初始为未发布草稿（contentVersion 0、isActive false）并记审计日志', async () => {
    const { service, auditLogs } = await createService([])
    const dto = plainToInstance(CreateAdminProductDto, {
      id: 'p-new-1', name: '新品', en: 'New Product', priceFen: 9900,
      theme: '#033B3C', themeLight: '#D9EDE2', cardImg: '/assets/new.jpg',
      spec: '10ml × 10袋', ingredients: '测试成分', originCert: '欧洲制造', complianceText: '固定合规声明',
    })

    const saved = await service.createProduct(dto, actor)

    expect(saved).toMatchObject({ id: 'p-new-1', isActive: false, contentVersion: 0, blocks: [], draftBlocks: [], tags: [] })
    await expect(auditLogs.findByTarget('catalog_product', 'p-new-1')).resolves.toMatchObject([{ action: 'create_product' }])
  })

  it('新建商品拒绝重复 ID', async () => {
    const { service } = await createService()
    const dto = plainToInstance(CreateAdminProductDto, {
      id: 'WB10001', name: '重复', en: 'Dup', priceFen: 100,
      theme: '#033B3C', themeLight: '#D9EDE2', cardImg: '/assets/dup.jpg',
      spec: '1 件', ingredients: '成分', originCert: '产地', complianceText: '声明',
    })

    await expect(service.createProduct(dto, actor)).rejects.toMatchObject({ code: 40002 })
  })

  it('发布时保留前后版本并记录操作日志', async () => {
    const { service, repository, versions, auditLogs } = await createService()
    await repository.saveDraftBlocks('WB10001', [{ type: 'gallery', images: ['/assets/next.jpg'] }])

    await service.publishDraft('WB10001', actor)

    await expect(versions.findByProduct('WB10001')).resolves.toMatchObject([
      { version: 1 }, { version: 2 },
    ])
    await expect(auditLogs.findByTarget('catalog_product', 'WB10001')).resolves.toMatchObject([
      { action: 'publish', beforeData: [{ type: 'gallery', images: ['/assets/test.jpg'] }], afterData: [{ type: 'gallery', images: ['/assets/next.jpg'] }] },
    ])
  })

  it('连续发布时每个版本只保留一份快照', async () => {
    const { service, repository, versions } = await createService()

    await repository.saveDraftBlocks('WB10001', [{ type: 'gallery', images: ['/assets/next.jpg'] }])
    await service.publishDraft('WB10001', actor)
    await repository.saveDraftBlocks('WB10001', [{ type: 'gallery', images: ['/assets/final.jpg'] }])
    await service.publishDraft('WB10001', actor)

    await expect(versions.findByProduct('WB10001')).resolves.toMatchObject([
      { version: 1 }, { version: 2 }, { version: 3 },
    ])
  })

  it('回滚到上一发布版并记录新版本与审计日志', async () => {
    const { service, versions, auditLogs } = await createService()
    await service.saveDraftBlocks('WB10001', [{ type: 'gallery', images: ['/assets/next.jpg'] }])
    await service.publishDraft('WB10001', actor)

    const rolledBack = await service.rollback('WB10001', actor)

    expect(rolledBack).toMatchObject({ contentVersion: 3, blocks: [{ type: 'gallery', images: ['/assets/test.jpg'] }] })
    expect(rolledBack.draftBlocks).toEqual(rolledBack.blocks)
    await expect(versions.findByProduct('WB10001')).resolves.toMatchObject([{ version: 1 }, { version: 2 }, { version: 3 }])
    await expect(auditLogs.findByTarget('catalog_product', 'WB10001')).resolves.toMatchObject([
      { action: 'publish' },
      { action: 'rollback', beforeData: { contentVersion: 2 }, afterData: { contentVersion: 3 } },
    ])
  })

  it('没有上一发布版时回滚报错', async () => {
    const { service } = await createService()

    await expect(service.rollback('WB10001', actor)).rejects.toMatchObject({ code: 40002 })
  })
})
