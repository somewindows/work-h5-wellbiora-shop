import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'

/** 身份证号等个人敏感字段的 AES-256-GCM 加密服务。 */
export class PersonalDataCryptoService {
  private readonly key: Buffer

  constructor(encodedKey: string) {
    this.key = Buffer.from(encodedKey, 'base64')
    if (this.key.length !== 32) throw new Error('PERSONAL_DATA_KEY 必须是 32 字节 Base64 密钥')
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
  }

  decrypt(payload: string): string {
    const [ivText, tagText, encryptedText] = payload.split('.')
    if (!ivText || !tagText || !encryptedText) throw new Error('个人数据密文格式无效')

    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivText, 'base64'))
    decipher.setAuthTag(Buffer.from(tagText, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64')), decipher.final()]).toString('utf8')
  }

  /** 用密钥 HMAC 生成可查询、不可逆的实名指纹，不保存身份证明文。 */
  fingerprint(value: string): string {
    return createHmac('sha256', this.key).update(value, 'utf8').digest('hex')
  }
}
