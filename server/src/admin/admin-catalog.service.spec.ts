import { InMemoryCatalogRepository } from '../catalog/catalog.repository'
import type { ProductDetail } from '../catalog/catalog.types'

import { AdminCatalogService } from './admin-catalog.service'
import { InMemoryAuditLogRepository } from './audit-log.repository'
import { AuditLogService } from './audit-log.service'
import { InMemoryContentVersionRepository } from './content-version.repository'


describe('AdminCatalogService', () => {
  const product: ProductDetail = {
    id: 'p1', name: '测试商品', en: 'Test product', priceFen: 100,
    theme: '#000000', themeLight: '#FFFFFF', cardImg: '/assets/test.jpg', tags: [],
    spec: '1 件', ingredients: '测试成分', originCert: '测试产地',
    blocks: [{ type: 'gallery', images: ['/assets/test.jpg'] }],
    complianceText: '固定合规声明',
  }

  it('拒绝没有来源脚注的星号数据宣称', async () => {
    const repository = new InMemoryCatalogRepository()
    await repository.seed([product])
    const service = new AdminCatalogService(repository)

    await expect(service.saveDraftBlocks('p1', [{
      type: 'stats',
      items: [{ n: '4', unit: 'x', l: '吸收利用提升*', d: 'BIOAVAILABILITY' }],
    }])).rejects.toMatchObject({ code: 42201 })
  })

  it('拒绝没有 type 的非法内容块，而不是抛出内部错误', async () => {
    const repository = new InMemoryCatalogRepository()
    await repository.seed([product])
    const service = new AdminCatalogService(repository)

    await expect(service.saveDraftBlocks('p1', [{}] as never)).rejects.toMatchObject({ code: 42201 })
  })

  it('发布时保留前后版本并记录操作日志', async () => {
    const repository = new InMemoryCatalogRepository()
    const versions = new InMemoryContentVersionRepository()
    const auditLogs = new InMemoryAuditLogRepository()
    await repository.seed([product])
    await repository.saveDraftBlocks('p1', [{ type: 'gallery', images: ['/assets/next.jpg'] }])
    const service = new (AdminCatalogService as unknown as new (
      catalog: InMemoryCatalogRepository,
      history: typeof versions,
      audit: AuditLogService,
    ) => { publishDraft(id: string, actor: { id: string; username: string }): Promise<unknown> })(repository, versions, new AuditLogService(auditLogs))

    await service.publishDraft('p1', { id: 'admin-1', username: 'operator' })

    await expect(versions.findByProduct('p1')).resolves.toMatchObject([
      { version: 1 }, { version: 2 },
    ])
    await expect(auditLogs.findByTarget('catalog_product', 'p1')).resolves.toMatchObject([
      { action: 'publish', beforeData: [{ type: 'gallery', images: ['/assets/test.jpg'] }], afterData: [{ type: 'gallery', images: ['/assets/next.jpg'] }] },
    ])
  })

  it('连续发布时每个版本只保留一份快照', async () => {
    const repository = new InMemoryCatalogRepository()
    const versions = new InMemoryContentVersionRepository()
    const auditLogs = new InMemoryAuditLogRepository()
    await repository.seed([product])
    const service = new (AdminCatalogService as unknown as new (
      catalog: InMemoryCatalogRepository, history: typeof versions, audit: AuditLogService,
    ) => { publishDraft(id: string, actor: { id: string; username: string }): Promise<unknown> })(repository, versions, new AuditLogService(auditLogs))

    await repository.saveDraftBlocks('p1', [{ type: 'gallery', images: ['/assets/next.jpg'] }])
    await service.publishDraft('p1', { id: 'admin-1', username: 'operator' })
    await repository.saveDraftBlocks('p1', [{ type: 'gallery', images: ['/assets/final.jpg'] }])
    await service.publishDraft('p1', { id: 'admin-1', username: 'operator' })

    await expect(versions.findByProduct('p1')).resolves.toMatchObject([
      { version: 1 }, { version: 2 }, { version: 3 },
    ])
  })
})
