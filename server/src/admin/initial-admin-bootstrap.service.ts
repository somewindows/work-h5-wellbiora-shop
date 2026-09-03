import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AdminAuthService } from './admin-auth.service'

@Injectable()
export class InitialAdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(InitialAdminBootstrapService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly adminAuthService: AdminAuthService,
  ) {}

  async onModuleInit(): Promise<void> {
    const username = this.config.get<string>('ADMIN_INITIAL_USERNAME')?.trim()
    const password = this.config.get<string>('ADMIN_INITIAL_PASSWORD')
    if (!username && !password) return
    if (!username || !password) throw new Error('ADMIN_INITIAL_USERNAME 与 ADMIN_INITIAL_PASSWORD 必须同时配置')
    if (password.length < 12) throw new Error('ADMIN_INITIAL_PASSWORD 至少需要 12 位')

    const admin = await this.adminAuthService.ensureInitialAdmin(username, password)
    this.logger.log(`已确认初始管理员账号：${admin.username}`)
  }
}
