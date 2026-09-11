/**
 * 微信支付编排：取支付参数 →（缺授权则跳转公众号静默授权）→ WeixinJSBridge 调起。
 * 授权回跳（URL 带 code）由 handleAuthCallback 处理：绑定 openid 后自动续起待支付订单。
 */
import { useRoute, useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'

import {
  bindWechatOpenId,
  getPayParams,
  getWechatAuthorizeUrl,
  USE_MOCK_MODE,
  type PayParams,
} from '@/api'
import { invokeWechatJsapiPay, isWeChatBrowser, type WechatJsapiParams } from '@/utils/wechat'

const PENDING_PAY_KEY = 'wb_pending_pay_order'

/** 业务码 40007：后端已启用微信支付但当前用户还没有 openid */
const NEED_WECHAT_AUTH_CODE = 40007

export function useWechatPay() {
  const route = useRoute()
  const router = useRouter()

  /** 去支付主入口；onPaid 在确认支付成功后回调（页面用来刷新订单） */
  async function payOrder(orderNo: string, onPaid?: () => void): Promise<void> {
    if (USE_MOCK_MODE) {
      showToast('拉起微信支付（mock）')
      return
    }
    if (!isWeChatBrowser()) {
      await showOutsideWechatGuide()
      return
    }

    let params: PayParams
    try {
      params = await getPayParams(orderNo)
    } catch (error) {
      if ((error as { code?: number }).code === NEED_WECHAT_AUTH_CODE) {
        await redirectToWechatAuth(orderNo)
        return
      }
      showToast(error instanceof Error ? error.message : '获取支付参数失败')
      return
    }

    if (params.provider === 'mock') {
      showToast(params.message ?? '本地联调订单，请在测试接口确认支付')
      return
    }

    const result = await invokeWechatJsapiPay(params as unknown as WechatJsapiParams)
    if (result === 'success') {
      showToast('支付成功')
      onPaid?.()
    } else if (result === 'cancel') {
      showToast('支付已取消，订单仍保留')
    } else {
      showToast('支付未完成，请重试')
    }
  }

  /** 跳转微信静默授权；记住待支付订单号，授权回跳后自动续付 */
  async function redirectToWechatAuth(orderNo: string): Promise<void> {
    try {
      sessionStorage.setItem(PENDING_PAY_KEY, orderNo)
      const { url } = await getWechatAuthorizeUrl(`/#${route.fullPath}`)
      window.location.href = url
    } catch (error) {
      sessionStorage.removeItem(PENDING_PAY_KEY)
      showToast(error instanceof Error ? error.message : '微信授权不可用')
    }
  }

  /**
   * 授权回跳处理：绑定 openid。
   * 微信回跳会把 code 拼在 redirect_uri 的 # 前面（真实 query）或 hash query 里，两处都要读；
   * 读完两侧都清掉，避免刷新后拿同一个 code 重复绑定。
   * 返回续付的订单号（无则 null）；页面应随后刷新订单数据。
   */
  async function handleAuthCallback(): Promise<string | null> {
    const searchParams = new URLSearchParams(window.location.search)
    const codeFromSearch = searchParams.get('code')
    const code = codeFromSearch ?? (typeof route.query.code === 'string' ? route.query.code : null)
    if (!code) return null
    try {
      await bindWechatOpenId(code)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '微信授权失败，请重试')
    }
    // 清真实 query 里的 code/state（不改变 hash 路由，不触发导航）
    if (codeFromSearch) {
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      url.searchParams.delete('state')
      window.history.replaceState(null, '', `${url.pathname}${url.hash}`)
    }
    // 清 hash query 里的 code/state
    const query = { ...route.query }
    delete query.code
    delete query.state
    await router.replace({ query })
    const pendingOrderNo = sessionStorage.getItem(PENDING_PAY_KEY)
    sessionStorage.removeItem(PENDING_PAY_KEY)
    return pendingOrderNo
  }

  return { payOrder, handleAuthCallback }
}

/** 微信外浏览器：引导去微信打开 */
async function showOutsideWechatGuide(): Promise<void> {
  try {
    await showDialog({
      title: '请在微信中完成支付',
      message: '当前浏览器暂不支持微信支付，请复制链接后在微信中打开',
      confirmButtonText: '复制链接',
      cancelButtonText: '知道了',
      showCancelButton: true,
    })
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast('链接已复制，去微信粘贴打开')
    } catch {
      showToast('复制失败，请手动复制地址栏链接')
    }
  } catch {
    // 用户点了「知道了」
  }
}
