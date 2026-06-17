import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CORRELATION_ID_HEADER } from '@shared/constants';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const correlationId = request.headers[CORRELATION_ID_HEADER] as string | undefined;
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.debug({ handler, correlationId, durationMs: duration }, 'Handler completed');
        },
        error: () => {
          const duration = Date.now() - start;
          this.logger.warn({ handler, correlationId, durationMs: duration }, 'Handler failed');
        },
      }),
    );
  }
}
