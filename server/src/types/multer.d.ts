/**
 * multer 2.x 未内置类型声明，项目约定不引入 @types/multer；
 * 这里只补齐上传功能用到的最小接口面（diskStorage / MulterError / 落盘文件对象）。
 */
declare module 'multer' {
  /** multer 抛出的错误类型（如超限 LIMIT_FILE_SIZE） */
  export class MulterError extends Error {
    code: string
    field?: string
  }

  /** multer 落盘后的文件对象（本项目只用 diskStorage，不含 buffer） */
  export interface MulterUploadedFile {
    fieldname: string
    originalname: string
    encoding: string
    mimetype: string
    size: number
    destination: string
    filename: string
    path: string
  }

  export interface DiskStorageOptions {
    destination?:
      | string
      | ((req: unknown, file: MulterUploadedFile, callback: (error: Error | null, destination: string) => void) => void)
    filename?: (req: unknown, file: MulterUploadedFile, callback: (error: Error | null, filename: string) => void) => void
  }

  /** 存储引擎对象（交给 @nestjs/platform-express 的 MulterOptions.storage 消费，其类型为 any） */
  export interface StorageEngine {
    _handleFile?: unknown
    _removeFile?: unknown
  }

  export function diskStorage(options: DiskStorageOptions): StorageEngine
}
