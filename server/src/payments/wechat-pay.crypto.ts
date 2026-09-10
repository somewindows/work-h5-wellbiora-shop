import { createDecipheriv, createSign, createVerify } from 'node:crypto'

/**
 * 微信支付 API V3 加解密纯函数层。
 * 不引入第三方 SDK：签名 = SHA256withRSA（商户私钥），验签 = 平台公钥，回调解密 = AEAD_AES_256_GCM（APIv3 密钥）。
 * 参考：https://pay.weixin.qq.com/doc/v3/merchant/4012791856
 */

/** V3 签名/验签的消息字典串：若干部件以 \n 连接，末尾补一个 \n（空 body 也要占位）。 */
export function buildV3Message(parts: string[]): string {
  return `${parts.join('\n')}\n`
}

/** 用商户私钥对消息做 RSA-SHA256 签名，返回 base64。 */
export function signV3(privateKeyPem: string, message: string): string {
  return createSign('RSA-SHA256').update(message, 'utf8').sign(privateKeyPem, 'base64')
}

/** 用微信平台证书（或公钥）验签回调消息。certPem 可为 X509 证书 PEM 或公钥 PEM。 */
export function verifyV3(certOrPublicKeyPem: string, message: string, signatureBase64: string): boolean {
  try {
    return createVerify('RSA-SHA256').update(message, 'utf8').verify(certOrPublicKeyPem, signatureBase64, 'base64')
  } catch {
    return false
  }
}

/**
 * 回调资源解密：AEAD_AES_256_GCM。
 * key = APIv3 密钥（32 字节字符串）；ciphertext 的末尾 16 字节是 GCM auth tag。
 */
export function decryptResource(apiV3Key: string, ciphertextBase64: string, nonce: string, associatedData: string): string {
  const data = Buffer.from(ciphertextBase64, 'base64')
  const authTag = data.subarray(data.length - 16)
  const cipherBytes = data.subarray(0, data.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(nonce, 'utf8'))
  decipher.setAuthTag(authTag)
  if (associatedData) decipher.setAAD(Buffer.from(associatedData, 'utf8'))
  return Buffer.concat([decipher.update(cipherBytes), decipher.final()]).toString('utf8')
}
