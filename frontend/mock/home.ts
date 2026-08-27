/**
 * Mock：首页内容块（搬自原型 index-v2.html）
 * 首页 = 内容块数组，运营后期调整只动数据
 */
import type { ContentBlock } from '../src/types'

export const MOCK_HOME_BLOCKS: ContentBlock[] = [
  {
    type: 'hero',
    badge: '保税仓直发',
    kick: 'Liposomal Delivery',
    title: '好营养，\n值得被真正吸收。',
    sub: '脂质体包裹每一剂营养，穿过消化过程，被身体充分利用。',
    tags: ['脂质体技术', '欧洲制造', '0 人工添加剂'],
    image: '/assets/p2-main.jpg',
  },
  { type: 'notice_bar', text: '义乌保税仓直发 · 跨境商品下单需实名申报 · 单笔限 ¥5000' },
  { type: 'product_rail', title: '今日推荐', en: 'Quick Shop', productIds: ['p1', 'p2', 'p3', 'p4'] },
  {
    type: 'stats',
    items: [
      { n: '4', unit: 'x', l: '同等剂量吸收利用提升*', d: 'BIOAVAILABILITY' },
      { n: '100', unit: '%', l: '植物来源成分', d: 'PLANT-BASED' },
      { n: '0', unit: '', l: '人工添加剂 · 无糖', d: 'CLEAN LABEL' },
      { n: '30', unit: '日', l: '每日一份，一月一盒', d: 'DAILY PACKS' },
    ],
    note: '* 数据来源于品牌方提供的吸收对比研究文献，个体存在差异。',
  },
  { type: 'product_grid', title: '全部产品', en: 'All Products', productIds: ['p1', 'p2', 'p3', 'p4'] },
  {
    type: 'cert_wall',
    items: [
      { icon: 'leaf', label: '纯素配方' },
      { icon: 'dna', label: '非转基因' },
      { icon: 'sugar-free', label: '无糖' },
      { icon: 'gluten-free', label: '无麸质' },
      { icon: 'check-circle', label: 'GMP 规范' },
      { icon: 'clock', label: '欧洲制造' },
    ],
  },
  {
    type: 'brand_block',
    kick: 'Our Science',
    title: '普通补剂仅在体内路过，\nWellbiora 营养可被真正吸收。',
    desc: '每一剂营养成分都被磷脂双分子层包裹——这种结构与人体细胞膜相似——保护营养成分通过消化过程，增强其进入血液的吸收，让你获得全部益处。',
    image: '/assets/p4-tech.jpg',
  },
]
