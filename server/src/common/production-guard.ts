/**
 * 生产启动守卫（复审 R07 / 4.1）：生产环境缺必需配置，或误开内存仓储、验证码写日志
 * 这类仅限本地/联调的开关时，直接拒绝启动，避免「真钱进假仓储」「真实验证码落日志」。
 */
export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return

  const required = ['JWT_SECRET', 'PERSONAL_DATA_KEY', 'MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
  const missing = required.filter((key) => !env[key])
  if (missing.length > 0) throw new Error(`生产环境缺少配置：${missing.join(', ')}`)

  const forbidden: ReadonlyArray<readonly [string, string]> = [
    ['LOCAL_TEST_MODE', '内存仓储仅供本地测试，重启即丢数据'],
    ['SMS_DEV_CONSOLE', '验证码写日志的联调逃生门'],
  ]
  const enabled = forbidden.filter(([key]) => env[key] === '1').map(([key, reason]) => `${key}（${reason}）`)
  if (enabled.length > 0) throw new Error(`生产环境禁止开启测试/联调开关：${enabled.join(', ')}`)
}
