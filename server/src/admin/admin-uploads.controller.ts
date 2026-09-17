import { Controller, Post, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { diskStorage } from 'multer'

import { BusinessException } from '../common/business.exception'
import { resolveUploadDir } from '../common/upload-dir'

import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'
import { AuditLogService, type AdminActor } from './audit-log.service'
import { CurrentAdmin } from './current-admin.decorator'
import { MulterExceptionFilter } from './multer-exception.filter'
import { extensionForMime, UPLOAD_MAX_FILE_SIZE } from './upload.utils'

/** multer 落盘后的文件对象（项目未装 @types/multer，本地声明最小面） */
interface UploadedImageFile {
  filename: string
  mimetype: string
  size: number
}

@Controller('admin/uploads')
@UseGuards(AdminJwtAuthGuard)
@UseFilters(MulterExceptionFilter)
export class AdminUploadsController {
  constructor(private readonly auditLogService: AuditLogService) {
    // 上传目录启动时确保存在（生产由部署指南预建，这里兜底本地/测试场景）
    mkdirSync(resolveUploadDir(), { recursive: true })
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      // destination / filename 惰性求值（每次请求时读 env）：e2e 在 beforeAll 才注入 UPLOAD_DIR
      storage: diskStorage({
        destination: (_req, _file, callback) => callback(null, resolveUploadDir()),
        filename: (_req, file, callback) => {
          // 扩展名只从 MIME 白名单推导（fileFilter 已先拦掉非白名单类型，保底走 .bin 且不落可执行语义）
          const ext = extensionForMime(file.mimetype) ?? '.bin'
          callback(null, `${randomUUID()}${ext}`)
        },
      }),
      limits: { fileSize: UPLOAD_MAX_FILE_SIZE },
      fileFilter: (_req, file, callback) => {
        if (!extensionForMime(file.mimetype)) {
          callback(new BusinessException(40003, '仅支持 JPG/PNG/WebP/GIF 图片'), false)
          return
        }
        callback(null, true)
      },
    }),
  )
  async uploadImage(@UploadedFile() file: UploadedImageFile | undefined, @CurrentAdmin() admin: AdminActor): Promise<{ url: string }> {
    if (!file) throw new BusinessException(40003, '请选择要上传的图片文件')

    const url = `/assets/uploads/${file.filename}`
    // 审计只记服务端生成的文件名与元信息，不记用户提交的原始文件名等输入
    await this.auditLogService.record(admin, 'upload_image', 'image', file.filename, null, {
      url,
      size: file.size,
      mimetype: file.mimetype,
    })
    return { url }
  }
}
