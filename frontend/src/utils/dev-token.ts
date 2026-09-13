/**
 * 联调期过渡工具：把 URL query 里的 dev_token 导入 localStorage 完成登录。
 * 配合 server/scripts/mint-dev-token.js 生成的链接使用，真实短信通道接入后移除。
 * 导入后立即从地址栏抹掉参数，避免 token 随截图/分享外泄。
 */
export function extractDevToken(search: string): string | null {
  return new URLSearchParams(search).get('dev_token')
}

export function importDevTokenFromUrl(): boolean {
  const token = extractDevToken(window.location.search)
  if (!token) return false
  localStorage.setItem('token', token)
  const url = new URL(window.location.href)
  url.searchParams.delete('dev_token')
  window.history.replaceState(null, '', url.toString())
  return true
}
