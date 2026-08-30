<script setup lang="ts">
/**
 * 结算页「确认订单」（路由 /checkout）
 * 视觉 1:1 来源：prototype/app/checkout.html
 * 数据：默认地址 getAddresses / 实名 getRealname / 商品清单 cart.checkedItems
 * 下单：createOrder(requestId 幂等键)，成功跳 /order/{orderNo}
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import PriceText from '@/components/PriceText.vue'
import { createOrder, getAddresses, getRealname, precheckOrder } from '@/api'
import { useCartStore } from '@/stores/cart'
import { fenToYuan } from '@/utils/format'
import type { Address, RealnameInfo } from '@/types'

const router = useRouter()
const cart = useCartStore()

const address = ref<Address | null>(null)
const realname = ref<RealnameInfo | null>(null)
const agreed = ref(false)
const paying = ref(false)

/* 底部弹层状态 */
const sheetDoc = ref<'notice' | 'service' | null>(null)
const sheetTax = ref(false)
const maskShow = computed(() => sheetDoc.value !== null || sheetTax.value)

onMounted(async () => {
  await cart.refresh()
  // 没有勾选商品时无法结算，退回购物车
  if (!cart.checkedItems.length) {
    showToast('请先选择要结算的商品')
    router.replace('/cart')
    return
  }
  const [addrs, real] = await Promise.all([getAddresses(), getRealname()])
  address.value = addrs.find((a) => a.isDefault) ?? addrs[0] ?? null
  realname.value = real?.idcard ? real : null
})

/** 商品件数与金额（分） */
const totalCount = computed(() => cart.checkedItems.reduce((s, i) => s + i.quantity, 0))
const totalFen = computed(() => cart.checkedTotalFen)

/** 手机号脱敏展示（与原型 138****8888 一致） */
function maskPhone(phone: string) {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

/** 幂等键：crypto.randomUUID 不可用时降级 Date.now + 随机数 */
function genRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function onPay() {
  if (!address.value) {
    showToast('请先选择收货地址')
    return
  }
  if (!realname.value) {
    showToast('请先完成支付人实名认证')
    return
  }
  if (!agreed.value) {
    showToast('请先阅读并勾选相关协议')
    return
  }
  if (paying.value) return
  paying.value = true
  try {
    await precheckOrder()
    const { orderNo } = await createOrder(genRequestId())
    router.replace(`/order/${orderNo}`)
  } catch (e) {
    showToast(e instanceof Error ? e.message : '下单失败，请稍后重试')
  } finally {
    paying.value = false
  }
}

/* 协议正文（与原型 checkout.html 一致；正式上线前需法务审定全文） */
const DOCS = {
  notice: {
    title: '跨境电子商务零售进口商品购买告知书',
    body: `
      <p>一、本店商品通过跨境电商零售进口模式销售（海关监管方式代码 1210，保税备货），商品提前备货于义乌保税仓，下单后由保税仓直发。</p>
      <p>二、本店商品为跨境电商零售进口商品，执行原产地（输出国/地区）相关标准，可能与我国标准存在差异；商品可能无中文标签及中文说明书，购买前请仔细阅读商品详情页信息。</p>
      <p>三、根据海关监管要求，购买人需提供真实姓名与身份证号码用于通关申报；本店将对身份证号加密存储，且仅用于海关清关用途。</p>
      <p>四、订购人、支付人、收货人三者的实名信息（姓名、身份证号）必须一致，否则订单将无法通过海关申报。</p>
      <p>五、限值规定：单笔交易限值人民币 5000 元，个人年度交易限值人民币 26000 元，超出限值的订单将无法完成申报。</p>
      <p>六、跨境电商零售进口商品仅限个人自用，不得用于二次销售或其他商业用途。</p>
      <p>七、点击购买即视为您已阅读、理解并同意上述告知内容。</p>`,
  },
  service: {
    title: '用户服务协议',
    body: `
      <p>一、服务内容：本店通过 H5 商城向您提供跨境膳食补充剂的浏览、下单、支付与配送服务；下单流程为：选购商品 → 填写收货地址与实名信息 → 微信支付 → 海关申报 → 保税仓发货。</p>
      <p>二、实名信息与隐私保护：为完成海关申报，我们将收集您的姓名与身份证号；身份证号加密存储、仅用于清关申报，不用于其他用途，也不向无关第三方提供。</p>
      <p>三、支付与退款：本店支持微信支付；退款按原支付路径退回，已提交海关申报的订单退款需人工审核处理，具体时效以客服答复为准。</p>
      <p>四、订单取消：未提交海关申报的订单可自助取消；已申报订单如需取消，请联系人工客服协助处理。</p>
      <p>五、售后政策：退款/售后暂由人工客服处理（服务时间每日 9:00–23:00），您可在「我的」页联系客服发起申请。</p>
      <p>六、合规声明：本店商品为膳食补充剂，并非药品，不能替代药物；商品使用效果因个体差异而不同。</p>
      <p>七、本协议如有更新将在本页面公示，继续使用本店服务即视为接受更新后的协议。</p>`,
  },
} as const

function openDoc(key: 'notice' | 'service') {
  sheetDoc.value = key
}
function closeSheets() {
  sheetDoc.value = null
  sheetTax.value = false
}
/** 弹层内「已阅读并同意」：勾选协议并关闭 */
function agreeAndClose() {
  agreed.value = true
  closeSheets()
}
</script>

<template>
  <div class="page">
    <!-- 顶部导航 -->
    <div class="navbar">
      <a class="back" aria-label="返回购物车" @click="router.push('/cart')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </a>
      <div class="title">确认订单</div>
      <div class="gap"></div>
    </div>

    <!-- 跨境提示 -->
    <div class="notice">义乌保税仓直发 · 支付完成即向海关申报（1210 保税备货）</div>

    <!-- 收货地址 + 实名 -->
    <div class="card">
      <div class="c-head">
        <div>
          <div class="c-kick">Shipping Address</div>
          <div class="c-title">收货信息</div>
        </div>
      </div>
      <div style="margin-top: 12px">
        <!-- 已有地址 -->
        <button v-if="address" class="addr" @click="router.push('/address')">
          <span class="aico">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8">
              <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.6" />
            </svg>
          </span>
          <span class="abody">
            <span class="arow1">
              <span class="aname">{{ address.name }}</span>
              <span class="aphone">{{ maskPhone(address.phone) }}</span>
              <span v-if="address.isDefault" class="atag">默认</span>
            </span>
            <span class="aline">{{ address.region }} {{ address.detail }}</span>
          </span>
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke-width="2.2">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <!-- 空地址态 -->
        <button v-else class="addr" @click="router.push('/address')">
          <span class="aico">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M12 5v14M5 12h14" /></svg>
          </span>
          <span class="aempty">请选择收货地址（需完成实名认证）</span>
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke-width="2.2">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <div class="addr-hint">跨境清关需要：订购人、支付人、收货人实名信息须一致，下单后无法修改地址</div>
      <div v-if="address" class="real">
        <span class="rt">支付人实名</span>
        <span class="rv">
          <template v-if="realname">{{ realname.name }} · {{ realname.idcard }}</template>
          <template v-else>待认证：下单前需填写支付人姓名与身份证号</template>
        </span>
        <span v-if="realname" class="rok">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.6"><path d="M4 12.5l5 5L20 6.5" /></svg>
          已认证
        </span>
      </div>
    </div>

    <!-- 商品清单 -->
    <div class="card">
      <div class="shop">
        <span class="sname">WELLBIORA 海外旗舰店</span>
        <span class="stag">保税仓直发</span>
      </div>
      <div v-for="item in cart.checkedItems" :key="item.id" class="gitem">
        <div class="pic" :style="{ background: item.themeLight }">
          <img :src="item.img" :alt="item.name" />
        </div>
        <div class="info">
          <div class="gname">{{ item.name }}</div>
          <div class="spec">{{ item.spec }}</div>
        </div>
        <div class="right">
          <PriceText :price-fen="item.priceFen" class="gprice" />
          <div class="qty">×{{ item.quantity }}</div>
        </div>
      </div>
      <div class="gsum">
        共 {{ totalCount }} 件 · 小计 <PriceText :price-fen="totalFen" class="gprice" />
      </div>
    </div>

    <!-- 金额明细 -->
    <div class="card">
      <div class="c-head">
        <div>
          <div class="c-kick">Payment Details</div>
          <div class="c-title">金额明细</div>
        </div>
      </div>
      <div class="fee">
        <div class="frow">
          <span class="fl">商品金额</span>
          <span class="fr">¥{{ fenToYuan(totalFen) }}</span>
        </div>
        <div class="frow">
          <span class="fl">运费</span>
          <span class="fr free">免运费</span>
        </div>
        <div class="frow">
          <span class="fl">
            进口关税（跨境电商综合税）
            <button class="qico" aria-label="税费说明" @click="sheetTax = true">?</button>
          </span>
          <span class="fr free">商家承担</span>
        </div>
        <div class="frow">
          <span class="fl">支付方式</span>
          <span class="fr"><i class="wx-dot"></i>微信支付</span>
        </div>
        <div class="frow total">
          <span class="fl">实付金额</span>
          <PriceText :price-fen="totalFen" />
        </div>
      </div>
      <div class="fnote">
        根据跨境电商零售进口政策，本单税费由商家承担；个人年度交易限值 ¥26000，单笔限值 ¥5000。
      </div>
    </div>

    <!-- 协议勾选 -->
    <div class="agree">
      <button class="ck" :class="{ on: agreed }" aria-label="同意协议" @click="agreed = !agreed">
        <i>
          <svg viewBox="0 0 24 24" fill="none" stroke-width="3.4"><path d="M4 12.5l5 5L20 6.5" /></svg>
        </i>
      </button>
      <div>
        我已阅读并同意<a href="javascript:void(0)" @click="openDoc('notice')">《跨境电子商务零售进口商品告知书》</a>与<a
          href="javascript:void(0)"
          @click="openDoc('service')"
          >《用户服务协议》</a
        >
      </div>
    </div>

    <!-- 页脚合规小字 -->
    <div class="foot">
      <div class="en">WELLBIORA™ LIPOSOMAL NUTRITION</div>
      <div>欧洲制造 · 义乌保税仓直发（1210 保税备货）</div>
    </div>
  </div>

  <!-- 底部支付栏 -->
  <div class="paybar">
    <div class="ptotal">
      <div>
        <span class="t">合计：</span>
        <PriceText :price-fen="totalFen" style="font-size: 22px" />
      </div>
      <div class="n">共 {{ totalCount }} 件 · 含进口税（商家承担）</div>
    </div>
    <button class="pay" :disabled="paying" @click="onPay">
      {{ paying ? '提交中…' : `微信支付 ¥${fenToYuan(totalFen)}` }}
    </button>
  </div>

  <!-- 遮罩 -->
  <div class="mask" :class="{ show: maskShow }" @click="closeSheets"></div>

  <!-- 协议正文弹层 -->
  <div class="sheet" :class="{ show: sheetDoc !== null }">
    <div class="s-kick">Terms &amp; Policies</div>
    <div class="s-title">{{ sheetDoc ? DOCS[sheetDoc].title : '' }}</div>
    <!-- 协议正文为站内固定文案（原型 checkout.html DOCS），非用户输入 -->
    <div class="doc-body" v-html="sheetDoc ? DOCS[sheetDoc].body : ''"></div>
    <button class="s-btn" @click="agreeAndClose">已阅读并同意</button>
    <button class="s-btn ghost" @click="closeSheets">关闭</button>
  </div>

  <!-- 税费说明弹层 -->
  <div class="sheet" :class="{ show: sheetTax }">
    <div class="s-kick">Import Tax</div>
    <div class="s-title">进口关税说明</div>
    <div class="s-desc">
      跨境电商零售进口商品按政策征收跨境电商综合税，<br />本店所有商品税费均由商家承担，您支付的价格即为到手价。<br /><br />政策限值：单笔订单 ≤ ¥5000，个人年度累计 ≤ ¥26000。
    </div>
    <button class="s-btn" @click="closeSheets">我知道了</button>
  </div>
</template>

<style scoped>
/* ===== 样式移植自 prototype/app/checkout.html（设计规范 v0.3）===== */
.page {
  min-height: 100dvh;
  background: #f7f5f0;
  /* 底部预留：支付栏 64px + 安全区 */
  padding-bottom: calc(64px + env(safe-area-inset-bottom) + 20px);
}

/* ---------- 顶部导航栏 ---------- */
.navbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  height: calc(48px + env(safe-area-inset-top));
  padding: env(safe-area-inset-top) 4px 0;
  background: #f7f5f0;
  border-bottom: 1px solid #eae6df;
}
.back {
  width: 44px;
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1a1a1a;
  cursor: pointer;
}
.back svg {
  width: 22px;
  height: 22px;
}
.title {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
}
.gap {
  width: 44px;
  flex-shrink: 0;
}

/* ---------- 公告条 ---------- */
.notice {
  margin: 12px 12px 0;
  background: #d9ede2;
  color: #033b3c;
  font-size: 12px;
  border-radius: 999px;
  padding: 8px 14px;
  white-space: nowrap;
  overflow: hidden;
}

/* ---------- 卡片通用 ---------- */
.card {
  margin: 12px 12px 0;
  background: #fff;
  border-radius: 16px;
  padding: 14px;
}
.c-kick {
  font-family: var(--font-serif);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
}
.c-title {
  font-size: 15px;
  font-weight: 700;
  margin-top: 4px;
}
.c-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

/* ---------- 地址卡 ---------- */
.addr {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: 0;
}
.aico {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #d9ede2;
  display: flex;
  align-items: center;
  justify-content: center;
}
.aico svg {
  width: 17px;
  height: 17px;
  stroke: #033b3c;
}
.abody {
  flex: 1;
  min-width: 0;
}
.arow1 {
  display: flex;
  align-items: center;
  gap: 8px;
}
.aname {
  font-size: 15px;
  font-weight: 700;
}
.aphone {
  font-size: 13px;
  color: #6b6660;
}
.atag {
  font-size: 10px;
  color: #033b3c;
  background: #d9ede2;
  border-radius: 4px;
  padding: 2px 6px;
}
.aline {
  display: block;
  font-size: 13px;
  color: #6b6660;
  line-height: 1.5;
  margin-top: 5px;
}
.arrow {
  width: 14px;
  height: 14px;
  stroke: #a8a29a;
  flex-shrink: 0;
}
.aempty {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #033b3c;
  padding: 4px 0;
}
/* 薄荷绿重要提示（规范：下单后无法修改地址） */
.addr-hint {
  margin-top: 12px;
  background: #d9ede2;
  color: #033b3c;
  font-size: 11px;
  line-height: 1.6;
  border-radius: 10px;
  padding: 8px 12px;
}

/* ---------- 实名信息（三单对碰） ---------- */
.real {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eae6df;
}
.rt {
  font-size: 13px;
  color: #6b6660;
}
.rv {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}
.rok {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #2ba471;
  flex-shrink: 0;
}
.rok svg {
  width: 13px;
  height: 13px;
  stroke: #2ba471;
}

/* ---------- 商品清单 ---------- */
.shop {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stag {
  font-size: 10px;
  color: #033b3c;
  background: #d9ede2;
  border-radius: 4px;
  padding: 2px 6px;
}
.sname {
  font-size: 14px;
  font-weight: 700;
}
.gitem {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
}
.gitem .pic {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.gitem .pic img {
  width: 88%;
  height: 88%;
  object-fit: contain;
  mix-blend-mode: multiply;
  display: block;
}
.gitem .info {
  flex: 1;
  min-width: 0;
}
.gname {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
}
.spec {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 3px;
}
.right {
  text-align: right;
  flex-shrink: 0;
}
/* 商品清单价格 16px（原型 .gitem .price） */
.gprice {
  font-size: 16px;
}
.qty {
  font-size: 11px;
  color: #a8a29a;
  margin-top: 6px;
}
.gsum {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eae6df;
  font-size: 12px;
  color: #6b6660;
}

/* ---------- 金额明细 ---------- */
.fee {
  margin-top: 10px;
}
.frow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  font-size: 13px;
}
.fl {
  color: #6b6660;
  display: flex;
  align-items: center;
  gap: 5px;
}
.fr {
  font-weight: 600;
}
.fr.free {
  color: #033b3c;
  font-weight: 400;
}
.frow.total {
  border-top: 1px solid #eae6df;
  margin-top: 6px;
  padding-top: 12px;
}
.frow.total .fl {
  color: #1a1a1a;
  font-weight: 700;
  font-size: 14px;
}
.fnote {
  font-size: 10px;
  color: #a8a29a;
  line-height: 1.6;
  margin-top: 6px;
}
/* 微信支付绿小圆点 */
.wx-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #07c160;
  margin-right: 5px;
  vertical-align: 1px;
}
/* 税费信息小问号 */
.qico {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 1px solid #a8a29a;
  color: #a8a29a;
  font-size: 9px;
  line-height: 12px;
  text-align: center;
  background: none;
  cursor: pointer;
  padding: 0;
}

/* ---------- 协议勾选 ---------- */
.agree {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 14px 16px 0;
  font-size: 12px;
  color: #6b6660;
  line-height: 1.7;
}
.agree .ck {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  margin: -12px 0 0 -10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
}
.agree .ck i {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid #a8a29a;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease-out;
}
.agree .ck.on i {
  background: #033b3c;
  border-color: #033b3c;
}
.agree .ck i svg {
  width: 11px;
  height: 11px;
  stroke: #fff;
  opacity: 0;
  transition: opacity 0.15s;
}
.agree .ck.on i svg {
  opacity: 1;
}
.agree a {
  color: #033b3c;
  font-weight: 600;
}

/* ---------- 页脚合规小字 ---------- */
.foot {
  margin-top: 24px;
  text-align: center;
  font-size: 10px;
  color: #a8a29a;
  line-height: 1.8;
}
.foot .en {
  font-family: var(--font-serif);
  letter-spacing: 0.14em;
}

/* ---------- 底部支付栏 ---------- */
.paybar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-top: 1px solid #eae6df;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  z-index: 50;
}
.ptotal {
  flex: 1;
  line-height: 1.2;
}
.ptotal .t {
  font-size: 11px;
  color: #6b6660;
}
.ptotal .n {
  font-size: 10px;
  color: #a8a29a;
}
.pay {
  width: 132px;
  height: 48px;
  border: none;
  border-radius: 999px;
  background: #033b3c;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.pay:active {
  transform: scale(0.97);
}
.pay:disabled {
  opacity: 0.6;
}

/* ---------- 底部弹层 ---------- */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s;
  z-index: 80;
}
.mask.show {
  opacity: 1;
  pointer-events: auto;
}
.sheet {
  position: fixed;
  left: 50%;
  transform: translate(-50%, 100%);
  bottom: 0;
  width: 100%;
  max-width: 480px;
  background: #f7f5f0;
  border-radius: 20px 20px 0 0;
  padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
  transition: transform 0.3s ease-out;
  z-index: 81;
}
.sheet.show {
  transform: translate(-50%, 0);
}
.s-kick {
  font-family: var(--font-serif);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
  text-align: center;
}
.s-title {
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  margin-top: 5px;
}
.s-desc {
  font-size: 12px;
  color: #6b6660;
  text-align: center;
  margin-top: 10px;
  line-height: 1.7;
}
.s-btn {
  display: block;
  width: 100%;
  height: 48px;
  margin-top: 16px;
  background: #033b3c;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: 999px;
  cursor: pointer;
}
.s-btn:active {
  transform: scale(0.98);
}
.s-btn.ghost {
  background: none;
  color: #6b6660;
  font-weight: 400;
  margin-top: 4px;
}
/* 协议正文容器（可滚动） */
.doc-body {
  max-height: 50dvh;
  overflow-y: auto;
  margin-top: 14px;
  background: #fff;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 12px;
  color: #6b6660;
  line-height: 1.8;
  text-align: left;
}
.doc-body :deep(p + p) {
  margin-top: 6px;
}
</style>
