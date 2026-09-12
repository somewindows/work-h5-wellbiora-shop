import { assertProductionConfig } from './production-guard'

const productionEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  JWT_SECRET: 'jwt',
  PERSONAL_DATA_KEY: 'key',
  MYSQL_HOST: '127.0.0.1',
  MYSQL_USER: 'root',
  MYSQL_PASSWORD: 'pass',
  MYSQL_DATABASE: 'shop',
}

describe('assertProductionConfig', () => {
  it('非生产环境不校验，缺配置或开着测试开关也放行', () => {
    expect(() => assertProductionConfig({ NODE_ENV: 'development' })).not.toThrow()
    expect(() =>
      assertProductionConfig({ NODE_ENV: 'development', LOCAL_TEST_MODE: '1', SMS_DEV_CONSOLE: '1' }),
    ).not.toThrow()
  })

  it('生产缺少必需配置时拒绝启动并列出缺失项', () => {
    expect(() => assertProductionConfig({ NODE_ENV: 'production' })).toThrow(/生产环境缺少配置：JWT_SECRET/)
  })

  it('生产配置齐全且无测试开关时正常放行', () => {
    expect(() => assertProductionConfig({ ...productionEnv })).not.toThrow()
  })

  it('生产误开 LOCAL_TEST_MODE 拒绝启动', () => {
    expect(() => assertProductionConfig({ ...productionEnv, LOCAL_TEST_MODE: '1' })).toThrow(
      /生产环境禁止开启测试\/联调开关：LOCAL_TEST_MODE/,
    )
  })

  it('生产误开 SMS_DEV_CONSOLE 拒绝启动', () => {
    expect(() => assertProductionConfig({ ...productionEnv, SMS_DEV_CONSOLE: '1' })).toThrow(/SMS_DEV_CONSOLE/)
  })

  it('开关值为其他内容时不视为开启', () => {
    expect(() =>
      assertProductionConfig({ ...productionEnv, LOCAL_TEST_MODE: '0', SMS_DEV_CONSOLE: 'true' }),
    ).not.toThrow()
  })
})
