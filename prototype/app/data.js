/* ============================================================
 * 商品数据 —— 「内容块数组」结构演示
 * 每个商品的详情页 = blocks 数组，前端渲染器按 type 逐个渲染。
 * 这就是后台自助更新的数据形态：运营在后台增删/排序 block 即可。
 * 价格为示例占位价，以上后台配置为准。
 * ============================================================ */

const PRODUCTS = [
  {
    id: 'p1',
    name: '脂质体谷胱甘肽饮',
    en: 'Liposomal Glutathione',
    spec: '5ml × 30袋 / 盒',
    flavor: '清新口味',
    price: 329,
    theme: '#88BDCB',
    themeLight: '#E3F0F3',
    cardImg: 'assets/p1-main.jpg',
    tags: ['跨境保税', '脂质体技术'],
    blocks: [
      { type: 'gallery', images: ['assets/p1-main.jpg'] },
      { type: 'image', src: 'assets/p1-tech.jpg' },
      { type: 'image', src: 'assets/p1-ingredients.jpg' },
      { type: 'image', src: 'assets/p1-flavor.jpg' },
      { type: 'image', src: 'assets/p1-usage.jpg' },
      { type: 'nutrition_image', src: 'assets/p1-nutrition.jpg' },
      { type: 'image', src: 'assets/p1-rd.jpg' },
    ],
  },
  {
    id: 'p2',
    name: '脂质体维生素C饮',
    en: 'Liposomal Vitamin C',
    spec: '150ml（5ml × 30袋）',
    flavor: '香橙味',
    price: 259,
    theme: '#F8A818',
    themeLight: '#FDEED2',
    cardImg: 'assets/p2-main.jpg',
    tags: ['跨境保税', '每袋1000mg', '脂质体技术'],
    blocks: [
      { type: 'gallery', images: ['assets/p2-main.jpg'] },
      { type: 'badges', title: '配方特点', items: ['纯素', '无糖', '无麸质', '非转基因', '不含人工添加剂', '欧洲制造'] },
      { type: 'image', src: 'assets/p2-tech.jpg' },
      { type: 'image', src: 'assets/p2-absorb.jpg' },
      { type: 'image', src: 'assets/p2-ingredients.jpg' },
      { type: 'image', src: 'assets/p2-biotin.jpg' },
      { type: 'image', src: 'assets/p2-flavor2.jpg' },
      { type: 'image', src: 'assets/p2-usage.jpg' },
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
      { type: 'image', src: 'assets/p2-chart.jpg' },
    ],
  },
  {
    id: 'p3',
    name: '脂质体睡眠喷雾',
    en: 'Liposomal Sleep Spray',
    spec: '30ml / 瓶',
    flavor: '葡萄味',
    price: 289,
    theme: '#082068',
    themeLight: '#E4E9F6',
    cardImg: 'assets/p3-box.jpg',
    tags: ['跨境保税', '无褪黑素配方', '脂质体技术'],
    blocks: [
      { type: 'gallery', images: ['assets/p3-box.jpg', 'assets/p3-main.jpg'] },
      { type: 'badges', title: '配方特点', items: ['纯素', '无糖', '无麸质', '非转基因', '不含人工添加剂', '欧洲制造'] },
      { type: 'image', src: 'assets/p3-stages.jpg' },
      { type: 'image', src: 'assets/p3-formula.jpg' },
      { type: 'image', src: 'assets/p3-scene.jpg' },
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
  {
    id: 'p4',
    name: '脂质体D3+K2+Q10饮',
    en: 'Liposomal D3+K2+Q10',
    spec: '150ml（5ml × 30袋）',
    flavor: '覆盆子味',
    price: 299,
    theme: '#702848',
    themeLight: '#F0E4EB',
    cardImg: 'assets/p4-main.jpg',
    tags: ['跨境保税', 'D3 4000IU', '脂质体技术'],
    blocks: [
      { type: 'gallery', images: ['assets/p4-main.jpg'] },
      { type: 'badges', title: '配方特点', items: ['纯素', '无糖', '无麸质', '非转基因', '不含人工添加剂', '欧洲制造'] },
      { type: 'image', src: 'assets/p4-tech.jpg' },
      { type: 'image', src: 'assets/p4-absorb.jpg' },
      { type: 'image', src: 'assets/p4-benefits.jpg' },
      { type: 'image', src: 'assets/p4-flavor.jpg' },
      { type: 'image', src: 'assets/p4-usage.jpg' },
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
];

/* 固定合规声明 —— 每个详情页自动附加，不可删除 */
const COMPLIANCE_TEXT =
  '本产品为膳食补充剂，并非药品，不能替代药物。本产品不能用于疾病的预防、治疗或诊断。' +
  '本品通过跨境电商保税备货模式（1210）进口，属于个人自用进境物品，请根据自身情况合理选用。' +
  '下单即视为同意提供真实姓名与身份证号用于海关申报，订购人、支付人、收货人须为同一人。' +
  '单笔订单限值 5000 元，个人年度交易限值 26000 元。';
