/**
 * 联调期过渡工具：真实短信通道接入前，为指定手机号手工签发登录 token。
 *
 * 用法（在 server 目录下执行）：
 *   node scripts/mint-dev-token.js 13800000000
 *
 * 行为：按 server/.env 的 MYSQL_* 连接数据库，手机号无用户则自动建档，
 * 用 JWT_SECRET 签一个 7 天 token 打印出来。浏览器 F12 控制台执行输出的
 * localStorage 命令后刷新即登录。
 *
 * 注意：token 等同账号凭证，仅限联调期内部测试；本脚本只在有服务器
 * 访问权限的前提下运行，不是 API，不产生额外暴露面。正式开业前接入
 * 真实短信通道后本脚本即可废弃。
 */
require('dotenv').config({ quiet: true })
const { randomUUID } = require('node:crypto')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')

async function main() {
  const phone = process.argv[2]
  if (!/^1\d{10}$/.test(phone ?? '')) {
    console.error('用法：node scripts/mint-dev-token.js <11位手机号>')
    process.exit(1)
  }
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('缺少 JWT_SECRET（应在 server/.env 或环境变量中）')
    process.exit(1)
  }

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? 'wellbiora',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE ?? 'wellbiora_shop',
  })
  try {
    const [rows] = await conn.execute('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone])
    let userId = rows[0]?.id
    if (!userId) {
      userId = randomUUID()
      await conn.execute('INSERT INTO users (id, phone, created_at, updated_at) VALUES (?, ?, NOW(), NOW())', [
        userId,
        phone,
      ])
      console.log(`已建档测试用户：${phone}（${userId}）`)
    }
    const token = jwt.sign({ sub: userId, phone }, secret, { expiresIn: '7d' })
    console.log(`\ntoken（7 天有效）：\n${token}\n`)
    console.log('浏览器 F12 控制台执行后刷新页面：')
    console.log(`localStorage.setItem('token', '${token}')`)
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error('签发失败：', err.message)
  process.exit(1)
})
