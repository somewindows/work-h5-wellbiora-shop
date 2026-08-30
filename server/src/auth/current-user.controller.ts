import { Controller, Get, UseGuards } from '@nestjs/common'

import { CurrentUserId } from '../common/current-user.decorator'
import { JwtAuthGuard } from '../common/jwt-auth.guard'

import { AuthService, type PublicUser } from './auth.service'

@Controller('users')
@UseGuards(JwtAuthGuard)
export class CurrentUserController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  getCurrentUser(@CurrentUserId() userId: string): Promise<PublicUser> {
    return this.authService.getCurrentUser(userId)
  }
}
