import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, PayloadTooLargeException } from '@nestjs/common'
import type { Response } from 'express'
import { MulterError } from 'multer'

import { UPLOAD_MAX_FILE_SIZE } from './upload.utils'

/**
 * 上传体积/解析错误转统一业务错误壳：
 * Nest 的 FileInterceptor 会把 multer 的 LIMIT_FILE_SIZE 转成 PayloadTooLargeException（413），
 * 这里统一回落为 400 + 40003 友好文案；MulterError 兜底（理论上到不了）。
 */
@Catch(PayloadTooLargeException, MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: PayloadTooLargeException | MulterError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const isSizeLimit =
      exception instanceof PayloadTooLargeException || ('code' in exception && exception.code === 'LIMIT_FILE_SIZE')
    const message = isSizeLimit ? `图片大小不能超过 ${UPLOAD_MAX_FILE_SIZE / 1024 / 1024}MB` : '图片上传失败，请重试'
    response.status(HttpStatus.BAD_REQUEST).json({ code: 40003, message, data: null })
  }
}
