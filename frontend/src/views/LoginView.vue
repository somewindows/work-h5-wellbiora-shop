<script setup lang="ts">
/**
 * 登录/注册页（路由 /login，手机号 + 验证码免密登录，无密码）
 * 视觉来源：prototype/app/login.html（品牌深绿系 + 杂志式标题 + 表单白卡 + 协议弹层）
 * mock 阶段：sendSmsCode 直接成功，任意 6 位验证码可登录；受保护页面由全局路由守卫统一拦截
 */
import { onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { sendSmsCode } from '@/api'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const phone = ref('')
const code = ref('')
const agreed = ref(false) // 协议勾选（默认不勾选，同原型）
const counting = ref(false)
const countdown = ref(60)
const submitting = ref(false)

let timer: ReturnType<typeof setInterval> | undefined

/* 协议正文弹层 */
const docVisible = ref(false)
const docKey = ref<'service' | 'privacy'>('service')

/* 协议正文（精简版，正式上线前需法务审定全文；与原型 login.html DOCS 一致） */
const DOCS = {
  service: {
    title: '用户服务协议',
    body: [
      '一、服务内容：本店通过 H5 商城向您提供跨境膳食补充剂的浏览、下单、支付与配送服务；下单流程为：选购商品 → 填写收货地址与实名信息 → 微信支付 → 海关申报 → 保税仓发货。',
      '二、账号：本店以手机号作为账号唯一标识，通过短信验证码完成注册与登录，不设置登录密码。',
      '三、支付与退款：本店支持微信支付；退款按原支付路径退回，已提交海关申报的订单退款需人工审核处理。',
      '四、订单取消：未提交海关申报的订单可自助取消；已申报订单如需取消，请联系人工客服协助处理。',
      '五、售后政策：退款/售后暂由人工客服处理（服务时间每日 9:00–23:00），您可在「我的」页联系客服发起申请。',
      '六、合规声明：本店商品为膳食补充剂，并非药品，不能替代药物；商品使用效果因个体差异而不同。',
      '七、本协议如有更新将在本页面公示，继续使用本店服务即视为接受更新后的协议。',
    ],
  },
  privacy: {
    title: '隐私政策',
    body: [
      '一、信息收集：注册与登录时收集您的手机号，用于账号标识、登录验证与订单通知；下单环节另行收集的姓名与身份证号仅用于海关清关申报。',
      '二、信息存储：身份证号等敏感信息加密存储，手机号作为账号主键保存。',
      '三、信息使用与共享：我们不会向任何第三方出售您的个人信息；仅为完成订单履约（支付、清关、物流），向必要的服务方（微信支付、海关、保税仓、物流商）提供所必需的信息。',
      '四、信息保护：我们采取加密传输、访问控制等措施保护您的信息安全。',
      '五、您的权利：可通过人工客服查询、更正您的个人信息；注销账号请通过「我的 → 联系客服」发起，我们将在核实身份后处理。',
      '六、本政策如有更新将在本页面公示。',
    ],
  },
}

function openDoc(key: 'service' | 'privacy') {
  docKey.value = key
  docVisible.value = true
}

function validPhone(p: string) {
  return /^1\d{10}$/.test(p)
}

/** 发送验证码：校验手机号 → 60s 倒计时（mock 直接成功） */
async function onSendCode() {
  if (counting.value) return
  if (!validPhone(phone.value.trim())) {
    showToast('请输入正确的 11 位手机号')
    return
  }
  try {
    await sendSmsCode(phone.value.trim())
    showToast('验证码已发送（mock 阶段任意 6 位可登录）')
  } catch {
    showToast('验证码发送失败，请重试')
    return
  }
  counting.value = true
  countdown.value = 60
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      counting.value = false
    }
  }, 1000)
}

/** 登录：拦截顺序 手机号格式 → 验证码 → 协议勾选（同原型） */
async function onLogin() {
  const p = phone.value.trim()
  const c = code.value.trim()
  if (!validPhone(p)) {
    showToast('请输入正确的 11 位手机号')
    return
  }
  if (!/^\d{6}$/.test(c)) {
    showToast('请输入 6 位验证码')
    return
  }
  if (!agreed.value) {
    showToast('请先阅读并勾选相关协议')
    return
  }
  submitting.value = true
  try {
    await userStore.loginByCode(p, c)
    showToast('登录成功')
    // 跳回来源页（仅允许站内路径，防开放式跳转），默认回「我的」
    const from = route.query.from
    const target = typeof from === 'string' && from.startsWith('/') ? from : '/mine'
    setTimeout(() => router.replace(target), 600)
  } catch {
    showToast('登录失败，请重试')
  } finally {
    submitting.value = false
  }
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/mine')
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="page">
    <!-- 顶部导航：返回 + 居中 Logo -->
    <div class="navbar">
      <button class="back" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <img class="logo" src="/assets/logo-h.jpg" alt="WELLBIORA" />
      <div class="gap"></div>
    </div>

    <!-- 微信环境提示条（微信静默授权 snsapi_base 后续接入，mock 仅展示） -->
    <div class="notice">微信内打开可免登录</div>

    <!-- 标题区（杂志式） -->
    <div class="login-head">
      <div class="kick">Sign In / Sign Up</div>
      <div class="cn">登录 / 注册</div>
      <div class="sub">新用户验证手机号后将自动注册</div>
    </div>

    <!-- 登录表单（白卡无阴影） -->
    <div class="form">
      <div class="field">
        <input
          v-model="phone"
          type="tel"
          maxlength="11"
          inputmode="numeric"
          placeholder="请输入 11 位手机号"
          aria-label="手机号"
        />
      </div>
      <div class="field">
        <input
          v-model="code"
          type="tel"
          maxlength="6"
          inputmode="numeric"
          placeholder="请输入 6 位验证码"
          aria-label="验证码"
        />
        <button class="code-btn" :disabled="counting" @click="onSendCode">
          {{ counting ? `${countdown}s 后重发` : '获取验证码' }}
        </button>
      </div>
    </div>

    <!-- 登录主按钮（全圆角 999px / 高 48px） -->
    <button class="login-btn" :disabled="submitting" @click="onLogin">登录</button>

    <!-- 协议勾选（默认不勾选） -->
    <div class="agree">
      <button class="ck" :class="{ on: agreed }" aria-label="同意协议" @click="agreed = !agreed">
        <i>
          <svg viewBox="0 0 24 24" fill="none" stroke-width="3.4"><path d="M4 12.5l5 5L20 6.5" /></svg>
        </i>
      </button>
      <div>
        我已阅读并同意<a href="javascript:void(0)" @click="openDoc('service')">《用户服务协议》</a>和<a
          href="javascript:void(0)"
          @click="openDoc('privacy')"
        >《隐私政策》</a>
      </div>
    </div>

    <!-- 页脚合规小字 -->
    <div class="foot">
      <div class="en">WELLBIORA™ LIPOSOMAL NUTRITION</div>
      <div>实名信息（身份证）在下单结算时另行采集，仅用于海关清关</div>
    </div>

    <!-- 遮罩 + 协议正文弹层 -->
    <div class="mask" :class="{ show: docVisible }" @click="docVisible = false"></div>
    <div class="sheet" :class="{ show: docVisible }">
      <div class="s-kick">Terms &amp; Policies</div>
      <div class="s-title">{{ DOCS[docKey].title }}</div>
      <div class="doc-body">
        <p v-for="(p, i) in DOCS[docKey].body" :key="i">{{ p }}</p>
      </div>
      <button class="s-btn" @click="docVisible = false">关闭</button>
    </div>
  </div>
</template>

<style scoped>
/* 样式搬自 prototype/app/login.html（设计规范 v0.3 令牌） */
.page {
  min-height: 100dvh;
  background: #f7f5f0;
}

/* ---------- 顶部导航栏（标题位放 Logo） ---------- */
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
.navbar .back {
  width: 44px;
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: #1a1a1a;
  padding: 0;
}
.navbar .back svg {
  width: 22px;
  height: 22px;
}
.navbar .logo {
  flex: 1;
  height: 20px;
  width: auto;
  object-fit: contain;
  mix-blend-mode: multiply;
}
.navbar .gap {
  width: 44px;
  flex-shrink: 0;
}

/* ---------- 微信提示条（薄荷绿公告条，搬自 style.css .notice） ---------- */
.notice {
  margin: 10px 12px 0;
  background: #d9ede2;
  color: #033b3c;
  font-size: 12px;
  border-radius: 999px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ---------- 标题区 ---------- */
.login-head {
  padding: 28px 16px 6px;
}
.login-head .kick {
  font-family: var(--font-serif);
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
}
.login-head .cn {
  font-size: 26px;
  font-weight: 700;
  margin-top: 6px;
}
.login-head .sub {
  font-size: 12px;
  color: #6b6660;
  margin-top: 8px;
  line-height: 1.7;
}

/* ---------- 表单卡 ---------- */
.form {
  margin: 16px 12px 0;
  background: #fff;
  border-radius: 16px;
  padding: 4px 14px;
}
.field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 0;
}
.field + .field {
  border-top: 1px solid #eae6df;
}
.field input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: none;
  font-size: 15px;
  color: #1a1a1a;
  height: 24px;
  font-family: inherit;
}
.field input::placeholder {
  color: #a8a29a;
}
/* 获取验证码按钮（可点区域 ≥44px） */
.code-btn {
  flex-shrink: 0;
  min-width: 96px;
  height: 44px;
  margin-right: -8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #033b3c;
}
.code-btn:disabled {
  color: #a8a29a;
  font-weight: 400;
  cursor: default;
}

/* ---------- 登录主按钮 ---------- */
.login-btn {
  display: block;
  width: calc(100% - 24px);
  margin: 16px 12px 0;
  height: 48px;
  border: none;
  border-radius: 999px;
  background: #033b3c;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.login-btn:active {
  transform: scale(0.98);
}
.login-btn:disabled {
  opacity: 0.6;
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
  padding: 0;
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
  text-decoration: none;
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

/* ---------- 遮罩 + 协议正文弹层 ---------- */
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
.sheet .s-kick {
  font-family: var(--font-serif);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #a8a29a;
  text-align: center;
}
.sheet .s-title {
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  margin-top: 5px;
}
.sheet .doc-body {
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
.sheet .doc-body p + p {
  margin-top: 6px;
}
.sheet .s-btn {
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
.sheet .s-btn:active {
  transform: scale(0.98);
}
</style>
