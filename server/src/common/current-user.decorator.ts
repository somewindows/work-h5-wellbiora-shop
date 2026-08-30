import { createParamDecorator, ExecutionContext } from '@nestjs/common'

import type { AuthenticatedRequest } from './jwt-auth.guard'

/** 从 JWT 守卫写入的请求上下文中取得当前用户标识。 */
export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
  return request.user?.id ?? ''
})
