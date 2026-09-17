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
  const actor = { id: 'admin-1', username: 'operator', role: 'super' as const, mustChangePassword: false }
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

  it('新建商品初始为未发布草稿（contentVersion 0、isActive false），ID 由服务端生成并记审计日志', async () => {
    const { service, auditLogs } = await createService([])
    const dto = plainToInstance(CreateAdminProductDto, {
      name: '新品', en: 'New Product', priceFen: 9900,
      theme: '#033B3C', themeLight: '#D9EDE2', cardImg: '/assets/new.jpg',
      spec: '10ml × 10袋', ingredients: '测试成分', originCert: '欧洲制造', complianceText: '固定合规声明',
    })

    const saved = await service.createProduct(dto, actor)

    expect(saved).toMatchObject({ id: 'WB10001', isActive: false, contentVersion: 0, blocks: [], draftBlocks: [], tags: [] })
    await expect(auditLogs.findByTarget('catalog_product', 'WB10001')).resolves.toMatchObject([{ action: 'create_product' }])
  })

  it('商品 ID 按 WB + 5 位数字取最小未占用编号递增', async () => {
    const { service } = await createService()
    const dto = plainToInstance(CreateAdminProductDto, {
      name: '新品', en: 'New Product', priceFen: 100,
      theme: '#033B3C', themeLight: '#D9EDE2', cardImg: '/assets/new.jpg',
      spec: '1 件', ingredients: '成分', originCert: '产地', complianceText: '声明',
    })

    const first = await service.createProduct(dto, actor)
    const second = await service.createProduct(dto, actor)

    expect(first.id).toBe('WB10002')
    expect(second.id).toBe('WB10003')
  })

  it('中间编号被删除（不再占用）时新建商品填补空位', async () => {
    const { service } = await createService([product, { ...product, id: 'WB10003', name: '另一个商品' }])
    const dto = plainToInstance(CreateAdminProductDto, {
      name: '填坑新品', en: 'Gap Product', priceFen: 100,
      theme: '#033B3C', themeLight: '#D9EDE2', cardImg: '/assets/gap.jpg',
      spec: '1 件', ingredients: '成分', originCert: '产地', complianceText: '声明',
    })

    const saved = await service.createProduct(dto, actor)

    expect(saved.id).toBe('WB10002')
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

  it('两名管理员并发创建商品：编号不同、互不覆盖（复审 R15）', async () => {
    const { service, repository } = await createService([])
    const dto = plainToInstance(CreateAdminProductDto, {
      name: '并发新品', en: 'Concurrent Product', priceFen: 100,
      theme: '#033B3C', themeLight: '#D9EDE2', cardImg: '/assets/cc.jpg',
      spec: '1 件', ingredients: '成分', originCert: '产地', complianceText: '声明',
    })

    // 并发双方会先分配到相同的最小空号，insert-only 撞唯一键后落败方重新分配
    const [first, second] = await Promise.all([
      service.createProduct(dto, actor),
      service.createProduct(dto, { id: 'admin-2', username: 'operator-2', role: 'admin', mustChangePassword: false }),
    ])

    expect(first.id).not.toBe(second.id)
    expect([first.id, second.id].sort()).toEqual(['WB10001', 'WB10002'])
    expect(await repository.count()).toBe(2)
    // 无覆盖：两条记录都是完整的新建草稿
    expect(await repository.findById('WB10001')).toMatchObject({ name: '并发新品', isActive: false })
    expect(await repository.findById('WB10002')).toMatchObject({ name: '并发新品', isActive: false })
  })

  it('编号分配撞唯一键时重试并最终成功（复审 R15）', async () => {
    const { service, repository } = await createService([])
    const dto = plainToInstance(CreateAdminProductDto, {
      name: '重试新品', en: 'Retry Product', priceFen: 100,
      theme: '#033B3C', themeLight: '#D9EDE2', cardImg: '/assets/retry.jpg',
      spec: '1 件', ingredients: '成分', originCert: '产地', complianceText: '声明',
    })
    // 模拟第一次分配到的号被并发请求抢先插入
    const insert = repository.insertProduct.bind(repository)
    let calls = 0
    jest.spyOn(repository, 'insertProduct').mockImplementation(async (record) => {
      calls += 1
      if (calls === 1) throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' })
      return insert(record)
    })

    const saved = await service.createProduct(dto, actor)

    expect(saved.id).toBe('WB10001')
    expect(calls).toBe(2)
  })

  it('校验后草稿被另一次保存替换：条件发布拒绝并提示，商品保持发布前状态（复审 R15）', async () => {
    const { service, repository } = await createService()
    await service.saveDraftBlocks('WB10001', [{ type: 'gallery', images: ['/assets/validated.jpg'] }])
    // 模拟并发：服务层校验完成后、事务发布前，草稿被另一次保存替换
    const runInTransaction = repository.runInTransaction.bind(repository)
    jest.spyOn(repository, 'runInTransaction').mockImplementation(async (work) => {
      await repository.saveDraftBlocks('WB10001', [{ type: 'gallery', images: ['/assets/replaced.jpg'] }])
      return runInTransaction(work)
    })

    await expect(service.publishDraft('WB10001', actor)).rejects.toMatchObject({ code: 40002, message: '草稿已变更，请刷新后重新发布' })

    // 发布出去的必须是已校验快照：校验后被替换则不得发布
    expect(await repository.findById('WB10001')).toMatchObject({
      contentVersion: 1,
      blocks: [{ type: 'gallery', images: ['/assets/test.jpg'] }],
      draftBlocks: [{ type: 'gallery', images: ['/assets/replaced.jpg'] }],
    })
  })

  it('发布历史快照写入失败：整体回滚，商品不留半成品（复审 R15）', async () => {
    const { service, repository, versions } = await createService()
    await service.saveDraftBlocks('WB10001', [{ type: 'gallery', images: ['/assets/next.jpg'] }])
    jest.spyOn(versions, 'save').mockRejectedValueOnce(new Error('disk full'))

    await expect(service.publishDraft('WB10001', actor)).rejects.toThrow('disk full')

    // 内存实现以快照兜底恢复（真实库为事务回滚）：商品仍停留在发布前状态
    expect(await repository.findById('WB10001')).toMatchObject({
      contentVersion: 1,
      blocks: [{ type: 'gallery', images: ['/assets/test.jpg'] }],
    })
  })

  it('并发回滚：只有一方成功，落败方提示版本已变更（复审 R15）', async () => {
    const { service, repository, versions } = await createService()
    await service.saveDraftBlocks('WB10001', [{ type: 'gallery', images: ['/assets/next.jpg'] }])
    await service.publishDraft('WB10001', actor) // v1 → v2

    const results = await Promise.allSettled([service.rollback('WB10001', actor), service.rollback('WB10001', { id: 'admin-2', username: 'operator-2', role: 'admin', mustChangePassword: false })])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 40002, message: '发布版本已变更，请刷新后重试' })
    // 只回滚一次：版本推进到 3，新版本快照只有一份
    expect(await repository.findById('WB10001')).toMatchObject({ contentVersion: 3, blocks: [{ type: 'gallery', images: ['/assets/test.jpg'] }] })
    await expect(versions.findByProduct('WB10001')).resolves.toMatchObject([{ version: 1 }, { version: 2 }, { version: 3 }])
  })
})
