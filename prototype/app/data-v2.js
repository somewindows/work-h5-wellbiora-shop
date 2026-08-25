/* ============================================================
 * V2 商品数据扩展 —— 在 data.js 基础上组合
 * 新增内容块类型（type 定义先行，渲染器见 product-v2.html）：
 *   info_rows  商品信息行    { rows: [{k, v}] }
 *   stats      数据网格      { items: [{n, unit, l, d}] }
 *   scenario   适用场景清单  { title, items: [] }
 * ============================================================ */

const EXTRA_V2 = {
  p1: {
    infoRows: [
      { k: '产品规格', v: '5ml × 30袋 / 盒' },
      { k: '核心成分', v: '谷胱甘肽、大豆卵磷脂' },
      { k: '产地与认证', v: '欧洲制造 · GMP 生产规范' },
      { k: '食用方法', v: '每日 1 袋，直接饮用或加入饮品' },
    ],
    stats: [
      { n: '30', unit: '日', l: '每日一袋，一月一盒', d: '30-DAY SUPPLY' },
      { n: '5', unit: 'ml', l: '每袋容量', d: 'PER SACHET' },
      { n: '0', unit: '', l: '人工添加剂', d: 'NO ADDITIVES' },
      { n: '100', unit: '%', l: '植物来源成分', d: 'PLANT-BASED' },
    ],
    scen: ['关注日常抗氧化养护', '经常熬夜、作息不规律', '注重由内而外的状态管理'],
  },
  p2: {
    infoRows: [
      { k: '产品规格', v: '150ml（5ml × 30袋）' },
      { k: '风味', v: '香橙味' },
      { k: '核心成分', v: '维生素C 1000mg、生物素、柑橘生物类黄酮' },
      { k: '产地与认证', v: '欧洲制造 · GMP 生产规范' },
    ],
    stats: [
      { n: '4', unit: 'x', l: '同等剂量吸收利用提升*', d: 'BIOAVAILABILITY' },
      { n: '1000', unit: 'mg', l: '每袋维生素C含量', d: 'PER SACHET' },
      { n: '1000', unit: '%', l: '维生素C 每日参考值', d: 'NRV%' },
      { n: '30', unit: '日', l: '每日一袋，一月一盒', d: '30-DAY SUPPLY' },
    ],
    scen: ['日常蔬果摄入不足', '经常熬夜、感觉状态不佳', '关注肌肤与气色的日常养护'],
  },
  p3: {
    infoRows: [
      { k: '产品规格', v: '30ml / 瓶（约 30 份）' },
      { k: '风味', v: '葡萄味' },
      { k: '核心成分', v: 'GABA、L-茶氨酸、藏红花提取物等 8 种' },
      { k: '产地与认证', v: '欧洲制造 · GMP 生产规范' },
    ],
    stats: [
      { n: '6', unit: '喷', l: '每次用量，睡前 30 分钟', d: 'PER SERVING' },
      { n: '0', unit: '', l: '褪黑素添加', d: 'MELATONIN-FREE' },
      { n: '8', unit: '种', l: '协同配方成分', d: 'INGREDIENTS' },
      { n: '30', unit: '份', l: '每瓶约一个月量', d: 'PER BOTTLE' },
    ],
    scen: ['睡前难以放松下来', '作息不规律、倒时差', '希望醒来感觉更清爽'],
  },
  p4: {
    infoRows: [
      { k: '产品规格', v: '150ml（5ml × 30袋）' },
      { k: '风味', v: '覆盆子味' },
      { k: '核心成分', v: '维生素D3 4000IU、维生素K2(MK-7)、辅酶Q10' },
      { k: '产地与认证', v: '欧洲制造 · GMP 生产规范' },
    ],
    stats: [
      { n: '4000', unit: 'IU', l: '每袋维生素D3', d: 'VITAMIN D3' },
      { n: '75', unit: 'mcg', l: '维生素K2（MK-7）', d: 'VITAMIN K2' },
      { n: '30', unit: 'mg', l: '辅酶Q10（泛醇）', d: 'COQ10' },
      { n: '30', unit: '日', l: '每日一袋，一月一盒', d: '30-DAY SUPPLY' },
    ],
    scen: ['日常日晒不足、久居室内', '关注骨骼的日常养护', '有运动健身习惯'],
  },
};

/* 组合出 v2 详情页块序列：
 * 图廊 → 信息行 → 数据网格 → 适用场景 → 原素材图块 → 营养表 → 合规声明(页面固定追加) */
const PRODUCTS2 = PRODUCTS.map(p => {
  const ex = EXTRA_V2[p.id];
  const rest = p.blocks.filter(b => b.type !== 'gallery');
  const gallery = p.blocks.find(b => b.type === 'gallery');
  return {
    ...p,
    blocks2: [
      gallery,
      { type: 'info_rows', rows: ex.infoRows },
      { type: 'stats', items: ex.stats },
      { type: 'scenario', title: '它适合你吗？', items: ex.scen },
      ...rest,
    ],
  };
});
