/**
 * Mock：商品数据（搬自原型 data.js + data-v2.js，价格换算为分）
 * 块序列按 content-blocks.md 定稿：gallery → stats → scenario → 素材图 → 营养表
 * 产品档案（spec/flavor/ingredients/originCert/usage）为商品基础字段，不在 blocks 里
 */
import type { Product, ProductDetail } from '../src/types'

const COMPLIANCE_TEXT =
  '本产品为膳食补充剂，并非药品，不能替代药物。本产品不能用于疾病的预防、治疗或诊断。' +
  '本品通过跨境电商保税备货模式（1210）进口，属于个人自用进境物品，请根据自身情况合理选用。' +
  '下单即视为同意提供真实姓名与身份证号用于海关申报，订购人、支付人、收货人须为同一人。' +
  '单笔订单限值 5000 元，个人年度交易限值 26000 元。'

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: '脂质体谷胱甘肽饮',
    en: 'Liposomal Glutathione',
    priceFen: 32900,
    theme: '#88BDCB',
    themeLight: '#E3F0F3',
    cardImg: '/assets/p1-main.jpg',
    tags: ['跨境保税', '脂质体技术'],
    spec: '5ml × 30袋 / 盒',
    flavor: '清新口味',
    ingredients: '谷胱甘肽、大豆卵磷脂',
    originCert: '欧洲制造 · GMP 生产规范',
    usage: '每日 1 袋，直接饮用或加入饮品',
  },
  {
    id: 'p2',
    name: '脂质体维生素C饮',
    en: 'Liposomal Vitamin C',
    priceFen: 25900,
    theme: '#F8A818',
    themeLight: '#FDEED2',
    cardImg: '/assets/p2-main.jpg',
    tags: ['跨境保税', '每袋1000mg', '脂质体技术'],
    spec: '150ml（5ml × 30袋）',
    flavor: '香橙味',
    ingredients: '维生素C 1000mg、生物素、柑橘生物类黄酮',
    originCert: '欧洲制造 · GMP 生产规范',
  },
  {
    id: 'p3',
    name: '脂质体睡眠喷雾',
    en: 'Liposomal Sleep Spray',
    priceFen: 28900,
    theme: '#082068',
    themeLight: '#E4E9F6',
    cardImg: '/assets/p3-box.jpg',
    tags: ['跨境保税', '无褪黑素配方', '脂质体技术'],
    spec: '30ml / 瓶',
    flavor: '葡萄味',
    ingredients: 'GABA、L-茶氨酸、藏红花提取物等 8 种',
    originCert: '欧洲制造 · GMP 生产规范',
  },
  {
    id: 'p4',
    name: '脂质体D3+K2+Q10饮',
    en: 'Liposomal D3+K2+Q10',
    priceFen: 29900,
    theme: '#702848',
    themeLight: '#F0E4EB',
    cardImg: '/assets/p4-main.jpg',
    tags: ['跨境保税', 'D3 4000IU', '脂质体技术'],
    spec: '150ml（5ml × 30袋）',
    flavor: '覆盆子味',
    ingredients: '维生素D3 4000IU、维生素K2(MK-7)、辅酶Q10',
    originCert: '欧洲制造 · GMP 生产规范',
  },
]

export const MOCK_PRODUCT_DETAILS: Record<string, ProductDetail> = {
  p1: {
    ...MOCK_PRODUCTS[0],
    complianceText: COMPLIANCE_TEXT,
    blocks: [
      { type: 'gallery', images: ['/assets/p1-main.jpg'] },
      {
        type: 'stats',
        items: [
          { n: '30', unit: '日', l: '每日一袋，一月一盒', d: '30-DAY SUPPLY' },
          { n: '5', unit: 'ml', l: '每袋容量', d: 'PER SACHET' },
          { n: '0', unit: '', l: '人工添加剂', d: 'NO ADDITIVES' },
          { n: '100', unit: '%', l: '植物来源成分', d: 'PLANT-BASED' },
        ],
      },
      {
        type: 'scenario',
        title: '它适合你吗？',
        items: ['关注日常抗氧化养护', '经常熬夜、作息不规律', '注重由内而外的状态管理'],
      },
      { type: 'image', src: '/assets/p1-tech.jpg' },
      { type: 'image', src: '/assets/p1-ingredients.jpg' },
      { type: 'image', src: '/assets/p1-flavor.jpg' },
      { type: 'image', src: '/assets/p1-usage.jpg' },
      { type: 'nutrition_image', src: '/assets/p1-nutrition.jpg' },
      { type: 'image', src: '/assets/p1-rd.jpg' },
    ],
  },
  p2: {
    ...MOCK_PRODUCTS[1],
    complianceText: COMPLIANCE_TEXT,
    blocks: [
      { type: 'gallery', images: ['/assets/p2-main.jpg'] },
      {
        type: 'stats',
        items: [
          { n: '4', unit: 'x', l: '同等剂量吸收利用提升*', d: 'BIOAVAILABILITY' },
          { n: '1000', unit: 'mg', l: '每袋维生素C含量', d: 'PER SACHET' },
          { n: '1000', unit: '%', l: '维生素C 每日参考值', d: 'NRV%' },
          { n: '30', unit: '日', l: '每日一袋，一月一盒', d: '30-DAY SUPPLY' },
        ],
        note: '* 数据来源于品牌方提供的吸收对比研究文献，个体存在差异。',
      },
      {
        type: 'scenario',
        title: '它适合你吗？',
        items: ['日常蔬果摄入不足', '经常熬夜、感觉状态不佳', '关注肌肤与气色的日常养护'],
      },
      { type: 'badges', title: '配方特点', items: ['纯素', '无糖', '无麸质', '非转基因', '不含人工添加剂', '欧洲制造'] },
      { type: 'image', src: '/assets/p2-tech.jpg' },
      { type: 'image', src: '/assets/p2-absorb.jpg' },
      { type: 'image', src: '/assets/p2-ingredients.jpg' },
      { type: 'image', src: '/assets/p2-biotin.jpg' },
      { type: 'image', src: '/assets/p2-flavor2.jpg' },
      { type: 'image', src: '/assets/p2-usage.jpg' },
      {
        type: 'nutrition',
        title: '营养成分表',
        meta: '每份食用量：5毫升（1袋）｜每盒份数：30',
        head: ['成分', '每份含量', 'NRV%'],
        rows: [
          ['维生素C（抗坏血酸钠）', '1000mg', '1000%'],
          ['生物素', '35mcg', '117%'],
          ['柑橘生物类黄酮', '10mg', '†'],
          ['大豆卵磷脂', '100mg', '†'],
        ],
        note: '† 营养素参考值（NRV）未制定。\n其他配料：纯化水、有机甘油、乳酸、天然橙子香料\n过敏原信息：含大豆成分',
      },
      { type: 'image', src: '/assets/p2-chart.jpg' },
    ],
  },
  p3: {
    ...MOCK_PRODUCTS[2],
    complianceText: COMPLIANCE_TEXT,
    blocks: [
      { type: 'gallery', images: ['/assets/p3-box.jpg', '/assets/p3-main.jpg'] },
      {
        type: 'stats',
        items: [
          { n: '6', unit: '喷', l: '每次用量，睡前 30 分钟', d: 'PER SERVING' },
          { n: '0', unit: '', l: '褪黑素添加', d: 'MELATONIN-FREE' },
          { n: '8', unit: '种', l: '协同配方成分', d: 'INGREDIENTS' },
          { n: '30', unit: '份', l: '每瓶约一个月量', d: 'PER BOTTLE' },
        ],
      },
      {
        type: 'scenario',
        title: '它适合你吗？',
        items: ['睡前难以放松下来', '作息不规律、倒时差', '希望醒来感觉更清爽'],
      },
      { type: 'badges', title: '配方特点', items: ['纯素', '无糖', '无麸质', '非转基因', '不含人工添加剂', '欧洲制造'] },
      { type: 'image', src: '/assets/p3-stages.jpg' },
      { type: 'image', src: '/assets/p3-formula.jpg' },
      { type: 'image', src: '/assets/p3-scene.jpg' },
      {
        type: 'nutrition',
        title: '营养成分表',
        meta: '每份食用量：1mL（6次喷压）｜每瓶份数：30',
        head: ['成分', '每份含量', 'NRV%'],
        rows: [
          ['GABA（γ-氨基丁酸）', '60mg', '†'],
          ['肌醇', '50mg', '†'],
          ['L-茶氨酸', '40mg', '†'],
          ['L-甘氨酸', '35mg', '†'],
          ['藏红花提取物', '25mg', '†'],
          ['香蜂草提取物', '25mg', '†'],
          ['洋甘菊提取物', '25mg', '†'],
          ['大豆卵磷脂', '15mg', '†'],
        ],
        note: '† 营养素参考值（NRV）未制定。\n其他配料：纯化水、有机甘油、柠檬酸、天然葡萄香料\n过敏原信息：含大豆成分',
      },
    ],
  },
  p4: {
    ...MOCK_PRODUCTS[3],
    complianceText: COMPLIANCE_TEXT,
    blocks: [
      { type: 'gallery', images: ['/assets/p4-main.jpg'] },
      {
        type: 'stats',
        items: [
          { n: '4000', unit: 'IU', l: '每袋维生素D3', d: 'VITAMIN D3' },
          { n: '75', unit: 'mcg', l: '维生素K2（MK-7）', d: 'VITAMIN K2' },
          { n: '30', unit: 'mg', l: '辅酶Q10（泛醇）', d: 'COQ10' },
          { n: '30', unit: '日', l: '每日一袋，一月一盒', d: '30-DAY SUPPLY' },
        ],
      },
      {
        type: 'scenario',
        title: '它适合你吗？',
        items: ['日常日晒不足、久居室内', '关注骨骼的日常养护', '有运动健身习惯'],
      },
      { type: 'badges', title: '配方特点', items: ['纯素', '无糖', '无麸质', '非转基因', '不含人工添加剂', '欧洲制造'] },
      { type: 'image', src: '/assets/p4-tech.jpg' },
      { type: 'image', src: '/assets/p4-absorb.jpg' },
      { type: 'image', src: '/assets/p4-benefits.jpg' },
      { type: 'image', src: '/assets/p4-flavor.jpg' },
      { type: 'image', src: '/assets/p4-usage.jpg' },
      {
        type: 'nutrition',
        title: '营养成分表',
        meta: '每份食用量：5mL（1袋）｜每盒份数：30',
        head: ['成分', '每份含量', 'NRV%'],
        rows: [
          ['维生素D（胆钙化醇，来源于藻类）', '100mcg（4000 IU）', '1000%'],
          ['维生素K2（MK-7）', '75mcg', '94%'],
          ['辅酶Q10（泛醇）', '30mg', '†'],
          ['大豆卵磷脂', '230mg', '†'],
        ],
        note: '† 营养素参考值（NRV）未制定。\n其他配料：纯化水、有机甘油、甜菜根提取物、天然覆盆子香料\n过敏原信息：含大豆成分',
      },
    ],
  },
}
