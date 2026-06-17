import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const AppEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().default('NestJS Secure'),
  APP_VERSION: z.string().default('1.0.0'),
  CORS_ORIGINS: z.string().default(''),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

export const appConfig = registerAs('app', () => {
  const result = AppEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`App config validation failed:\n${result.error.toString()}`);
  }
  const env = result.data;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    name: env.APP_NAME,
    version: env.APP_VERSION,
    corsOrigins: env.CORS_ORIGINS.split(',').filter(Boolean),
    logLevel: env.LOG_LEVEL,
    isProduction: env.NODE_ENV === 'production',
    throttle: {
      ttl: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
    },
  };
});

export type AppConfig = ReturnType<typeof appConfig>;
