/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 运营后台构建配置（桌面端，与 frontend 移动端工程互相独立）
export default defineConfig({
  // 生产部署挂在 /admin/ 子路径（Nginx ^~ /admin/ 托管），资源引用统一带此前缀
  // 本地开发访问地址相应变为 http://localhost:5174/admin/
  base: '/admin/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    proxy: {
      // dev 环境代理到本地 NestJS 服务端，无需服务端改 CORS
      // 用 127.0.0.1 而非 localhost：避免其他进程绑定 ::1:3000 时 localhost 被解析到 IPv6 回环而打错服务
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
