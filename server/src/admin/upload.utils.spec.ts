import { extensionForMime, UPLOAD_MAX_FILE_SIZE } from './upload.utils'

describe('extensionForMime', () => {
  it('白名单 MIME 映射到固定扩展名', () => {
    expect(extensionForMime('image/jpeg')).toBe('.jpg')
    expect(extensionForMime('image/png')).toBe('.png')
    expect(extensionForMime('image/webp')).toBe('.webp')
    expect(extensionForMime('image/gif')).toBe('.gif')
  })

  it('非白名单 MIME 返回 null', () => {
    expect(extensionForMime('text/plain')).toBeNull()
    expect(extensionForMime('image/svg+xml')).toBeNull()
    expect(extensionForMime('application/octet-stream')).toBeNull()
    expect(extensionForMime('')).toBeNull()
  })

  it('大小上限为 5MB', () => {
    expect(UPLOAD_MAX_FILE_SIZE).toBe(5 * 1024 * 1024)
  })
})
