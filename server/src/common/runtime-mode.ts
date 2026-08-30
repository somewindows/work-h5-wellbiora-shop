/** 自动化测试或显式本地浏览器测试时，不连接外部 MySQL。 */
export function isInMemoryStorage(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.LOCAL_TEST_MODE === '1'
}
