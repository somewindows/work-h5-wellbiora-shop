import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { PersonalDataCryptoService } from './personal-data-crypto.service'

const TEST_PERSONAL_DATA_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PersonalDataCryptoService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const key = config.get<string>('PERSONAL_DATA_KEY') ??
          (process.env.NODE_ENV === 'test' ? TEST_PERSONAL_DATA_KEY : undefined)
        if (!key) throw new Error('缺少 PERSONAL_DATA_KEY')
        return new PersonalDataCryptoService(key)
      },
    },
  ],
  exports: [PersonalDataCryptoService],
})
export class SecurityModule {}
