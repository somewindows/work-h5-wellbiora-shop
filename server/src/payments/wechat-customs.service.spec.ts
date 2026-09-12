import { WechatCustomsService, signV2Md5 } from './wechat-customs.service'
import type { WechatPayConfig } from './wechat-pay.config'

describe('WechatCustomsService（自助清关报关）', () => {
  const config: WechatPayConfig = {
    appId: 'wx2591892b548a6565',
    appSecret: 'secret',
    mchId: '1117333649',
    serialNo: 'SERIAL',
    privateKeyPem: 'unused',
    apiV3Key: '12345678901234567890123456789012',
    apiV2Key: 'testapiv2key0123456789012345678',
    notifyUrl: 'https://wellbiora.com.cn/api/v1/payments/wechat/notify',
    refundNotifyUrl: 'https://wellbiora.com.cn/api/v1/payments/wechat/refund-notify',
    customsCode: 'ZONGSHU',
    mchCustomsNo: 'D00411',
    publicKeyPem: null,
    publicKeyId: null,
  }

  const input = {
    orderNo: 'WB20260910ABCDEF',
    transactionId: '4200000123456789012345678901',
    realname: { name: '张三', idcard: '110101199001011234' },
  }

  function xmlResponse(fields: Record<string, string>): Response {
    const body = `<xml>${Object.entries(fields).map(([key, value]) => `<${key}><![CDATA[${value}]]></${key}>`).join('')}</xml>`
    return new Response(body, { status: 200 })
  }

  function createService(fetchImpl: typeof fetch, cfg: WechatPayConfig = config): WechatCustomsService {
    const service = new WechatCustomsService(cfg)
    service.fetchImpl = fetchImpl
    return service
  }

  it('v2 密钥/海关代码/备案号任一缺失时报关能力关闭', () => {
    expect(new WechatCustomsService({ ...config, apiV2Key: null }).isEnabled()).toBe(false)
    expect(new WechatCustomsService({ ...config, customsCode: null }).isEnabled()).toBe(false)
    expect(new WechatCustomsService({ ...config, mchCustomsNo: null }).isEnabled()).toBe(false)
    expect(new WechatCustomsService(config).isEnabled()).toBe(true)
  })

  it('提交报关：XML 报文含必填字段与合法 MD5 签名', async () => {
    let capturedBody = ''
    const fetchImpl: typeof fetch = (async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('https://api.mch.weixin.qq.com/cgi-bin/mch/customs/customdeclareorder')
      capturedBody = String(init?.body ?? '')
      return xmlResponse({ return_code: 'SUCCESS', result_code: 'SUCCESS', state: 'SUBMITTED', cert_check_result: 'SAME' })
    }) as typeof fetch
    const service = createService(fetchImpl)

    const result = await service.submitDeclaration(input)

    expect(result).toEqual({ state: 'SUBMITTED', certCheckResult: 'SAME' })
    for (const field of ['appid', 'mch_id', 'out_trade_no', 'transaction_id', 'customs', 'mch_customs_no', 'cert_type', 'cert_id', 'name', 'sign']) {
      expect(capturedBody).toContain(`<${field}>`)
    }
    expect(capturedBody).toContain('<customs>ZONGSHU</customs>')
    expect(capturedBody).toContain('<cert_id>110101199001011234</cert_id>')
    // 验签：从 XML 里取出 sign，对其余字段重算比对
    const sign = /<sign>([0-9A-F]{32})<\/sign>/.exec(capturedBody)?.[1]
    const params: Record<string, string> = {}
    for (const match of capturedBody.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) {
      if (match[1] !== 'xml' && match[1] !== 'sign') params[match[1]] = match[2]
    }
    expect(signV2Md5(params, config.apiV2Key as string)).toBe(sign)
  })

  it('业务失败（如未开通自助清关）抛出含错误码的异常', async () => {
    const fetchImpl: typeof fetch = (async () =>
      xmlResponse({ return_code: 'SUCCESS', result_code: 'FAIL', err_code: 'AUTHORITY_NOT_FOUND', err_code_des: '未开通自助清关功能' })) as typeof fetch
    const service = createService(fetchImpl)

    await expect(service.submitDeclaration(input)).rejects.toThrow(/AUTHORITY_NOT_FOUND/)
  })

  it('报关查询命中查询接口并解析状态', async () => {
    const fetchImpl: typeof fetch = (async (url: string | URL) => {
      expect(String(url)).toBe('https://api.mch.weixin.qq.com/cgi-bin/mch/customs/customdeclarequery')
      return xmlResponse({ return_code: 'SUCCESS', result_code: 'SUCCESS', state: 'SUCCESS', cert_check_result: 'SAME' })
    }) as typeof fetch
    const service = createService(fetchImpl)

    await expect(service.queryDeclaration(input.orderNo, input.transactionId)).resolves.toEqual({ state: 'SUCCESS', certCheckResult: 'SAME' })
  })

  it('未启用时直接调用报清晰错误', async () => {
    const service = new WechatCustomsService({ ...config, apiV2Key: null })
    await expect(service.submitDeclaration(input)).rejects.toThrow(/报关能力未启用/)
  })
})
