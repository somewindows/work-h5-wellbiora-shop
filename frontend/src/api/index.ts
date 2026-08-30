/**
 * API 层：前端唯一数据入口
 * - VITE_USE_MOCK=1 时走 mock/ 假数据（前后端并行开发，契约见 docs/tech/api-contract.md）
 * - 关闭后经 axios 调真实后端，接口路径与契约一致
 */
import { request } from './request'
import type {
  Address,
  CartItem,
  ContentBlock,
  Order,
  OrderStatus,
  Product,
  ProductDetail,
  RealnameInfo,
  UserInfo,
} from '@/types'
import { MOCK_HOME_BLOCKS } from '../../mock/home'
import { MOCK_PRODUCTS, MOCK_PRODUCT_DETAILS } from '../../mock/products'
import { MOCK_ORDERS } from '../../mock/orders'
import { MOCK_ADDRESSES, MOCK_CART, MOCK_REALNAME, MOCK_USER } from '../../mock/misc'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1'

/** 模拟网络延迟 */
function delay<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

/* ===== 商品与页面内容 ===== */

export function getHome(): Promise<ContentBlock[]> {
  if (USE_MOCK) return delay(MOCK_HOME_BLOCKS)
  return request.get('/home')
}

export function getProducts(): Promise<Product[]> {
  if (USE_MOCK) return delay(MOCK_PRODUCTS)
  return request.get('/products')
}

export function getProduct(id: string): Promise<ProductDetail> {
  if (USE_MOCK) {
    const detail = MOCK_PRODUCT_DETAILS[id]
    return detail ? delay(detail) : Promise.reject(new Error('商品不存在'))
  }
  return request.get(`/products/${id}`)
}

/* ===== 购物车 ===== */

// mock 模式下用内存拷贝模拟服务端购物车
let mockCart: CartItem[] = MOCK_CART.map((i) => ({ ...i }))
let mockAddresses: Address[] = MOCK_ADDRESSES.map((item) => ({ ...item }))
let mockRealname: RealnameInfo | null = { ...MOCK_REALNAME }

export function getCart(): Promise<CartItem[]> {
  if (USE_MOCK) return delay(mockCart)
  return request.get('/cart')
}

export function addCartItem(productId: string, quantity: number): Promise<CartItem[]> {
  if (USE_MOCK) {
    const exist = mockCart.find((i) => i.productId === productId)
    if (exist) {
      exist.quantity += quantity
    } else {
      const p = MOCK_PRODUCTS.find((x) => x.id === productId)
      if (!p) return Promise.reject(new Error('商品不存在'))
      mockCart.push({
        id: `c${Date.now()}`,
        productId: p.id,
        name: p.name,
        spec: p.flavor ? `${p.spec} · ${p.flavor}` : p.spec,
        priceFen: p.priceFen,
        quantity,
        checked: true,
        img: p.cardImg,
        themeLight: p.themeLight,
        inStock: true,
      })
    }
    return delay(mockCart)
  }
  return request.post('/cart/items', { productId, quantity })
}

export function updateCartItem(id: string, patch: { quantity?: number; checked?: boolean }): Promise<CartItem[]> {
  if (USE_MOCK) {
    const item = mockCart.find((i) => i.id === id)
    if (item) Object.assign(item, patch)
    return delay(mockCart)
  }
  return request.patch(`/cart/items/${id}`, patch)
}

export function removeCartItem(id: string): Promise<CartItem[]> {
  if (USE_MOCK) {
    mockCart = mockCart.filter((i) => i.id !== id)
    return delay(mockCart)
  }
  return request.delete(`/cart/items/${id}`)
}

/* ===== 地址与实名 ===== */

export function getAddresses(): Promise<Address[]> {
  if (USE_MOCK) return delay(mockAddresses)
  return request.get('/addresses')
}

export function createAddress(input: Omit<Address, 'id'>): Promise<Address> {
  if (USE_MOCK) {
    if (input.isDefault) mockAddresses = mockAddresses.map((item) => ({ ...item, isDefault: false }))
    const address = { id: `a${Date.now()}`, ...input, isDefault: input.isDefault || mockAddresses.length === 0 }
    mockAddresses.push(address)
    return delay(address)
  }
  return request.post('/addresses', input)
}

export function updateAddress(id: string, input: Partial<Omit<Address, 'id'>>): Promise<Address> {
  if (USE_MOCK) {
    const index = mockAddresses.findIndex((item) => item.id === id)
    if (index < 0) return Promise.reject(new Error('收货地址不存在'))
    if (input.isDefault) mockAddresses = mockAddresses.map((item) => ({ ...item, isDefault: false }))
    mockAddresses[index] = { ...mockAddresses[index], ...input }
    return delay(mockAddresses[index])
  }
  return request.patch(`/addresses/${id}`, input)
}

export function getRealname(): Promise<RealnameInfo | null> {
  if (USE_MOCK) return delay(mockRealname)
  return request.get('/realname')
}

export function saveRealname(input: RealnameInfo): Promise<RealnameInfo> {
  if (USE_MOCK) {
    mockRealname = { ...input }
    return delay(mockRealname)
  }
  return request.post('/realname', input)
}

/* ===== 订单 ===== */

// mock 模式下用内存拷贝模拟服务端订单（支持下单新增）
let mockOrders: Order[] = MOCK_ORDERS.map((o) => ({ ...o }))

export function getOrders(status?: OrderStatus): Promise<{ total: number; list: Order[] }> {
  if (USE_MOCK) {
    const list = status ? mockOrders.filter((o) => o.status === status) : mockOrders
    return delay({ total: list.length, list })
  }
  return request.get('/orders', { params: { status } })
}

export function getOrder(orderNo: string): Promise<Order> {
  if (USE_MOCK) {
    const order = mockOrders.find((o) => o.orderNo === orderNo)
    return order ? delay(order) : Promise.reject(new Error('订单不存在'))
  }
  return request.get(`/orders/${orderNo}`)
}

/**
 * 创建订单（契约：POST /orders，幂等键 requestId）
 * mock：由购物车勾选商品 + 默认地址生成「待付款」订单，返回订单号；
 * 真实微信支付参数由后端返回，mock 阶段前端拿到 orderNo 后直接跳订单详情
 */
export interface OrderPrecheck {
  items: Order['items']
  goodsFen: number
  taxFen: number
  payableFen: number
}

export function precheckOrder(): Promise<OrderPrecheck> {
  if (USE_MOCK) {
    const items = mockCart.filter((item) => item.checked).map((item) => ({
      productId: item.productId, name: item.name, spec: item.spec, priceFen: item.priceFen,
      quantity: item.quantity, img: item.img, themeLight: item.themeLight,
    }))
    if (!items.length) return Promise.reject(new Error('请先选择要结算的商品'))
    const goodsFen = items.reduce((sum, item) => sum + item.priceFen * item.quantity, 0)
    return delay({ items, goodsFen, taxFen: 0, payableFen: goodsFen })
  }
  return request.post('/orders/precheck', {})
}

export function createOrder(requestId: string): Promise<{ orderNo: string; payParams?: Record<string, string> }> {
  if (USE_MOCK) {
    const checked = mockCart.filter((i) => i.checked)
    if (!checked.length) return Promise.reject(new Error('没有勾选的商品'))
    const addr = MOCK_ADDRESSES[0]
    const orderNo = `WB${Date.now()}`
    mockOrders.unshift({
      orderNo,
      status: 'pay',
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      items: checked.map((i) => ({
        productId: i.productId,
        name: i.name,
        spec: i.spec,
        priceFen: i.priceFen,
        quantity: i.quantity,
        img: i.img,
        themeLight: i.themeLight,
      })),
      address: { name: addr.name, phone: addr.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'), line: `${addr.region} ${addr.detail}` },
      idName: MOCK_REALNAME.name,
      idcard: MOCK_REALNAME.idcard,
      payTime: null,
      declareNo: null,
      logistics: null,
    })
    // 下单后清掉已结算的购物车行
    mockCart = mockCart.filter((i) => !i.checked)
    return delay({ orderNo })
  }
  return request.post('/orders', { requestId })
}

export function cancelOrder(orderNo: string): Promise<Order> {
  if (USE_MOCK) {
    const order = mockOrders.find((item) => item.orderNo === orderNo)
    if (!order) return Promise.reject(new Error('订单不存在'))
    if (order.status !== 'pay') return Promise.reject(new Error('当前订单状态不支持取消'))
    order.status = 'cancelled'
    order.cancelledReason = '用户取消订单'
    return delay(order)
  }
  return request.post(`/orders/${orderNo}/cancel`, {})
}

/* ===== 认证 ===== */

export function sendSmsCode(phone: string): Promise<null> {
  if (USE_MOCK) return delay(null)
  return request.post('/auth/sms-code', { phone })
}

export function login(phone: string, code: string): Promise<{ token: string; user: UserInfo }> {
  if (USE_MOCK) return delay({ token: 'mock-token', user: MOCK_USER })
  return request.post('/auth/login', { phone, code })
}

export function getUserInfo(): Promise<UserInfo> {
  if (USE_MOCK) return delay(MOCK_USER)
  return request.get('/users/me')
}
