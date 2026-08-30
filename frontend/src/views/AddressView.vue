<script setup lang="ts">
/**
 * 地址+实名页（路由 /address）
 * 视觉 1:1 来源：prototype/app/address.html
 * mock 阶段：进入时回填默认地址；保存仅 Toast 不落库
 * TODO(联调)：保存时接 POST /addresses（收货地址）与 POST /realname（支付人实名）
 */
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { createAddress, getAddresses, saveRealname, updateAddress } from '@/api'

const router = useRouter()

/* ---------- 表单状态 ---------- */
const name = ref('')
const phone = ref('')
const region = ref('')
const detail = ref('')
const idcard = ref('')
const pasteText = ref('')
const loadedAddressId = ref('')

/** 三单对碰：支付人与收货人为同一人（默认开启，支付人姓名自动同步） */
const samePerson = ref(true)
const payer = ref('')

watch(name, (v) => {
  if (samePerson.value) payer.value = v
})

function toggleSame() {
  samePerson.value = !samePerson.value
  if (samePerson.value) {
    payer.value = name.value
  } else if (payer.value === name.value) {
    payer.value = ''
  }
}

/** 字段错误信息（key: 字段名，value: 错误提示） */
const errors = reactive<Record<string, string>>({})
function clearErrors() {
  Object.keys(errors).forEach((k) => delete errors[k])
}

/* 进入时回填默认地址（实名信息接口返回为脱敏数据，不回填身份证号） */
onMounted(async () => {
  const addrs = await getAddresses()
  const def = addrs.find((a) => a.isDefault) ?? addrs[0]
  if (def) {
    loadedAddressId.value = def.id
    name.value = def.name
    phone.value = def.phone
    region.value = def.region
    detail.value = def.detail
    payer.value = def.name
  }
})

/* ---------- 智能粘贴识别（演示级解析，逻辑与原型一致） ---------- */
/** 可识别的省市区预设（正式版由地区库/后端解析服务替代） */
const REGIONS = [
  '浙江省 金华市 义乌市',
  '浙江省 杭州市 西湖区',
  '上海市 上海市 浦东新区',
  '北京市 北京市 朝阳区',
  '四川省 成都市 武侯区',
]

function smartParse() {
  let text = pasteText.value.trim()
  if (!text) {
    showToast('请先粘贴地址信息')
    return
  }

  // 1. 提取手机号
  let p = ''
  const pm = text.match(/1[3-9]\d{9}/)
  if (pm) {
    p = pm[0]
    text = text.replace(p, ' ')
  }

  // 2. 匹配地区（取预设中包含度最高的）
  let r = ''
  let rest = text
  for (const candidate of REGIONS) {
    const parts = candidate.split(' ')
    if (parts.every((part) => text.includes(part.replace(/[省市]/, '')))) {
      r = candidate
      parts.forEach((part) => {
        rest = rest.replace(new RegExp(part + '|' + part.replace(/[省市]$/, '')), ' ')
      })
      break
    }
  }

  // 3. 姓名：剩余文本开头的 2~4 个连续中文
  let n = ''
  const nm = rest.replace(/[，,.\s]+/g, ' ').trim().match(/^[一-龥]{2,4}(?=\s|$)/)
  if (nm) {
    n = nm[0]
    rest = rest.replace(n, ' ')
  }

  // 4. 其余为详细地址
  const d = rest.replace(/[，,.\s]+/g, ' ').trim()

  if (n) name.value = n
  if (p) phone.value = p
  if (r) region.value = r
  if (d) detail.value = d
  clearErrors()
  showToast('识别完成，请核对信息')
}

/* ---------- 地区选择弹层 ---------- */
const regionSheet = ref(false)
function pickRegion(r: string) {
  region.value = r
  regionSheet.value = false
}

/* ---------- 校验 + 保存 ---------- */
async function onSave() {
  clearErrors()
  const n = name.value.trim()
  const p = phone.value.trim()
  const r = region.value
  const d = detail.value.trim()
  const py = (samePerson.value ? name.value : payer.value).trim()
  const idc = idcard.value.trim()

  if (!n) {
    errors.name = '请输入收货人真实姓名'
    showToast('请完善收货人姓名')
    return
  }
  if (!/^1[3-9]\d{9}$/.test(p)) {
    showToast('请输入正确的 11 位手机号')
    return
  }
  if (!r) {
    showToast('请选择所在地区')
    return
  }
  if (!d) {
    showToast('请填写详细地址')
    return
  }
  if (!py) {
    showToast('请输入支付人真实姓名')
    return
  }
  if (!/^\d{17}[\dXx]$/.test(idc)) {
    errors.idcard = '身份证号格式不正确（18 位，末位可为 X）'
    showToast('身份证号格式不正确')
    return
  }
  // 三单对碰：同一人模式下姓名强一致（前端提示，后端复核）
  if (samePerson.value && py !== n) {
    showToast('支付人与收货人姓名须一致')
    return
  }

  try {
    const addressInput = { name: n, phone: p, region: r, detail: d, isDefault: true }
    const savedAddress = loadedAddressId.value
      ? await updateAddress(loadedAddressId.value, addressInput)
      : await createAddress(addressInput)
    loadedAddressId.value = savedAddress.id
    await saveRealname({ name: py, idcard: idc })
    showToast('已保存')
    setTimeout(() => router.back(), 900)
  } catch (e) {
    showToast(e instanceof Error ? e.message : '保存失败，请重试')
  }
}
</script>

<template>
  <div class="page">
    <!-- 顶部导航 -->
    <div class="navbar">
      <a class="back" aria-label="返回" @click="router.back()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </a>
      <div class="title">地址与实名</div>
      <div class="gap"></div>
    </div>

    <!-- 薄荷绿重要提示（规范：下单后无法修改地址） -->
    <div class="mint-hint">跨境清关需要：请确保收货人、支付人实名信息真实一致，下单后无法修改地址</div>

    <!-- 收货人信息卡 -->
    <div class="card">
      <div class="c-head">
        <div>
          <div class="c-kick">Consignee</div>
          <div class="c-title">收货人信息</div>
        </div>
      </div>

      <div class="field" :class="{ err: errors.name }">
        <div class="f-label">收货人姓名<span class="req">*</span></div>
        <div class="f-row">
          <input v-model="name" class="f-input" placeholder="请输入真实姓名" maxlength="20" />
        </div>
        <div class="f-hint">{{ errors.name || '需与身份证姓名一致，海关清关申报使用' }}</div>
      </div>

      <div class="field">
        <div class="f-label">手机号码<span class="req">*</span></div>
        <div class="f-row">
          <input
            v-model="phone"
            class="f-input"
            type="tel"
            placeholder="用于接收物流与清关通知"
            maxlength="11"
          />
        </div>
      </div>

      <div class="field">
        <div class="f-label">所在地区<span class="req">*</span></div>
        <div class="f-row">
          <button class="f-pick" :class="{ ph: !region }" @click="regionSheet = true">
            {{ region || '省 / 市 / 区' }}
          </button>
          <svg class="f-arrow" viewBox="0 0 24 24" fill="none" stroke-width="2.2">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </div>
      </div>

      <div class="field">
        <div class="f-label">详细地址<span class="req">*</span></div>
        <div class="f-row">
          <textarea
            v-model="detail"
            class="f-input"
            placeholder="街道、小区、楼栋、门牌号等"
            maxlength="120"
          ></textarea>
        </div>
      </div>

      <!-- 智能粘贴识别 -->
      <div class="paste-box">
        <textarea v-model="pasteText" placeholder="粘贴完整地址信息，自动识别姓名、电话与地址"></textarea>
        <div class="p-row">
          <span class="p-hint">如：王小也 13888888888 浙江省金华市义乌市……</span>
          <button class="p-btn" @click="smartParse">智能识别</button>
        </div>
      </div>
    </div>

    <!-- 支付人实名信息卡 -->
    <div class="card">
      <div class="c-head">
        <div>
          <div class="c-kick">Payer Identity</div>
          <div class="c-title">支付人实名信息</div>
        </div>
      </div>

      <div class="same-row">
        <div>
          支付人与收货人为同一人
          <div class="s-sub">海关要求订购人、支付人、收货人实名一致</div>
        </div>
        <button
          class="switch"
          :class="{ on: samePerson }"
          aria-label="同一人开关"
          @click="toggleSame"
        ></button>
      </div>

      <div class="field">
        <div class="f-label">支付人姓名<span class="req">*</span></div>
        <div class="f-row">
          <input
            v-model="payer"
            class="f-input"
            placeholder="请输入真实姓名"
            maxlength="20"
            :disabled="samePerson"
          />
        </div>
        <div class="f-hint">{{ samePerson ? '已同步收货人姓名' : '支付人姓名须与微信支付实名一致' }}</div>
      </div>

      <div class="field" :class="{ err: errors.idcard }">
        <div class="f-label">身份证号<span class="req">*</span></div>
        <div class="f-row">
          <input v-model="idcard" class="f-input" placeholder="用于海关申报，加密存储" maxlength="18" />
        </div>
        <div class="f-hint">
          {{ errors.idcard || '仅用于跨境电商清关申报，平台加密存储，不会用于其他用途' }}
        </div>
      </div>
    </div>
  </div>

  <!-- 底部保存栏 -->
  <div class="savebar">
    <button class="save" @click="onSave">保存并使用</button>
  </div>

  <!-- 遮罩 + 地区选择弹层 -->
  <div class="mask" :class="{ show: regionSheet }" @click="regionSheet = false"></div>
  <div class="sheet" :class="{ show: regionSheet }">
    <div class="s-kick">Region</div>
    <div class="s-title">选择所在地区</div>
    <button v-for="r in REGIONS" :key="r" class="doc-item" @click="pickRegion(r)">
      {{ r }}
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2"><path d="M9 6l6 6-6 6" /></svg>
    </button>
  </div>
</template>

<style scoped>
/* ===== 样式移植自 prototype/app/address.html（设计规范 v0.3）===== */
.page {
  min-height: 100dvh;
  background: #f7f5f0;
  /* 底部预留：保存栏 64px + 安全区 */
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

/* ---------- 表单项（规范：标签 14px/600 + 底部 1px 分割线） ---------- */
.field {
  padding: 12px 0 0;
}
.f-label {
  font-size: 14px;
  font-weight: 600;
}
.f-label .req {
  color: #e6432d;
  margin-left: 2px;
}
.f-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #eae6df;
  padding: 8px 0;
}
.f-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: none;
  font-size: 15px;
  color: #1a1a1a;
  font-family: inherit;
  height: 28px;
  padding: 0;
}
.f-input::placeholder {
  color: #a8a29a;
}
textarea.f-input {
  height: auto;
  min-height: 56px;
  line-height: 1.6;
  resize: none;
}
.f-hint {
  font-size: 12px;
  color: #a8a29a;
  margin-top: 6px;
  line-height: 1.5;
}
.field.err .f-row {
  border-bottom-color: #d54941;
}
.field.err .f-hint {
  color: #d54941;
}
.f-arrow {
  width: 14px;
  height: 14px;
  stroke: #a8a29a;
  flex-shrink: 0;
}
.f-pick {
  flex: 1;
  min-width: 0;
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 15px;
  color: #1a1a1a;
  height: 28px;
  padding: 0;
  font-family: inherit;
}
.f-pick.ph {
  color: #a8a29a;
}

/* ---------- 智能粘贴识别 ---------- */
.paste-box {
  margin-top: 12px;
}
.paste-box textarea {
  width: 100%;
  border: 1px dashed #a8a29a;
  border-radius: 10px;
  background: #f7f5f0;
  font-size: 13px;
  color: #1a1a1a;
  font-family: inherit;
  line-height: 1.6;
  padding: 10px 12px;
  min-height: 64px;
  resize: none;
  outline: none;
}
.paste-box textarea:focus {
  border-color: #033b3c;
}
.p-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.p-hint {
  font-size: 11px;
  color: #a8a29a;
}
.p-btn {
  height: 34px;
  padding: 0 18px;
  background: #d9ede2;
  color: #033b3c;
  font-size: 13px;
  font-weight: 600;
  border: none;
  border-radius: 999px;
  cursor: pointer;
}
.p-btn:active {
  transform: scale(0.96);
}

/* ---------- 薄荷绿重要提示（规范：下单后无法修改地址） ---------- */
.mint-hint {
  margin: 12px 12px 0;
  background: #d9ede2;
  color: #033b3c;
  font-size: 11px;
  line-height: 1.6;
  border-radius: 10px;
  padding: 8px 12px;
}

/* ---------- 同一人开关（三单对碰） ---------- */
.same-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 2px;
  font-size: 14px;
  font-weight: 600;
}
.s-sub {
  font-size: 11px;
  color: #a8a29a;
  font-weight: 400;
  margin-top: 3px;
}
.switch {
  width: 46px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  background: #eae6df;
  position: relative;
  transition: background 0.2s;
}
.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.switch.on {
  background: #033b3c;
}
.switch.on::after {
  transform: translateX(18px);
}

/* ---------- 底部保存栏 ---------- */
.savebar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-top: 1px solid #eae6df;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  z-index: 50;
}
.save {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 999px;
  background: #033b3c;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.save:active {
  transform: scale(0.98);
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
.doc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: #fff;
  border: none;
  cursor: pointer;
  border-radius: 12px;
  padding: 14px;
  margin-top: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  font-family: inherit;
}
.doc-item:active {
  opacity: 0.6;
}
.doc-item svg {
  width: 14px;
  height: 14px;
  stroke: #a8a29a;
}
</style>
