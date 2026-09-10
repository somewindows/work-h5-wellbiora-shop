import { Inject, Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'

import { WECHAT_PAY_CONFIG, type WechatPayConfig } from './wechat-pay.config'

/**
 * 微信支付「自助清关」海关报关封装（V2 XML 接口，MD5 签名，无需证书）。
 * 文档：https://pay.weixin.qq.com/doc/v2/merchant/4011985151
 *
 * 前置条件（未满足时 isEnabled()=false，调用方应跳过而非报错）：
 * 1. 商户平台「产品中心 → 自助清关」已开通；
 * 2. 商户平台已提交海关备案信息；
 * 3. .env 配置 WXPAY_API_V2_KEY / WXPAY_CUSTOMS_CODE / WXPAY_MCH_CUSTOMS_NO。
 */
export interface CustomsDeclarationInput {
  orderNo: string
  transactionId: string
  /** 订购人实名信息（三单对碰用）：与微信支付人信息比对，不一致不影响报关但会返回 DIFFERENT */
  realname: { name: string; idcard: string }
}

export interface CustomsDeclarationResult {
  /** UNDECLARED / SUBMITTED / PROCESSING / SUCCESS / FAIL / EXCEPT */
  state: string
  /** UNCHECKED / SAME / DIFFERENT：订购人与支付人身份一致性校验结果 */
  certCheckResult: string
}

const DECLARE_URL = 'https://api.mch.weixin.qq.com/cgi-bin/mch/customs/customdeclareorder'
const QUERY_URL = 'https://api.mch.weixin.qq.com/cgi-bin/mch/customs/customdeclarequery'

@Injectable()
export class WechatCustomsService {
  /** 单测可覆写；生产用全局 fetch */
  fetchImpl: typeof fetch = fetch

  constructor(@Inject(WECHAT_PAY_CONFIG) private readonly config: WechatPayConfig) {}

  /** 报关三要素（v2 密钥 + 海关代码 + 备案号）齐全才可报关。 */
  isEnabled(): boolean {
    return Boolean(this.config.apiV2Key && this.config.customsCode && this.config.mchCustomsNo)
  }

  /** 提交支付单报关（新增）；丢单重推 = 再次调用本方法（微信侧幂等，重复申报状态为 SUBMITTED）。 */
  async submitDeclaration(input: CustomsDeclarationInput): Promise<CustomsDeclarationResult> {
    this.assertEnabled()
    const response = await this.postCustomsXml(DECLARE_URL, {
      out_trade_no: input.orderNo,
      transaction_id: input.transactionId,
      customs: this.config.customsCode as string,
      mch_customs_no: this.config.mchCustomsNo as string,
      cert_type: 'IDCARD',
      cert_id: input.realname.idcard,
      name: input.realname.name,
    })
    return { state: response.state ?? '', certCheckResult: response.cert_check_result ?? 'UNCHECKED' }
  }

  /** 报关结果查询。 */
  async queryDeclaration(orderNo: string, transactionId: string): Promise<CustomsDeclarationResult> {
    this.assertEnabled()
    const response = await this.postCustomsXml(QUERY_URL, { out_trade_no: orderNo, transaction_id: transactionId })
    return { state: response.state ?? '', certCheckResult: response.cert_check_result ?? 'UNCHECKED' }
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new Error('报关能力未启用：缺少 WXPAY_API_V2_KEY / WXPAY_CUSTOMS_CODE / WXPAY_MCH_CUSTOMS_NO，或未开通自助清关')
    }
  }

  /** V2 XML 请求：组装报文 → MD5 签名 → POST → 解析应答并校验 return_code/result_code。 */
  private async postCustomsXml(url: string, params: Record<string, string>): Promise<Record<string, string>> {
    const signedParams: Record<string, string> = {
      appid: this.config.appId,
      mch_id: this.config.mchId,
      ...params,
    }
    signedParams.sign = signV2Md5(signedParams, this.config.apiV2Key as string)

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: buildXml(signedParams),
    })
    const body = await response.text()
    if (!response.ok) throw new Error(`报关接口 HTTP ${response.status}`)
    const result = parseXml(body)
    if (result.return_code !== 'SUCCESS' || result.result_code !== 'SUCCESS') {
      throw new Error(`报关失败：${result.err_code ?? result.return_code} ${result.err_code_des ?? result.return_msg ?? ''}`)
    }
    return result
  }
}

/** V2 签名：参数按 key 字典序拼接 key=value&...&key=APIv2密钥 → MD5 → 大写。 */
export function signV2Md5(params: Record<string, string>, apiV2Key: string): string {
  const stringA = Object.keys(params)
    .filter((key) => key !== 'sign' && params[key] !== '' && params[key] !== undefined)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return createHash('md5').update(`${stringA}&key=${apiV2Key}`, 'utf8').digest('hex').toUpperCase()
}

function buildXml(params: Record<string, string>): string {
  const entries = Object.entries(params)
    .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
    .join('')
  return `<xml>${entries}</xml>`
}

/** 微信 V2 应答是扁平 XML，无嵌套，用正则逐字段提取即可，不引入 XML 解析依赖。 */
function parseXml(body: string): Record<string, string> {
  const result: Record<string, string> = {}
  // 两分支：CDATA 包裹 或 纯文本；内容段不允许嵌套标签
  for (const match of body.matchAll(/<(\w+)><!\[CDATA\[([\s\S]*?)\]\]><\/\1>|<(\w+)>([^<]*)<\/\3>/g)) {
    const key = match[1] ?? match[3]
    if (key !== 'xml') result[key] = match[2] ?? match[4] ?? ''
  }
  return result
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
