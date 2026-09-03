/**
 * Mock：购物车 / 地址 / 实名 / 用户
 */
import type { Address, CartItem, RealnameInfo, UserInfo } from '../src/types'

export const MOCK_CART: CartItem[] = [
  {
    id: 'c1',
    productId: 'WB10001',
    name: '脂质体谷胱甘肽饮',
    spec: '5ml × 30袋 / 盒',
    priceFen: 32900,
    quantity: 1,
    checked: true,
    img: '/assets/p1-main.jpg',
    themeLight: '#E3F0F3',
    inStock: true,
  },
  {
    id: 'c2',
    productId: 'WB10003',
    name: '脂质体睡眠喷雾',
    spec: '30ml / 瓶 · 葡萄味',
    priceFen: 28900,
    quantity: 2,
    checked: true,
    img: '/assets/p3-box.jpg',
    themeLight: '#E4E9F6',
    inStock: true,
  },
]

export const MOCK_ADDRESSES: Address[] = [
  {
    id: 'a1',
    name: '王小也',
    phone: '13888888888',
    region: '浙江省 金华市 义乌市',
    detail: '北苑街道 拥军路 88 号 2 栋 501 室',
    isDefault: true,
  },
]

export const MOCK_REALNAME: RealnameInfo = {
  name: '王*也',
  idcard: '3307**********1234',
}

export const MOCK_USER: UserInfo = {
  id: 'u1',
  phone: '138****8888',
  nickname: 'WELLBIORA 会员',
}
