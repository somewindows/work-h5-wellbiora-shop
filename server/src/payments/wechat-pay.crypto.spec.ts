import { createCipheriv, generateKeyPairSync } from 'node:crypto'

import { buildV3Message, decryptResource, signV3, verifyV3 } from './wechat-pay.crypto'

describe('微信支付 V3 加解密', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

  describe('buildV3Message', () => {
    it('以换行连接各部件并在末尾补换行', () => {
      expect(buildV3Message(['POST', '/v3/pay/transactions/jsapi', '123', 'abc', '{"a":1}'])).toBe(
        'POST\n/v3/pay/transactions/jsapi\n123\nabc\n{"a":1}\n',
      )
    })

    it('空 body 也要占位', () => {
      expect(buildV3Message(['GET', '/v3/certificates', '123', 'abc', ''])).toBe('GET\n/v3/certificates\n123\nabc\n\n')
    })
  })

  describe('signV3 / verifyV3', () => {
    it('签名可被对应公钥验出', () => {
      const message = buildV3Message(['GET', '/v3/certificates', '1725000000', 'nonce123', ''])
      const signature = signV3(privateKeyPem, message)
      expect(verifyV3(publicKeyPem, message, signature)).toBe(true)
    })

    it('报文被篡改时验签失败', () => {
      const message = buildV3Message(['123', 'nonce', '{"ok":true}'])
      const signature = signV3(privateKeyPem, message)
      expect(verifyV3(publicKeyPem, buildV3Message(['123', 'nonce', '{"ok":false}']), signature)).toBe(false)
    })

    it('签名串损坏时验签失败而不是抛异常', () => {
      expect(verifyV3(publicKeyPem, 'any\n', 'not-a-valid-base64-signature!!!')).toBe(false)
    })
  })

  describe('decryptResource', () => {
    const apiV3Key = 'test-apiv3-key-01234567890123456'

    function encrypt(plaintext: string, nonce: string, associatedData: string): string {
      const cipher = createCipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(nonce, 'utf8'))
      if (associatedData) cipher.setAAD(Buffer.from(associatedData, 'utf8'))
      const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
      return Buffer.concat([data, cipher.getAuthTag()]).toString('base64')
    }

    it('能解出 GCM 密文（模拟回调 resource）', () => {
      const plaintext = JSON.stringify({ out_trade_no: 'WB20260910ABC', transaction_id: '4200001234' })
      const ciphertext = encrypt(plaintext, 'randomnonce1', 'transaction')
      expect(decryptResource(apiV3Key, ciphertext, 'randomnonce1', 'transaction')).toBe(plaintext)
    })

    it('密钥错误时解密失败', () => {
      const ciphertext = encrypt('hello', 'nonce1234567', 'transaction')
      const wrongKey = 'wrong-apiv3-key-9876543210987654'
      expect(() => decryptResource(wrongKey, ciphertext, 'nonce1234567', 'transaction')).toThrow()
    })

    it('associated_data 不一致时解密失败（防串用）', () => {
      const ciphertext = encrypt('hello', 'nonce1234567', 'transaction')
      expect(() => decryptResource(apiV3Key, ciphertext, 'nonce1234567', 'refund')).toThrow()
    })
  })
})
