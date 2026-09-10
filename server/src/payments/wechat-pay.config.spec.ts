import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadWechatPayConfig } from './wechat-pay.config'

describe('微信支付配置加载', () => {
  let directory = ''
  let keyPath = ''

  const completeEnv = (): NodeJS.ProcessEnv => ({
    WXPAY_APPID: 'wx2591892b548a6565',
    WX_APPSECRET: 'test-app-secret',
    WXPAY_MCHID: '1117333649',
    WXPAY_SERIAL_NO: '3EE4E7FE',
    WXPAY_PRIVATE_KEY_PATH: keyPath,
    WXPAY_API_V3_KEY: '12345678901234567890123456789012',
    WXPAY_NOTIFY_URL: 'https://wellbiora.com.cn/api/v1/payments/wechat/notify',
  })

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'wellbiora-wxpay-'))
    keyPath = join(directory, 'apiclient_key.pem')
    writeFileSync(keyPath, '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n', 'utf8')
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('完全未配置时返回 null（回落本地 mock 支付）', () => {
    expect(loadWechatPayConfig({})).toBeNull()
  })

  it('只配了部分时启动即报错，不允许静默降级', () => {
    expect(() => loadWechatPayConfig({ WXPAY_MCHID: '1117333649' })).toThrow(/微信支付配置不完整/)
  })

  it('APIv3 密钥不是 32 字节时报错', () => {
    expect(() => loadWechatPayConfig({ ...completeEnv(), WXPAY_API_V3_KEY: 'short' })).toThrow(/32 字节/)
  })

  it('配置齐全时读取私钥文件并组装配置', () => {
    const config = loadWechatPayConfig(completeEnv())
    expect(config).not.toBeNull()
    expect(config?.mchId).toBe('1117333649')
    expect(config?.privateKeyPem).toContain('BEGIN PRIVATE KEY')
    expect(config?.apiV2Key).toBeNull()
  })

  it('未显式配置退款回调地址时由支付回调地址推导', () => {
    const config = loadWechatPayConfig(completeEnv())
    expect(config?.refundNotifyUrl).toBe('https://wellbiora.com.cn/api/v1/payments/wechat/refund-notify')
  })

  it('显式配置退款回调地址时优先使用', () => {
    const config = loadWechatPayConfig({ ...completeEnv(), WXPAY_REFUND_NOTIFY_URL: 'https://example.com/refund' })
    expect(config?.refundNotifyUrl).toBe('https://example.com/refund')
  })
})
