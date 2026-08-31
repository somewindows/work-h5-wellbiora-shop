import { InMemoryCatalogRepository } from '../catalog/catalog.repository'
import type { ProductDetail } from '../catalog/catalog.types'

import { AdminCatalogService } from './admin-catalog.service'

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
})
