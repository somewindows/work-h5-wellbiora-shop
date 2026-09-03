import { describe, expect, it } from 'vitest'

import { blocksEqual, createBlockTemplate, isKnownBlockType, KNOWN_BLOCK_TYPES, parseBlocksJson } from './block'

describe('内容块类型清单', () => {
  it('与服务端登记的 15 种已知 type 一致（gallery~brand_block）', () => {
    expect(KNOWN_BLOCK_TYPES).toHaveLength(15)
    expect(isKnownBlockType('stats')).toBe(true)
    expect(isKnownBlockType('video')).toBe(false)
  })

  it('每种已知 type 都有块模板且 type 字段正确', () => {
    for (const type of KNOWN_BLOCK_TYPES) {
      const block = createBlockTemplate(type)
      expect(block.type).toBe(type)
    }
  })
})

describe('blocksEqual 草稿/线上差异对比', () => {
  it('键序不同但内容相同视为一致', () => {
    expect(blocksEqual([{ type: 'image', src: 'a.jpg' }], [{ src: 'a.jpg', type: 'image' }])).toBe(true)
  })

  it('顺序不同视为有差异（块数组有序）', () => {
    expect(blocksEqual([{ type: 'image', src: 'a' }, { type: 'text', body: 'b' }], [{ type: 'text', body: 'b' }, { type: 'image', src: 'a' }])).toBe(false)
  })

  it('hidden 标记参与对比', () => {
    expect(blocksEqual([{ type: 'text', body: 'b' }], [{ type: 'text', body: 'b', hidden: true }])).toBe(false)
  })
})

describe('parseBlocksJson 块 JSON 校验', () => {
  it('合法块数组通过', () => {
    const result = parseBlocksJson('[{"type":"text","body":"hi"}]')
    expect(result.ok).toBe(true)
    expect(result.blocks).toHaveLength(1)
  })

  it('JSON 语法错误返回错误信息', () => {
    const result = parseBlocksJson('[{type:1}]')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('JSON 语法错误')
  })

  it('非数组被拒绝', () => {
    expect(parseBlocksJson('{"type":"text"}').ok).toBe(false)
  })

  it('缺 type 的块被拒绝并指明序号', () => {
    const result = parseBlocksJson('[{"type":"text"},{"body":"no type"}]')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('第 2 个块')
  })

  it('数组元素不是对象被拒绝', () => {
    expect(parseBlocksJson('["oops"]').ok).toBe(false)
  })
})
