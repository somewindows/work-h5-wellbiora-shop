/**
 * Mock：订单数据（搬自原型 orders-data.js，价格换算为分）
 * 状态机：pay 待付款 → ship 待发货 → recv 待收货 → done 已完成 / cancelled 已取消
 */
import type { Order, OrderStatus } from '../src/types'

export const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; en: string }> = {
  pay: { label: '待付款', en: 'Awaiting Payment' },
  ship: { label: '待发货', en: 'Preparing' },
  recv: { label: '待收货', en: 'In Transit' },
  done: { label: '已完成', en: 'Completed' },
  cancelled: { label: '已取消', en: 'Cancelled' },
}

export const MOCK_ORDERS: Order[] = [
  {
    orderNo: 'WB20260825001',
    status: 'pay',
    createdAt: '2026-08-25 16:12',
    items: [
      { productId: 'WB10002', name: '脂质体维生素C饮', spec: '150ml（5ml × 30袋）· 香橙味', priceFen: 25900, quantity: 1, themeLight: '#FDEED2', img: '/assets/p2-main.jpg' },
    ],
    address: { name: '王小也', phone: '138****8888', line: '浙江省 金华市 义乌市 北苑街道 拥军路 88 号 2 栋 501 室' },
    idName: '王*也',
    idcard: '3307**********1234',
    payTime: null,
    declareNo: null,
    logistics: null,
  },
  {
    orderNo: 'WB20260823002',
    status: 'ship',
    createdAt: '2026-08-23 10:05',
    items: [
      { productId: 'WB10001', name: '脂质体谷胱甘肽饮', spec: '5ml × 30袋 / 盒', priceFen: 32900, quantity: 1, themeLight: '#E3F0F3', img: '/assets/p1-main.jpg' },
      { productId: 'WB10003', name: '脂质体睡眠喷雾', spec: '30ml / 瓶 · 葡萄味', priceFen: 28900, quantity: 1, themeLight: '#E4E9F6', img: '/assets/p3-box.jpg' },
    ],
    address: { name: '王小也', phone: '138****8888', line: '浙江省 金华市 义乌市 北苑街道 拥军路 88 号 2 栋 501 室' },
    idName: '王*也',
    idcard: '3307**********1234',
    payTime: '2026-08-23 10:06',
    declareNo: 'HG20260823091234',
    logistics: null,
  },
  {
    orderNo: 'WB20260820003',
    status: 'recv',
    createdAt: '2026-08-20 21:40',
    items: [
      { productId: 'WB10004', name: '脂质体D3+K2+Q10饮', spec: '150ml（5ml × 30袋）· 覆盆子味', priceFen: 29900, quantity: 2, themeLight: '#F0E4EB', img: '/assets/p4-main.jpg' },
    ],
    address: { name: '王小也', phone: '138****8888', line: '浙江省 金华市 义乌市 北苑街道 拥军路 88 号 2 栋 501 室' },
    idName: '王*也',
    idcard: '3307**********1234',
    payTime: '2026-08-20 21:41',
    declareNo: 'HG20260821085517',
    logistics: {
      company: '顺丰速运',
      trackNo: 'SF13800001234',
      traces: [
        { time: '2026-08-25 09:20', text: '快件已到达【义乌北苑营业点】，派送员正在为您派送' },
        { time: '2026-08-24 18:02', text: '快件离开【义乌保税仓】，发往义乌北苑营业点' },
        { time: '2026-08-24 10:15', text: '海关放行，保税仓拣货打包完成' },
        { time: '2026-08-21 09:00', text: '订单已提交海关申报（1210 保税备货）' },
      ],
    },
  },
  {
    orderNo: 'WB20260812004',
    status: 'done',
    createdAt: '2026-08-12 14:22',
    items: [
      { productId: 'WB10002', name: '脂质体维生素C饮', spec: '150ml（5ml × 30袋）· 香橙味', priceFen: 25900, quantity: 2, themeLight: '#FDEED2', img: '/assets/p2-main.jpg' },
    ],
    address: { name: '王小也', phone: '138****8888', line: '浙江省 金华市 义乌市 北苑街道 拥军路 88 号 2 栋 501 室' },
    idName: '王*也',
    idcard: '3307**********1234',
    payTime: '2026-08-12 14:23',
    declareNo: 'HG20260812153001',
    logistics: {
      company: '顺丰速运',
      trackNo: 'SF13800005678',
      traces: [
        { time: '2026-08-14 11:30', text: '快件已签收，感谢购买 WELLBIORA 产品' },
        { time: '2026-08-13 16:40', text: '快件离开【义乌保税仓】' },
        { time: '2026-08-12 15:10', text: '海关放行，保税仓拣货打包完成' },
      ],
    },
  },
  {
    orderNo: 'WB20260818005',
    status: 'cancelled',
    createdAt: '2026-08-18 09:30',
    items: [
      { productId: 'WB10003', name: '脂质体睡眠喷雾', spec: '30ml / 瓶 · 葡萄味', priceFen: 28900, quantity: 1, themeLight: '#E4E9F6', img: '/assets/p3-box.jpg' },
    ],
    address: { name: '王小也', phone: '138****8888', line: '浙江省 金华市 义乌市 北苑街道 拥军路 88 号 2 栋 501 室' },
    idName: '王*也',
    idcard: '3307**********1234',
    payTime: null,
    declareNo: null,
    logistics: null,
    cancelledReason: '超时未支付，自动取消',
  },
]
