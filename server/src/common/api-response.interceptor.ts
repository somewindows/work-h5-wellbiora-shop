import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable, map } from 'rxjs'

export interface ApiResponse<T> {
  code: 0
  data: T
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept<T>(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(map((data) => ({ code: 0, data })))
  }
}
