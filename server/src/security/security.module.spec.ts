import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { PersonalDataCryptoService } from './personal-data-crypto.service'
import { SecurityModule } from './security.module'

describe('SecurityModule', () => {
  const originalKey = process.env.PERSONAL_DATA_KEY

  afterEach(() => {
    if (originalKey === undefined) delete process.env.PERSONAL_DATA_KEY
    else process.env.PERSONAL_DATA_KEY = originalKey
  })

  it('测试环境缺少环境变量时使用隔离的测试密钥', async () => {
    delete process.env.PERSONAL_DATA_KEY
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), SecurityModule],
    }).compile()

    const crypto = moduleRef.get(PersonalDataCryptoService)
    expect(crypto.decrypt(crypto.encrypt('110101199001011234'))).toBe('110101199001011234')
  })
})
