import { describe, expect, it } from 'vitest'
import { getBlockExtra } from './block-extra'

describe('getBlockExtra', () => {
  it('详情页图库把产品 themeLight 作为背景色透传', () => {
    const result = getBlockExtra(
      { type: 'gallery', images: ['/assets/p1-1.jpg'] },
      'detail',
      [],
      '#E7F4F7',
    )

    expect(result).toEqual({ bg: '#E7F4F7' })
  })

  it('没有 themeLight 时不覆盖图库组件的默认白色背景', () => {
    const result = getBlockExtra(
      { type: 'gallery', images: ['/assets/p1-1.jpg'] },
      'detail',
      [],
      undefined,
    )

    expect(result).toEqual({})
  })
})
