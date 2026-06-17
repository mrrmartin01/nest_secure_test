import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';

@Module({
  providers: [
    // Global exception handling — catches everything that bubbles up
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },

    // JWT guard applied globally; routes opt-out via @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Interceptor execution order: first registered = outermost wrapper
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) => new ClassSerializerInterceptor(reflector),
      inject: [Reflector],
    },
  ],
})
export class CoreModule {}
