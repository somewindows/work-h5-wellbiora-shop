import { readFileSync } from 'node:fs'

/**
 * 微信支付配置：全部来自 .env，密钥绝不入代码。
 * 完整性策略：一项都没有 → 返回 null（回落本地 mock 适配器）；配了一部分 → 启动即报错（防止线上半配置静默降级）。
 */
export interface WechatPayConfig {
  /** 服务号 AppID */
  appId: string
  /** 公众号 AppSecret（换取网页授权 openid 用） */
  appSecret: string
  /** 商户号 mchid */
  mchId: string
  /** 商户 API 证书序列号 */
  serialNo: string
  /** 商户 API 证书私钥内容（apiclient_key.pem，启动时读文件入内存） */
  privateKeyPem: string
  /** APIv3 密钥（回调解密用，32 字节） */
  apiV3Key: string
  /** APIv2 密钥（自助清关 v2 报关接口签名用；未配置则报关能力关闭） */
  apiV2Key: string | null
  /** 支付结果回调地址（公网 https） */
  notifyUrl: string
  /** 退款结果回调地址 */
  refundNotifyUrl: string
  /** 海关代码（自助清关报关用，如 ZONGSHU/HANGZHOU_ZS；未配置则报关关闭） */
  customsCode: string | null
  /** 商户海关备案号（报关用） */
  mchCustomsNo: string | null
  /**
   * 微信支付公钥内容（启动时读文件入内存）。新商户号没有平台证书（/v3/certificates 回 RESOURCE_NOT_EXISTS），
   * 回调验签必须改用「微信支付公钥」（商户平台-API安全-微信支付公钥 下载）；配置后不再拉平台证书。
   */
  publicKeyPem: string | null
  /** 微信支付公钥 ID（PUB_KEY_ID_ 开头），回调的 Wechatpay-Serial 会带这个值 */
  publicKeyId: string | null
}

export const WECHAT_PAY_CONFIG = Symbol('WECHAT_PAY_CONFIG')

const REQUIRED_KEYS = [
  'WXPAY_APPID',
  'WX_APPSECRET',
  'WXPAY_MCHID',
  'WXPAY_SERIAL_NO',
  'WXPAY_PRIVATE_KEY_PATH',
  'WXPAY_API_V3_KEY',
  'WXPAY_NOTIFY_URL',
] as const

export function loadWechatPayConfig(env: NodeJS.ProcessEnv = process.env): WechatPayConfig | null {
  const missing = REQUIRED_KEYS.filter((key) => !env[key])
  if (missing.length === REQUIRED_KEYS.length) return null
  if (missing.length > 0) {
    throw new Error(`微信支付配置不完整，缺少：${missing.join('、')}；要么配齐，要么全部留空走本地 mock 支付`)
  }
  const apiV3Key = env.WXPAY_API_V3_KEY as string
  if (Buffer.byteLength(apiV3Key, 'utf8') !== 32) {
    throw new Error('WXPAY_API_V3_KEY 必须是 32 字节字符串（商户平台 API 安全里设置的 APIv3 密钥）')
  }
  const notifyUrl = env.WXPAY_NOTIFY_URL as string
  const publicKeyPath = env.WXPAY_PUBLIC_KEY_PATH || null
  const publicKeyId = env.WXPAY_PUBLIC_KEY_ID || null
  if ((publicKeyPath === null) !== (publicKeyId === null)) {
    throw new Error('WXPAY_PUBLIC_KEY_PATH 与 WXPAY_PUBLIC_KEY_ID 必须同时配置（商户平台-API安全-微信支付公钥）')
  }
  if (publicKeyId && !publicKeyId.startsWith('PUB_KEY_ID_')) {
    throw new Error('WXPAY_PUBLIC_KEY_ID 应以 PUB_KEY_ID_ 开头（商户平台-API安全-微信支付公钥 页面可复制）')
  }
  return {
    appId: env.WXPAY_APPID as string,
    appSecret: env.WX_APPSECRET as string,
    mchId: env.WXPAY_MCHID as string,
    serialNo: env.WXPAY_SERIAL_NO as string,
    privateKeyPem: readFileSync(env.WXPAY_PRIVATE_KEY_PATH as string, 'utf8'),
    apiV3Key,
    apiV2Key: env.WXPAY_API_V2_KEY || null,
    notifyUrl,
    refundNotifyUrl: env.WXPAY_REFUND_NOTIFY_URL || notifyUrl.replace(/\/notify$/, '/refund-notify'),
    customsCode: env.WXPAY_CUSTOMS_CODE || null,
    mchCustomsNo: env.WXPAY_MCH_CUSTOMS_NO || null,
    publicKeyPem: publicKeyPath ? readFileSync(publicKeyPath, 'utf8') : null,
    publicKeyId,
  }
}

/** 供动态模块在装配期判断：是否启用真实微信支付适配器。 */
export function isWechatPayConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return loadWechatPayConfig(env) !== null
}
