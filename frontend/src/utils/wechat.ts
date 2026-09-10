/**
 * 微信环境工具：UA 判断 + JSAPI 调起。
 * 调起用公众号 webview 原生的 WeixinJSBridge（无需 jweixin wx.config）。
 */

/** 微信内置浏览器判断 */
export function isWeChatBrowser(userAgent: string = navigator.userAgent): boolean {
  return /MicroMessenger/i.test(userAgent)
}

/** 后端返回的微信 JSAPI 调起参数（provider=wechat） */
export interface WechatJsapiParams {
  appId: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

export type JsapiPayResult = 'success' | 'cancel' | 'fail'

interface WeixinJSBridgeLike {
  invoke(
    method: 'getBrandWCPayRequest',
    params: Record<string, string>,
    callback: (res: { err_msg?: string }) => void,
  ): void
}

declare global {
  interface Window {
    WeixinJSBridge?: WeixinJSBridgeLike
  }
}

/** 调起微信支付；resolve 结果：success 支付完成 / cancel 用户取消 / fail 失败或环境不支持 */
export function invokeWechatJsapiPay(params: WechatJsapiParams, bridgeOverride?: WeixinJSBridgeLike): Promise<JsapiPayResult> {
  return new Promise((resolve) => {
    const bridge = bridgeOverride ?? (globalThis as { WeixinJSBridge?: WeixinJSBridgeLike }).WeixinJSBridge
    if (!bridge) {
      resolve('fail')
      return
    }
    bridge.invoke(
      'getBrandWCPayRequest',
      {
        appId: params.appId,
        timeStamp: params.timeStamp,
        nonceStr: params.nonceStr,
        package: params.package,
        signType: params.signType,
        paySign: params.paySign,
      },
      (res) => {
        const msg = res?.err_msg ?? ''
        if (msg === 'get_brand_wcpay_request:ok') resolve('success')
        else if (msg === 'get_brand_wcpay_request:cancel') resolve('cancel')
        else resolve('fail')
      },
    )
  })
}
