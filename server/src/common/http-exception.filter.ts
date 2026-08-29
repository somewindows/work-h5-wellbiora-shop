import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Response } from 'express'

import { BusinessException } from './business.exception'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()

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

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 50001,
      message: '服务暂时不可用，请稍后重试',
      data: null,
    })
  }
}
