import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// H5 商城前端构建配置
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true, // 局域网可访问，方便手机真机预览
    port: 5173,
    proxy: {
      '/api': {
        // 用 127.0.0.1 而非 localhost：曾有其他项目的 dev server 抢占 ::1:3000（localhost 优先解析 IPv6 回环），导致请求打错服务
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
})
