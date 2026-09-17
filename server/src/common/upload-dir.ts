import { resolve } from 'node:path'

/**
 * 上传目录解析：UPLOAD_DIR 未配置时缺省 ./uploads（相对 server 启动目录，仅供本地开发）。
 * 返回绝对路径：useStaticAssets / diskStorage 都要求绝对路径。
 * 生产环境必须显式配置独立目录（见部署指南：robocopy /MIR 发布会镜像清空 site 目录）。
 */
export function resolveUploadDir(env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env.UPLOAD_DIR ?? './uploads')
}
