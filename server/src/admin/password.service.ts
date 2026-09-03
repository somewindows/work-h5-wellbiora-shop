import { Injectable } from '@nestjs/common'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

@Injectable()
export class AdminPasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16)
    const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
    return `scrypt$${salt.toString('base64')}$${derivedKey.toString('base64')}`
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const [algorithm, encodedSalt, encodedKey] = encodedHash.split('$')
    if (algorithm !== 'scrypt' || !encodedSalt || !encodedKey) return false

    try {
      const expectedKey = Buffer.from(encodedKey, 'base64')
      if (expectedKey.length !== KEY_LENGTH) return false
      const derivedKey = (await scrypt(password, Buffer.from(encodedSalt, 'base64'), KEY_LENGTH)) as Buffer
      return timingSafeEqual(derivedKey, expectedKey)
    } catch {
      return false
    }
  }
}
