import { BusinessException } from './business.exception'
import { HttpExceptionFilter } from './http-exception.filter'

describe('HttpExceptionFilter', () => {
  it('保留业务异常的 HTTP 状态和业务错误码', () => {
    const status = jest.fn().mockReturnThis()
    const json = jest.fn()
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json }),
      }),
    }

    new HttpExceptionFilter().catch(new BusinessException(40404, '商品不存在', 404), host as never)

    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({ code: 40404, message: '商品不存在', data: null })
  })
})
