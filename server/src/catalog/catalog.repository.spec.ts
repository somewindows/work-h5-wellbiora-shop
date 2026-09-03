import type { ProductDetail } from './catalog.types'
import { InMemoryCatalogRepository } from './catalog.repository'

describe('InMemoryCatalogRepository', () => {
  const product: ProductDetail = {
    id: 'WB10001', name: '测试商品', en: 'Test product', priceFen: 100,
    theme: '#000000', themeLight: '#FFFFFF', cardImg: '/assets/test.jpg', tags: [],
    spec: '1 件', ingredients: '测试成分', originCert: '测试产地',
    blocks: [{ type: 'gallery', images: ['/assets/test.jpg'] }],
    complianceText: '固定合规声明',
  }

  it('发布草稿后更新对外读取的内容块，并过滤隐藏块', async () => {
    const repository = new InMemoryCatalogRepository()
    await repository.seed([product])
    await repository.saveDraftBlocks('WB10001', [
      { type: 'gallery', images: ['/assets/next.jpg'] },
      { type: 'image', src: '/assets/hidden.jpg', hidden: true },
    ])

    expect((await repository.findPublishedById('WB10001'))).toMatchObject({ blocks: product.blocks })
    await repository.publishDraft('WB10001')

    await expect(repository.findPublishedById('WB10001')).resolves.toMatchObject({
      blocks: [{ type: 'gallery', images: ['/assets/next.jpg'] }],
    })
    await expect(repository.findById('WB10001')).resolves.toMatchObject({
      draftBlocks: [
        { type: 'gallery', images: ['/assets/next.jpg'] },
        { type: 'image', src: '/assets/hidden.jpg', hidden: true },
      ],
      contentVersion: 2,
    })
  })
})
