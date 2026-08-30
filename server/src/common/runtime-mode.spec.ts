import { isInMemoryStorage } from './runtime-mode'

describe('isInMemoryStorage', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalLocalTestMode = process.env.LOCAL_TEST_MODE

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalLocalTestMode === undefined) delete process.env.LOCAL_TEST_MODE
    else process.env.LOCAL_TEST_MODE = originalLocalTestMode
  })

  it('测试环境或显式本地测试模式使用内存存储', () => {
    process.env.NODE_ENV = 'development'
    process.env.LOCAL_TEST_MODE = '1'
    expect(isInMemoryStorage()).toBe(true)

    process.env.LOCAL_TEST_MODE = '0'
    process.env.NODE_ENV = 'test'
    expect(isInMemoryStorage()).toBe(true)
  })

  it('普通开发环境继续使用 MySQL', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.LOCAL_TEST_MODE
    expect(isInMemoryStorage()).toBe(false)
  })
})
