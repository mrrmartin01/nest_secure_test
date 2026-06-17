import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CoreModule } from '@core/core.module';
import { PrismaModule } from '@database/prisma/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { SharedModule } from '@shared/shared.module';
import { appConfig } from '@shared/config/app.config';
import { databaseConfig } from '@shared/config/database.config';
import { jwtConfig } from '@shared/config/jwt.config';

@Module({
  imports: [
    // Config — loaded first; all other modules can inject ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      cache: true,
    }),

    // Structured logging — pino-http auto-instruments every request
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('app.logLevel', 'info'),
          transport:
            config.get<string>('app.nodeEnv') !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
              : undefined,
          autoLogging: true,
          quietReqLogger: true,
          serializers: {
            req: (req: { method: string; url: string; headers: Record<string, string> }) => ({
              method: req.method,
              url: req.url,
              correlationId: req.headers['x-correlation-id'],
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          redact: {
            paths: ['req.headers.authorization', 'req.body.password'],
            censor: '[REDACTED]',
          },
        },
      }),
    }),

    // Rate limiting — ThrottlerGuard applied globally via CoreModule
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('app.throttle.ttl', 60) * 1000,
            limit: config.get<number>('app.throttle.limit', 100),
          },
        ],
      }),
    }),

    // Infrastructure
    PrismaModule,
    SharedModule,
    CoreModule,

    // Feature modules
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
