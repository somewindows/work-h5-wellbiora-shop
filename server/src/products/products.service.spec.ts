import { BusinessException } from '../common/business.exception'

import { ProductsService } from './products.service'

describe('ProductsService', () => {
  const service = new ProductsService()

  it('返回四个公开商品卡片', () => {
    expect(service.findAll()).toHaveLength(4)
    expect(service.findAll()[0]).toMatchObject({
      id: 'p1',
      priceFen: 32900,
      themeLight: '#E3F0F3',
    })
  })

  it('返回包含内容块和合规声明的商品详情', () => {
    expect(service.findOne('p2')).toMatchObject({
      id: 'p2',
      complianceText: expect.stringContaining('膳食补充剂'),
      blocks: expect.arrayContaining([expect.objectContaining({ type: 'gallery' })]),
    })
  })

  it('以 40404 拒绝未知商品', () => {
    expect(() => service.findOne('missing')).toThrow(BusinessException)

    try {
      service.findOne('missing')
    } catch (error) {
      expect(error).toMatchObject({ code: 40404, message: '商品不存在' })
    }
  })
})
