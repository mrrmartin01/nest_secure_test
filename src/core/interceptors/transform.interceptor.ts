import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CORRELATION_ID_HEADER, SKIP_TRANSFORM_KEY } from '@shared/constants';
import type { ApiResponse } from '@shared/types/api-response.types';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const skipTransform = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipTransform) {
      return next.handle() as Observable<ApiResponse<T>>;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const correlationId = request.headers[CORRELATION_ID_HEADER] as string | undefined;

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
          correlationId,
          version: 'v1',
        },
      })),
    );
  }
}
