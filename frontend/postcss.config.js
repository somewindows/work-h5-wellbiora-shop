// PostCSS 配置：Tailwind + px 转 vw（375 设计基准）
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    'postcss-px-to-viewport-8-plugin': {
      unitToConvert: 'px',
      viewportWidth: 375, // 设计稿基准宽度
      unitPrecision: 5,
      propList: ['*'],
      viewportUnit: 'vw',
      fontViewportUnit: 'vw',
      selectorBlackList: ['.ignore-vw'], // 加此类名可跳过转换
      minPixelValue: 1,
      mediaQuery: false,
      replace: true,
      exclude: [/node_modules\/(?!vant)/], // Vant 按 375 设计，一并转换
    },
  },
}
