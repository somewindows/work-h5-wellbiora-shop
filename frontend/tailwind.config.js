/** @type {import('tailwindcss').Config} */
// 设计 token 唯一依据：docs/H5商城设计规范_WELLBIORA_v0.2.md（内容 v0.3）
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#033B3C', // 品牌主色 深墨绿
          deep: '#022829', // 深色
          mint: '#D9EDE2', // 薄荷绿
          cream: '#F7F5F0', // 页面底 米白
          red: '#E6432D', // 价格/促销红（仅用于价格）
        },
        // 产品主题色（仅用于产品相关点缀）
        p1: '#88BDCB',
        p2: '#F8A818',
        p3: '#082068',
        p4: '#702848',
      },
      fontFamily: {
        serif: ['Georgia', 'serif'], // 模块英文小标题
      },
    },
  },
  plugins: [],
}
