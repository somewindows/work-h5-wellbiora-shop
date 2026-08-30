import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('环境变量预加载', () => {
  const originalPath = process.env.DOTENV_CONFIG_PATH
  const originalLocalTestMode = process.env.LOCAL_TEST_MODE
  let directory = ''

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'wellbiora-env-'))
    delete process.env.LOCAL_TEST_MODE
  })

  afterEach(() => {
    jest.resetModules()
    if (originalPath === undefined) delete process.env.DOTENV_CONFIG_PATH
    else process.env.DOTENV_CONFIG_PATH = originalPath
    if (originalLocalTestMode === undefined) delete process.env.LOCAL_TEST_MODE
    else process.env.LOCAL_TEST_MODE = originalLocalTestMode
    rmSync(directory, { recursive: true, force: true })
  })

  it('从 .env 文件读取本地内存模式开关', async () => {
    const envFile = join(directory, '.env')
    writeFileSync(envFile, 'LOCAL_TEST_MODE=1\n', 'utf8')
    process.env.DOTENV_CONFIG_PATH = envFile

    await import('./environment')
    const { isInMemoryStorage } = await import('./runtime-mode')

    expect(isInMemoryStorage()).toBe(true)
  })
})
