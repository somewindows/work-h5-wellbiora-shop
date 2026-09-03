import { BusinessException } from '../common/business.exception'
import type { Product, ProductDetail } from '../catalog/catalog.types'

import { ProductsService } from './products.service'

interface PublishedProductsSource {
  findAllPublished(): Product[]
}

interface PublishedProductDetailsSource extends PublishedProductsSource {
  findPublishedById(id: string): ProductDetail | null
}

interface AsyncPublishedProductSource {
  findAllPublished(): Promise<Product[]>
  findPublishedById(id: string): Promise<ProductDetail | null>
}

describe('ProductsService', () => {
  const service = new ProductsService()

  it('返回四个公开商品卡片', async () => {
    const products = await service.findAll()
    expect(products).toHaveLength(4)
    expect(products[0]).toMatchObject({
      id: 'WB10001',
      priceFen: 32900,
      themeLight: '#E3F0F3',
    })
  })

  it('返回包含内容块和合规声明的商品详情', async () => {
    expect(await service.findOne('WB10002')).toMatchObject({
      id: 'WB10002',
      complianceText: expect.stringContaining('膳食补充剂'),
      blocks: expect.arrayContaining([expect.objectContaining({ type: 'gallery' })]),
    })
  })

  it('以 40404 拒绝未知商品', async () => {
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(BusinessException)

    try {
      await service.findOne('missing')
    } catch (error) {
      expect(error).toMatchObject({ code: 40404, message: '商品不存在' })
    }
  })

  it('从已发布商品仓储读取商品列表', async () => {
    const publishedProduct: Product = {
      id: 'published-only',
      name: '已发布商品',
      en: 'Published product',
      priceFen: 100,
      theme: '#000000',
      themeLight: '#FFFFFF',
      cardImg: '/assets/published.jpg',
      tags: [],
      spec: '1 件',
      ingredients: '测试成分',
      originCert: '测试产地',
    }
    const repository: PublishedProductsSource = { findAllPublished: () => [publishedProduct] }
    const service = new (ProductsService as unknown as new (repository: PublishedProductsSource) => ProductsService)(repository)

    expect(await service.findAll()).toEqual([publishedProduct])
  })

  it('从已发布商品仓储读取商品详情', async () => {
    const publishedDetail = {
      id: 'published-only',
      name: '已发布商品',
      en: 'Published product',
      priceFen: 100,
      theme: '#000000',
      themeLight: '#FFFFFF',
      cardImg: '/assets/published.jpg',
      tags: [],
      spec: '1 件',
      ingredients: '测试成分',
      originCert: '测试产地',
      blocks: [{ type: 'gallery', images: ['/assets/published.jpg'] }],
      complianceText: '固定合规声明',
    }
    const repository: PublishedProductDetailsSource = {
      findAllPublished: () => [publishedDetail],
      findPublishedById: () => publishedDetail,
    }
    const service = new (ProductsService as unknown as new (repository: PublishedProductDetailsSource) => ProductsService)(repository)

    expect(await service.findOne('published-only')).toEqual(publishedDetail)
  })

  it('异步仓储找不到已发布商品时仍以 40404 拒绝', async () => {
    const repository: AsyncPublishedProductSource = {
      findAllPublished: async (): Promise<Product[]> => [],
      findPublishedById: async (): Promise<ProductDetail | null> => null,
    }
    const service = new (ProductsService as unknown as new (repository: AsyncPublishedProductSource) => { findOne(id: string): Promise<ProductDetail> })(repository)

    await expect(service.findOne('missing')).rejects.toMatchObject({ code: 40404, message: '商品不存在' })
  })
})
