import { describe, expect, it } from 'vitest'

import { invokeWechatJsapiPay, isWeChatBrowser, type WechatJsapiParams } from './wechat'

const params: WechatJsapiParams = {
  appId: 'wx2591892b548a6565',
  timeStamp: '1725000000',
  nonceStr: 'nonce',
  package: 'prepay_id=wx-123',
  signType: 'RSA',
  paySign: 'sign',
}

describe('isWeChatBrowser', () => {
  it('识别微信内置浏览器 UA', () => {
    expect(isWeChatBrowser('Mozilla/5.0 (iPhone) MicroMessenger/8.0.49')).toBe(true)
  })

  it('普通浏览器返回 false', () => {
    expect(isWeChatBrowser('Mozilla/5.0 (iPhone) Safari/604.1')).toBe(false)
  })
})

describe('invokeWechatJsapiPay', () => {
  function stubBridge(result: string) {
    return {
      invoke: (_method: string, p: Record<string, string>, callback: (res: { err_msg?: string }) => void) => {
        expect(p.package).toBe('prepay_id=wx-123')
        callback({ err_msg: result })
      },
    } as never
  }

  it('err_msg=ok 视为支付成功', async () => {
    await expect(invokeWechatJsapiPay(params, stubBridge('get_brand_wcpay_request:ok'))).resolves.toBe('success')
  })

  it('err_msg=cancel 视为用户取消', async () => {
    await expect(invokeWechatJsapiPay(params, stubBridge('get_brand_wcpay_request:cancel'))).resolves.toBe('cancel')
  })

  it('其他 err_msg 视为失败', async () => {
    await expect(invokeWechatJsapiPay(params, stubBridge('get_brand_wcpay_request:fail'))).resolves.toBe('fail')
  })

  it('无 WeixinJSBridge 环境直接失败', async () => {
    await expect(invokeWechatJsapiPay(params)).resolves.toBe('fail')
  })
})
