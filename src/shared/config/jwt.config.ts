import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const JwtEnvSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
    .optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
});

export const jwtConfig = registerAs('jwt', () => {
  const result = JwtEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`JWT config validation failed:\n${result.error.toString()}`);
  }
  const env = result.data;
  return {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  };
});

export type JwtConfig = ReturnType<typeof jwtConfig>;
