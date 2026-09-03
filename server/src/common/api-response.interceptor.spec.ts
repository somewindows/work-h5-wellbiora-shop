import { of, firstValueFrom } from 'rxjs'

import { ApiResponseInterceptor } from './api-response.interceptor'

describe('ApiResponseInterceptor', () => {
  it('将控制器返回值包装为统一响应壳', async () => {
    const interceptor = new ApiResponseInterceptor()
    const next = { handle: () => of({ id: 'WB10001' }) }

    await expect(firstValueFrom(interceptor.intercept({} as never, next))).resolves.toEqual({
      code: 0,
      data: { id: 'WB10001' },
    })
  })
})
