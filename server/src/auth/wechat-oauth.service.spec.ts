import type { WechatPayConfig } from '../payments/wechat-pay.config'
import { InMemoryUsersRepository } from '../users/users.repository'

import { WechatOAuthService } from './wechat-oauth.service'

describe('WechatOAuthService', () => {
  const config: WechatPayConfig = {
    appId: 'wx2591892b548a6565',
    appSecret: 'secret',
    mchId: '1117333649',
    serialNo: 'SERIAL',
    privateKeyPem: 'unused',
    apiV3Key: '12345678901234567890123456789012',
    apiV2Key: null,
    notifyUrl: 'https://wellbiora.com.cn/api/v1/payments/wechat/notify',
    refundNotifyUrl: 'https://wellbiora.com.cn/api/v1/payments/wechat/refund-notify',
    customsCode: null,
    mchCustomsNo: null,
  }

  let users: InMemoryUsersRepository

  beforeEach(() => {
    users = new InMemoryUsersRepository()
  })

  it('生成 snsapi_base 静默授权链接，回跳地址用站点源拼接站内路径', () => {
    const service = new WechatOAuthService(config, users)
    const url = service.buildAuthorizeUrl('/#/order/WB20260910ABC')
    expect(url).toContain('https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx2591892b548a6565')
    expect(url).toContain(`redirect_uri=${encodeURIComponent('https://wellbiora.com.cn/#/order/WB20260910ABC')}`)
    expect(url).toContain('scope=snsapi_base')
  })

  it('拒绝站外 redirect（防开放重定向）', () => {
    const service = new WechatOAuthService(config, users)
    expect(() => service.buildAuthorizeUrl('https://evil.com')).toThrow(/站内相对路径/)
    expect(() => service.buildAuthorizeUrl('//evil.com')).toThrow(/站内相对路径/)
  })

  it('未配置微信支付时接口不可用', () => {
    const service = new WechatOAuthService(null, users)
    expect(service.isEnabled()).toBe(false)
    expect(() => service.buildAuthorizeUrl('/')).toThrow(/微信支付未配置/)
  })

  it('code 换 openid 成功后幂等写入用户', async () => {
    const user = await users.create('13800000000')
    const service = new WechatOAuthService(config, users)
    service.fetchImpl = (async (url: string | URL) => {
      expect(String(url)).toContain('https://api.weixin.qq.com/sns/oauth2/access_token')
      expect(String(url)).toContain('code=test-code')
      return new Response(JSON.stringify({ openid: 'openid-abc' }), { status: 200 })
    }) as typeof fetch

    await service.bindOpenId(user.id, 'test-code')
    expect((await users.findById(user.id))?.wechatOpenId).toBe('openid-abc')
  })

  it('微信返回错误码时抛业务异常', async () => {
    const service = new WechatOAuthService(config, users)
    service.fetchImpl = (async () =>
      new Response(JSON.stringify({ errcode: 40029, errmsg: 'invalid code' }), { status: 200 })) as typeof fetch
    await expect(service.bindOpenId('user-1', 'bad-code')).rejects.toMatchObject({ code: 40002 })
  })
})
