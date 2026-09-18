import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'

import { BusinessException } from './business.exception'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException')

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    // 定位日志只记方法与路径，不记 body/headers（避免验证码、证件、密钥落日志）；getRequest 可能缺失（单元测试 mock）
    const http = host.switchToHttp()
    const request = typeof http.getRequest === 'function' ? http.getRequest<Request>() : undefined
    const where = `${request?.method ?? '?'} ${request?.originalUrl ?? '?'}`

    if (exception instanceof BusinessException) {
      response.status(exception.getStatus()).json({
        code: exception.code,
        message: exception.message,
        data: null,
      })
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      // 5xx 框架异常记录告警（4xx 属正常请求拒绝，不刷屏）
      if (status >= 500) this.logger.warn(`${where} → HTTP ${status}：${exception.message}`)
      const body = exception.getResponse()
      const detail = typeof body === 'string' ? undefined : (body as { message?: string | string[] })
      const message =
        typeof body === 'string'
          ? body
          : Array.isArray(detail?.message)
            ? detail.message[0]
            : (detail?.message ?? exception.message)
      response.status(status).json({
        code: status === HttpStatus.UNAUTHORIZED ? 40101 : status * 100,
        message,
        data: null,
      })
      return
    }

    // 未预期异常：对外通用文案，对内记完整堆栈便于定位
    this.logger.error(`${where} → 未预期异常`, exception instanceof Error ? exception.stack : String(exception))
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 50001,
      message: '服务暂时不可用，请稍后重试',
      data: null,
    })
  }
}
