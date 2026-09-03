import { createParamDecorator, ExecutionContext } from '@nestjs/common'

import type { AuthenticatedAdminRequest } from './admin-jwt-auth.guard'
import type { AdminActor } from './audit-log.service'

export const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext): AdminActor => {
  const request = context.switchToHttp().getRequest<AuthenticatedAdminRequest>()
  return request.admin ?? { id: '', username: '' }
})
